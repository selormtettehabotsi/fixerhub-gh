import React, { useState, useEffect, useCallback } from 'react';
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
import { pickAndUploadImage, pickAndUploadDocument } from '../../src/hooks/useImageUpload';
import client from '../../src/api/client';
import type { VerificationStatus } from '../../src/api/admin';
import { formatWorkerId } from '../../src/utils/formatId';
import { cloudinaryThumb } from '../../src/utils/imageUrl';

interface WorkerProfile {
  id: number;
  verified: boolean;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  headshotUrl?: string;
  minPrice?: number;
  maxPrice?: number;
  pricingStyle?: string;
  momoNetwork?: string;
}


export default function WorkerProfileScreen() {
  const [name, setName]                     = useState('');
  const [email, setEmail]                   = useState('');
  const [phone, setPhone]                   = useState('');
  const [userId, setUserId]                 = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [uploading, setUploading]           = useState(false);

  // Worker-service profile (for verification data)
  const [workerProfile, setWorkerProfile]     = useState<WorkerProfile | null>(null);

  // KYC upload states
  const [uploadingIdFront, setUploadingIdFront]   = useState(false);
  const [uploadingIdBack, setUploadingIdBack]     = useState(false);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [idFrontUrl, setIdFrontUrl]     = useState('');
  const [idBackUrl, setIdBackUrl]       = useState('');
  const [headshotUrl, setHeadshotUrl]   = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // Pricing
  const [minPrice, setMinPrice]           = useState('');
  const [maxPrice, setMaxPrice]           = useState('');
  const [savingPricing, setSavingPricing] = useState(false);

  // Mobile money network for payouts
  const [momoNetwork, setMomoNetwork]   = useState('MTN');
  // Business Settings: collapses verification/pricing/momo behind one button
  const [showBusinessSettings, setShowBusinessSettings] = useState(false);
  const [savingMomo, setSavingMomo]     = useState(false);

  // Full-screen image viewer
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  // Delete account
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
      setIdFrontUrl(res.data.idFrontUrl ?? '');
      setIdBackUrl(res.data.idBackUrl ?? '');
      setHeadshotUrl(res.data.headshotUrl ?? '');
      if (res.data.minPrice != null) setMinPrice(String(res.data.minPrice));
      if (res.data.maxPrice != null) setMaxPrice(String(res.data.maxPrice));
      if (res.data.momoNetwork) setMomoNetwork(res.data.momoNetwork);
    } catch {
      // Silently ignore — don't block profile display
    }
  }, []);

  useFocusEffect(useCallback(() => { loadWorkerProfile(); }, [loadWorkerProfile]));

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

  // ─── KYC document uploads ─────────────────────────────────────────────────

  async function uploadDoc(
    setter: (url: string) => void,
    loadingSetter: (v: boolean) => void,
    folder: string,
    isHeadshot = false,
  ) {
    loadingSetter(true);
    try {
      const url = isHeadshot
        ? await pickAndUploadImage(folder)
        : await pickAndUploadDocument(folder);
      setter(url);
    } catch (err: any) {
      if (!err.message?.includes('No image')) {
        Alert.alert('Upload Error', err.message ?? 'Upload failed');
      }
    } finally {
      loadingSetter(false);
    }
  }

  async function handleSubmitVerification() {
    if (!idFrontUrl || !idBackUrl || !headshotUrl) {
      Alert.alert('Missing Photos', 'Please upload all three photos before submitting.');
      return;
    }
    if (!workerProfile?.id) {
      Alert.alert('Error', 'Could not find your worker profile. Please try again.');
      return;
    }
    Alert.alert(
      'Submit for Verification',
      'Send your ID photos and headshot to admin for review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              await client.post(`/workers/${workerProfile.id}/verification/submit`, {
                idFrontUrl,
                idBackUrl,
                headshotUrl,
              });
              await loadWorkerProfile();
              Alert.alert('Submitted!', 'Your documents are being reviewed. You will hear back once approved.');
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Submission failed');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
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
      Alert.alert('Saved', 'Your mobile money network has been updated. Payouts will go to this number.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? err.message ?? 'Failed to save MoMo network');
    } finally {
      setSavingMomo(false);
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
          <InfoRow iconName="mail-outline"        label="Email"     value={email  || '—'} />
          <InfoRow iconName="call-outline"        label="Phone"     value={phone  || '—'} />
          <InfoRow iconName="finger-print-outline" label="Worker ID" value={userId ? formatWorkerId(userId) : '—'} />
        </View>

        {/* ── Business Settings — verification, pricing, MoMo payouts ────── */}
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
              <Text style={styles.businessBtnSub}>Verification · Price range · MoMo payouts</Text>
            </View>
          </View>
          <Ionicons name={showBusinessSettings ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.outline} />
        </TouchableOpacity>

        {showBusinessSettings && (<>

        {/* ── Identity Verification ─────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="id-card-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Identity Verification</Text>
        </View>

        {/* Verification status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon} size={22} color={statusInfo.color} />
          <View style={styles.statusTextCol}>
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            {status === 'APPROVED' && (
              <Text style={styles.statusSub}>You are verified and trusted by FixerHub customers</Text>
            )}
            {status === 'PENDING' && (
              <Text style={styles.statusSub}>Our team is reviewing your documents — check back soon</Text>
            )}
            {(status === 'DECLINED' || status === 'RESUBMIT_REQUESTED') && workerProfile?.verificationNote && (
              <Text style={styles.statusSub}>Admin note: {workerProfile.verificationNote}</Text>
            )}
            {status === 'NONE' && (
              <Text style={styles.statusSub}>Verified workers appear higher in search results and earn customer trust</Text>
            )}
          </View>
        </View>

        {/* Upload slots — only when worker can (re)submit */}
        {canSubmit && (
          <View style={styles.docsCard}>
            <Text style={styles.docsIntro}>
              {status === 'NONE'
                ? 'Upload your National ID (front & back) and a clear passport-style headshot.'
                : 'Please upload new, clearer photos and resubmit for review.'}
            </Text>

            <DocSlot
              label="National ID — Front"
              sublabel="Front side of Ghana Card or Passport"
              icon="card-outline"
              url={idFrontUrl}
              loading={uploadingIdFront}
              onUpload={() => uploadDoc(setIdFrontUrl, setUploadingIdFront, 'kyc-id', false)}
              onView={() => idFrontUrl && setViewerUri(idFrontUrl)}
            />
            <DocSlot
              label="National ID — Back"
              sublabel="Back side of Ghana Card"
              icon="card-outline"
              url={idBackUrl}
              loading={uploadingIdBack}
              onUpload={() => uploadDoc(setIdBackUrl, setUploadingIdBack, 'kyc-id', false)}
              onView={() => idBackUrl && setViewerUri(idBackUrl)}
            />
            <DocSlot
              label="Headshot / Passport Photo"
              sublabel="Clear, well-lit face photo — no hats or shades"
              icon="person-circle-outline"
              url={headshotUrl}
              loading={uploadingHeadshot}
              onUpload={() => uploadDoc(setHeadshotUrl, setUploadingHeadshot, 'kyc-headshot', true)}
              onView={() => headshotUrl && setViewerUri(headshotUrl)}
            />

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!idFrontUrl || !idBackUrl || !headshotUrl || submitting) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmitVerification}
              disabled={!idFrontUrl || !idBackUrl || !headshotUrl || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit for Verification</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Read-only thumbnails when PENDING or APPROVED */}
        {(status === 'PENDING' || status === 'APPROVED') && workerProfile?.idFrontUrl && (
          <View style={styles.docsCard}>
            <Text style={styles.docsIntro}>Your submitted documents:</Text>
            <View style={styles.thumbRow}>
              <Thumb label="ID Front"  uri={workerProfile.idFrontUrl!}  onView={setViewerUri} />
              <Thumb label="ID Back"   uri={workerProfile.idBackUrl!}   onView={setViewerUri} />
              <Thumb label="Headshot"  uri={workerProfile.headshotUrl!} onView={setViewerUri} />
            </View>
          </View>
        )}

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

          <TouchableOpacity
            style={[styles.savePricingBtn, savingPricing && styles.submitBtnDisabled]}
            onPress={handleSavePricing}
            disabled={savingPricing}
            activeOpacity={0.85}
          >
            {savingPricing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Save Pricing</Text>
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
            style={[styles.savePricingBtn, savingMomo && styles.submitBtnDisabled]}
            onPress={handleSaveMomo}
            disabled={savingMomo}
            activeOpacity={0.85}
          >
            {savingMomo ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Save MoMo Network</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        </>)}
        {/* ── end Business Settings ─────────────────────────────────────── */}

        {/* ── Support menu ──────────────────────────────────────────────── */}
        <View style={styles.menuSection}>
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
      </ScrollView>

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

      {/* Full-screen image viewer */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setViewerUri(null)} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.modalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────

function InfoRow({ iconName, label, value }: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
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

// ─── MenuRow ─────────────────────────────────────────────────────────────────

function MenuRow({ iconName, label, onPress }: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={iconName} size={20} color={Colors.primary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.outline} />
    </TouchableOpacity>
  );
}

// ─── DocSlot ─────────────────────────────────────────────────────────────────

function DocSlot({ label, sublabel, icon, url, loading, onUpload, onView }: {
  label: string;
  sublabel: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  url: string;
  loading: boolean;
  onUpload: () => void;
  onView: () => void;
}) {
  return (
    <View style={styles.docSlot}>
      <View style={styles.docSlotInfo}>
        <Ionicons name={icon} size={20} color={url ? Colors.available : Colors.outline} />
        <View style={{ flex: 1 }}>
          <Text style={styles.docSlotLabel}>{label}</Text>
          <Text style={styles.docSlotSub}>{sublabel}</Text>
        </View>
      </View>
      <View style={styles.docSlotActions}>
        {url ? (
          <>
            <TouchableOpacity onPress={onView} style={styles.previewThumb} activeOpacity={0.8}>
              <Image source={{ uri: url }} style={styles.previewImg} />
              <View style={styles.previewOverlay}>
                <Ionicons name="eye-outline" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onUpload} style={styles.retakeBtn} activeOpacity={0.8} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="refresh-outline" size={16} color={Colors.primary} />}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={onUpload} style={styles.uploadBtn} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={16} color={Colors.primary} />
                <Text style={styles.uploadBtnText}>Upload</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Thumb ───────────────────────────────────────────────────────────────────

function Thumb({ label, uri, onView }: { label: string; uri: string; onView: (u: string) => void }) {
  return (
    <TouchableOpacity style={styles.thumb} onPress={() => onView(uri)} activeOpacity={0.8}>
      <Image source={{ uri }} style={styles.thumbImg} />
      <Text style={styles.thumbLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  infoLabel: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 17, color: Colors.onSurface, fontFamily: 'Inter_500Medium' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },

  // Status badge
  statusBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 20, borderRadius: 12, padding: 14, marginBottom: 16 },
  statusTextCol: { flex: 1 },
  statusLabel: { fontSize: 15, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  statusSub: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  // Docs card
  docsCard: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16, marginBottom: 20, gap: 2 },
  docsIntro: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 8 },

  // Doc slot row
  docSlot: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.surfaceContainerHigh },
  docSlotInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  docSlotLabel: { fontSize: 14, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  docSlotSub: { fontSize: 12, color: Colors.outline, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  docSlotActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  uploadBtnText: { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },

  previewThumb: { width: 52, height: 36, borderRadius: 6, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  previewOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },

  retakeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  submitBtnDisabled: { backgroundColor: Colors.surfaceContainerHigh },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },

  // Read-only thumbs
  thumbRow: { flexDirection: 'row', gap: 10 },
  thumb: { flex: 1, alignItems: 'center', gap: 4 },
  thumbImg: { width: '100%', aspectRatio: 1.4, borderRadius: 8, backgroundColor: Colors.surfaceContainerHigh },
  thumbLabel: { fontSize: 11, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  modalImage: { width: '95%', height: '70%' },
});