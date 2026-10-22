// Turning order notifications on or off, for this phone and for the orders it is following.

import { setOrderPush } from './api';
import { askPermission, getPushToken } from './notifications';
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
