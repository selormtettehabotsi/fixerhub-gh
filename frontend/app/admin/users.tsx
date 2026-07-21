import React, { useState, useCallback } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getAdminUsersPaged, setUserSuspended, type AdminUser } from '../../src/api/admin';
import Avatar from '../../src/components/Avatar';

const PAGE_SIZE = 30;

/** ADMIN — Users: paged list with search + suspend/unsuspend moderation. */
export default function AdminUsersScreen() {
  const styles = useThemedStyles(makeStyles);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const loadPage = useCallback(async (pageNum: number, replace: boolean) => {
    setLoading(true);
    try {
      const data = await getAdminUsersPaged(pageNum, PAGE_SIZE);
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
      setUsers((prev) => {
        if (replace) return data;
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...data.filter((u) => !seen.has(u.id))];
      });
    } catch (err: any) {
      Alert.alert('Could not load users', err.message ?? 'Try again');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadPage(0, true); }, [loadPage]));

  async function onRefresh() {
    setRefreshing(true);
    await loadPage(0, true);
    setRefreshing(false);
  }

  function toggleSuspend(user: AdminUser) {
    const suspending = !user.suspended;
    Alert.alert(
      suspending ? `Suspend ${user.name || user.email}?` : `Unsuspend ${user.name || user.email}?`,
      suspending
        ? 'They will be logged out (within 15 min) and cannot sign in until unsuspended.'
        : 'They will be able to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: suspending ? 'Suspend' : 'Unsuspend',
          style: suspending ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(user.id);
            try {
              const updated = await setUserSuspended(user.id, suspending);
              setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
            } catch (err: any) {
              Alert.alert('Failed', err.message ?? 'Try again');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  const q = query.trim().toLowerCase();
  const displayed = q
    ? users.filter(
        (u) =>
          (u.name ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          String(u.id).includes(q)
      )
    : users;

  function renderUser({ item }: { item: AdminUser }) {
    const isAdmin = item.role === 'ADMIN';
    return (
      <View style={styles.card}>
        <Avatar uri={item.profilePicture} name={item.name || item.email} size={42} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name || 'Unnamed'}</Text>
          <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
          <View style={styles.chipRow}>
            <View style={[styles.chip, item.role === 'WORKER' ? styles.chipWorker : item.role === 'ADMIN' ? styles.chipAdmin : styles.chipCustomer]}>
              <Text style={styles.chipText}>{item.role}</Text>
            </View>
            {item.suspended && (
              <View style={[styles.chip, styles.chipSuspended]}>
                <Text style={[styles.chipText, { color: Colors.error }]}>SUSPENDED</Text>
              </View>
            )}
          </View>
        </View>
        {!isAdmin && (
          busyId === item.id ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <TouchableOpacity
              style={[styles.suspendBtn, item.suspended && styles.unsuspendBtn]}
              onPress={() => toggleSuspend(item)}
            >
              <Ionicons
                name={item.suspended ? 'lock-open-outline' : 'ban-outline'}
                size={16}
                color={item.suspended ? '#2e7d32' : Colors.error}
              />
              <Text style={[styles.suspendText, { color: item.suspended ? '#2e7d32' : Colors.error }]}>
                {item.suspended ? 'Unsuspend' : 'Suspend'}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.outline} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, email or ID…"
          placeholderTextColor={Colors.outline}
        />
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && hasMore && !q) loadPage(page + 1, false);
        }}
        ListFooterComponent={
          loading ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 16 }} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={56} color={Colors.outline} />
              <Text style={styles.emptyText}>{q ? 'No users match your search' : 'No users yet'}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerLow,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  list: { padding: 16, paddingBottom: 110 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  email: { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 1 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  chip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  chipCustomer: { backgroundColor: 'rgba(29,78,216,0.1)' },
  chipWorker: { backgroundColor: 'rgba(46,125,50,0.1)' },
  chipAdmin: { backgroundColor: Colors.surfaceContainerHigh },
  chipSuspended: { backgroundColor: Colors.errorContainer },
  chipText: { fontSize: 10, fontWeight: '700', color: Colors.onSurfaceVariant, fontFamily: 'Inter_600SemiBold' },

  suspendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(211,47,47,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(211,47,47,0.25)',
  },
  unsuspendBtn: { backgroundColor: 'rgba(46,125,50,0.08)', borderColor: 'rgba(46,125,50,0.25)' },
  suspendText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  emptyBox: { alignItems: 'center', paddingVertical: 72, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
});
