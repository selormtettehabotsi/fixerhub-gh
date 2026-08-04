import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { deleteAccount } from '../../src/api/auth';
import { updateMomoNetwork } from '../../src/api/workers';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { pickAndUploadImage } from '../../src/hooks/useImageUpload';
import client from '../../src/api/client';
import type { VerificationStatus } from '../../src/api/admin';
import { formatWorkerId } from '../../src/utils/formatId';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
import { currentUpdateLabel } from '../../src/utils/updates';
import ThemeSelector from '../../src/components/ThemeSelector';
import EditProfileModal from '../../src/components/EditProfileModal';
import ChangePasswordModal from '../../src/components/ChangePasswordModal';
import VerifyOtpModal from '../../src/components/VerifyOtpModal';
import * as WebBrowser from 'expo-web-browser';
import { initiateProSubscription, verifyProSubscription } from '../../src/api/payments';
import ReferralCard from '../../src/components/ReferralCard';
import { getVerificationStatus, VerificationStatus as ContactVerifStatus, VerifyChannel } from '../../src/api/auth';

interface WorkerProfile {
  id: number;
  skill?: string;
  plan?: string;
  planExpiresAt?: string;
  verified: boolean;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  // KYC document URLs are only needed by /worker/verification now.
  minPrice?: number;
  maxPrice?: number;
  pricingStyle?: string;
  momoNetwork?: string;
}


export default function WorkerProfileScreen() {
  const styles = useThemedStyles(makeStyles);
  const [name, setName]                     = useState('');
  const [email, setEmail]                   = useState('');
  const [phone, setPhone]                   = useState('');
  const [userId, setUserId]                 = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [uploading, setUploading]           = useState(false);

  // Worker-service profile (for verification data)
  const [workerProfile, setWorkerProfile]     = useState<WorkerProfile | null>(null);

  // KYC uploads live on /worker/verification — this screen only shows status.

  // Pricing
  const [minPrice, setMinPrice]           = useState('');
  const [maxPrice, setMaxPrice]           = useState('');
  const [savingPricing, setSavingPricing] = useState(false);

  // Mobile money network for payouts
  const [momoNetwork, setMomoNetwork]   = useState('MTN');
  // Guards the focus-refetch above. A ref (not state) because loadWorkerProfile
  // is a stable useCallback and would otherwise close over a stale value.
  const businessDirtyRef = useRef(false);
  // Business Settings: collapses verification/pricing/momo behind one button
  const [showBusinessSettings, setShowBusinessSettings] = useState(false);
  const [savingMomo, setSavingMomo]     = useState(false);

  // Delete account
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [contactVerif, setContactVerif] = useState<ContactVerifStatus | null>(null);
  const [verifyChannel, setVerifyChannel] = useState<VerifyChannel | null>(null);

  // SUBSCRIPTION: pending Pro purchase reference (awaiting "I've paid")
  const [proRef, setProRef] = useState<string | null>(null);
  const [proBusy, setProBusy] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword]   = useState('');
  const [deleting, setDeleting]               = useState(false);

  useEffect(() => {
    async function loadStorage() {
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
    loadStorage();
  }, []);

  const loadWorkerProfile = useCallback(async () => {
    const id = await AsyncStorage.getItem('userId');
    if (!id) return;
    try {
      const res = await client.get<WorkerProfile>(`/workers/by-user/${id}`);
      setWorkerProfile(res.data);
      // DON'T clobber edits in progress. This runs on every screen focus, so
      // typing a new price and then tabbing away (or coming back from the
      // verification screen / the Paystack browser) used to silently revert
      // the field to the saved value. Only seed the inputs when the worker
      // has nothing unsaved.
      if (!businessDirtyRef.current) {
        setMinPrice(res.data.minPrice != null ? String(res.data.minPrice) : '');
        setMaxPrice(res.data.maxPrice != null ? String(res.data.maxPrice) : '');
        if (res.data.momoNetwork) setMomoNetwork(res.data.momoNetwork);
      }
    } catch {
      // Silently ignore — don't block profile display
    }
    getVerificationStatus().then(setContactVerif).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { loadWorkerProfile(); }, [loadWorkerProfile]));

  // ─── Business Settings: unsaved-changes tracking ──────────────────────────
  // Derived by comparing the inputs to what the server last returned, rather
  // than hand-setting a flag in every onChange — one source of truth, and it
  // resets by itself once a save round-trips.
  const savedMin  = workerProfile?.minPrice != null ? String(workerProfile.minPrice) : '';
  const savedMax  = workerProfile?.maxPrice != null ? String(workerProfile.maxPrice) : '';
  const savedMomo = workerProfile?.momoNetwork ?? 'MTN';

  const pricingChanged = minPrice !== savedMin || maxPrice !== savedMax;
  const momoChanged    = momoNetwork !== savedMomo;
  const businessDirty  = pricingChanged || momoChanged;

  useEffect(() => {
    businessDirtyRef.current = pricingChanged || momoChanged;
  }, [pricingChanged, momoChanged]);

  function getInitials(n: string) {
    return n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  }

  // ─── Profile picture ──────────────────────────────────────────────────────

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
      // Update auth-service (source of truth for the user record)
      await client.put('/auth/profile/picture', { url });
      await AsyncStorage.setItem('profilePicture', url);
      setProfilePicture(url);
      // Sync to worker-service so the public worker profile shows the new picture
      const id = userId || await AsyncStorage.getItem('userId');
      if (id) {
        await client.put(`/workers/by-user/${id}/profile-picture`, { profilePicture: url });
      }
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
      const id = userId || await AsyncStorage.getItem('userId');
      if (id) {
        await client.put(`/workers/by-user/${id}/profile-picture`, { profilePicture: '' });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to remove photo');
    } finally {
      setUploading(false);
    }
  }

  async function handleSavePricing() {
    // Validate before sending — NaN used to silently save as null
    const min = minPrice.trim() ? parseFloat(minPrice) : null;
    const max = maxPrice.trim() ? parseFloat(maxPrice) : null;
    if ((minPrice.trim() && (min == null || isNaN(min) || min < 0)) ||
        (maxPrice.trim() && (max == null || isNaN(max) || max < 0))) {
      Alert.alert('Invalid Price', 'Please enter valid amounts (numbers only).');
      return;
    }
    if (min != null && max != null && min > max) {
      Alert.alert('Invalid Range', 'Minimum price cannot be higher than maximum price.');
      return;
    }
    setSavingPricing(true);
    try {
      const id = userId || await AsyncStorage.getItem('userId');
      await client.put(`/workers/by-user/${id}/pricing`, {
        minPrice: min,
        maxPrice: max,
      });
      await loadWorkerProfile();
      Alert.alert('Saved', 'Your pricing information has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save pricing');
    } finally {
      setSavingPricing(false);
    }
  }

  async function handleSaveMomo() {
    setSavingMomo(true);
    try {
      const id = userId || await AsyncStorage.getItem('userId');
      await updateMomoNetwork(id!, momoNetwork);
      // Refresh so the saved value becomes the new baseline — without this the
      // section stays marked "unsaved" forever after a successful save.
      await loadWorkerProfile();
      Alert.alert('Saved', 'Your mobile money network has been updated. Payouts will go to this number.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? err.message ?? 'Failed to save MoMo network');
    } finally {
      setSavingMomo(false);
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

  // ─── Verification status helpers ──────────────────────────────────────────

  type StatusInfo = { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string; bg: string };
  const statusConfig: Record<VerificationStatus, StatusInfo> = {
    NONE:               { icon: 'shield-outline',          label: 'Not Verified',      color: Colors.outline,   bg: Colors.surfaceContainerHigh },
    PENDING:            { icon: 'time-outline',            label: 'Under Review',       color: Colors.warning,   bg: 'rgba(245,124,0,0.1)' },
    APPROVED:           { icon: 'shield-checkmark',        label: 'Verified',           color: Colors.available, bg: 'rgba(46,125,50,0.1)' },
    DECLINED:           { icon: 'close-circle-outline',    label: 'Declined',           color: Colors.error,     bg: Colors.errorContainer },
    RESUBMIT_REQUESTED: { icon: 'refresh-circle-outline',  label: 'Resubmit Required',  color: Colors.warning,   bg: 'rgba(245,124,0,0.1)' },
  };

  const status = (workerProfile?.verificationStatus ?? 'NONE') as VerificationStatus;
  const statusInfo = statusConfig[status];
  const canSubmit  = status === 'NONE' || status === 'DECLINED' || status === 'RESUBMIT_REQUESTED';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
        </View>

        {/* ── Avatar ────────────────────────────────────────────────────── */}
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
          <Text style={styles.name}>{name || 'Worker'}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="construct-outline" size={14} color={Colors.primary} />
            <Text style={styles.roleText}>Worker</Text>
          </View>
        </View>

        {/* ── Info ──────────────────────────────────────────────────────── */}
        <View style={styles.infoSection}>
          <InfoRow iconName="mail-outline"        label="Email"     value={email  || '—'}
                   verified={contactVerif?.emailVerified} onVerify={() => setVerifyChannel('EMAIL')} />
          <InfoRow iconName="call-outline"        label="Phone"     value={phone  || '—'}
                   verified={contactVerif?.phoneVerified} onVerify={() => setVerifyChannel('PHONE')} />
          <InfoRow iconName="finger-print-outline" label="Worker ID" value={userId ? formatWorkerId(userId) : '—'} />
        </View>

        {/* ── Identity Verification ─────────────────────────────────────────
            Deliberately OUTSIDE the Business Settings accordion. The uploads
            live on /worker/verification; this row answers "am I verified?" at
            a glance, which is useless if it's hidden behind a collapse. */}
        <TouchableOpacity
          style={styles.verifyRow}
          onPress={() => router.push('/worker/verification')}
          activeOpacity={0.85}
        >
          <View style={[styles.verifyIcon, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon} size={20} color={statusInfo.color} />
          </View>
          <View style={styles.verifyTextCol}>
            <Text style={styles.verifyTitle}>Identity Verification</Text>
            <Text style={[styles.verifySub, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
          {canSubmit && <View style={styles.verifyDot} />}
          <Ionicons name="chevron-forward" size={18} color={Colors.outline} />
        </TouchableOpacity>

        {/* ── FixerHub Pro subscription ─────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="rocket-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>FixerHub Pro</Text>
        </View>
        <View style={styles.proCard}>
          {workerProfile?.plan === 'PRO' ? (
            <>
              <View style={styles.proActiveRow}>
                <View style={styles.proChip}><Text style={styles.proChipText}>PRO</Text></View>
                <Text style={styles.proActiveText}>
                  Active until {workerProfile.planExpiresAt
                    ? new Date(workerProfile.planExpiresAt).toLocaleDateString()
                    : '—'}
                </Text>
              </View>
              <Text style={styles.proDesc}>Lower commission, PRO badge, and priority in nearby results.</Text>
            </>
          ) : (
            <>
              <Text style={styles.proDesc}>
                Go Pro for GH₵30/month: pay less commission on every job, get a PRO badge
                customers trust, and rank higher in nearby search.
              </Text>
              {proRef == null ? (
                <TouchableOpacity
                  style={[styles.proBtn, proBusy && { opacity: 0.6 }]}
                  disabled={proBusy}
                  activeOpacity={0.85}
                  onPress={async () => {
                    setProBusy(true);
                    try {
                      const init = await initiateProSubscription();
                      setProRef(init.reference);
                      await WebBrowser.openBrowserAsync(init.authorizationUrl);
                    } catch (err: any) {
                      Alert.alert('Could not start checkout', err?.response?.data?.message ?? err?.message ?? 'Try again later');
                    } finally {
                      setProBusy(false);
                    }
                  }}
                >
                  {proBusy ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.proBtnText}>Go Pro — GH₵30 / month</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.proBtn, proBusy && { opacity: 0.6 }]}
                  disabled={proBusy}
                  activeOpacity={0.85}
                  onPress={async () => {
                    setProBusy(true);
                    try {
                      const res = await verifyProSubscription(proRef);
                      if (res.status === 'success') {
                        setProRef(null);
                        Alert.alert('Welcome to Pro!', 'Your Pro plan is active for the next 30 days.');
                        loadWorkerProfile();
                      } else {
                        Alert.alert('Not confirmed yet', 'Paystack reports: ' + res.status + '. Complete the payment, then try again.');
                      }
                    } catch (err: any) {
                      Alert.alert('Verification failed', err?.response?.data?.message ?? err?.message ?? 'Try again');
                    } finally {
                      setProBusy(false);
                    }
                  }}
                >
                  {proBusy ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.proBtnText}>I've paid — activate Pro</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Business Settings — pricing + MoMo payouts ─────────────────── */}
        <TouchableOpacity
          style={styles.businessBtn}
          onPress={() => setShowBusinessSettings((v) => !v)}
          activeOpacity={0.85}
        >
          <View style={styles.businessBtnLeft}>
            <View style={styles.businessBtnIcon}>
              <Ionicons name="briefcase-outline" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.businessBtnTitle}>Business Settings</Text>
              {/* Collapsing the section with unsaved edits inside would hide
                  them completely — say so on the closed header. */}
              <Text style={[styles.businessBtnSub, businessDirty && styles.businessBtnSubDirty]}>
                {businessDirty ? 'You have unsaved changes' : 'Price range · MoMo payouts'}
              </Text>
            </View>
          </View>
          {businessDirty && <View style={styles.dirtyDot} />}
          <Ionicons name={showBusinessSettings ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.outline} />
        </TouchableOpacity>

        {showBusinessSettings && (<>

        {/* ── Pricing ───────────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="pricetag-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Typical Job Price Range (GHS)</Text>
        </View>

        <View style={styles.pricingCard}>
          <View style={styles.priceRow}>
            <View style={styles.priceField}>
              <Text style={styles.priceLabel}>Min</Text>
              <TextInput
                style={styles.priceInput}
                value={minPrice}
                onChangeText={setMinPrice}
                placeholder="50"
                placeholderTextColor={Colors.outline}
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.priceDash}>—</Text>
            <View style={styles.priceField}>
              <Text style={styles.priceLabel}>Max</Text>
              <TextInput
                style={styles.priceInput}
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="500"
                placeholderTextColor={Colors.outline}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Disabled until something actually changes, so "Save" always means
              there is something to save. */}
          <TouchableOpacity
            style={[styles.savePricingBtn, (savingPricing || !pricingChanged) && styles.submitBtnDisabled]}
            onPress={handleSavePricing}
            disabled={savingPricing || !pricingChanged}
            activeOpacity={0.85}
          >
            {savingPricing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {pricingChanged ? 'Save Pricing' : 'Pricing saved'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Mobile Money for Payouts ─────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="phone-portrait-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Mobile Money for Payouts</Text>
        </View>

        <View style={styles.momoCard}>
          <Text style={styles.momoIntro}>
            After each completed job, FixerHub will automatically transfer your earnings to your registered phone number.
          </Text>

          <View style={styles.momoPhoneRow}>
            <Ionicons name="call-outline" size={18} color={Colors.primary} />
            <Text style={styles.momoPhoneText}>{phone || 'No phone number on file'}</Text>
          </View>

          <Text style={styles.momoNetworkLabel}>Select your network</Text>

          {(['MTN', 'VODAFONE', 'AIRTELTIGO'] as const).map((network) => {
            const labels: Record<string, string> = {
              MTN: 'MTN MoMo',
              VODAFONE: 'Vodafone Cash',
              AIRTELTIGO: 'AirtelTigo Money',
            };
            const isSelected = momoNetwork === network;
            return (
              <TouchableOpacity
                key={network}
                style={[styles.momoOption, isSelected && styles.momoOptionActive]}
                onPress={() => setMomoNetwork(network)}
                activeOpacity={0.7}
              >
                <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.momoOptionLabel, isSelected && styles.momoOptionLabelActive]}>
                  {labels[network]}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.savePricingBtn, (savingMomo || !momoChanged) && styles.submitBtnDisabled]}
            onPress={handleSaveMomo}
            disabled={savingMomo || !momoChanged}
            activeOpacity={0.85}
          >
            {savingMomo ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {momoChanged ? 'Save MoMo Network' : 'Network saved'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        </>)}
        {/* ── end Business Settings ─────────────────────────────────────── */}

        {/* ── Referrals ─────────────────────────────────────────────────── */}
        <ReferralCard />

        {/* ── Appearance ────────────────────────────────────────────────── */}
        <ThemeSelector />

        {/* ── Support menu ──────────────────────────────────────────────── */}
        <View style={styles.menuSection}>
          <MenuRow iconName="create-outline" label="Edit Profile" onPress={() => setShowEditProfile(true)} />
          <View style={styles.menuDivider} />
          <MenuRow iconName="key-outline" label="Change Password" onPress={() => setShowChangePassword(true)} />
          <View style={styles.menuDivider} />
          <MenuRow iconName="flag-outline" label="Report an Issue" onPress={() => router.push('/report')} />
          <View style={styles.menuDivider} />
          <MenuRow iconName="help-circle-outline" label="Help Centre" onPress={() => router.push('/help')} />
        </View>

        {/* ── Sign Out ──────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccountBtn} onPress={() => { setDeletePassword(''); setShowDeleteModal(true); }} activeOpacity={0.85}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
          <Text style={styles.deleteAccountBtnText}>Delete Account</Text>
        </TouchableOpacity>

        {/* BUILD LABEL — see the customer profile: tells an OTA update apart
            from the bundle baked into the APK, without needing adb. */}
        <Text style={styles.buildLabel}>{currentUpdateLabel()}</Text>
      </ScrollView>

      {/* Edit profile modal */}
      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        workerUserId={userId || null}
        initialSkill={workerProfile?.skill ?? ''}
        onSaved={(u) => {
          setName(u.name);
          setEmail(u.email);
          setPhone(u.phone);
          loadWorkerProfile(); // refresh skill + synced contact info + badges
          // Changed contact info is un-verified server-side — prompt the user
          // to verify the NEW email/number right away.
          const channel = u.emailChanged ? 'EMAIL' : u.phoneChanged ? 'PHONE' : null;
          if (channel) setTimeout(() => setVerifyChannel(channel), 500);
        }}
      />

      {/* Change password modal */}
      <ChangePasswordModal visible={showChangePassword} onClose={() => setShowChangePassword(false)} />

      {/* Verify email / phone modal */}
      {verifyChannel && (
        <VerifyOtpModal
          visible
          channel={verifyChannel}
          target={verifyChannel === 'EMAIL' ? email : phone}
          onClose={() => setVerifyChannel(null)}
          onVerified={setContactVerif}
        />
      )}

      {/* Delete account modal */}
      <Modal visible={showDeleteModal} transparent animationType="slide" onRequestClose={() => setShowDeleteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.deleteModalBg}>
          <TouchableOpacity style={styles.deleteModalDismiss} activeOpacity={1} onPress={() => setShowDeleteModal(false)} />
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalHandle} />
            <View style={{ alignSelf: 'center', marginBottom: 12 }}>
              <Ionicons name="warning-outline" size={32} color={Colors.error} />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Account?</Text>
            <Text style={styles.deleteModalSub}>
              This will permanently delete your worker profile, bookings, and account. This cannot be undone.
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

// ─── InfoRow ─────────────────────────────────────────────────────────────────

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
        <View style={styles.verifiedBadgeRow}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.available} />
          <Text style={styles.verifiedRowText}>Verified</Text>
        </View>
      )}
      {verified === false && onVerify && (
        <TouchableOpacity style={styles.verifyRowBtn} onPress={onVerify} activeOpacity={0.8}>
          <Text style={styles.verifyRowBtnText}>Verify</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── MenuRow ─────────────────────────────────────────────────────────────────

function MenuRow({ iconName, label, onPress }: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={iconName} size={20} color={Colors.primary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.outline} />
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: { paddingBottom: 100 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },

  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { color: Colors.onPrimary, fontSize: 28, fontWeight: '700' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.surface },
  name: { fontSize: 22, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceContainerLow, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 5 },
  roleText: { fontSize: 16, color: Colors.primary, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  // Info section
  infoSection: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 4, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  infoContent: { flex: 1 },
  verifiedBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedRowText: { fontSize: 11.5, color: Colors.available, fontFamily: 'Inter_600SemiBold' },
  verifyRowBtn: { backgroundColor: Colors.primaryFixed, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  verifyRowBtnText: { fontSize: 12, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  infoLabel: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 17, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10 },

  // FixerHub Pro subscription card
  proCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.outlineVariant },
  proActiveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  proChip: { backgroundColor: Colors.primary, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2 },
  proChipText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  proActiveText: { fontSize: 14, color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  proDesc: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 12 },
  proBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  proBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },

  // Status badge
  // Verification: a status row that navigates to /worker/verification
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  // Business Settings: unsaved-changes signals
  businessBtnSubDirty: { color: Colors.warning },
  dirtyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning, marginRight: 8 },

  verifyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  verifyTextCol: { flex: 1 },
  verifyTitle: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  verifySub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  // Nudge dot — only while there's something for the worker to do
  verifyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginRight: 4 },

  // Docs card

  // Doc slot row




  submitBtnDisabled: { backgroundColor: Colors.surfaceContainerHigh },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },

  // Read-only thumbs

  // Pricing
  pricingCard: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16, marginBottom: 24, gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  priceField: { flex: 1 },
  priceLabel: { fontSize: 12, color: Colors.outline, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  priceInput: { height: 48, borderWidth: 1.5, borderColor: Colors.surfaceContainerHigh, borderRadius: 10, paddingHorizontal: 14, fontSize: 16, color: Colors.onSurface, fontFamily: 'Inter_500Medium', backgroundColor: Colors.surface },
  priceDash: { fontSize: 20, color: Colors.outline, marginTop: 20 },
  pricingStyleLabel: { fontSize: 14, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: Colors.surfaceContainerHigh, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8 },
  radioRowActive: { borderColor: Colors.primary, backgroundColor: 'rgba(98,0,238,0.04)' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.outline, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  radioLabel: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  radioLabelActive: { color: Colors.primary, fontWeight: '600' },

  savePricingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, marginTop: 8 },

  // Mobile money section
  momoCard: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16, marginBottom: 24, gap: 4 },
  momoIntro: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 10 },
  momoPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceContainerHigh, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  momoPhoneText: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },
  momoNetworkLabel: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  businessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,   // align with the other profile cards
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  businessBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  businessBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessBtnTitle: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  businessBtnSub: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },
  momoOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: Colors.surfaceContainerHigh, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8 },
  momoOptionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(98,0,238,0.04)' },
  momoOptionLabel: { flex: 1, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  momoOptionLabelActive: { color: Colors.primary, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  menuSection: { marginHorizontal: 20, marginBottom: 8, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, overflow: 'hidden' },
  menuDivider: { height: 1, backgroundColor: Colors.surfaceContainerHigh, marginHorizontal: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  menuLabel: { flex: 1, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },

  buildLabel: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
  },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.error },
  logoutText: { fontSize: 15, color: Colors.error, fontFamily: 'Inter_600SemiBold' },

  // Delete account button
  deleteAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 4, marginBottom: 40, paddingVertical: 14 },
  deleteAccountBtnText: { color: Colors.error, fontSize: 14, fontFamily: 'Inter_400Regular', textDecorationLine: 'underline' },

  // Delete account modal
  deleteModalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  deleteModalDismiss: { flex: 1 },
  deleteModalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  deleteModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceContainerHigh, alignSelf: 'center', marginBottom: 20 },
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