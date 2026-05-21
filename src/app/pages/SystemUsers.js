import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/auth-context';
import { useApp } from '../i18n/app-context';
import { apiFetch } from '../lib/api-client';
import { addDemoUser, isLoginTakenDemo, listDemoUsers, removeDemoUser, updateDemoUser, } from '../lib/demo-users-store';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '../components/ui/alert-dialog';
const ROUTE_KEYS = [
    'dashboard',
    'warehouse',
    'sales',
    'customers',
    'suppliers',
    'expenses',
];
const EMPTY_FORM = {
    fullName: '',
    login: '',
    password: '',
    /** ADMIN ↔ OPERATOR — backendda saqlanadi; MANAGER bo‘lsa ham forma oddiy foydalanuvchi sifatida */
    fullAccess: false,
    allowedRoutes: ['dashboard'],
    positions: [],
};
function apiRole(fullAccess) {
    return fullAccess ? 'ADMIN' : 'OPERATOR';
}
function normalizePositionsList(arr) {
    const seen = new Set();
    const out = [];
    for (const raw of arr) {
        const s = raw.trim();
        if (!s)
            continue;
        const k = s.toLowerCase();
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push(s);
        if (out.length >= 20)
            break;
    }
    return out;
}
function demoUserToRow(d) {
    return {
        id: d.id,
        fullName: d.fullName,
        login: d.login,
        role: d.role,
        allowedRoutes: d.role === 'ADMIN' ? [...ROUTE_KEYS] : d.allowedRoutes,
        positions: d.positions ?? [],
        isActive: d.isActive,
        createdAt: d.createdAt,
    };
}
export function SystemUsers() {
    const { t } = useApp();
    const { user, sessionMode, refreshUser } = useAuth();
    const [list, setList] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showPwd, setShowPwd] = useState(true);
    const [positionDraft, setPositionDraft] = useState('');
    const canUseApi = sessionMode === 'api';
    const load = useCallback(async () => {
        setLoadError(false);
        if (!canUseApi) {
            setList(listDemoUsers().map(demoUserToRow));
            return;
        }
        try {
            const res = await apiFetch('/users');
            if (!res.ok)
                throw new Error();
            const data = (await res.json());
            setList(data.map((r) => ({ ...r, positions: r.positions ?? [] })));
        }
        catch {
            setLoadError(true);
            toast.error(t.usersLoadError);
        }
    }, [canUseApi, t.usersLoadError]);
    useEffect(() => {
        void load();
    }, [load]);
    const routeLabel = useMemo(() => ({
        dashboard: t.navDashboard,
        warehouse: t.navWarehouse,
        sales: t.navSales,
        customers: t.navCustomers,
        suppliers: t.navSuppliers,
        expenses: t.navExpenses,
    }), [t]);
    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowPwd(true);
        setPositionDraft('');
    };
    const addPositionLine = () => {
        const line = positionDraft.trim();
        if (!line)
            return;
        setForm((f) => {
            if (f.positions.length >= 20)
                return f;
            if (f.positions.some((x) => x.trim().toLowerCase() === line.toLowerCase()))
                return f;
            return { ...f, positions: [...f.positions, line] };
        });
        setPositionDraft('');
    };
    const removePositionLine = (index) => {
        setForm((f) => ({
            ...f,
            positions: f.positions.filter((_, j) => j !== index),
        }));
    };
    const toggleRoute = (key) => {
        setForm((f) => {
            const has = f.allowedRoutes.includes(key);
            const next = has ? f.allowedRoutes.filter((k) => k !== key) : [...f.allowedRoutes, key];
            return { ...f, allowedRoutes: next.length ? next : ['dashboard'] };
        });
    };
    const submit = async (e) => {
        e.preventDefault();
        if (!form.fullName.trim() || !form.login.trim()) {
            toast.error(t.required);
            return;
        }
        if (!editingId && !form.password.trim()) {
            toast.error(t.required);
            return;
        }
        setSaving(true);
        const editedId = editingId;
        const wasSelf = Boolean(editedId && user?.id === editedId);
        const positionsClean = normalizePositionsList(form.positions);
        try {
            if (!canUseApi) {
                const loginNorm = form.login.trim();
                if (!editedId) {
                    if (loginNorm.toLowerCase() === 'admin') {
                        toast.error(t.usersLoginAdminReserved);
                        return;
                    }
                    if (isLoginTakenDemo(loginNorm)) {
                        toast.error(t.usersLoginTaken);
                        return;
                    }
                    addDemoUser({
                        fullName: form.fullName.trim(),
                        login: loginNorm,
                        password: form.password,
                        role: apiRole(form.fullAccess),
                        allowedRoutes: form.fullAccess ? [...ROUTE_KEYS] : form.allowedRoutes,
                        positions: positionsClean,
                        isActive: true,
                    });
                    toast.success(t.add);
                }
                else {
                    const prevLogin = list.find((r) => r.id === editedId)?.login;
                    if (loginNorm !== prevLogin && isLoginTakenDemo(loginNorm, editedId)) {
                        toast.error(t.usersLoginTaken);
                        return;
                    }
                    if (loginNorm.toLowerCase() === 'admin' && prevLogin?.toLowerCase() !== 'admin') {
                        toast.error(t.usersLoginAdminReserved);
                        return;
                    }
                    updateDemoUser(editedId, {
                        fullName: form.fullName.trim(),
                        login: loginNorm,
                        password: form.password.trim() || undefined,
                        role: apiRole(form.fullAccess),
                        allowedRoutes: form.fullAccess ? [...ROUTE_KEYS] : form.allowedRoutes,
                        positions: positionsClean,
                    });
                    toast.success(t.save);
                }
                resetForm();
                await load();
                if (wasSelf)
                    await refreshUser();
                return;
            }
            if (editedId) {
                const prev = list.find((r) => r.id === editedId);
                const loginNorm = form.login.trim();
                const body = {
                    fullName: form.fullName.trim(),
                    role: apiRole(form.fullAccess),
                    allowedRoutes: form.fullAccess ? undefined : form.allowedRoutes,
                    positions: positionsClean,
                };
                if (loginNorm && loginNorm !== prev?.login)
                    body.login = loginNorm;
                if (form.password.trim())
                    body.password = form.password;
                const res = await apiFetch(`/users/${editedId}`, { method: 'PATCH', body: JSON.stringify(body) });
                if (!res.ok)
                    throw new Error();
                toast.success(t.save);
            }
            else {
                const res = await apiFetch('/users', {
                    method: 'POST',
                    body: JSON.stringify({
                        fullName: form.fullName.trim(),
                        login: form.login.trim(),
                        password: form.password,
                        role: apiRole(form.fullAccess),
                        allowedRoutes: form.fullAccess ? undefined : form.allowedRoutes,
                        positions: positionsClean,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    const msg = typeof err.message === 'string' ? err.message : t.usersSaveError;
                    throw new Error(msg);
                }
                toast.success(t.add);
            }
            resetForm();
            await load();
            if (wasSelf)
                await refreshUser();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : t.usersSaveError);
        }
        finally {
            setSaving(false);
        }
    };
    const startEdit = (row) => {
        setEditingId(row.id);
        setShowPwd(true);
        setPositionDraft('');
        setForm({
            fullName: row.fullName,
            login: row.login,
            password: '',
            fullAccess: row.role === 'ADMIN',
            allowedRoutes: row.role === 'ADMIN'
                ? [...ROUTE_KEYS]
                : row.allowedRoutes.filter((r) => ROUTE_KEYS.includes(r)).length > 0
                    ? row.allowedRoutes.filter((r) => ROUTE_KEYS.includes(r))
                    : ['dashboard'],
            positions: [...(row.positions ?? [])],
        });
    };
    const confirmDelete = async () => {
        if (!deleteTarget)
            return;
        if (!canUseApi) {
            if (deleteTarget.id === user?.id) {
                toast.error(t.usersDeleteSelf);
                return;
            }
            removeDemoUser(deleteTarget.id);
            toast.success(t.delete);
            setDeleteTarget(null);
            await load();
            return;
        }
        try {
            const res = await apiFetch(`/users/${deleteTarget.id}`, { method: 'DELETE' });
            if (!res.ok)
                throw new Error();
            toast.success(t.delete);
            setDeleteTarget(null);
            await load();
        }
        catch {
            toast.error(t.usersDeleteBlocked);
        }
    };
    return (_jsxs("div", { className: "grid gap-6 lg:grid-cols-2 lg:items-start", children: [!canUseApi && (_jsxs(Card, { className: "flex gap-3 border-sky-200 bg-sky-50/90 p-4 dark:border-sky-900/40 dark:bg-sky-950/25 lg:col-span-2", children: [_jsx(Info, { className: "mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" }), _jsx("p", { className: "text-sm leading-relaxed text-sky-900 dark:text-sky-100", children: t.usersDemoBanner })] })), _jsxs(Card, { className: "border-slate-200 p-5 dark:border-slate-700", children: [_jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-white", children: t.usersNewTitle }), _jsx("p", { className: "mt-1 text-xs text-slate-500 dark:text-slate-400", children: t.usersNewHint }), _jsxs("form", { onSubmit: submit, className: "mt-4 space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { children: t.usersFullName }), _jsx(Input, { value: form.fullName, onChange: (e) => setForm((f) => ({ ...f, fullName: e.target.value })), className: "mt-1.5", required: true })] }), _jsxs("div", { children: [_jsx(Label, { children: t.usersLogin }), _jsx(Input, { value: form.login, onChange: (e) => setForm((f) => ({ ...f, login: e.target.value })), className: "mt-1.5", required: true, autoComplete: "username" }), _jsx("p", { className: "mt-1 text-xs text-slate-500 dark:text-slate-400", children: t.usersLoginCyrillicHint })] }), _jsxs("div", { children: [_jsx(Label, { children: t.usersPassword }), _jsxs("div", { className: "relative mt-1.5", children: [_jsx(Input, { type: showPwd ? 'text' : 'password', value: form.password, onChange: (e) => setForm((f) => ({ ...f, password: e.target.value })), className: "pr-11", placeholder: editingId ? t.usersPasswordOptional : '', autoComplete: "new-password", required: !editingId }), _jsx("button", { type: "button", onClick: () => setShowPwd((v) => !v), "aria-label": showPwd ? t.authHidePassword : t.authShowPassword, className: "absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200", children: showPwd ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t.usersJobTitles }), _jsx("p", { className: "mt-1 text-[11px] text-slate-500 dark:text-slate-400", children: t.usersJobTitlesHint }), _jsxs("div", { className: "mt-2 space-y-2", children: [form.positions.map((line, i) => (_jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: line, onChange: (e) => {
                                                            const v = e.target.value;
                                                            setForm((f) => {
                                                                const next = [...f.positions];
                                                                next[i] = v;
                                                                return { ...f, positions: next };
                                                            });
                                                        }, className: "min-w-0 flex-1" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", className: "shrink-0 px-2", onClick: () => removePositionLine(i), "aria-label": t.delete, children: _jsx(Trash2, { size: 16 }) })] }, `${i}-${line}`))), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Input, { value: positionDraft, onChange: (e) => setPositionDraft(e.target.value), className: "min-w-0 flex-1 sm:max-w-xs", placeholder: t.usersJobTitles, onKeyDown: (e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                addPositionLine();
                                                            }
                                                        } }), _jsxs(Button, { type: "button", variant: "secondary", size: "sm", onClick: addPositionLine, children: [_jsx(Plus, { size: 16 }), t.add] })] })] })] }), _jsx("div", { className: "rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40", children: _jsxs("label", { className: "flex cursor-pointer items-start gap-3", children: [_jsx("input", { type: "checkbox", checked: form.fullAccess, onChange: (e) => {
                                                const v = e.target.checked;
                                                setForm((f) => ({
                                                    ...f,
                                                    fullAccess: v,
                                                    allowedRoutes: v ? [...ROUTE_KEYS] : f.allowedRoutes.length ? f.allowedRoutes : ['dashboard'],
                                                }));
                                            }, className: "mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30" }), _jsxs("span", { children: [_jsx("span", { className: "block text-sm font-medium text-slate-800 dark:text-slate-100", children: t.usersFullAccessTitle }), _jsx("span", { className: "mt-1 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400", children: t.usersFullAccessHint })] })] }) }), _jsxs("div", { children: [_jsx(Label, { children: t.usersRoutes }), _jsx("div", { className: "mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700", children: ROUTE_KEYS.map((key) => (_jsxs("label", { className: "flex cursor-pointer items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: form.fullAccess || form.allowedRoutes.includes(key), disabled: form.fullAccess, onChange: () => toggleRoute(key), className: "h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30" }), _jsx("span", { className: "text-slate-700 dark:text-slate-200", children: routeLabel[key] })] }, key))) }), form.fullAccess && (_jsx("p", { className: "mt-1 text-[11px] text-slate-500", children: t.usersRoutesAdminNote }))] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "submit", disabled: saving, children: editingId ? t.save : t.add }), editingId && (_jsx(Button, { type: "button", variant: "outline", onClick: resetForm, children: t.cancel }))] })] })] }), _jsxs("div", { children: [_jsx("h2", { className: "mb-3 text-lg font-semibold text-slate-800 dark:text-white", children: t.usersListTitle }), loadError ? (_jsx("p", { className: "text-sm text-red-600 dark:text-red-400", children: t.usersLoadError })) : (_jsxs("ul", { className: "space-y-3", children: [list.map((row) => (_jsxs(Card, { className: "flex flex-col gap-3 border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: row.fullName }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: [row.login, !row.isActive && (_jsx("span", { className: "ml-2 rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] dark:bg-slate-700", children: t.usersInactive }))] }), row.positions?.length ? (_jsx("p", { className: "mt-1 text-sm font-medium text-slate-800 dark:text-slate-100", children: row.positions.join(' · ') })) : (_jsx("p", { className: "mt-1 text-xs italic text-slate-400 dark:text-slate-500", children: t.usersPositionsEmpty })), _jsx("p", { className: "mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400", children: row.role === 'ADMIN'
                                                    ? t.usersRoutesAll
                                                    : row.allowedRoutes
                                                        .filter((r) => ROUTE_KEYS.includes(r))
                                                        .map((r) => routeLabel[r])
                                                        .join(' · ') || '—' })] }), _jsxs("div", { className: "flex shrink-0 gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => startEdit(row), children: [_jsx(Pencil, { size: 14 }), t.edit] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40", onClick: () => setDeleteTarget(row), children: [_jsx(Trash2, { size: 14 }), t.delete] })] })] }, row.id))), list.length === 0 && !loadError && (_jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400", children: t.noData }))] }))] }), _jsx(AlertDialog, { open: Boolean(deleteTarget), onOpenChange: (o) => !o && setDeleteTarget(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.delete }), _jsx(AlertDialogDescription, { children: t.usersDeleteConfirm })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: () => void confirmDelete(), className: "bg-red-600 text-white hover:bg-red-700", children: t.delete })] })] }) })] }));
}
