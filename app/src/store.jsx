// App state: cart, the customer's saved details, their past orders, their account and settings.
//
// Two lists of orders:
//  - `orders`: orders placed on this phone, with their tracking tokens. These are the keys the
//    phone needs to follow an order (and to move guest orders into an account on sign-in).
//  - `myOrders`: a signed-in customer's orders as the server last returned them. This is a cache:
//    My orders shows it straight away and refreshes it from the database (see useMyOrders.js).
// Customers don't choose a branch: Teecas picks the branch that cooks and delivers each order when
// it accepts it. Saved on the phone so the next visit picks up where they left off.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { localPhone } from './phone';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const Ctx = createContext(null);
const KEY = 'teecas.app.v1'; // unchanged so existing customers keep their cart and orders
const MAX_QTY = 50;
const MAX_ORDERS = 30;

const DEFAULT_SETTINGS = { notifications: true };

// The first-launch tour is shown once per tour version. Raise this when the tour changes and
// everyone sees it again on their next launch. (Earlier builds skipped it for anyone with saved
// orders; that is why it never showed on phones that had been used for testing.)
export const TOUR_VERSION = 2;

// What's on the phone may come from an older version of the app: keep only what is well formed.
function cleanCart(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, line] of Object.entries(raw)) {
    const item = line?.item;
    const qty = Math.round(Number(line?.qty) || 0);
    if (!item || !item.id || !item.name || qty <= 0) continue;
    out[id] = { item: { ...item, price: Number(item.price) || 0, available: item.available !== false }, qty: Math.min(MAX_QTY, qty) };
  }
  return out;
}

function cleanOrders(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o) => o && o.id).slice(0, MAX_ORDERS);
}

function cleanAccount(raw) {
  const c = raw?.customer;
  if (!raw || typeof raw.token !== 'string' || !raw.token || !c?.id) return null;
  return { token: raw.token, customer: { id: String(c.id), name: String(c.name || ''), phone: String(c.phone || ''), email: String(c.email || ''), address: String(c.address || '') } };
}

const EMPTY_MY_ORDERS = { list: [], more: false, fetchedAt: 0, customerId: '' };

function cleanMyOrders(raw, account) {
  // Only keep a cached list that belongs to the account that is signed in.
  if (!account || !raw || raw.customerId !== account.customer.id || !Array.isArray(raw.list)) return EMPTY_MY_ORDERS;
  return { list: raw.list.filter((o) => o && o.id), more: Boolean(raw.more), fetchedAt: 0, customerId: raw.customerId };
}

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);
  const [cart, setCart] = useState({});
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tourSeen, setTourSeen] = useState(0);
  const [pushToken, setPushToken] = useState('');
  const [account, setAccount] = useState(null); // { token, customer } when signed in
  const [gateSeen, setGateSeen] = useState(false); // the sign-in / guest page after the tour has been dealt with
  const [myOrders, setMyOrdersState] = useState(EMPTY_MY_ORDERS);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const s = JSON.parse(raw);
        setCart(cleanCart(s.cart));
        if (s.customer && typeof s.customer === 'object') {
          setCustomer({ name: String(s.customer.name || ''), phone: String(s.customer.phone || ''), address: String(s.customer.address || '') });
        }
        setOrders(cleanOrders(s.orders));
        if (s.settings && typeof s.settings === 'object') setSettings({ ...DEFAULT_SETTINGS, ...s.settings });
        setTourSeen(Number(s.tourSeen) || 0);
        if (typeof s.pushToken === 'string') setPushToken(s.pushToken);
        setGateSeen(Boolean(s.gateSeen));
        const acct = cleanAccount(s.account);
        setAccount(acct);
        // fetchedAt starts at 0 so the saved list shows at once and is refreshed on first open.
        setMyOrdersState(cleanMyOrders(s.myOrders, acct));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ cart, customer, orders, settings, tourSeen, pushToken, account, myOrders, gateSeen })).catch(() => {});
  }, [cart, customer, orders, settings, tourSeen, pushToken, account, myOrders, gateSeen]);

  const add = useCallback((item) => {
    if (!item?.id) return;
    setCart((c) => ({ ...c, [item.id]: { item, qty: Math.min(MAX_QTY, (c[item.id]?.qty || 0) + 1) } }));
  }, []);

  const remove = useCallback((itemId) => {
    setCart((c) => {
      const cur = c[itemId];
      if (!cur) return c;
      const next = { ...c };
      if (cur.qty <= 1) delete next[itemId];
      else next[itemId] = { ...cur, qty: cur.qty - 1 };
      return next;
    });
  }, []);

  const setQty = useCallback((itemId, qty) => {
    setCart((c) => {
      if (!c[itemId]) return c;
      const next = { ...c };
      if (qty <= 0) delete next[itemId];
      else next[itemId] = { ...next[itemId], qty: Math.min(MAX_QTY, qty) };
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  // Keep cart items in step with the latest menu: prices, names, sold out, removed dishes.
  const syncCart = useCallback((items) => {
    if (!Array.isArray(items)) return;
    const byId = new Map(items.map((i) => [i.id, i]));
    setCart((c) => {
      let changed = false;
      const next = {};
      for (const [id, line] of Object.entries(c)) {
        const fresh = byId.get(id);
        if (!fresh) {
          changed = true;
          continue;
        }
        if (fresh.price !== line.item.price || fresh.available !== line.item.available || fresh.name !== line.item.name) changed = true;
        next[id] = { item: fresh, qty: line.qty };
      }
      return changed ? next : c;
    });
  }, []);

  // Mark named items sold out (after the server refuses an order) without dropping them.
  const markSoldOut = useCallback((names) => {
    const gone = new Set(names || []);
    if (!gone.size) return;
    setCart((c) => {
      const next = {};
      for (const [id, line] of Object.entries(c)) {
        next[id] = gone.has(line.item.name) ? { ...line, item: { ...line.item, available: false } } : line;
      }
      return next;
    });
  }, []);

  const saveOrder = useCallback((o) => setOrders((list) => [o, ...list.filter((x) => x.id !== o.id)].slice(0, MAX_ORDERS)), []);

  const updateOrder = useCallback((id, patch) => {
    setOrders((list) => {
      let changed = false;
      const next = list.map((o) => {
        if (o.id !== id) return o;
        const merged = { ...o, ...patch };
        if (Object.keys(patch).some((k) => merged[k] !== o[k])) changed = true;
        return merged;
      });
      return changed ? next : list;
    });
  }, []);

  const updateSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);
  const finishOnboarding = useCallback(() => setTourSeen(TOUR_VERSION), []);
  const replayTour = useCallback(() => setTourSeen(0), []);

  const forgetDetails = useCallback(() => setCustomer({ name: '', phone: '', address: '' }), []);

  // After sign-up or sign-in. Checkout is pre-filled from the account.
  const startSession = useCallback(({ token, customer: c }) => {
    setGateSeen(true);
    setAccount({ token, customer: c });
    setMyOrdersState({ ...EMPTY_MY_ORDERS, customerId: c.id });
    setCustomer((cur) => ({ name: c.name || cur.name, phone: c.phone ? localPhone(c.phone) : cur.phone, address: c.address || cur.address }));
  }, []);

  const updateAccountCustomer = useCallback((c) => {
    if (!c) return;
    setAccount((a) => (a && a.customer.id === c.id ? { ...a, customer: c } : a));
  }, []);

  // The sign-in / guest page has been dealt with (signed in, or chose to continue as a guest).
  const finishGate = useCallback(() => setGateSeen(true), []);

  // Logging out takes the account off this phone: its cached order list, the orders placed while
  // signed in (they live in the account and come back when the customer signs in again) and the
  // saved name, phone and address, so the next person to use the phone doesn't see them. Orders
  // placed as a guest stay: guests' history is kept only on the phone.
  const signOut = useCallback(() => {
    setAccount(null);
    setMyOrdersState(EMPTY_MY_ORDERS);
    setOrders((list) => list.filter((o) => !o.customerId));
    setCustomer({ name: '', phone: '', address: '' });
  }, []);

  // Save what the server returned for the signed-in account. Ignored if the customer signed out
  // or switched accounts while the request was on its way.
  const setMyOrders = useCallback((customerId, next) => {
    setMyOrdersState((cur) => (cur.customerId === customerId ? { ...cur, ...next } : cur));
  }, []);

  const value = useMemo(() => {
    const lines = Object.values(cart);
    return {
      ready,
      open,
      setOpen,
      cart,
      add,
      remove,
      setQty,
      clearCart,
      syncCart,
      markSoldOut,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * (Number(l.item.price) || 0), 0),
      customer,
      setCustomer,
      forgetDetails,
      orders,
      saveOrder,
      updateOrder,
      settings,
      updateSettings,
      onboarded: tourSeen >= TOUR_VERSION,
      finishOnboarding,
      replayTour,
      pushToken,
      setPushToken,
      account,
      gateSeen,
      finishGate,
      signedIn: Boolean(account),
      startSession,
      updateAccountCustomer,
      signOut,
      myOrders,
      setMyOrders,
    };
  }, [ready, open, cart, add, remove, setQty, clearCart, syncCart, markSoldOut, customer, forgetDetails, orders, saveOrder, updateOrder, settings, updateSettings, tourSeen, finishOnboarding, replayTour, pushToken, account, gateSeen, finishGate, startSession, updateAccountCustomer, signOut, myOrders, setMyOrders]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
