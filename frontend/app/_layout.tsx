import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { UnreadProvider } from '../src/context/UnreadContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { Colors } from '../src/constants/colors';

SplashScreen.preventAutoHideAsync();

// Custom back button — just the chevron, no text label
function BackButton() {
  return (
    <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
      <Ionicons name="chevron-back" size={26} color="#ffffff" />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
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
      <Stack screenOptions={{ headerShown: false, headerBackTitle: '' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(worker)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="worker/[id]"      options={{ headerShown: true, title: 'Worker Profile',    ...HEADER_STYLE }} />
        <Stack.Screen name="worker/portfolio" options={{ headerShown: true, title: 'Portfolio',          ...HEADER_STYLE }} />
        <Stack.Screen name="booking/confirm"  options={{ headerShown: true, title: 'Confirm Booking',   ...HEADER_STYLE }} />
        <Stack.Screen name="booking/confirmed" options={{ headerShown: false }} />
        <Stack.Screen name="booking/[id]"     options={{ headerShown: true, title: 'Booking Details',   ...HEADER_STYLE }} />
        <Stack.Screen name="chat/[bookingId]" options={{ headerShown: true, title: 'Chat',              ...HEADER_STYLE }} />
        <Stack.Screen name="notifications"    options={{ headerShown: true, title: 'Notifications',     ...HEADER_STYLE }} />
        <Stack.Screen name="admin/users"      options={{ headerShown: true, title: 'Manage Users',      ...HEADER_STYLE }} />
        <Stack.Screen name="admin/bookings"   options={{ headerShown: true, title: 'All Bookings',      ...HEADER_STYLE }} />
        <Stack.Screen name="help"             options={{ headerShown: false }} />
        <Stack.Screen name="report"           options={{ headerShown: false }} />
        <Stack.Screen name="payment/receipt"  options={{ headerShown: false }} />
      </Stack>
    </>
  );
}