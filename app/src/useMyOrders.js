// A signed-in customer's orders, from the database.
//
// The list is cached in the store (and saved on the phone), not in the screen, because the
// screen unmounts whenever the customer leaves it: useMemo or useCallback inside the screen
// would forget everything on the next visit. With the cache in the store:
//  - opening My orders shows the last list straight away, even offline;
//  - it only asks the server again when the list is older than STALE_MS, or when an order was
//    placed on this phone after the list was fetched;
//  - pull to refresh always asks the server;
//  - while the screen is open and an order is still on its way, it refreshes every POLL_MS so the
//    status keeps up.

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DONE_STATUSES, fetchMyOrders, friendlyError, isSignedOutError } from './api';
import { useStore } from './store';

const STALE_MS = 30 * 1000;
const POLL_MS = 20 * 1000;
const PAGE = 20;

// The same shape as the orders saved on this phone, so one list row works for both.
function toRow(o) {
  return {
    id: o.id,
    number: o.number,
    branchName: o.branchName,
    total: o.total,
    createdAt: o.createdAt,
    lastStatus: o.status,
    fulfilment: o.fulfilment,
    token: o.trackingToken,
  };
}

export function useMyOrders() {
  const { account, myOrders, setMyOrders, signOut, orders: phoneOrders } = useStore();
  const customerId = account?.customer.id || '';
  const token = account?.token || '';
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  // Read the latest values inside the focus effect without re-running it on every change.
  const latest = useRef({ myOrders, phoneOrders });
  useEffect(() => {
    latest.current = { myOrders, phoneOrders };
  }, [myOrders, phoneOrders]);

  const refresh = useCallback(async () => {
    if (!token || busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const { orders, more } = await fetchMyOrders(token, { limit: PAGE });
      setMyOrders(customerId, { list: orders.map(toRow), more, fetchedAt: Date.now() });
      setError('');
    } catch (e) {
      if (isSignedOutError(e)) signOut();
      else setError(friendlyError(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [token, customerId, setMyOrders, signOut]);

  const loadMore = useCallback(async () => {
    const { list, more } = latest.current.myOrders;
    if (!token || !more || busy.current || !list.length) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchMyOrders(token, { limit: PAGE, before: list[list.length - 1].createdAt });
      const seen = new Set(list.map((o) => o.id));
      setMyOrders(customerId, { list: [...list, ...page.orders.filter((o) => !seen.has(o.id)).map(toRow)], more: page.more });
    } catch (e) {
      if (isSignedOutError(e)) signOut();
      else setError(friendlyError(e));
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [token, customerId, setMyOrders, signOut]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return undefined;
      const { myOrders: cached, phoneOrders: placed } = latest.current;
      const newerOrder = placed.some((o) => !o.demo && new Date(o.createdAt).getTime() > cached.fetchedAt);
      if (Date.now() - cached.fetchedAt > STALE_MS || newerOrder) refresh();
      const timer = setInterval(() => {
        if (latest.current.myOrders.list.some((o) => !DONE_STATUSES.includes(o.lastStatus))) refresh();
      }, POLL_MS);
      return () => clearInterval(timer);
    }, [token, refresh]),
  );

  return {
    signedIn: Boolean(token),
    orders: myOrders.list,
    more: myOrders.more,
    loaded: myOrders.fetchedAt > 0 || myOrders.list.length > 0,
    loading,
    loadingMore,
    error,
    refresh,
    loadMore,
  };
}
