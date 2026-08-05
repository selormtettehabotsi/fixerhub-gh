import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { UnreadProvider } from '../src/context/UnreadContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { Colors } from '../src/constants/colors';
import { useAutoUpdate } from '../src/utils/updates';

SplashScreen.preventAutoHideAsync();

// PUSH: show notifications that arrive while the app is OPEN.
//
// Android hands a foreground notification to the app instead of the system
// tray, and expo-notifications drops it unless a handler says otherwise — so
// pushes appeared to "not work" when they had actually been delivered. That's
// the case that matters most here: a worker with the app open is exactly who
// needs to see a new booking land.
//
// Set at module scope, not in a component, so it's registered before any
// notification can arrive.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,   // also keep it in the tray/shade
    shouldPlaySound: true,
    shouldSetBadge: false,  // badge counts come from the in-app inbox instead
  }),
});

// Custom back button — just the chevron, no text label
function BackButton() {
  return (
    <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
      <Ionicons name="chevron-back" size={26} color="#ffffff" />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  // OTA: check on every launch and apply straight away, instead of waiting for
  // the next cold start. No-op in development and in Expo Go.
  useAutoUpdate();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // PUSH: tapping a notification opens the thing it's about. The backend
  // already sends bookingId in the data payload (LookupClient.recordInbox),
  // so a booking push deep-links to that booking; anything else falls back to
  // the notification centre.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { bookingId?: string | number };
      const bookingId = data?.bookingId;
      if (bookingId) {
        router.push({ pathname: '/booking/[id]', params: { id: String(bookingId) } });
      } else {
        router.push('/notifications');
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  // THEMING v2: ThemeProvider is outermost so a theme switch repaints everything.
  return (
    <ThemeProvider>
      <UnreadProvider>
        <RootNavigator />
      </UnreadProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  // Subscribe to the theme so the shared header color repaints on a live switch.
  const { version } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _v = version;
  const HEADER_STYLE = {
    headerStyle: { backgroundColor: Colors.primary },
    headerTintColor: '#ffffff',
    headerBackTitle: '',
    headerLeft: () => <BackButton />,
  };

  return (
    <>
      <StatusBar style="light" />
      {/* contentStyle matters: without it every screen sits on react-navigation's
          DEFAULT WHITE background. You don't see it while a screen is settled
          (each one paints its own SafeAreaView), but during a back gesture or
          pop animation the outgoing screen slides off before the incoming one
          paints — and the white default flashes through. Painfully obvious on
          the dark theme, and it reads as "the screen went blank".
          Colors is the mutable theme object, so this repaints on theme switch
          along with everything else (the `version` counter re-renders us). */}
      <Stack
        screenOptions={{
          headerShown: false,
          headerBackTitle: '',
          contentStyle: { backgroundColor: Colors.surface },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(worker)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="worker/[id]"      options={{ headerShown: true, title: 'Worker Profile',    ...HEADER_STYLE }} />
        <Stack.Screen name="worker/portfolio" options={{ headerShown: true, title: 'Portfolio',          ...HEADER_STYLE }} />
        <Stack.Screen name="worker/verification" options={{ headerShown: true, title: 'Identity Verification', ...HEADER_STYLE }} />
        <Stack.Screen name="booking/confirm"  options={{ headerShown: true, title: 'Confirm Booking',   ...HEADER_STYLE }} />
        <Stack.Screen name="booking/confirmed" options={{ headerShown: false }} />
        <Stack.Screen name="booking/[id]"     options={{ headerShown: true, title: 'Booking Details',   ...HEADER_STYLE }} />
        <Stack.Screen name="chat/[bookingId]" options={{ headerShown: true, title: 'Chat',              ...HEADER_STYLE }} />
        <Stack.Screen name="notifications"    options={{ headerShown: true, title: 'Notifications',     ...HEADER_STYLE }} />
        <Stack.Screen name="admin/users"      options={{ headerShown: true, title: 'Manage Users',      ...HEADER_STYLE }} />
        <Stack.Screen name="admin/bookings"   options={{ headerShown: true, title: 'All Bookings',      ...HEADER_STYLE }} />
        <Stack.Screen name="help"             options={{ headerShown: false }} />
        {/* Legal draws its own header so the Terms/Privacy tabs sit under it. */}
        <Stack.Screen name="legal"            options={{ headerShown: false }} />
        <Stack.Screen name="report"           options={{ headerShown: false }} />
        <Stack.Screen name="payment/receipt"  options={{ headerShown: false }} />
      </Stack>
    </>
  );
}