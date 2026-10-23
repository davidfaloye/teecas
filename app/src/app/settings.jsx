import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteAccount, friendlyError, isSignedOutError } from '../api';
import { DEMO_WHATSAPP } from '../demo';
import { Button, Card, Header, Notice, T, tap } from '../components/ui';
import { hasPermission, notificationsAvailable } from '../notifications';
import { localPhone } from '../phone';
import { turnNotificationsOff, turnNotificationsOn } from '../pushSync';
import { useStore } from '../store';
import { colors, fonts, radius, themed } from '../theme';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, orders, updateOrder, setPushToken, customer, forgetDetails, replayTour, account, signOut } = useStore();
  const [allowed, setAllowed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [accountError, setAccountError] = useState('');

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'Your sign-in and saved details are removed. Teecas keeps its record of past orders, but they won’t be linked to you any more. This can’t be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setAccountError('');
            try {
              await deleteAccount(account.token);
              signOut();
            } catch (e) {
              if (isSignedOutError(e)) signOut(); // already gone on the server
              else setAccountError(friendlyError(e));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  const recheck = useCallback(() => {
    hasPermission().then(setAllowed);
  }, []);

  // Coming back from the phone's settings: pick up a change there.
  useEffect(() => {
    recheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  const available = notificationsAvailable();
  const on = available && settings.notifications && allowed;

  async function toggle(next) {
    tap();
    setBusy(true);
    try {
      if (next) {
        const { granted } = await turnNotificationsOn({ orders, updateOrder, setPushToken });
        setAllowed(granted);
        setBlocked(!granted);
        updateSettings({ notifications: granted });
      } else {
        setBlocked(false);
        updateSettings({ notifications: false });
        await turnNotificationsOff({ orders, updateOrder });
      }
    } finally {
      setBusy(false);
    }
  }

  const hasDetails = Boolean(customer.name || customer.phone || customer.address);
  const version = Constants.expoConfig?.version || '1.0.0';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 32 }}>
        <Section title="Appearance">
          <Card style={{ gap: 12 }}>
            <View style={{ gap: 2 }}>
              <T variant="bold">Theme</T>
              <T variant="muted">How Teecas looks on this phone.</T>
            </View>
            <View style={s.seg} accessibilityRole="radiogroup">
              {THEME_CHOICES.map(([key, label]) => {
                const chosen = settings.theme === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: chosen }}
                    onPress={() => {
                      if (chosen) return;
                      tap();
                      updateSettings({ theme: key });
                    }}
                    style={[s.segBtn, chosen && { backgroundColor: colors.paprika }]}
                  >
                    <T variant="medium" style={{ color: chosen ? colors.onAccent : colors.creamDim, fontFamily: fonts.semibold }}>
                      {label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </Section>

        <Section title="Notifications">
          <Card style={{ gap: 12 }}>
            <View style={s.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bold">Order updates</T>
                <T variant="muted">When Teecas accepts your order, sends it out and delivers it.</T>
              </View>
              <Switch
                value={on}
                onValueChange={toggle}
                disabled={busy || !available}
                trackColor={{ false: colors.bg2, true: colors.paprika }}
                thumbColor={on ? colors.onAccent : colors.thumbOff}
                ios_backgroundColor={colors.bg2}
                accessibilityLabel="Order update notifications"
              />
            </View>
            {!available ? (
              <Notice>Order updates work in the installed Teecas app. They aren’t available in this preview (Expo Go on Android).</Notice>
            ) : null}
            {available && (blocked || (settings.notifications && !allowed)) && (
              <View style={{ gap: 10 }}>
                <Notice>Notifications are turned off for Teecas in your phone’s settings. Turn them on there to get order updates.</Notice>
                <Button label="Open phone settings" kind="ghost" onPress={() => Linking.openSettings().catch(() => {})} />
              </View>
            )}
          </Card>
        </Section>

        <Section title="Account">
          <Card style={{ gap: 10 }}>
            {account ? (
              <>
                <T variant="small">You’re signed in. Your orders are saved to your account and show on any phone you sign in on.</T>
                <Detail k="Name" v={account.customer.name} />
                {account.customer.email ? <Detail k="Email" v={account.customer.email} /> : null}
                {account.customer.phone ? <Detail k="Phone" v={localPhone(account.customer.phone)} /> : null}
                {account.customer.address ? <Detail k="Saved address" v={account.customer.address} /> : null}
                {accountError ? <Notice tone="bad">{accountError}</Notice> : null}
                <Button label="Log out" kind="gold" onPress={signOut} />
                <Button label="Delete my account" kind="quiet" onPress={confirmDelete} loading={deleting} />
              </>
            ) : (
              <>
                <T variant="small">You’re ordering as a guest, so your past orders are saved on this phone only. Teecas still gets every order you place. Create an account to keep them on any phone.</T>
                <Button label="Create an account" kind="gold" onPress={() => router.push('/signup')} />
                <Button label="Sign in" kind="ghost" onPress={() => router.push('/signin')} />
              </>
            )}
          </Card>
        </Section>

        {!account ? (
        <Section title="Your details">
          <Card style={{ gap: 10 }}>
            {hasDetails ? (
              <>
                <T variant="small">Saved on this phone so checkout is faster next time.</T>
                {customer.name ? <Detail k="Name" v={customer.name} /> : null}
                {customer.phone ? <Detail k="Phone" v={customer.phone} /> : null}
                {customer.address ? <Detail k="Address" v={customer.address} /> : null}
                <Button
                  label="Forget my details"
                  kind="ghost"
                  onPress={() => {
                    forgetDetails();
                    setForgot(true);
                  }}
                />
              </>
            ) : (
              <T variant="small">{forgot ? 'Done. Your details were removed from this phone.' : 'Nothing saved yet. Your name, phone and address are saved here after your first order.'}</T>
            )}
          </Card>
        </Section>
        ) : null}

        <Section title="About">
          <Card style={{ paddingVertical: 4 }}>
            <Link label="Terms of service" onPress={() => router.push('/terms')} />
            <Link label="Privacy" onPress={() => router.push({ pathname: '/terms', params: { section: 'privacy' } })} divider />
            <Link label="Chat with Teecas on WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${DEMO_WHATSAPP}`).catch(() => {})} divider />
            <Link
              label="See the app tour again"
              onPress={() => {
                replayTour();
                router.replace('/welcome');
              }}
              divider
            />
          </Card>
        </Section>

        <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
          <T variant="mono" style={{ fontSize: 11 }}>
            TEECAS AMALA EXPRESS BUKKA
          </T>
          <T variant="muted">Version {version}</T>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ gap: 8 }}>
      <T variant="eyebrow" style={{ marginLeft: 4 }}>
        {title}
      </T>
      {children}
    </View>
  );
}

function Detail({ k, v }) {
  return (
    <View style={{ gap: 2 }}>
      <T variant="muted">{k}</T>
      <T variant="medium">{v}</T>
    </View>
  );
}

function Link({ label, onPress, divider }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [s.link, divider && { borderTopWidth: 1, borderTopColor: colors.lineSoft }, pressed && { opacity: 0.7 }]}
    >
      <T variant="medium" style={{ flex: 1 }}>
        {label}
      </T>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const THEME_CHOICES = [
  ['light', 'Light'],
  ['dark', 'Dark'],
];

const s = themed(() => StyleSheet.create({
  seg: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line },
  segBtn: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderRadius: radius.sm },
}));
