// Shared by the sign-up and sign-in screens.

import { router } from 'expo-router';

// Orders placed on this phone as a guest, with the tracking tokens that prove it. Sent with
// sign-up and sign-in so they move into the account and show on any phone from then on.
export function guestOrderKeys(orders) {
  return orders.filter((o) => o?.id && o.token && !o.demo).map((o) => ({ id: o.id, token: o.token }));
}

// After signing in, go back to where the customer came from (checkout, My orders, Settings).
export function leaveAuth() {
  if (router.canGoBack()) router.back();
  else router.replace('/menu');
}
