import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBranches, fetchMenu, friendlyError } from '../api';
import { Button, Notice, Stepper, T, tap } from '../components/ui';
import { isActiveOrder, isRecentDemoOrder } from '../orderWatcher';
import { useStore } from '../store';
import { colors, fonts, naira, radius } from '../theme';

const STATUS_LABEL = {
  placed: 'Sent',
  accepted: 'Accepted',
  preparing: 'Being prepared',
  ready: 'Ready',
  out_for_delivery: 'On the way',
};

// Lower case, no accents, single spaces: "Éfo  Riro" matches "efo riro".
const fold = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default function Menu() {
  const { open, setOpen, cart, add, remove, count, subtotal, syncCart, orders } = useStore();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const list = useRef(null);
  const chips = useRef(null);
  const searching = fold(query).length > 0;

  // Sets state only after the network answers, never synchronously.
  const load = useCallback(async () => {
    try {
      const [m, branches] = await Promise.all([fetchMenu(), fetchBranches().catch(() => null)]);
      setError('');
      setMenu(m);
      syncCart(m.items);
      // App orders are open while at least one branch is taking them (set in the admin).
      if (Array.isArray(branches) && branches.length) setOpen(branches.some((b) => b.acceptingOrders));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [setOpen, syncCart]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const sections = useMemo(() => {
    if (!menu) return [];
    const catName = new Map(menu.categories.map((c) => [c.id, c.name]));

    if (searching) {
      const words = fold(query).split(' ');
      const hits = menu.items.filter((i) => {
        const hay = fold(`${i.name} ${i.description} ${catName.get(i.categoryId) || ''}`);
        return words.every((w) => hay.includes(w));
      });
      // Dishes you can order first, sold-out ones after.
      hits.sort((a, b) => Number(b.available) - Number(a.available));
      return hits.length ? [{ key: 'results', title: `${hits.length} dish${hits.length === 1 ? '' : 'es'} found`, subtitle: '', data: hits }] : [];
    }

    const out = [];
    const popular = menu.items.filter((i) => i.popular && i.available);
    if (popular.length) out.push({ key: 'popular', title: 'Popular', subtitle: 'What Benin is ordering', data: popular });
    for (const c of menu.categories) {
      const data = menu.items.filter((i) => i.categoryId === c.id);
      if (data.length) out.push({ key: c.id, title: c.name, subtitle: c.subtitle, data });
    }
    // Dishes whose category was deleted or renamed in the admin still show up.
    const orphans = menu.items.filter((i) => !catName.has(i.categoryId));
    if (orphans.length) out.push({ key: 'more', title: 'More', subtitle: '', data: orphans });
    return out;
  }, [menu, query, searching]);

  // SectionList doesn't allow changing these callbacks after the first render, so they read
  // the latest values through refs.
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  const onViewable = useCallback(({ viewableItems }) => {
    const first = viewableItems.find((v) => v.section);
    if (!first) return;
    const idx = sectionsRef.current.findIndex((x) => x.key === first.section.key);
    if (idx < 0) return;
    setActive(idx);
  }, []);
  // Keep the highlighted chip in view.
  useEffect(() => {
    chips.current?.scrollTo({ x: Math.max(0, active * 110 - 40), animated: true });
  }, [active]);
  // The highlighted chip, kept in range when search or a menu refresh changes the sections.
  const activeIdx = active < sections.length ? active : 0;

  const unavailableInCart = Object.values(cart).filter((l) => !l.item.available).length;
  const activeOrder = orders.find(isActiveOrder) || orders.find(isRecentDemoOrder);

  function jump(i) {
    tap();
    setActive(i);
    if (i < 0 || i >= sections.length) return;
    try {
      list.current?.scrollToLocation({ sectionIndex: i, itemIndex: 0, viewOffset: 0, viewPosition: 0, animated: true });
    } catch {
      /* list not laid out yet */
    }
  }

  function clearSearch() {
    setQuery('');
    Keyboard.dismiss();
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
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={s.roundBtn} hitSlop={6}>
            <T style={{ fontSize: 17, lineHeight: 20, color: colors.cream }}>⚙︎</T>
          </Pressable>
        </View>

        <View style={s.search}>
          <T style={{ fontSize: 15, lineHeight: 20, color: colors.muted }}>⌕</T>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search the menu, e.g. egusi, goat meat"
            placeholderTextColor={colors.muted}
            selectionColor={colors.gold}
            style={s.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            accessibilityLabel="Search the menu"
            maxLength={60}
          />
          {query ? (
            <Pressable onPress={clearSearch} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search" style={s.clear}>
              <T style={{ fontSize: 13, lineHeight: 16, color: colors.bg, fontFamily: fonts.bold }}>✕</T>
            </Pressable>
          ) : null}
        </View>

        {!searching && sections.length > 0 && (
          <ScrollView ref={chips} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
            {sections.map((sec, i) => (
              <Pressable key={sec.key} onPress={() => jump(i)} style={[s.chip, i === activeIdx && s.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: i === activeIdx }}>
                <T variant="mono" style={{ fontSize: 12, color: i === activeIdx ? colors.bg : colors.creamDim, textTransform: 'uppercase' }}>
                  {sec.title}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {!open && (
        <View style={{ padding: 14, paddingBottom: 0 }}>
          <Notice tone="bad">Teecas isn’t taking app orders right now. You can still browse the menu.</Notice>
        </View>
      )}
      {activeOrder && !searching && (
        <Pressable onPress={() => router.push({ pathname: '/order/[id]', params: { id: activeOrder.id, token: activeOrder.token || '' } })} style={s.activeOrder} accessibilityRole="button">
          <T variant="small" style={{ color: colors.cream, flexShrink: 1 }} numberOfLines={1}>
            Order #{activeOrder.number}
            {STATUS_LABEL[activeOrder.lastStatus] ? ` · ${STATUS_LABEL[activeOrder.lastStatus]}` : ''} · {naira(activeOrder.total)}
          </T>
          <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
            Track it →
          </T>
        </Pressable>
      )}

      {!menu && !error && <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />}
      {error && !menu ? (
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + (count ? 110 : 30) }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.gold}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          onViewableItemsChanged={onViewable}
          viewabilityConfig={VIEWABILITY}
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={
            error ? (
              <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
                <Notice tone="bad">{error}</Notice>
              </View>
            ) : !searching ? (
              <T variant="small" style={{ textAlign: 'center', paddingTop: 16 }}>
                Tap + to add food to your order
              </T>
            ) : null
          }
          ListEmptyComponent={
            searching ? (
              <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
                <T style={{ fontSize: 36, lineHeight: 44 }}>🍽️</T>
                <T variant="h3">No dish matches “{query.trim()}”</T>
                <T variant="small" style={{ textAlign: 'center' }}>
                  Check the spelling, or try a shorter word like “rice” or “fish”.
                </T>
                <Button label="Show the whole menu" kind="ghost" onPress={clearSearch} style={{ alignSelf: 'stretch', marginTop: 6 }} />
              </View>
            ) : null
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
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: 52, height: 52, borderRadius: 12 }} />
                  ) : (
                    <T style={{ fontSize: 26, lineHeight: 32 }}>{item.emoji || '🍽️'}</T>
                  )}
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name}`}
                    hitSlop={8}
                    onPress={() => {
                      tap();
                      add(item);
                    }}
                    style={({ pressed }) => [s.add, pressed && { transform: [{ scale: 0.94 }] }]}
                  >
                    <T style={{ fontSize: 22, lineHeight: 26, color: colors.white, fontFamily: fonts.medium }}>+</T>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            sections.length ? (
              <View style={{ padding: 24, alignItems: 'center', gap: 6 }}>
                <T variant="mono" style={{ fontSize: 11, textAlign: 'center' }}>
                  TEECAS AMALA EXPRESS BUKKA · BENIN CITY
                </T>
                <T variant="muted">Pay on delivery · cash, transfer or POS</T>
                <T variant="muted">Delivery fee excluded from prices</T>
              </View>
            ) : null
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
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap();
              Keyboard.dismiss();
              router.push('/cart');
            }}
            style={({ pressed }) => [s.cartBar, pressed && { opacity: 0.9 }]}
          >
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

// Module level so SectionList always gets the same object.
const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

const s = StyleSheet.create({
  top: { backgroundColor: 'rgba(27,18,13,0.97)', borderBottomWidth: 1, borderBottomColor: colors.line },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  mark: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' },
  iconBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  roundBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, height: 44, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 15, paddingVertical: 0 },
  clear: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.creamDim, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  activeOrder: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginHorizontal: 14, marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.gold + '55' },
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
