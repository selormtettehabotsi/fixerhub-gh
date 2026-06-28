import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getWorker, Worker } from '../../src/api/workers';

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={20}
          color={i <= Math.round(rating) ? Colors.starColor : Colors.outlineVariant}
          style={styles.starIcon}
        />
      ))}
      <Text style={styles.ratingLabel}>{rating.toFixed(1)} / 5.0</Text>
    </View>
  );
}

export default function WorkerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getWorker(id)
      .then((data) => setWorker(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !worker) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Worker not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryContainer]}
          style={styles.profileHeader}
        >
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{getInitials(worker.name)}</Text>
          </View>
          <Text style={styles.workerName}>{worker.name}</Text>
          <Text style={styles.workerSkill}>{worker.skill}</Text>
          <View style={[styles.availBadge, { backgroundColor: worker.available ? Colors.available : Colors.unavailable }]}>
            <Text style={styles.availText}>{worker.available ? '● Available' : '● Unavailable'}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Rating</Text>
            <StarDisplay rating={worker.rating ?? 0} />
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Details</Text>
            <InfoRow iconName="location-outline" label="Location" value={worker.location ?? '—'} />
            <InfoRow iconName="mail-outline" label="Email" value={worker.email ?? '—'} />
            {worker.phone && <InfoRow iconName="call-outline" label="Phone" value={worker.phone} />}
            {worker.ratePerHour != null && (
              <InfoRow iconName="cash-outline" label="Rate" value={`GH₵ ${worker.ratePerHour}/hour`} />
            )}
          </View>

          {worker.bio && (
            <View style={styles.aboutSection}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{worker.bio}</Text>
            </View>
          )}

          <View style={styles.reviewsSection}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <View style={styles.reviewPlaceholder}>
              <Ionicons name="star-outline" size={28} color={Colors.outlineVariant} style={styles.reviewIcon} />
              <Text style={styles.reviewPlaceholderText}>Reviews coming soon</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.stickyBottom}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/booking/confirm',
              params: { workerId: String(worker.id), workerName: worker.name, skill: worker.skill },
            })
          }
          activeOpacity={0.85}
          style={styles.bookBtnWrapper}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookBtn}
          >
            <Text style={styles.bookBtnText}>Book Now</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ iconName, label, value }: { iconName: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={iconName} size={20} color={Colors.primary} />
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, padding: 24 },
  errorText: { fontSize: 16, color: Colors.error, textAlign: 'center', marginBottom: 16 },
  backBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  backBtnText: { color: Colors.onPrimary, fontWeight: '700' },
  profileHeader: { alignItems: 'center', paddingTop: 32, paddingBottom: 28, paddingHorizontal: 24 },
  avatarLarge: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarLargeText: { color: Colors.onPrimary, fontSize: 32, fontWeight: '700' },
  workerName: { fontSize: 26, fontWeight: '700', color: Colors.onPrimary, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 },
  workerSkill: { fontSize: 17, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter_400Regular', marginBottom: 12 },
  availBadge: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 5 },
  availText: { color: Colors.onPrimary, fontSize: 17, fontWeight: '600' },
  body: { padding: 20, gap: 16 },
  ratingCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, padding: 16 },
  ratingTitle: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  starIcon: { marginRight: 2 },
  ratingLabel: { fontSize: 17, color: Colors.onSurface, fontWeight: '600', marginLeft: 8, fontFamily: 'Inter_600SemiBold' },
  infoSection: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, padding: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 10, paddingHorizontal: 12, paddingTop: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 12 },
  infoLabel: { fontSize: 17, color: Colors.outline, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },
  aboutSection: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, padding: 16 },
  bioText: { fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  reviewsSection: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, padding: 16 },
  reviewPlaceholder: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  reviewIcon: {},
  reviewPlaceholderText: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  stickyBottom: { padding: 16, backgroundColor: Colors.surface, borderTopWidth: 0 },
  bookBtnWrapper: {},
  bookBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  bookBtnText: { color: Colors.onPrimary, fontSize: 17, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});
