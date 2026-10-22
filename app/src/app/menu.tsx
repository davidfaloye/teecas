import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBranches, fetchMenu } from '../api';
import { Button, DemoBanner, Notice, Stepper, T, tap } from '../components/ui';
import { useStore } from '../store';
import { colors, fonts, naira, radius } from '../theme';
import type { Category, MenuItem } from '../types';

type Section = { key: string; title: string; subtitle?: string; data: MenuItem[] };

export default function Menu() {
  const { open, setOpen, cart, add, remove, count, subtotal, syncCart, orders } = useStore();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState<{ categories: Category[]; items: MenuItem[] } | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<SectionList<MenuItem, Section>>(null);
  const chips = useRef<ComponentRef<typeof ScrollView>>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [m, branches] = await Promise.all([fetchMenu(), fetchBranches().catch(() => null)]);
      setMenu(m);
      syncCart(m.items);
      // App orders are open while at least one branch is taking them (set in the admin).
      if (branches) setOpen(branches.some((b) => b.acceptingOrders));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setOpen, syncCart]);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo<Section[]>(() => {
    if (!menu) return [];
    const popular = menu.items.filter((i) => i.popular && i.available);
    const out: Section[] = [];
    if (popular.length) out.push({ key: 'popular', title: 'Popular', subtitle: 'What Benin is ordering', data: popular });
    for (const c of menu.categories) {
      const data = menu.items.filter((i) => i.categoryId === c.id);
      if (data.length) out.push({ key: c.id, title: c.name, subtitle: c.subtitle, data });
    }
    return out;
  }, [menu]);

  const unavailableInCart = Object.values(cart).filter((l) => !l.item.available).length;
  const activeOrder = orders.find((o) => Date.now() - new Date(o.createdAt).getTime() < 3 * 3600e3);

  function jump(i: number) {
    tap();
    setActive(i);
    list.current?.scrollToLocation({ sectionIndex: i, itemIndex: 0, viewOffset: 0, viewPosition: 0, animated: true });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <View style={s.topRow}>
          <View style={s.mark}>
            <Image source={require('../../assets/icon.png')} style={{ width: 40, height: 40 }} accessibilityIgnoresInvertColors />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="eyebrow" style={{ fontSize: 10 }}>
              Teecas Amala Express
            </T>
            <T variant="h3" numberOfLines={1}>
              Order for delivery
            </T>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="My orders" onPress={() => router.push('/orders')} style={s.iconBtn} hitSlop={6}>
            <T variant="mono" style={{ fontSize: 11, color: colors.cream }}>
              ORDERS
            </T>
          </Pressable>
        </View>
        {sections.length > 0 && (
          <ScrollView ref={chips} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {sections.map((sec, i) => (
              <Pressable key={sec.key} onPress={() => jump(i)} style={[s.chip, i === active && s.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: i === active }}>
                <T variant="mono" style={{ fontSize: 12, color: i === active ? colors.bg : colors.creamDim, textTransform: 'uppercase' }}>
                  {sec.title}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      <DemoBanner />

      {!open && (
        <View style={{ padding: 14, paddingBottom: 0 }}>
          <Notice tone="bad">Teecas isn't taking app orders right now. You can still browse the menu.</Notice>
        </View>
      )}
      {activeOrder && (
        <Pressable onPress={() => router.push({ pathname: '/order/[id]', params: { id: activeOrder.id, token: activeOrder.token || '' } })} style={s.activeOrder}>
          <T variant="small" style={{ color: colors.cream }}>
            Order #{activeOrder.number} · {naira(activeOrder.total)}
          </T>
          <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
            Track it →
          </T>
        </Pressable>
      )}

      {!menu && !error && <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />}
      {error ? (
        <View style={{ padding: 18, gap: 12 }}>
          <Notice tone="bad">{error}</Notice>
          <Button label="Try again" kind="ghost" onPress={load} />
        </View>
      ) : null}

      {menu && (
        <SectionList
          ref={list}
          sections={sections}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + (count ? 110 : 30) }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          onViewableItemsChanged={({ viewableItems }) => {
            const first = viewableItems.find((v) => v.section);
            if (!first) return;
            const idx = sections.findIndex((x) => x.key === (first.section as Section).key);
            if (idx >= 0 && idx !== active) {
              setActive(idx);
              chips.current?.scrollTo({ x: Math.max(0, idx * 110 - 40), animated: true });
            }
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={
            <T variant="small" style={{ textAlign: 'center', paddingTop: 16 }}>
              Tap + to add food to your order
            </T>
          }
          renderSectionHeader={({ section }) => (
            <View style={s.secHead}>
              <T variant="h2">{section.title}</T>
              {section.subtitle ? (
                <T variant="mono" style={{ fontSize: 11, textTransform: 'uppercase', color: colors.muted }}>
                  {section.subtitle}
                </T>
              ) : null}
            </View>
          )}
          renderItem={({ item, index, section }) => {
            const qty = cart[item.id]?.qty || 0;
            const first = index === 0;
            const last = index === section.data.length - 1;
            return (
              <View style={[s.item, first && s.itemFirst, last && s.itemLast, !item.available && { opacity: 0.5 }]}>
                <View style={s.emoji}>
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: 52, height: 52, borderRadius: 12 }} /> : <T style={{ fontSize: 26, lineHeight: 32 }}>{item.emoji || '🍽️'}</T>}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="medium" style={{ fontSize: 16 }}>
                    {item.name}
                  </T>
                  {item.description ? (
                    <T variant="muted" numberOfLines={2}>
                      {item.description}
                    </T>
                  ) : null}
                  <T variant="price" style={{ marginTop: 2 }}>
                    {naira(item.price)}
                  </T>
                </View>
                {!item.available ? (
                  <View style={s.soldOut}>
                    <T variant="mono" style={{ fontSize: 11, color: colors.bad }}>
                      SOLD OUT
                    </T>
                  </View>
                ) : qty > 0 ? (
                  <Stepper qty={qty} label={item.name} onAdd={() => add(item)} onRemove={() => remove(item.id)} />
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Add ${item.name}`} hitSlop={8} onPress={() => { tap(); add(item); }} style={({ pressed }) => [s.add, pressed && { transform: [{ scale: 0.94 }] }]}>
                    <T style={{ fontSize: 22, lineHeight: 26, color: colors.white, fontFamily: fonts.medium }}>+</T>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            <View style={{ padding: 24, alignItems: 'center', gap: 6 }}>
              <T variant="mono" style={{ fontSize: 11, textAlign: 'center' }}>
                TEECAS AMALA EXPRESS BUKKA · BENIN CITY
              </T>
              <T variant="muted">Pay on delivery · cash, transfer or POS</T>
              <T variant="muted">Delivery fee excluded from prices</T>
            </View>
          }
        />
      )}

      {count > 0 && (
        <View style={[s.cartWrap, { paddingBottom: insets.bottom + 12 }]}>
          {unavailableInCart > 0 && (
            <T variant="small" style={{ color: colors.bad, marginBottom: 6, textAlign: 'center' }}>
              Something in your order just sold out. Review it before checkout.
            </T>
          )}
          <Pressable accessibilityRole="button" onPress={() => { tap(); router.push('/cart'); }} style={({ pressed }) => [s.cartBar, pressed && { opacity: 0.9 }]}>
            <View style={s.badge}>
              <T variant="mono" style={{ color: colors.bg, fontFamily: fonts.monoBold, fontSize: 13 }}>
                {count}
              </T>
            </View>
            <T variant="bold" style={{ flex: 1, color: colors.white, fontSize: 16 }}>
              View order
            </T>
            <T variant="price" style={{ color: colors.white }}>
              {naira(subtotal)}
            </T>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  top: { backgroundColor: 'rgba(27,18,13,0.97)', borderBottomWidth: 1, borderBottomColor: colors.line },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  mark: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' },
  iconBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  activeOrder: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 14, marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.gold + '55' },
  secHead: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 12, gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.card, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  itemFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14, borderTopWidth: 1, borderTopColor: colors.line },
  itemLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderBottomWidth: 1 },
  emoji: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  add: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.paprika, alignItems: 'center', justifyContent: 'center' },
  soldOut: { borderWidth: 1, borderColor: colors.bad + '66', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  cartWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 10, backgroundColor: 'rgba(27,18,13,0.94)', borderTopWidth: 1, borderTopColor: colors.line },
  cartBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.paprika, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 15 },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
});
