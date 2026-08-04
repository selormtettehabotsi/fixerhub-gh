import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * OTA UPDATES — apply on this launch, not the next one.
 *
 * expo-updates' default is deliberately conservative: the app starts from the
 * bundle it already has, downloads the new one in the background, and only
 * swaps it in the NEXT time the app cold-starts. That is why a published
 * update seemed to "take so long" — nothing was broken, it just needed two
 * launches, and on a phone that keeps the app in memory the second launch may
 * not happen for days.
 *
 * This module closes that gap: check, download, reload — so the update lands
 * during the launch that found it.
 *
 * Two rules keep it from being annoying:
 *   1. It never runs in development (Metro serves the bundle there) or when
 *      updates are disabled, so it's a no-op in Expo Go.
 *   2. On a return from the background it only reloads if the app was away for
 *      a while. Reloading a screen someone left for ten seconds — mid-message,
 *      mid-form — would lose their work to save them one restart.
 */

/** How long the app must have been backgrounded before a resume may reload. */
const RESUME_GRACE_MS = 60_000;

/**
 * Check for a newer bundle and, if there is one, download and restart into it.
 * Returns false when there was nothing to do. Never throws: a failed update
 * check (no signal, Expo unreachable) must not stop the app from starting.
 */
export async function applyUpdateIfAvailable(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync(); // does not return — the app restarts here
    return true;
  } catch {
    // Offline, or the update server is unreachable. Try again next launch.
    return false;
  }
}

/**
 * Which bundle is actually running — useful when an update "isn't landing" and
 * you need to tell an embedded build apart from a downloaded one.
 */
export function currentUpdateLabel(): string {
  if (!Updates.isEnabled) return 'updates disabled (dev / Expo Go)';
  return Updates.isEmbeddedLaunch
    ? 'embedded bundle (from the APK)'
    : `OTA update ${Updates.updateId ?? 'unknown'}`;
}

/** Run the check on launch, and again on a real return from the background. */
export function useAutoUpdate(): void {
  const busy = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const run = () => {
      if (busy.current) return;
      busy.current = true;
      void applyUpdateIfAvailable().finally(() => {
        busy.current = false;
      });
    };

    run(); // launch

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const away = backgroundedAt.current;
        backgroundedAt.current = null;
        if (away !== null && Date.now() - away >= RESUME_GRACE_MS) run();
      } else if (state === 'background') {
        backgroundedAt.current = Date.now();
      }
    });

    return () => sub.remove();
  }, []);
}
