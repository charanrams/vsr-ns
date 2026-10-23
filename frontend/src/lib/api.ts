import axios, { AxiosError } from 'axios';

import { API_BASE } from './config';

const BASE = API_BASE;
const STORE_KEY = 'vsr.session';

export interface SessionUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
}
interface Session {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

export const sessionStore = {
  get(): Session | null {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  set(s: Session | null) {
    try {
      if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORE_KEY);
    } catch {
      /* storage unavailable — session lives in memory only */
    }
    listeners.forEach((l) => l(s));
  },
};
const listeners = new Set<(s: Session | null) => void>();
export const onSession = (fn: (s: Session | null) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const api = axios.create({ baseURL: BASE, timeout: 20000 });

api.interceptors.request.use((config) => {
  const s = sessionStore.get();
  if (s) config.headers.Authorization = `Bearer ${s.accessToken}`;
  return config;
});

// Rotate the refresh token once on 401, then retry the original request
let refreshing: Promise<string | null> | null = null;
async function refresh(): Promise<string | null> {
  const s = sessionStore.get();
  if (!s) return null;
  try {
    const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken: s.refreshToken });
    sessionStore.set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken as string;
  } catch {
    sessionStore.set(null);
    return null;
  }
}
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      refreshing ??= refresh().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.') {
  const err = e as AxiosError<{ error?: { message?: string; details?: Record<string, string[]> } }>;
  if (err?.code === 'ERR_NETWORK') return 'Can’t reach the server. Check your connection and try again.';
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please retry.';
  const d = err?.response?.data?.error;
  if (d?.details) {
    const first = Object.entries(d.details).find(([, v]) => v?.length);
    if (first) return `${first[0]}: ${first[1][0]}`;
  }
  return d?.message ?? fallback;
}

export async function downloadFile(path: string, filename: string) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
