import { router } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header, T, styles } from '../components/ui';
import { useStore } from '../store';
import { colors, naira } from '../theme';

const when = (iso: string) => {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours();
  return `${d.getDate()} ${months[d.getMonth()]}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
};

export default function MyOrders() {
  const { orders } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="My orders" subtitle="Orders placed on this phone" />
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <View style={{ gap: 14, marginTop: 30, alignItems: 'center' }}>
            <T variant="small">You haven't ordered yet.</T>
            <Button label="See the menu" kind="gold" onPress={() => router.replace('/menu')} style={{ alignSelf: 'stretch' }} />
          </View>
        }
        renderItem={({ item: o }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id, token: o.token || '' } })}
            style={({ pressed }) => [styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.85 }]}
          >
            <View style={{ flex: 1 }}>
              <T variant="bold">
                #{o.number} · {o.branchName || 'Teecas'}
              </T>
              <T variant="muted">{when(o.createdAt)}</T>
            </View>
            <T variant="price">{naira(o.total)}</T>
          </Pressable>
        )}
      />
    </View>
  );
}
