// Forgot password. Step 1: the customer's phone number or email; the server emails a 6-digit
// code to the account. Step 2: the code and a new password, which signs them in.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_MODE, friendlyError, requestPasswordReset, resetPassword } from '../api';
import { guestOrderKeys, leaveAuth } from '../authFlow';
import { Input } from '../components/Input';
import { ErrorNotice, Button, Card, Header, Notice, T } from '../components/ui';
import { validPhone } from '../phone';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const MIN_PASSWORD = 6; // same as the server
const RESEND_SECONDS = 60; // the server won't send another code sooner

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { orders, startSession } = useStore();
  const [login, setLogin] = useState(String(params.login || ''));
  const [step, setStep] = useState('ask'); // 'ask' | 'reset'
  const [minutes, setMinutes] = useState(15);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0); // seconds until "Send a new code" works
  const passwordRef = useRef(null);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode() {
    if (busy) return;
    const v = login.trim();
    if (!looksLikeEmail(v) && !validPhone(v)) {
      setErrors({ login: 'Enter the email on your account.' });
      return;
    }
    setErrors({});
    setError('');
    setBusy(true);
    try {
      setMinutes(await requestPasswordReset(v));
      setStep('reset');
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (busy) return;
    const e = {};
    if (!/^\d{6}$/.test(code.trim())) e.code = 'Enter the 6-digit code from the email.';
    if (password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
    setErrors(e);
    setError('');
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const session = await resetPassword({ login: login.trim(), code: code.trim(), password, claim: guestOrderKeys(orders) });
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
      <Header title="Forgot password" subtitle={step === 'ask' ? 'We’ll email you a code' : 'Choose a new password'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          {DEMO_MODE ? <Notice>Accounts need the Teecas Amala server. This preview runs on sample data, so this won’t work here.</Notice> : null}

          {step === 'ask' ? (
            <Card style={{ gap: 14 }}>
              <T variant="small">Enter the email on your account. We’ll email you a 6-digit code to reset your password.</T>
              <Input
                label="Email"
                value={login}
                onChangeText={(v) => {
                  setLogin(v);
                  setErrors({});
                }}
                error={errors.login}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="ada@example.com"
                maxLength={120}
                returnKeyType="send"
                onSubmitEditing={sendCode}
              />
              <ErrorNotice>{error}</ErrorNotice>
              <Button label="Email me a code" onPress={sendCode} loading={busy} />
            </Card>
          ) : (
            <Card style={{ gap: 14 }}>
              <Notice tone="good">
                If an account matches {login.trim()}, we’ve emailed it a 6-digit code. It works for {minutes} minutes. Check your spam folder if you can’t see it.
              </Notice>
              <Input
                label="Code"
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, '').slice(0, 6));
                  setErrors((x) => ({ ...x, code: '' }));
                }}
                error={errors.code}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                placeholder="123456"
                maxLength={6}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Input
                ref={passwordRef}
                label="New password"
                password
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setErrors((x) => ({ ...x, password: '' }));
                }}
                error={errors.password}
                hint={`At least ${MIN_PASSWORD} characters. You’ll be signed out on other phones.`}
                autoComplete="new-password"
                textContentType="newPassword"
                maxLength={200}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              <ErrorNotice>{error}</ErrorNotice>
              <Button label="Reset password and sign in" onPress={submit} loading={busy} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={wait > 0 || busy}
                  onPress={() => {
                    setCode('');
                    sendCode();
                  }}
                  hitSlop={8}
                >
                  <T variant="small" style={{ color: wait > 0 ? colors.muted : colors.gold, fontFamily: fonts.semibold }}>
                    {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
                  </T>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setStep('ask');
                    setCode('');
                    setError('');
                  }}
                  hitSlop={8}
                >
                  <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
                    Use a different one
                  </T>
                </Pressable>
              </View>
            </Card>
          )}

          <Pressable accessibilityRole="button" onPress={() => router.replace('/signin')} hitSlop={8}>
            <T variant="small" style={{ textAlign: 'center' }}>
              Remembered it? <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>Sign in</T>
            </T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
