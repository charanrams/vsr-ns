import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onShopSession, shopApi, shopSession, type ShopSession, type ShopUser } from './api';
import { sessionStore, type SessionUser } from '../lib/api';

/** Where a successful sign-in belongs: the storefront, or the admin portal (staff). */
export type SignedIn = { area: 'shop' } | { area: 'admin'; roles: string[]; from?: string };
const isStaffRoles = (roles: string[]) => roles.some((r) => r !== 'customer' && r !== 'delivery_partner');

/** Customer identity for the storefront. Staff accounts are refused by the server (portal: customer). */
interface ShopAuth {
  user: ShopUser | null;
  loginPassword: (identifier: string, password: string, remember: boolean) => Promise<SignedIn>;
  sendOtp: (identifier: string, purpose: 'login' | 'verify' | 'reset') => Promise<string | undefined>;
  verifyOtp: (identifier: string, code: string, purpose: 'login' | 'verify') => Promise<SignedIn>;
  signUp: (b: { name: string; email: string; phone: string; password: string }) => Promise<string | undefined>;
  resetPassword: (identifier: string, code: string, password: string) => Promise<void>;
  updateUser: (u: ShopUser) => void;
  logout: () => Promise<void>;
}
const Ctx = createContext<ShopAuth | null>(null);

/**
 * One login page for every account. The server checks the password/code first (no portal hint), then we
 * route by role: staff → admin session (/admin), customers → storefront session. Wrong-type accounts are
 * never told apart before the credentials are proven, so nothing leaks to someone guessing.
 */
function accept(data: { user: ShopUser & { permissions?: string[] }; accessToken: string; refreshToken: string }, remember = true): SignedIn {
  if (isStaffRoles(data.user.roles)) {
    sessionStore.set({ user: data.user as unknown as SessionUser, accessToken: data.accessToken, refreshToken: data.refreshToken });
    return { area: 'admin', roles: data.user.roles };
  }
  if (!data.user.roles.includes('customer')) {
    // e.g. delivery partners: no web portal yet. Revoke the just-issued session.
    shopApi.post('/auth/logout', { refreshToken: data.refreshToken }).catch(() => undefined);
    throw new Error('This account can’t sign in on the website. Please use the VSR app for your role.');
  }
  shopSession.set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken } satisfies ShopSession, remember);
  return { area: 'shop' };
}

export function ShopAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ShopUser | null>(() => shopSession.get()?.user ?? null);
  useEffect(() => onShopSession((s) => setUser(s?.user ?? null)), []);

  // Re-read identity on load (name/phone edits on another device, or a revoked session)
  useEffect(() => {
    if (!shopSession.get()) return;
    shopApi
      .get('/auth/me')
      .then(({ data }) => {
        const s = shopSession.get();
        if (!s) return;
        if (!data.user?.roles?.includes('customer')) return shopSession.set(null);
        shopSession.set({ ...s, user: data.user });
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<ShopAuth>(
    () => ({
      user,
      async loginPassword(identifier, password, remember) {
        const { data } = await shopApi.post('/auth/login', { identifier: identifier.trim(), password });
        return accept(data, remember);
      },
      async sendOtp(identifier, purpose) {
        const { data } = await shopApi.post('/auth/otp/send', { identifier: identifier.trim(), purpose });
        return data.devOtp as string | undefined;
      },
      async verifyOtp(identifier, code, purpose) {
        const { data } = await shopApi.post('/auth/otp/verify', { identifier: identifier.trim(), code, purpose });
        return accept(data);
      },
      async signUp(b) {
        const { data } = await shopApi.post('/auth/signup', { name: b.name.trim(), email: b.email.trim(), phone: b.phone.trim(), password: b.password, acceptTerms: true });
        return data.devOtp as string | undefined;
      },
      async resetPassword(identifier, code, password) {
        await shopApi.post('/auth/password/reset', { identifier: identifier.trim(), code, password });
      },
      updateUser(u) {
        const s = shopSession.get();
        if (s) shopSession.set({ ...s, user: u });
      },
      async logout() {
        const s = shopSession.get();
        shopSession.set(null);
        if (s) await shopApi.post('/auth/logout', { refreshToken: s.refreshToken }).catch(() => undefined);
      },
    }),
    [user],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShopAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useShopAuth outside ShopAuthProvider');
  return c;
}

/** Account-only pages: guests go to login and come back afterwards. */
export function RequireCustomer({ children }: { children: ReactNode }) {
  const { user } = useShopAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}
