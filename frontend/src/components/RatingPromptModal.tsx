import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { submitReview } from '../api/reviews';

interface RatingPromptModalProps {
  visible: boolean;
  workerName: string;
  bookingId: number;
  workerId: number;
  customerId?: number;
  customerName?: string;
  customerProfilePicture?: string;
  onClose: () => void;
  onSubmit: () => void;
}

export default function RatingPromptModal({
  visible,
  workerName,
  bookingId,
  workerId,
  customerId,
  customerName,
  customerProfilePicture,
  onClose,
  onSubmit,
}: RatingPromptModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a star rating.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await submitReview({
        workerId,
        bookingId,
        customerId: customerId ?? 0,
        rating,
        comment: comment.trim() || undefined,
        customerName,
        customerProfilePicture,
      });
      onSubmit();
    } catch (err: any) {
      setError(err.message ?? 'Failed to submit review.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>How was {workerName}?</Text>
          <Text style={styles.subtitle}>Rate your experience with this worker</Text>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={star <= rating ? Colors.starColor : Colors.outline}
                />
              </TouchableOpacity>
            ))}
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience (optional)..."
            placeholderTextColor={Colors.outline}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || rating === 0}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Review</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 20,
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: Colors.errorContainer,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    width: '100%',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  commentInput: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: Colors.onSurface,
    fontFamily: 'Inter_400Regular',
    minHeight: 80,
    marginBottom: 16,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
  },
});
