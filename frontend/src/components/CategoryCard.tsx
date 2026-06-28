import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface CategoryCardProps {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}

export default function CategoryCard({ iconName, label, onPress }: CategoryCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={iconName} size={28} color={Colors.primary} style={styles.icon} />
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 80,
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginRight: 10,
  },
  icon: {
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: '600',
    textAlign: 'center',
  },
});
