import { router } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header, T, styles } from '../components/ui';
import { useStore } from '../store';
import { colors, dayAndClock, naira } from '../theme';

const STATUS = {
  placed: ['Sent', colors.creamDim],
  accepted: ['Accepted', colors.gold],
  preparing: ['Being prepared', colors.gold],
  ready: ['Ready', colors.gold],
  out_for_delivery: ['On the way', colors.gold],
  completed: ['Delivered', colors.good],
  cancelled: ['Cancelled', colors.bad],
};

export default function MyOrders() {
  const { orders } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="My orders" subtitle="Orders placed on this phone" />
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <View style={{ gap: 14, marginTop: 30, alignItems: 'center' }}>
            <T variant="small">You haven’t ordered yet.</T>
            <Button label="See the menu" kind="gold" onPress={() => router.replace('/menu')} style={{ alignSelf: 'stretch' }} />
          </View>
        }
        renderItem={({ item: o }) => {
          const st = o.gone ? ['No longer available', colors.muted] : STATUS[o.lastStatus];
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id, token: o.token || '' } })}
              style={({ pressed }) => [styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bold" numberOfLines={1}>
                  #{o.number} · {o.branchName || 'Teecas'}
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
