import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getAdminBookingsPaged, type AdminBooking } from '../../src/api/admin';

const PAGE_SIZE = 30;

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  PENDING:           { color: '#B45309', bg: '#FEF3C7' },
  ACCEPTED:          { color: '#1D4ED8', bg: '#DBEAFE' },
  WORKER_ON_THE_WAY: { color: '#6D28D9', bg: '#EDE9FE' },
  IN_PROGRESS:       { color: '#0369A1', bg: '#E0F2FE' },
  COMPLETED:         { color: '#2e7d32', bg: 'rgba(46,125,50,0.1)' },
  CANCELLED:         { color: Colors.error, bg: Colors.errorContainer },
};

/** ADMIN — Bookings: paged, filterable list of every booking on the platform. */
export default function AdminBookingsScreen() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');

  const loadPage = useCallback(async (pageNum: number, replace: boolean) => {
    setLoading(true);
    try {
      const data = await getAdminBookingsPaged(pageNum, PAGE_SIZE);
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
      setBookings((prev) => {
        if (replace) return data;
        const seen = new Set(prev.map((b) => b.id));
        return [...prev, ...data.filter((b) => !seen.has(b.id))];
      });
    } catch (err: any) {
      Alert.alert('Could not load bookings', err.message ?? 'Try again');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadPage(0, true); }, [loadPage]));

  async function onRefresh() {
    setRefreshing(true);
    await loadPage(0, true);
    setRefreshing(false);
  }

  const FILTERS = ['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  const displayed = filter === 'ALL' ? bookings : bookings.filter((b) => b.status === filter);

  function renderBooking({ item }: { item: AdminBooking }) {
    const st = STATUS_COLORS[item.status] ?? { color: Colors.onSurfaceVariant, bg: Colors.surfaceContainerHigh };
    const amount = item.amount ?? item.quotedAmount;
    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <Text style={styles.bookingId}>#{item.id} · {item.serviceType}</Text>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <Text style={styles.detail}>
          Customer #{item.customerId} → {item.workerName || `Worker #${item.workerId}`}
        </Text>
        <View style={styles.rowBottom}>
          <Text style={styles.amount}>{amount != null ? `GH₵ ${Number(amount).toFixed(2)}` : 'No amount set'}</Text>
          <Text style={styles.date}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
            {item.recurrence && item.recurrence !== 'NONE' ? `  ·  ↻ ${item.recurrence.toLowerCase()}` : ''}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'ALL' ? 'All' : f.replace(/_/g, ' ').toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderBooking}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && hasMore) loadPage(page + 1, false);
        }}
        ListFooterComponent={
          loading ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 16 }} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="briefcase-outline" size={56} color={Colors.outline} />
              <Text style={styles.emptyText}>
                {filter === 'ALL' ? 'No bookings yet' : `No ${filter.toLowerCase().replace(/_/g, ' ')} bookings loaded`}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surfaceContainerLow },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  filterTextActive: { color: '#fff', fontWeight: '700' },

  list: { padding: 16, paddingBottom: 110 },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  bookingId: { fontSize: 15, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_600SemiBold' },
  detail: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  amount: { fontSize: 14, fontWeight: '700', color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
  date: { fontSize: 12, color: Colors.outline, fontFamily: 'Inter_400Regular' },

  emptyBox: { alignItems: 'center', paddingVertical: 72, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
});
