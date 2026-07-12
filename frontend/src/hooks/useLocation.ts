import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

const FALLBACK = { latitude: 5.6037, longitude: -0.187 };
const TIMEOUT_MS = 8000;

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  /** true when coords are the Accra fallback, not a real GPS fix */
  isFallback: boolean;
}

/**
 * LIVE DISTANCE: resolves the user's position once for a fast first paint,
 * then keeps WATCHING it (every ~50 m moved) so screens depending on
 * latitude/longitude — like the "km away" labels on the nearby-workers list —
 * update automatically as the user moves. Falls back to central Accra when
 * permission is denied or GPS is slow.
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    loading: true,
    error: null,
    isFallback: false,
  });

  useEffect(() => {
    let cancelled = false;
    let watcher: Location.LocationSubscription | null = null;

    const fallbackTimer = setTimeout(() => {
      if (!cancelled) {
        setState((prev) => (prev.latitude == null ? { ...FALLBACK, loading: false, error: null, isFallback: true } : prev));
      }
    }, TIMEOUT_MS);

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        clearTimeout(fallbackTimer);
        if (!cancelled) setState({ ...FALLBACK, loading: false, error: null, isFallback: true });
        return;
      }

      // Fast first fix
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        clearTimeout(fallbackTimer);
        if (!cancelled) {
          setState({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            loading: false,
            error: null,
            isFallback: false,
          });
        }
      } catch (err: any) {
        clearTimeout(fallbackTimer);
        if (!cancelled) setState({ ...FALLBACK, loading: false, error: err.message, isFallback: true });
      }

      // Then keep it live: update whenever the user moves ~50 m.
      // Screens with [latitude, longitude] effect deps re-fetch automatically,
      // so distances stay accurate without hammering the API on GPS jitter.
      if (cancelled) return;
      try {
        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
          (pos) => {
            if (!cancelled) {
              setState({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                loading: false,
                error: null,
                isFallback: false,
              });
            }
          }
        );
      } catch {
        // watching unavailable — the one-shot fix above still stands
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      watcher?.remove();
    };
  }, []);

  return state;
}
