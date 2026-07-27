import React, { useEffect, useState } from 'react';
import { useThemedStyles } from '../context/ThemeContext';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { changePassword } from '../api/auth';
import * as tokenStorage from '../utils/tokenStorage';

/**
 * CHANGE PASSWORD: requires the current password. The backend revokes every
 * other session and returns a fresh token pair, which we store so this
 * session continues without a re-login.
 */

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ visible, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
    }
  }, [visible]);

  async function handleSave() {
    if (!current || !next || !confirm) {
      setError('Please fill in all three fields');
      return;
    }
    // Mirror the backend rule (8 chars + a number) so the user gets the error
    // before the round trip, not after.
    if (next.length < 8 || !/\d/.test(next)) {
      setError('Password must be at least 8 characters and contain at least one number');
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await changePassword(current, next);
      if (res.token) await tokenStorage.setItem('token', res.token);
      if (res.refreshToken) await tokenStorage.setItem('refreshToken', res.refreshToken);
      onClose();
      Alert.alert('Password changed', 'Your other devices have been signed out.');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.bg}>
        <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>Change Password</Text>

          <PasswordField label="Current password" value={current} onChange={setCurrent} autoFocus />
          <PasswordField label="New password" value={next} onChange={setNext} />
          <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave}
                              disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Change</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PasswordField({ label, value, onChange, autoFocus }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="lock-closed-outline" size={18} color={Colors.outline} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          autoFocus={autoFocus}
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor={Colors.outline}
        />
        <TouchableOpacity onPress={() => setShow(!show)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.outline} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  bg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  dismiss: { flex: 1 },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceDim, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: Colors.onSurface, marginBottom: 16, textAlign: 'center' },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: Colors.onSurfaceVariant, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  input: { flex: 1, fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  error: { color: Colors.error, fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2, marginBottom: 4, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.outline, alignItems: 'center' },
  cancelText: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, color: '#fff', fontFamily: 'Inter_600SemiBold' },
});
