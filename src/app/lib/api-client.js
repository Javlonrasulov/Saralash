/** Masalan `/auth/login` → devda `/api/auth/login`, yoki `VITE_API_BASE_URL` ostida birlashtiriladi */
export function apiUrl(suffix) {
    const s = suffix.startsWith('/') ? suffix : `/${suffix}`;
    const env = import.meta.env.VITE_API_BASE_URL?.trim();
    if (env)
        return `${env.replace(/\/$/, '')}${s}`;
    return `/api${s}`;
}
let accessToken = null;
let refreshToken = null;
export function setApiTokens(at, rt) {
    accessToken = at;
    refreshToken = rt;
}
function mapUser(raw) {
    const routes = Array.isArray(raw.allowedRoutes) ? raw.allowedRoutes : [];
    const allowed = routes.filter((r) => ['dashboard', 'sorting', 'warehouse', 'sales', 'customers', 'suppliers', 'expenses'].includes(String(r)));
    const positions = Array.isArray(raw.positions)
        ? raw.positions.filter((s) => typeof s === 'string').slice(0, 20)
        : [];
    return {
        id: String(raw.id),
        login: String(raw.login),
        fullName: String(raw.fullName),
        role: raw.role,
        allowedRoutes: allowed,
        positions,
    };
}
export async function authLogin(identifier, password) {
    const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
        if (res.status >= 500)
            throw new Error('AUTH_SERVER_ERROR');
        throw new Error('AUTH_INVALID');
    }
    const data = (await res.json());
    const session = {
        user: mapUser(data.user),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
    };
    setApiTokens(session.accessToken, session.refreshToken);
    return session;
}
export async function authRefresh(rt) {
    const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok)
        throw new Error('AUTH_INVALID');
    const data = (await res.json());
    const session = {
        user: mapUser(data.user),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
    };
    setApiTokens(session.accessToken, session.refreshToken);
    return session;
}
export async function authMe(at) {
    const res = await fetch(apiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${at}` },
    });
    if (!res.ok)
        throw new Error('AUTH_INVALID');
    const data = (await res.json());
    return mapUser(data);
}
export async function authLogoutApi(at, rt) {
    try {
        await fetch(apiUrl('/auth/logout'), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${at}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: rt }),
        });
    }
    catch {
        /* ignore */
    }
}
export async function authChangeCredentials(body) {
    const res = await apiFetch('/auth/change-credentials', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (res.status === 403)
        throw new Error('AUTH_WRONG_CURRENT');
    if (res.status === 409)
        throw new Error('AUTH_LOGIN_TAKEN');
    if (res.status === 400)
        throw new Error('AUTH_NOTHING_TO_CHANGE');
    if (!res.ok)
        throw new Error('AUTH_UPDATE_FAILED');
    const data = (await res.json());
    const session = {
        user: mapUser(data.user),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
    };
    setApiTokens(session.accessToken, session.refreshToken);
    return session;
}
async function tryRefresh() {
    if (!refreshToken)
        return false;
    try {
        const s = await authRefresh(refreshToken);
        accessToken = s.accessToken;
        refreshToken = s.refreshToken;
        persistApiSessionPartial(s);
        return true;
    }
    catch {
        return false;
    }
}
const STORAGE_KEY = 'saralash_session';
function persistApiSessionPartial(s) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const prev = raw ? JSON.parse(raw) : {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...prev,
            mode: 'api',
            user: s.user,
            accessToken: s.accessToken,
            refreshToken: s.refreshToken,
        }));
    }
    catch {
        /* ignore */
    }
}
/** JSON parse qilingan sessiyadan tokenlarni modulga yuklash */
export function hydrateTokensFromStorage(parsed) {
    setApiTokens(parsed.accessToken, parsed.refreshToken);
}
export async function apiFetch(path, init = {}) {
    const url = apiUrl(path.startsWith('/') ? path : `/${path}`);
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    if (accessToken)
        headers.set('Authorization', `Bearer ${accessToken}`);
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
