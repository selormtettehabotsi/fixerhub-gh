import React, { useMemo, useRef, useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * THE MAP, IN A WEBVIEW.
 *
 * react-native-maps on Android draws through Google's Maps SDK, and that
 * surface renders nothing — not even a custom tile overlay — unless the Cloud
 * project has an active billing account. We confirmed it: logcat shows
 * "urlTile: creating TileProvider" and then not a single tile request. So the
 * problem isn't which tiles we ask for, it's that the surface never composites
 * them. No amount of configuration gets around that.
 *
 * Leaflet in a WebView avoids the SDK completely: it's a normal web map,
 * fetching normal tile images over HTTPS. No key, no billing, no native map
 * dependency.
 *
 * The HTML is built ONCE (useMemo with no live values in it) and subsequent
 * position updates are pushed in with injectJavaScript. Rebuilding the HTML on
 * every GPS frame would reload the page and reset the view a few times a
 * minute, which is exactly the "map keeps flickering" bug you'd expect.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface Props {
  /** Worker's live position, or null while we wait for the first frame. */
  worker?: LatLng | null;
  /** Customer's position (the destination pin). */
  customer?: LatLng | null;
  /** Road-following route, when one has been fetched. */
  route?: LatLng[];
  /** Fallback centre before anything is known — Accra. */
  fallback?: LatLng;
  style?: ViewStyle;
}

const ACCRA: LatLng = { latitude: 5.6037, longitude: -0.187 };

/** Tiles: CARTO's CDN, same OpenStreetMap data, no User-Agent restrictions. */
const TILE_URL = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

function buildHtml(center: LatLng): string {
  // Leaflet from a CDN. Everything else is inline so there's nothing to bundle.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8e4e0; }
    .leaflet-control-attribution { font-size: 9px; }
    .pin {
      width: 26px; height: 26px; border-radius: 13px;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      font-size: 13px;
    }
    .pin-worker { background: #a33900; }
    .pin-home   { background: #1b5e20; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: true })
                .setView([${center.latitude}, ${center.longitude}], 13);

    L.tileLayer('${TILE_URL}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &middot; CARTO'
    }).addTo(map);

    var workerMarker = null, homeMarker = null, routeLine = null;

    function icon(cls, glyph) {
      return L.divIcon({
        html: '<div class="pin ' + cls + '">' + glyph + '</div>',
        className: '', iconSize: [26, 26], iconAnchor: [13, 13]
      });
    }

    // Called from React Native. Everything is optional so a partial update
    // (worker moved, route not fetched yet) doesn't wipe the other layers.
    function update(data) {
      try {
        var bounds = [];

        if (data.worker) {
          var w = [data.worker.latitude, data.worker.longitude];
          if (workerMarker) workerMarker.setLatLng(w);
          else workerMarker = L.marker(w, { icon: icon('pin-worker', '\\u{1F527}') }).addTo(map);
          bounds.push(w);
        }

        if (data.customer) {
          var c = [data.customer.latitude, data.customer.longitude];
          if (homeMarker) homeMarker.setLatLng(c);
          else homeMarker = L.marker(c, { icon: icon('pin-home', '\\u{1F3E0}') }).addTo(map);
          bounds.push(c);
        }

        if (data.route && data.route.length) {
          var pts = data.route.map(function (p) { return [p.latitude, p.longitude]; });
          if (routeLine) routeLine.setLatLngs(pts);
          else routeLine = L.polyline(pts, { color: '#a33900', weight: 4 }).addTo(map);
          bounds = pts;
        } else if (routeLine) {
          map.removeLayer(routeLine); routeLine = null;
        }

        if (bounds.length === 1) map.setView(bounds[0], 15);
        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
      } catch (e) { /* never let a bad frame break the map */ }
    }

    // Any updates that arrived before Leaflet finished loading.
    if (window.__pending) { update(window.__pending); window.__pending = null; }
  </script>
</body>
</html>`;
}

export default function LeafletMap({ worker, customer, route, fallback, style }: Props) {
  const webRef = useRef<WebView>(null);

  // Built once. The centre only seeds the very first view; after that the
  // update() call above controls the camera.
  const html = useMemo(
    () => buildHtml(worker ?? customer ?? fallback ?? ACCRA),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const payload = JSON.stringify({ worker, customer, route });
    // The guard matters: this fires while the page may still be parsing, and
    // calling an undefined update() would throw inside the WebView.
    webRef.current?.injectJavaScript(
      `(function(){ var d = ${payload};
         if (typeof update === 'function') update(d); else window.__pending = d;
       })(); true;`,
    );
  }, [worker?.latitude, worker?.longitude, customer?.latitude, customer?.longitude, route]);

  return (
    <WebView
      ref={webRef}
      style={[styles.web, style]}
      originWhitelist={['*']}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      // Leaflet handles its own gestures; these stop the page bouncing.
      scrollEnabled={false}
      bounces={false}
      // Android: without this the tile <img> loads are blocked on some devices.
      mixedContentMode="always"
      androidLayerType="hardware"
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#e8e4e0' },
});
