import React, { useState, useCallback } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getBookingsByCustomer, Booking } from '../../src/api/bookings';
import { getWorker, Worker } from '../../src/api/workers';
import { conversationId as mkConversationId } from '../../src/utils/formatId';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
import { useTabBar } from '../../src/context/TabBarContext';

interface Conversation {
  workerId: number;
  worker?: Worker;
  latestBooking: Booking;
  bookingCount: number;
  conversationId: string;
}

export default function CustomerChatsScreen() {
  const styles = useThemedStyles(makeStyles);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onScroll } = useTabBar();
  const [unread, setUnread] = useState<Record<string, number>>({});

  const loadConversations = useCallback(async () => {
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const bookings = await getBookingsByCustomer(userId);
      // Group by workerId — one conversation per worker
      const map = new Map<number, Booking[]>();
      for (const b of bookings) {
        const arr = map.get(b.workerId) ?? [];
        arr.push(b);
        map.set(b.workerId, arr);
      }
      // Build conversation list, most-recent booking first
      const convList: Conversation[] = [];
      for (const [workerId, bkgs] of map.entries()) {
        const sorted = [...bkgs].sort((a, b) => b.id - a.id);
        convList.push({
          workerId,
          latestBooking: sorted[0],
          bookingCount: sorted.length,
          conversationId: mkConversationId(userId, workerId),
        });
      }
      convList.sort((a, b) => b.latestBooking.id - a.latestBooking.id);

      // Fetch worker profiles for display
      const withWorkers = await Promise.all(
        convList.map(async (c) => {
          try {
            const worker = await getWorker(c.workerId);
            return { ...c, worker };
          } catch {
            return c;
          }
        })
      );
      setConversations(withWorkers);

      // UNREAD BADGES: batch-count messages newer than each last-read mark
      const { fetchUnreadCounts } = await import('../../src/utils/chatUnread');
      setUnread(await fetchUnreadCounts(withWorkers.map((c) => c.conversationId)));
    } catch (err: any) {
      setError(err.message ?? 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadConversations(); }, [loadConversations]));

  async function onRefresh() {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }

  function openChat(c: Conversation) {
    const workerName = c.worker?.name ?? '';
    router.push({
      pathname: `/chat/${c.conversationId}`,
      params: workerName ? { otherName: workerName } : {},
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.workerId)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={56} color={Colors.outline} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Chat with a worker once you have a booking.</Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          loading && conversations.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : null
        }
        renderItem={({ item }) => {
          const name = item.worker?.name ?? 'Worker';
          const skill = item.worker?.skill ?? item.latestBooking.serviceType;
          const pic = item.worker?.profilePicture;
          const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
          const statusColor = item.latestBooking.status === 'COMPLETED' ? Colors.available
            : item.latestBooking.status === 'CANCELLED' ? Colors.unavailable
            : Colors.primary;

          return (
            <TouchableOpacity style={styles.card} onPress={() => openChat(item)} activeOpacity={0.85}>
              <View style={styles.avatarWrap}>
                {pic ? (
                  <Image source={{ uri: cloudinaryThumb(pic, 56) }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <View style={[styles.dot, { backgroundColor: statusColor }]} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, (unread[item.conversationId] ?? 0) > 0 && { fontWeight: '800' }]} numberOfLines={1}>{name}</Text>
                <Text style={styles.skill} numberOfLines={1}>{skill}</Text>
                <Text style={styles.meta}>{item.bookingCount} booking{item.bookingCount !== 1 ? 's' : ''}</Text>
              </View>
              {(unread[item.conversationId] ?? 0) > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {unread[item.conversationId] > 99 ? '99+' : unread[item.conversationId]}
                  </Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={Colors.outline} />
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  errorBox: { marginHorizontal: 20, backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 12, marginBottom: 8 },
  errorText: { color: Colors.error, fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  loader: { marginVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  emptySubtext: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 20 },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.onPrimary, fontSize: 18, fontWeight: '700' },
  dot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.surfaceContainerLowest },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  skill: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  meta: { fontSize: 12, color: Colors.outline, fontFamily: 'Inter_400Regular' },
});
