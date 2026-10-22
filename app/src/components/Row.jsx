import { View } from 'react-native';
import { colors } from '../theme';
import { T } from './ui';

// "Label ........ value" line, like the dot leaders on the teecas.online menu.
export function Row({ k, v, big }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <T variant={big ? 'bold' : 'small'} style={[{ flexShrink: 1 }, big ? { fontSize: 18 } : null]}>
        {k}
      </T>
      <View style={{ flex: 1, minWidth: 12, borderBottomWidth: 2, borderStyle: 'dotted', borderColor: 'rgba(243,233,220,0.18)', transform: [{ translateY: -4 }] }} />
      <T variant="price" style={big ? { fontSize: 18, color: colors.cream } : { color: colors.creamDim }}>
        {v}
      </T>
    </View>
  );
}
