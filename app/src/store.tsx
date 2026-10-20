// App state: chosen branch, cart, the customer's saved details and their past orders.
// Saved on the phone so the next visit picks up where they left off.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Branch, Customer, Fulfilment, MenuItem, SavedOrder } from './types';

type Cart = Record<string, { item: MenuItem; qty: number }>;

type State = {
  ready: boolean;
  branch: Branch | null;
  setBranch: (b: Branch) => void;
  cart: Cart;
  add: (item: MenuItem) => void;
  remove: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  clearCart: () => void;
  // Keep cart items in step with the latest menu (prices, sold-out).
  syncCart: (items: MenuItem[]) => void;
  count: number;
  subtotal: number;
  fulfilment: Fulfilment;
  setFulfilment: (f: Fulfilment) => void;
  customer: Customer;
  setCustomer: (c: Customer) => void;
  orders: SavedOrder[];
  saveOrder: (o: SavedOrder) => void;
};

const Ctx = createContext<State | null>(null);
const KEY = 'teecas.app.v1';
const MAX_QTY = 50;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [branch, setBranchState] = useState<Branch | null>(null);
  const [cart, setCart] = useState<Cart>({});
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery');
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', address: '' });
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.branch) setBranchState(s.branch);
        if (s.cart) setCart(s.cart);
        if (s.fulfilment) setFulfilment(s.fulfilment);
        if (s.customer) setCustomer(s.customer);
        if (Array.isArray(s.orders)) setOrders(s.orders);
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ branch, cart, fulfilment, customer, orders })).catch(() => {});
  }, [branch, cart, fulfilment, customer, orders]);

  const branchRef = useRef<Branch | null>(null);
  branchRef.current = branch;
  const setBranch = useCallback((b: Branch) => {
    // A different branch has its own menu and stock, so start a fresh order.
    if (branchRef.current && branchRef.current.id !== b.id) setCart({});
    setBranchState(b);
  }, []);

  const add = useCallback((item: MenuItem) => {
    setCart((c) => ({ ...c, [item.id]: { item, qty: Math.min(MAX_QTY, (c[item.id]?.qty || 0) + 1) } }));
  }, []);
  const remove = useCallback((itemId: string) => {
    setCart((c) => {
      const cur = c[itemId];
      if (!cur) return c;
      const next = { ...c };
      if (cur.qty <= 1) delete next[itemId];
      else next[itemId] = { ...cur, qty: cur.qty - 1 };
      return next;
    });
  }, []);
  const setQty = useCallback((itemId: string, qty: number) => {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[itemId];
      else if (next[itemId]) next[itemId] = { ...next[itemId], qty: Math.min(MAX_QTY, qty) };
      return next;
    });
  }, []);
  const clearCart = useCallback(() => setCart({}), []);
  const syncCart = useCallback((items: MenuItem[]) => {
    const byId = new Map(items.map((i) => [i.id, i]));
    setCart((c) => {
      let changed = false;
      const next: Cart = {};
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
  const saveOrder = useCallback((o: SavedOrder) => setOrders((list) => [o, ...list.filter((x) => x.id !== o.id)].slice(0, 30)), []);

  const value = useMemo<State>(() => {
    const lines = Object.values(cart);
    return {
      ready,
      branch,
      setBranch,
      cart,
      add,
      remove,
      setQty,
      clearCart,
      syncCart,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * l.item.price, 0),
      fulfilment,
      setFulfilment,
      customer,
      setCustomer,
      orders,
      saveOrder,
    };
  }, [ready, branch, setBranch, cart, add, remove, setQty, clearCart, syncCart, fulfilment, customer, orders, saveOrder]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
