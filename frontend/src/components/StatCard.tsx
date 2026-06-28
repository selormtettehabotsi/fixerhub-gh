import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: string;
  icon?: string;
}

export default function StatCard({ title, value, subtitle, accent, icon }: StatCardProps) {
  return (
    <View style={styles.card}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, accent ? { color: accent } : {}]}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    flex: 1,
    margin: 6,
    minHeight: 90,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
});
