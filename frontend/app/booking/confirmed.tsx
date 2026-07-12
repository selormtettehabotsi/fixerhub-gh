import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { formatBookingId } from '../../src/utils/formatId';

export default function BookingConfirmedScreen() {
  const { bookingId, workerName } = useLocalSearchParams<{
    bookingId: string;
    workerName: string;
  }>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={48} color={Colors.onPrimary} />
        </View>

        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>
          {workerName ?? 'Your worker'} has been notified and will arrive soon.
        </Text>

        <View style={styles.refCard}>
          <Text style={styles.refLabel}>Booking Reference</Text>
          <Text style={styles.refNumber}>{formatBookingId(bookingId)}</Text>
        </View>

        <View style={styles.etaCard}>
          <Ionicons name="time-outline" size={32} color={Colors.primary} />
          <View>
            <Text style={styles.etaTitle}>Your worker will arrive soon</Text>
            <Text style={styles.etaSubtitle}>You'll receive an SMS notification</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          onPress={() => router.push('/(customer)/bookings')}
          activeOpacity={0.85}
          style={styles.secondaryBtnWrapper}
        >
          <View style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>View My Bookings</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(customer)/home')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  refCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
  },
  refLabel: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  refNumber: { fontSize: 28, fontWeight: '700', color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 14,
  },
  etaTitle: { fontSize: 16, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  etaSubtitle: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  bottomActions: { padding: 20, gap: 12 },
  secondaryBtnWrapper: {},
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  secondaryBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  primaryBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: Colors.onPrimary, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});
