import Storage from 'expo-sqlite/kv-store';
import { Alert, DevSettings } from 'react-native';

/**
 * THEME PREFERENCE — System / Light / Dark.
 *
 * The preference is read synchronously in src/constants/colors.ts at module
 * load (before any screen builds its StyleSheets), so applying a change just
 * means: save + reload the JS. DevSettings.reload() does that instantly in
 * Expo Go / dev; production builds fall back to asking for an app restart.
 */

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'theme_preference';

export async function loadThemePreference(): Promise<ThemePref> {
  try {
    const v = Storage.getItemSync(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // fall through to default
  }
  return 'system';
}

/** Persist the choice and reload the app so every screen repaints. */
export function setThemePreference(pref: ThemePref) {
  Storage.setItemSync(KEY, pref);
  if (typeof DevSettings?.reload === 'function') {
    DevSettings.reload();
  } else {
    Alert.alert('Theme saved', 'Close and reopen the app to apply the new theme.');
  }
}
