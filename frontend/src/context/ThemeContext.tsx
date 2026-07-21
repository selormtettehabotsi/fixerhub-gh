import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { applyPalette } from '../constants/colors';

/**
 * THEMING v2 — INSTANT switching (no reload).
 *
 * How it works:
 *  - `Colors` (constants/colors.ts) is a single mutable object. `applyPalette`
 *    rewrites its values in place for the chosen light/dark palette.
 *  - Every screen builds its StyleSheet through `useThemedStyles(makeStyles)`,
 *    which is a `useMemo` keyed on the theme `version`. Bumping the version
 *    both rebuilds the styles AND re-renders the component (so inline `Colors.x`
 *    values in JSX re-evaluate too).
 *  - Switching the theme just calls `setPref` → mutate palette → bump version.
 *    Every mounted screen repaints immediately; navigation state is preserved.
 */

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'theme_preference';

interface ThemeContextValue {
  /** Increments on every theme change — the dependency that repaints screens. */
  version: number;
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  version: 0,
  pref: 'system',
  setPref: () => {},
});

function readStoredPref(): ThemePref {
  try {
    const v = Storage.getItemSync(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const [pref, setPrefState] = useState<ThemePref>(readStoredPref);

  const setPref = useCallback((next: ThemePref) => {
    try {
      Storage.setItemSync(KEY, next);
    } catch {
      /* ignore persistence failure */
    }
    applyPalette(next);            // mutate the shared Colors object in place
    setPrefState(next);
    setVersion((v) => v + 1);      // repaint every subscribed screen
  }, []);

  // When following the system setting, react live to OS light/dark changes.
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {
      if (pref === 'system') {
        applyPalette('system');
        setVersion((v) => v + 1);
      }
    });
    return () => sub.remove();
  }, [pref]);

  const value = useMemo(() => ({ version, pref, setPref }), [version, pref, setPref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Builds a StyleSheet that rebuilds whenever the theme changes. Pass a factory
 * that reads `Colors` (the mutated global) and returns `StyleSheet.create({...})`.
 * Subscribing here also re-renders the component so inline `Colors.*` refresh.
 */
export function useThemedStyles<T>(factory: () => T): T {
  const { version } = useContext(ThemeContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [version]);
}
