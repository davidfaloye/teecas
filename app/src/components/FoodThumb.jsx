import { useState } from 'react';
import { Image, View } from 'react-native';
import { colors } from '../theme';
import { T } from './ui';

// A menu item's photo, or its icon when it has none or the photo can't load (offline, bad link).
export function FoodThumb({ item, size = 52 }) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.23);
  const showPhoto = Boolean(item?.imageUrl) && !failed;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {showPhoto ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <T style={{ fontSize: Math.round(size / 2), lineHeight: Math.round(size * 0.62) }}>{item?.emoji || '🍽️'}</T>
      )}
    </View>
  );
}
