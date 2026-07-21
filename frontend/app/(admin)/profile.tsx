import React, { useState, useEffect } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { pickAndUploadImage } from '../../src/hooks/useImageUpload';
import client from '../../src/api/client';
import { formatUserId } from '../../src/utils/formatId';

export default function AdminProfileScreen() {
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const [n, e, p, id, pic] = await Promise.all([
        AsyncStorage.getItem('name'),
        AsyncStorage.getItem('email'),
        AsyncStorage.getItem('phone'),
        AsyncStorage.getItem('userId'),
        AsyncStorage.getItem('profilePicture'),
      ]);
      if (n) setName(n);
      if (e) setEmail(e);
      if (p) setPhone(p);
      if (id) setUserId(id);
      if (pic) setProfilePicture(pic);
    }
    load();
  }, []);

  function getInitials(n: string) {
    return n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  }

  function handleAvatarPress() {
    const options: any[] = [
      { text: 'Choose from Library', onPress: uploadFromLibrary },
    ];
    if (profilePicture) {
      options.push({ text: 'Remove Photo', style: 'destructive', onPress: removePhoto });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile Picture', 'Choose an option', options);
  }

  async function uploadFromLibrary() {
    setUploading(true);
    try {
      const url = await pickAndUploadImage('profiles');
      await client.put('/auth/profile/picture', { url });
      await AsyncStorage.setItem('profilePicture', url);
      setProfilePicture(url);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setUploading(true);
    try {
      await client.put('/auth/profile/picture', { url: '' });
      await AsyncStorage.setItem('profilePicture', '');
      setProfilePicture('');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to remove photo');
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    // TOKENS (H6/M1): revoke the refresh token server-side, clear keychain + storage
    const { logoutServer } = await import('../../src/api/auth');
    const tokenStorage = await import('../../src/utils/tokenStorage');
    await logoutServer(await tokenStorage.getItem('refreshToken'));
    await tokenStorage.multiRemove(['token', 'refreshToken', 'role', 'userId', 'name', 'email', 'phone', 'profilePicture']);
    router.replace('/(auth)/welcome');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} activeOpacity={0.8}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(name)}</Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{name || 'Admin'}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} />
            <Text style={styles.roleText}>Administrator</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <InfoRow iconName="mail-outline" label="Email" value={email || '—'} />
          <InfoRow iconName="call-outline" label="Phone" value={phone || '—'} />
          <InfoRow iconName="finger-print-outline" label="Admin ID" value={userId ? formatUserId(userId) : '—'} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ iconName, label, value }: { iconName: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.infoRow}>
      <Ionicons name={iconName} size={20} color={Colors.primary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: { paddingBottom: 100 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { color: Colors.onPrimary, fontSize: 28, fontWeight: '700' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.surface },
  name: { fontSize: 22, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceContainerLow, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 5 },
  roleText: { fontSize: 16, color: Colors.primary, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  infoSection: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 4, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 17, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },
  logoutBtn: { marginHorizontal: 20, borderRadius: 12, backgroundColor: Colors.errorContainer, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  logoutText: { color: Colors.error, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});
