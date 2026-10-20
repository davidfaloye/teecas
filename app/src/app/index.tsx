// Welcome screen and branch picker. Returning customers go straight to the menu of the branch
// they used last; "Change branch" on the menu brings them back here.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBranches } from '../api';
import { Button, DemoBanner, Dots, Notice, T, tap } from '../components/ui';
import { useStore } from '../store';
import { colors, fonts, naira, radius } from '../theme';
import type { Branch } from '../types';

export default function Welcome() {
  const { change } = useLocalSearchParams<{ change?: string }>();
  const { branch, setBranch, count } = useStore();
  const insets = useSafeAreaInsets();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setBranches(await fetchBranches());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (branch && !change) return <Redirect href="/menu" />;

  function choose(b: Branch) {
    tap();
    setBranch(b);
    if (router.canGoBack()) router.back();
    else router.replace('/menu');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={[s.hero, { paddingTop: insets.top + 36 }]}>
          <View style={s.glow} />
          <View style={s.logoWrap}>
            <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Teecas Amala Express" />
          </View>
          <T variant="eyebrow" style={{ marginTop: 22 }}>
            Order online
          </T>
          <T variant="brand" style={s.brand}>
            TEECAS AMALA{'\n'}
            <T variant="brand" style={[s.brand, { color: colors.paprikaBright }]}>
              EXPRESS
            </T>{' '}
            BUKKA
          </T>
          <T variant="italic" style={{ textAlign: 'center', marginTop: 10 }}>
            The best Amala spot in Benin City.
          </T>
          <Dots />
        </View>
        <DemoBanner />

        <View style={{ padding: 18, gap: 12 }}>
          <T variant="h2">{change && count ? 'Switch branch' : 'Where are you ordering from?'}</T>
          {change && count ? (
            <Notice>Switching branch empties your current order, because each branch has its own menu and stock.</Notice>
          ) : (
            <T variant="small">Pick the branch closest to you. You pay when your food arrives.</T>
          )}

          {!branches && !error && <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />}
          {error ? (
            <View style={{ gap: 12 }}>
              <Notice tone="bad">{error}</Notice>
              <Button label="Try again" kind="ghost" onPress={load} />
            </View>
          ) : null}

          {branches?.map((b) => {
            const current = branch?.id === b.id;
            return (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`Order from ${b.name}${b.acceptingOrders ? '' : ', not taking orders right now'}`}
                onPress={() => choose(b)}
                style={({ pressed }) => [s.branch, current && s.branchOn, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <T variant="h3" style={{ fontSize: 20 }}>
                    {b.name}
                  </T>
                  <View style={[s.pill, { borderColor: b.acceptingOrders ? colors.good + '88' : colors.bad + '88' }]}>
                    <T variant="mono" style={{ fontSize: 11, color: b.acceptingOrders ? colors.good : colors.bad }}>
                      {b.acceptingOrders ? 'OPEN' : 'PAUSED'}
                    </T>
                  </View>
                </View>
                <T variant="small" style={{ marginTop: 6 }}>
                  {b.address}
                </T>
                {b.landmark ? <T variant="muted">{b.landmark}</T> : null}
                <View style={s.meta}>
                  {b.hours ? <T variant="mono" style={{ fontSize: 12 }}>{b.hours}</T> : null}
                  <T variant="mono" style={{ fontSize: 12 }}>
                    Delivery {b.deliveryFee ? naira(b.deliveryFee) : 'free'}
                  </T>
                </View>
                {current ? (
                  <T variant="small" style={{ color: colors.gold, marginTop: 8, fontFamily: fonts.semibold }}>
                    Your current branch
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: colors.line, overflow: 'hidden' },
  glow: { position: 'absolute', top: -160, width: 460, height: 460, borderRadius: 230, backgroundColor: 'rgba(200,69,28,0.22)' },
  logoWrap: { backgroundColor: colors.cream, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 18 },
  logo: { width: 200, height: 74 },
  brand: { textAlign: 'center', fontSize: 34, lineHeight: 36, marginTop: 10 },
  branch: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  branchOn: { borderColor: colors.gold },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.lineSoft },
});
