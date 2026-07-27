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

  // Older backends didn't return `signups`; fall back to the credited count so
  // the card still renders sensibly against a not-yet-rebuilt auth-service.
  const signups = info.signups ?? info.count ?? 0;

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

      {/* PROOF THE CODE IS WORKING. Previously nothing showed until an invitee
          actually paid, so a user who had shared their code successfully saw an
          empty card and assumed it was broken. Signups appear immediately. */}
      {signups > 0 ? (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="person-add-outline" size={15} color={Colors.primary} />
            <Text style={styles.statText}>
              <Text style={styles.statNum}>{signups}</Text>
              {signups === 1 ? ' friend joined' : ' friends joined'}
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="checkmark-circle-outline" size={15} color={Colors.available} />
            <Text style={styles.statText}>
              <Text style={[styles.statNum, { color: Colors.available }]}>{info.count}</Text>
              {' confirmed'}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.emptyHint}>
          Share your code — you'll see here as soon as someone joins with it.
        </Text>
      )}
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
  // Referral progress: signups (immediate) + confirmed conversions
  statsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  statNum: { fontFamily: 'PlusJakartaSans_700Bold', color: Colors.primary, fontSize: 14 },
  emptyHint: {
    fontSize: 12.5,
    color: Colors.outline,
    fontFamily: 'Inter_400Regular',
    marginTop: 12,
    lineHeight: 18,
  },
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
