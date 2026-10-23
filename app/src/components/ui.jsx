import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, themed } from '../theme';

export const tap = () => Haptics.selectionAsync().catch(() => {});

// Text in the app's type styles. variant: one of the keys of `text` below. onPress makes it a
// tappable link (e.g. inside a sentence).
export function T({ children, style, variant = 'body', numberOfLines, onPress }) {
  return (
    <Text
      style={[text[variant] || text.body, style]}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1.4}
      onPress={onPress}
      accessibilityRole={onPress ? 'link' : undefined}
    >
      {children}
    </Text>
  );
}

const text = themed(() => StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.cream, lineHeight: 21 },
  medium: { fontFamily: fonts.medium, fontSize: 15, color: colors.cream, lineHeight: 21 },
  bold: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream, lineHeight: 21 },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.creamDim, lineHeight: 18 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 18 },
  h1: { fontFamily: fonts.head, fontSize: 28, color: colors.cream, lineHeight: 33 },
  h2: { fontFamily: fonts.head, fontSize: 22, color: colors.cream, lineHeight: 27 },
  h3: { fontFamily: fonts.headSemi, fontSize: 17, color: colors.cream, lineHeight: 22 },
  brand: { fontFamily: fonts.brand, fontSize: 30, color: colors.cream, lineHeight: 32 },
  italic: { fontFamily: fonts.italic, fontSize: 16, color: colors.creamDim, lineHeight: 22 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, color: colors.gold, letterSpacing: 2, textTransform: 'uppercase' },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: colors.creamDim },
  price: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.gold },
}));

// kind: 'primary' | 'gold' | 'ghost' | 'quiet'
export function Button({ label, onPress, kind = 'primary', disabled, loading, style, right }) {
  const bg = kind === 'primary' ? colors.paprika : kind === 'gold' ? colors.gold : 'transparent';
  const fg = kind === 'gold' ? colors.bg : kind === 'primary' ? colors.onAccent : colors.cream;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: kind === 'ghost' ? colors.line : bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{label}</Text>}
      {right && !loading ? right : null}
    </Pressable>
  );
}

export function Stepper({ qty, onAdd, onRemove, label }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${label}`} hitSlop={8} onPress={() => { tap(); onRemove(); }} style={styles.stepBtn}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepQty} accessibilityLabel={`${qty} ${label}`}>
        {qty}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add one ${label}`} hitSlop={8} onPress={() => { tap(); onAdd(); }} style={styles.stepBtn}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/menu');
}

export function Header({ title, subtitle, back = true, right }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={goBack} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <T variant="h2" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Dots() {
  return (
    <View style={styles.dots}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i % 3 === 2 ? colors.gold : colors.paprika }]} />
      ))}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// tone: 'warn' | 'bad' | 'good'
export function Notice({ children, tone = 'warn' }) {
  const c = tone === 'bad' ? colors.bad : tone === 'good' ? colors.good : colors.gold;
  return (
    <View style={[styles.notice, { borderColor: c + '66', backgroundColor: c + '18' }]}>
      <T variant="small" style={{ color: c }}>
        {children}
      </T>
    </View>
  );
}

export const styles = themed(() => StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, borderWidth: 1 },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.cream, fontSize: 20, fontFamily: fonts.medium, lineHeight: 22 },
  stepQty: { minWidth: 22, textAlign: 'center', color: colors.cream, fontFamily: fonts.monoBold, fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.bg },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.cream, fontSize: 20, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 18 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  notice: { borderRadius: radius.md, borderWidth: 1, padding: 12 },
}));
