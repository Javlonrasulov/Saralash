import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/auth-context';
import type { AppRouteKey } from '../auth/types';
import { useApp } from '../i18n/app-context';
import { apiFetch, type SystemUserRow } from '../lib/api-client';
import {
  addDemoUser,
  isLoginTakenDemo,
  listDemoUsers,
  removeDemoUser,
  updateDemoUser,
  type DemoStoredUser,
} from '../lib/demo-users-store';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

const ROUTE_KEYS: AppRouteKey[] = [
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
  allowedRoutes: ['dashboard'] as AppRouteKey[],
  positions: [] as string[],
};

function apiRole(fullAccess: boolean): SystemUserRow['role'] {
  return fullAccess ? 'ADMIN' : 'OPERATOR';
}

function normalizePositionsList(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}

function demoUserToRow(d: DemoStoredUser): SystemUserRow {
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
  const [list, setList] = useState<SystemUserRow[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemUserRow | null>(null);
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
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SystemUserRow[];
      setList(data.map((r) => ({ ...r, positions: r.positions ?? [] })));
    } catch {
      setLoadError(true);
      toast.error(t.usersLoadError);
    }
  }, [canUseApi, t.usersLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const routeLabel = useMemo(
    () =>
      ({
        dashboard: t.navDashboard,
        warehouse: t.navWarehouse,
        sales: t.navSales,
        customers: t.navCustomers,
        suppliers: t.navSuppliers,
        expenses: t.navExpenses,
      }) satisfies Record<AppRouteKey, string>,
    [t],
  );

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowPwd(true);
    setPositionDraft('');
  };

  const addPositionLine = () => {
    const line = positionDraft.trim();
    if (!line) return;
    setForm((f) => {
      if (f.positions.length >= 20) return f;
      if (f.positions.some((x) => x.trim().toLowerCase() === line.toLowerCase())) return f;
      return { ...f, positions: [...f.positions, line] };
    });
    setPositionDraft('');
  };

  const removePositionLine = (index: number) => {
    setForm((f) => ({
      ...f,
      positions: f.positions.filter((_, j) => j !== index),
    }));
  };

  const toggleRoute = (key: AppRouteKey) => {
    setForm((f) => {
      const has = f.allowedRoutes.includes(key);
      const next = has ? f.allowedRoutes.filter((k) => k !== key) : [...f.allowedRoutes, key];
      return { ...f, allowedRoutes: next.length ? next : ['dashboard'] };
    });
  };

  const submit = async (e: React.FormEvent) => {
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
        const loginLc = form.login.trim().toLowerCase();
        if (!editedId) {
          if (loginLc === 'admin') {
            toast.error(t.usersLoginAdminReserved);
            return;
          }
          if (isLoginTakenDemo(loginLc)) {
            toast.error(t.usersLoginTaken);
            return;
          }
          addDemoUser({
            fullName: form.fullName.trim(),
            login: loginLc,
            password: form.password,
            role: apiRole(form.fullAccess),
            allowedRoutes: form.fullAccess ? [...ROUTE_KEYS] : form.allowedRoutes,
            positions: positionsClean,
            isActive: true,
          });
          toast.success(t.add);
        } else {
          if (loginLc !== list.find((r) => r.id === editedId)?.login && isLoginTakenDemo(loginLc, editedId)) {
            toast.error(t.usersLoginTaken);
            return;
          }
          if (loginLc === 'admin' && list.find((r) => r.id === editedId)?.login !== 'admin') {
            toast.error(t.usersLoginAdminReserved);
            return;
          }
          updateDemoUser(editedId, {
            fullName: form.fullName.trim(),
            login: loginLc,
            password: form.password.trim() || undefined,
            role: apiRole(form.fullAccess),
            allowedRoutes: form.fullAccess ? [...ROUTE_KEYS] : form.allowedRoutes,
            positions: positionsClean,
          });
          toast.success(t.save);
        }
        resetForm();
        await load();
        if (wasSelf) await refreshUser();
        return;
      }

      if (editedId) {
        const body: Record<string, unknown> = {
          fullName: form.fullName.trim(),
          role: apiRole(form.fullAccess),
          allowedRoutes: form.fullAccess ? undefined : form.allowedRoutes,
          positions: positionsClean,
        };
        if (form.password.trim()) body.password = form.password;
        const res = await apiFetch(`/users/${editedId}`, { method: 'PATCH', body: JSON.stringify(body) });
        if (!res.ok) throw new Error();
        toast.success(t.save);
      } else {
        const res = await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            login: form.login.trim().toLowerCase(),
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
      if (wasSelf) await refreshUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.usersSaveError);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: SystemUserRow) => {
    setEditingId(row.id);
    setShowPwd(true);
    setPositionDraft('');
    setForm({
      fullName: row.fullName,
      login: row.login,
      password: '',
      fullAccess: row.role === 'ADMIN',
      allowedRoutes:
        row.role === 'ADMIN'
          ? [...ROUTE_KEYS]
          : (row.allowedRoutes.filter((r) =>
              ROUTE_KEYS.includes(r as AppRouteKey),
            ) as AppRouteKey[]).length > 0
            ? (row.allowedRoutes.filter((r) =>
                ROUTE_KEYS.includes(r as AppRouteKey),
              ) as AppRouteKey[])
            : ['dashboard'],
      positions: [...(row.positions ?? [])],
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
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
      if (!res.ok) throw new Error();
      toast.success(t.delete);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error(t.usersDeleteBlocked);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {!canUseApi && (
        <Card className="flex gap-3 border-sky-200 bg-sky-50/90 p-4 dark:border-sky-900/40 dark:bg-sky-950/25 lg:col-span-2">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <p className="text-sm leading-relaxed text-sky-900 dark:text-sky-100">{t.usersDemoBanner}</p>
        </Card>
      )}
      <Card className="border-slate-200 p-5 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{t.usersNewTitle}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.usersNewHint}</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <Label>{t.usersFullName}</Label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label>{t.usersLogin}</Label>
            <Input
              value={form.login}
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              className="mt-1.5"
              disabled={Boolean(editingId)}
              required
            />
          </div>
          <div>
            <Label>{t.usersPassword}</Label>
            <div className="relative mt-1.5">
              <Input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="pr-11"
                placeholder={editingId ? t.usersPasswordOptional : ''}
                autoComplete="new-password"
                required={!editingId}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? t.authHidePassword : t.authShowPassword}
                className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <Label>{t.usersJobTitles}</Label>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t.usersJobTitlesHint}</p>
            <div className="mt-2 space-y-2">
              {form.positions.map((line, i) => (
                <div key={`${i}-${line}`} className="flex gap-2">
                  <Input
                    value={line}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.positions];
                        next[i] = v;
                        return { ...f, positions: next };
                      });
                    }}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-2"
                    onClick={() => removePositionLine(i)}
                    aria-label={t.delete}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Input
                  value={positionDraft}
                  onChange={(e) => setPositionDraft(e.target.value)}
                  className="min-w-0 flex-1 sm:max-w-xs"
                  placeholder={t.usersJobTitles}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPositionLine();
                    }
                  }}
                />
                <Button type="button" variant="secondary" size="sm" onClick={addPositionLine}>
                  <Plus size={16} />
                  {t.add}
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.fullAccess}
                onChange={(e) => {
                  const v = e.target.checked;
                  setForm((f) => ({
                    ...f,
                    fullAccess: v,
                    allowedRoutes: v ? [...ROUTE_KEYS] : f.allowedRoutes.length ? f.allowedRoutes : ['dashboard'],
                  }));
                }}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  {t.usersFullAccessTitle}
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {t.usersFullAccessHint}
                </span>
              </span>
            </label>
          </div>
          <div>
            <Label>{t.usersRoutes}</Label>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              {ROUTE_KEYS.map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.fullAccess || form.allowedRoutes.includes(key)}
                    disabled={form.fullAccess}
                    onChange={() => toggleRoute(key)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                  />
                  <span className="text-slate-700 dark:text-slate-200">{routeLabel[key]}</span>
                </label>
              ))}
            </div>
            {form.fullAccess && (
              <p className="mt-1 text-[11px] text-slate-500">{t.usersRoutesAdminNote}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {editingId ? t.save : t.add}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                {t.cancel}
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">{t.usersListTitle}</h2>
        {loadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{t.usersLoadError}</p>
        ) : (
          <ul className="space-y-3">
            {list.map((row) => (
              <Card
                key={row.id}
                className="flex flex-col gap-3 border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{row.fullName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {row.login}
                    {!row.isActive && (
                      <span className="ml-2 rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] dark:bg-slate-700">
                        {t.usersInactive}
                      </span>
                    )}
                  </p>
                  {row.positions?.length ? (
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {row.positions.join(' · ')}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">{t.usersPositionsEmpty}</p>
                  )}
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {row.role === 'ADMIN'
                      ? t.usersRoutesAll
                      : row.allowedRoutes
                          .filter((r) => ROUTE_KEYS.includes(r as AppRouteKey))
                          .map((r) => routeLabel[r as AppRouteKey])
                          .join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit(row)}>
                    <Pencil size={14} />
                    {t.edit}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 size={14} />
                    {t.delete}
                  </Button>
                </div>
              </Card>
            ))}
            {list.length === 0 && !loadError && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.noData}</p>
            )}
          </ul>
        )}
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
            <AlertDialogDescription>{t.usersDeleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
