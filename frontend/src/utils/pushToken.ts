import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import client from '../api/client';

/**
 * PUSH: registers this device's FCM token with the backend so booking
 * updates, quotes, and payment receipts arrive as real push notifications.
 *
 * Fire-and-forget: failures are logged, never surfaced. Note that Expo Go
 * (SDK 53+) does not support remote push on Android — this becomes fully
 * functional in a development build / APK; in Expo Go it no-ops gracefully.
 */
export async function registerPushToken(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FixerHub',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (token) {
      await client.put('/auth/fcm-token', { token: String(token) });
    }
  } catch (e: any) {
    console.log('Push token registration skipped:', e?.message ?? e);
  }
}
