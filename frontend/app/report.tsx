import React, { useState } from 'react';
import { useThemedStyles } from '../src/context/ThemeContext';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { submitReport } from '../src/api/reports';

interface Category {
  value: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const CATEGORIES: Category[] = [
  { value: 'PAYMENT_PROBLEM', label: 'Payment Problem', icon: 'card-outline' },
  { value: 'IN_APP_ISSUE', label: 'In-App Issue', icon: 'phone-portrait-outline' },
  { value: 'WORKER_PROBLEM', label: 'Worker Problem', icon: 'construct-outline' },
  { value: 'CUSTOMER_PROBLEM', label: 'Customer Problem', icon: 'person-outline' },
  { value: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

const MIN_DESCRIPTION = 20;

export default function ReportScreen() {
  const styles = useThemedStyles(makeStyles);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!category) {
      setError('Please select a category.');
      return;
    }
    if (description.trim().length < MIN_DESCRIPTION) {
      setError(`Please describe the issue in at least ${MIN_DESCRIPTION} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      await submitReport({ category, description: description.trim() });
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Report an Issue</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.intro}>
            Tell us what went wrong. Our team reviews every report and will follow up if needed.
          </Text>

          <Text style={styles.label}>What's the issue about?</Text>
          <View style={styles.card}>
            {CATEGORIES.map((cat, i) => {
              const selected = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.catRow, i > 0 && styles.catRowBorder]}
                  onPress={() => setCategory(cat.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={cat.icon} size={20} color={selected ? Colors.primary : Colors.outline} />
                  <Text style={[styles.catLabel, selected && styles.catLabelActive]}>{cat.label}</Text>
                  <View style={[styles.radio, selected && styles.radioActive]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Describe the issue</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Please give as much detail as you can…"
            placeholderTextColor={Colors.outline}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{description.trim().length}/{MIN_DESCRIPTION} characters minimum</Text>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.available} />
              <Text style={styles.successText}>Report submitted. Thank you!</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || success) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || success}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  intro: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 20,
    paddingTop: 16,
    lineHeight: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  catRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  catRowBorder: { borderTopWidth: 1, borderTopColor: Colors.surfaceContainerHigh },
  catLabel: { flex: 1, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },
  catLabelActive: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  textArea: {
    marginHorizontal: 20,
    minHeight: 120,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.onSurface,
    fontFamily: 'Inter_400Regular',
    backgroundColor: Colors.surfaceContainerLowest,
  },
  counter: {
    fontSize: 12,
    color: Colors.outline,
    fontFamily: 'Inter_400Regular',
    marginHorizontal: 20,
    marginTop: 6,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.errorContainer,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error, fontFamily: 'Inter_400Regular' },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: 'rgba(46,125,50,0.1)',
    borderRadius: 10,
    padding: 12,
  },
  successText: { flex: 1, fontSize: 13, color: Colors.available, fontFamily: 'Inter_600SemiBold' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: Colors.surfaceContainerHigh },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});
