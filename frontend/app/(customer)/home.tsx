import React, { useState, useEffect, useCallback } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getNearbyWorkers, getWorker, Worker } from '../../src/api/workers';
import { getFavorites } from '../../src/api/favorites';
import { useLocation } from '../../src/hooks/useLocation';
import NotificationBell from '../../src/components/NotificationBell';
import { useTabBar } from '../../src/context/TabBarContext';
import WorkerCard from '../../src/components/WorkerCard';
import CategoryCard from '../../src/components/CategoryCard';
import { conversationId as mkConversationId } from '../../src/utils/formatId';
import { cloudinaryThumb } from '../../src/utils/imageUrl';

const CATEGORIES = [
  { iconName: 'water-outline', label: 'Plumbing', skill: 'Plumbing' },
  { iconName: 'flash-outline', label: 'Electrical', skill: 'Electrical' },
  { iconName: 'hammer-outline', label: 'Carpentry', skill: 'Carpentry' },
  { iconName: 'color-palette-outline', label: 'Painting', skill: 'Painting' },
  { iconName: 'brush-outline', label: 'Cleaning', skill: 'Cleaning' },
  { iconName: 'flame-outline', label: 'Welding', skill: 'Welding' },
] as const;

export default function CustomerHome() {
  const styles = useThemedStyles(makeStyles);
  const { skill: skillParam } = useLocalSearchParams<{ skill?: string }>();
  const { latitude, longitude, loading: locLoading } = useLocation();
  const { onScroll } = useTabBar();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [filtered, setFiltered] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  // RETENTION: saved workers for the "Your Workers" quick-rebook row
  const [favoriteWorkers, setFavoriteWorkers] = useState<Worker[]>([]);

  const loadWorkers = useCallback(async (silent = false) => {
    const useLat = latitude ?? 5.6037;
    const useLng = longitude ?? -0.187;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await getNearbyWorkers(useLat, useLng);
      setWorkers(data);
      setFiltered(data);
      setError(null);
    } catch (err: any) {
      if (silent) return; // background refresh failed — keep what we have
      const raw = err?.message ?? err;
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
      setError(msg || 'Failed to load workers');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [latitude, longitude]);

  // Reload name + profile picture every time this tab comes into focus
  useFocusEffect(useCallback(() => {
    Promise.all([
      AsyncStorage.getItem('name'),
      AsyncStorage.getItem('profilePicture'),
      AsyncStorage.getItem('userId'),
    ]).then(([n, pic, uid]) => {
      if (n) setName(n);
      if (pic) setProfilePicture(pic);
      if (uid) setMyUserId(uid);
    });
    // FRESHNESS: re-fetch workers on focus so new ratings and distances show
    // up when returning from a review, booking, or after moving around.
    loadWorkers();
    // RETENTION: refresh the favorites row (max 10, newest first)
    getFavorites()
      .then((ids) => Promise.all(ids.slice(0, 10).map((wid) => getWorker(wid).catch(() => null))))
      .then((list) => setFavoriteWorkers(list.filter((w): w is Worker => w != null)))
      .catch(() => {});
    // LIVE DISTANCE: silent background poll while this tab is focused, so
    // "km away" updates when WORKERS move (their app pushes GPS to the server)
    // even if this customer stays perfectly still. No spinner, keeps old list
    // on network hiccups.
    const interval = setInterval(() => loadWorkers(true), 30000);
    return () => clearInterval(interval);
  }, [loadWorkers]));

  // PERF: single effect — fires on mount with the Accra fallback coords built
  // into loadWorkers, then once more when real GPS coordinates resolve.
  // (Previously a second mount-effect triggered a redundant duplicate fetch.)
  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  // When navigated from the Services tab with a skill param, populate the search box
  useEffect(() => {
    if (skillParam) setSearch(skillParam);
  }, [skillParam]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(workers);
    } else {
      const q = search.toLowerCase();
      setFiltered(workers.filter((w) => w.skill.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)));
    }
  }, [search, workers]);

  async function onRefresh() {
    setRefreshing(true);
    await loadWorkers();
    setRefreshing(false);
  }

  function filterBySkill(skill: string) {
    setSearch(skill);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // PERF: stable renderItem for the virtualized worker list
  const renderWorker = useCallback(({ item: w }: ListRenderItemInfo<Worker>) => (
    <View style={styles.listItem}>
      <WorkerCard
        id={w.id}
        name={w.name}
        skill={w.skill}
        rating={w.rating ?? 0}
        available={w.available}
        location={w.location}
        ratePerHour={w.ratePerHour}
        verified={w.verified}
        profilePicture={w.profilePicture}
        distanceKm={w.distanceKm}
        plan={w.plan}
        onPress={() => router.push(`/worker/${w.id}`)}
        onChat={myUserId ? () => {
          // Use w.id (worker profile ID) — same key used in bookings
          const convId = mkConversationId(myUserId, String(w.id));
          router.push({ pathname: `/chat/${convId}`, params: { otherName: w.name } });
        } : undefined}
      />
    </View>
  ), [myUserId]);

  const listHeader = (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}{name ? `, ${name.split(' ')[0]}` : ''}</Text>
          <Text style={styles.headerSubtitle}>Find a trusted worker near you</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* NOTIFICATION CENTER: bell with unread badge */}
          <NotificationBell />
          {profilePicture ? (
            <Image source={{ uri: cloudinaryThumb(profilePicture, 42) }} style={styles.headerAvatar} />
          ) : null}
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={Colors.outline} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by skill or name..."
            placeholderTextColor={Colors.outline}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.outline} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Home map removed — live tracking now lives on the booking screen
          (Uber-style, per booking) instead of showing static worker pins. */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Services</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((c) => (
            <CategoryCard key={c.skill} iconName={c.iconName} label={c.label} onPress={() => filterBySkill(c.skill)} />
          ))}
        </ScrollView>
      </View>

      {/* RETENTION: one-tap access to previously saved workers */}
      {favoriteWorkers.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Workers</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRow}>
            {favoriteWorkers.map((fw) => (
              <TouchableOpacity key={fw.id} style={styles.favCard} activeOpacity={0.8}
                                onPress={() => router.push(`/worker/${fw.id}`)}>
                {fw.profilePicture ? (
                  <Image source={{ uri: cloudinaryThumb(fw.profilePicture, 54) }} style={styles.favAvatar} />
                ) : (
                  <View style={[styles.favAvatar, styles.favAvatarFallback]}>
                    <Text style={styles.favAvatarText}>{fw.name?.[0] ?? '?'}</Text>
                  </View>
                )}
                <Text style={styles.favName} numberOfLines={1}>{fw.name.split(' ')[0]}</Text>
                <Text style={styles.favSkill} numberOfLines={1}>{fw.skill}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Workers</Text>
          <Text style={styles.sectionCount}>{filtered.length} found</Text>
        </View>

        {loading && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => loadWorkers()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && filtered.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={48} color={Colors.outline} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No workers found nearby.</Text>
            <Text style={styles.emptySubtext}>Try a different search or expand your area.</Text>
          </View>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* PERF: FlatList virtualizes the worker list — only visible cards are
          mounted, instead of every card (and its image) living in memory. */}
      <FlatList
        data={filtered}
        keyExtractor={(w) => String(w.id)}
        renderItem={renderWorker}
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={onScroll}
        scrollEventThrottle={48}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  greeting: { fontSize: 22, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  headerSubtitle: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  searchRow: { marginHorizontal: 20, marginBottom: 8 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerHighest, borderRadius: 12, paddingHorizontal: 14, height: 48 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  listItem: { paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },

  // "Your Workers" quick-rebook row
  favRow: { gap: 12, paddingRight: 8 },
  favCard: { width: 84, alignItems: 'center', backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6 },
  favAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 6 },
  favAvatarFallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  favAvatarText: { color: Colors.onPrimary, fontSize: 18, fontWeight: '700' },
  favName: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: Colors.onSurface },
  favSkill: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: Colors.onSurfaceVariant },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 12 },
  sectionCount: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  categoryScroll: { marginBottom: 4 },
  loader: { marginVertical: 24 },
  errorBox: { backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 16, alignItems: 'center' },
  errorText: { color: Colors.error, fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: Colors.onPrimary, fontWeight: '600', fontSize: 16 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 4 },
  emptySubtext: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
