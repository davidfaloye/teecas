// While the app is open, checks the customer's active orders and keeps their saved status fresh.
// When a status changes on an order that has no push registered, it shows a local notification
// (orders with push get the admin's push message instead, so nothing is shown twice).

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { DONE_STATUSES, fetchOrder } from './api';
import { notifyStatusLocally } from './notifications';
import { useStore } from './store';

const EVERY_MS = 20000;
const WATCH_FOR_MS = 24 * 3600e3;

export function isActiveOrder(o) {
  if (!o || o.demo || !o.token || o.gone) return false;
  if (DONE_STATUSES.includes(o.lastStatus)) return false;
  const age = Date.now() - new Date(o.createdAt).getTime();
  return Number.isFinite(age) && age < WATCH_FOR_MS;
}

// Orders placed in demo mode (WhatsApp only) stay on the menu banner for three hours.
export function isRecentDemoOrder(o) {
  if (!o?.demo) return false;
  const age = Date.now() - new Date(o.createdAt).getTime();
  return Number.isFinite(age) && age < 3 * 3600e3;
}

export function useOrderWatcher() {
  const { orders, updateOrder, settings } = useStore();
  const latest = useRef({ orders, updateOrder, settings });
  useEffect(() => {
    latest.current = { orders, updateOrder, settings };
  }, [orders, updateOrder, settings]);
  const busy = useRef(false);

  useEffect(() => {
    let timer = null;

    async function check() {
      if (busy.current || AppState.currentState !== 'active') return;
      busy.current = true;
      try {
        const active = latest.current.orders.filter(isActiveOrder);
        for (const saved of active) {
          try {
            const { order } = await fetchOrder(saved.id, saved.token);
            const changed = order.status !== saved.lastStatus;
            latest.current.updateOrder(saved.id, { lastStatus: order.status, branchName: order.branchName || saved.branchName, total: order.total });
            if (changed && saved.lastStatus && !saved.push && latest.current.settings.notifications) {
              notifyStatusLocally(order, saved.token);
            }
          } catch (e) {
            // The admin deleted the order, or the token no longer matches: stop asking.
            if (e?.code === 'NOT_FOUND' || e?.code === 'HTTP_404' || e?.code === 'NO_TOKEN') latest.current.updateOrder(saved.id, { gone: true });
          }
        }
      } finally {
        busy.current = false;
      }
    }

    check();
    timer = setInterval(check, EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}
