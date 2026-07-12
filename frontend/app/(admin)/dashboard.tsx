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
import { getAdminStats, AdminStats } from '../../src/api/admin';
import StatCard from '../../src/components/StatCard';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminStats();
      setStats(data);
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
    // TOKENS (H6/M1): revoke the refresh token server-side, clear keychain + storage
    const { logoutServer } = await import('../../src/api/auth');
    const tokenStorage = await import('../../src/utils/tokenStorage');
    await logoutServer(await tokenStorage.getItem('refreshToken'));
    await tokenStorage.multiRemove(['token', 'refreshToken', 'role', 'userId', 'name']);
    router.replace('/(auth)/welcome');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
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

const styles = StyleSheet.create({
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
});
