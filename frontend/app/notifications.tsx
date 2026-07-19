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
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import {
  getNotifications,
  markAllNotificationsRead,
  type AppNotification,
} from '../src/api/notifications';

const PAGE_SIZE = 30;

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  BOOKING: 'briefcase-outline',
  PAYMENT: 'card-outline',
  QUOTE: 'pricetag-outline',
  SYSTEM: 'notifications-outline',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** NOTIFICATION CENTER: full in-app history. Opening it marks everything read. */
export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPage = useCallback(async (pageNum: number, replace: boolean) => {
    setLoading(true);
    try {
      const data = await getNotifications(pageNum, PAGE_SIZE);
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
      setItems((prev) => {
        if (replace) return data;
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...data.filter((n) => !seen.has(n.id))];
      });
    } catch {
      // keep whatever we have
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPage(0, true);
      // Opening the center clears the bell badge
      markAllNotificationsRead().catch(() => {});
    }, [loadPage])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadPage(0, true);
    setRefreshing(false);
  }

  function open(item: AppNotification) {
    if (item.bookingId) {
      router.push({ pathname: '/booking/[id]', params: { id: String(item.bookingId) } });
    }
  }

  function renderItem({ item }: { item: AppNotification }) {
    const icon = TYPE_ICONS[item.type] ?? TYPE_ICONS.SYSTEM;
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => open(item)}
        activeOpacity={item.bookingId ? 0.7 : 1}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        {item.bookingId ? <Ionicons name="chevron-forward" size={16} color={Colors.outline} /> : null}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
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
              <Ionicons name="notifications-off-outline" size={56} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>Booking updates, quotes and payments will show up here.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  body: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, color: Colors.outline, fontFamily: 'Inter_400Regular', marginTop: 4 },
  emptyBox: { alignItems: 'center', paddingVertical: 80, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  emptyText: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
