import React, { useEffect, useRef, useState } from 'react';
import { useThemedStyles } from '../context/ThemeContext';
import { View, Text, StyleSheet } from 'react-native';
import LeafletMap from './LeafletMap';
import { Client } from '@stomp/stompjs';
import { Colors } from '../constants/colors';
import { getFreshAccessToken } from '../api/client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

/**
 * ROUTING — OSRM's public demo server, which needs no key and no billing.
 * Same job as the Directions API: a road-following geometry plus a duration.
 * It returns an encoded polyline in the same format Google uses, so
 * decodePolyline works unchanged.
 */
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

interface WorkerPosition {
  latitude: number;
  longitude: number;
  heading?: number;
  timestamp?: number;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

interface Props {
  bookingId: number;
  workerName?: string;
  /** Customer's own position (from useLocation) — used for the route line + ETA. */
  customerLat?: number | null;
  customerLng?: number | null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * ROAD ROUTING: decodes Google's encoded polyline format into lat/lng points
 * so the route follows real streets instead of a straight dashed line.
 */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const which of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte = 0x20;
      while (byte >= 0x20) {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      }
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

interface RouteInfo {
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
  /** Worker position the route was computed from (to know when to refresh). */
  origin: LatLng;
}

/**
 * LIVE TRACKING (customer side): subscribes to /topic/booking/{id}/location
 * and shows the worker moving on a map. The route line follows real roads via
 * OSRM (with a straight-line fallback), and the ETA comes from OSRM's
 * driving-time estimate when available.
 */
export default function LiveTrackingMap({ bookingId, workerName, customerLat, customerLng }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [worker, setWorker] = useState<WorkerPosition | null>(null);
  const [connected, setConnected] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  // Why there's no road route, when there isn't one. Shown in the card rather
  // than swallowed — a dashed line with no explanation is impossible to debug
  // from a user's phone.
  const [routeError, setRouteError] = useState<string | null>(null);
  // Bumped to retrigger the routing effect after a failure (see below).
  const [attempt, setAttempt] = useState(0);
  const stompRef = useRef<Client | null>(null);
  const routeFetchBusy = useRef(false);

  useEffect(() => {
    // FIX: fetch a fresh (auto-refreshed) token before every connect attempt —
    // a 15-min-old access token used to make the map reconnect-loop forever.
    const stomp: Client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 8000,
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      beforeConnect: async () => {
        const token = await getFreshAccessToken();
        stomp.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
      onConnect: () => {
        setConnected(true);
        stomp.subscribe(`/topic/booking/${bookingId}/location`, (frame) => {
          try {
            const pos: WorkerPosition = JSON.parse(frame.body);
            setWorker(pos);
          } catch { /* ignore malformed frames */ }
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketError: () => setConnected(false),
    });

    stomp.activate();
    stompRef.current = stomp;

    return () => {
      stompRef.current?.deactivate();
      stompRef.current = null;
    };
  }, [bookingId]);

  // ROAD ROUTING: (re)fetch the driving route when the worker first appears or
  // has moved >150 m from where the current route started.
  //
  // RETRY (this was a real bug): the effect only re-runs when the worker's
  // coordinates change, and the 150 m guard then blocks anything smaller. So a
  // single failed first attempt — slow connection, app backgrounded, the
  // customer's GPS arriving a moment after the worker's — left the map on the
  // straight dashed line until the worker physically moved 150 m. During a
  // stationary test that's never, and it looked like routing simply didn't
  // work. `attempt` is bumped on failure to re-trigger the effect.
  useEffect(() => {
    if (!worker || customerLat == null || customerLng == null) return;
    const movedKm = route
      ? haversineKm(worker.latitude, worker.longitude, route.origin.latitude, route.origin.longitude)
      : Infinity;
    if (movedKm < 0.15 || routeFetchBusy.current) return;

    routeFetchBusy.current = true;
    const origin: LatLng = { latitude: worker.latitude, longitude: worker.longitude };
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // Backing off rather than hammering: a routing server that just failed is
    // often busy, and this runs on someone's mobile data.
    const scheduleRetry = (why: string) => {
      setRouteError(why);
      if (attempt >= 4) return;   // ~1 min of trying, then live with the estimate
      retryTimer = setTimeout(() => setAttempt((a) => a + 1), 4000 * (attempt + 1));
    };

    (async () => {
      try {
        // OSRM takes lng,lat (GeoJSON order) — the reverse of Google's.
        const url =
          `${OSRM_URL}/` +
          `${origin.longitude},${origin.latitude};${customerLng},${customerLat}` +
          `?overview=full&geometries=polyline`;
        const res = await fetch(url);
        const data = await res.json();
        const r = data?.routes?.[0];
        // distance is in metres and duration in seconds, same units as Google.
        if (r?.geometry && typeof r.distance === 'number') {
          setRoute({
            coords: decodePolyline(r.geometry),
            distanceKm: r.distance / 1000,
            durationMin: Math.max(1, Math.round((r.duration ?? 60) / 60)),
            origin,
          });
          setRouteError(null);
        } else {
          // OSRM answered but had no route — e.g. a point in the sea, or
          // "NoRoute" between two unconnected places. Retrying won't fix that.
          setRouteError(data?.code ? `route: ${data.code}` : 'route: no path found');
        }
      } catch (e: any) {
        scheduleRetry(`route: ${e?.message ?? 'request failed'}`);
      } finally {
        routeFetchBusy.current = false;
      }
    })();

    return () => { if (retryTimer) clearTimeout(retryTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker?.latitude, worker?.longitude, customerLat, customerLng, attempt]);


  const hasEndpoints = worker && customerLat != null && customerLng != null;
  // Prefer Google's real driving distance/ETA; fall back to straight-line ~22 km/h
  const distanceKm = route
    ? route.distanceKm
    : hasEndpoints
      ? haversineKm(worker!.latitude, worker!.longitude, customerLat!, customerLng!)
      : null;
  const etaMin = route
    ? route.durationMin
    : distanceKm != null
      ? Math.max(1, Math.round((distanceKm / 22) * 60))
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.pulseDot} />
        <Text style={styles.headerText}>
          {worker
            ? (workerName === 'You' ? "You're on the way" : `${workerName ?? 'Your worker'} is on the way`)
            : connected
              ? 'Waiting for worker location…'
              : 'Connecting…'}
        </Text>
        {etaMin != null && (
          <Text style={styles.eta}>{distanceKm!.toFixed(1)} km · ~{etaMin} min</Text>
        )}
      </View>

      {/* WHY THE LINE IS DASHED. Three distinguishable states, because "dashed
          line, no explanation" is the hardest kind of bug to report:
            - no customer location  -> nothing can be routed at all
            - routing unavailable   -> we're showing a straight-line estimate
            - nothing               -> a real road route is on screen */}
      {customerLat == null || customerLng == null ? (
        <Text style={styles.routeNote}>
          Location off — showing a direct line. Turn on location for road directions.
        </Text>
      ) : route == null && worker ? (
        <Text style={styles.routeNote}>
          Direct line{routeError ? ` — ${routeError}` : ' — finding road directions…'}
        </Text>
      ) : null}

      {/* The map itself is a WebView (see LeafletMap): Google's Android map
          surface refuses to composite anything without billing, so a native
          MapView here draws nothing at all. Everything above — the STOMP
          position feed, the OSRM route, the ETA — is unchanged; only the
          renderer swapped. */}
      <LeafletMap
        style={styles.map}
        worker={worker ? { latitude: worker.latitude, longitude: worker.longitude } : null}
        customer={
          customerLat != null && customerLng != null
            ? { latitude: customerLat, longitude: customerLng }
            : null
        }
        route={
          route?.coords?.length
            ? route.coords
            : hasEndpoints
              ? [
                  { latitude: worker!.latitude, longitude: worker!.longitude },
                  { latitude: customerLat!, longitude: customerLng! },
                ]
              : undefined
        }
        routeIsRoad={!!route?.coords?.length}
      />

      {/* Attribution is required by both OpenStreetMap's licence (the data)
          and CARTO's terms (the tile rendering). */}
      <Text style={styles.attribution}>© OpenStreetMap · CARTO</Text>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontSize: 9,
    color: Colors.onSurfaceVariant,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainerLowest,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2e9e5b',
    marginRight: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurface,
    fontFamily: 'Inter_600SemiBold',
  },
  eta: {
    fontSize: 13,
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  routeNote: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 14,
    paddingBottom: 8,
    marginTop: -4,
  },
  map: { height: 340, width: '100%' },
});
