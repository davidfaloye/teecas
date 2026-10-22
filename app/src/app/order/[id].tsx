// Order tracking. Live orders refresh from the admin every 10 seconds; demo orders show what
// was sent on WhatsApp.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchOrder } from '../../api';
import { Row } from '../../components/Row';
import { Button, Card, Header, Notice, T } from '../../components/ui';
import { useStore } from '../../store';
import { colors, fonts, naira } from '../../theme';
import type { Branch, Order, OrderStatus } from '../../types';

// Same four stages as the Teecas order board. "Preparing" and "Ready" (used by the kitchen
// view, which is off for now) count as Accepted.
const STEPS: { status: OrderStatus; label: string; hint: string }[] = [
  { status: 'placed', label: 'Order sent', hint: 'Waiting for Teecas to accept it' },
  { status: 'accepted', label: 'Accepted', hint: 'Your food is being prepared' },
  { status: 'out_for_delivery', label: 'On the way', hint: 'Have your payment ready' },
  { status: 'completed', label: 'Delivered', hint: 'Enjoy your meal' },
];
const stepOf = (s: OrderStatus): OrderStatus => (s === 'preparing' || s === 'ready' ? 'accepted' : s);

const time = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
};

export default function OrderScreen() {
  const { id, token, fresh } = useLocalSearchParams<{ id: string; token?: string; fresh?: string }>();
  const { orders } = useStore();
  const insets = useSafeAreaInsets();
  const saved = orders.find((o) => o.id === id);
  const [order, setOrder] = useState<Order | null>(saved?.snapshot || null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [waUrl, setWaUrl] = useState(saved?.whatsappUrl || '');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const live = !saved?.demo && Boolean(token || saved?.token);

  const load = useCallback(async () => {
    if (!live) return;
    try {
      const d = await fetchOrder(String(id), String(token || saved?.token));
      setOrder(d.order);
      setBranch(d.branch);
      if (d.whatsapp) setWaUrl(d.whatsapp.url);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, token, saved?.token, live]);

  useEffect(() => {
    load();
    if (!live) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, live]);

  const done = order && ['completed', 'cancelled'].includes(order.status);
  const steps = STEPS.filter((s) => order?.fulfilment === 'delivery' || s.status !== 'out_for_delivery').map((s) =>
    order?.fulfilment === 'pickup' && s.status === 'completed' ? { ...s, label: 'Picked up' } : s,
  );
  const reached = new Map<OrderStatus, string>();
  for (const h of order?.statusHistory || []) if (!reached.has(stepOf(h.status))) reached.set(stepOf(h.status), h.at);
  const currentIdx = order ? steps.findIndex((s) => s.status === stepOf(order.status)) : 0;
  const branchName = order?.branchName || '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={order ? `Order #${order.number}` : 'Your order'} subtitle={order ? `${branchName || 'Teecas'} · ${order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}` : undefined} back={!fresh} />
      {!order && !error && <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 120 }}
        refreshControl={live ? <RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} /> : undefined}
      >
        {error ? <Notice tone="bad">{error}</Notice> : null}
        {order && (
          <>
            {fresh ? (
              <Card style={{ gap: 10, borderColor: colors.gold }}>
                <T variant="h3">Thank you, {order.customer.name.split(' ')[0]}!</T>
                <T variant="small">
                  {saved?.demo
                    ? 'WhatsApp opened with your order pre-written for Teecas. Tap send so the restaurant gets it.'
                    : 'Teecas has your order and will send it from the branch that can get it to you fastest. WhatsApp also opened with it pre-written; tap send so they have it there too.'}
                </T>
                {waUrl ? <Button label="Open WhatsApp again" kind="ghost" onPress={() => Linking.openURL(waUrl).catch(() => {})} /> : null}
              </Card>
            ) : null}

            {order.status === 'cancelled' ? (
              <Notice tone="bad">This order was cancelled{order.cancelReason ? `: ${order.cancelReason}` : '.'}</Notice>
            ) : saved?.demo ? (
              <Notice>Demo order: it went to the restaurant on WhatsApp only. With the admin connected, this screen follows the order live.</Notice>
            ) : (
              <Card style={{ gap: 0 }}>
                {steps.map((s, i) => {
                  const isDone = i <= currentIdx;
                  const isNow = i === currentIdx && !done;
                  return (
                    <View key={s.status} style={st.step}>
                      <View style={{ alignItems: 'center' }}>
                        <View style={[st.dot, isDone && { backgroundColor: colors.gold, borderColor: colors.gold }, isNow && { backgroundColor: colors.paprika, borderColor: colors.paprika }]} />
                        {i < steps.length - 1 && <View style={[st.bar, i < currentIdx && { backgroundColor: colors.gold }]} />}
                      </View>
                      <View style={{ flex: 1, paddingBottom: 18 }}>
                        <T variant={isNow ? 'bold' : 'medium'} style={{ color: isDone ? colors.cream : colors.muted }}>
                          {s.label}
                          {reached.get(s.status) ? <T variant="mono" style={{ fontSize: 12 }}>{'  '}{time(reached.get(s.status)!)}</T> : null}
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
              {order.items.map((i) => (
                <Row key={i.name} k={`${i.qty}× ${i.name}`} v={naira(i.lineTotal)} />
              ))}
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

            {branch?.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:+${branch.phone}`).catch(() => {})} accessibilityRole="button">
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
