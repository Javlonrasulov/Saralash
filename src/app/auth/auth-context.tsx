import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SessionUser } from './types';
import {
  authChangeCredentials,
  authLogin,
  authLogoutApi,
  authMe,
  hydrateTokensFromStorage,
  restoreApiSession,
  setApiTokens,
} from '../lib/api-client';
import type { DemoStoredUser } from '../lib/demo-users-store';
import {
  demoStoredToSession,
  getBuiltinDemoCredentials,
  isLoginTakenDemo,
  listDemoUsers,
  matchDemoUser,
  setBuiltinDemoCredentials,
  updateDemoUser,
} from '../lib/demo-users-store';

const STORAGE_KEY = 'saralash_session';

const ALL_ROUTES: SessionUser['allowedRoutes'] = [
  'dashboard',
  'warehouse',
  'sales',
  'customers',
  'suppliers',
  'expenses',
];

const DEMO_USER: SessionUser = {
  id: 'demo-admin',
  login: 'admin',
  fullName: 'Administrator',
  role: 'ADMIN',
  allowedRoutes: ALL_ROUTES,
  positions: [],
};

type StoredSession =
  | { mode: 'api'; user: SessionUser; accessToken: string; refreshToken: string }
  | { mode: 'demo'; user: SessionUser };

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  sessionMode: 'api' | 'demo' | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateOwnCredentials: (args: {
    currentPassword: string;
    newLogin?: string;
    newPassword?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeLegacyUser(p: Record<string, unknown>): SessionUser | null {
  if (typeof p.id !== 'string' || typeof p.login !== 'string') return null;
  const role = p.role as SessionUser['role'];
  if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'OPERATOR') return null;
  const routes = Array.isArray(p.allowedRoutes) ? p.allowedRoutes : [];
  const allowed = routes.filter((r): r is SessionUser['allowedRoutes'][number] =>
    (ALL_ROUTES as readonly string[]).includes(String(r)),
  );
  const positions = Array.isArray(p.positions)
    ? p.positions.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    id: p.id,
    login: p.login,
    fullName: typeof p.fullName === 'string' ? p.fullName : p.login,
    role,
    allowedRoutes:
      role === 'ADMIN'
        ? ALL_ROUTES
        : allowed.length > 0
          ? allowed
          : ['dashboard'],
    positions,
  };
}

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.mode === 'api' && p.user && p.accessToken && p.refreshToken) {
      const u = normalizeLegacyUser(p.user as Record<string, unknown>);
      if (!u) return null;
      return {
        mode: 'api',
        user: u,
        accessToken: String(p.accessToken),
        refreshToken: String(p.refreshToken),
      };
    }
    if (p.mode === 'demo' && p.user) {
      const u = normalizeLegacyUser(p.user as Record<string, unknown>);
      return u ? { mode: 'demo', user: u } : null;
    }
    const legacy = normalizeLegacyUser(p);
    if (legacy) return { mode: 'demo', user: legacy };
    return null;
  } catch {
    return null;
  }
}

function persist(s: StoredSession | null) {
  try {
    if (!s) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('Failed to fetch') || msg.includes('NetworkError');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionMode, setSessionMode] = useState<'api' | 'demo' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStored();
    if (!stored) {
      setLoading(false);
      return;
    }
    if (stored.mode === 'demo') {
      setUser(stored.user);
      setSessionMode('demo');
      setApiTokens(null, null);
      setLoading(false);
      return;
    }
    setUser(stored.user);
    setSessionMode('api');
    (async () => {
      const session = await restoreApiSession({
        user: stored.user,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
      });
      if (session) {
        setUser(session.user);
        persist({
          mode: 'api',
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        });
      } else {
        setUser(null);
        setSessionMode(null);
        setApiTokens(null, null);
        persist(null);
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const session = await authLogin(identifier, password);
      setUser(session.user);
      setSessionMode('api');
      persist({
        mode: 'api',
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
    } catch (e) {
      const matched = matchDemoUser(identifier, password);
      if (matched) {
        const sessionUser = demoStoredToSession(matched);
        setUser(sessionUser);
        setSessionMode('demo');
        setApiTokens(null, null);
        persist({ mode: 'demo', user: sessionUser });
        return;
      }
      const cred = getBuiltinDemoCredentials();
      const builtinOk =
        identifier.trim() === cred.login.trim() && password === cred.password;
      const serverDown =
        isNetworkError(e) || (e instanceof Error && e.message === 'AUTH_SERVER_ERROR');
      if (serverDown && builtinOk) {
        setUser({ ...DEMO_USER, login: cred.login });
        setSessionMode('demo');
        setApiTokens(null, null);
        persist({ mode: 'demo', user: { ...DEMO_USER, login: cred.login } });
        return;
      }
      throw e instanceof Error ? e : new Error('AUTH_INVALID');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    const stored = readStored();
    if (stored?.mode === 'api') {
      void authLogoutApi(stored.accessToken, stored.refreshToken);
    }
    setUser(null);
    setSessionMode(null);
    setApiTokens(null, null);
    persist(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = readStored();
    if (!stored) return;
    if (stored.mode === 'api') {
      try {
        const me = await authMe(stored.accessToken);
        setUser(me);
        persist({
          mode: 'api',
          user: me,
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
        });
      } catch {
        /* ignore */
      }
      return;
    }
    if (stored.user.id === DEMO_USER.id) {
      const c = getBuiltinDemoCredentials();
      setUser({ ...DEMO_USER, login: c.login });
      return;
    }
    const du = listDemoUsers().find((u) => u.id === stored.user.id);
    if (du) {
      const su = demoStoredToSession(du);
      setUser(su);
      persist({ mode: 'demo', user: su });
    }
  }, []);

  const updateOwnCredentials = useCallback(
    async (args: { currentPassword: string; newLogin?: string; newPassword?: string }) => {
      const u = user;
      if (!u) throw new Error('NO_USER');
      const nl = args.newLogin?.trim() ?? '';
      const np = args.newPassword?.trim() ?? '';
      if (!nl && !np) throw new Error('AUTH_NOTHING_TO_CHANGE');

      const stored = readStored();
      if (!stored) throw new Error('NO_SESSION');

      if (stored.mode === 'api') {
        const session = await authChangeCredentials({
          currentPassword: args.currentPassword,
          ...(nl ? { newLogin: nl } : {}),
          ...(np ? { newPassword: np } : {}),
        });
        setUser(session.user);
        persist({
          mode: 'api',
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        });
        return;
      }

      const verifyPwd = (): boolean => {
        if (u.id === DEMO_USER.id) {
          return args.currentPassword === getBuiltinDemoCredentials().password;
        }
        const row = listDemoUsers().find((x) => x.id === u.id);
        return row ? row.password === args.currentPassword : false;
      };
      if (!verifyPwd()) throw new Error('AUTH_WRONG_CURRENT');

      const nextLogin = nl ? nl.trim() : u.login;
      if (nl && isLoginTakenDemo(nl, u.id)) throw new Error('AUTH_LOGIN_TAKEN');

      if (u.id === DEMO_USER.id) {
        const c = getBuiltinDemoCredentials();
        setBuiltinDemoCredentials(nl ? nextLogin : c.login, np || c.password);
        const c2 = getBuiltinDemoCredentials();
        const nextUser: SessionUser = { ...DEMO_USER, login: c2.login };
        persist({ mode: 'demo', user: nextUser });
        setUser(nextUser);
        return;
      }

      const patch: Partial<Pick<DemoStoredUser, 'login' | 'password'>> = {};
      if (nl) patch.login = nextLogin;
      if (np) patch.password = np;
      const row = updateDemoUser(u.id, patch);
      if (!row) throw new Error('AUTH_UPDATE_FAILED');
      const su = demoStoredToSession(row);
      persist({ mode: 'demo', user: su });
      setUser(su);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loading,
      sessionMode,
      login,
      logout,
      refreshUser,
      updateOwnCredentials,
    }),
    [user, loading, sessionMode, login, logout, refreshUser, updateOwnCredentials],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
