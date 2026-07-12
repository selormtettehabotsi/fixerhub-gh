import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../src/constants/colors';
import { getWorker, Worker } from '../../src/api/workers';
import { getWorkerReviews, Review } from '../../src/api/reviews';
import { conversationId as mkConversationId } from '../../src/utils/formatId';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
import Avatar from '../../src/components/Avatar';

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

export default function WorkerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getWorker(id),
      getWorkerReviews(id),
      AsyncStorage.getItem('userId'),
    ])
      .then(([workerData, reviewData, storedUserId]) => {
        setWorker(workerData);
        setReviews(reviewData);
        setMyUserId(storedUserId);
      })
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

  const isOwner = myUserId ? String(worker.userId) === myUserId : false;

  const bioText = worker.bio ?? '';
  const bioTruncated = bioText.length > 120 && !expanded
    ? bioText.slice(0, 120) + '...'
    : bioText;

  const avgPricing = worker.minPrice != null && worker.maxPrice != null
    ? `GHS ${worker.minPrice}–${worker.maxPrice}`
    : worker.minPrice != null
    ? `From GHS ${worker.minPrice}`
    : worker.maxPrice != null
    ? `Up to GHS ${worker.maxPrice}`
    : '—';

  const handleChat = () => {
    if (!myUserId) return;
    // Always use worker.id (worker profile ID) — matches the ID stored in bookings
    const convId = mkConversationId(myUserId, String(worker.id));
    router.push({ pathname: `/chat/${convId}`, params: { otherName: worker.name } });
  };

  const handleBook = () => {
    router.push({
      pathname: '/booking/confirm',
      params: {
        workerId: String(worker.id),
        workerName: worker.name,
        skill: worker.skill,
        workerPicture: worker.profilePicture ?? '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profile Details</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Profile card ──────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              {worker.profilePicture ? (
                <Image source={{ uri: cloudinaryThumb(worker.profilePicture, 110) }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(worker.name)}</Text>
                </View>
              )}
              {worker.verified && (
                <View style={styles.verifiedDot}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>

            {/* Name + rating */}
            <View style={styles.profileInfo}>
              <View style={styles.nameRatingRow}>
                <Text style={styles.workerName} numberOfLines={1}>{worker.name}</Text>
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={14} color={Colors.starColor} />
                  <Text style={styles.ratingNum}>{(worker.rating ?? 0).toFixed(1)}</Text>
                </View>
              </View>

              {worker.location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={Colors.outline} />
                  <Text style={styles.locationText}>{worker.location}</Text>
                </View>
              ) : null}

              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{worker.skill}</Text>
                </View>
                {worker.available ? (
                  <View style={[styles.chip, styles.chipAvail]}>
                    <Text style={[styles.chipText, styles.chipAvailText]}>Available</Text>
                  </View>
                ) : (
                  <View style={[styles.chip, styles.chipBusy]}>
                    <Text style={[styles.chipText, styles.chipBusyText]}>Busy</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── Stats row ─────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="pricetag-outline" size={22} color={Colors.primary} style={styles.statIcon} />
            <Text style={styles.statLabel}>AVG. PRICING</Text>
            <Text style={styles.statValue}>{avgPricing}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={22} color={Colors.primary} style={styles.statIcon} />
            <Text style={styles.statLabel}>REVIEWS</Text>
            <Text style={styles.statValue}>{reviews.length}</Text>
          </View>
        </View>

        {/* ── About ─────────────────────────────────────────────────── */}
        {bioText.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About {worker.name.split(' ')[0]}</Text>
            <Text style={styles.bioText}>{bioTruncated}</Text>
            {bioText.length > 120 && (
              <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                <Text style={styles.readMore}>{expanded ? 'Show less' : 'Read more'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Recent Reviews ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
            {reviews.length > 0 && (
              <Text style={styles.seeAll}>({reviews.length})</Text>
            )}
          </View>

          {reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Ionicons name="star-outline" size={32} color={Colors.outlineVariant} />
              <Text style={styles.emptyReviewsText}>No reviews yet</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewsScroll}>
              {reviews.slice(0, 10).map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </ScrollView>
          )}
        </View>

      </ScrollView>

      {/* ── Bottom bar ────────────────────────────────────────────── */}
      {!isOwner && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.chatBtn} onPress={handleChat} activeOpacity={0.85}>
            <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
            <Text style={styles.chatBtnText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bookBtn} onPress={handleBook} activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.bookBtnText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── ReviewCard ────────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const displayName = review.customerName || (review.customerId ? `Customer ${review.customerId}` : 'Customer');

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Avatar uri={review.customerProfilePicture} name={displayName} size={34} />
        <View>
          <Text style={styles.reviewerName}>{displayName}</Text>
          <Text style={styles.reviewDate}>{timeAgo(review.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.reviewStars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons
            key={i}
            name={i <= review.rating ? 'star' : 'star-outline'}
            size={13}
            color={i <= review.rating ? Colors.starColor : Colors.outlineVariant}
          />
        ))}
      </View>
      {review.comment ? (
        <Text style={styles.reviewComment} numberOfLines={3}>{review.comment}</Text>
      ) : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, padding: 24 },
  errorText: { fontSize: 16, color: Colors.error, textAlign: 'center', marginBottom: 16 },
  backBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  backBtnText: { color: Colors.onPrimary, fontWeight: '700' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Profile card
  profileCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 78, height: 78, borderRadius: 14 },
  avatarText: { color: Colors.onPrimary, fontSize: 26, fontWeight: '700' },
  verifiedDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.available,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLowest,
  },

  profileInfo: { flex: 1 },
  nameRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    flex: 1,
    marginRight: 8,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingNum: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'Inter_600SemiBold',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationText: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: Colors.primaryFixed,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, color: Colors.primary, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  chipAvail: { backgroundColor: 'rgba(46,125,50,0.1)' },
  chipAvailText: { color: Colors.available },
  chipBusy: { backgroundColor: Colors.errorContainer },
  chipBusyText: { color: Colors.error },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: { marginBottom: 8 },
  statLabel: {
    fontSize: 11,
    color: Colors.outline,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Section
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 8,
  },
  seeAll: { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  bioText: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  readMore: { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_600SemiBold', marginTop: 6 },

  // Reviews
  emptyReviews: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyReviewsText: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  reviewsScroll: { marginHorizontal: -4 },
  reviewCard: {
    width: 200,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  reviewerName: { fontSize: 13, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  reviewDate: { fontSize: 11, color: Colors.outline, fontFamily: 'Inter_400Regular' },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  reviewComment: { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  chatBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  bookBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  bookBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
