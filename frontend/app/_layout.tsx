import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

SplashScreen.preventAutoHideAsync();

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

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(worker)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="worker/[id]" options={{ headerShown: true, title: 'Worker Profile', headerStyle: { backgroundColor: '#a33900' }, headerTintColor: '#ffffff' }} />
        <Stack.Screen name="booking/confirm" options={{ headerShown: true, title: 'Confirm Booking', headerStyle: { backgroundColor: '#a33900' }, headerTintColor: '#ffffff' }} />
        <Stack.Screen name="booking/confirmed" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
