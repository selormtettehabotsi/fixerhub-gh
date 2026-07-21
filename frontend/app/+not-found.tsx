import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../src/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';

export default function NotFound() {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.container}>
      <Ionicons name="alert-circle-outline" size={52} color={Colors.outline} />
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.subtitle}>This screen doesn't exist.</Text>
      <TouchableOpacity onPress={() => router.replace('/')} style={styles.btn}>
        <Text style={styles.btnText}>Go Home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, padding: 24 },
  icon: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 28 },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  btnText: { color: Colors.onPrimary, fontSize: 15, fontWeight: '700' },
});
