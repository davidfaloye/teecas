import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBranches, fetchSoldOutAt, friendlyError, placeOrder } from '../api';
import { Input } from '../components/Input';
import { Row } from '../components/Row';
import { ErrorNotice, Button, Card, Header, Notice, T } from '../components/ui';
import { pushTokenForOrder } from '../notifications';
import { validPhone } from '../phone';
import { useStore } from '../store';
import { colors, fonts, naira, radius, themed } from '../theme';

// Delivery or pickup. Delivery orders carry no branch (Teecas picks one). For pickup the customer
// chooses the branch they'll collect from, and only that branch gets the order. The choice and
// the branch are remembered for next time.
export default function Checkout() {
  const { cart, subtotal, customer, setCustomer, clearCart, saveOrder, markSoldOut, open, settings, updateSettings, pushToken, setPushToken, account } = useStore();
  const [fulfilment, setFulfilment] = useState(settings.fulfilment === 'pickup' ? 'pickup' : 'delivery');
  const pickup = fulfilment === 'pickup';
  const [pickupId, setPickupId] = useState(settings.pickupBranchId || '');
  const [branches, setBranches] = useState(null); // null while loading
  const [branchError, setBranchError] = useState('');
  const [soldOut_, setSoldOut_] = useState(null); // { branchId, ids }: what's sold out at a pickup branch
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
  const loadBranches = useCallback(() => {
    fetchBranches()
      .then((list) => {
        setBranchError('');
        setBranches(list);
      })
      .catch((err) => {
        setBranches([]);
        setBranchError(friendlyError(err));
      });
  }, []);
  useEffect(() => {
    if (pickup && branches === null) loadBranches();
  }, [pickup, branches, loadBranches]);

  // Forget a remembered branch that has closed or gone; with only one open branch, choose it.
  const openBranches = (branches || []).filter((b) => b.acceptingOrders);
  const chosen = openBranches.find((b) => b.id === pickupId) || null;
  if (branches && pickupId && !chosen) setPickupId('');
  if (branches && !pickupId && openBranches.length === 1) setPickupId(openBranches[0].id);

  // What's sold out at the chosen branch (null until it has loaded for that branch).
  const checkSoldOut = useCallback((branchId) => {
    fetchSoldOutAt(branchId)
      .then((ids) => setSoldOut_({ branchId, ids }))
      .catch(() => setSoldOut_({ branchId, ids: new Set() }));
  }, []);
  useEffect(() => {
    if (pickup && pickupId) checkSoldOut(pickupId);
  }, [pickup, pickupId, checkSoldOut]);
  const soldOutHere = soldOut_ && soldOut_.branchId === pickupId ? soldOut_.ids : null;

  const lines = Object.values(cart).map(({ item, qty }) => ({ item, qty }));
  const soldOut = lines.filter((l) => !l.item.available);
  const soldOutAtBranch = pickup && soldOutHere ? lines.filter((l) => l.item.available && soldOutHere.has(l.item.id)) : [];

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
    if (!pickup && address.trim().length < 5) e.address = 'Tell us where to deliver.';
    if (pickup && !chosen) e.branch = 'Choose the branch you’ll pick up from.';
    setErrors(e);
    setError('');
    if (Object.keys(e).length) return;
    if (soldOut.length) {
      setError(`${soldOut.map((l) => l.item.name).join(', ')} sold out. Go back and remove it to continue.`);
      return;
    }
    if (soldOutAtBranch.length) {
      setError(`Sold out at ${chosen.name}: ${soldOutAtBranch.map((l) => l.item.name).join(', ')}. Remove it, or choose another branch.`);
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
      const placed = await placeOrder({
        fulfilment,
        branchId: pickup ? chosen.id : undefined,
        customer: details,
        note: note.trim(),
        lines,
        pushToken: token,
        auth: account?.token,
      });
      updateSettings({ fulfilment, pickupBranchId: pickup ? chosen.id : settings.pickupBranchId || '' });
      const waUrl = placed.whatsapp?.url || '';
      saveOrder({
        id: placed.order.id,
        number: placed.order.number,
        token: placed.order.trackingToken,
        branchName: placed.order.branchName,
        fulfilment: placed.order.fulfilment,
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
      setError(
        err?.code === 'TIMEOUT'
          ? 'This is taking longer than usual. Your order may still have gone through, so check My orders before you place it again.'
          : friendlyError(err),
      );
      if (err?.code === 'ITEM_UNAVAILABLE') {
        // Sold out at the pickup branch only: show it there, don't mark it sold out everywhere.
        if (pickup) checkSoldOut(chosen.id);
        else markSoldOut(err.details?.unavailable);
      }
      if (err?.code === 'BRANCH_CLOSED') {
        if (pickup) {
          setError(`${chosen?.name || 'That branch'} isn’t taking orders right now. Choose another branch, or switch to delivery.`);
          setBranches(null); // reload which branches are open
        } else setError("Teecas Amala isn't taking orders right now. Please try again later.");
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Checkout" subtitle={pickup ? 'Pickup · pay when you collect' : 'Delivery · pay on delivery'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 130 }} keyboardShouldPersistTaps="handled">
          {!account ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/signin')} style={({ pressed }) => [s.signin, pressed && { opacity: 0.85 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bold">Have an account? Sign in</T>
                <T variant="muted">Your details fill in and your orders are saved, on any phone. Or carry on as a guest.</T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gold} />
            </Pressable>
          ) : null}
          <Card style={{ gap: 12 }}>
            <T variant="h3">How would you like it?</T>
            <View style={s.modes} accessibilityRole="radiogroup">
              {[
                ['delivery', 'Delivery', 'We bring it to you', 'bicycle-outline'],
                ['pickup', 'Pickup', 'Collect it from a branch', 'storefront-outline'],
              ].map(([key, label, sub, icon]) => {
                const on = fulfilment === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${label}. ${sub}`}
                    onPress={() => {
                      setFulfilment(key);
                      setErrors({});
                      setError('');
                    }}
                    style={({ pressed }) => [s.mode, on && s.modeOn, pressed && { opacity: 0.85 }]}
                  >
                    <Ionicons name={icon} size={22} color={on ? colors.paprika : colors.creamDim} />
                    <T variant="bold" style={on ? { color: colors.paprika } : null}>
                      {label}
                    </T>
                    <T variant="muted" style={{ textAlign: 'center' }}>
                      {sub}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {pickup ? (
            <Card style={{ gap: 10 }}>
              <T variant="h3">Pick up from</T>
              {branches === null ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 }}>
                  <ActivityIndicator color={colors.gold} />
                  <T variant="muted">Loading branches…</T>
                </View>
              ) : branchError ? (
                <>
                  <ErrorNotice>{branchError}</ErrorNotice>
                  <Button label="Try again" kind="ghost" onPress={() => setBranches(null)} />
                </>
              ) : (
                branches.map((b) => {
                  const on = b.id === pickupId;
                  const closed = !b.acceptingOrders;
                  return (
                    <Pressable
                      key={b.id}
                      disabled={closed}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on, disabled: closed }}
                      onPress={() => {
                        setPickupId(b.id);
                        setErrors((x) => ({ ...x, branch: '' }));
                        setError('');
                      }}
                      style={({ pressed }) => [s.branch, on && s.branchOn, closed && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
                    >
                      <View style={[s.radio, !on && { borderColor: colors.line }]}>{on ? <View style={s.radioDot} /> : null}</View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="bold">{b.name}</T>
                        {b.address ? <T variant="muted">{b.address}</T> : null}
                        {b.landmark ? <T variant="muted">{b.landmark}</T> : null}
                        {closed ? (
                          <T variant="small" style={{ color: colors.bad }}>
                            Not taking orders right now
                          </T>
                        ) : b.hours ? (
                          <T variant="muted">{b.hours}</T>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
              {errors.branch ? (
                <T variant="small" style={{ color: colors.bad }}>
                  {errors.branch}
                </T>
              ) : null}
              {soldOutAtBranch.length ? (
                <Notice tone="bad">
                  Sold out at {chosen?.name}: {soldOutAtBranch.map((l) => l.item.name).join(', ')}. Remove it from your order, or choose another branch.
                </Notice>
              ) : null}
            </Card>
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
            {pickup ? null : (
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
            )}
            <Input label="Note for the kitchen (optional)" value={note} onChangeText={setNote} placeholder="e.g. Extra pepper, no onions" maxLength={300} />
          </Card>

          <Card style={{ gap: 10 }}>
            <T variant="h3">Payment</T>
            <View style={s.pay} accessibilityRole="radio" accessibilityState={{ checked: true }}>
              <View style={s.radio}>
                <View style={s.radioDot} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bold">{pickup ? 'Pay when you collect' : 'Pay on delivery'}</T>
                <T variant="muted">{pickup ? 'Cash, bank transfer or POS at the counter.' : 'Cash, bank transfer or POS when your food arrives.'}</T>
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
            {pickup ? (
              <T variant="muted">
                {chosen ? `Ready to collect at ${chosen.name} as soon as it’s prepared.` : 'Ready to collect as soon as it’s prepared.'} We’ll tell you when to come.
              </T>
            ) : (
              <>
                <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
                  Delivery fee excluded
                </T>
                <T variant="muted">The delivery fee is settled with the rider.</T>
              </>
            )}
          </Card>

          <T variant="muted" style={{ textAlign: 'center' }}>
            When you place your order, WhatsApp opens with it written out for Teecas Amala. Tap send so the restaurant has it.
          </T>
          <ErrorNotice>{error}</ErrorNotice>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[s.foot, { paddingBottom: insets.bottom + 12 }]}>
        <Button label={`Place order · ${naira(subtotal)}`} onPress={submit} loading={busy} disabled={!open || (pickup && soldOutAtBranch.length > 0)} />
        {!open && (
          <T variant="small" style={{ color: colors.bad, textAlign: 'center', marginTop: 6 }}>
            Teecas Amala isn’t taking orders right now.
          </T>
        )}
      </View>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  signin: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold + '66', backgroundColor: colors.goldTint },
  modes: { flexDirection: 'row', gap: 10 },
  mode: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 8, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.bg },
  modeOn: { borderColor: colors.paprika, backgroundColor: colors.goldTint },
  branch: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  branchOn: { borderColor: colors.gold, backgroundColor: colors.goldTint },
  pay: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldTint },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bar, borderTopWidth: 1, borderTopColor: colors.line },
}));
