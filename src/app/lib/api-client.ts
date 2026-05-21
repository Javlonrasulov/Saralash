import type { SessionUser } from '../auth/types';

/** Masalan `/auth/login` → devda `/api/auth/login`, yoki `VITE_API_BASE_URL` ostida birlashtiriladi */
export function apiUrl(suffix: string): string {
  const s = suffix.startsWith('/') ? suffix : `/${suffix}`;
  const env = import.meta.env.VITE_API_BASE_URL?.trim();
  if (env) return `${env.replace(/\/$/, '')}${s}`;
  return `/api${s}`;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setApiTokens(at: string | null, rt: string | null) {
  accessToken = at;
  refreshToken = rt;
}

function mapUser(raw: Record<string, unknown>): SessionUser {
  const routes = Array.isArray(raw.allowedRoutes) ? raw.allowedRoutes : [];
  const allowed = routes.filter((r): r is SessionUser['allowedRoutes'][number] =>
    ['dashboard', 'sorting', 'warehouse', 'sales', 'customers', 'suppliers', 'expenses'].includes(
      String(r),
    ),
  );
  const positions = Array.isArray(raw.positions)
    ? raw.positions.filter((s): s is string => typeof s === 'string').slice(0, 20)
    : [];
  return {
    id: String(raw.id),
    login: String(raw.login),
    fullName: String(raw.fullName),
    role: raw.role as SessionUser['role'],
    allowedRoutes: allowed,
    positions,
  };
}

export interface PersistedApiSession {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

export async function authLogin(identifier: string, password: string): Promise<PersistedApiSession> {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    if (res.status >= 500) throw new Error('AUTH_SERVER_ERROR');
    throw new Error('AUTH_INVALID');
  }
  const data = (await res.json()) as {
    user: Record<string, unknown>;
    accessToken: string;
    refreshToken: string;
  };
  const session: PersistedApiSession = {
    user: mapUser(data.user),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
  setApiTokens(session.accessToken, session.refreshToken);
  return session;
}

/** Saqlangan sessiyani tiklash: access token yaroqsiz bo‘lsa refresh orqali yangilaydi. */
export async function restoreApiSession(stored: PersistedApiSession): Promise<PersistedApiSession | null> {
  hydrateTokensFromStorage(stored);
  try {
    const me = await authMe(stored.accessToken);
    return { user: me, accessToken: stored.accessToken, refreshToken: stored.refreshToken };
  } catch {
    try {
      return await authRefresh(stored.refreshToken);
    } catch {
      return null;
    }
  }
}

export async function authRefresh(rt: string): Promise<PersistedApiSession> {
  const res = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) throw new Error('AUTH_INVALID');
  const data = (await res.json()) as {
    user: Record<string, unknown>;
    accessToken: string;
    refreshToken: string;
  };
  const session: PersistedApiSession = {
    user: mapUser(data.user),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
  setApiTokens(session.accessToken, session.refreshToken);
  return session;
}

export async function authMe(at: string): Promise<SessionUser> {
  const res = await fetch(apiUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${at}` },
  });
  if (!res.ok) throw new Error('AUTH_INVALID');
  const data = (await res.json()) as Record<string, unknown>;
  return mapUser(data);
}

export async function authLogoutApi(at: string, rt: string): Promise<void> {
  try {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${at}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: rt }),
    });
  } catch {
    /* ignore */
  }
}

export async function authChangeCredentials(body: {
  currentPassword: string;
  newLogin?: string;
  newPassword?: string;
}): Promise<PersistedApiSession> {
  const res = await apiFetch('/auth/change-credentials', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.status === 403) throw new Error('AUTH_WRONG_CURRENT');
  if (res.status === 409) throw new Error('AUTH_LOGIN_TAKEN');
  if (res.status === 400) throw new Error('AUTH_NOTHING_TO_CHANGE');
  if (!res.ok) throw new Error('AUTH_UPDATE_FAILED');
  const data = (await res.json()) as {
    user: Record<string, unknown>;
    accessToken: string;
    refreshToken: string;
  };
  const session: PersistedApiSession = {
    user: mapUser(data.user),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
  setApiTokens(session.accessToken, session.refreshToken);
  return session;
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const s = await authRefresh(refreshToken);
    accessToken = s.accessToken;
    refreshToken = s.refreshToken;
    persistApiSessionPartial(s);
    return true;
  } catch {
    return false;
  }
}

const STORAGE_KEY = 'saralash_session';

function persistApiSessionPartial(s: PersistedApiSession) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as { mode?: string }) : {};
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...prev,
        mode: 'api',
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    );
  } catch {
    /* ignore */
  }
}

/** JSON parse qilingan sessiyadan tokenlarni modulga yuklash */
export function hydrateTokensFromStorage(parsed: PersistedApiSession) {
  setApiTokens(parsed.accessToken, parsed.refreshToken);
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path.startsWith('/') ? path : `/${path}`);
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && refreshToken) {
    const ok = await tryRefresh();
    if (ok) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      res = await fetch(url, { ...init, headers });
    }
  }

  return res;
}

export type SystemUserRow = {
  id: string;
  fullName: string;
  login: string;
  role: SessionUser['role'];
  allowedRoutes: string[];
  positions: string[];
  isActive: boolean;
  createdAt: string;
};
