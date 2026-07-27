import React, { useState } from 'react';
import { useThemedStyles } from '../../src/context/ThemeContext';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { requestPasswordReset, resetPassword } from '../../src/api/auth';

/**
 * FORGOT PASSWORD — two steps in one screen.
 *
 *   1. PHONE  → POST /auth/forgot-password sends a 6-digit OTP by SMS
 *               (auth-service falls back to email if SMS fails).
 *   2. RESET  → POST /auth/reset-password verifies the OTP and sets the new
 *               password, revoking every existing session.
 *
 * Backend password rule: at least 8 characters INCLUDING a number. We validate
 * the same rule here so the user gets instant feedback instead of a round trip.
 */
export default function ForgotPasswordScreen() {
  const styles = useThemedStyles(makeStyles);

  const [step, setStep] = useState<'PHONE' | 'RESET'>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function readableError(err: any, fallback: string): string {
    const raw = err?.message ?? err;
    const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
    if (/network|timeout|connect/i.test(msg)) {
      return 'Cannot reach the server. Check your internet connection.';
    }
    return msg || fallback;
  }

  // ── Step 1: request the code ─────────────────────────────────────────────
  async function handleSendCode() {
    if (!phone.trim()) {
      setError('Enter the phone number on your account.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await requestPasswordReset(phone);
      // The backend tells us whether it went by SMS or fell back to email.
      setInfo(res?.message ?? 'Reset code sent.');
      setStep('RESET');
    } catch (err: any) {
      setError(readableError(err, 'Could not send the reset code.'));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: confirm the code + set the new password ──────────────────────
  async function handleResetPassword() {
    if (!otp.trim()) {
      setError('Enter the 6-digit code you received.');
      return;
    }
    // Mirror the backend rule so the user isn't rejected after a round trip.
    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      setError('Password must be at least 8 characters and include a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(phone, otp, newPassword);
      // Every session was revoked server-side, so send them to a clean login.
      router.replace({
        pathname: '/(auth)/login',
        params: { reset: '1' },
      });
    } catch (err: any) {
      setError(readableError(err, 'Could not reset your password.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setOtp('');
    await handleSendCode();
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Ionicons name="lock-open-outline" size={26} color={Colors.primary} />
              <Text style={styles.logoText}> FixerHub</Text>
            </View>
            <Text style={styles.title}>
              {step === 'PHONE' ? 'Forgot Password' : 'Enter Reset Code'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'PHONE'
                ? "We'll send a 6-digit code to the phone number on your account."
                : 'Enter the code you received, then choose a new password.'}
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} style={styles.errorIcon} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {info && !error && (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.available} style={styles.errorIcon} />
              <Text style={styles.infoText}>{info}</Text>
            </View>
          )}

          {step === 'PHONE' ? (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={18} color={Colors.outline} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+233241234567"
                    placeholderTextColor={Colors.outline}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text style={styles.hint}>Use the number you registered with.</Text>
              </View>

              <TouchableOpacity onPress={handleSendCode} disabled={loading} activeOpacity={0.85} style={styles.btnWrapper}>
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButton}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.onPrimary} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>6-Digit Code</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="keypad-outline" size={18} color={Colors.outline} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="123456"
                    placeholderTextColor={Colors.outline}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>
                <Text style={styles.hint}>The code expires in 10 minutes.</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.outline} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="At least 8 characters incl. a number"
                    placeholderTextColor={Colors.outline}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={Colors.outline}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.outline} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter the new password"
                    placeholderTextColor={Colors.outline}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </View>

              <TouchableOpacity onPress={handleResetPassword} disabled={loading} activeOpacity={0.85} style={styles.btnWrapper}>
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButton}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.onPrimary} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Reset Password</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.resendRow}>
                <TouchableOpacity onPress={handleResend} disabled={loading}>
                  <Text style={styles.linkText}>Resend code</Text>
                </TouchableOpacity>
                <Text style={styles.dot}> · </Text>
                <TouchableOpacity onPress={() => { setStep('PHONE'); setError(null); setInfo(null); }} disabled={loading}>
                  <Text style={styles.linkText}>Change number</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.backLink}>
            <Text style={styles.backLinkText}>
              Remembered it? <Text style={styles.backLinkBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  header: { alignItems: 'center', paddingTop: 48, paddingBottom: 32 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoText: { fontSize: 22, fontWeight: '700', color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
  title: { fontSize: 28, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8 },
  subtitle: {
    fontSize: 15.5,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },

  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.errorContainer, borderRadius: 8, padding: 12, marginBottom: 16, gap: 8 },
  errorIcon: { flexShrink: 0 },
  errorText: { color: Colors.error, fontSize: 15, fontFamily: 'Inter_400Regular', flex: 1 },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
    backgroundColor: 'rgba(46,125,50,0.10)', borderRadius: 8, padding: 12,
  },
  infoText: { color: Colors.available, fontSize: 15, fontFamily: 'Inter_400Regular', flex: 1 },

  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 17, fontWeight: '600', color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 17, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  otpInput: { letterSpacing: 8, fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  eyeBtn: { padding: 4 },
  hint: { fontSize: 12.5, color: Colors.outline, fontFamily: 'Inter_400Regular', marginTop: 2 },

  btnWrapper: { marginTop: 8 },
  primaryButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: Colors.onPrimary, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },

  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  linkText: { fontSize: 15, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  dot: { color: Colors.outline },

  backLink: { alignItems: 'center', marginTop: 28, padding: 8 },
  backLinkText: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  backLinkBold: { color: Colors.primary, fontWeight: '700' },
});
