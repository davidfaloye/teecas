// Shown once, right after the first-launch tour: create an account, sign in, or carry on as a
// guest. A guest can order straight away; the order, name, address and food still go to Teecas,
// but their order history lives only on this phone. An account keeps it on the server, so it
// follows them to any phone.

import { Redirect, router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T } from '../components/ui';
import { useStore } from '../store';
import { colors, themed } from '../theme';

export default function Start() {
  const insets = useSafeAreaInsets();
  const { account, finishGate } = useStore();

  // Signed in from here: the sign-in screen goes back to this page, which moves on.
  if (account) return <Redirect href="/menu" />;

  function guest() {
    finishGate();
    router.replace('/menu');
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.hero}>
        <View style={s.glow} />
        <View style={s.logo}>
          <Image source={require('../../assets/icon.png')} style={{ width: 96, height: 96 }} accessibilityIgnoresInvertColors />
        </View>
        <View style={{ gap: 10, paddingHorizontal: 28, alignItems: 'center' }}>
          <T variant="eyebrow">Before you order</T>
          <T variant="h1" style={{ textAlign: 'center' }}>
            Create an account, or just order
          </T>
          <T variant="small" style={{ fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
            An account fills in checkout for you and keeps your orders, even on a new phone.
          </T>
        </View>
      </View>

      <View style={s.actions}>
        <Button label="Create an account" kind="gold" onPress={() => router.push('/signup')} />
        <Button label="Sign in" kind="ghost" onPress={() => router.push('/signin')} />
        <Button label="Continue as guest" kind="quiet" onPress={guest} />
        <T variant="muted" style={{ textAlign: 'center' }}>
          As a guest, your past orders are saved on this phone only. Teecas still gets your order and delivery details.
        </T>
      </View>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 },
  glow: { position: 'absolute', top: '12%', width: 230, height: 230, borderRadius: 115, backgroundColor: colors.glow },
  logo: { width: 96, height: 96, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  actions: { paddingHorizontal: 20, gap: 10 },
}));
