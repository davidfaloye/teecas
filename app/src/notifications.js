// Order status notifications.
//
// Two ways a customer hears about a status change:
// 1. Push (app closed or in the background): the phone's Expo push token is sent with each order,
//    and the admin pushes a message whenever staff move the order. Needs a development or store
//    build (not Expo Go on Android) and the admin's push support (server/push.js).
// 2. Local (app open): the app checks its active orders every 20 seconds and shows a notification
//    itself when the status changed. Covers orders placed without a push token.
//
// Settings → Notifications turns both off.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const CHANNEL_ID = 'orders';

// Expo Go on Android ships without part of expo-notifications (since SDK 53), and just importing
// the library there throws "Cannot find native module 'ExpoTopicSubscriptionModule'". So it is
// loaded lazily, only where it works: iOS (Expo Go or a build) and Android development or store
// builds. Everywhere else the functions below quietly do nothing and the app keeps working.
const inExpoGo = Constants.executionEnvironment === 'storeClient';
let lib; // undefined: not loaded yet; null: not available here
function N() {
  if (lib !== undefined) return lib;
  lib = null;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return lib;
  if (Platform.OS === 'android' && inExpoGo) return lib;
  try {
    lib = require('expo-notifications');
  } catch {
    lib = null;
  }
  return lib;
}

// False in Expo Go on Android and on web; Settings explains why.
export function notificationsAvailable() {
  return Boolean(N());
}

let enabled = true;
export function setNotificationsEnabled(v) {
  enabled = Boolean(v);
}

export function configureNotifications() {
  const Notifications = N();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: enabled,
      shouldShowList: enabled,
      shouldPlaySound: enabled,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Order updates',
      description: 'When Teecas accepts, sends out or delivers your order',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#c8451c',
    }).catch(() => {});
  }
}

function granted(p) {
  // IosAuthorizationStatus.PROVISIONAL is 3: quiet notifications the customer allowed on iOS.
  return Boolean(p?.granted) || p?.ios?.status === 3;
}

export async function hasPermission() {
  const Notifications = N();
  if (!Notifications) return false;
  try {
    return granted(await Notifications.getPermissionsAsync());
  } catch {
    return false;
  }
}

// Shows the system prompt the first time; afterwards returns the saved answer.
export async function askPermission() {
  const Notifications = N();
  if (!Notifications) return false;
  try {
    const now = await Notifications.getPermissionsAsync();
    if (granted(now)) return true;
    if (now.canAskAgain === false) return false;
    return granted(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  } catch {
    return false;
  }
}

// The Expo push token for this phone, or '' when push isn't possible here (Expo Go on Android,
// no EAS project id yet, no permission, offline). Never throws.
export async function getPushToken() {
  const Notifications = N();
  if (!Notifications) return '';
  try {
    if (!(await hasPermission())) return '';
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) return '';
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return typeof data === 'string' ? data : '';
  } catch {
    return '';
  }
}

// Same words as the admin's push messages.
export function statusMessage(status, order) {
  const n = `#${order?.number ?? ''}`;
  switch (status) {
    case 'accepted':
      return ['Order accepted', `${order?.branchName || 'Teecas'} is preparing order ${n}.`];
    case 'preparing':
      return ['Being prepared', `Order ${n} is being prepared.`];
    case 'ready':
      return ['Order ready', `Order ${n} is ready.`];
    case 'out_for_delivery':
      return ['On the way', `Order ${n} is on its way. Have your payment ready.`];
    case 'completed':
      return ['Delivered', `Order ${n} has been delivered. Enjoy your meal!`];
    case 'cancelled':
      return ['Order cancelled', `Order ${n} was cancelled${order?.cancelReason ? `: ${order.cancelReason}` : '.'}`];
    default:
      return null;
  }
}

export async function notifyStatusLocally(order, token) {
  const Notifications = N();
  if (!Notifications || !enabled) return;
  const msg = statusMessage(order?.status, order);
  if (!msg) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: msg[0], body: msg[1], sound: 'default', data: { orderId: order.id, token: token || '', status: order.status } },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  } catch {
    /* notifications are best effort */
  }
}

// Called with { orderId, token } when the customer taps a notification.
export function onNotificationTap(handler) {
  const Notifications = N();
  if (!Notifications) return () => {};
  const open = (response) => {
    const data = response?.notification?.request?.content?.data || {};
    if (data.orderId) handler({ orderId: String(data.orderId), token: data.token ? String(data.token) : '' });
  };
  // A tap that launched the app from closed. Cleared once handled so it isn't opened again.
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      Notifications.clearLastNotificationResponse();
      open(last);
    }
  } catch {
    /* not available on this platform */
  }
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      /* ignore */
    }
    open(r);
  });
  return () => sub.remove();
}

// For checkout: ask once if never asked, then get the token, giving up after a few seconds so a
// slow network never holds up placing the order.
export async function pushTokenForOrder(cached) {
  if (!N()) return '';
  const work = (async () => {
    if (!(await askPermission())) return '';
    return cached || (await getPushToken());
  })();
  const timeout = new Promise((resolve) => setTimeout(() => resolve(''), 5000));
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return '';
  }
}
