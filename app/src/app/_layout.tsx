import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { Fraunces_600SemiBold, Fraunces_600SemiBold_Italic, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../store';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready } = useStore();
  const [fontsLoaded, fontError] = useFonts({
    ArchivoBlack_400Regular,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });
  const done = ready && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (done) SplashScreen.hideAsync().catch(() => {});
  }, [done]);

  if (!done) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="menu" options={{ animation: 'fade' }} />
        <Stack.Screen name="order/[id]" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
