import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getBookingsByWorker, updateBookingStatus, submitQuote, Booking } from '../../src/api/bookings';
import { cloudinaryThumb } from '../../src/utils/imageUrl';

const HIDDEN_KEY = 'hiddenBookingIds';
import { formatUserId, formatBookingId } from '../../src/utils/formatId';
import { getWorkerByUserId, setAvailabilityByUserId, updateWorkerLocation } from '../../src/api/workers';
import { useTabBar } from '../../src/context/TabBarContext';
import { useLocationBroadcast } from '../../src/hooks/useLocationBroadcast';
import { useLocation } from '../../src/hooks/useLocation';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.secondary,
  WORKER_ON_THE_WAY: Colors.tertiary,
  IN_PROGRESS: Colors.primary,
  COMPLETED: Colors.available,
  CANCELLED: Colors.unavailable,
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  WORKER_ON_THE_WAY: 'On the Way',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function getNextActions(status: string): { label: string; icon: string; nextStatus: string; color: string }[] {
  switch (status) {
    case 'PENDING':
      return [
        { label: 'Accept Job', icon: 'checkmark-circle-outline', nextStatus: 'ACCEPTED', color: Colors.secondary },
        { label: 'Decline', icon: 'close-circle-outline', nextStatus: 'CANCELLED', color: Colors.error },
      ];
    case 'ACCEPTED':
      return [{ label: "On My Way", icon: 'navigate-outline', nextStatus: 'WORKER_ON_THE_WAY', color: Colors.tertiary }];
    case 'WORKER_ON_THE_WAY':
      return [{ label: 'Start Job', icon: 'play-circle-outline', nextStatus: 'IN_PROGRESS', color: Colors.primary }];
    case 'IN_PROGRESS':
      return [{ label: 'Mark Complete', icon: 'checkmark-done-circle-outline', nextStatus: 'COMPLETED', color: Colors.available }];
    default:
      return [];
  }
}

export default function WorkerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [available, setAvailableState] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [workerId, setWorkerId] = useState<string | null>(null);
  const { onScroll } = useTabBar();

  // LIVE TRACKING: while any booking is "On the Way", stream this worker's GPS
  // to that booking's customer. Stops automatically on status change/unmount.
  const enRouteBookingId = bookings.find((b) => b.status === 'WORKER_ON_THE_WAY')?.id ?? null;
  useLocationBroadcast(enRouteBookingId);

  // LIVE DISTANCE: sync this worker's server-side coordinates with their real
  // GPS (on open, then every ~50 m moved) so customers' "km away" labels track
  // where the worker actually is — not the address geocoded once at signup.
  // Never pushes the Accra fallback, which would corrupt real coordinates.
  const { latitude: gpsLat, longitude: gpsLng, isFallback } = useLocation();
  useEffect(() => {
    if (!workerId || isFallback || gpsLat == null || gpsLng == null) return;
    updateWorkerLocation(workerId, gpsLat, gpsLng).catch(() => {});
  }, [workerId, gpsLat, gpsLng, isFallback]);

  const [quoteBooking, setQuoteBooking] = useState<Booking | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [id, n, pic] = await Promise.all([
      AsyncStorage.getItem('userId'),
      AsyncStorage.getItem('name'),
      AsyncStorage.getItem('profilePicture'),
    ]);
    if (n) setName(n);
    if (pic) setProfilePicture(pic);
    if (!id) return;
    setWorkerId(id);
    setLoading(true);
    setError(null);
    try {
      const profile = await getWorkerByUserId(id);
      setAvailableState(profile.available);
      const [bookingData, hiddenRaw] = await Promise.all([
        getBookingsByWorker(profile.id),
        AsyncStorage.getItem(HIDDEN_KEY),
      ]);
      const hidden: number[] = hiddenRaw ? JSON.parse(hiddenRaw) : [];
      setBookings(bookingData.filter((b) => !hidden.includes(b.id)));
    } catch (err: any) {
      setError(err.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function toggleAvailability(val: boolean) {
    if (!workerId) return;
    setAvailableState(val);
    setToggling(true);
    try {
      await setAvailabilityByUserId(workerId, val);
    } catch {
      setAvailableState(!val);
    } finally {
      setToggling(false);
    }
  }

  async function changeStatus(bookingId: number, nextStatus: string) {
    const doUpdate = async () => {
      try {
        await updateBookingStatus(bookingId, nextStatus);
        setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: nextStatus } : b));
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
    };
    if (nextStatus === 'COMPLETED') {
      Alert.alert('Mark Complete?', 'This will trigger payment processing.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: doUpdate },
      ]);
    } else if (nextStatus === 'CANCELLED') {
      // Declining a job offer — destructive, so confirm first
      Alert.alert('Decline this job?', 'The booking will be cancelled and the customer can hire someone else.', [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: doUpdate },
      ]);
    } else {
      doUpdate();
    }
  }

  async function handleSubmitQuote() {
    if (!quoteBooking) return;
    const amount = Number(quoteAmount);
    if (!quoteAmount.trim() || isNaN(amount) || amount <= 0) {
      setQuoteError('Enter a valid amount.');
      return;
    }
    setQuoteSubmitting(true);
    setQuoteError(null);
    try {
      const updated = await submitQuote(quoteBooking.id, amount);
      setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b));
      setQuoteBooking(null);
      setQuoteAmount('');
    } catch (err: any) {
      setQuoteError(err.message ?? 'Failed to send quote.');
    } finally {
      setQuoteSubmitting(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const active = bookings.filter((b) => b.status !== 'COMPLETED' && b.status !== 'CANCELLED');
  const completed = bookings.filter((b) => b.status === 'COMPLETED');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {profilePicture ? (
            <Image source={{ uri: cloudinaryThumb(profilePicture, 48) }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarText}>
                {(name || 'W').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.name}>{name || 'Worker'}</Text>
          </View>
        </View>
        <View style={styles.availToggle}>
          <Text style={styles.availLabel}>{available ? 'Available' : 'Unavailable'}</Text>
          {toggling ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Switch
              value={available}
              onValueChange={toggleAvailability}
              trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.available }}
              thumbColor={Colors.onPrimary}
            />
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{active.length}</Text>
          <Text style={styles.statLabel}>Active Jobs</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{completed.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{bookings.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={bookings}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          loading && bookings.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.sectionTitle}>Your Jobs</Text>
          )
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="clipboard-outline" size={52} color={Colors.outline} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No jobs yet</Text>
              <Text style={styles.emptySubtext}>Bookings assigned to you will appear here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const nextActions = getNextActions(item.status);
          return (
            <View style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceType}>{item.serviceType}</Text>
                  <Text style={styles.bookingIdLabel}>Booking {formatBookingId(item.id)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] ?? Colors.outline }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[item.status] ?? item.status}</Text>
                </View>
              </View>
              <Text style={styles.jobDetail}>Customer {formatUserId(item.customerId)}</Text>
              <View style={styles.jobDetailRow}>
                <Ionicons name="call-outline" size={14} color={Colors.onSurfaceVariant} />
                <Text style={styles.jobDetail}> {item.customerPhone || 'No phone provided'}</Text>
              </View>
              <View style={styles.jobDetailRow}>
                <Ionicons name="cash-outline" size={14} color={Colors.onSurfaceVariant} />
                <Text style={styles.jobDetail}> GH₵ {item.amount}</Text>
              </View>
              {item.notes && <Text style={styles.jobNotes}>{item.notes}</Text>}

              {item.bookingImage ? (
                <Pressable onPress={() => setPhotoUrl(item.bookingImage!)} style={styles.bookingPhotoWrap}>
                  <Image source={{ uri: cloudinaryThumb(item.bookingImage, 300) }} style={styles.bookingThumb} resizeMode="cover" />
                  <View style={styles.photoHint}>
                    <Ionicons name="image-outline" size={13} color={Colors.primary} />
                    <Text style={styles.photoHintText}>Customer photo — tap to enlarge</Text>
                  </View>
                </Pressable>
              ) : null}

              {item.quotedAmount != null && (
                <View style={styles.quoteTag}>
                  <Ionicons name="pricetag-outline" size={13} color={Colors.warning} />
                  <Text style={styles.quoteTagText}>
                    {item.quoteStatus === 'PENDING' ? `Quoted: GH₵ ${item.quotedAmount} (awaiting response)` :
                     item.quoteStatus === 'ACCEPTED' ? `Quote accepted: GH₵ ${item.quotedAmount}` :
                     `Quote declined: GH₵ ${item.quotedAmount}`}
                  </Text>
                </View>
              )}

              {/* Send Quote — small chip, only when applicable */}
              {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && item.quotedAmount == null && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => { setQuoteBooking(item); setQuoteAmount(''); setQuoteError(null); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="pricetag-outline" size={14} color={Colors.warning} />
                    <Text style={[styles.viewBtnText, { color: Colors.warning }]}>Send Quote</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Status action buttons (Accept Job / On My Way / Start Job / Mark Complete) */}
              {nextActions.map((action) => (
                <TouchableOpacity
                  key={action.nextStatus}
                  style={[styles.actionBtn, { backgroundColor: action.color }]}
                  onPress={() => changeStatus(item.id, action.nextStatus)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={action.icon as any} size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>{action.label}</Text>
                </TouchableOpacity>
              ))}

              {/* View Details — full-width primary CTA */}
              <TouchableOpacity
                style={styles.viewDetailsBtn}
                onPress={() => router.push(`/booking/${item.id}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="eye-outline" size={17} color="#fff" />
                <Text style={styles.viewDetailsBtnText}>View Details</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal visible={!!photoUrl} transparent animationType="fade" onRequestClose={() => setPhotoUrl(null)}>
        <Pressable style={styles.photoModal} onPress={() => setPhotoUrl(null)}>
          {photoUrl && <Image source={{ uri: photoUrl }} style={styles.photoFull} resizeMode="contain" />}
          <Pressable style={styles.photoCloseBtn} onPress={() => setPhotoUrl(null)}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!quoteBooking} animationType="slide" transparent onRequestClose={() => setQuoteBooking(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send a Quote</Text>
              <TouchableOpacity onPress={() => setQuoteBooking(null)}>
                <Ionicons name="close" size={24} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
            {quoteBooking && (
              <Text style={styles.modalSub}>For: {quoteBooking.serviceType} (Booking {formatBookingId(quoteBooking.id)})</Text>
            )}
            {quoteError && (
              <View style={styles.quoteErrorBox}>
                <Text style={styles.quoteErrorText}>{quoteError}</Text>
              </View>
            )}
            <Text style={styles.inputLabel}>Your Price (GH₵)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="cash-outline" size={16} color={Colors.outline} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={quoteAmount}
                onChangeText={setQuoteAmount}
                placeholder="e.g. 250"
                placeholderTextColor={Colors.outline}
                keyboardType="numeric"
                autoFocus
              />
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitQuote} disabled={quoteSubmitting} activeOpacity={0.85}>
              {quoteSubmitting ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.submitBtnText}>Send Quote</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22 },
  headerAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 16 },
  greeting: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  name: { fontSize: 22, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  availToggle: { alignItems: 'center', gap: 4 },
  availLabel: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, gap: 10 },
  statBox: { flex: 1, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 10, padding: 14, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '700', color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
  statLabel: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 12 },
  loader: { marginVertical: 40 },
  errorBox: { marginHorizontal: 20, backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 14, marginBottom: 12 },
  errorText: { color: Colors.error, fontSize: 16 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { marginBottom: 14 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  emptySubtext: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  bookingPhotoWrap: { marginTop: 10 },
  bookingThumb: { width: '100%', height: 160, borderRadius: 10 },
  photoHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  photoHintText: { fontSize: 12, color: Colors.primary, fontFamily: 'Inter_400Regular' },
  photoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  photoFull: { width: '100%', height: '80%' },
  photoCloseBtn: { position: 'absolute', top: 52, right: 20 },
  jobCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, padding: 16, marginBottom: 12 },
  jobHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  serviceType: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  bookingIdLabel: { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  jobDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  jobDetail: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  jobNotes: { fontSize: 14, color: Colors.onSurface, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginTop: 6 },
  quoteTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: Colors.surfaceContainerLow, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  quoteTagText: { fontSize: 13, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceContainerHigh, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  viewBtnText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  actionBtn: { marginTop: 6, borderRadius: 8, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  viewDetailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, paddingVertical: 13, borderRadius: 10, backgroundColor: Colors.primary },
  viewDetailsBtnText: { fontSize: 15, color: '#fff', fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  modalSub: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  quoteErrorBox: { backgroundColor: Colors.errorContainer, borderRadius: 8, padding: 10, marginBottom: 10 },
  quoteErrorText: { color: Colors.error, fontSize: 14 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerHighest, borderRadius: 10, paddingHorizontal: 12, height: 48, marginBottom: 20 },
  input: { flex: 1, fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: Colors.onPrimary, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});
