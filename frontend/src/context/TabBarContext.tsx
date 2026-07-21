import React, { createContext, useContext, useRef, useCallback } from 'react';
import { Animated } from 'react-native';

interface TabBarContextValue {
  translateY: Animated.Value;
  onScroll: (event: any) => void;
}

const TabBarContext = createContext<TabBarContextValue | null>(null);

// UX: standard hide-on-scroll tuning (what most apps ship):
//  - never hide near the top of the page
//  - hide only after a deliberate downward scroll (~64px accumulated)
//  - reappear quickly on a modest upward scroll (~24px)
//  - ignore rubber-band/overscroll bounce entirely
const TOP_ALWAYS_VISIBLE = 80;   // px from top where the bar never hides
const HIDE_THRESHOLD = 64;       // accumulated downward px before hiding
const SHOW_THRESHOLD = 24;       // accumulated upward px before showing

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const accumulated = useRef(0);   // +down / -up since last direction change
  const isHidden = useRef(false);

  const setHidden = useCallback((hidden: boolean) => {
    if (isHidden.current === hidden) return;
    isHidden.current = hidden;
    Animated.timing(translateY, {
      toValue: hidden ? 170 : 0,  // bar height + inset-aware bottom gap + shadow
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const onScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;

    // Ignore iOS rubber-band bounce (negative offsets) and jitter at the top
    if (currentY <= 0) {
      accumulated.current = 0;
      lastY.current = 0;
      setHidden(false);
      return;
    }

    const diff = currentY - lastY.current;
    lastY.current = currentY;

    // Near the top the bar is always visible
    if (currentY < TOP_ALWAYS_VISIBLE) {
      accumulated.current = 0;
      setHidden(false);
      return;
    }

    // Reset the accumulator whenever the scroll direction flips
    if ((diff > 0 && accumulated.current < 0) || (diff < 0 && accumulated.current > 0)) {
      accumulated.current = 0;
    }
    accumulated.current += diff;

    if (accumulated.current > HIDE_THRESHOLD) {
      setHidden(true);
    } else if (accumulated.current < -SHOW_THRESHOLD) {
      setHidden(false);
    }
  }, [setHidden]);

  return (
    <TabBarContext.Provider value={{ translateY, onScroll }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  const ctx = useContext(TabBarContext);
  if (!ctx) throw new Error('useTabBar must be used within TabBarProvider');
  return ctx;
}
