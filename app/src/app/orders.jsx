// My orders. Signed in: the account's orders from the database (cached, see useMyOrders.js), so
// they show on any phone. Guests: the orders placed on this phone, plus a prompt to sign in.

import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ErrorNotice, Header, T, Working, styles } from '../components/ui';
import { useStore } from '../store';
import { colors, dayAndClock, naira } from '../theme';
import { useMyOrders } from '../useMyOrders';

// Colour names, not values, so they follow the theme.
const STATUS = {
  placed: ['Sent', 'creamDim'],
  accepted: ['Accepted', 'gold'],
  preparing: ['Being prepared', 'gold'],
  ready: ['Ready', 'gold'],
  out_for_delivery: ['On the way', 'gold'],
  completed: ['Delivered', 'good'],
  cancelled: ['Cancelled', 'bad'],
};
// Pickup orders end differently.
const PICKUP_STATUS = { ready: ['Ready for pickup', 'paprika'], completed: ['Collected', 'good'] };
const statusOf = (o) => (o.fulfilment === 'pickup' && PICKUP_STATUS[o.lastStatus]) || STATUS[o.lastStatus];

export default function MyOrders() {
  const { orders: phoneOrders } = useStore();
  const mine = useMyOrders();
  const insets = useSafeAreaInsets();

  const data = mine.signedIn ? mine.orders : phoneOrders;
  const firstLoad = mine.signedIn && !mine.loaded;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="My orders" subtitle={mine.signedIn ? 'Your account’s orders' : 'Orders placed on this phone'} />
      <FlatList
        data={firstLoad ? [] : data}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          mine.signedIn ? <RefreshControl refreshing={mine.loading && mine.loaded} onRefresh={mine.refresh} tintColor={colors.gold} /> : undefined
        }
        onEndReached={mine.signedIn ? mine.loadMore : undefined}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            {!mine.signedIn ? <SignInPrompt /> : null}
            {mine.slow && mine.loaded ? <Working /> : null}
            <ErrorNotice prefix={mine.loaded ? 'Couldn’t refresh: ' : ''}>{mine.error}</ErrorNotice>
          </View>
        }
        ListEmptyComponent={
          firstLoad && !mine.error ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 30 }} />
          ) : firstLoad ? (
            <Button label="Try again" kind="ghost" onPress={mine.refresh} style={{ marginTop: 10 }} />
          ) : (
            <View style={{ gap: 14, marginTop: 30, alignItems: 'center' }}>
              <T variant="small">You haven’t ordered yet.</T>
              <Button label="See the menu" kind="gold" onPress={() => router.replace('/menu')} style={{ alignSelf: 'stretch' }} />
            </View>
          )
        }
        ListFooterComponent={mine.loadingMore ? <ActivityIndicator color={colors.gold} style={{ marginVertical: 12 }} /> : null}
        renderItem={({ item: o }) => {
          const s0 = statusOf(o);
          const st = o.gone ? ['No longer available', colors.muted] : s0 && [s0[0], colors[s0[1]]];
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id, token: o.token || '' } })}
              style={({ pressed }) => [styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bold" numberOfLines={1}>
                  #{o.number} · {o.branchName || 'Teecas Amala'}
                </T>
                <T variant="muted">{dayAndClock(o.createdAt)}</T>
                {st ? (
                  <T variant="mono" style={{ fontSize: 11, color: st[1], textTransform: 'uppercase' }}>
                    {st[0]}
                  </T>
                ) : null}
              </View>
              <T variant="price">{naira(o.total)}</T>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function SignInPrompt() {
  return (
    <Card style={{ gap: 10, borderColor: colors.gold + '66' }}>
      <T variant="bold">Keep your orders on any phone</T>
      <T variant="small">Sign in or create an account. The orders below move into it, and checkout fills in for you.</T>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Sign in" kind="gold" onPress={() => router.push('/signin')} style={{ flex: 1 }} />
        <Button label="Create account" kind="ghost" onPress={() => router.push('/signup')} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}
