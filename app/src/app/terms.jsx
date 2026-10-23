import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, T } from '../components/ui';
import { useStore } from '../store';
import { TERMS, TERMS_UPDATED } from '../terms';
import { colors } from '../theme';

export default function Terms() {
  const insets = useSafeAreaInsets();
  useStore(); // redraw when the theme changes
  const params = useLocalSearchParams();
  const target = Array.isArray(params.section) ? params.section[0] : params.section;
  const scroll = useRef(null);
  const jumped = useRef(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={target === 'privacy' ? 'Privacy' : 'Terms of service'} subtitle={`Last updated ${TERMS_UPDATED}`} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: insets.bottom + 40 }}>
        {TERMS.map((sec, i) => (
          <View
            key={sec.id}
            style={{ gap: 8 }}
            onLayout={(e) => {
              // Opened from "Privacy": scroll straight to that section once.
              if (sec.id === target && !jumped.current) {
                jumped.current = true;
                scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 12), animated: false });
              }
            }}
          >
            <T variant="h3">
              {i + 1}. {sec.title}
            </T>
            {sec.body.map((p, j) => (
              <T key={j} variant="small" style={{ fontSize: 14, lineHeight: 21 }}>
                {p}
              </T>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
