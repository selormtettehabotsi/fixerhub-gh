import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getNearbyWorkers, Worker } from '../../src/api/workers';
import { useLocation } from '../../src/hooks/useLocation';
import { useTabBar } from '../../src/context/TabBarContext';
import WorkerCard from '../../src/components/WorkerCard';
import CategoryCard from '../../src/components/CategoryCard';

const CATEGORIES = [
  { iconName: 'water-outline', label: 'Plumbing', skill: 'Plumbing' },
  { iconName: 'flash-outline', label: 'Electrical', skill: 'Electrical' },
  { iconName: 'hammer-outline', label: 'Carpentry', skill: 'Carpentry' },
  { iconName: 'color-palette-outline', label: 'Painting', skill: 'Painting' },
  { iconName: 'brush-outline', label: 'Cleaning', skill: 'Cleaning' },
  { iconName: 'flame-outline', label: 'Welding', skill: 'Welding' },
] as const;

export default function CustomerHome() {
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

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('name'), AsyncStorage.getItem('profilePicture')]).then(([n, pic]) => {
      if (n) setName(n);
      if (pic) setProfilePicture(pic);
    });
  }, []);

  const loadWorkers = useCallback(async (lat?: number, lng?: number) => {
    const useLat = lat ?? latitude ?? 5.6037;
    const useLng = lng ?? longitude ?? -0.187;
    setLoading(true);
    setError(null);
    try {
      const data = await getNearbyWorkers(useLat, useLng);
      setWorkers(data);
      setFiltered(data);
    } catch (err: any) {
      const raw = err?.message ?? err;
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
      setError(msg || 'Failed to load workers');
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  // Load immediately on mount with fallback coords so page isn't blank
  useEffect(() => {
    loadWorkers(5.6037, -0.187);
  }, []);

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}{name ? `, ${name.split(' ')[0]}` : ''}</Text>
            <Text style={styles.headerSubtitle}>Find a trusted worker near you</Text>
          </View>
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.headerAvatar} />
          ) : (
            <TouchableOpacity style={styles.notifBtn}>
              <Ionicons name="notifications-outline" size={22} color={Colors.onSurface} />
            </TouchableOpacity>
          )}
        </View>

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

        {!locLoading && latitude && longitude && (
          <View style={styles.mapContainer}>
            <MapView
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={styles.map}
              initialRegion={{
                latitude,
                longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {workers.filter((w) => w.latitude && w.longitude).map((w) => (
                <Marker
                  key={w.id}
                  coordinate={{ latitude: w.latitude!, longitude: w.longitude! }}
                  onPress={() => router.push(`/worker/${w.id}`)}
                >
                  <View style={styles.markerBubble}>
                    <Text style={styles.markerText}>{w.name.charAt(0)}</Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map((c) => (
              <CategoryCard key={c.skill} iconName={c.iconName} label={c.label} onPress={() => filterBySkill(c.skill)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Workers</Text>
            <Text style={styles.sectionCount}>{filtered.length} found</Text>
          </View>

          {loading && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadWorkers} style={styles.retryBtn}>
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

          {filtered.map((w) => (
            <WorkerCard
              key={w.id}
              id={w.id}
              name={w.name}
              skill={w.skill}
              rating={w.rating ?? 0}
              available={w.available}
              location={w.location}
              ratePerHour={w.ratePerHour}
              onPress={() => router.push(`/worker/${w.id}`)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  greeting: { fontSize: 22, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  headerSubtitle: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerHighest, borderRadius: 12, marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 14, height: 48 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  mapContainer: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 16, height: 200 },
  map: { flex: 1 },
  markerBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.onPrimary },
  markerText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 16 },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
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
