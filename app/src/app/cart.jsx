import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Row } from '../components/Row';
import { Button, Card, Header, Notice, Stepper, T, goBack, tap } from '../components/ui';
import { useStore } from '../store';
import { colors, fonts, naira, themed } from '../theme';
import { FoodThumb } from '../components/FoodThumb';

export default function Cart() {
  const { open, cart, add, remove, setQty, count, subtotal, clearCart } = useStore();
  const insets = useSafeAreaInsets();
  const lines = Object.values(cart);
  const soldOut = lines.filter((l) => !l.item.available);

  if (lines.length === 0) {
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
        subtitle={`Delivery · ${count} item${count === 1 ? '' : 's'}`}
        right={
          <Pressable accessibilityRole="button" onPress={() => { tap(); clearCart(); }} hitSlop={8}>
            <T variant="small" style={{ color: colors.bad }}>
              Clear
            </T>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 120 }}>
        {soldOut.length > 0 && <Notice tone="bad">{soldOut.map((l) => l.item.name).join(', ')} sold out. Remove it to continue.</Notice>}

        <Card style={{ paddingVertical: 4 }}>
          {lines.map((l, i) => (
            <View key={l.item.id} style={[s.line, i > 0 && { borderTopWidth: 1, borderTopColor: colors.lineSoft }]}>
              <FoodThumb item={l.item} size={44} />
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

        <Pressable onPress={goBack} accessibilityRole="button">
          <T variant="small" style={{ color: colors.gold, textAlign: 'center', fontFamily: fonts.semibold }}>
            + Add more from the menu
          </T>
        </Pressable>

        <Card style={{ gap: 8 }}>
          <Row k="Total to pay" v={naira(subtotal)} big />
          <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
            Delivery fee excluded
          </T>
          <T variant="muted" style={{ marginTop: 4 }}>
            Choose delivery or pickup at checkout. You pay when you get your food: cash, transfer or POS. For delivery, the fee is settled with the rider.
          </T>
        </Card>
      </ScrollView>
      <View style={[s.foot, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="Continue" onPress={() => router.push('/checkout')} disabled={soldOut.length > 0 || !open} />
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
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bar, borderTopWidth: 1, borderTopColor: colors.line },
}));
