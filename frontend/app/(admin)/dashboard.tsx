import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { useThemedStyles } from '../../src/context/ThemeContext';
import { getAdminStats, getAdminDailyStats, AdminStats, DailyStats, DailyPoint } from '../../src/api/admin';
import StatCard from '../../src/components/StatCard';

/** Hand-rolled bar chart — no chart library needed. */
function BarChart({ points, valueKey, color, formatValue }: {
  points: DailyPoint[];
  valueKey: 'count' | 'amount';
  color: string;
  formatValue: (v: number) => string;
}) {
  const chartStyles = useThemedStyles(makeChartStyles);
  const values = points.map((p) => Number(p[valueKey] ?? 0));
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <View>
      <Text style={chartStyles.total}>{formatValue(total)} in the last {points.length} days</Text>
      <View style={chartStyles.row}>
        {points.map((p, i) => (
          <View key={p.date} style={chartStyles.barCol}>
            <View style={[chartStyles.bar, { height: Math.max(3, (values[i] / max) * 72), backgroundColor: values[i] > 0 ? color : Colors.surfaceContainerHigh }]} />
            {(i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)) && (
              <Text style={chartStyles.dayLabel}>{p.date.slice(8)}/{p.date.slice(5, 7)}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const makeChartStyles = () => StyleSheet.create({
  total: { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 92 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '80%', borderRadius: 3 },
  dayLabel: { fontSize: 9, color: Colors.outline, marginTop: 3, fontFamily: 'Inter_400Regular' },
});

export default function AdminDashboard() {
  const styles = useThemedStyles(makeStyles);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [daily, setDaily] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, dailyData] = await Promise.all([
        getAdminStats(),
        getAdminDailyStats(14).catch(() => null),   // charts are best-effort
      ]);
      setStats(data);
      if (dailyData) setDaily(dailyData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  async function onRefresh() {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }

  async function handleLogout() {
    // Local wipe first, server revocation in the background — see utils/signOut.
    // (This copy also used to leave email/phone/profilePicture behind.)
    const { signOut } = await import('../../src/utils/signOut');
    await signOut();
    router.replace('/(auth)/welcome');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>FixerHub Overview</Text>
          </View>
          <TouchableOpacity onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', onPress: handleLogout },
          ])}>
            <Ionicons name="log-out-outline" size={24} color={Colors.error} />
          </TouchableOpacity>
        </View>

        {loading && !stats && (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadStats} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MODERATION: quick access to the full user & booking registers */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/admin/users')} activeOpacity={0.8}>
            <Ionicons name="people" size={20} color={Colors.primary} />
            <Text style={styles.quickText}>Manage Users</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/admin/bookings')} activeOpacity={0.8}>
            <Ionicons name="briefcase" size={20} color={Colors.primary} />
            <Text style={styles.quickText}>All Bookings</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {stats && (
          <>
            <Text style={styles.sectionTitle}>Key Metrics</Text>
            <View style={styles.statsGrid}>
              <StatCard title="Total Users" value={stats.totalUsers} subtitle="Registered accounts" />
              <StatCard title="Active Workers" value={stats.activeWorkers} subtitle="Available now" accent={Colors.available} />
            </View>
            <View style={styles.statsGrid}>
              <StatCard title="Total Bookings" value={stats.totalBookings} subtitle="All time" accent={Colors.secondary} />
              <StatCard title="Revenue" value={`GH₵ ${stats.totalRevenue?.toFixed(2) ?? '0.00'}`} subtitle="Total collected" accent={Colors.primary} />
            </View>

            {/* SUBSCRIPTIONS + REFERRALS: growth programme visibility */}
            <Text style={styles.sectionTitle}>Growth</Text>
            <View style={styles.statsGrid}>
              <StatCard title="Pro Workers" value={stats.proWorkers ?? 0} subtitle="Active subscriptions" accent="#B8860B" />
              <StatCard
                title="Referrals"
                value={`${stats.creditedReferrals ?? 0}/${stats.referredSignups ?? 0}`}
                subtitle="Converted / signed up"
                accent={Colors.secondary}
              />
            </View>

            {/* CHARTS: 14-day trends */}
            {daily && daily.bookingsDaily.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Bookings — last 14 days</Text>
                <View style={styles.chartCard}>
                  <BarChart
                    points={daily.bookingsDaily}
                    valueKey="count"
                    color={Colors.primary}
                    formatValue={(v) => `${v} booking${v === 1 ? '' : 's'}`}
                  />
                </View>
                <Text style={styles.sectionTitle}>Revenue — last 14 days</Text>
                <View style={styles.chartCard}>
                  <BarChart
                    points={daily.revenueDaily}
                    valueKey="amount"
                    color="#2e7d32"
                    formatValue={(v) => `GH₵ ${v.toFixed(2)}`}
                  />
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>Commission Summary</Text>
            <View style={styles.commissionCard}>
              <View style={styles.commRow}>
                <Text style={styles.commLabel}>Total Commission Earned</Text>
                <Text style={styles.commValue}>GH₵ {stats.totalCommission?.toFixed(2) ?? '0.00'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.commRow}>
                <Text style={styles.commLabel}>Total Worker Payouts</Text>
                <Text style={[styles.commValue, { color: Colors.secondary }]}>GH₵ {stats.totalWorkerPayouts?.toFixed(2) ?? '0.00'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.commRow}>
                <Text style={styles.commLabel}>Gross Revenue</Text>
                <Text style={[styles.commValue, { color: Colors.primary }]}>
                  GH₵ {((stats.totalCommission ?? 0) + (stats.totalWorkerPayouts ?? 0)).toFixed(2)}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  subtitle: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  loaderBox: { alignItems: 'center', paddingVertical: 60 },
  errorBox: { margin: 20, backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 16, alignItems: 'center' },
  errorText: { color: Colors.error, fontSize: 16, marginBottom: 10 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: Colors.onPrimary, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginHorizontal: 20, marginTop: 20, marginBottom: 4 },
  statsGrid: { flexDirection: 'row', marginHorizontal: 14 },
  commissionCard: { margin: 20, marginTop: 8, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16 },
  commRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  commLabel: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  commValue: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  divider: { height: 1, backgroundColor: Colors.surfaceContainerLow },

  quickRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 12 },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  quickText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  chartCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 16,
  },
});
