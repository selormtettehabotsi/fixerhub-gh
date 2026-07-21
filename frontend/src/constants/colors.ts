import { Appearance } from 'react-native';

/**
 * THEMING — light ("Vibrant Marketplace") and dark ("Vibrant Noir") palettes.
 *
 * The theme follows the phone's system setting and is resolved once at app
 * launch (screens build their StyleSheets at import time, so a mid-session
 * OS theme change applies the next time the app starts).
 *
 * Requires "userInterfaceStyle": "automatic" in app.json — otherwise the OS
 * always reports "light".
 */

const LightColors = {
  primary: '#a33900',
  primaryContainer: '#cc4900',
  secondary: '#3755c3',
  tertiary: '#005da8',
  surface: '#f8f9fa',
  surfaceContainerLow: '#f3f4f5',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#edeeef',
  surfaceContainerHigh: '#e7e8e9',
  surfaceContainerHighest: '#e1e3e4',
  surfaceDim: '#d9dadb',
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onSurface: '#191c1d',
  onSurfaceVariant: '#5a4138',
  outline: '#8e7166',
  outlineVariant: '#e2bfb2',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  background: '#f8f9fa',
  inversePrimary: '#ffb599',
  primaryFixed: '#ffdbce',
  available: '#2e7d32',
  unavailable: '#ba1a1a',
  warning: '#f57c00',
  starColor: '#f9a825',
};

// "Vibrant Noir" — brighter orange for contrast on near-black surfaces,
// warm off-white text, #212121-family cards.
const DarkColors: typeof LightColors = {
  primary: '#c9480a',
  primaryContainer: '#e8520a',
  secondary: '#93a7f0',
  tertiary: '#66b2ff',
  surface: '#0d0d0d',
  surfaceContainerLow: '#1c1c1c',
  surfaceContainerLowest: '#171717',
  surfaceContainer: '#212121',
  surfaceContainerHigh: '#282828',
  surfaceContainerHighest: '#303030',
  surfaceDim: '#0a0a0a',
  onPrimary: '#ffffff',
  onSecondary: '#0d0d0d',
  onSurface: '#f3e6de',
  onSurfaceVariant: '#cdb6a9',
  outline: '#9e9e9e',
  outlineVariant: '#3a3a3a',
  error: '#ff8a80',
  errorContainer: '#5c1210',
  onError: '#ffffff',
  background: '#0d0d0d',
  inversePrimary: '#ffb599',
  primaryFixed: '#3f1c02',
  available: '#5dbb63',
  unavailable: '#ff6b62',
  warning: '#ffb74d',
  starColor: '#fbc02d',
};

/**
 * Theme resolution happens RIGHT HERE, synchronously, at module load — the
 * saved preference is read before any screen builds its first StyleSheet, so
 * the initial paint is already correct.
 *
 * `Colors` is a SINGLE MUTABLE object. Screens read it through
 * `useThemedStyles` (see context/ThemeContext.tsx); switching the theme calls
 * `applyPalette` to rewrite these values in place and bumps a version counter,
 * repainting every screen INSTANTLY — no app reload.
 */
function resolveDark(pref: string | null): boolean {
  return pref === 'dark' || (pref !== 'light' && Appearance.getColorScheme() === 'dark');
}

let savedPref: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Storage = require('expo-sqlite/kv-store').default;
  savedPref = Storage.getItemSync('theme_preference');
} catch {
  // storage unavailable — fall back to the system scheme
}

// Mutable shared palette — never reassign this reference, only mutate its keys.
export const Colors = { ...(resolveDark(savedPref) ? DarkColors : LightColors) };

/** Rewrite Colors in place for the chosen preference. Called on every switch. */
export function applyPalette(pref: 'system' | 'light' | 'dark'): void {
  const dark = pref === 'dark' || (pref !== 'light' && Appearance.getColorScheme() === 'dark');
  Object.assign(Colors, dark ? DarkColors : LightColors);
}

export function isDark(): boolean {
  return Colors.background === DarkColors.background;
}

export { LightColors, DarkColors };
