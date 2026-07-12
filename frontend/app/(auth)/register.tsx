import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../src/constants/colors';
import { register } from '../../src/api/auth';

const SKILLS = ['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Cleaning', 'Welding', 'Mason', 'Other'];

type Role = 'CUSTOMER' | 'WORKER';

export default function RegisterScreen() {
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [skill, setSkill] = useState('Plumbing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim() || !phone.trim() || !location.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        phone: phone.trim(),
        location: location.trim(),
        ...(role === 'WORKER' ? { skill } : {}),
      });
      // SECURITY (M1): tokens go to the keychain via tokenStorage, not AsyncStorage
      const tokenStorage = await import('../../src/utils/tokenStorage');
      await tokenStorage.multiSet([
        ['token', data.token],
        ['refreshToken', data.refreshToken ?? ''],
        ['role', data.role],
        ['userId', String(data.userId)],
        ['name', data.name ?? name.trim()],
        ['email', data.email ?? email.trim()],
        ['phone', data.phone ?? phone.trim()],
        ['profilePicture', data.profilePicture ?? ''],
      ]);
      if (role === 'WORKER') {
        router.replace('/(worker)/dashboard');
      } else if (role === 'CUSTOMER') {
        router.replace('/(customer)/home');
      } else {
        router.replace('/(auth)/login');
      }
    } catch (err: any) {
      const raw = err?.message ?? err?.error ?? err;
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
      if (msg.toLowerCase().includes('exist') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
        setError('An account with this email already exists.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('connect')) {
        setError('Cannot connect to server. Check your internet connection.');
      } else {
        setError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join FixerHub today</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.roleRow}>
            {(['CUSTOMER', 'WORKER'] as Role[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                onPress={() => setRole(r)}
              >
                <Ionicons
                  name={r === 'CUSTOMER' ? 'person-outline' : 'construct-outline'}
                  size={16}
                  color={role === r ? Colors.onPrimary : Colors.onSurfaceVariant}
                  style={styles.roleBtnIcon}
                />
                <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                  {r === 'CUSTOMER' ? 'Customer' : 'Worker'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.form}>
            <InputField label="Full Name" value={name} onChangeText={setName} placeholder="Kwame Mensah" iconName="person-outline" />
            <InputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" iconName="mail-outline" keyboardType="email-address" autoCapitalize="none" />
            <InputField label="Password" value={password} onChangeText={setPassword} placeholder="Minimum 6 characters" iconName="lock-closed-outline" secureTextEntry />
            <InputField label="Phone" value={phone} onChangeText={setPhone} placeholder="+233241234567" iconName="call-outline" keyboardType="phone-pad" />
            <InputField label="Location" value={location} onChangeText={setLocation} placeholder="Accra, Ghana" iconName="location-outline" />

            {role === 'WORKER' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Skill</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.skillScroll}>
                  {SKILLS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.skillChip, skill === s && styles.skillChipActive]}
                      onPress={() => setSkill(s)}
                    >
                      <Text style={[styles.skillChipText, skill === s && styles.skillChipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85} style={styles.btnWrapper}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              {loading ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
}

function InputField({ label, value, onChangeText, placeholder, iconName, secureTextEntry, keyboardType, autoCapitalize }: InputFieldProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        {iconName && <Ionicons name={iconName} size={18} color={Colors.outline} style={styles.inputIcon} />}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.outline}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  header: { alignItems: 'center', paddingTop: 36, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  subtitle: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorContainer, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: Colors.error, fontSize: 16, fontFamily: 'Inter_400Regular', flex: 1 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerHighest,
    gap: 6,
  },
  roleBtnActive: { backgroundColor: Colors.primary },
  roleBtnIcon: {},
  roleBtnText: { fontSize: 16, fontWeight: '600', color: Colors.onSurfaceVariant, fontFamily: 'Inter_600SemiBold' },
  roleBtnTextActive: { color: Colors.onPrimary },
  form: { gap: 14 },
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
  skillScroll: { marginTop: 4 },
  skillChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHighest,
    marginRight: 8,
  },
  skillChipActive: { backgroundColor: Colors.primary },
  skillChipText: { fontSize: 17, color: Colors.onSurfaceVariant, fontFamily: 'Inter_500Medium' },
  skillChipTextActive: { color: Colors.onPrimary },
  btnWrapper: { marginTop: 20 },
  primaryButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: Colors.onPrimary, fontSize: 16, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  loginLink: { alignItems: 'center', marginTop: 20, padding: 8 },
  loginLinkText: { fontSize: 16, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  loginLinkBold: { color: Colors.primary, fontWeight: '700' },
});
