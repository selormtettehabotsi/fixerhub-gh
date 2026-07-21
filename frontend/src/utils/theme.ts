import Storage from 'expo-sqlite/kv-store';
import { applyPalette } from '../constants/colors';

/**
 * THEME PREFERENCE — System / Light / Dark.
 *
 * DEPRECATED entry point. Theme switching now happens INSTANTLY through
 * `useTheme().setPref` (src/context/ThemeContext.tsx) — no reload. These helpers
 * remain only for any non-UI caller; they persist + apply the palette but can't
 * trigger the React re-render, so prefer the context hook inside components.
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

/** Persist + apply the palette. UI code should call `useTheme().setPref` instead
 *  (that one also repaints the screens live). */
export function setThemePreference(pref: ThemePref) {
  try {
    Storage.setItemSync(KEY, pref);
  } catch {
    /* ignore */
  }
  applyPalette(pref);
}
