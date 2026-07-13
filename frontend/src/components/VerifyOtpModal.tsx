import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { VerifyChannel, sendVerifyOtp, confirmVerifyOtp, VerificationStatus } from '../api/auth';

/**
 * VERIFICATION: 6-digit OTP entry for verifying the user's own email
 * (mail OTP) or phone (SMS OTP). Auto-sends the code when opened.
 */

interface Props {
  visible: boolean;
  channel: VerifyChannel;
  /** The email address / phone number being verified (display only). */
  target: string;
  onClose: () => void;
  onVerified: (status: VerificationStatus) => void;
}

export default function VerifyOtpModal({ visible, channel, target, onClose, onVerified }: Props) {
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentOnce = useRef(false);

  useEffect(() => {
    if (visible && !sentOnce.current) {
      sentOnce.current = true;
      send();
    }
    if (!visible) {
      sentOnce.current = false;
      setOtp('');
      setSent(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await sendVerifyOtp(channel);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Could not send the code');
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const status = await confirmVerifyOtp(channel, otp.trim());
      onVerified(status);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Verification failed');
    } finally {
      setConfirming(false);
    }
  }

  const label = channel === 'EMAIL' ? 'email' : 'phone number';
  const icon = channel === 'EMAIL' ? 'mail-outline' : 'call-outline';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.bg}>
        <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={28} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Verify your {label}</Text>
          <Text style={styles.sub}>
            {sending
              ? `Sending a 6-digit code to ${target}…`
              : sent
                ? `We sent a 6-digit code to ${target}. Enter it below.`
                : `We'll send a 6-digit code to ${target}.`}
          </Text>

          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="••••••"
            placeholderTextColor={Colors.outline}
            maxLength={6}
            autoFocus
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.confirmBtn, (confirming || sending) && { opacity: 0.6 }]}
            onPress={confirm}
            disabled={confirming || sending}
            activeOpacity={0.85}
          >
            {confirming ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>Verify</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={send} disabled={sending} style={styles.resend}>
            <Text style={styles.resendText}>{sending ? 'Sending…' : "Didn't get it? Resend code"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  dismiss: { flex: 1 },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    alignItems: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceDim, marginBottom: 16 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: Colors.onSurface, marginBottom: 6 },
  sub: { fontSize: 13.5, fontFamily: 'Inter_400Regular', color: Colors.onSurfaceVariant, textAlign: 'center', marginBottom: 16, paddingHorizontal: 8 },
  otpInput: {
    width: 180,
    textAlign: 'center',
    fontSize: 26,
    letterSpacing: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  error: { color: Colors.error, fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 8, textAlign: 'center' },
  confirmBtn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmText: { fontSize: 15, color: '#fff', fontFamily: 'Inter_600SemiBold' },
  resend: { marginTop: 14 },
  resendText: { fontSize: 13.5, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
});
