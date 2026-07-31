import React, { useState } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';

/**
 * ROLE CHOICE — sits between the onboarding carousel and registration.
 *
 * The choice used to be a small segmented toggle at the top of the register
 * form, easy to skim past, which meant people signed up as CUSTOMER by
 * accident and then couldn't find any way to offer their services. Role
 * decides which entire app you get (and, for workers, that ID verification is
 * required), so it deserves to be asked plainly, one question per screen.
 */

type Role = 'CUSTOMER' | 'WORKER';

const OPTIONS: {
  role: Role;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  tagline: string;
  points: string[];
}[] = [
  {
    role: 'CUSTOMER',
    icon: 'home-outline',
    title: 'I need something fixed',
    tagline: 'Hire a plumber, electrician, carpenter and more',
    points: [
      'Find verified workers near you',
      'Chat and track them on the way',
      'Pay securely after the job',
    ],
  },
  {
    role: 'WORKER',
    icon: 'construct-outline',
    title: 'I want to get hired',
    tagline: 'Offer your skills and get paid for jobs',
    points: [
      'Receive job requests near you',
      'Set your own price range',
      'Requires ID verification before customers can see you',
    ],
  },
];

export default function RoleScreen() {
  const styles = useThemedStyles(makeStyles);
  const [selected, setSelected] = useState<Role | null>(null);

  function proceed() {
    if (!selected) return;
    // `push`, not `replace`: the register screen offers a "Change" action that
    // comes back here, and going back should return to this question rather
    // than skipping to the carousel.
    router.push({ pathname: '/(auth)/register', params: { role: selected } });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.replace('/(auth)/welcome')}
          style={styles.backBtn}
          hitSlop={10}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>

        <Text style={styles.question}>How will you use FixerHub?</Text>
        <Text style={styles.helper}>
          Pick the one that fits you. This sets up your account — you can't switch later without
          creating a new one.
        </Text>

        {OPTIONS.map((opt) => {
          const active = selected === opt.role;
          return (
            <TouchableOpacity
              key={opt.role}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => setSelected(opt.role)}
              activeOpacity={0.9}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.cardTop}>
                <View style={[styles.cardIcon, active && styles.cardIconActive]}>
                  <Ionicons
                    name={opt.icon}
                    size={24}
                    color={active ? Colors.onPrimary : Colors.primary}
                  />
                </View>
                <View style={styles.cardHeadings}>
                  <Text style={styles.cardTitle}>{opt.title}</Text>
                  <Text style={styles.cardTagline}>{opt.tagline}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <Ionicons name="checkmark" size={14} color={Colors.onPrimary} />}
                </View>
              </View>

              <View style={styles.points}>
                {opt.points.map((p) => (
                  <View key={p} style={styles.pointRow}>
                    <Ionicons name="ellipse" size={5} color={Colors.outline} />
                    <Text style={styles.pointText}>{p}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={proceed} disabled={!selected} activeOpacity={0.85}>
          {selected ? (
            <LinearGradient
              colors={[Colors.primary, Colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </LinearGradient>
          ) : (
            // Disabled state is a flat block rather than a dimmed gradient, so
            // it reads as "not yet" instead of looking broken.
            <View style={[styles.cta, styles.ctaDisabled]}>
              <Text style={[styles.ctaText, styles.ctaTextDisabled]}>Continue</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },

  backBtn: { width: 40, height: 40, justifyContent: 'center', marginLeft: -8, marginBottom: 8 },

  question: {
    fontSize: 26,
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    lineHeight: 34,
    marginBottom: 8,
  },
  helper: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
    marginBottom: 24,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 16,
    marginBottom: 14,
  },
  cardActive: { borderColor: Colors.primary, borderWidth: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconActive: { backgroundColor: Colors.primary },
  cardHeadings: { flex: 1 },
  cardTitle: { fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  cardTagline: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  points: { marginTop: 14, gap: 8 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointText: { flex: 1, fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 19 },

  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  cta: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  ctaDisabled: { backgroundColor: Colors.surfaceContainerHigh },
  ctaText: { color: Colors.onPrimary, fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  ctaTextDisabled: { color: Colors.outline },

  loginLink: { alignItems: 'center', paddingVertical: 12 },
  loginLinkText: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  loginLinkBold: { color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
});
