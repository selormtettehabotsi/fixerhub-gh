import React, { useEffect, useRef, useState } from 'react';
import { useThemedStyles } from '../context/ThemeContext';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { updateProfile } from '../api/auth';
import { updateWork } from '../api/workers';
import * as tokenStorage from '../utils/tokenStorage';

/**
 * EDIT PROFILE: bottom-sheet for changing name, email, phone — and, for
 * workers, their trade/skill. Email is the JWT identity, so the backend
 * returns a fresh token pair when it changes; we store it transparently and
 * the session continues without a re-login.
 */

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pass for workers: enables the skill field and the worker-service sync. */
  workerUserId?: string | null;
  initialSkill?: string;
  /** Called with the saved values so the parent can refresh its UI.
   *  emailChanged/phoneChanged let the parent prompt re-verification of the
   *  NEW contact (changing either resets its verified badge server-side). */
  onSaved?: (updated: {
    name: string; email: string; phone: string; skill?: string;
    emailChanged: boolean; phoneChanged: boolean;
  }) => void;
}

export default function EditProfileModal({ visible, onClose, workerUserId, initialSkill, onSaved }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skill, setSkill] = useState(initialSkill ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Original contact values, to detect email/phone changes on save
  const orig = useRef({ email: '', phone: '' });

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSkill(initialSkill ?? '');
    Promise.all([
      AsyncStorage.getItem('name'),
      AsyncStorage.getItem('email'),
      AsyncStorage.getItem('phone'),
    ]).then(([n, e, p]) => {
      setName(n ?? '');
      setEmail(e ?? '');
      setPhone(p ?? '');
      orig.current = { email: e ?? '', phone: p ?? '' };
    });
  }, [visible, initialSkill]);

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      setError('Name and email cannot be empty');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() });

      // Email changed → backend re-issued the session; store the new tokens.
      if (res.token) await tokenStorage.setItem('token', res.token);
      if (res.refreshToken) await tokenStorage.setItem('refreshToken', res.refreshToken);

      const saved = {
        name: res.name ?? name.trim(),
        email: res.email ?? email.trim(),
        phone: res.phone ?? phone.trim(),
        skill: skill.trim() || undefined,
        emailChanged: (res.email ?? email.trim()).toLowerCase() !== orig.current.email.toLowerCase(),
        phoneChanged: (res.phone ?? phone.trim()) !== orig.current.phone,
      };
      await AsyncStorage.multiSet([
        ['name', saved.name],
        ['email', saved.email],
        ['phone', saved.phone],
      ]);

      if (workerUserId && skill.trim() && skill.trim() !== (initialSkill ?? '')) {
        await updateWork(workerUserId, skill.trim());
      }

      onSaved?.(saved);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Could not save changes');
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
          <Text style={styles.title}>Edit Profile</Text>

          <Field icon="person-outline" label="Name" value={name} onChange={setName} placeholder="Your name" />
          <Field icon="mail-outline" label="Email" value={email} onChange={setEmail} placeholder="you@example.com"
                 keyboardType="email-address" autoCapitalize="none" />
          <Field icon="call-outline" label="Phone" value={phone} onChange={setPhone} placeholder="+233 24 000 0000"
                 keyboardType="phone-pad" />
          {workerUserId != null && (
            <Field icon="construct-outline" label="Work / Trade" value={skill} onChange={setSkill}
                   placeholder="e.g. Plumbing, Electrical" />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave}
                              disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ icon, label, value, onChange, placeholder, keyboardType, autoCapitalize }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={18} color={Colors.outline} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.outline}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
        />
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
