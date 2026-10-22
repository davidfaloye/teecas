import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, placeOrder } from '../api';
import { Button, Card, Header, Notice, T } from '../components/ui';
import { useStore } from '../store';
import { colors, fonts, naira, radius } from '../theme';
import { Row } from '../components/Row';

// Nigerian numbers: 0803 123 4567 or +234 803 123 4567.
function validPhone(p: string) {
  const d = p.replace(/[^\d]/g, '');
  return (d.length === 11 && d.startsWith('0')) || (d.length === 13 && d.startsWith('234')) || (d.length >= 10 && d.length <= 15 && p.trim().startsWith('+'));
}

export default function Checkout() {
  const { cart, subtotal, customer, setCustomer, clearCart, saveOrder, syncCart } = useStore();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.address);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lines = Object.values(cart).map(({ item, qty }) => ({ item, qty }));

  if (lines.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="Checkout" />
        <View style={{ padding: 20 }}>
          <Button label="Back to the menu" kind="gold" onPress={() => router.replace('/menu')} />
        </View>
      </View>
    );
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your name.';
    if (!validPhone(phone)) e.phone = 'Enter a phone number like 0803 123 4567.';
    if (address.trim().length < 5) e.address = 'Tell us where to deliver.';
    setErrors(e);
    setError('');
    if (Object.values(e).some(Boolean)) return;
    const details = { name: name.trim(), phone: phone.trim(), address: address.trim() };
    setCustomer(details);
    setBusy(true);
    try {
      const placed = await placeOrder({ customer: details, note: note.trim(), lines });
      saveOrder({
        id: placed.order.id,
        number: placed.order.number,
        token: placed.order.trackingToken,
        branchName: placed.order.branchName,
        total: placed.order.total,
        createdAt: placed.order.createdAt,
        demo: placed.demo,
        whatsappUrl: placed.whatsapp.url,
        snapshot: placed.demo ? placed.order : undefined,
      });
      clearCart();
      router.replace({ pathname: '/order/[id]', params: { id: placed.order.id, token: placed.order.trackingToken || '', fresh: '1' } });
      // Same as the website: the order goes to Teecas's WhatsApp, pre-written.
      Linking.openURL(placed.whatsapp.url).catch(() => {});
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message);
      if (ae.code === 'ITEM_UNAVAILABLE' && ae.details?.unavailable) {
        // Mark them sold out so the cart shows what to remove.
        const gone = new Set(ae.details.unavailable);
        syncCart(lines.map((l) => ({ ...l.item, available: !gone.has(l.item.name) })));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Checkout" subtitle="Delivery · pay on delivery" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 130 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 14 }}>
            <T variant="h3">Your details</T>
            <Input label="Name" value={name} onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: "" })); }} error={errors.name} autoComplete="name" textContentType="name" />
            <Input label="Phone number" value={phone} onChangeText={(v) => { setPhone(v); setErrors((e) => ({ ...e, phone: "" })); }} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="0803 123 4567" />
            <Input label="Delivery address" value={address} onChangeText={(v) => { setAddress(v); setErrors((e) => ({ ...e, address: "" })); }} error={errors.address} multiline placeholder="House number, street, area, landmark" autoComplete="street-address" />
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
        <Button label={`Place order · ${naira(subtotal)}`} onPress={submit} loading={busy} />
      </View>
    </View>
  );
}

function Input({ label, error, ...props }: { label: string; error?: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" style={{ fontFamily: fonts.semibold }}>
        {label}
      </T>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.gold}
        style={[s.input, props.multiline && { minHeight: 76, textAlignVertical: 'top' }, error ? { borderColor: colors.bad } : null]}
        accessibilityLabel={label}
        {...props}
      />
      {error ? (
        <T variant="small" style={{ color: colors.bad }}>
          {error}
        </T>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.cream, fontFamily: fonts.body, fontSize: 16 },
  pay: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: 'rgba(217,161,91,0.08)' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(27,18,13,0.96)', borderTopWidth: 1, borderTopColor: colors.line },
});
