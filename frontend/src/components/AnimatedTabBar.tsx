import React from 'react';
import { useThemedStyles } from '../context/ThemeContext';
import { Animated, TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTabBar } from '../context/TabBarContext';
import { useUnread } from '../context/UnreadContext';
import { Colors } from '../constants/colors';

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const styles = useThemedStyles(makeStyles);
  const { translateY } = useTabBar();
  const { totalUnread } = useUnread();
  // Distance the floating pill sits above the system nav/gesture zone.
  // react-navigation already pads the tab-bar slot by the safe-area inset, so
  // this is a small fixed gap on top of that. Tweak to move down/up.
  const BOTTOM_GAP = 15;

  return (
    <Animated.View style={[styles.container, { bottom: BOTTOM_GAP, transform: [{ translateY }] }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label = options.title ?? route.name;
        const color = isFocused ? Colors.primary : Colors.outline;

        const iconName = (options as any).tabBarIconName as React.ComponentProps<typeof Ionicons>['name'];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        // UNREAD BADGES: WhatsApp-style count on the Chat tab
        const isChatTab = route.name.toLowerCase().includes('chat');
        const showBadge = isChatTab && totalUnread > 0;

        return (
          <TouchableOpacity key={route.key} style={styles.tab} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.iconWrap}>
              {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

const makeStyles = () => StyleSheet.create({
  // UX: FLOATING tab bar — lifted well clear of the Android gesture/back/home
  // zone so users stop accidentally leaving the app when aiming for a tab.
  container: {
    position: 'absolute',
    // bottom is set dynamically from the safe-area inset (see component)
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 34,
    height: 65,
    paddingBottom: 6,
    paddingTop: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    elevation: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  iconWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainerLowest,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
