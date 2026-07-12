import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import * as tokenStorage from '../src/utils/tokenStorage';

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(async () => {
      const [token, role] = await Promise.all([
        tokenStorage.getItem('token'),
        tokenStorage.getItem('role'),
      ]);

      if (!token) {
        router.replace('/(auth)/welcome');
        return;
      }

      switch (role) {
        case 'WORKER':
          router.replace('/(worker)/dashboard');
          break;
        case 'ADMIN':
          router.replace('/(admin)/dashboard');
          break;
        default:
          router.replace('/(customer)/home');
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Ionicons name="construct" size={64} color={Colors.onPrimary} style={styles.logoIcon} />
        <Text style={styles.logoText}>FixerHub</Text>
        <Text style={styles.tagline}>Ghana's #1 Service Marketplace</Text>
      </View>
      <View style={styles.locationRow}>
        <Ionicons name="location-sharp" size={16} color="rgba(255,255,255,0.7)" />
        <Text style={styles.location}> Reliability Powered by Accra</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoIcon: {
    marginBottom: 16,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '700',
    color: Colors.onPrimary,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: -1,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 40,
  },
  location: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
});
