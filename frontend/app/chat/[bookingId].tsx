import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '@stomp/stompjs';
import client from '../../src/api/client';
import { getUserPublic } from '../../src/api/auth';
import { markConversationRead } from '../../src/utils/chatUnread';
import { useUnread } from '../../src/context/UnreadContext';
import { Colors } from '../../src/constants/colors';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';
// Use raw WebSocket endpoint — SockJS requires browser APIs not available in React Native
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

interface ChatMessage {
  id?: number;
  /** Persistent customer↔worker conversation key (new, preferred) */
  conversationId?: string;
  /** Legacy per-booking key (kept for backward compat) */
  bookingId?: number;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export default function ChatScreen() {
  // The route param is named bookingId for URL compat, but now holds the conversationId
  // e.g. "/chat/c1_w2" → bookingId = "c1_w2"
  // otherName is optionally passed by the navigation source (worker name or customer name)
  const { bookingId: roomId, otherName: otherNameParam } = useLocalSearchParams<{ bookingId: string; otherName?: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  // The display name and picture shown in the nav header for the other person
  const [chatTitle, setChatTitle] = useState(otherNameParam ?? 'Chat');
  const { refresh: refreshUnread } = useUnread();
  const [otherPicture, setOtherPicture] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const stompRef = useRef<Client | null>(null);
  // Track whether STOMP has been set up already (avoid double-connect on focus)
  const stompReady = useRef(false);
  // Keep a stable ref to userId for use inside STOMP callbacks (avoids stale closures)
  const userIdRef = useRef('');

  useEffect(() => {
    AsyncStorage.multiGet(['userId', 'name']).then(async (pairs) => {
      const id = pairs[0][1] ?? '';
      setUserId(id);
      userIdRef.current = id;
      setUserName(pairs[1][1] ?? 'You');

      // Determine which user ID belongs to the other person from the conversationId
      // Format: "c{customerId}_w{workerId}"
      if (roomId && id) {
        const match = roomId.match(/^c(\d+)_w(\d+)$/);
        if (match) {
          const customerIdStr = match[1];
          const workerIdStr = match[2];
          // The other person is whichever ID does NOT match our userId
          // Note: workerId here is the worker PROFILE id, not user id.
          // For customers, other = worker profile → fetch via worker-service (already done via otherName param)
          // For workers, other = customer user id → fetch via auth-service
          const otherUserId = id === customerIdStr ? null : customerIdStr;
          if (otherUserId) {
            try {
              const info = await getUserPublic(otherUserId);
              if (info.profilePicture) setOtherPicture(info.profilePicture);
              if (!otherNameParam && info.name) setChatTitle(info.name);
            } catch { /* ignore */ }
          }
        }
      }
    });
  }, [roomId]);

  // Reload history every time this screen comes into focus (handles back-navigation)
  const fetchHistory = useCallback(async () => {
    if (!roomId) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await client.get<ChatMessage[]>(`/chat/room/${roomId}/history`);
      // Sort by timestamp ascending so oldest messages appear at the top
      const sorted = [...(res.data ?? [])].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      setMessages(sorted);
      // UNREAD BADGES: opening the chat clears its badge — instantly on the tab too
      markConversationRead(roomId).then(refreshUnread);

      // Resolve the other person's display name from the first message they sent.
      // Only update if we don't already have a name from the URL param.
      if (!otherNameParam && sorted.length > 0) {
        // Use the ref (populated on mount) to avoid a stale-closure race
        const myId = userIdRef.current || await AsyncStorage.getItem('userId') || '';
        const otherMsg = sorted.find((m) => m.senderId !== myId);
        if (otherMsg?.senderName) {
          setChatTitle(otherMsg.senderName);
        }
      }
    } catch {
      // History unavailable — show empty chat so the user can still send messages.
      // STOMP real-time delivery works independently of the REST history endpoint.
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [roomId, otherNameParam]);

  useFocusEffect(useCallback(() => {
    fetchHistory();
  }, [fetchHistory]));

  useEffect(() => {
    if (stompReady.current) return; // already connected
    stompReady.current = true;

    let stomp: Client | null = null;
    let cancelled = false;

    (async () => {
      // SECURITY (N1): the server rejects unauthenticated STOMP connections.
      const tokenStorage = await import('../../src/utils/tokenStorage');
      const token = await tokenStorage.getItem('token');
      if (cancelled) return;

      stomp = new Client({
      brokerURL: WS_URL,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 5000,
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      onConnect: () => {
        setConnected(true);
        // New room-based topic: /topic/chat/room/{conversationId}
        stomp!.subscribe(`/topic/chat/room/${roomId}`, (frame) => {
          const message: ChatMessage = JSON.parse(frame.body);
          markConversationRead(roomId);   // screen is open — incoming counts as read
          // If we still don't have a name for the other person, grab it from their message
          if (message.senderName && message.senderId !== userIdRef.current && !otherNameParam) {
            setChatTitle((prev) => prev === 'Chat' ? message.senderName : prev);
          }
          setMessages((prev) => {
            // Deduplicate: skip if we already have this server ID
            if (message.id && prev.some((m) => m.id === message.id)) return prev;
            // Replace matching optimistic message (no id, same sender+text within 10s)
            const now = Date.now();
            const optimisticIdx = prev.findIndex(
              (m) => !m.id && m.senderId === message.senderId && m.text === message.text
                && Math.abs((m.timestamp ?? 0) - (message.timestamp ?? now)) < 10000
            );
            if (optimisticIdx >= 0) {
              const next = [...prev];
              next[optimisticIdx] = message;
              return next;
            }
            return [...prev, message];
          });
        });
      },
      onDisconnect: () => {
        setConnected(false);
      },
      onStompError: (frame) => {
        setConnected(false);
        console.error('STOMP error', frame);
      },
      });

      stomp.activate();
      stompRef.current = stomp;
    })();

    return () => {
      cancelled = true;
      stompReady.current = false;
      stompRef.current?.deactivate();
    };
  }, [roomId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  function sendMessage() {
    const trimmed = inputText.trim();
    if (!trimmed || !connected || !stompRef.current?.connected || !userId) return;

    // Optimistically show the message immediately — don't wait for STOMP echo
    const optimistic: ChatMessage = {
      senderId: userId,
      senderName: userName,
      text: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputText('');

    // New room-based destination: /app/chat/room/{conversationId}
    stompRef.current.publish({
      destination: `/app/chat/room/${roomId}`,
      body: JSON.stringify({ senderId: userId, senderName: userName, text: trimmed }),
    });
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMine = item.senderId === userId;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMine && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
            {item.text}
          </Text>
          <Text style={[styles.timeText, isMine ? styles.timeTextMine : styles.timeTextOther]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  const canSend = inputText.trim().length > 0 && connected && !!userId;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Dynamically override the nav-bar title with the other person's name + avatar. */}
      <Stack.Screen options={{
        title: chatTitle,
        headerBackTitle: '',
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <Ionicons name="chevron-back" size={26} color="#ffffff" />
          </TouchableOpacity>
        ),
        headerRight: otherPicture ? () => (
          <Image
            source={{ uri: otherPicture }}
            style={{ width: 34, height: 34, borderRadius: 17, marginRight: 8 }}
          />
        ) : undefined,
      }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {historyLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => (item.id ? String(item.id) : `msg-${index}`)}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.outline} />
                <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
                <Text style={styles.emptySubtext}>Messages are delivered in real time</Text>
              </View>
            }
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {!connected && (
          <View style={styles.connectingBar}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={connected ? 'Type a message...' : 'Connecting...'}
            placeholderTextColor={Colors.outline}
            multiline
            maxLength={500}
            blurOnSubmit={false}
            editable={connected}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!canSend}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={20} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_600SemiBold' },
  emptySubtext: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  msgRow: { marginBottom: 12 },
  msgRowLeft: { alignItems: 'flex-start' },
  msgRowRight: { alignItems: 'flex-end' },
  senderName: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    shadowColor: Colors.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleOther: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomLeftRadius: 4,
    shadowColor: Colors.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleText: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  bubbleTextMine: { color: Colors.onPrimary },
  bubbleTextOther: { color: Colors.onSurface },
  timeText: { fontSize: 11, marginTop: 4, fontFamily: 'Inter_400Regular' },
  timeTextMine: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  timeTextOther: { color: Colors.outline },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.onSurface,
    fontFamily: 'Inter_400Regular',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceContainerHigh },
  connectingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
  },
  connectingText: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
});
