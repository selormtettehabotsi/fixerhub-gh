import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface WorkerCardProps {
  id: number;
  name: string;
  skill: string;
  rating: number;
  available: boolean;
  location?: string;
  ratePerHour?: number;
  onPress: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={14}
          color={i <= Math.round(rating) ? Colors.starColor : Colors.outline}
        />
      ))}
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export default function WorkerCard({ name, skill, rating, available, location, ratePerHour, onPress }: WorkerCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(name)}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <View style={[styles.availBadge, { backgroundColor: available ? Colors.available : Colors.unavailable }]}>
            <Text style={styles.availText}>{available ? 'Available' : 'Busy'}</Text>
          </View>
        </View>
        <Text style={styles.skill}>{skill}</Text>
        <StarRow rating={rating} />
        {location && <View style={styles.locationRow}><Ionicons name="location-outline" size={12} color={Colors.onSurfaceVariant} /><Text style={styles.location}> {location}</Text></View>}
        {ratePerHour != null && <Text style={styles.rate}>GH₵ {ratePerHour}/hr</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
    flex: 1,
    marginRight: 8,
  },
  availBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  availText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  skill: {
    fontSize: 17,
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  star: {
    fontSize: 16,
    marginRight: 1,
  },
  starFilled: {
    color: Colors.starColor,
  },
  starEmpty: {
    color: Colors.outline,
  },
  ratingText: {
    fontSize: 16,
    color: Colors.onSurfaceVariant,
    marginLeft: 4,
  },
  location: {
    fontSize: 16,
    color: Colors.onSurfaceVariant,
  },
  rate: {
    fontSize: 17,
    color: Colors.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
});
