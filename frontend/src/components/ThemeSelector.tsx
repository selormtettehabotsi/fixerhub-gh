import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { ThemePref, loadThemePreference, setThemePreference } from '../utils/theme';

const OPTIONS: { key: ThemePref; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

/** Appearance card: segmented Light / Dark / System switch. */
export default function ThemeSelector() {
  const [pref, setPref] = useState<ThemePref>('system');

  useEffect(() => {
    loadThemePreference().then(setPref);
  }, []);

  const choose = (p: ThemePref) => {
    if (p === pref) return;
    setPref(p);
    setThemePreference(p); // saves + reloads the app to repaint every screen
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="color-palette-outline" size={20} color={Colors.primary} />
        <Text style={styles.title}>Appearance</Text>
      </View>
      <View style={styles.segment}>
        {OPTIONS.map((o) => {
          const active = pref === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => choose(o.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={o.icon} size={15} color={active ? Colors.onPrimary : Colors.onSurfaceVariant} />
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.onSurface },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  optionActive: { backgroundColor: Colors.primary },
  optionText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.onSurfaceVariant },
  optionTextActive: { color: Colors.onPrimary },
});
