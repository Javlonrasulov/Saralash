const KEY = 'saralash_demo_user_accounts';
function readRaw() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return [];
        const p = JSON.parse(raw);
        const arr = Array.isArray(p.users) ? p.users : [];
        return arr.map((u) => ({
            ...u,
            positions: Array.isArray(u.positions) ? u.positions : [],
        }));
    }
    catch {
        return [];
    }
}
function write(users) {
    localStorage.setItem(KEY, JSON.stringify({ users }));
}
export function listDemoUsers() {
    return readRaw();
}
export function matchDemoUser(identifier, password) {
    const id = identifier.trim();
    return (readRaw().find((u) => u.login.trim() === id && u.password === password && u.isActive) ?? null);
}
export function demoStoredToSession(u) {
    return {
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        role: u.role,
        allowedRoutes: u.role === 'ADMIN'
            ? ['dashboard', 'warehouse', 'sales', 'customers', 'suppliers', 'streetObjects', 'expenses']
            : u.allowedRoutes.length > 0
                ? u.allowedRoutes
                : ['dashboard'],
        positions: Array.isArray(u.positions) ? u.positions : [],
    };
}
export function addDemoUser(row) {
    const users = readRaw();
    const created = {
        ...row,
        fullName: row.fullName.trim(),
        login: row.login.trim(),
        positions: row.positions ?? [],
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    write([created, ...users]);
    return created;
}
export function updateDemoUser(id, patch) {
    const users = readRaw();
    const i = users.findIndex((u) => u.id === id);
    if (i < 0)
        return null;
    const cur = users[i];
    const next = { ...cur };
    if (patch.fullName !== undefined)
        next.fullName = patch.fullName.trim();
    if (patch.login !== undefined)
        next.login = patch.login.trim();
    if (patch.password !== undefined && patch.password !== '')
        next.password = patch.password;
    if (patch.role !== undefined)
        next.role = patch.role;
    if (patch.allowedRoutes !== undefined)
        next.allowedRoutes = patch.allowedRoutes;
    if (patch.positions !== undefined)
        next.positions = patch.positions;
    if (patch.isActive !== undefined)
        next.isActive = patch.isActive;
    const arr = [...users];
    arr[i] = next;
    write(arr);
    return next;
}
export function removeDemoUser(id) {
    const users = readRaw();
    const next = users.filter((u) => u.id !== id);
    if (next.length === users.length)
        return false;
    write(next);
    return true;
}
export function isLoginTakenDemo(login, exceptId) {
    const id = login.trim();
    return readRaw().some((u) => u.id !== exceptId && u.login.trim() === id);
}
/** Tarmoqdan keyin ishlatiladigan tizim demo-kirishi (localStorage). */
const BUILTIN_DEMO_AUTH_KEY = 'saralash_builtin_demo_auth';
export function getBuiltinDemoCredentials() {
    try {
        const raw = localStorage.getItem(BUILTIN_DEMO_AUTH_KEY);
        if (!raw)
            return { login: 'admin', password: 'admin123' };
        const p = JSON.parse(raw);
        const login = typeof p.login === 'string' && p.login.trim().length >= 2 ? p.login.trim() : 'admin';
        const password = typeof p.password === 'string' && p.password.length >= 4 ? p.password : 'admin123';
        return { login, password };
    }
    catch {
        return { login: 'admin', password: 'admin123' };
    }
}
export function setBuiltinDemoCredentials(login, password) {
    localStorage.setItem(BUILTIN_DEMO_AUTH_KEY, JSON.stringify({ login: login.trim(), password }));
}
