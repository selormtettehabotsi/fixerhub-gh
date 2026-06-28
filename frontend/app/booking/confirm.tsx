import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { createBooking } from '../../src/api/bookings';
import { pickAndUploadImage, takeAndUploadPhoto } from '../../src/hooks/useImageUpload';

const SERVICES = ['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Cleaning', 'Welding', 'Mason', 'General Repair'];

export default function ConfirmBookingScreen() {
  const { workerId, workerName, skill } = useLocalSearchParams<{
    workerId: string;
    workerName: string;
    skill: string;
  }>();

  const [serviceType, setServiceType] = useState(skill ?? 'General Repair');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingImage, setBookingImage] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('phone').then((p) => { if (p) setPhone(p); });
  }, []);

  async function handleConfirm() {
    const min = Number(minAmount);
    const max = Number(maxAmount);
    if (!minAmount.trim() || isNaN(min) || min <= 0) {
      setError('Please enter a valid minimum amount.');
      return;
    }
    if (!maxAmount.trim() || isNaN(max) || max <= 0) {
      setError('Please enter a valid maximum amount.');
      return;
    }
    if (max < min) {
      setError('Maximum amount must be greater than minimum.');
      return;
    }
    if (!phone.trim()) {
      setError('Please provide your phone number.');
      return;
    }
    const userId = await AsyncStorage.getItem('userId');
    if (!userId || !workerId) {
      setError('Session error. Please log in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const booking = await createBooking({
        customerId: Number(userId),
        workerId: Number(workerId),
        serviceType,
        amount: min,
        minAmount: min,
        maxAmount: max,
        notes: notes.trim() || undefined,
        customerPhone: phone.trim(),
        bookingImage: bookingImage || undefined,
      });
      router.replace({
        pathname: '/booking/confirmed',
        params: { bookingId: String(booking.id), workerName: workerName ?? 'Worker' },
      });
    } catch (err: any) {
      setError(err.message ?? 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.workerSummary}>
            <View style={styles.workerAvatar}>
              <Text style={styles.workerAvatarText}>
                {workerName ? workerName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
              </Text>
            </View>
            <View>
              <Text style={styles.workerSummaryName}>{workerName ?? 'Worker'}</Text>
              <Text style={styles.workerSummarySkill}>{skill ?? 'Service'}</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {SERVICES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, serviceType === s && styles.chipActive]}
                    onPress={() => setServiceType(s)}
                  >
                    <Text style={[styles.chipText, serviceType === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Budget Range (GH₵)</Text>
              <View style={styles.rangeRow}>
                <View style={[styles.inputWrapper, styles.rangeInput]}>
                  <Ionicons name="cash-outline" size={18} color={Colors.outline} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={minAmount}
                    onChangeText={setMinAmount}
                    placeholder="Min e.g. 100"
                    placeholderTextColor={Colors.outline}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.rangeSep}>–</Text>
                <View style={[styles.inputWrapper, styles.rangeInput]}>
                  <TextInput
                    style={styles.input}
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    placeholder="Max e.g. 300"
                    placeholderTextColor={Colors.outline}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              {minAmount && maxAmount && Number(minAmount) > 0 && Number(maxAmount) >= Number(minAmount) && (
                <Text style={styles.rangeHint}>Budget: GH₵ {minAmount} – GH₵ {maxAmount}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Phone</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={18} color={Colors.outline} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+233241234567"
                  placeholderTextColor={Colors.outline}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Job Photo (optional)</Text>
              <TouchableOpacity
                style={styles.photoBtn}
                activeOpacity={0.8}
                onPress={() => Alert.alert('Add Photo', 'Choose source', [
                  { text: 'Camera', onPress: async () => {
                    setImageUploading(true);
                    try { setBookingImage(await takeAndUploadPhoto('bookings')); }
                    catch (e: any) { Alert.alert('Error', e.message); }
                    finally { setImageUploading(false); }
                  }},
                  { text: 'Library', onPress: async () => {
                    setImageUploading(true);
                    try { setBookingImage(await pickAndUploadImage('bookings')); }
                    catch (e: any) { Alert.alert('Error', e.message); }
                    finally { setImageUploading(false); }
                  }},
                  { text: 'Cancel', style: 'cancel' },
                ])}
              >
                {imageUploading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : bookingImage ? (
                  <View style={styles.photoPreviewWrapper}>
                    <Image source={{ uri: bookingImage }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.removePhoto} onPress={() => setBookingImage('')}>
                      <Ionicons name="close-circle" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={Colors.outline} />
                    <Text style={styles.photoPlaceholderText}>Tap to add a photo of the job</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={styles.textArea}
                value={notes}
                onChangeText={setNotes}
                placeholder="Describe the job, location details, urgency..."
                placeholderTextColor={Colors.outline}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.stickyBottom}>
          <TouchableOpacity onPress={handleConfirm} disabled={loading} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmBtn}
            >
              {loading ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Booking</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 8 },
  workerSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  workerAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  workerAvatarText: { color: Colors.onPrimary, fontSize: 20, fontWeight: '700' },
  workerSummaryName: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  workerSummarySkill: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  errorBox: { backgroundColor: Colors.errorContainer, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: Colors.error, fontSize: 16, fontFamily: 'Inter_400Regular' },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 17, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  chipScroll: { marginVertical: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceContainerLow, marginRight: 8 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 17, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: Colors.onPrimary, fontWeight: '700' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 17, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  textArea: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.onSurface,
    fontFamily: 'Inter_400Regular',
    minHeight: 100,
  },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeInput: { flex: 1 },
  rangeSep: { fontSize: 18, color: Colors.onSurfaceVariant, fontWeight: '600' },
  rangeHint: { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_500Medium', marginTop: 4 },
  photoBtn: { borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.surfaceContainerHighest, minHeight: 110, justifyContent: 'center' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 20, gap: 6 },
  photoPlaceholderText: { fontSize: 14, color: Colors.outline, fontFamily: 'Inter_400Regular' },
  photoPreviewWrapper: { position: 'relative' },
  photoPreview: { width: '100%', height: 180, borderRadius: 10 },
  removePhoto: { position: 'absolute', top: 6, right: 6 },
  stickyBottom: { padding: 16, backgroundColor: Colors.surface },
  confirmBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  confirmBtnText: { color: Colors.onPrimary, fontSize: 17, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});
