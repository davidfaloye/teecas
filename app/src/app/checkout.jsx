import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendlyError, placeOrder } from '../api';
import { Input } from '../components/Input';
import { Row } from '../components/Row';
import { Button, Card, Header, Notice, T } from '../components/ui';
import { pushTokenForOrder } from '../notifications';
import { validPhone } from '../phone';
import { useStore } from '../store';
import { colors, fonts, naira, radius, themed } from '../theme';

export default function Checkout() {
  const { cart, subtotal, customer, setCustomer, clearCart, saveOrder, markSoldOut, open, settings, pushToken, setPushToken, account } = useStore();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.address);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false); // stops a double tap placing two orders

  // Signed in from the prompt above: fill in what's still empty from the account.
  const accountId = account?.customer.id || '';
  const [filledFor, setFilledFor] = useState(accountId);
  if (accountId !== filledFor) {
    setFilledFor(accountId);
    if (accountId) {
      if (!name) setName(customer.name);
      if (!phone) setPhone(customer.phone);
      if (!address) setAddress(customer.address);
    }
  }
  const lines = Object.values(cart).map(({ item, qty }) => ({ item, qty }));
  const soldOut = lines.filter((l) => !l.item.available);

  if (lines.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="Checkout" />
        <View style={{ padding: 20, gap: 12 }}>
          <T variant="small">Your order is empty.</T>
          <Button label="Back to the menu" kind="gold" onPress={() => router.replace('/menu')} />
        </View>
      </View>
    );
  }

  async function submit() {
    if (submitting.current) return;
    const e = {};
    if (name.trim().length < 2) e.name = 'Enter your name.';
    if (!validPhone(phone)) e.phone = 'Enter a phone number like 0803 123 4567.';
    if (address.trim().length < 5) e.address = 'Tell us where to deliver.';
    setErrors(e);
    setError('');
    if (Object.keys(e).length) return;
    if (soldOut.length) {
      setError(`${soldOut.map((l) => l.item.name).join(', ')} sold out. Go back and remove it to continue.`);
      return;
    }

    const details = { name: name.trim(), phone: phone.trim(), address: address.trim() };
    setCustomer(details);
    submitting.current = true;
    setBusy(true);
    try {
      let token = '';
      if (settings.notifications) {
        token = await pushTokenForOrder(pushToken);
        if (token && token !== pushToken) setPushToken(token);
      }
      // Signed in: the order is saved to the account. (An expired sign-in is placed as a guest.)
      const placed = await placeOrder({ customer: details, note: note.trim(), lines, pushToken: token, auth: account?.token });
      const waUrl = placed.whatsapp?.url || '';
      saveOrder({
        id: placed.order.id,
        number: placed.order.number,
        token: placed.order.trackingToken,
        branchName: placed.order.branchName,
        total: placed.order.total,
        createdAt: placed.order.createdAt,
        demo: placed.demo,
        whatsappUrl: waUrl,
        lastStatus: placed.order.status,
        customerId: account?.customer.id, // placed while signed in: removed from the phone on log out
        push: Boolean(token) && !placed.demo,
        snapshot: placed.demo ? placed.order : undefined,
      });
      clearCart();
      router.replace({ pathname: '/order/[id]', params: { id: placed.order.id, token: placed.order.trackingToken || '', fresh: '1' } });
      // Same as the website: the order goes to Teecas's WhatsApp, pre-written.
      if (waUrl) Linking.openURL(waUrl).catch(() => {});
    } catch (err) {
      setError(friendlyError(err));
      if (err?.code === 'ITEM_UNAVAILABLE') markSoldOut(err.details?.unavailable);
      if (err?.code === 'BRANCH_CLOSED') setError("Teecas isn't taking orders right now. Please try again later.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Checkout" subtitle="Delivery · pay on delivery" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 130 }} keyboardShouldPersistTaps="handled">
          {!account ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/signin')} style={({ pressed }) => [s.signin, pressed && { opacity: 0.85 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bold">Have an account? Sign in</T>
                <T variant="muted">Your details fill in and your orders are saved, on any phone. Or carry on as a guest.</T>
              </View>
              <T style={{ color: colors.gold, fontFamily: fonts.medium, fontSize: 18 }}>›</T>
            </Pressable>
          ) : null}
          <Card style={{ gap: 14 }}>
            <T variant="h3">Your details</T>
            {account ? <T variant="muted">Signed in as {account.customer.name}. This order is saved to your account.</T> : null}
            <Input
              label="Name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setErrors((x) => ({ ...x, name: '' }));
              }}
              error={errors.name}
              autoComplete="name"
              textContentType="name"
              maxLength={80}
            />
            <Input
              label="Phone number"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setErrors((x) => ({ ...x, phone: '' }));
              }}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="0803 123 4567"
              maxLength={20}
            />
            <Input
              label="Delivery address"
              value={address}
              onChangeText={(v) => {
                setAddress(v);
                setErrors((x) => ({ ...x, address: '' }));
              }}
              error={errors.address}
              multiline
              placeholder="House number, street, area, landmark"
              autoComplete="street-address"
              maxLength={300}
            />
            <Input label="Note for the kitchen (optional)" value={note} onChangeText={setNote} placeholder="e.g. Extra pepper, no onions" maxLength={300} />
          </Card>

          <Card style={{ gap: 10 }}>
            <T variant="h3">Payment</T>
            <View style={s.pay} accessibilityRole="radio" accessibilityState={{ checked: true }}>
              <View style={s.radio}>
                <View style={s.radioDot} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bold">Pay on delivery</T>
                <T variant="muted">Cash, bank transfer or POS when your food arrives.</T>
              </View>
            </View>
          </Card>

          <Card style={{ gap: 8 }}>
            <T variant="h3" style={{ marginBottom: 4 }}>
              Summary
            </T>
            {lines.map((l) => (
              <Row key={l.item.id} k={`${l.qty}× ${l.item.name}`} v={naira(l.qty * l.item.price)} />
            ))}
            <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
            <Row k="Total to pay" v={naira(subtotal)} big />
            <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
              Delivery fee excluded
            </T>
            <T variant="muted">The delivery fee is settled with the rider.</T>
          </Card>

          <T variant="muted" style={{ textAlign: 'center' }}>
            When you place your order, WhatsApp opens with it written out for Teecas. Tap send so the restaurant has it.
          </T>
          {error ? <Notice tone="bad">{error}</Notice> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[s.foot, { paddingBottom: insets.bottom + 12 }]}>
        <Button label={`Place order · ${naira(subtotal)}`} onPress={submit} loading={busy} disabled={!open} />
        {!open && (
          <T variant="small" style={{ color: colors.bad, textAlign: 'center', marginTop: 6 }}>
            Teecas isn’t taking orders right now.
          </T>
        )}
      </View>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  signin: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold + '66', backgroundColor: colors.goldTint },
  pay: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldTint },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bar, borderTopWidth: 1, borderTopColor: colors.line },
}));
