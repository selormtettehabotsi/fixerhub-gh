import React, { useEffect, useRef, useState } from 'react';
import { useThemedStyles } from '../context/ThemeContext';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '@stomp/stompjs';
import { Colors } from '../constants/colors';
import { getFreshAccessToken } from '../api/client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';
const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

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
 * the Google Directions API (with a straight-line fallback), and the ETA comes
 * from Google's driving-time estimate when available.
 */
export default function LiveTrackingMap({ bookingId, workerName, customerLat, customerLng }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [worker, setWorker] = useState<WorkerPosition | null>(null);
  const [connected, setConnected] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const stompRef = useRef<Client | null>(null);
  const mapRef = useRef<MapView>(null);
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
  // has moved >150 m from where the current route started. Falls back silently
  // to the straight line if the Directions API is unavailable.
  useEffect(() => {
    if (!worker || customerLat == null || customerLng == null || !MAPS_KEY) return;
    const movedKm = route
      ? haversineKm(worker.latitude, worker.longitude, route.origin.latitude, route.origin.longitude)
      : Infinity;
    if (movedKm < 0.15 || routeFetchBusy.current) return;

    routeFetchBusy.current = true;
    const origin: LatLng = { latitude: worker.latitude, longitude: worker.longitude };
    (async () => {
      try {
        const url =
          `https://maps.googleapis.com/maps/api/directions/json` +
          `?origin=${origin.latitude},${origin.longitude}` +
          `&destination=${customerLat},${customerLng}` +
          `&mode=driving&key=${MAPS_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        const r = data?.routes?.[0];
        const leg = r?.legs?.[0];
        if (r?.overview_polyline?.points && leg) {
          setRoute({
            coords: decodePolyline(r.overview_polyline.points),
            distanceKm: (leg.distance?.value ?? 0) / 1000,
            durationMin: Math.max(1, Math.round((leg.duration?.value ?? 60) / 60)),
            origin,
          });
        }
      } catch { /* keep straight-line fallback */ }
      finally { routeFetchBusy.current = false; }
    })();
  }, [worker?.latitude, worker?.longitude, customerLat, customerLng]);

  // Keep the whole route (or both markers) in view as the worker moves
  useEffect(() => {
    if (!worker || !mapRef.current) return;
    const coords: LatLng[] = route?.coords?.length
      ? route.coords
      : [{ latitude: worker.latitude, longitude: worker.longitude }];
    if (customerLat && customerLng) coords.push({ latitude: customerLat, longitude: customerLng });
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [worker?.latitude, worker?.longitude, customerLat, customerLng, route]);

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

      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={{
          latitude: worker?.latitude ?? customerLat ?? 5.6037,
          longitude: worker?.longitude ?? customerLng ?? -0.187,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {worker && (
          <Marker
            coordinate={{ latitude: worker.latitude, longitude: worker.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={worker.heading ?? 0}
            flat
          >
            <View style={styles.workerMarker}>
              <Ionicons name="construct" size={16} color={Colors.onPrimary} />
            </View>
          </Marker>
        )}
        {customerLat != null && customerLng != null && (
          <Marker coordinate={{ latitude: customerLat, longitude: customerLng }}>
            <View style={styles.homeMarker}>
              <Ionicons name="home" size={14} color={Colors.onPrimary} />
            </View>
          </Marker>
        )}
        {route?.coords?.length ? (
          // Real road-following route from the Directions API
          <Polyline coordinates={route.coords} strokeColor={Colors.primary} strokeWidth={4} />
        ) : hasEndpoints ? (
          // Fallback while the route loads (or if Directions is unavailable)
          <Polyline
            coordinates={[
              { latitude: worker!.latitude, longitude: worker!.longitude },
              { latitude: customerLat!, longitude: customerLng! },
            ]}
            strokeColor={Colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
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
  map: { height: 340, width: '100%' },
  workerMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  homeMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2e9e5b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
