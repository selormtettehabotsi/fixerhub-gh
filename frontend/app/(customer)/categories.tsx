import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';

const CATEGORIES: { iconName: React.ComponentProps<typeof Ionicons>['name']; label: string; skill: string; desc: string }[] = [
  { iconName: 'water-outline', label: 'Plumbing', skill: 'Plumbing', desc: 'Pipe repairs, installations & more' },
  { iconName: 'flash-outline', label: 'Electrical', skill: 'Electrical', desc: 'Wiring, fixtures & power issues' },
  { iconName: 'hammer-outline', label: 'Carpentry', skill: 'Carpentry', desc: 'Furniture, woodwork & structures' },
  { iconName: 'color-palette-outline', label: 'Painting', skill: 'Painting', desc: 'Interior & exterior painting' },
  { iconName: 'brush-outline', label: 'Cleaning', skill: 'Cleaning', desc: 'Home & office cleaning services' },
  { iconName: 'flame-outline', label: 'Welding', skill: 'Welding', desc: 'Metal work & fabrication' },
  { iconName: 'layers-outline', label: 'Mason', skill: 'Mason', desc: 'Bricklaying & concrete work' },
  { iconName: 'home-outline', label: 'General', skill: 'General', desc: 'Handyman & general repairs' },
];

export default function CategoriesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Service Categories</Text>
        <Text style={styles.subtitle}>Choose a service to find available workers</Text>
      </View>
      <FlatList
        data={CATEGORIES}
        numColumns={2}
        keyExtractor={(item) => item.skill}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/(customer)/home', params: { skill: item.skill } })}
            activeOpacity={0.85}
          >
            <View style={styles.iconCircle}>
              <Ionicons name={item.iconName} size={32} color={Colors.primary} />
            </View>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  grid: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 18,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardLabel: { fontSize: 17, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 },
  cardDesc: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
