// Order tracking. Live orders refresh from the admin every 10 seconds until they are delivered or
// cancelled. Anything the admin does to the order (accept, reassign, cancel, edit) must show here
// without crashing, so every field is read through the API normaliser.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DONE_STATUSES, fetchOrder, friendlyError } from '../../api';
import { Row } from '../../components/Row';
import { Button, Card, Header, Notice, T } from '../../components/ui';
import { useStore } from '../../store';
import { clock, colors, fonts, naira } from '../../theme';

// Same four stages as the Teecas order board. "Preparing" and "Ready" (used by the kitchen view)
// count as Accepted.
const STEPS = [
  { status: 'placed', label: 'Order sent', hint: 'Waiting for Teecas to accept it' },
  { status: 'accepted', label: 'Accepted', hint: 'Your food is being prepared' },
  { status: 'out_for_delivery', label: 'On the way', hint: 'Have your payment ready' },
  { status: 'completed', label: 'Delivered', hint: 'Enjoy your meal' },
];
const stepOf = (s) => (s === 'preparing' || s === 'ready' ? 'accepted' : s);
const first = (v) => (Array.isArray(v) ? v[0] : v) || '';

// Branch numbers come in as 0803…, 234803… or +234803…
function telUrl(phone) {
  const d = String(phone || '').replace(/[^\d]/g, '');
  if (d.length < 7) return '';
  return d.startsWith('234') ? `tel:+${d}` : `tel:${d}`;
}

export default function OrderScreen() {
  const params = useLocalSearchParams();
  const id = first(params.id);
  const fresh = first(params.fresh) === '1';
  const { orders, updateOrder } = useStore();
  const insets = useSafeAreaInsets();
  const saved = orders.find((o) => o.id === id);
  const token = first(params.token) || saved?.token || '';
  const isDemo = Boolean(saved?.demo) || id.startsWith('demo-');
  const live = !isDemo && Boolean(id && token);

  const [order, setOrder] = useState(saved?.snapshot || null);
  const [branch, setBranch] = useState(null);
  const [waUrl, setWaUrl] = useState(saved?.whatsappUrl || '');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(live);
  const finished = useRef(false);

  const load = useCallback(async () => {
    if (!live) return;
    try {
      const d = await fetchOrder(id, token);
      setOrder(d.order);
      setBranch(d.branch);
      if (d.whatsapp?.url) setWaUrl(d.whatsapp.url);
      setError('');
      finished.current = DONE_STATUSES.includes(d.order.status);
      updateOrder(id, { lastStatus: d.order.status, branchName: d.order.branchName, total: d.order.total, gone: false });
    } catch (e) {
      setError(e?.code === 'NOT_FOUND' ? 'Teecas can no longer find this order. If you were expecting it, call or WhatsApp the restaurant.' : friendlyError(e));
      if (e?.code === 'NOT_FOUND') {
        finished.current = true;
        updateOrder(id, { gone: true });
      }
    } finally {
      setLoading(false);
    }
  }, [id, token, live, updateOrder]);

  useEffect(() => {
    if (!live) return;
    finished.current = false;
    Promise.resolve().then(load);
    const t = setInterval(() => {
      if (!finished.current) load();
    }, 10000);
    return () => clearInterval(t);
  }, [load, live]);

  const done = Boolean(order && DONE_STATUSES.includes(order.status));
  const steps = STEPS.filter((s) => order?.fulfilment !== 'pickup' || s.status !== 'out_for_delivery').map((s) =>
    order?.fulfilment === 'pickup' && s.status === 'completed' ? { ...s, label: 'Picked up' } : s,
  );
  const reached = new Map();
  for (const h of order?.statusHistory || []) if (!reached.has(stepOf(h.status))) reached.set(stepOf(h.status), h.at);
  const currentIdx = order ? Math.max(0, steps.findIndex((s) => s.status === stepOf(order.status))) : 0;
  const branchName = order?.branchName || '';
  const firstName = (order?.customer?.name || '').trim().split(/\s+/)[0];
  const call = telUrl(branch?.phone);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={order ? `Order #${order.number}` : saved ? `Order #${saved.number}` : 'Your order'}
        subtitle={order ? `${branchName || 'Teecas'} · ${order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}` : undefined}
        back={!fresh}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 120 }}
        refreshControl={
          live ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.gold}
              onRefresh={async () => {
                setRefreshing(true);
                finished.current = false;
                await load();
                setRefreshing(false);
              }}
            />
          ) : undefined
        }
      >
        {loading && !order ? <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} /> : null}
        {error ? <Notice tone="bad">{order ? `Couldn't refresh: ${error}` : error}</Notice> : null}

        {!order && !live && !loading ? (
          <Card style={{ gap: 10 }}>
            <T variant="h3">We can’t show this order</T>
            <T variant="small">This order was placed without tracking, so its status can’t be followed from this phone. For an update, message Teecas on WhatsApp.</T>
            {waUrl ? <Button label="Open WhatsApp" kind="ghost" onPress={() => Linking.openURL(waUrl).catch(() => {})} /> : null}
          </Card>
        ) : null}

        {order && (
          <>
            {fresh ? (
              <Card style={{ gap: 10, borderColor: colors.gold }}>
                <T variant="h3">Thank you{firstName ? `, ${firstName}` : ''}!</T>
                <T variant="small">
                  {isDemo
                    ? 'WhatsApp opened with your order written out for Teecas. Tap send so the restaurant gets it.'
                    : 'Teecas has your order and will send it from the branch that can get it to you fastest. WhatsApp also opened with it written out; tap send so they have it there too.'}
                </T>
                {waUrl ? <Button label="Open WhatsApp again" kind="ghost" onPress={() => Linking.openURL(waUrl).catch(() => {})} /> : null}
              </Card>
            ) : null}

            {order.status === 'cancelled' ? (
              <Notice tone="bad">This order was cancelled{order.cancelReason ? `: ${order.cancelReason}` : '.'}</Notice>
            ) : isDemo ? (
              <Card style={{ gap: 6 }}>
                <T variant="bold">Sent to Teecas on WhatsApp</T>
                <T variant="small">The restaurant will confirm your order and delivery time in the WhatsApp chat.</T>
              </Card>
            ) : (
              <Card style={{ gap: 0 }}>
                {steps.map((s, i) => {
                  const isDone = i <= currentIdx;
                  const isNow = i === currentIdx && !done;
                  const at = reached.get(s.status);
                  return (
                    <View key={s.status} style={st.step}>
                      <View style={{ alignItems: 'center' }}>
                        <View style={[st.dot, isDone && { backgroundColor: colors.gold, borderColor: colors.gold }, isNow && { backgroundColor: colors.paprika, borderColor: colors.paprika }]} />
                        {i < steps.length - 1 && <View style={[st.bar, i < currentIdx && { backgroundColor: colors.gold }]} />}
                      </View>
                      <View style={{ flex: 1, paddingBottom: 18 }}>
                        <T variant={isNow ? 'bold' : 'medium'} style={{ color: isDone ? colors.cream : colors.muted }}>
                          {s.label}
                          {at && clock(at) ? (
                            <T variant="mono" style={{ fontSize: 12 }}>
                              {'  '}
                              {clock(at)}
                            </T>
                          ) : null}
                        </T>
                        {isNow ? <T variant="small">{s.status === 'accepted' && branchName ? `${branchName} is preparing your food` : s.hint}</T> : null}
                      </View>
                    </View>
                  );
                })}
                {!done && (
                  <T variant="muted" style={{ textAlign: 'center' }}>
                    Updates automatically
                  </T>
                )}
              </Card>
            )}

            <Card style={{ gap: 8 }}>
              <T variant="h3" style={{ marginBottom: 4 }}>
                What you ordered
              </T>
              {order.items.length ? (
                order.items.map((i, idx) => <Row key={`${i.name}-${idx}`} k={`${i.qty}× ${i.name}`} v={naira(i.lineTotal)} />)
              ) : (
                <T variant="muted">The item list isn’t available.</T>
              )}
              {order.deliveryFee > 0 && <Row k="Delivery" v={naira(order.deliveryFee)} />}
              <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
              <Row k={order.paymentStatus === 'paid' ? 'Paid' : 'To pay on delivery'} v={naira(order.total)} big />
              {order.deliveryFeeExcluded ? (
                <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
                  Delivery fee excluded
                </T>
              ) : null}
              {order.fulfilment === 'delivery' && order.customer.address ? <T variant="muted">Delivering to {order.customer.address}</T> : null}
            </Card>

            {call && branch ? (
              <Pressable onPress={() => Linking.openURL(call).catch(() => {})} accessibilityRole="button">
                <T variant="small" style={{ textAlign: 'center', color: colors.gold, fontFamily: fonts.semibold }}>
                  Call {branch.name}
                </T>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={[st.foot, { paddingBottom: insets.bottom + 12 }]}>
        <Button label={fresh ? 'Back to the menu' : 'Order again'} kind="gold" onPress={() => router.replace('/menu')} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  step: { flexDirection: 'row', gap: 14 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.bg, marginTop: 3 },
  bar: { width: 2, flex: 1, backgroundColor: colors.line, marginVertical: 2 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(27,18,13,0.96)', borderTopWidth: 1, borderTopColor: colors.line },
});
