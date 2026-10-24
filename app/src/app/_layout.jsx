import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { Fraunces_600SemiBold, Fraunces_600SemiBold_Italic, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fetchMe, isSignedOutError } from '../api';
import { Intro } from '../components/Intro';
import { configureNotifications, onNotificationTap, setNotificationsEnabled } from '../notifications';
import { isActiveOrder, useOrderWatcher } from '../orderWatcher';
import { syncPush } from '../pushSync';
import { StoreProvider, useStore } from '../store';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotifications();

function Root() {
  const { ready, settings, orders, account, updateAccountCustomer, signOut, updateOrder, pushToken, setPushToken } = useStore();
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
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
  const [intro, setIntro] = useState(true); // the opening animation, over the app as it loads

  useEffect(() => {
    if (done) SplashScreen.hideAsync().catch(() => {});
  }, [done]);

  useEffect(() => {
    setNotificationsEnabled(settings.notifications);
  }, [settings.notifications]);

  useOrderWatcher();

  // Status updates must reach the phone when the app is closed, and that only works through push.
  // Keep this phone's push token attached to every order still on its way: at launch, whenever the
  // app comes back to the front (the customer may have just allowed notifications in the phone's
  // settings), and whenever an order is still waiting for its token.
  const pushRef = useRef(null);
  useEffect(() => {
    pushRef.current = { orders, updateOrder, pushToken, setPushToken, on: settings.notifications };
  });
  const waitingForPush = orders.filter((o) => isActiveOrder(o) && !o.push).length;
  useEffect(() => {
    if (!ready) return undefined;
    const run = () => {
      const c = pushRef.current;
      if (c?.on) syncPush(c).catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') run();
    });
    return () => sub.remove();
  }, [ready, waitingForPush, settings.notifications]);

  // Once per launch: check the saved sign-in still works and pick up account changes. Signs out
  // only when the server says the sign-in is no longer valid, never because the phone is offline.
  const accountToken = account?.token;
  useEffect(() => {
    if (!ready || !accountToken) return;
    fetchMe(accountToken)
      .then(updateAccountCustomer)
      .catch((e) => {
        if (isSignedOutError(e)) signOut();
      });
  }, [ready, accountToken, updateAccountCustomer, signOut]);

  // Tapping an order notification opens that order.
  useEffect(() => {
    if (!done) return;
    return onNotificationTap(({ orderId, token }) => {
      const saved = ordersRef.current.find((o) => o.id === orderId);
      router.push({ pathname: '/order/[id]', params: { id: orderId, token: token || saved?.token || '' } });
    });
  }, [done]);

  if (!done) return null;
  return (
    <>
      <StatusBar style={intro ? 'dark' : colors.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="start" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="menu" options={{ animation: 'fade' }} />
        <Stack.Screen name="order/[id]" options={{ gestureEnabled: false }} />
      </Stack>
      {intro && <Intro onDone={() => setIntro(false)} />}
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
