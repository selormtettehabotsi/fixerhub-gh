import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { pickAndUploadImage, pickAndUploadDocument } from '../../src/hooks/useImageUpload';
import client from '../../src/api/client';
import type { VerificationStatus } from '../../src/api/admin';

/**
 * KYC VERIFICATION — its own screen.
 *
 * This used to live at the bottom of the worker profile screen, INSIDE the
 * collapsed "Business Settings" accordion. That put the single most valuable
 * action a new worker can take (verified workers are the only ones visible to
 * customers who filter for verified) three interactions deep on a 1,000-line
 * screen. It is now a destination in its own right, reached from a status card
 * on the dashboard as well as from the profile.
 *
 * Deliberately NOT part of signup: it needs photos of a Ghana Card plus a
 * headshot, which most people can't produce during registration.
 */

interface WorkerProfile {
  id: number;
  verified: boolean;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  headshotUrl?: string;
}

export default function WorkerVerificationScreen() {
  const styles = useThemedStyles(makeStyles);

  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [uploadingIdFront, setUploadingIdFront] = useState(false);
  const [uploadingIdBack, setUploadingIdBack] = useState(false);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [idFrontUrl, setIdFrontUrl] = useState('');
  const [idBackUrl, setIdBackUrl] = useState('');
  const [headshotUrl, setHeadshotUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const loadWorkerProfile = useCallback(async () => {
    const id = await AsyncStorage.getItem('userId');
    if (!id) return;
    try {
      const res = await client.get<WorkerProfile>(`/workers/by-user/${id}`);
      setWorkerProfile(res.data);
      setIdFrontUrl(res.data.idFrontUrl ?? '');
      setIdBackUrl(res.data.idBackUrl ?? '');
      setHeadshotUrl(res.data.headshotUrl ?? '');
    } catch {
      // Leave the empty state showing rather than blocking the screen.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadWorkerProfile(); }, [loadWorkerProfile]));

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
              Alert.alert('Submitted!', 'Your documents are being reviewed. We will notify you once a decision is made.');
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

  type StatusInfo = { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string; bg: string };
  const statusConfig: Record<VerificationStatus, StatusInfo> = {
    NONE:               { icon: 'shield-outline',         label: 'Not Verified',      color: Colors.outline,   bg: Colors.surfaceContainerHigh },
    PENDING:            { icon: 'time-outline',           label: 'Under Review',      color: Colors.warning,   bg: 'rgba(245,124,0,0.1)' },
    APPROVED:           { icon: 'shield-checkmark',       label: 'Verified',          color: Colors.available, bg: 'rgba(46,125,50,0.1)' },
    DECLINED:           { icon: 'close-circle-outline',   label: 'Declined',          color: Colors.error,     bg: Colors.errorContainer },
    RESUBMIT_REQUESTED: { icon: 'refresh-circle-outline', label: 'Resubmit Required', color: Colors.warning,   bg: 'rgba(245,124,0,0.1)' },
  };

  const status = (workerProfile?.verificationStatus ?? 'NONE') as VerificationStatus;
  const statusInfo = statusConfig[status];
  const canSubmit = status === 'NONE' || status === 'DECLINED' || status === 'RESUBMIT_REQUESTED';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Why it's worth doing — the incentive, stated up front. */}
        <View style={styles.intro}>
          <Text style={styles.introTitle}>Verification is required</Text>
          <Text style={styles.introBody}>
            Customers can only find and book workers whose identity we've checked. Until an admin
            approves your documents you won't appear in search, so this is the step that gets you
            your first job.
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon} size={22} color={statusInfo.color} />
          <View style={styles.statusTextCol}>
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            {status === 'APPROVED' && (
              <Text style={styles.statusSub}>You appear in customer searches and can accept jobs</Text>
            )}
            {status === 'PENDING' && (
              <Text style={styles.statusSub}>
                Our team is reviewing your documents — we'll notify you. You won't appear in search
                until then.
              </Text>
            )}
            {(status === 'DECLINED' || status === 'RESUBMIT_REQUESTED') && workerProfile?.verificationNote && (
              <Text style={styles.statusSub}>Admin note: {workerProfile.verificationNote}</Text>
            )}
            {status === 'NONE' && (
              <Text style={styles.statusSub}>
                Upload three photos to get listed — reviews usually take about a day
              </Text>
            )}
          </View>
        </View>

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

        {(status === 'PENDING' || status === 'APPROVED') && workerProfile?.idFrontUrl && (
          <View style={styles.docsCard}>
            <Text style={styles.docsIntro}>Your submitted documents:</Text>
            <View style={styles.thumbRow}>
              <Thumb label="ID Front" uri={workerProfile.idFrontUrl!} onView={setViewerUri} />
              <Thumb label="ID Back"  uri={workerProfile.idBackUrl!}  onView={setViewerUri} />
              <Thumb label="Headshot" uri={workerProfile.headshotUrl!} onView={setViewerUri} />
            </View>
          </View>
        )}

        <Text style={styles.privacyNote}>
          Your documents are only visible to FixerHub admins reviewing your application. They never
          appear on your public profile.
        </Text>
      </ScrollView>

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setViewerUri(null)} activeOpacity={0.8}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.modalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
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
  const styles = useThemedStyles(makeStyles);
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
              {loading
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="refresh-outline" size={16} color={Colors.primary} />}
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
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.thumb} onPress={() => onView(uri)} activeOpacity={0.8}>
      <Image source={{ uri }} style={styles.thumbImg} />
      <Text style={styles.thumbLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingTop: 16, paddingBottom: 48 },

  intro: { paddingHorizontal: 20, marginBottom: 18 },
  introTitle: { fontSize: 20, color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  introBody: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 21 },

  statusBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 20, borderRadius: 12, padding: 14, marginBottom: 16 },
  statusTextCol: { flex: 1 },
  statusLabel: { fontSize: 15, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  statusSub: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  docsCard: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16, marginBottom: 20, gap: 2 },
  docsIntro: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 8 },

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

  thumbRow: { flexDirection: 'row', gap: 10 },
  thumb: { flex: 1, alignItems: 'center', gap: 4 },
  thumbImg: { width: '100%', aspectRatio: 1.4, borderRadius: 8, backgroundColor: Colors.surfaceContainerHigh },
  thumbLabel: { fontSize: 11, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },

  privacyNote: { fontSize: 12, color: Colors.outline, fontFamily: 'Inter_400Regular', lineHeight: 18, marginHorizontal: 20, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  modalImage: { width: '95%', height: '70%' },
});
