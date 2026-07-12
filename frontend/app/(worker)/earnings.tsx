import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getPaymentsByWorker, getWorkerPaymentSummary, Payment, WorkerPaymentSummary } from '../../src/api/payments';
import { getWorkerByUserId } from '../../src/api/workers';
import { useTabBar } from '../../src/context/TabBarContext';

export default function EarningsScreen() {
  const { onScroll } = useTabBar();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<WorkerPaymentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await getWorkerByUserId(userId);
      const [paymentsData, summaryData] = await Promise.all([
        getPaymentsByWorker(profile.id),
        getWorkerPaymentSummary(profile.id),
      ]);
      setPayments(paymentsData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Earnings</Text>
        <Text style={styles.subtitle}>Track your income and payouts</Text>
      </View>

      {summary && (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderTopColor: Colors.available }]}>
            <Ionicons name="cash-outline" size={22} color={Colors.available} style={styles.summaryIcon} />
            <Text style={styles.summaryValue}>GH₵ {summary.totalEarned.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Total Earned</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: Colors.secondary }]}>
            <Ionicons name="briefcase-outline" size={22} color={Colors.secondary} style={styles.summaryIcon} />
            <Text style={styles.summaryValue}>{summary.totalJobs}</Text>
            <Text style={styles.summaryLabel}>Total Jobs</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: Colors.warning }]}>
            <Ionicons name="time-outline" size={22} color={Colors.warning} style={styles.summaryIcon} />
            <Text style={styles.summaryValue}>GH₵ {summary.pendingPayout.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={payments}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          loading && payments.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.sectionTitle}>Payment History</Text>
          )
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="cash-outline" size={52} color={Colors.outline} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No payments yet</Text>
              <Text style={styles.emptySubtext}>Completed jobs will appear here</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.paymentCard}>
            <View style={styles.paymentHeader}>
              <View>
                <Text style={styles.paymentBooking}>Booking #{item.bookingId}</Text>
                {item.createdAt && (
                  <Text style={styles.paymentDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                )}
              </View>
              <View style={styles.paymentAmounts}>
                <Text style={styles.workerAmount}>GH₵ {(item.workerAmount ?? 0).toFixed(2)}</Text>
                <Text style={styles.totalAmount}>of GH₵ {(item.amount ?? 0).toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.paymentFooter}>
              <Text style={styles.commissionText}>
                Commission: GH₵ {(item.commissionAmount ?? 0).toFixed(2)} ({((item.commissionRate ?? 0) * 100).toFixed(0)}%)
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: item.status === 'SUCCESS' ? Colors.available : Colors.warning }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  subtitle: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginVertical: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  summaryIcon: { marginBottom: 6 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', textAlign: 'center' },
  summaryLabel: { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2, textAlign: 'center' },
  errorBox: { marginHorizontal: 20, backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 14, marginBottom: 12 },
  errorText: { color: Colors.error, fontSize: 15, fontFamily: 'Inter_400Regular' },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 12 },
  loader: { marginVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { marginBottom: 14 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  emptySubtext: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  paymentCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, padding: 16, marginBottom: 12 },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  paymentBooking: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  paymentDate: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular', marginTop: 2 },
  paymentAmounts: { alignItems: 'flex-end' },
  workerAmount: { fontSize: 18, fontWeight: '700', color: Colors.available, fontFamily: 'PlusJakartaSans_700Bold' },
  totalAmount: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  paymentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commissionText: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
