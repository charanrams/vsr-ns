import type { QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { onShopSession, shopApi, shopSession } from './api';
import { API_ORIGIN } from '../lib/config';

/** Collection → storefront query keys (all under 'shop'). Mirrors mobile lib/state/realtime.dart. */
const KEYS: Record<string, string[]> = {
  products: ['home', 'products', 'product', 'deals', 'search', 'recent', 'recommended', 'wishlist', 'cart'],
  categories: ['categories', 'home'],
  banners: ['home'],
  homelayouts: ['home', 'recommended'],
  reviews: ['product', 'reviews'],
  coupons: ['coupons', 'cart'],
  orders: ['orders', 'order'],
  payments: ['orders', 'order'],
  refunds: ['orders', 'order'],
  deliverypartners: ['order'],
  carts: ['cart'],
  stockalerts: ['stock-alerts'],
  notifications: ['notifications'],
  users: ['addresses', 'wishlist'],
  supporttickets: ['tickets'],
};

/** Live storefront: guests get catalogue changes; signed-in customers also get their own data. */
export function startShopRealtime(qc: QueryClient) {
  let socket: Socket | null = null;
  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    const keys = pending;
    pending = new Set();
    keys.forEach((k) => qc.invalidateQueries({ queryKey: ['shop', k] }));
  };

  const connect = () => {
    socket?.disconnect();
    const token = shopSession.get()?.accessToken;
    socket = io(API_ORIGIN, { auth: token ? { token } : {}, transports: ['websocket'] });
    socket.on('change', (c: { coll: string }) => {
      (KEYS[c.coll] ?? []).forEach((k) => pending.add(k));
      clearTimeout(timer);
      timer = setTimeout(flush, 250);
    });
    socket.on('auth_error', () => {
      shopApi.get('/auth/me').catch(() => undefined);
    });
    socket.io.on('reconnect', () => qc.invalidateQueries({ queryKey: ['shop'] }));
  };

  connect();
  let lastToken = shopSession.get()?.accessToken;
  const off = onShopSession((s) => {
    if (s?.accessToken === lastToken) return;
    lastToken = s?.accessToken;
    connect();
  });
  return () => {
    off();
    clearTimeout(timer);
    socket?.disconnect();
  };
}
