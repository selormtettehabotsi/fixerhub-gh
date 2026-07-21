import React, { useEffect, useState } from 'react';
import { useThemedStyles } from '../context/ThemeContext';
import { View, Text, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { getMyReferral, ReferralInfo } from '../api/auth';

/**
 * REFERRALS: "Invite friends" card — shows the user's share code and how many
 * invitees have completed their first paid booking.
 */
export default function ReferralCard() {
  const styles = useThemedStyles(makeStyles);
  const [info, setInfo] = useState<ReferralInfo | null>(null);

  useEffect(() => {
    getMyReferral().then(setInfo).catch(() => {});
  }, []);

  if (!info) return null;

  const share = () =>
    Share.share({
      message:
        `Join me on FixerHub — trusted plumbers, electricians and more, one tap away. ` +
        `Use my invite code ${info.code} when you sign up!`,
    }).catch(() => {});

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="gift-outline" size={20} color={Colors.primary} />
        <Text style={styles.title}>Invite friends</Text>
        {info.count > 0 && (
          <Text style={styles.count}>{info.count} joined & booked</Text>
        )}
      </View>
      <View style={styles.row}>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{info.code}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={16} color={Colors.onPrimary} />
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.onSurface, flex: 1 },
  count: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.available },
  row: { flexDirection: 'row', gap: 10 },
  codeBox: {
    flex: 1,
    backgroundColor: Colors.primaryFixed,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: { fontSize: 17, fontFamily: 'Inter_600SemiBold', letterSpacing: 2, color: Colors.primary },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  shareText: { color: Colors.onPrimary, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
