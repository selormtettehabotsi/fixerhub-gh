import React from 'react';
import { Animated, TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTabBar } from '../context/TabBarContext';
import { Colors } from '../constants/colors';

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { translateY } = useTabBar();

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
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

        return (
          <TouchableOpacity key={route.key} style={styles.tab} onPress={onPress} activeOpacity={0.7}>
            {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 88,
    paddingBottom: 28,
    paddingTop: 10,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
