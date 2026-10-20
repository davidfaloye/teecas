import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Row } from '../components/Row';
import { Button, Card, Header, Notice, Stepper, T, tap } from '../components/ui';
import { useStore } from '../store';
import { colors, fonts, naira, radius } from '../theme';
import type { Fulfilment } from '../types';

export default function Cart() {
  const { branch, cart, add, remove, setQty, count, subtotal, fulfilment, setFulfilment, clearCart } = useStore();
  const insets = useSafeAreaInsets();
  const lines = Object.values(cart);
  const deliveryFee = fulfilment === 'delivery' ? branch?.deliveryFee || 0 : 0;
  const soldOut = lines.filter((l) => !l.item.available);

  if (!branch || lines.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="Your order" />
        <View style={{ padding: 24, gap: 16, alignItems: 'center', marginTop: 40 }}>
          <T style={{ fontSize: 48, lineHeight: 56 }}>🍽️</T>
          <T variant="h3">Your plate is empty</T>
          <T variant="small" style={{ textAlign: 'center' }}>
            Add some amala, a soup and your protein from the menu.
          </T>
          <Button label="Back to the menu" kind="gold" onPress={() => router.replace('/menu')} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Your order"
        subtitle={`${branch.name} · ${count} item${count === 1 ? '' : 's'}`}
        right={
          <Pressable accessibilityRole="button" onPress={() => { tap(); clearCart(); }} hitSlop={8}>
            <T variant="small" style={{ color: colors.bad }}>
              Clear
            </T>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 120 }}>
        <View style={s.seg} accessibilityRole="radiogroup">
          {(['delivery', 'pickup'] as Fulfilment[]).map((f) => (
            <Pressable key={f} accessibilityRole="radio" accessibilityState={{ checked: fulfilment === f }} onPress={() => { tap(); setFulfilment(f); }} style={[s.segBtn, fulfilment === f && s.segOn]}>
              <T variant="bold" style={{ color: fulfilment === f ? colors.white : colors.creamDim }}>
                {f === 'delivery' ? 'Delivery' : 'Pickup'}
              </T>
              <T variant="muted" style={{ color: fulfilment === f ? colors.cream : colors.muted, fontSize: 12 }}>
                {f === 'delivery' ? (branch.deliveryFee ? `${naira(branch.deliveryFee)} fee` : 'Free') : `At ${branch.name}`}
              </T>
            </Pressable>
          ))}
        </View>

        {soldOut.length > 0 && <Notice tone="bad">{soldOut.map((l) => l.item.name).join(', ')} sold out at {branch.name}. Remove it to continue.</Notice>}

        <Card style={{ paddingVertical: 4 }}>
          {lines.map((l, i) => (
            <View key={l.item.id} style={[s.line, i > 0 && { borderTopWidth: 1, borderTopColor: colors.lineSoft }]}>
              <T style={{ fontSize: 24, lineHeight: 30 }}>{l.item.emoji || '🍽️'}</T>
              <View style={{ flex: 1 }}>
                <T variant="medium" style={!l.item.available && { textDecorationLine: 'line-through', color: colors.muted }}>
                  {l.item.name}
                </T>
                <T variant="mono" style={{ fontSize: 12 }}>
                  {naira(l.item.price)} × {l.qty} = {naira(l.item.price * l.qty)}
                </T>
              </View>
              {l.item.available ? (
                <Stepper qty={l.qty} label={l.item.name} onAdd={() => add(l.item)} onRemove={() => remove(l.item.id)} />
              ) : (
                <Pressable onPress={() => setQty(l.item.id, 0)} hitSlop={8} accessibilityRole="button">
                  <T variant="small" style={{ color: colors.bad }}>
                    Remove
                  </T>
                </Pressable>
              )}
            </View>
          ))}
        </Card>

        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <T variant="small" style={{ color: colors.gold, textAlign: 'center', fontFamily: fonts.semibold }}>
            + Add more from the menu
          </T>
        </Pressable>

        <Card style={{ gap: 8 }}>
          <Row k="Subtotal" v={naira(subtotal)} />
          {fulfilment === 'delivery' && <Row k="Delivery" v={deliveryFee ? naira(deliveryFee) : 'Free'} />}
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
          <Row k="Total" v={naira(subtotal + deliveryFee)} big />
          <T variant="muted" style={{ marginTop: 4 }}>
            You pay on delivery: cash, transfer or POS.
          </T>
        </Card>
      </ScrollView>
      <View style={[s.foot, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="Continue" onPress={() => router.push('/checkout')} disabled={soldOut.length > 0 || !branch.acceptingOrders} />
        {!branch.acceptingOrders && (
          <T variant="small" style={{ color: colors.bad, textAlign: 'center', marginTop: 6 }}>
            {branch.name} isn't taking orders right now.
          </T>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: colors.bg2, borderRadius: radius.lg, padding: 4, borderWidth: 1, borderColor: colors.line },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md },
  segOn: { backgroundColor: colors.paprika },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(27,18,13,0.96)', borderTopWidth: 1, borderTopColor: colors.line },
});
