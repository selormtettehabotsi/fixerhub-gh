import React, { useRef, useState } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';

const { width, height: screenHeight } = Dimensions.get('window');

// Hero artwork is transparent PNG, so it can run big and unframed. Bounded by
// screen HEIGHT as well as width so the title/subtitle never get pushed off
// short devices.
const HERO_W = width * 0.84;
const HERO_H = Math.min(width * 1.0, screenHeight * 0.42);

/** A slide shows EITHER a full illustration (`image`) or a framed icon. */
type Slide = {
  id: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  image?: ImageSourcePropType;
  title: string;
  subtitle: string;
};

const slides: Slide[] = [
  {
    id: '1',
    iconName: 'construct-outline',
    // Hero illustration — the first thing a new user sees.
    image: require('../../assets/onboarding-worker.png'),
    title: 'Find Trusted Workers Near You',
    subtitle: 'Plumbers, electricians, and more — verified and ready.',
  },
  {
    id: '2',
    iconName: 'calendar-outline',
    image: require('../../assets/onboarding-booking.png'),
    title: 'Book in Minutes',
    subtitle: 'Choose a worker, confirm your booking, and relax.',
  },
  {
    id: '3',
    iconName: 'card-outline',
    image: require('../../assets/onboarding-payment.png'),
    title: 'Safe & Secure Payments',
    subtitle: 'Pay securely via Paystack after the job is done.',
  },
];

export default function WelcomeScreen() {
  const styles = useThemedStyles(makeStyles);
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
            {item.image ? (
              // Illustrated slide: the artwork carries the message, so it runs
              // full-bleed instead of sitting inside the small icon circle.
              <Image source={item.image} style={styles.heroImage} resizeMode="contain" />
            ) : (
              <View style={styles.iconCircle}>
                <Ionicons name={item.iconName} size={56} color={Colors.primary} />
              </View>
            )}
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
        {/* "Get Started" goes to the role question, not straight to the form:
            role decides which whole app the person gets, so it shouldn't be a
            toggle they can skim past on the register screen. */}
        {isLast ? (
          <TouchableOpacity onPress={() => router.replace('/(auth)/role')} activeOpacity={0.85}>
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

const makeStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // 28 (not 40) so the enlarged hero at 84% of the screen width still fits
    // inside the padded slide instead of bleeding onto the neighbouring page.
    paddingHorizontal: 28,
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
  // HERO ILLUSTRATION. The PNGs have transparent backgrounds, so no framing
  // circle is needed — the artwork sits directly on the surface and reads
  // correctly in BOTH light and dark themes.
  heroImage: {
    width: HERO_W,
    height: HERO_H,
    marginBottom: 28,
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
