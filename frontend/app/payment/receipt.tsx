import React from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { formatBookingId } from '../../src/utils/formatId';

function ghs(value: string | undefined): string {
  const n = Number(value ?? 0);
  return `GH₵ ${n.toFixed(2)}`;
}

export default function PaymentReceiptScreen() {
  const styles = useThemedStyles(makeStyles);
  const {
    bookingId,
    serviceType,
    amount,
    workerAmount,
    commission,
    transactionRef,
    workerName,
    paidAt,
  } = useLocalSearchParams<{
    bookingId?: string;
    serviceType?: string;
    amount?: string;
    workerAmount?: string;
    commission?: string;
    transactionRef?: string;
    workerName?: string;
    paidAt?: string;
  }>();

  const dateStr = paidAt ? new Date(paidAt).toLocaleString() : new Date().toLocaleString();
  const bookingLabel = bookingId ? formatBookingId(Number(bookingId)) : '—';

  async function handleShare() {
    try {
      await Share.share({
        message:
          'FixerHub Payment Receipt\n' +
          `Booking #${bookingLabel}\n` +
          `Service: ${serviceType ?? '—'}\n` +
          `Amount Paid: ${ghs(amount)}\n` +
          `Worker Payout: ${ghs(workerAmount)}\n` +
          `FixerHub Commission: ${ghs(commission)}\n` +
          `Ref: ${transactionRef ?? '—'}\n` +
          `Date: ${dateStr}`,
      });
    } catch {
      // user dismissed share sheet
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Payment Receipt</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Payment Successful</Text>
          <Text style={styles.heroAmount}>{ghs(amount)}</Text>
        </View>

        <View style={styles.card}>
          <Row label="Booking ID" value={`#${bookingLabel}`} />
          <Row label="Service" value={serviceType ?? '—'} />
          <Row label="Worker" value={workerName ?? '—'} />
          <View style={styles.divider} />
          <Row label="Amount Paid" value={ghs(amount)} />
          <Row label="Worker Payout" value={ghs(workerAmount)} />
          <Row label="FixerHub Commission" value={ghs(commission)} />
          <View style={styles.divider} />
          <Row label="Transaction Ref" value={transactionRef ?? '—'} small />
          <Row label="Date" value={dateStr} small />
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
          <Text style={styles.shareBtnText}>Share Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backToBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.backToBtnText}>Back to Booking</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, small }: { label: string; value: string; small?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, small && styles.rowValueSmall]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', paddingVertical: 32 },
  checkCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.available,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  rowLabel: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  rowValue: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', flexShrink: 1, textAlign: 'right' },
  rowValueSmall: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  divider: { height: 1, backgroundColor: Colors.surfaceContainerHigh, marginVertical: 8 },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 24,
  },
  shareBtnText: { fontSize: 16, fontWeight: '700', color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },

  backToBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
  },
  backToBtnText: { fontSize: 16, fontWeight: '700', color: Colors.onPrimary, fontFamily: 'PlusJakartaSans_700Bold' },
});
