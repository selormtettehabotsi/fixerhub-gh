import React, { useState, useEffect, useCallback } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
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
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { getWorkerPortfolio, addPortfolioItem, deletePortfolioItem, PortfolioItem } from '../../src/api/portfolio';
import { getWorker } from '../../src/api/workers';
import { cloudinaryThumb } from '../../src/utils/imageUrl';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 52) / 2;

export default function WorkerPortfolioScreen() {
  const styles = useThemedStyles(makeStyles);
  const { workerId } = useLocalSearchParams<{ workerId: string }>();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    if (!workerId) return;
    try {
      const [portfolio, worker, storedUserId] = await Promise.all([
        getWorkerPortfolio(workerId),
        getWorker(workerId),
        AsyncStorage.getItem('userId'),
      ]);
      setItems(portfolio);
      setIsOwner(storedUserId ? String(worker.userId) === storedUserId : false);
    } catch (err: any) {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  async function handleAdd() {
    if (!imageUrl.trim()) {
      setAddError('Please enter an image URL.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const item = await addPortfolioItem(workerId!, imageUrl.trim(), caption.trim() || undefined);
      setItems((prev) => [...prev, item]);
      setImageUrl('');
      setCaption('');
      setShowAddModal(false);
    } catch (err: any) {
      setAddError(err.message ?? 'Failed to add photo.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(portfolioId: number) {
    Alert.alert('Remove Photo', 'Remove this photo from your portfolio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePortfolioItem(portfolioId);
            setItems((prev) => prev.filter((i) => i.id !== portfolioId));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.headerRow}>
        <Text style={styles.count}>{items.length} photo{items.length !== 1 ? 's' : ''}</Text>
        {isOwner && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color={Colors.onPrimary} />
            <Text style={styles.addBtnText}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="images-outline" size={52} color={Colors.outline} />
            <Text style={styles.emptyText}>No portfolio photos yet</Text>
            {isOwner && <Text style={styles.emptySubtext}>Tap "Add Photo" to showcase your work</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <Image source={{ uri: cloudinaryThumb(item.imageUrl, ITEM_SIZE) }} style={styles.gridImage} resizeMode="cover" />
            {isOwner && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Ionicons name="close-circle" size={22} color={Colors.error} />
              </TouchableOpacity>
            )}
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
            ) : null}
          </View>
        )}
      />

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Portfolio Photo</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>

            {addError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{addError}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Image URL</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="link-outline" size={16} color={Colors.outline} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://example.com/photo.jpg"
                placeholderTextColor={Colors.outline}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <Text style={styles.inputLabel}>Caption (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={caption}
              onChangeText={setCaption}
              placeholder="Describe this work..."
              placeholderTextColor={Colors.outline}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={adding} activeOpacity={0.85}>
              {adding ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.submitBtnText}>Add to Portfolio</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  count: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: Colors.onPrimary, fontSize: 14, fontWeight: '700' },
  grid: { paddingHorizontal: 16, paddingBottom: 40 },
  row: { gap: 12, marginBottom: 12 },
  gridItem: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.surfaceContainerLowest, position: 'relative' },
  gridImage: { width: '100%', height: ITEM_SIZE, borderRadius: 10 },
  deleteBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12 },
  caption: { fontSize: 13, color: Colors.onSurface, fontFamily: 'Inter_400Regular', padding: 8, paddingTop: 6 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 17, fontWeight: '600', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_600SemiBold' },
  emptySubtext: { fontSize: 15, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },
  errorBox: { backgroundColor: Colors.errorContainer, borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: Colors.error, fontSize: 14, fontFamily: 'Inter_400Regular' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 12 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerHighest, borderRadius: 10, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  textArea: { backgroundColor: Colors.surfaceContainerHighest, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular', minHeight: 70 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: Colors.onPrimary, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
});
