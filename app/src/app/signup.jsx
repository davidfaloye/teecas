// Create an account: name, phone number, password and (optionally) a delivery address. Orders
// already placed on this phone as a guest move into the new account.

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_MODE, friendlyError, signUp } from '../api';
import { guestOrderKeys, leaveAuth } from '../authFlow';
import { Input } from '../components/Input';
import { Button, Card, Header, Notice, T } from '../components/ui';
import { validPhone } from '../phone';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const MIN_PASSWORD = 6; // same as the server

export default function SignUp() {
  const insets = useSafeAreaInsets();
  const { customer, orders, startSession } = useStore();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.address);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [phoneTaken, setPhoneTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);

  const field = (key, set) => (v) => {
    set(v);
    setErrors((x) => ({ ...x, [key]: '' }));
    if (key === 'phone') setPhoneTaken(false);
  };

  async function submit() {
    if (busy) return;
    const e = {};
    if (name.trim().length < 2) e.name = 'Enter your name.';
    if (!validPhone(phone)) e.phone = 'Enter a phone number like 0803 123 4567.';
    if (password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
    setErrors(e);
    setError('');
    setPhoneTaken(false);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const session = await signUp({
        name: name.trim(),
        phone: phone.trim(),
        password,
        address: address.trim(),
        claim: guestOrderKeys(orders),
      });
      startSession(session);
      leaveAuth();
    } catch (err) {
      if (err?.code === 'PHONE_TAKEN') setPhoneTaken(true);
      else setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Create an account" subtitle="Faster checkout, your orders on any phone" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          {DEMO_MODE ? <Notice>Accounts need the Teecas server. This preview runs on sample data, so sign-up won’t work here.</Notice> : null}
          <Card style={{ gap: 14 }}>
            <Input
              label="Name"
              value={name}
              onChangeText={field('name', setName)}
              error={errors.name}
              autoComplete="name"
              textContentType="name"
              maxLength={80}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            <Input
              ref={phoneRef}
              label="Phone number"
              value={phone}
              onChangeText={field('phone', setPhone)}
              error={errors.phone}
              hint="You’ll sign in with this number."
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="0803 123 4567"
              maxLength={20}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            {phoneTaken ? (
              <Notice>
                This number already has an account.{' '}
                <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }} onPress={() => router.replace('/signin')}>
                  Sign in instead
                </T>
              </Notice>
            ) : null}
            <Input
              ref={passwordRef}
              label="Password"
              password
              value={password}
              onChangeText={field('password', setPassword)}
              error={errors.password}
              hint={`At least ${MIN_PASSWORD} characters.`}
              autoComplete="new-password"
              textContentType="newPassword"
              maxLength={200}
            />
            <Input
              label="Delivery address (optional)"
              value={address}
              onChangeText={setAddress}
              multiline
              placeholder="House number, street, area, landmark"
              autoComplete="street-address"
              maxLength={300}
            />
            {error ? <Notice tone="bad">{error}</Notice> : null}
            <Button label="Create account" onPress={submit} loading={busy} />
            <T variant="muted" style={{ textAlign: 'center' }}>
              By creating an account you agree to the{' '}
              <T variant="muted" style={{ color: colors.gold }} onPress={() => router.push('/terms')}>
                terms of service
              </T>
              .
            </T>
          </Card>

          <Pressable accessibilityRole="button" onPress={() => router.replace('/signin')} hitSlop={8}>
            <T variant="small" style={{ textAlign: 'center' }}>
              Already have an account? <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>Sign in</T>
            </T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
