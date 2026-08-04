import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { Colors } from '../constants/colors';
import { useThemedStyles } from '../context/ThemeContext';
import { currentUpdateLabel } from '../utils/updates';

/**
 * "Check for updates" — the manual counterpart to the automatic check.
 *
 * The automatic one runs at launch and is silent by design; this exists for the
 * moment someone has been told "a fix went out" and wants it NOW rather than on
 * the next restart. It does the whole thing in one tap — check, download,
 * restart — and says plainly what happened, because an update button that gives
 * no feedback is indistinguishable from a broken one.
 *
 * The line underneath names the bundle actually running, which is the only way
 * to tell an applied OTA from the code baked into the APK without a computer.
 */

type Phase = 'idle' | 'checking' | 'downloading';

export default function UpdateChecker() {
  const styles = useThemedStyles(makeStyles);
  const [phase, setPhase] = useState<Phase>('idle');

  const busy = phase !== 'idle';

  const onPress = async () => {
    if (busy) return;

    // Expo Go and dev builds have no update channel — say so rather than
    // spinning forever against something that will never answer.
    if (__DEV__ || !Updates.isEnabled) {
      Alert.alert('Not available here', 'Updates only apply to an installed build, not Expo Go or development.');
      return;
    }

    try {
      setPhase('checking');
      const check = await Updates.checkForUpdateAsync();

      if (!check.isAvailable) {
        setPhase('idle');
        Alert.alert("You're up to date", 'You already have the latest version of FixerHub.');
        return;
      }

      setPhase('downloading');
      await Updates.fetchUpdateAsync();

      // reloadAsync doesn't return — the app restarts into the new bundle.
      await Updates.reloadAsync();
    } catch {
      setPhase('idle');
      Alert.alert('Could not update', 'Check your internet connection and try again.');
    }
  };

  const label =
    phase === 'checking' ? 'Checking…' : phase === 'downloading' ? 'Downloading update…' : 'Check for updates';

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.8} disabled={busy}>
        {busy ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name="cloud-download-outline" size={18} color={Colors.primary} />
        )}
        <Text style={styles.btnText}>{label}</Text>
      </TouchableOpacity>

      <Text style={styles.buildLabel}>{currentUpdateLabel()}</Text>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    wrap: { marginTop: 8, marginBottom: 8 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.outline,
    },
    btnText: {
      fontSize: 14,
      color: Colors.primary,
      fontFamily: 'Inter_600SemiBold',
    },
    buildLabel: {
      fontSize: 11,
      color: Colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: 8,
      fontFamily: 'Inter_400Regular',
    },
  });
