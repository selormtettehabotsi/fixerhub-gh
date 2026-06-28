import React, { createContext, useContext, useRef, useCallback } from 'react';
import { Animated } from 'react-native';

interface TabBarContextValue {
  translateY: Animated.Value;
  onScroll: (event: any) => void;
}

const TabBarContext = createContext<TabBarContextValue | null>(null);

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const isHidden = useRef(false);

  const onScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastY.current;
    lastY.current = currentY;

    if (diff > 8 && !isHidden.current) {
      isHidden.current = true;
      Animated.timing(translateY, {
        toValue: 100,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else if (diff < -8 && isHidden.current) {
      isHidden.current = false;
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [translateY]);

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
