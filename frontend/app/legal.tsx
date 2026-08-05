import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { useThemedStyles } from '../src/context/ThemeContext';
import { TERMS, PRIVACY, LEGAL_LAST_UPDATED } from '../src/constants/legal';

/**
 * TERMS & PRIVACY.
 *
 * One screen with two documents rather than two screens, because they're always
 * referenced together and people switch between them while reading.
 *
 * `?doc=privacy` opens straight to the policy, so the sign-up line and the
 * profile rows can each link to the right one.
 *
 * The text is bundled (src/constants/legal.ts), not fetched: someone checking
 * what they agreed to shouldn't need a connection.
 */

type Doc = 'terms' | 'privacy';

/**
 * Renders the light markup used in legal.ts. Deliberately not a markdown
 * library — three rules is not worth a dependency, and this keeps the styling
 * inside the app's theme rather than a package's defaults.
 */
function LegalBody({ text }: { text: string }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <>
      {text.split('\n').map((line, i) => {
        const t = line.trim();

        if (t === '') return <View key={i} style={styles.gap} />;

        if (t.startsWith('## ')) {
          return <Text key={i} style={styles.h2}>{t.slice(3)}</Text>;
        }

        if (t.startsWith('- ')) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{stripBold(t.slice(2))}</Text>
            </View>
          );
        }

        // **Bold lead-in** on its own line acts as a sub-heading.
        if (t.startsWith('**') && t.endsWith('**')) {
          return <Text key={i} style={styles.h3}>{t.slice(2, -2)}</Text>;
        }

        return <Text key={i} style={styles.para}>{stripBold(t)}</Text>;
      })}
    </>
  );
}

/** Inline ** markers would otherwise show up literally. */
function stripBold(s: string): string {
  return s.replace(/\*\*/g, '');
}

export default function LegalScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ doc?: string }>();
  const [doc, setDoc] = useState<Doc>(params.doc === 'privacy' ? 'privacy' : 'terms');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, doc === 'terms' && styles.tabActive]}
          onPress={() => setDoc('terms')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, doc === 'terms' && styles.tabTextActive]}>Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, doc === 'privacy' && styles.tabActive]}
          onPress={() => setDoc('privacy')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, doc === 'privacy' && styles.tabTextActive]}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        // Switching documents should start at the top of the new one.
        key={doc}
      >
        <Text style={styles.docTitle}>
          {doc === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
        </Text>
        <LegalBody text={doc === 'terms' ? TERMS : PRIVACY} />

        <View style={styles.footerBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.onSurfaceVariant} />
          <Text style={styles.footerText}>
            Last updated {LEGAL_LAST_UPDATED}. Questions? support@fixerhub.me
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingBottom: 12,
    paddingTop: 6,
  },
  backBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'PlusJakartaSans_700Bold',
    marginLeft: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
  },
  tabActive: { backgroundColor: Colors.primaryContainer },
  tabText: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_600SemiBold' },
  tabTextActive: { color: Colors.primary },

  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  docTitle: {
    fontSize: 22,
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 12,
  },
  h2: {
    fontSize: 16,
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginTop: 20,
    marginBottom: 6,
  },
  h3: {
    fontSize: 14,
    color: Colors.onSurface,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 12,
    marginBottom: 4,
  },
  para: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
  },
  bulletRow: { flexDirection: 'row', gap: 8, paddingRight: 4, marginBottom: 3 },
  bulletDot: { fontSize: 14, lineHeight: 21, color: Colors.primary },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
  },
  gap: { height: 8 },

  footerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 28,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerLow,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
  },
});
