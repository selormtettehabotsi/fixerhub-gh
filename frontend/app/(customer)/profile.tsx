import React, { useState, useEffect } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { pickAndUploadImage } from '../../src/hooks/useImageUpload';
import client from '../../src/api/client';
import { formatUserId } from '../../src/utils/formatId';
import { deleteAccount, getVerificationStatus, VerificationStatus, VerifyChannel } from '../../src/api/auth';
import VerifyOtpModal from '../../src/components/VerifyOtpModal';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
import UpdateChecker from '../../src/components/UpdateChecker';
import ThemeSelector from '../../src/components/ThemeSelector';
import EditProfileModal from '../../src/components/EditProfileModal';
import ChangePasswordModal from '../../src/components/ChangePasswordModal';
import ReferralCard from '../../src/components/ReferralCard';

export default function CustomerProfile() {
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [verifStatus, setVerifStatus] = useState<VerificationStatus | null>(null);
  const [verifyChannel, setVerifyChannel] = useState<VerifyChannel | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

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
    getVerificationStatus().then(setVerifStatus).catch(() => {});
  }, []);

  function getInitials(n: string) {
    return n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  }

  function handleChangePicture() {
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
    // Local wipe first, server revocation in the background — see utils/signOut.
    const { signOut } = await import('../../src/utils/signOut');
    await signOut();
    router.replace('/(auth)/welcome');
  }

  async function handleDeleteAccount() {
    if (!deletePassword.trim()) {
      Alert.alert('Password required', 'Please enter your password to confirm deletion.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePassword.trim());
      setShowDeleteModal(false);
      const tokenStorage = await import('../../src/utils/tokenStorage');
      await tokenStorage.multiRemove(['token', 'refreshToken', 'role', 'userId', 'name', 'email', 'phone', 'profilePicture']);
      Alert.alert('Account Deleted', 'Your account has been permanently deleted.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/welcome') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? err?.message ?? 'Could not delete account.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handleChangePicture} activeOpacity={0.8}>
            {profilePicture ? (
              <Image source={{ uri: cloudinaryThumb(profilePicture, 120) }} style={styles.avatarImage} />
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
          <Text style={styles.name}>{name || 'Customer'}</Text>
          <Text style={styles.role}>Customer</Text>
        </View>

        {/* STRUCTURE. Previously this screen was one undifferentiated run of
            rows — identity, referrals, theme, support and destructive actions
            all with equal weight, so "Delete Account" sat two taps from "Help
            Centre" with nothing to separate them. Labelled sections give the
            page a shape you can scan, and put the irreversible actions in
            their own clearly-marked block at the end. */}

        <SectionTitle text="Your details" />
        <View style={styles.infoSection}>
          <InfoRow iconName="mail-outline" label="Email" value={email || '—'}
                   verified={verifStatus?.emailVerified} onVerify={() => setVerifyChannel('EMAIL')} />
          <InfoRow iconName="call-outline" label="Phone" value={phone || '—'}
                   verified={verifStatus?.phoneVerified} onVerify={() => setVerifyChannel('PHONE')} />
          <InfoRow iconName="finger-print-outline" label="User ID" value={userId ? formatUserId(userId) : '—'} />
        </View>

        <SectionTitle text="Account" />
        <View style={styles.menuSection}>
          <MenuRow iconName="create-outline" label="Edit Profile" onPress={() => setShowEditProfile(true)} />
          <View style={styles.menuDivider} />
          <MenuRow iconName="key-outline" label="Change Password" onPress={() => setShowChangePassword(true)} />
        </View>

        <SectionTitle text="Rewards" />
        <ReferralCard />

        <SectionTitle text="Preferences" />
        <ThemeSelector />

        <SectionTitle text="Support" />
        <View style={styles.menuSection}>
          <MenuRow iconName="help-circle-outline" label="Help Centre" onPress={() => router.push('/help')} />
          <View style={styles.menuDivider} />
          <MenuRow iconName="flag-outline" label="Report an Issue" onPress={() => router.push('/report')} />
        </View>

        <SectionTitle text="Legal" />
        <View style={styles.menuSection}>
          <MenuRow
            iconName="document-text-outline"
            label="Terms of Service"
            onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            iconName="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
          />
        </View>

        <SectionTitle text="App" />
        {/* Manual update + the bundle currently running. The automatic check at
            launch covers most cases; this is for "a fix went out, get it now". */}
        <UpdateChecker />

        {/* Everything below is either the end of a session or irreversible, so
            it's fenced off rather than sitting in the same list as Help. */}
        <SectionTitle text="Account actions" />
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => { setDeletePassword(''); setShowDeleteModal(true); }} activeOpacity={0.85}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>
        <Text style={styles.dangerHint}>
          Deleting your account is permanent. Your bookings and messages can't be recovered.
        </Text>
      </ScrollView>

      {/* ── Edit profile modal ────────────────────────────────────────── */}
      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        onSaved={(u) => {
          setName(u.name);
          setEmail(u.email);
          setPhone(u.phone);
          // Changed contact info is un-verified server-side — refresh badges
          // and prompt the user to verify the NEW email/number right away.
          getVerificationStatus().then(setVerifStatus).catch(() => {});
          const channel = u.emailChanged ? 'EMAIL' : u.phoneChanged ? 'PHONE' : null;
          if (channel) setTimeout(() => setVerifyChannel(channel), 500);
        }}
      />

      {/* ── Change password modal ─────────────────────────────────────── */}
      <ChangePasswordModal visible={showChangePassword} onClose={() => setShowChangePassword(false)} />

      {/* ── Verify email / phone modal ────────────────────────────────── */}
      {verifyChannel && (
        <VerifyOtpModal
          visible
          channel={verifyChannel}
          target={verifyChannel === 'EMAIL' ? email : phone}
          onClose={() => setVerifyChannel(null)}
          onVerified={setVerifStatus}
        />
      )}

      {/* ── Delete account modal ──────────────────────────────────────── */}
      <Modal visible={showDeleteModal} transparent animationType="slide" onRequestClose={() => setShowDeleteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.deleteModalBg}>
          <TouchableOpacity style={styles.deleteModalDismiss} activeOpacity={1} onPress={() => setShowDeleteModal(false)} />
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalHandle} />
            <View style={styles.deleteModalIconWrap}>
              <Ionicons name="warning-outline" size={32} color={Colors.error} />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Account?</Text>
            <Text style={styles.deleteModalSub}>
              This will permanently delete your account and all your booking history. This cannot be undone.
            </Text>
            <Text style={styles.deleteModalLabel}>Enter your password to confirm</Text>
            <View style={styles.deleteInputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.outline} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.deleteInput}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Your password"
                placeholderTextColor={Colors.outline}
                secureTextEntry
                autoFocus
              />
            </View>
            <View style={styles.deleteModalBtns}>
              <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setShowDeleteModal(false)} disabled={deleting}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteConfirmBtn, deleting && { opacity: 0.6 }]} onPress={handleDeleteAccount} disabled={deleting} activeOpacity={0.85}>
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.deleteConfirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/** Small uppercase label that introduces each group of rows. */
function SectionTitle({ text }: { text: string }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function MenuRow({ iconName, label, onPress }: { iconName: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={iconName} size={20} color={Colors.primary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.outline} />
    </TouchableOpacity>
  );
}

function InfoRow({ iconName, label, value, verified, onVerify }: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  /** VERIFICATION badge: true = verified tick, false = "Verify" button, undefined = nothing */
  verified?: boolean;
  onVerify?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.infoRow}>
      <Ionicons name={iconName} size={20} color={Colors.primary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {verified === true && (
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.available} />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      )}
      {verified === false && onVerify && (
        <TouchableOpacity style={styles.verifyBtn} onPress={onVerify} activeOpacity={0.8}>
          <Text style={styles.verifyBtnText}>Verify</Text>
        </TouchableOpacity>
      )}
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
  name: { fontSize: 22, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 },
  role: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', backgroundColor: Colors.surfaceContainerLow, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12 },
  // Section headings carry the vertical rhythm now, so the blocks themselves
  // sit tighter (24 -> 14) and the gap above a heading does the separating.
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_600SemiBold',
    marginHorizontal: 24,
    marginTop: 18,
    marginBottom: 8,
  },
  dangerHint: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginHorizontal: 32,
    marginTop: 10,
  },
  infoSection: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 4, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  infoContent: { flex: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 11.5, color: Colors.available, fontFamily: 'Inter_600SemiBold' },
  verifyBtn: { backgroundColor: Colors.primaryFixed, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  verifyBtnText: { fontSize: 12, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  infoLabel: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 17, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },
  menuSection: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, marginBottom: 14, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuLabel: { flex: 1, fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },
  menuDivider: { height: 1, backgroundColor: Colors.surfaceContainerHigh, marginLeft: 50 },
  logoutBtn: { marginHorizontal: 20, borderRadius: 12, backgroundColor: Colors.errorContainer, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  logoutText: { color: Colors.error, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  deleteBtn: { marginHorizontal: 20, marginTop: 12, marginBottom: 40, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  deleteBtnText: { color: Colors.error, fontSize: 14, fontFamily: 'Inter_400Regular', textDecorationLine: 'underline' },
  // Delete modal
  deleteModalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  deleteModalDismiss: { flex: 1 },
  deleteModalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  deleteModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceContainerHigh, alignSelf: 'center', marginBottom: 20 },
  deleteModalIconWrap: { alignSelf: 'center', marginBottom: 12 },
  deleteModalTitle: { fontSize: 20, fontWeight: '700', color: Colors.error, fontFamily: 'PlusJakartaSans_700Bold', textAlign: 'center', marginBottom: 8 },
  deleteModalSub: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  deleteModalLabel: { fontSize: 14, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  deleteInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerHighest, borderRadius: 10, paddingHorizontal: 14, height: 48, marginBottom: 20 },
  deleteInput: { flex: 1, fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  deleteModalBtns: { flexDirection: 'row', gap: 10 },
  deleteCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.outline, alignItems: 'center' },
  deleteCancelText: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  deleteConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.error, alignItems: 'center' },
  deleteConfirmText: { fontSize: 15, color: '#fff', fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});
