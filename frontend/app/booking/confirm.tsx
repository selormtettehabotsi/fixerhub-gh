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
import { pickAndUploadImage, takeAndUploadPhoto, pickAndUploadVideo } from '../../src/hooks/useImageUpload';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
import { useLocation } from '../../src/hooks/useLocation';

const SERVICES = ['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Cleaning', 'Welding', 'Mason', 'General Repair'];

const MAX_MEDIA = 5;

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

export default function ConfirmBookingScreen() {
  const { workerId, workerName, skill, workerPicture, prefillServiceType, prefillNotes, prefillPhone } = useLocalSearchParams<{
    workerId: string;
    workerName: string;
    skill: string;
    workerPicture?: string;
    prefillServiceType?: string;
    prefillNotes?: string;
    prefillPhone?: string;
  }>();

  // JOB LOCATION: the customer's position when booking = where the job is
  const { latitude: jobLat, longitude: jobLng } = useLocation();

  const [serviceType, setServiceType] = useState(prefillServiceType ?? skill ?? 'General Repair');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [notes, setNotes] = useState(prefillNotes ?? '');
  const [phone, setPhone] = useState('');
  const [bookingMedia, setBookingMedia] = useState<MediaItem[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [pricingStyle, setPricingStyle] = useState<'FIXED' | 'NEGOTIABLE' | 'INSPECTION'>('NEGOTIABLE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefillPhone) {
      setPhone(prefillPhone);
    } else {
      AsyncStorage.getItem('phone').then((p) => { if (p) setPhone(p); });
    }
  }, []);

  const hasVideo = bookingMedia.some((m) => m.type === 'video');

  async function addPhoto() {
    if (bookingMedia.length >= MAX_MEDIA) return;
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          setImageUploading(true);
          try {
            const url = await takeAndUploadPhoto('bookings');
            setBookingMedia((prev) => [...prev, { url, type: 'image' }]);
          } catch (e: any) {
            if (!e.message?.includes('No photo')) Alert.alert('Error', e.message);
          } finally {
            setImageUploading(false);
          }
        },
      },
      {
        text: 'Library',
        onPress: async () => {
          setImageUploading(true);
          try {
            const url = await pickAndUploadImage('bookings');
            setBookingMedia((prev) => [...prev, { url, type: 'image' }]);
          } catch (e: any) {
            if (!e.message?.includes('No image')) Alert.alert('Error', e.message);
          } finally {
            setImageUploading(false);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function addVideo() {
    if (bookingMedia.length >= MAX_MEDIA || hasVideo) return;
    setImageUploading(true);
    try {
      const url = await pickAndUploadVideo('bookings');
      setBookingMedia((prev) => [...prev, { url, type: 'video' }]);
    } catch (e: any) {
      if (!e.message?.includes('No video')) Alert.alert('Error', e.message);
    } finally {
      setImageUploading(false);
    }
  }

  function removeMedia(index: number) {
    setBookingMedia((prev) => prev.filter((_, i) => i !== index));
  }

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
      const mediaUrls = bookingMedia.map((m) => m.url);
      const booking = await createBooking({
        customerId: Number(userId),
        workerId: Number(workerId),
        workerName: workerName || undefined,
        serviceType,
        amount: min,
        minAmount: min,
        maxAmount: max,
        notes: notes.trim() || undefined,
        customerPhone: phone.trim(),
        // JOB LOCATION: lets the worker see where the job is on the map
        customerLat: jobLat ?? undefined,
        customerLng: jobLng ?? undefined,
        bookingImages: mediaUrls,
        bookingImage: mediaUrls[0] ?? undefined,
        pricingStyle,
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
            {workerPicture ? (
              <Image source={{ uri: cloudinaryThumb(workerPicture, 64) }} style={styles.workerAvatarImg} />
            ) : (
              <View style={styles.workerAvatar}>
                <Text style={styles.workerAvatarText}>
                  {workerName ? workerName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
                </Text>
              </View>
            )}
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
              <Text style={styles.label}>Pricing Arrangement</Text>
              {([
                { key: 'FIXED',       label: 'Fixed Rate',             desc: 'Price is set upfront' },
                { key: 'NEGOTIABLE',  label: 'Negotiable',             desc: "Open to discussion" },
                { key: 'INSPECTION',  label: 'Needs Inspection First', desc: 'Worker will quote after seeing the job' },
              ] as { key: 'FIXED' | 'NEGOTIABLE' | 'INSPECTION'; label: string; desc: string }[]).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.pricingRow, pricingStyle === opt.key && styles.pricingRowActive]}
                  onPress={() => setPricingStyle(opt.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioCircle, pricingStyle === opt.key && styles.radioCircleActive]}>
                    {pricingStyle === opt.key && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pricingLabel, pricingStyle === opt.key && styles.pricingLabelActive]}>{opt.label}</Text>
                    <Text style={styles.pricingDesc}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
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
              <Text style={styles.label}>Job Photos / Video (optional)</Text>
              <Text style={styles.mediaHint}>Add up to {MAX_MEDIA} photos, or a short video.</Text>

              <View style={styles.mediaGrid}>
                {bookingMedia.map((item, index) => (
                  <View key={`${item.url}-${index}`} style={styles.mediaThumbWrapper}>
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.url }} style={styles.mediaThumb} />
                    ) : (
                      <View style={[styles.mediaThumb, styles.videoThumb]}>
                        <Ionicons name="play-circle" size={28} color="#fff" />
                        <Text style={styles.videoThumbLabel}>Video</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeMedia(index)}>
                      <Ionicons name="close-circle" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                {imageUploading && (
                  <View style={[styles.mediaThumb, styles.mediaUploading]}>
                    <ActivityIndicator color={Colors.primary} />
                  </View>
                )}
              </View>

              <View style={styles.mediaActions}>
                {bookingMedia.length < MAX_MEDIA && (
                  <TouchableOpacity style={styles.mediaAddBtn} onPress={addPhoto} disabled={imageUploading} activeOpacity={0.8}>
                    <Ionicons name="image-outline" size={18} color={Colors.primary} />
                    <Text style={styles.mediaAddBtnText}>Add Photo</Text>
                  </TouchableOpacity>
                )}
                {!hasVideo && bookingMedia.length < MAX_MEDIA && (
                  <TouchableOpacity style={styles.mediaAddBtn} onPress={addVideo} disabled={imageUploading} activeOpacity={0.8}>
                    <Ionicons name="videocam-outline" size={18} color={Colors.primary} />
                    <Text style={styles.mediaAddBtnText}>Add Video</Text>
                  </TouchableOpacity>
                )}
              </View>
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
  workerAvatarImg: { width: 56, height: 56, borderRadius: 28 },
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
  pricingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: Colors.surfaceContainerHigh, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  pricingRowActive: { borderColor: Colors.primary, backgroundColor: 'rgba(98,0,238,0.04)' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.outline, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  pricingLabel: { fontSize: 15, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  pricingLabelActive: { color: Colors.primary },
  pricingDesc: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  mediaHint: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  mediaThumbWrapper: { position: 'relative' },
  mediaThumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: Colors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  videoThumb: { backgroundColor: '#000', gap: 2 },
  videoThumbLabel: { color: '#fff', fontSize: 11, fontFamily: 'Inter_500Medium' },
  mediaUploading: { borderWidth: 1, borderColor: Colors.surfaceContainerHigh },
  removeMediaBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.surface, borderRadius: 11 },
  mediaActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  mediaAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  mediaAddBtnText: { fontSize: 14, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  stickyBottom: { padding: 16, backgroundColor: Colors.surface },
  confirmBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  confirmBtnText: { color: Colors.onPrimary, fontSize: 17, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});