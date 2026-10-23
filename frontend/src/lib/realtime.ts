import type { QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { api, onSession, sessionStore } from './api';
import { API_ORIGIN } from './config';

/** Collection → query-key prefixes that display it. See docs/realtime-sync.md. */
const KEYS: Record<string, string[]> = {
  products: ['products', 'product', 'inventory-overview', 'movements', 'dashboard', 'search', 'home-layout-preview'],
  categories: ['categories', 'cats-root', 'cats-sub', 'products', 'dashboard'],
  inventorymovements: ['movements', 'inventory-overview', 'products', 'product'],
  reviews: ['reviews', 'product'],
  orders: ['orders', 'order', 'order-counts', 'dashboard', 'customers', 'customer', 'reports', 'partners', 'payments'],
  payments: ['payments', 'payment', 'order', 'orders', 'dashboard', 'reports'],
  refunds: ['payments', 'payment', 'order', 'orders', 'dashboard', 'reports'],
  users: ['customers', 'customer', 'customer-insights', 'staff'],
  deliverypartners: ['partners', 'order'],
  banners: ['banners'],
  coupons: ['coupons', 'banners'],
  supporttickets: ['support', 'ticket', 'customer'],
  notifications: ['admin-notifications', 'bell'],
  auditlogs: ['audit'],
  kitchens: ['kitchens', 'products'],
  homelayouts: ['home-layout', 'home-layout-preview'],
};

interface Change {
  coll: string;
  op: string;
  id?: string;
}

/** Keeps every open admin page in sync with the database. Returns a cleanup function. */
export function startRealtime(qc: QueryClient) {
  let socket: Socket | null = null;
  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Writes come in bursts (an order accept touches orders, products, movements, audit) → one refetch per key
  const flush = () => {
    const keys = pending;
    pending = new Set();
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const connect = () => {
    socket?.disconnect();
    const token = sessionStore.get()?.accessToken;
    if (!token) {
      socket = null;
      return;
    }
    socket = io(API_ORIGIN, { auth: { token }, transports: ['websocket'] });
    socket.on('change', (c: Change) => {
      (KEYS[c.coll] ?? []).forEach((k) => pending.add(k));
      clearTimeout(timer);
      timer = setTimeout(flush, 250);
    });
    // Token expired during a reconnect: any API call refreshes it, and onSession then rejoins
    socket.on('auth_error', () => {
      api.get('/auth/me').catch(() => undefined);
    });
    // Anything missed while disconnected: refetch what's on screen
    socket.io.on('reconnect', () => qc.invalidateQueries());
  };

  connect();
  // Login, logout and token refresh all rotate the token → rejoin with the new one
  let lastToken = sessionStore.get()?.accessToken;
  const off = onSession((s) => {
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
