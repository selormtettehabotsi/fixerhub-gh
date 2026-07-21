import React, { useCallback, useEffect, useState } from 'react';
import { useThemedStyles } from '../context/ThemeContext';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { getNotificationUnreadCount } from '../api/notifications';

/**
 * NOTIFICATION CENTER: bell icon with an unread badge. Polls the count on
 * focus + every 30s, and opens the /notifications history screen.
 */
export default function NotificationBell({ color }: { color?: string }) {
  const styles = useThemedStyles(makeStyles);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    getNotificationUnreadCount().then(setUnread).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <TouchableOpacity
      onPress={() => { setUnread(0); router.push('/notifications'); }}
      style={styles.wrap}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications-outline" size={24} color={color ?? Colors.onSurface} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = () => StyleSheet.create({
  wrap: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
