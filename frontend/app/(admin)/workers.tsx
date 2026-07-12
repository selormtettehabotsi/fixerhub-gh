import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getAdminWorkers, verifyWorker, unverifyWorker, AdminWorker } from '../../src/api/admin';
import { useTabBar } from '../../src/context/TabBarContext';
import Avatar from '../../src/components/Avatar';

export default function AdminWorkersScreen() {
  const { onScroll } = useTabBar();
  const [workers, setWorkers] = useState<AdminWorker[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminWorkers();
      setWorkers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadWorkers(); }, [loadWorkers]));

  async function onRefresh() {
    setRefreshing(true);
    await loadWorkers();
    setRefreshing(false);
  }

  async function handleToggleVerify(worker: AdminWorker) {
    const action = worker.verified ? 'remove verification from' : 'verify';
    Alert.alert(
      worker.verified ? 'Remove Verification' : 'Verify Worker',
      `Are you sure you want to ${action} ${worker.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: worker.verified ? 'Remove' : 'Verify',
          onPress: async () => {
            try {
              const updated = worker.verified
                ? await unverifyWorker(worker.id)
                : await verifyWorker(worker.id);
              setWorkers((prev) =>
                prev.map((w) => (w.id === worker.id ? { ...w, verified: updated.verified } : w))
              );
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  const verified = workers.filter((w) => w.verified).length;
  const unverified = workers.filter((w) => !w.verified).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Worker Verification</Text>
        <Text style={styles.subtitle}>Manage worker approvals</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderLeftColor: Colors.available }]}>
          <Text style={styles.statNum}>{verified}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: Colors.warning }]}>
          <Text style={styles.statNum}>{unverified}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: Colors.primary }]}>
          <Text style={styles.statNum}>{workers.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadWorkers} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={workers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={52} color={Colors.outline} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No workers found</Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          loading && workers.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatarCol}>
              <Avatar uri={item.profilePicture} name={item.name} size={48} />
              {item.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.verified ? (
                  <View style={[styles.badge, styles.badgeVerified]}>
                    <Ionicons name="shield-checkmark-outline" size={11} color={Colors.available} />
                    <Text style={[styles.badgeText, { color: Colors.available }]}> Verified</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgePending]}>
                    <Ionicons name="time-outline" size={11} color={Colors.warning} />
                    <Text style={[styles.badgeText, { color: Colors.warning }]}> Pending</Text>
                  </View>
                )}
              </View>
              <Text style={styles.skill}>{item.skill}</Text>
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={13} color={Colors.outline} />
                <Text style={styles.detail}> {item.location ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="star" size={13} color={Colors.starColor} />
                <Text style={styles.detail}> {(item.rating ?? 0).toFixed(1)}</Text>
                <Text style={styles.detailDot}> · </Text>
                <Ionicons
                  name="ellipse"
                  size={8}
                  color={item.available ? Colors.available : Colors.unavailable}
                />
                <Text style={styles.detail}> {item.available ? 'Available' : 'Unavailable'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.verifyBtn, item.verified ? styles.verifyBtnActive : styles.verifyBtnInactive]}
              onPress={() => handleToggleVerify(item)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={item.verified ? 'shield-checkmark' : 'shield-outline'}
                size={18}
                color={item.verified ? Colors.available : Colors.primary}
              />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  subtitle: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginVertical: 12, gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
  },
  statNum: { fontSize: 22, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  statLabel: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  errorBox: { margin: 20, backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 16, alignItems: 'center' },
  errorText: { color: Colors.error, fontSize: 15, marginBottom: 10 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: Colors.onPrimary, fontWeight: '600', fontSize: 15 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  loader: { marginVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { marginBottom: 14 },
  emptyText: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  avatarCol: { position: 'relative' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 16 },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.available,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainerLowest,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', flex: 1, marginRight: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeVerified: { backgroundColor: 'rgba(34,197,94,0.1)' },
  badgePending: { backgroundColor: 'rgba(234,179,8,0.1)' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  skill: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  detail: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  detailDot: { fontSize: 13, color: Colors.outline },
  verifyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnActive: { backgroundColor: 'rgba(34,197,94,0.1)' },
  verifyBtnInactive: { backgroundColor: Colors.surfaceContainerLow },
});
