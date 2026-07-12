import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

/**
 * UNREAD BADGES (WhatsApp-style): the device remembers when each conversation
 * was last opened; the server counts newer messages from the other party.
 */

const KEY = (convId: string) => `chat_last_read_${convId}`;

export async function markConversationRead(convId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(convId), String(Date.now()));
  } catch { /* non-critical */ }
}

async function getLastRead(convId: string): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(KEY(convId));
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

/** Returns { conversationId: unreadCount } for the given conversations. */
export async function fetchUnreadCounts(convIds: string[]): Promise<Record<string, number>> {
  if (convIds.length === 0) return {};
  try {
    const conversations = await Promise.all(
      convIds.map(async (id) => ({ conversationId: id, since: await getLastRead(id) }))
    );
    const res = await client.post<Record<string, number>>('/chat/unread-counts', { conversations });
    return res.data ?? {};
  } catch {
    return {}; // badges are a nicety — never break the list
  }
}
