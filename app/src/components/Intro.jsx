// Opening animation, shown on every cold start right after the native splash screen.
// It starts on exactly the same picture as the native splash (the Teecas pot on cream), so the
// hand-over is invisible: then the lid lifts, steam rises, the pot moves up and the name appears,
// and the whole thing fades away to show the app, which has been loading underneath.
//
// It always uses the brand cream, whatever theme the customer picked, because the native splash
// is cream too. Tap anywhere to skip. With "Reduce motion" on, it just shows the name and fades.
//
// Unlike the native splash (which Expo Go replaces with the app icon), this part shows in Expo Go.

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../theme';

// Same values as the expo-splash-screen config in app.json.
export const SPLASH_BG = '#faf5ee';
const POT = 160; // imageWidth in app.json

const INK = '#2a1b12';
const PAPRIKA = '#c8451c';
const GOLD = '#9c6524';

const lidImg = require('../../assets/splash-lid.png');
const potImg = require('../../assets/splash-pot.png');

export function Intro({ onDone }) {
  // Animated values live in state (made once), so the render reads plain values, not refs.
  const [v] = useState(() => ({
    lid: new Animated.Value(0), // 0 closed, 1 lifted
    rise: new Animated.Value(0), // pot moves up to make room for the name
    words: new Animated.Value(0),
    tag: new Animated.Value(0),
    steam: [0, 1, 2].map(() => new Animated.Value(0)),
    fade: new Animated.Value(1),
  }));
  const { lid, rise, words, tag, steam, fade } = v;
  const [gone, setGone] = useState(false);
  const leaving = useRef(false);

  const finish = () => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      setGone(true);
      onDone?.();
    });
  };

  useEffect(() => {
    let timer;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          rise.setValue(1);
          Animated.timing(words, { toValue: 1, duration: 250, useNativeDriver: true }).start();
          tag.setValue(1);
          timer = setTimeout(finish, 900);
          return;
        }
        const t = (val, toValue, duration, easing = Easing.out(Easing.cubic), delay = 0) =>
          Animated.timing(val, { toValue, duration, easing, delay, useNativeDriver: true });
        const puff = (val, delay) => Animated.timing(val, { toValue: 1, duration: 1100, delay, easing: Easing.out(Easing.quad), useNativeDriver: true });

        Animated.sequence([
          Animated.delay(200),
          // The lid lifts and the steam escapes.
          Animated.parallel([
            Animated.spring(lid, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
            puff(steam[0], 60),
            puff(steam[1], 220),
            puff(steam[2], 380),
          ]),
        ]).start();

        // The pot moves up and the name comes in while the steam is still rising.
        Animated.sequence([
          Animated.delay(650),
          Animated.parallel([t(rise, 1, 600, Easing.inOut(Easing.cubic)), t(words, 1, 520, Easing.out(Easing.cubic), 180)]),
          t(tag, 1, 380),
        ]).start();

        // Lid drops back on with a small bounce.
        Animated.sequence([Animated.delay(1350), Animated.spring(lid, { toValue: 0, friction: 4, tension: 160, useNativeDriver: true })]).start();

        timer = setTimeout(finish, 2400);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;

  const potMove = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -72] });
  const potScale = rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
  const lidLift = lid.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const lidTilt = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-9deg'] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, { opacity: fade }]} accessibilityLabel="Teecas Amala Express Bukka" accessibilityRole="image">
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityRole="button" accessibilityLabel="Skip" />

      <Animated.View pointerEvents="none" style={{ width: POT, height: POT, transform: [{ translateY: potMove }, { scale: potScale }] }}>
        {/* Steam, rising from the gap under the lid. */}
        {steam.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              s.steam,
              {
                left: POT * (0.38 + i * 0.12),
                opacity: p.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.55, 0] }),
                transform: [
                  { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) },
                  { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, i % 2 ? 5 : -5, 0] }) },
                  { scaleY: p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] }) },
                ],
              },
            ]}
          />
        ))}
        <Image source={potImg} style={s.layer} />
        <Animated.Image
          source={lidImg}
          style={[s.layer, { transformOrigin: '72% 28%', transform: [{ translateY: lidLift }, { rotate: lidTilt }] }]}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          s.words,
          {
            opacity: words,
            transform: [{ translateY: words.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          },
        ]}
      >
        <Text style={s.brand} maxFontSizeMultiplier={1.2}>
          TEECAS AMALA
        </Text>
        <Text style={s.brand} maxFontSizeMultiplier={1.2}>
          <Text style={{ color: PAPRIKA }}>EXPRESS</Text> BUKKA
        </Text>
        <Animated.View style={{ opacity: tag, alignItems: 'center', gap: 14, marginTop: 10 }}>
          <Text style={s.tagline} maxFontSizeMultiplier={1.3}>
            The best Amala spot in Benin City.
          </Text>
          <View style={s.dots}>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} style={[s.dot, { backgroundColor: i % 3 === 2 ? GOLD : PAPRIKA }]} />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: SPLASH_BG, alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  layer: { position: 'absolute', top: 0, left: 0, width: POT, height: POT },
  steam: { position: 'absolute', top: POT * 0.2, width: 7, height: 26, borderRadius: 4, backgroundColor: 'rgba(122,58,12,0.35)' },
  // Sits below the centre so it lands under the pot once the pot has moved up.
  words: { position: 'absolute', top: '50%', marginTop: 18, alignItems: 'center', paddingHorizontal: 24 },
  brand: { fontFamily: fonts.brand, fontSize: 30, lineHeight: 32, color: INK, textAlign: 'center', letterSpacing: -0.3 },
  tagline: { fontFamily: fonts.italic, fontSize: 16, color: '#5e4a3b', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
