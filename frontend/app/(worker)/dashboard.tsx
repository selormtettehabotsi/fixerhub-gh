import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getBookingsByWorker, updateBookingStatus, Booking } from '../../src/api/bookings';
import { getWorkerByUserId, setAvailabilityByUserId } from '../../src/api/workers';
import { useTabBar } from '../../src/context/TabBarContext';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.secondary,
  COMPLETED: Colors.available,
  CANCELLED: Colors.unavailable,
};

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
      // Get worker profile first to get the profile ID (different from auth userId)
      const profile = await getWorkerByUserId(id);
      setAvailableState(profile.available);
      // Fetch bookings using the worker profile ID, not the auth userId
      const bookingData = await getBookingsByWorker(profile.id);
      setBookings(bookingData);
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

  async function markComplete(bookingId: number) {
    try {
      await updateBookingStatus(bookingId, 'COMPLETED');
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'COMPLETED' } : b));
    } catch (err: any) {
      Alert.alert('Error', err.message);
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
            <Image source={{ uri: profilePicture }} style={styles.headerAvatar} />
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
        renderItem={({ item }) => (
          <View style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <Text style={styles.serviceType}>{item.serviceType}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] ?? Colors.outline }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.jobDetail}>Customer #{item.customerId}</Text>
            <View style={styles.jobDetailRow}>
              <Ionicons name="call-outline" size={14} color={Colors.onSurfaceVariant} />
              <Text style={styles.jobDetail}> {item.customerPhone || 'No phone provided'}</Text>
            </View>
            <View style={styles.jobDetailRow}><Ionicons name="cash-outline" size={14} color={Colors.onSurfaceVariant} /><Text style={styles.jobDetail}> GH₵ {item.amount}</Text></View>
            {item.notes && <Text style={styles.jobNotes}>{item.notes}</Text>}
            {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => Alert.alert('Mark Complete?', 'This will trigger payment processing.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Complete', onPress: () => markComplete(item.id) },
                ])}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" /><Text style={styles.completeBtnText}> Mark as Complete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
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
  jobCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, padding: 16, marginBottom: 12 },
  jobHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  serviceType: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', flex: 1 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  jobDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  jobDetail: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  jobNotes: { fontSize: 17, color: Colors.onSurface, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginTop: 6 },
  completeBtn: { marginTop: 12, backgroundColor: Colors.available, borderRadius: 8, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
