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
    .recenter {
      background: #fff; border-radius: 16px; padding: 6px 12px;
      font: 12px -apple-system, Roboto, sans-serif; color: #a33900;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer;
      margin: 0 10px 10px 0;
    }
    /* Bigger touch targets than Leaflet's desktop defaults. */
    .leaflet-touch .leaflet-bar a { width: 34px; height: 34px; line-height: 34px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      // Explicit rather than relying on defaults: these are the gestures.
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: false,   // no wheel on a phone; avoids odd behaviour in dev
      zoomControl: true,        // +/- buttons, so zooming works even if pinch is
                                // swallowed by a parent scroll view
      attributionControl: true
    }).setView([${center.latitude}, ${center.longitude}], 13);

    L.tileLayer('${TILE_URL}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &middot; CARTO'
    }).addTo(map);

    var workerMarker = null, homeMarker = null, routeLine = null;

    // CAMERA OWNERSHIP.
    //
    // The map auto-fits both pins so you can see the whole journey. But the
    // worker's position arrives every few seconds, and re-fitting on every
    // frame means the moment you pan or zoom to look at something, the next
    // update snaps you straight back — the map feels broken even though it's
    // "working".
    //
    // So: auto-fit until the user touches the map, then leave the camera
    // alone and offer a recenter button to hand control back.
    //
    // The "programmatic" flag distinguishes our own fitBounds/setView (which
    // also fire dragstart/zoomstart) from a real finger on the screen.
    var userMoved = false;
    var programmatic = false;

    function markUserMoved() { if (!programmatic) { userMoved = true; showRecenter(true); } }
    map.on('dragstart', markUserMoved);
    map.on('zoomstart', markUserMoved);

    function apply(fn) {
      programmatic = true;
      try { fn(); } finally {
        // Cleared after the animation, or the events it fires look like the user.
        setTimeout(function () { programmatic = false; }, 400);
      }
    }

    // Recenter control — a normal Leaflet control so it sits inside the map
    // and doesn't need a React-side button overlaying the WebView.
    var recenterBtn = null;
    var Recenter = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        var b = L.DomUtil.create('div', 'recenter');
        b.innerHTML = 'Recenter';
        L.DomEvent.disableClickPropagation(b);
        b.onclick = function () { userMoved = false; showRecenter(false); fit(); };
        recenterBtn = b;
        b.style.display = 'none';
        return b;
      }
    });
    map.addControl(new Recenter());
    function showRecenter(v) { if (recenterBtn) recenterBtn.style.display = v ? 'block' : 'none'; }

    var lastBounds = [];
    function fit() {
      if (userMoved || !lastBounds.length) return;
      apply(function () {
        if (lastBounds.length === 1) map.setView(lastBounds[0], 15);
        else map.fitBounds(lastBounds, { padding: [40, 40] });
      });
    }

    // MARKER ICONS.
    //
    // Inline SVG, not emoji. The app's own markers use Ionicons, but that's a
    // React Native font and doesn't exist inside this WebView — the first cut
    // used emoji to get something on screen, which rendered differently on
    // every Android version and looked nothing like the rest of the app.
    // These are the same wrench and house shapes, drawn as paths.
    var SVG_WRENCH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="#fff">' +
      '<path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7' +
      'C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3' +
      'c.5-.4.5-1.1.1-1.4z"/></svg>';
    var SVG_HOME = '<svg viewBox="0 0 24 24" width="14" height="14" fill="#fff">' +
      '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

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
          else workerMarker = L.marker(w, { icon: icon('pin-worker', SVG_WRENCH) }).addTo(map);
          bounds.push(w);
        }

        if (data.customer) {
          var c = [data.customer.latitude, data.customer.longitude];
          if (homeMarker) homeMarker.setLatLng(c);
          else homeMarker = L.marker(c, { icon: icon('pin-home', SVG_HOME) }).addTo(map);
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

        lastBounds = bounds;
        fit();   // no-op once the user has taken over the camera
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
      // GESTURES. scrollEnabled={false} was here to stop the page bouncing —
      // it also stopped panning, because to the WebView a drag on the map IS
      // a scroll. Leaflet needs those touches, and it manages its own inertia,
      // so the page can't bounce anyway.
      scrollEnabled
      bounces={false}
      // The map lives inside a ScrollView on the booking screen. Without this
      // the parent claims every vertical drag and the map only pans sideways.
      nestedScrollEnabled
      // Pinch-zoom: Android WebViews disable it by default, and Leaflet's
      // touchZoom can't run without it. The controls stay hidden — Leaflet
      // draws its own +/- buttons.
      setBuiltInZoomControls
      setDisplayZoomControls={false}
      // Android: without this the tile <img> loads are blocked on some devices.
      mixedContentMode="always"
      androidLayerType="hardware"
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#e8e4e0' },
});
