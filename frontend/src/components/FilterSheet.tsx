import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

export interface FilterOptions {
  skill?: string;
  minRating?: number;
  verified?: boolean;
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
}

export default function FilterSheet({ visible, onClose, onApply, currentFilters }: FilterSheetProps) {
  const [verifiedOnly, setVerifiedOnly] = useState(currentFilters.verified ?? false);
  const [minRating, setMinRating] = useState(currentFilters.minRating ?? 0);

  function handleApply() {
    onApply({
      verified: verifiedOnly || undefined,
      minRating: minRating > 0 ? minRating : undefined,
    });
    onClose();
  }

  function handleReset() {
    setVerifiedOnly(false);
    setMinRating(0);
    onApply({});
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.filterRow}>
              <View>
                <Text style={styles.filterLabel}>Verified Workers Only</Text>
                <Text style={styles.filterSubLabel}>Show only background-checked workers</Text>
              </View>
              <Switch
                value={verifiedOnly}
                onValueChange={setVerifiedOnly}
                trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.secondary }}
                thumbColor={Colors.onPrimary}
              />
            </View>

            <View style={styles.ratingSection}>
              <Text style={styles.filterLabel}>Minimum Rating</Text>
              <Text style={styles.filterSubLabel}>Only show workers rated {minRating > 0 ? `${minRating}+` : 'any'}</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setMinRating(star === minRating ? 0 : star)}
                    style={styles.starBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Ionicons
                      name={star <= minRating ? 'star' : 'star-outline'}
                      size={32}
                      color={star <= minRating ? Colors.starColor : Colors.outline}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onSurface,
    fontFamily: 'Inter_600SemiBold',
  },
  filterSubLabel: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  ratingSection: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  starRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  starBtn: {
    padding: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onSurface,
    fontFamily: 'Inter_600SemiBold',
  },
  applyBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onPrimary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
