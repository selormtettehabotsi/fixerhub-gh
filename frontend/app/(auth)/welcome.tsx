import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';

const { width } = Dimensions.get('window');

const slides: { id: string; iconName: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string }[] = [
  {
    id: '1',
    iconName: 'construct-outline',
    title: 'Find Trusted Workers Near You',
    subtitle: 'Plumbers, electricians, and more — verified and ready.',
  },
  {
    id: '2',
    iconName: 'calendar-outline',
    title: 'Book in Minutes',
    subtitle: 'Choose a worker, confirm your booking, and relax.',
  },
  {
    id: '3',
    iconName: 'card-outline',
    title: 'Safe & Secure Payments',
    subtitle: 'Pay securely via Paystack after the job is done.',
  },
];

export default function WelcomeScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  }

  function goNext() {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    }
  }

  const isLast = activeIndex === slides.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.iconName} size={56} color={Colors.primary} />
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.bottomArea}>
        {isLast ? (
          <TouchableOpacity onPress={() => router.replace('/(auth)/register')} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkBold}>Login</Text></Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  slideSubtitle: {
    fontSize: 16,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.outlineVariant,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginLinkText: {
    fontSize: 16,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
  },
  loginLinkBold: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
