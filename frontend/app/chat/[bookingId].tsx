import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
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
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '@stomp/stompjs';
import { Audio } from 'expo-av';
import client, { getFreshAccessToken } from '../../src/api/client';
import { getUserPublic } from '../../src/api/auth';
import { markConversationRead } from '../../src/utils/chatUnread';
import { useUnread } from '../../src/context/UnreadContext';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
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
  /** VOICE MESSAGES: Cloudinary URL of a recorded clip */
  audioUrl?: string | null;
  /** READ RECEIPTS: true once the other participant has read it */
  read?: boolean;
  timestamp: number;
}

interface PeerInfo {
  name?: string;
  phone?: string;
  profilePicture?: string;
}

export default function ChatScreen() {
  const styles = useThemedStyles(makeStyles);
  // The route param is named bookingId for URL compat, but now holds the conversationId
  // e.g. "/chat/c1_w2" → bookingId = "c1_w2"
  const { bookingId: roomId, otherName: otherNameParam } = useLocalSearchParams<{ bookingId: string; otherName?: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [chatTitle, setChatTitle] = useState(otherNameParam ?? 'Chat');
  const [otherPicture, setOtherPicture] = useState<string | null>(null);
  const [peerPhone, setPeerPhone] = useState<string | null>(null);
  const { refresh: refreshUnread } = useUnread();
  // VOICE MESSAGES
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordSecs, setRecordSecs] = useState(0);
  const [audioBusy, setAudioBusy] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const stompRef = useRef<Client | null>(null);
  const stompReady = useRef(false);
  const userIdRef = useRef('');
  const focusedRef = useRef(true);

  // READ RECEIPTS: tell the server we've seen everything (flips the sender's ✓ to ✓✓)
  const markServerRead = useCallback(() => {
    if (roomId) client.put(`/chat/room/${roomId}/read`).catch(() => {});
  }, [roomId]);

  useEffect(() => {
    AsyncStorage.multiGet(['userId', 'name']).then(async (pairs) => {
      const id = pairs[0][1] ?? '';
      setUserId(id);
      userIdRef.current = id;
      setUserName(pairs[1][1] ?? 'You');
    });
  }, [roomId]);

  // CHAT HEADER: the other person's name, picture and phone (for the call button)
  useEffect(() => {
    if (!roomId) return;
    client
      .get<PeerInfo>(`/chat/room/${roomId}/peer`)
      .then((res) => {
        const p = res.data ?? {};
        if (p.name) setChatTitle(p.name);
        if (p.profilePicture) setOtherPicture(p.profilePicture);
        if (p.phone) setPeerPhone(p.phone);
      })
      .catch(async () => {
        // Fallback: resolve the customer's public info from the conversation id
        const id = userIdRef.current || (await AsyncStorage.getItem('userId')) || '';
        const match = roomId.match(/^c(\d+)_w(\d+)$/);
        if (match && id !== match[1]) {
          try {
            const info = await getUserPublic(match[1]);
            if (info.profilePicture) setOtherPicture(info.profilePicture);
            if (!otherNameParam && info.name) setChatTitle(info.name);
          } catch { /* ignore */ }
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
      const sorted = [...(res.data ?? [])].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      setMessages(sorted);
      // UNREAD BADGES: opening the chat clears its badge — instantly on the tab too
      markConversationRead(roomId).then(refreshUnread);
      markServerRead();   // READ RECEIPTS

      if (!otherNameParam && sorted.length > 0) {
        const myId = userIdRef.current || (await AsyncStorage.getItem('userId')) || '';
        const otherMsg = sorted.find((m) => m.senderId !== myId);
        if (otherMsg?.senderName) {
          setChatTitle((prev) => (prev === 'Chat' ? otherMsg.senderName : prev));
        }
      }
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [roomId, otherNameParam, markServerRead]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      fetchHistory();
      return () => { focusedRef.current = false; };
    }, [fetchHistory])
  );

  useEffect(() => {
    if (stompReady.current) return; // already connected
    stompReady.current = true;

    // SECURITY (N1) + FIX: fetch a fresh (auto-refreshed) token before EVERY
    // connect attempt — a stale 15-min JWT used to loop "Connecting…" forever.
    const stomp: Client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      beforeConnect: async () => {
        const token = await getFreshAccessToken();
        stomp.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
      onConnect: () => {
        setConnected(true);
        stomp.subscribe(`/topic/chat/room/${roomId}`, (frame) => {
          const payload = JSON.parse(frame.body);

          // READ RECEIPTS: the other person opened the chat → flip my ✓ to ✓✓
          if (payload.receipt === 'READ') {
            if (String(payload.readerId) !== userIdRef.current) {
              setMessages((prev) =>
                prev.map((m) => (m.senderId === userIdRef.current ? { ...m, read: true } : m))
              );
            }
            return;
          }

          const message: ChatMessage = payload;
          markConversationRead(roomId);   // screen is open — incoming counts as read
          if (message.senderId !== userIdRef.current && focusedRef.current) {
            markServerRead();             // tell the sender we read it immediately
          }
          if (message.senderName && message.senderId !== userIdRef.current && !otherNameParam) {
            setChatTitle((prev) => (prev === 'Chat' ? message.senderName : prev));
          }
          setMessages((prev) => {
            if (message.id && prev.some((m) => m.id === message.id)) return prev;
            const now = Date.now();
            const optimisticIdx = prev.findIndex(
              (m) => !m.id && m.senderId === message.senderId
                && (m.text === message.text || (!!m.audioUrl && m.audioUrl === message.audioUrl))
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
      onDisconnect: () => setConnected(false),
      onStompError: (frame) => {
        setConnected(false);
        console.warn('STOMP error:', frame.headers?.message ?? 'connection rejected');
      },
      onWebSocketError: () => setConnected(false),
    });

    stomp.activate();
    stompRef.current = stomp;

    return () => {
      stompReady.current = false;
      stompRef.current?.deactivate();
    };
  }, [roomId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      if (recordTimer.current) clearInterval(recordTimer.current);
    };
  }, []);

  function publish(payload: { senderName: string; text: string; audioUrl?: string }) {
    stompRef.current?.publish({
      destination: `/app/chat/room/${roomId}`,
      body: JSON.stringify({ senderId: userId, ...payload }),
    });
  }

  function sendMessage() {
    const trimmed = inputText.trim();
    if (!trimmed || !connected || !stompRef.current?.connected || !userId) return;

    const optimistic: ChatMessage = {
      senderId: userId,
      senderName: userName,
      text: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputText('');
    publish({ senderName: userName, text: trimmed });
  }

  // ── VOICE MESSAGES ──────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Microphone needed', 'Allow microphone access to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setRecordSecs(0);
      recordTimer.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch (e: any) {
      Alert.alert('Recording failed', e.message ?? 'Try again');
    }
  }

  async function stopRecording(send: boolean) {
    const rec = recording;
    setRecording(null);
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (!send || !uri || recordSecs < 1) return;   // too short / cancelled

      setAudioBusy(true);
      const formData = new FormData();
      formData.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' } as any);
      formData.append('folder', 'chat-audio');
      const res = await client.post<{ url: string }>('/auth/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.url;

      const optimistic: ChatMessage = {
        senderId: userId,
        senderName: userName,
        text: '🎤 Voice message',
        audioUrl: url,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, optimistic]);
      publish({ senderName: userName, text: '🎤 Voice message', audioUrl: url });
    } catch (e: any) {
      Alert.alert('Could not send voice message', e.message ?? 'Try again');
    } finally {
      setAudioBusy(false);
      setRecordSecs(0);
    }
  }

  async function togglePlay(item: ChatMessage) {
    const key = item.id ? String(item.id) : `t${item.timestamp}`;
    try {
      if (playingKey === key) {
        await soundRef.current?.stopAsync();
        setPlayingKey(null);
        return;
      }
      await soundRef.current?.unloadAsync().catch(() => {});
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: item.audioUrl! }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingKey(key);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setPlayingKey(null);
      });
    } catch {
      setPlayingKey(null);
    }
  }

  function formatSecs(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function renderTicks(item: ChatMessage) {
    // READ RECEIPTS on my own bubbles: ⏱ sending → ✓ sent → ✓✓ read
    if (!item.id) return <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" />;
    return item.read
      ? <Ionicons name="checkmark-done" size={14} color="#7CFC9B" />
      : <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.75)" />;
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMine = item.senderId === userId;
    const key = item.id ? String(item.id) : `t${item.timestamp}`;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMine && <Text style={styles.senderName}>{item.senderName}</Text>}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {item.audioUrl ? (
            // VOICE MESSAGE bubble
            <TouchableOpacity style={styles.audioRow} onPress={() => togglePlay(item)} activeOpacity={0.7}>
              <Ionicons
                name={playingKey === key ? 'pause-circle' : 'play-circle'}
                size={34}
                color={isMine ? Colors.onPrimary : Colors.primary}
              />
              <View style={styles.audioBars}>
                {[10, 16, 8, 18, 12, 20, 9, 15, 11].map((h, i) => (
                  <View
                    key={i}
                    style={[styles.audioBar, { height: h, backgroundColor: isMine ? 'rgba(255,255,255,0.8)' : Colors.primary }]}
                  />
                ))}
              </View>
              <Text style={[styles.audioLabel, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
                Voice
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
              {item.text}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.timeText, isMine ? styles.timeTextMine : styles.timeTextOther]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMine && renderTicks(item)}
          </View>
        </View>
      </View>
    );
  }

  const canSend = inputText.trim().length > 0 && connected && !!userId;
  const showMic = inputText.trim().length === 0 && connected && !!userId;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* CHAT HEADER: avatar + name on the left, call button on the right */}
      <Stack.Screen
        options={{
          headerBackTitle: '',
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 6, paddingVertical: 4 }}>
                <Ionicons name="chevron-back" size={26} color="#ffffff" />
              </TouchableOpacity>
              {otherPicture ? (
                <Image
                  source={{ uri: cloudinaryThumb(otherPicture, 34) }}
                  style={{ width: 34, height: 34, borderRadius: 17, marginRight: 8 }}
                />
              ) : (
                <View style={styles.headerAvatarFallback}>
                  <Text style={styles.headerAvatarText}>
                    {(chatTitle || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </Text>
                </View>
              )}
            </View>
          ),
          headerTitle: () => (
            <Text style={styles.headerName} numberOfLines={1}>{chatTitle}</Text>
          ),
          headerRight: peerPhone
            ? () => (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${peerPhone}`)}
                  style={{ paddingHorizontal: 10, paddingVertical: 4 }}
                >
                  <Ionicons name="call" size={22} color="#ffffff" />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
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
          {recording ? (
            // VOICE MESSAGES: recording state — cancel / timer / send
            <>
              <TouchableOpacity style={styles.recCancelBtn} onPress={() => stopRecording(false)}>
                <Ionicons name="trash-outline" size={22} color={Colors.error} />
              </TouchableOpacity>
              <View style={styles.recTimerBox}>
                <View style={styles.recDot} />
                <Text style={styles.recTimerText}>Recording… {formatSecs(recordSecs)}</Text>
              </View>
              <TouchableOpacity style={styles.sendBtn} onPress={() => stopRecording(true)} activeOpacity={0.8}>
                <Ionicons name="send" size={20} color={Colors.onPrimary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
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
              {audioBusy ? (
                <View style={styles.sendBtn}>
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                </View>
              ) : showMic ? (
                <TouchableOpacity style={styles.sendBtn} onPress={startRecording} activeOpacity={0.8}>
                  <Ionicons name="mic" size={22} color={Colors.onPrimary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                  onPress={sendMessage}
                  disabled={!canSend}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send" size={20} color={Colors.onPrimary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_600SemiBold' },
  emptySubtext: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },

  headerName: { color: '#ffffff', fontSize: 18, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  headerAvatarFallback: {
    width: 34, height: 34, borderRadius: 17, marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },

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
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  timeText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  timeTextMine: { color: 'rgba(255,255,255,0.7)' },
  timeTextOther: { color: Colors.outline },

  // VOICE MESSAGES
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  audioBars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  audioBar: { width: 3, borderRadius: 2 },
  audioLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  recCancelBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },
  recTimerBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 20, paddingHorizontal: 16, height: 44,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error },
  recTimerText: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    // UX: the SafeAreaView (edges=['bottom']) already pads past the Android
    // nav/gesture zone, so the input only needs a small breathing gap on top of
    // that — a big value here double-padded it and floated it too high.
    paddingBottom: Platform.OS === 'android' ? 10 : 12,
    paddingTop: 12,
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
