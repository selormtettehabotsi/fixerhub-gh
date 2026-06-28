import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getBookingsByCustomer, updateBooking, Booking } from '../../src/api/bookings';
import { useTabBar } from '../../src/context/TabBarContext';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.secondary,
  COMPLETED: Colors.available,
  CANCELLED: Colors.unavailable,
  IN_PROGRESS: Colors.primary,
};

const SERVICES = ['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Cleaning', 'Welding', 'Mason', 'General Repair'];

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePicture, setProfilePicture] = useState('');
  const [userName, setUserName] = useState('');

  const { onScroll } = useTabBar();
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [editServiceType, setEditServiceType] = useState('');
  const [editMinAmount, setEditMinAmount] = useState('');
  const [editMaxAmount, setEditMaxAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    const [userId, pic, n] = await Promise.all([
      AsyncStorage.getItem('userId'),
      AsyncStorage.getItem('profilePicture'),
      AsyncStorage.getItem('name'),
    ]);
    if (pic) setProfilePicture(pic);
    if (n) setUserName(n);
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBookingsByCustomer(userId);
      setBookings(data);
    } catch (err: any) {
      const raw = err?.message ?? err;
      setError(typeof raw === 'string' ? raw : JSON.stringify(raw));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadBookings(); }, [loadBookings]));

  async function onRefresh() {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }

  function openEdit(booking: Booking) {
    setEditBooking(booking);
    setEditServiceType(booking.serviceType);
    setEditMinAmount(String(booking.minAmount ?? booking.amount ?? ''));
    setEditMaxAmount(String(booking.maxAmount ?? booking.amount ?? ''));
    setEditNotes(booking.notes ?? '');
    setEditPhone(booking.customerPhone ?? '');
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editBooking) return;
    const min = Number(editMinAmount);
    const max = Number(editMaxAmount);
    if (!editMinAmount || isNaN(min) || min <= 0) {
      setEditError('Enter a valid minimum amount.');
      return;
    }
    if (!editMaxAmount || isNaN(max) || max < min) {
      setEditError('Maximum must be greater than or equal to minimum.');
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const updated = await updateBooking(editBooking.id, {
        serviceType: editServiceType,
        amount: min,
        minAmount: min,
        maxAmount: max,
        notes: editNotes.trim() || undefined,
        customerPhone: editPhone.trim(),
      });
      setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b));
      setEditBooking(null);
    } catch (err: any) {
      const raw = err?.message ?? err;
      setEditError(typeof raw === 'string' ? raw : 'Failed to update booking.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && bookings.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Hello,</Text>
          <Text style={styles.title}>{userName || 'My Bookings'}</Text>
        </View>
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <Text style={styles.headerAvatarText}>
              {(userName || 'U').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadBookings} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={bookings}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="clipboard-outline" size={52} color={Colors.outline} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No bookings yet</Text>
              <Text style={styles.emptySubtext}>Your booking history will appear here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
              <Text style={styles.serviceType}>{item.serviceType}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] ?? Colors.outline }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={14} color={Colors.outline} />
              <Text style={styles.bookingDetail}> Worker #{item.workerId}</Text>
            </View>

            {item.minAmount != null && item.maxAmount != null ? (
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={14} color={Colors.outline} />
                <Text style={styles.bookingDetail}> GH₵ {item.minAmount} – GH₵ {item.maxAmount}</Text>
              </View>
            ) : (
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={14} color={Colors.outline} />
                <Text style={styles.bookingDetail}> GH₵ {item.amount}</Text>
              </View>
            )}

            {item.notes ? (
              <Text style={styles.bookingNotes}>{item.notes}</Text>
            ) : null}

            {item.createdAt && (
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={14} color={Colors.outline} />
                <Text style={styles.bookingDate}> {new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
            )}

            {item.status === 'PENDING' && (
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)} activeOpacity={0.8}>
                <Ionicons name="pencil-outline" size={14} color={Colors.primary} />
                <Text style={styles.editBtnText}>Edit Booking</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <Modal visible={!!editBooking} animationType="slide" transparent onRequestClose={() => setEditBooking(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Booking</Text>
              <TouchableOpacity onPress={() => setEditBooking(null)}>
                <Ionicons name="close" size={24} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {editError && (
                <View style={styles.editErrorBox}>
                  <Text style={styles.editErrorText}>{editError}</Text>
                </View>
              )}

              <Text style={styles.modalLabel}>Service Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {SERVICES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, editServiceType === s && styles.chipActive]}
                    onPress={() => setEditServiceType(s)}
                  >
                    <Text style={[styles.chipText, editServiceType === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Budget Range (GH₵)</Text>
              <View style={styles.rangeRow}>
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <Ionicons name="cash-outline" size={16} color={Colors.outline} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    value={editMinAmount}
                    onChangeText={setEditMinAmount}
                    placeholder="Min"
                    placeholderTextColor={Colors.outline}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.rangeSep}>–</Text>
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <TextInput
                    style={styles.input}
                    value={editMaxAmount}
                    onChangeText={setEditMaxAmount}
                    placeholder="Max"
                    placeholderTextColor={Colors.outline}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>Phone</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={16} color={Colors.outline} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="+233241234567"
                  placeholderTextColor={Colors.outline}
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput
                style={styles.textArea}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Any additional details..."
                placeholderTextColor={Colors.outline}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} disabled={saving} activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSub: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  list: { padding: 20, paddingTop: 4, paddingBottom: 100 },
  bookingCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, padding: 16, marginBottom: 12 },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  serviceType: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', flex: 1 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  bookingDetail: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  bookingNotes: { fontSize: 14, color: Colors.onSurface, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginTop: 6 },
  bookingDate: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular' },
  editBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6, alignSelf: 'flex-start', backgroundColor: Colors.primaryContainer, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  errorBox: { margin: 20, backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 16, alignItems: 'center' },
  errorText: { color: Colors.error, fontSize: 16, marginBottom: 10 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: Colors.onPrimary, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { marginBottom: 14 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  emptySubtext: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 8, marginTop: 16 },
  chipScroll: { marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surfaceContainerLow, marginRight: 8 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 14, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: Colors.onPrimary, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeSep: { fontSize: 18, color: Colors.onSurfaceVariant, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerHighest, borderRadius: 10, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  textArea: { backgroundColor: Colors.surfaceContainerHighest, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular', minHeight: 80 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText: { color: Colors.onPrimary, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  editErrorBox: { backgroundColor: Colors.errorContainer, borderRadius: 8, padding: 10, marginBottom: 8 },
  editErrorText: { color: Colors.error, fontSize: 14 },
});
