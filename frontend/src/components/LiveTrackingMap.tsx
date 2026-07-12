import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '@stomp/stompjs';
import { Colors } from '../constants/colors';
import * as tokenStorage from '../utils/tokenStorage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

interface WorkerPosition {
  latitude: number;
  longitude: number;
  heading?: number;
  timestamp?: number;
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
 * LIVE TRACKING (customer side): subscribes to /topic/booking/{id}/location
 * and shows the worker moving on a map with a straight-line route + ETA.
 * Rendered only while the booking is WORKER_ON_THE_WAY.
 */
export default function LiveTrackingMap({ bookingId, workerName, customerLat, customerLng }: Props) {
  const [worker, setWorker] = useState<WorkerPosition | null>(null);
  const [connected, setConnected] = useState(false);
  const stompRef = useRef<Client | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await tokenStorage.getItem('token');
      if (!token || cancelled) return;

      const stomp = new Client({
        brokerURL: WS_URL,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 8000,
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
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
      });

      stomp.activate();
      stompRef.current = stomp;
    })();

    return () => {
      cancelled = true;
      stompRef.current?.deactivate();
      stompRef.current = null;
    };
  }, [bookingId]);

  // Keep both markers in view as the worker moves
  useEffect(() => {
    if (!worker || !mapRef.current) return;
    const coords = [{ latitude: worker.latitude, longitude: worker.longitude }];
    if (customerLat && customerLng) coords.push({ latitude: customerLat, longitude: customerLng });
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [worker?.latitude, worker?.longitude, customerLat, customerLng]);

  const hasRoute = worker && customerLat && customerLng;
  const distanceKm = hasRoute
    ? haversineKm(worker.latitude, worker.longitude, customerLat!, customerLng!)
    : null;
  // Rough urban travel estimate at ~22 km/h, minimum 1 minute
  const etaMin = distanceKm != null ? Math.max(1, Math.round((distanceKm / 22) * 60)) : null;

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
        {hasRoute && (
          <Polyline
            coordinates={[
              { latitude: worker!.latitude, longitude: worker!.longitude },
              { latitude: customerLat!, longitude: customerLng! },
            ]}
            strokeColor={Colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
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
