import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, sessionStore, onSession, type SessionUser } from './api';
import { homeFor, type Permission } from './access';

interface AuthCtx {
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => sessionStore.get()?.user ?? null);
  useEffect(() => onSession((s) => setUser(s?.user ?? null)), []);

  // Refresh identity on load so role changes made by a super admin apply
  useEffect(() => {
    if (!sessionStore.get()) return;
    api.get('/auth/me').then(({ data }) => {
      const s = sessionStore.get();
      if (s) sessionStore.set({ ...s, user: data.user });
    }).catch(() => undefined);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      async login(email, password) {
        const { data } = await api.post('/auth/login', { identifier: email.trim(), password, portal: 'admin' });
        sessionStore.set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
        return data.user;
      },
      async logout() {
        const s = sessionStore.get();
        sessionStore.set(null);
        if (s) await api.post('/auth/logout', { refreshToken: s.refreshToken }).catch(() => undefined);
      },
      can: (p) => Boolean(user?.permissions.includes(p)),
    }),
    [user],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

/** Route guard: unauthenticated → /login; missing permission → the role's own home. */
export function RequireAuth({ perm, children }: { perm?: Permission; children: ReactNode }) {
  const { user, can } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (perm && !can(perm)) return <Navigate to={homeFor(user.roles)} replace state={{ denied: perm }} />;
  return <>{children}</>;
}
