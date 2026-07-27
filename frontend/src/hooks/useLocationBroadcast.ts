import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Client } from '@stomp/stompjs';
import { getFreshAccessToken } from '../api/client';

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

      if (cancelled) return;

      // FIX: refresh the access token before every connect attempt — a stale
      // 15-min JWT used to make the GPS stream reconnect-loop forever.
      const stomp: Client = new Client({
        brokerURL: WS_URL,
        beforeConnect: async () => {
          const token = await getFreshAccessToken();
          stomp.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        },
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

          // SPEED: publish the OS's CACHED position instantly (milliseconds) so
          // the customer's map shows the worker right away — a fresh GPS fix
          // can take 5–30s and used to leave "Waiting for worker location…".
          try {
            const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
            if (last) publish(last.coords.latitude, last.coords.longitude, last.coords.heading);
          } catch { /* fresh fix below */ }

          // Fresh fix refines the cached one (and covers phones with no cache)
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
