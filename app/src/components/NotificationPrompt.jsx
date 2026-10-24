// Asks the customer to allow order notifications. Shown on the menu every time it opens while the
// phone hasn't allowed them, including the very first time. "Not now" hides it until the next
// visit to the menu.
//
// If the phone can still show its own prompt, "Allow notifications" shows it. If the customer has
// said no before (the phone won't ask again), the button opens the phone's settings instead, and
// the sheet goes away by itself once they turn notifications on there and come back.
//
// Drawn inside the menu screen, not as a Modal, so the opening animation stays on top of it.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationsAvailable, permissionState } from '../notifications';
import { turnNotificationsOn } from '../pushSync';
import { useStore } from '../store';
import { colors, radius, themed } from '../theme';
import { Button, T } from './ui';

export function NotificationPrompt() {
  const { orders, updateOrder, setPushToken, updateSettings } = useStore();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const [canAsk, setCanAsk] = useState(true);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (!notificationsAvailable()) return;
    const p = await permissionState();
    setCanAsk(p.canAsk);
    if (p.granted) setShow(false);
    return p;
  }, []);

  // Every time the menu opens: ask again if they still aren't allowed. Coming back from the
  // phone's settings: close if they're now allowed (and start sending updates to this phone).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      check().then((p) => {
        if (alive && p && !p.granted) setShow(true);
      });
      const sub = AppState.addEventListener('change', (st) => {
        if (st !== 'active') return;
        check().then((p) => {
          if (p?.granted) {
            updateSettings({ notifications: true });
            turnNotificationsOn({ orders, updateOrder, setPushToken }).catch(() => {});
          }
        });
      });
      return () => {
        alive = false;
        sub.remove();
      };
    }, [check, orders, updateOrder, setPushToken, updateSettings]),
  );

  async function allow() {
    if (!canAsk) {
      Linking.openSettings().catch(() => {});
      return;
    }
    setBusy(true);
    try {
      const { granted } = await turnNotificationsOn({ orders, updateOrder, setPushToken });
      if (granted) {
        updateSettings({ notifications: true });
        setShow(false);
      } else {
        await check(); // they said no: from now on the button opens the phone's settings
      }
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;
  return (
    <View style={s.scrim} accessibilityViewIsModal>
      <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
        <View style={s.icon}>
          <Ionicons name="notifications" size={26} color={colors.paprika} />
        </View>
        <T variant="h2" style={{ textAlign: 'center' }}>
          Get order updates
        </T>
        <T variant="small" style={{ textAlign: 'center' }}>
          {canAsk
            ? 'Allow notifications so we can tell you when Teecas Amala accepts your order, when it’s on the way and when it’s delivered, even when the app is closed.'
            : 'Notifications for Teecas Amala are turned off in your phone’s settings. Turn them on there so we can tell you when your order is accepted, on the way and delivered.'}
        </T>
        <Button label={canAsk ? 'Allow notifications' : 'Open phone settings'} onPress={allow} loading={busy} style={{ alignSelf: 'stretch', marginTop: 6 }} />
        <Button label="Not now" kind="quiet" onPress={() => setShow(false)} style={{ alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 50 },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg + 6, borderTopRightRadius: radius.lg + 6, paddingHorizontal: 22, paddingTop: 26, gap: 10, alignItems: 'center' },
    icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  }),
);
