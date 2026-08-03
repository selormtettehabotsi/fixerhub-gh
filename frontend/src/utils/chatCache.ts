import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * OFFLINE CHAT: the last messages of each conversation, kept on the device.
 *
 * Without this, a conversation only exists in React state — open the chat with
 * no signal (or after the app was killed) and you get an empty screen, because
 * the history request is the only source of messages. Every messaging app the
 * user has ever used shows the previous messages instantly and syncs behind
 * that, so an empty chat reads as "my messages are gone".
 *
 * AsyncStorage rather than SQLite deliberately: a few hundred rows per
 * conversation is well within what a JSON blob handles, and it avoids adding a
 * native dependency to an app that already ships.
 */

const PREFIX = 'chatCache:';
/** Plenty for scrollback; bounded so a long-running chat can't grow forever. */
const MAX_CACHED = 200;

function key(roomId: string): string {
  return `${PREFIX}${roomId}`;
}

/** Cached messages for a room — [] when nothing is stored or it's unreadable. */
export async function loadCachedMessages<T>(roomId: string): Promise<T[]> {
  if (!roomId) return [];
  try {
    const raw = await AsyncStorage.getItem(key(roomId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Corrupt entry: behave as if there's no cache rather than breaking the screen.
    return [];
  }
}

/** Replace the cache for a room, keeping only the newest MAX_CACHED messages. */
export async function saveCachedMessages<T>(roomId: string, messages: T[]): Promise<void> {
  if (!roomId) return;
  try {
    const trimmed = messages.length > MAX_CACHED ? messages.slice(-MAX_CACHED) : messages;
    await AsyncStorage.setItem(key(roomId), JSON.stringify(trimmed));
  } catch {
    // A failed cache write must never interrupt the conversation.
  }
}

/** Clear every cached conversation — used on sign-out so the next user on this
 *  device can't read the previous one's messages. */
export async function clearAllChatCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    // best effort
  }
}
