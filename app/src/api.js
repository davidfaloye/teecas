// Calls to the Teecas admin API (teecas-admin, /api/public/*), plus demo mode.
//
// Everything that comes back from the server is checked and filled with safe defaults before a
// screen sees it. The admin can edit, reassign, cancel or archive things at any time, and an older
// or newer server may send slightly different shapes; a missing field must never crash the app
// (that is what caused "Cannot read property 'order' of null" on order #2539: the server answered
// a tracking poll without a usable JSON body and the screen read `.order` from null).

import Constants from 'expo-constants';
import { DEMO_WHATSAPP, demoBranches, demoMenu } from './demo';
import { naira } from './theme';

const fromConfig = Constants.expoConfig?.extra?.apiUrl;
export const API_URL = String(process.env.EXPO_PUBLIC_API_URL || fromConfig || '').replace(/\/+$/, '');

// With no API configured the app runs on built-in sample data and orders go to WhatsApp only.
export const DEMO_MODE = !API_URL;

export const ORDER_STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
export const DONE_STATUSES = ['completed', 'cancelled'];

export class ApiError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

// A message that is safe to show a customer, whatever was thrown.
export function friendlyError(err) {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Pull down to try again.';
}

const TIMEOUT_MS = 30000; // Render can take a while to wake the admin up.

// auth: a signed-in customer's token. Sent when present; guests send nothing.
async function request(path, { method = 'GET', body, query, auth } = {}) {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_URL}/api/public${path}${qs}`, {
      method,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Never serve a cached order status.
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw timedOut
      ? new ApiError('Teecas is taking too long to answer. Try again in a moment.', 'TIMEOUT')
      : new ApiError("We couldn't reach Teecas. Check your internet and try again.", 'NETWORK');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null; // empty body, HTML error page, etc.
  }
  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);

  if (!res.ok) {
    if (res.status === 429) throw new ApiError(isObject && data.error ? data.error : 'Too many tries. Wait a minute and try again.', 'RATE_LIMITED');
    throw new ApiError(isObject && data.error ? String(data.error) : 'Something went wrong. Try again.', isObject ? data.code : `HTTP_${res.status}`, isObject ? data.details : undefined);
  }
  if (!isObject) {
    throw new ApiError("Teecas sent an answer we couldn't read. Try again in a moment.", 'BAD_RESPONSE');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Normalisers: turn whatever the server sent into the shapes the screens use.

const text = (v, fallback = '') => (v === null || v === undefined ? fallback : String(v));
const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const arr = (v) => (Array.isArray(v) ? v : []);

export function normalizeBranch(b) {
  if (!b || typeof b !== 'object' || !b.id) return null;
  return {
    id: text(b.id),
    name: text(b.name, 'Teecas'),
    address: text(b.address),
    landmark: text(b.landmark),
    phone: text(b.phone || b.whatsapp),
    whatsapp: text(b.whatsapp),
    hours: text(b.hours),
    deliveryFee: money(b.deliveryFee),
    acceptingOrders: Boolean(b.acceptingOrders),
  };
}

export function normalizeMenu(d) {
  const categories = arr(d?.categories)
    .filter((c) => c && c.id)
    .map((c) => ({ id: text(c.id), name: text(c.name, 'Menu'), subtitle: text(c.subtitle) }));
  const items = arr(d?.items)
    .filter((i) => i && i.id && i.name)
    .map((i) => ({
      id: text(i.id),
      categoryId: text(i.categoryId),
      name: text(i.name),
      description: text(i.description),
      price: money(i.price),
      emoji: text(i.emoji),
      imageUrl: /^https?:\/\//.test(text(i.imageUrl)) ? text(i.imageUrl) : '',
      popular: Boolean(i.popular),
      available: i.available !== false,
    }));
  return { categories, items };
}

export function normalizeOrder(o) {
  if (!o || typeof o !== 'object' || !o.id) return null;
  const items = arr(o.items)
    .filter(Boolean)
    .map((i) => {
      const qty = Math.max(0, Math.round(Number(i.qty) || 0));
      const price = money(i.price);
      return { name: text(i.name, 'Item'), qty, price, lineTotal: i.lineTotal === undefined ? price * qty : money(i.lineTotal) };
    });
  const status = ORDER_STATUSES.includes(o.status) ? o.status : 'placed';
  const history = arr(o.statusHistory)
    .filter((h) => h && ORDER_STATUSES.includes(h.status))
    .map((h) => ({ status: h.status, at: text(h.at) }));
  const subtotal = o.subtotal === undefined ? items.reduce((s, i) => s + i.lineTotal, 0) : money(o.subtotal);
  return {
    id: text(o.id),
    number: text(o.number, '—'),
    branchId: o.branchId ? text(o.branchId) : null,
    branchName: text(o.branchName),
    status,
    statusHistory: history.length ? history : [{ status, at: text(o.createdAt) }],
    fulfilment: o.fulfilment === 'pickup' ? 'pickup' : 'delivery',
    items,
    subtotal,
    deliveryFee: money(o.deliveryFee),
    deliveryFeeExcluded: Boolean(o.deliveryFeeExcluded),
    total: o.total === undefined ? subtotal : money(o.total),
    paymentStatus: o.paymentStatus === 'paid' ? 'paid' : 'unpaid',
    customer: { name: text(o.customer?.name), address: text(o.customer?.address) },
    cancelReason: text(o.cancelReason),
    createdAt: text(o.createdAt, new Date().toISOString()),
    trackingToken: o.trackingToken ? text(o.trackingToken) : '',
  };
}

function normalizeWhatsapp(w) {
  if (!w || typeof w !== 'object' || !/^https:\/\/wa\.me\//.test(text(w.url))) return null;
  return { url: text(w.url), text: text(w.text), phone: text(w.phone) };
}

// ---------------------------------------------------------------------------

export async function fetchBranches() {
  if (DEMO_MODE) return demoBranches;
  const d = await request('/branches');
  return arr(d.branches).map(normalizeBranch).filter(Boolean);
}

// The whole menu. Sold out means off at every branch; Teecas picks a branch that has the food.
export async function fetchMenu() {
  if (DEMO_MODE) return demoMenu();
  return normalizeMenu(await request('/menu'));
}

// Orders are for delivery and carry no branch: Teecas assigns one when it accepts the order.
// input: { customer: {name, phone, address}, note, lines: [{ item, qty }], pushToken?, auth? }
// With auth (a signed-in customer's token) the order is saved to their account.
export async function placeOrder(input) {
  if (DEMO_MODE) return placeDemoOrder(input);
  const d = await request('/orders', {
    method: 'POST',
    auth: input.auth || undefined,
    body: {
      fulfilment: 'delivery',
      customer: input.customer,
      note: input.note,
      items: input.lines.map((l) => ({ id: l.item.id, qty: l.qty })),
      pushToken: input.pushToken || undefined,
    },
  });
  const order = normalizeOrder(d.order);
  if (!order) throw new ApiError("Your order may not have gone through. Check My orders, or try again.", 'BAD_RESPONSE');
  return { order, whatsapp: normalizeWhatsapp(d.whatsapp), demo: false };
}

// Tracking. Needs the token the server gave when the order was placed.
export async function fetchOrder(id, token) {
  if (!id || !token) throw new ApiError("We can't follow this order from this phone.", 'NO_TOKEN');
  const d = await request(`/orders/${encodeURIComponent(id)}`, { query: { token, _: Date.now() } });
  const order = normalizeOrder(d.order);
  if (!order) throw new ApiError("We couldn't load this order. Pull down to try again.", 'BAD_RESPONSE');
  return { order, branch: normalizeBranch(d.branch), whatsapp: normalizeWhatsapp(d.whatsapp) };
}

// Turn status notifications for one order on (pushToken) or off (null).
export async function setOrderPush(id, token, pushToken) {
  if (DEMO_MODE || !id || !token) return;
  await request(`/orders/${encodeURIComponent(id)}/push`, { method: 'PUT', query: { token }, body: { pushToken: pushToken || null } });
}

// ---------------------------------------------------------------------------
// Customer accounts: phone number + password. Guests can still order without one.

export function normalizeCustomer(c) {
  if (!c || typeof c !== 'object' || !c.id) return null;
  return { id: text(c.id), name: text(c.name), phone: text(c.phone), email: text(c.email), address: text(c.address) };
}

function accountsOff() {
  return new ApiError('Accounts need the Teecas server. This preview runs on sample data.', 'DEMO_MODE');
}

function session(d) {
  const customer = normalizeCustomer(d.customer);
  if (!d.token || !customer) throw new ApiError("We couldn't sign you in. Try again in a moment.", 'BAD_RESPONSE');
  return { token: text(d.token), customer, claimed: Number(d.claimed) || 0 };
}

// claim: [{ id, token }] guest orders on this phone to move into the account.
export async function signUp({ name, email, password, claim }) {
  if (DEMO_MODE) throw accountsOff();
  return session(await request('/account/signup', { method: 'POST', body: { name, email, password, claim } }));
}

// Forgot password, step 1: emails a 6-digit code to the account. login: phone number or email.
// The server answers the same whether or not the account exists. Returns how many minutes the
// code lasts.
export async function requestPasswordReset(login) {
  if (DEMO_MODE) throw accountsOff();
  const d = await request('/account/forgot', { method: 'POST', body: { login } });
  return Number(d.minutes) || 15;
}

// Forgot password, step 2: the code and a new password. Signs in, like signIn.
export async function resetPassword({ login, code, password, claim }) {
  if (DEMO_MODE) throw accountsOff();
  return session(await request('/account/reset', { method: 'POST', body: { login, code, password, claim } }));
}

// login: the account's email.
export async function signIn({ login, password, claim }) {
  if (DEMO_MODE) throw accountsOff();
  return session(await request('/account/signin', { method: 'POST', body: { login, password, claim } }));
}

export async function fetchMe(auth) {
  const d = await request('/account/me', { auth, query: { _: Date.now() } });
  const customer = normalizeCustomer(d.customer);
  if (!customer) throw new ApiError("We couldn't load your account. Try again in a moment.", 'BAD_RESPONSE');
  return customer;
}

export async function updateMe(auth, patch) {
  const d = await request('/account/me', { method: 'PUT', auth, body: patch });
  return normalizeCustomer(d.customer);
}

export async function deleteAccount(auth) {
  await request('/account/me', { method: 'DELETE', auth });
}

// The signed-in customer's orders, newest first, from the database. before: createdAt of the
// last order already shown, to load older ones.
export async function fetchMyOrders(auth, { before, limit } = {}) {
  const d = await request('/account/orders', { auth, query: { before, limit, _: Date.now() } });
  return { orders: arr(d.orders).map(normalizeOrder).filter(Boolean), more: Boolean(d.more) };
}

export async function claimOrders(auth, orders) {
  if (!orders?.length) return 0;
  const d = await request('/account/claim', { method: 'POST', auth, body: { orders } });
  return Number(d.claimed) || 0;
}

// The server no longer accepts this sign-in (expired, account deleted): sign out on the phone.
export const isSignedOutError = (e) => e?.code === 'UNAUTHENTICATED';

// ---- demo mode: same WhatsApp message the server writes ----

export function orderMessage(o, phone, note) {
  const parts = [
    "Hello, I'd like to place an order for:",
    '',
    ...o.items.map((i) => `${i.name} ~ ${i.qty}`),
    '',
    `Order: #${o.number}`,
    `Delivery to: ${o.customer.address}`,
    `Total: ${naira(o.total)} (pay on delivery, delivery fee excluded)`,
    `Name: ${o.customer.name}`,
    `Phone: ${phone}`,
  ];
  if (note) parts.push(`Note: ${note}`);
  return parts.join('\n');
}

function placeDemoOrder(input) {
  const unavailable = input.lines.filter((l) => !l.item.available).map((l) => l.item.name);
  if (unavailable.length) {
    throw new ApiError(`Sold out: ${unavailable.join(', ')}. Remove it to continue.`, 'ITEM_UNAVAILABLE', { unavailable });
  }
  const items = input.lines.map((l) => ({ name: l.item.name, qty: l.qty, price: l.item.price, lineTotal: l.item.price * l.qty }));
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const now = new Date().toISOString();
  const order = normalizeOrder({
    id: `demo-${Date.now()}`,
    number: `D${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'placed',
    statusHistory: [{ status: 'placed', at: now }],
    fulfilment: 'delivery',
    items,
    subtotal,
    deliveryFee: 0,
    deliveryFeeExcluded: true,
    total: subtotal,
    paymentStatus: 'unpaid',
    customer: { name: input.customer.name, address: input.customer.address },
    createdAt: now,
  });
  const msg = orderMessage(order, input.customer.phone, input.note);
  return {
    order,
    whatsapp: { phone: DEMO_WHATSAPP, text: msg, url: `https://wa.me/${DEMO_WHATSAPP}?text=${encodeURIComponent(msg)}` },
    demo: true,
  };
}
