import React, { useState, useCallback } from 'react';
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
import { getBookingsByWorker, Booking } from '../../src/api/bookings';
import { getWorkerByUserId } from '../../src/api/workers';
import { getUserPublic } from '../../src/api/auth';
import { conversationId as mkConversationId } from '../../src/utils/formatId';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
import { useTabBar } from '../../src/context/TabBarContext';
import client from '../../src/api/client';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.secondary,
  COMPLETED: Colors.available,
  CANCELLED: Colors.unavailable,
  IN_PROGRESS: Colors.primary,
  WORKER_ON_THE_WAY: Colors.tertiary,
};

interface ChatMsg {
  senderId: string;
  senderName: string;
}

interface Conversation {
  customerId: number;
  customerPhone: string;
  customerName: string;        // resolved from chat history, user profile, or fallback
  customerPicture?: string;    // resolved from user profile
  latestBooking: Booking;
  bookingCount: number;
  conversationId: string;
}

export default function WorkerChatsScreen() {
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
      const workerProfile = await getWorkerByUserId(userId);
      const bookings = await getBookingsByWorker(workerProfile.id);

      // Group by customerId — one conversation per customer
      const map = new Map<number, Booking[]>();
      for (const b of bookings) {
        const arr = map.get(b.customerId) ?? [];
        arr.push(b);
        map.set(b.customerId, arr);
      }
      const convList: Omit<Conversation, 'customerName'>[] = [];
      for (const [customerId, bkgs] of map.entries()) {
        const sorted = [...bkgs].sort((a, b) => b.id - a.id);
        convList.push({
          customerId,
          customerPhone: sorted[0].customerPhone ?? '',
          latestBooking: sorted[0],
          bookingCount: sorted.length,
          conversationId: mkConversationId(customerId, workerProfile.id),
        });
      }
      convList.sort((a, b) => b.latestBooking.id - a.latestBooking.id);

      // Batch-resolve customer names + profile pictures in parallel.
      // Two sources: auth-service public profile (preferred) + chat history senderName (fallback).
      const withNames: Conversation[] = await Promise.all(
        convList.map(async (c) => {
          let customerName = c.customerPhone || 'Customer';
          let customerPicture: string | undefined;

          // 1. Try auth-service public profile — gives real name + profile picture
          try {
            const userInfo = await getUserPublic(c.customerId);
            if (userInfo.name) customerName = userInfo.name;
            if (userInfo.profilePicture) customerPicture = userInfo.profilePicture;
          } catch { /* ignore — fall through to chat history */ }

          // 2. If name still missing, try chat history senderName
          if (customerName === (c.customerPhone || 'Customer')) {
            try {
              const res = await client.get<ChatMsg[]>(`/chat/room/${c.conversationId}/history`);
              const msgs: ChatMsg[] = res.data ?? [];
              const customerMsg = msgs.find((m) => m.senderId !== userId);
              if (customerMsg?.senderName) customerName = customerMsg.senderName;
            } catch { /* ignore */ }
          }

          return { ...c, customerName, customerPicture };
        })
      );

      setConversations(withNames);

      // UNREAD BADGES: batch-count messages newer than each last-read mark
      const { fetchUnreadCounts } = await import('../../src/utils/chatUnread');
      setUnread(await fetchUnreadCounts(withNames.map((c) => c.conversationId)));
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

  function openChat(item: Conversation) {
    router.push({
      pathname: `/chat/${item.conversationId}`,
      params: { otherName: item.customerName },
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
        keyExtractor={(item) => String(item.customerId)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={56} color={Colors.outline} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Chat threads with customers will appear here.</Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          loading && conversations.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : null
        }
        renderItem={({ item }) => {
          const statusColor = STATUS_COLORS[item.latestBooking.status] ?? Colors.outline;
          const initials = item.customerName
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() ?? '')
            .join('') || 'C';

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openChat(item)}
              activeOpacity={0.85}
            >
              <View style={styles.avatarWrap}>
                {item.customerPicture ? (
                  <Image source={{ uri: cloudinaryThumb(item.customerPicture, 56) }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: Colors.secondary }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <View style={[styles.dot, { backgroundColor: statusColor }]} />
                {(unread[item.conversationId] ?? 0) > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {unread[item.conversationId] > 99 ? '99+' : unread[item.conversationId]}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, (unread[item.conversationId] ?? 0) > 0 && { fontWeight: '800' }]} numberOfLines={1}>{item.customerName}</Text>
                <Text style={styles.skill} numberOfLines={1}>{item.latestBooking.serviceType}</Text>
                <View style={styles.metaRow}>
                  {item.customerPhone ? (
                    <>
                      <Ionicons name="call-outline" size={12} color={Colors.outline} />
                      <Text style={styles.meta}> {item.customerPhone}</Text>
                      <Text style={styles.metaDot}> · </Text>
                    </>
                  ) : null}
                  <Text style={styles.meta}>{item.bookingCount} booking{item.bookingCount !== 1 ? 's' : ''}</Text>
                </View>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{item.latestBooking.status.replace(/_/g, ' ')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.outline} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  avatarFallback: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.onPrimary, fontSize: 20, fontWeight: '700' },
  dot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.surfaceContainerLowest },
  unreadBadge: { position: 'absolute', top: -4, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 1.5, borderColor: Colors.surfaceContainerLowest },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  skill: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  meta: { fontSize: 12, color: Colors.outline, fontFamily: 'Inter_400Regular' },
  metaDot: { fontSize: 12, color: Colors.outline },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#fff' },
});
