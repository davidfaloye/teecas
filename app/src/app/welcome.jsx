// First-launch tour: four swipeable cards showing how simple ordering is.
// Shown once, then the sign-in / guest page (start.jsx).

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T, tap } from '../components/ui';
import { notificationsAvailable } from '../notifications';
import { turnNotificationsOn } from '../pushSync';
import { useStore } from '../store';
import { colors, fonts, radius, themed } from '../theme';

const AUTO_ADVANCE_MS = 3500;

const SLIDES = [
  {
    key: 'menu',
    eyebrow: 'Welcome to',
    title: 'Teecas Amala, on your phone',
    body: 'The full Teecas Amala Express Bukka menu, from amala and egusi to goat meat and turkey. Prices are always up to date.',
    art: ['🥣', '🍛', '🍖'],
    logo: true,
  },
  {
    key: 'add',
    eyebrow: 'Step 1',
    title: 'Tap to fill your plate',
    body: 'Pick your swallow, your soup and your protein. Search for a dish if you know what you want.',
    art: ['🟤', '+', '🥣'],
  },
  {
    key: 'pay',
    eyebrow: 'Step 2',
    title: 'Pay when it arrives',
    body: 'No card needed. Pay cash, transfer or POS when your food is delivered. The branch closest to you cooks it.',
    art: ['🛵', '💵'],
  },
  {
    key: 'track',
    eyebrow: 'Step 3',
    title: 'Follow every step',
    body: "We'll let you know when Teecas accepts your order, when it's on the way and when it's delivered.",
    art: ['🔔'],
  },
];

export default function Welcome() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { finishOnboarding, orders, updateOrder, setPushToken, updateSettings, account, gateSeen } = useStore();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [height, setHeight] = useState(0); // each card fills the carousel's height
  const [paused, setPaused] = useState(false); // stops auto-sliding once the customer swipes
  const list = useRef(null);
  const indexRef = useRef(0);
  const last = index === SLIDES.length - 1;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Carousel: slide to the next card every few seconds until the last one, or until the
  // customer takes over by swiping.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const next = indexRef.current + 1;
      if (next >= SLIDES.length) {
        clearInterval(t);
        return;
      }
      list.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [paused, width]);

  // After the tour comes the sign-in / guest page, once. (Replaying the tour from Settings goes
  // straight back to the menu.)
  function done() {
    finishOnboarding();
    router.replace(account || gateSeen ? '/menu' : '/start');
  }

  function goTo(i) {
    const next = Math.max(0, Math.min(SLIDES.length - 1, i));
    list.current?.scrollToOffset({ offset: next * width, animated: true });
    setIndex(next);
  }

  async function allowNotifications() {
    setBusy(true);
    try {
      const { granted } = await turnNotificationsOn({ orders, updateOrder, setPushToken });
      updateSettings({ notifications: granted });
    } finally {
      setBusy(false);
      done();
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.top}>
        <T variant="eyebrow" style={{ fontSize: 10 }}>
          Teecas Amala Express
        </T>
        {!last ? (
          <Pressable accessibilityRole="button" onPress={() => { tap(); done(); }} hitSlop={10}>
            <T variant="small" style={{ fontFamily: fonts.semibold }}>
              Skip
            </T>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={list}
        data={SLIDES}
        keyExtractor={(sl) => sl.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollBeginDrag={() => setPaused(true)}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
          if (i !== index) setIndex(i);
        }}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        renderItem={({ item }) => <Slide slide={item} width={width} height={height} />}
        style={{ flex: 1 }}
      />

      <View style={s.dots} accessibilityRole="adjustable" accessibilityLabel={`Card ${index + 1} of ${SLIDES.length}`}>
        {SLIDES.map((sl, i) => (
          <Pressable key={sl.key} onPress={() => goTo(i)} hitSlop={6} accessibilityLabel={`Card ${i + 1}`}>
            <View style={[s.dot, i === index && s.dotOn]} />
          </Pressable>
        ))}
      </View>

      <View style={s.actions}>
        {last && !notificationsAvailable() ? (
          <Button label="Continue" kind="gold" onPress={done} />
        ) : last ? (
          <>
            <Button label="Turn on order updates" kind="gold" onPress={allowNotifications} loading={busy} />
            <Button label="Not now" kind="ghost" onPress={done} disabled={busy} />
          </>
        ) : (
          <Button label="Next" onPress={() => goTo(index + 1)} />
        )}
      </View>
    </View>
  );
}

function Slide({ slide, width, height }) {
  return (
    <View style={[s.slide, { width }, height ? { height } : null]}>
      <View style={s.artWrap}>
        <View style={s.glow} />
        {slide.logo ? (
          <View style={s.logo}>
            <Image source={require('../../assets/icon.png')} style={{ width: 96, height: 96 }} accessibilityIgnoresInvertColors />
          </View>
        ) : null}
        <View style={s.artRow}>
          {slide.art.map((a, i) =>
            a === '+' ? (
              <View key={i} style={s.plus}>
                <Ionicons name="add" size={26} color={colors.white} />
              </View>
            ) : (
              <View key={i} style={[s.bubble, slide.art.length === 1 && s.bubbleBig]}>
                <T style={{ fontSize: slide.art.length === 1 ? 56 : 34, lineHeight: slide.art.length === 1 ? 66 : 42 }}>{a}</T>
              </View>
            ),
          )}
        </View>
      </View>
      <View style={{ gap: 10, paddingHorizontal: 28 }}>
        <T variant="eyebrow">{slide.eyebrow}</T>
        <T variant="h1">{slide.title}</T>
        <T variant="small" style={{ fontSize: 15, lineHeight: 22 }}>
          {slide.body}
        </T>
      </View>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, height: 36 },
  slide: { flex: 1, justifyContent: 'center', gap: 36 },
  artWrap: { alignItems: 'center', justifyContent: 'center', height: 240, gap: 18 },
  glow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: colors.glow },
  logo: { width: 96, height: 96, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  artRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bubble: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  bubbleBig: { width: 120, height: 120, borderRadius: 60, borderColor: colors.gold },
  plus: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paprika, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.line },
  dotOn: { width: 24, backgroundColor: colors.gold },
  actions: { paddingHorizontal: 20, gap: 10 },
}));
