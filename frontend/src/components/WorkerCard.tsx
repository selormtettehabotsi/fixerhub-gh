import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemedStyles } from '../context/ThemeContext';
import { cloudinaryThumb } from '../utils/imageUrl';

interface WorkerCardProps {
  id: number;
  name: string;
  skill: string;
  rating: number;
  available: boolean;
  location?: string;
  ratePerHour?: number;
  verified?: boolean;
  profilePicture?: string;
  distanceKm?: number;
  /** SUBSCRIPTION: "PRO" shows the Pro badge */
  plan?: string;
  onPress: () => void;
  onChat?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

function WorkerCard({
  name,
  skill,
  rating,
  available,
  location,
  verified,
  profilePicture,
  distanceKm,
  plan,
  onPress,
  onChat,
}: WorkerCardProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      {/* ── Top: avatar + info ──────────────────────────────────── */}
      <View style={styles.topRow}>
        <View style={styles.avatarWrapper}>
          {profilePicture ? (
            <Image source={{ uri: cloudinaryThumb(profilePicture, 56) }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            </View>
          )}
          {verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={9} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {plan === 'PRO' && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={styles.skill} numberOfLines={1}>{skill}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={14} color={Colors.starColor} />
            {/* "New" reads better than a misleading 0.0 for unrated workers */}
            <Text style={styles.rating}>{rating > 0 ? rating.toFixed(1) : 'New'}</Text>
            {(distanceKm != null || location) && (
              <>
                <Text style={styles.dot}> • </Text>
                <Text style={styles.distance} numberOfLines={1}>
                  {distanceKm != null ? formatDistance(distanceKm) : location}
                </Text>
              </>
            )}
            {!available && (
              <>
                <Text style={styles.dot}> • </Text>
                <Text style={styles.busyText}>Busy</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── Bottom: full-width buttons ───────────────────────────── */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.viewBtn} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.viewBtnText}>View Profile</Text>
        </TouchableOpacity>
        {onChat && (
          <TouchableOpacity style={styles.chatBtn} onPress={onChat} activeOpacity={0.8}>
            <Text style={styles.chatBtnText}>Chat Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// PERF: skip re-renders unless the displayed data actually changed.
// Callback props are recreated by the parent every render, so they are
// intentionally excluded from the comparison (their behaviour is stable).
export default React.memo(WorkerCard, (prev, next) =>
  prev.id === next.id &&
  prev.name === next.name &&
  prev.skill === next.skill &&
  prev.rating === next.rating &&
  prev.available === next.available &&
  prev.location === next.location &&
  prev.verified === next.verified &&
  prev.profilePicture === next.profilePicture &&
  prev.distanceKm === next.distanceKm &&
  prev.plan === next.plan &&
  (prev.onChat === undefined) === (next.onChat === undefined)
);

const makeStyles = () => StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  // Avatar
  avatarWrapper: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  avatarText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 20 },
  verifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.available,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLowest,
  },

  // Info
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  proBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 2,
  },
  skill: {
    fontSize: 13,
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    marginBottom: 6,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  rating: {
    fontSize: 13,
    color: Colors.onSurface,
    fontFamily: 'Inter_500Medium',
    marginLeft: 4,
  },
  dot: { fontSize: 13, color: Colors.outline },
  distance: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    flexShrink: 1,
  },
  busyText: { fontSize: 13, color: Colors.unavailable, fontFamily: 'Inter_500Medium' },

  // Buttons — full width, each half
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  viewBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.outline,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
    fontFamily: 'Inter_600SemiBold',
  },
  chatBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
});
