import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Client } from '@stomp/stompjs';
import * as tokenStorage from '../utils/tokenStorage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

/**
 * LIVE TRACKING (worker side): while `bookingId` is set (i.e. a booking is in
 * WORKER_ON_THE_WAY), stream the device's GPS position over STOMP to
 * /app/booking/{id}/location every ~7s / 20m. Pass null to stop.
 *
 * The server only accepts these frames from the booking's assigned worker and
 * only while the booking is actually en route, so a stale client can't leak.
 */
export function useLocationBroadcast(bookingId: number | null) {
  const stompRef = useRef<Client | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      const token = await tokenStorage.getItem('token');
      if (!token || cancelled) return;

      const stomp = new Client({
        brokerURL: WS_URL,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 8000,
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
        onConnect: async () => {
          if (cancelled) return;

          const publish = (lat: number, lng: number, heading: number | null) => {
            if (!stomp.connected) return;
            stomp.publish({
              destination: `/app/booking/${bookingId}/location`,
              body: JSON.stringify({ latitude: lat, longitude: lng, heading: heading ?? 0 }),
            });
          };

          // FIX: send the current position IMMEDIATELY — with only a watch,
          // a stationary phone (or iOS with distanceInterval) may never fire
          // its first tick, so the customer saw "Waiting for worker location…".
          try {
            const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            publish(first.coords.latitude, first.coords.longitude, first.coords.heading);
          } catch { /* watch below will retry */ }

          // Don't stack watchers across reconnects
          watchRef.current?.remove();
          watchRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 6000,    // FIX: time-based ticks even when stationary
              distanceInterval: 0,   // (was 20 m — never fired on a phone lying on a desk)
            },
            (pos) => publish(pos.coords.latitude, pos.coords.longitude, pos.coords.heading)
          );
        },
      });

      stomp.activate();
      stompRef.current = stomp;
    })();

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
      stompRef.current?.deactivate();
      stompRef.current = null;
    };
  }, [bookingId]);
}
