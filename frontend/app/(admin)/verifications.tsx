import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
import {
  getPendingVerifications,
  approveVerification,
  declineVerification,
  requestResubmit,
  type WorkerVerification,
} from '../../src/api/admin';
import { useTabBar } from '../../src/context/TabBarContext';
import Avatar from '../../src/components/Avatar';

export default function AdminVerificationsScreen() {
  const { onScroll } = useTabBar();

  // ─── State ────────────────────────────────────────────────────────────────
  const [workers, setWorkers]       = useState<WorkerVerification[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const [viewerUri, setViewerUri]   = useState<string | null>(null);
  const [noteModal, setNoteModal]   = useState<{
    workerId: number;
    workerName: string;
    action: 'decline' | 'resubmit';
  } | null>(null);
  const [note, setNote]   = useState('');
  const [acting, setActing] = useState(false);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPendingVerifications();
      setWorkers(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadWorkers(); }, [loadWorkers]));

  async function onRefresh() {
    setRefreshing(true);
    await loadWorkers();
    setRefreshing(false);
  }

  // ─── KYC actions ─────────────────────────────────────────────────────────

  async function handleApprove(worker: WorkerVerification) {
    Alert.alert(
      'Approve Verification',
      `Approve and verify ${worker.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approveVerification(worker.id);
              setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  }

  function openNoteModal(worker: WorkerVerification, action: 'decline' | 'resubmit') {
    setNote('');
    setNoteModal({ workerId: worker.id, workerName: worker.name, action });
  }

  async function handleSubmitNote() {
    if (!noteModal) return;
    if (!note.trim()) {
      Alert.alert('Note Required', 'Please write a note explaining your decision.');
      return;
    }
    setActing(true);
    try {
      if (noteModal.action === 'decline') {
        await declineVerification(noteModal.workerId, note.trim());
      } else {
        await requestResubmit(noteModal.workerId, note.trim());
      }
      setWorkers((prev) => prev.filter((w) => w.id !== noteModal.workerId));
      setNoteModal(null);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActing(false);
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  function renderDoc(label: string, uri?: string) {
    if (!uri) return null;
    return (
      <TouchableOpacity style={styles.docThumb} onPress={() => setViewerUri(uri)} activeOpacity={0.8}>
        <Image source={{ uri: cloudinaryThumb(uri, 160) }} style={styles.docThumbImg} />
        <View style={styles.docThumbLabel}>
          <Text style={styles.docThumbText}>{label}</Text>
          <Ionicons name="expand-outline" size={11} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  }

  function renderWorker({ item }: { item: WorkerVerification }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Avatar uri={item.profilePicture} name={item.name} size={48} />
          <View style={styles.cardInfo}>
            <Text style={styles.workerName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.workerSkill}>{item.skill}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={Colors.outline} />
              <Text style={styles.metaText}>{item.location ?? '—'}</Text>
              <Text style={styles.metaDot}> · </Text>
              <Ionicons name="star" size={12} color={Colors.starColor} />
              <Text style={styles.metaText}> {(item.rating ?? 0).toFixed(1)}</Text>
            </View>
          </View>
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={12} color={Colors.warning} />
            <Text style={styles.pendingBadgeText}>Pending</Text>
          </View>
        </View>

        {(item.idFrontUrl || item.idBackUrl || item.headshotUrl) && (
          <>
            <Text style={styles.docsLabel}>Submitted Documents</Text>
            <View style={styles.docsRow}>
              {renderDoc('ID Front', item.idFrontUrl)}
              {renderDoc('ID Back',  item.idBackUrl)}
              {renderDoc('Headshot', item.headshotUrl)}
            </View>
          </>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionApprove]}
            onPress={() => handleApprove(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionResubmit]}
            onPress={() => openNoteModal(item, 'resubmit')}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-circle-outline" size={16} color={Colors.warning} />
            <Text style={[styles.actionBtnText, { color: Colors.warning }]}>Resubmit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionDecline]}
            onPress={() => openNoteModal(item, 'decline')}
            activeOpacity={0.85}
          >
            <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>KYC Verifications</Text>
        <Text style={styles.subtitle}>
          {workers.length > 0
            ? `${workers.length} worker${workers.length !== 1 ? 's' : ''} awaiting review`
            : 'No pending submissions'}
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadWorkers} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={workers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListHeaderComponent={
          loading && workers.length === 0
            ? <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
            : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="shield-checkmark-outline" size={56} color={Colors.outline} />
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptyText}>No pending KYC verifications right now</Text>
            </View>
          ) : null
        }
        renderItem={renderWorker}
      />

      {/* ── Full-screen image viewer ──────────────────────────────────── */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setViewerUri(null)} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={38} color="#fff" />
          </TouchableOpacity>
          {viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.modalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* ── Note modal (Decline / Resubmit) ──────────────────────────── */}
      <Modal visible={!!noteModal} transparent animationType="slide" onRequestClose={() => setNoteModal(null)}>
        <KeyboardAvoidingView
          style={styles.noteModalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.noteModalDismiss} activeOpacity={1} onPress={() => setNoteModal(null)} />
          <View style={styles.noteModalCard}>
            <View style={styles.noteModalHandle} />
            <Text style={styles.noteModalTitle}>
              {noteModal?.action === 'decline' ? 'Decline Verification' : 'Request Better Photos'}
            </Text>
            <Text style={styles.noteModalSubtitle}>
              {noteModal?.action === 'decline'
                ? `Tell ${noteModal?.workerName} why their documents were declined.`
                : `Tell ${noteModal?.workerName} what to improve in the new photos.`}
            </Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={
                noteModal?.action === 'decline'
                  ? 'e.g. Your ID photo is blurry and unreadable'
                  : 'e.g. Please take a clearer photo of the front of your ID card'
              }
              placeholderTextColor={Colors.outline}
              multiline
              maxLength={300}
              autoFocus
            />
            <Text style={styles.noteCount}>{note.length}/300</Text>
            <View style={styles.noteModalBtns}>
              <TouchableOpacity
                style={styles.noteModalCancel}
                onPress={() => setNoteModal(null)}
                disabled={acting}
              >
                <Text style={styles.noteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteModalConfirm,
                  noteModal?.action === 'decline' ? styles.confirmDecline : styles.confirmResubmit,
                  (acting || !note.trim()) && { opacity: 0.5 },
                ]}
                onPress={handleSubmitNote}
                disabled={acting || !note.trim()}
                activeOpacity={0.85}
              >
                {acting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.noteModalConfirmText}>
                    {noteModal?.action === 'decline' ? 'Decline' : 'Request Resubmit'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  subtitle: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginTop: 2 },

  errorBox: { margin: 16, backgroundColor: Colors.errorContainer, borderRadius: 10, padding: 14, alignItems: 'center' },
  errorText: { color: Colors.error, fontSize: 14, marginBottom: 10 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: '#fff', fontWeight: '600' },

  list: { padding: 16, paddingBottom: 100 },
  loader: { marginVertical: 48 },
  emptyBox: { alignItems: 'center', paddingVertical: 80, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  emptyText: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  cardInfo: { flex: 1 },
  workerName: { fontSize: 16, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  workerSkill: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  metaDot: { fontSize: 12, color: Colors.outline },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,124,0,0.12)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0,
  },
  pendingBadgeText: { fontSize: 11, color: Colors.warning, fontFamily: 'Inter_600SemiBold' },

  docsLabel: { fontSize: 13, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  docsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  docThumb: { flex: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surfaceContainerHigh },
  docThumbImg: { width: '100%', aspectRatio: 1.5 },
  docThumbLabel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 6, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  docThumbText: { fontSize: 10, color: '#fff', fontFamily: 'Inter_400Regular' },

  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 10,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold', color: '#fff' },
  actionApprove: { backgroundColor: Colors.available },
  actionResubmit: { backgroundColor: 'rgba(245,124,0,0.12)', borderWidth: 1.5, borderColor: Colors.warning },
  actionDecline: { backgroundColor: Colors.errorContainer, borderWidth: 1.5, borderColor: Colors.error },

  // ── Image viewer modal ───────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 54, right: 20, zIndex: 10 },
  modalImage: { width: '94%', height: '75%', borderRadius: 8 },

  // ── Note modal ───────────────────────────────────────────────────────────
  noteModalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  noteModalDismiss: { flex: 1 },
  noteModalCard: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  noteModalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.surfaceContainerHigh, alignSelf: 'center', marginBottom: 18,
  },
  noteModalTitle: { fontSize: 20, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  noteModalSubtitle: { fontSize: 14, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  noteInput: {
    backgroundColor: Colors.surfaceContainerHighest, borderRadius: 10, padding: 14,
    fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular',
    minHeight: 100, textAlignVertical: 'top',
  },
  noteCount: { fontSize: 12, color: Colors.outline, textAlign: 'right', marginTop: 4, marginBottom: 16, fontFamily: 'Inter_400Regular' },
  noteModalBtns: { flexDirection: 'row', gap: 10 },
  noteModalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.outlineVariant, alignItems: 'center',
  },
  noteModalCancelText: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  noteModalConfirm: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  noteModalConfirmText: { fontSize: 15, color: '#fff', fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  confirmDecline: { backgroundColor: Colors.error },
  confirmResubmit: { backgroundColor: Colors.warning },
});
