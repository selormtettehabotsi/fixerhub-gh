import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUnreadCounts } from '../utils/chatUnread';
import { getBookingsByCustomer, getBookingsByWorker } from '../api/bookings';
import { getWorkerByUserId } from '../api/workers';
import { conversationId as mkConversationId } from '../utils/formatId';

/**
 * UNREAD BADGES (global): keeps the total unread message count fresh so the
 * Chat tab can show a WhatsApp-style badge even while you're on other screens.
 * Polls every 20s while the app is foregrounded; screens call refresh() after
 * reading a chat so the badge clears instantly.
 */

interface UnreadContextValue {
  totalUnread: number;
  refresh: () => void;
}

const UnreadContext = createContext<UnreadContextValue>({ totalUnread: 0, refresh: () => {} });

const POLL_MS = 20000;

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [totalUnread, setTotalUnread] = useState(0);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const [role, userId, token] = await Promise.all([
        AsyncStorage.getItem('role'),
        AsyncStorage.getItem('userId'),
        import('../utils/tokenStorage').then((t) => t.getItem('token')),
      ]);
      if (!token || !userId || (role !== 'CUSTOMER' && role !== 'WORKER')) {
        setTotalUnread(0);
        return;
      }

      let convIds: string[] = [];
      if (role === 'CUSTOMER') {
        const bookings = await getBookingsByCustomer(userId);
        convIds = [...new Set(bookings.map((b) => mkConversationId(userId, b.workerId)))];
      } else {
        const profile = await getWorkerByUserId(userId);
        const bookings = await getBookingsByWorker(profile.id);
        convIds = [...new Set(bookings.map((b) => mkConversationId(b.customerId, profile.id)))];
      }

      const counts = await fetchUnreadCounts(convIds);
      setTotalUnread(Object.values(counts).reduce((a, b) => a + b, 0));
    } catch {
      // network hiccup — keep the previous badge value
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);

  return (
    <UnreadContext.Provider value={{ totalUnread, refresh }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
