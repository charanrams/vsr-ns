import axios, { AxiosError } from 'axios';

/**
 * Customer storefront API client. Separate session from the admin (different storage key and
 * axios instance), so a staff member's admin login and a customer login never interfere.
 */
import { API_BASE } from '../lib/config';

const BASE = API_BASE;
const STORE_KEY = 'vsr.shop.session';

export interface ShopUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  roles: string[];
}
export interface ShopSession {
  user: ShopUser;
  accessToken: string;
  refreshToken: string;
}

const listeners = new Set<(s: ShopSession | null) => void>();
let memory: ShopSession | null = null;

export const shopSession = {
  get(): ShopSession | null {
    if (memory) return memory;
    try {
      const raw = localStorage.getItem(STORE_KEY) ?? sessionStorage.getItem(STORE_KEY);
      memory = raw ? (JSON.parse(raw) as ShopSession) : null;
    } catch {
      memory = null;
    }
    return memory;
  },
  /** remember=false keeps the session for this tab only ("Keep me logged in" unticked). */
  set(s: ShopSession | null, remember?: boolean) {
    memory = s;
    try {
      const keep = remember ?? localStorage.getItem(STORE_KEY) !== null;
      localStorage.removeItem(STORE_KEY);
      sessionStorage.removeItem(STORE_KEY);
      if (s) (keep ? localStorage : sessionStorage).setItem(STORE_KEY, JSON.stringify(s));
    } catch {
      /* storage blocked: session lives in memory for this tab */
    }
    listeners.forEach((l) => l(s));
  },
};
export const onShopSession = (fn: (s: ShopSession | null) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const shopApi = axios.create({ baseURL: BASE, timeout: 20000 });

shopApi.interceptors.request.use((config) => {
  const s = shopSession.get();
  if (s) config.headers.Authorization = `Bearer ${s.accessToken}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;
async function refresh(): Promise<string | null> {
  const s = shopSession.get();
  if (!s) return null;
  try {
    const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken: s.refreshToken });
    shopSession.set({ user: data.user ?? s.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken as string;
  } catch {
    shopSession.set(null);
    return null;
  }
}

shopApi.interceptors.response.use(undefined, async (error: AxiosError) => {
  const cfg = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
  if (error.response?.status === 401 && cfg && !cfg._retried && !cfg.url?.startsWith('/auth/') && shopSession.get()) {
    cfg._retried = true;
    refreshing ??= refresh().finally(() => (refreshing = null));
    const token = await refreshing;
    if (token) {
      cfg.headers.Authorization = `Bearer ${token}`;
      return shopApi(cfg);
    }
  }
  return Promise.reject(error);
});

/** Human message from an API error (server sends { error: { message } } or { message }). */
export function errMsg(e: unknown, fallback = 'Something went wrong. Please try again.') {
  const ax = e as AxiosError<{ error?: { message?: string }; message?: string }>;
  if (ax?.code === 'ERR_NETWORK' || (ax?.isAxiosError && !ax.response)) return 'You’re offline. Check your connection and try again.';
  return ax?.response?.data?.error?.message ?? ax?.response?.data?.message ?? (!ax?.isAxiosError && e instanceof Error ? e.message : fallback);
}
export const isOffline = (e: unknown) => {
  const ax = e as AxiosError;
  return Boolean(ax?.isAxiosError && !ax.response);
};
