// Turning order notifications on or off, for this phone and for the orders it is following.

import { setOrderPush } from './api';
import { askPermission, getPushToken, hasPermission } from './notifications';
import { isActiveOrder } from './orderWatcher';

// Returns { granted, token }. granted=false means the phone said no (Settings can open the
// system settings so the customer can change that).
export async function turnNotificationsOn({ orders, updateOrder, setPushToken }) {
  const granted = await askPermission();
  if (!granted) return { granted: false, token: '' };
  const token = await getPushToken();
  setPushToken(token);
  if (token) {
    await Promise.all(
      orders.filter(isActiveOrder).map((o) =>
        setOrderPush(o.id, o.token, token)
          .then(() => updateOrder(o.id, { push: true }))
          .catch(() => {}),
      ),
    );
  }
  return { granted: true, token };
}

// Quietly, without asking: when the phone allows notifications, make sure this phone's push token
// is saved and attached to every order still on its way. Covers a token that wasn't ready when the
// order was placed (checkout gives up after 5 seconds), a permission granted later in the phone's
// settings, and a token that changed. Run at launch and whenever the app comes back to the front.
export async function syncPush({ orders, updateOrder, pushToken, setPushToken }) {
  if (!(await hasPermission())) return;
  const token = await getPushToken();
  if (!token) return;
  if (token !== pushToken) setPushToken(token);
  const changed = token !== pushToken;
  await Promise.all(
    orders
      .filter((o) => isActiveOrder(o) && (!o.push || changed))
      .map((o) =>
        setOrderPush(o.id, o.token, token)
          .then(() => updateOrder(o.id, { push: true }))
          .catch(() => {}),
      ),
  );
}

export async function turnNotificationsOff({ orders, updateOrder }) {
  await Promise.all(
    orders
      .filter((o) => o.push && o.token)
      .map((o) =>
        setOrderPush(o.id, o.token, null)
          .then(() => updateOrder(o.id, { push: false }))
          .catch(() => updateOrder(o.id, { push: false })),
      ),
  );
}
