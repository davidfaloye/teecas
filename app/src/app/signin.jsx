// Sign in with email and password. Orders placed on this phone as a guest move into the
// account, and every order on the account shows in My orders, on any phone.

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_MODE, friendlyError, signIn } from '../api';
import { guestOrderKeys, leaveAuth } from '../authFlow';
import { Input } from '../components/Input';
import { ErrorNotice, Button, Card, Header, Notice, T } from '../components/ui';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { orders, startSession } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);

  async function submit() {
    if (busy) return;
    const e = {};
    if (!validEmail(email)) e.email = 'Enter your email, like ada@example.com.';
    if (!password) e.password = 'Enter your password.';
    setErrors(e);
    setError('');
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const session = await signIn({ login: email.trim(), password, claim: guestOrderKeys(orders) });
      startSession(session);
      leaveAuth();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Sign in" subtitle="See your orders on any phone" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          {DEMO_MODE ? <Notice>Accounts need the Teecas Amala server. This preview runs on sample data, so signing in won’t work here.</Notice> : null}
          <Card style={{ gap: 14 }}>
            <Input
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setErrors((x) => ({ ...x, email: '' }));
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="ada@example.com"
              maxLength={120}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              label="Password"
              password
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setErrors((x) => ({ ...x, password: '' }));
              }}
              error={errors.password}
              autoComplete="current-password"
              textContentType="password"
              maxLength={200}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace({ pathname: '/forgot-password', params: { login: email.trim() } })}
              hitSlop={8}
              style={{ alignSelf: 'flex-end', marginTop: -4 }}
            >
              <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
                Forgot password?
              </T>
            </Pressable>
            <ErrorNotice>{error}</ErrorNotice>
            <Button label="Sign in" onPress={submit} loading={busy} />
          </Card>

          <Pressable accessibilityRole="button" onPress={() => router.replace('/signup')} hitSlop={8}>
            <T variant="small" style={{ textAlign: 'center' }}>
              New to Teecas Amala? <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>Create an account</T>
            </T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
