import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

const FALLBACK = { latitude: 5.6037, longitude: -0.187 };
const TIMEOUT_MS = 8000;

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fallbackTimer = setTimeout(() => {
      if (!cancelled) {
        setState({ ...FALLBACK, loading: false, error: null });
      }
    }, TIMEOUT_MS);

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        clearTimeout(fallbackTimer);
        if (!cancelled) setState({ ...FALLBACK, loading: false, error: null });
        return;
      }
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
        });
      }
    })().catch((err) => {
      clearTimeout(fallbackTimer);
      if (!cancelled) setState({ ...FALLBACK, loading: false, error: err.message });
    });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, []);

  return state;
}
