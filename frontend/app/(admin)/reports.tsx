import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getReports, type Report, type ReportCategory, type ReportStatus } from '../../src/api/admin';
import { useTabBar } from '../../src/context/TabBarContext';
import Avatar from '../../src/components/Avatar';

// ─── Category config ─────────────────────────────────────────────────────────

type CatConfig = { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] };

const CATEGORY_CONFIG: Record<ReportCategory, CatConfig> = {
  PAYMENT_PROBLEM:   { label: 'Payment',   color: '#B45309', bg: '#FEF3C7', icon: 'card-outline' },
  IN_APP_ISSUE:      { label: 'App Issue', color: Colors.primary, bg: 'rgba(98,0,238,0.1)', icon: 'phone-portrait-outline' },
  WORKER_PROBLEM:    { label: 'Worker',    color: '#9A3412', bg: '#FEE2E2', icon: 'construct-outline' },
  CUSTOMER_PROBLEM:  { label: 'Customer',  color: '#1D4ED8', bg: '#DBEAFE', icon: 'person-outline' },
  OTHER:             { label: 'Other',     color: Colors.outline, bg: Colors.surfaceContainerHigh, icon: 'ellipsis-horizontal-circle-outline' },
};

type StatusConfig = { label: string; color: string; bg: string };
const STATUS_CONFIG: Record<ReportStatus, StatusConfig> = {
  OPEN:      { label: 'Open',      color: Colors.error,     bg: Colors.errorContainer },
  REVIEWING: { label: 'Reviewing', color: Colors.warning,   bg: 'rgba(245,124,0,0.12)' },
  RESOLVED:  { label: 'Resolved',  color: Colors.available, bg: 'rgba(46,125,50,0.1)' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AdminReportsScreen() {
  const { onScroll } = useTabBar();
  const [reports, setReports]     = useState<Report[]>([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [filter, setFilter]       = useState<ReportStatus | 'ALL'>('ALL');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReports();
      // Sort newest first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load reports');
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

  const displayed = filter === 'ALL' ? reports : reports.filter((r) => r.status === filter);
  const openCount = reports.filter((r) => r.status === 'OPEN').length;

  // ─── Render item ────────────────────────────────────────────────────────────

  function renderReport({ item }: { item: Report }) {
    const cat = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.OTHER;
    const st  = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.OPEN;
    const displayName = item.reporterName || item.reporterEmail || '?';

    return (
      <View style={styles.card}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <Avatar uri={item.reporterProfilePicture} name={displayName} size={40} />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.reporterName} numberOfLines={1}>{item.reporterName || 'Unknown'}</Text>
            <Text style={styles.reporterEmail} numberOfLines={1}>{item.reporterEmail}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        {/* Category chip + date */}
        <View style={styles.metaRow}>
          <View style={[styles.catChip, { backgroundColor: cat.bg }]}>
            <Ionicons name={cat.icon} size={12} color={cat.color} />
            <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  }

  // ─── Filter tabs ────────────────────────────────────────────────────────────

  type FilterOption = { key: ReportStatus | 'ALL'; label: string };
  const FILTERS: FilterOption[] = [
    { key: 'ALL', label: `All (${reports.length})` },
    { key: 'OPEN', label: `Open (${openCount})` },
    { key: 'REVIEWING', label: 'Reviewing' },
    { key: 'RESOLVED', label: 'Resolved' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>
          {openCount > 0
            ? `${openCount} open report${openCount !== 1 ? 's' : ''} need attention`
            : 'All reports have been reviewed'}
        </Text>
      </View>

      {/* Filter row */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={displayed}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListHeaderComponent={
          loading && reports.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="flag-outline" size={56} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No Reports</Text>
              <Text style={styles.emptyText}>
                {filter === 'ALL' ? 'No reports have been submitted yet' : `No ${filter.toLowerCase()} reports`}
              </Text>
            </View>
          ) : null
        }
        renderItem={renderReport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  subtitle: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },

  // Filter row
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surfaceContainerLow },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_500Medium' },
  filterTextActive: { color: '#fff', fontWeight: '700' },

  // Error
  errorBox: { margin: 20, backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 16, alignItems: 'center' },
  errorText: { color: Colors.error, fontSize: 14, marginBottom: 10 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: '#fff', fontWeight: '600' },

  list: { padding: 16, paddingBottom: 100 },
  loader: { marginVertical: 48 },

  emptyBox: { alignItems: 'center', paddingVertical: 72, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  emptyText: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  // Report card
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  cardHeaderInfo: { flex: 1 },
  reporterName: { fontSize: 15, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  reporterEmail: { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_600SemiBold' },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  catText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  dateText: { fontSize: 12, color: Colors.outline, fontFamily: 'Inter_400Regular' },

  description: { fontSize: 14, color: Colors.onSurface, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
