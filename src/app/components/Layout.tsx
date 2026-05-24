import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Recycle,
  Boxes,
  Users,
  UserCog,
  Receipt,
  Truck,
  MapPin,
  Wallet,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Globe,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  EyeOff,
  BarChart3,
  User as UserIcon,
  Minus,
  Plus,
  Type,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useApp } from '../i18n/app-context';
import { useFontScale } from '../context/font-scale-context';
import { useAuth } from '../auth/auth-context';
import { hasPageAccess, type AppRouteKey } from '../auth/types';
import type { Language } from '../i18n/translations';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NavbarDateRangePicker } from './NavbarDateRangePicker';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { formatYmdDisplay } from '../lib/nav-date-range';

const LANG_OPTIONS: { value: Language; short: string; label: string; flag: string }[] = [
  { value: 'uz_latin', short: 'LT', label: "O'zbek (Lotin)", flag: '🇺🇿' },
  { value: 'uz_cyrillic', short: 'КИ', label: 'Ўзбек (Кирил)', flag: '🇺🇿' },
  { value: 'ru', short: 'RU', label: 'Русский', flag: '🇷🇺' },
];

function FontScaleControls() {
  const { t } = useApp();
  const { decrease, increase, canDecrease, canIncrease, fontScale } = useFontScale();

  return (
    <div
      className="flex h-9 shrink-0 items-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      role="group"
      aria-label={t.fontSizeLarger}
    >
      <button
        type="button"
        onClick={decrease}
        disabled={!canDecrease}
        title={t.fontSizeSmaller}
        className="rounded-l-xl px-1.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 min-[420px]:px-2 dark:hover:bg-slate-700"
      >
        <Minus size={14} />
      </button>
      <span className="hidden items-center gap-1 border-x border-slate-200 px-1.5 text-[11px] font-semibold text-slate-500 min-[420px]:flex dark:border-slate-700 dark:text-slate-400">
        <Type size={12} className="text-slate-400" />
        {fontScale === 'sm' ? 'A-' : fontScale === 'lg' ? 'A+' : fontScale === 'xl' ? 'A++' : 'A'}
      </span>
      <button
        type="button"
        onClick={increase}
        disabled={!canIncrease}
        title={t.fontSizeLarger}
        className="rounded-r-xl px-1.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 min-[420px]:px-2 dark:hover:bg-slate-700"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function LanguageDropdown() {
  const { lang, setLang } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LANG_OPTIONS.find((o) => o.value === lang) ?? LANG_OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 min-[420px]:w-auto min-[420px]:px-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
      >
        <Globe size={14} className="shrink-0 text-slate-400" />
        <span className="hidden min-[420px]:inline">{current.short}</span>
        <ChevronDown
          size={12}
          className={`hidden shrink-0 text-slate-400 transition-transform min-[420px]:block ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="fixed right-3 left-3 top-[4.5rem] z-[80] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-2xl shadow-slate-300/40 min-[420px]:absolute min-[420px]:left-auto min-[420px]:right-0 min-[420px]:top-full min-[420px]:mt-2 min-[420px]:w-52 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/40">
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setLang(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                lang === opt.value
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span className="text-base">{opt.flag}</span>
              <div className="flex-1 text-left">
                <p className="font-medium leading-tight">{opt.label}</p>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{opt.short}</p>
              </div>
              {lang === opt.value && <Check size={14} className="shrink-0 text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileCredentialsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useApp();
  const { user, updateOwnCredentials } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPassword2, setShowNewPassword2] = useState(false);

  useEffect(() => {
    if (open && user) {
      setNewLogin(user.login);
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowNewPassword2(false);
    }
  }, [open, user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const nl = newLogin.trim();
    const np = newPassword.trim();
    const np2 = newPassword2.trim();
    if (nl === user.login && !np) {
      toast.error(t.authNothingToChange);
      return;
    }
    if (!nl && !np) {
      toast.error(t.authNothingToChange);
      return;
    }
    if (np && np !== np2) {
      toast.error(t.authPasswordMismatch);
      return;
    }
    if (currentPassword.trim().length < 4) {
      toast.error(t.required);
      return;
    }
    setSaving(true);
    try {
      await updateOwnCredentials({
        currentPassword,
        ...(nl !== user.login ? { newLogin: nl } : {}),
        ...(np ? { newPassword: np } : {}),
      });
      toast.success(t.authCredentialsSaved);
      onOpenChange(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const msg =
        code === 'AUTH_WRONG_CURRENT'
          ? t.authWrongCurrentPassword
          : code === 'AUTH_LOGIN_TAKEN'
            ? t.authLoginTaken
            : code === 'AUTH_NOTHING_TO_CHANGE'
              ? t.authNothingToChange
              : t.usersSaveError;
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{t.authProfileTitle}</DialogTitle>
            <DialogDescription>{t.authProfileDesc}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-current-pw">{t.authCurrentPassword}</Label>
              <div className="relative">
                <Input
                  id="profile-current-pw"
                  type={showCurrentPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-10 rounded-xl pr-10"
                  required
                  minLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  aria-label={showCurrentPassword ? t.authHidePassword : t.authShowPassword}
                  className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-new-login">{t.authNewLoginOptional}</Label>
              <Input
                id="profile-new-login"
                type="text"
                autoComplete="username"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value)}
                className="h-10 rounded-xl"
                minLength={2}
                maxLength={64}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.authLoginCyrillicHint}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-new-pw">{t.authNewPasswordOptional}</Label>
              <div className="relative">
                <Input
                  id="profile-new-pw"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 rounded-xl pr-10"
                  minLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? t.authHidePassword : t.authShowPassword}
                  className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {newPassword.trim().length > 0 && (
              <div className="grid gap-1.5">
                <Label htmlFor="profile-new-pw2">{t.authNewPasswordRepeat}</Label>
                <div className="relative">
                  <Input
                    id="profile-new-pw2"
                    type={showNewPassword2 ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                    className="h-10 rounded-xl pr-10"
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword2((v) => !v)}
                    aria-label={showNewPassword2 ? t.authHidePassword : t.authShowPassword}
                    className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    {showNewPassword2 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t.cancel}
            </Button>
            <Button type="submit" className="rounded-xl" disabled={saving}>
              {saving ? t.loading : t.authSaveCredentials}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NavMobileDateRangeBar() {
  const { filter } = useNavDateFilter();
  if (filter.mode !== 'range') return null;
  return (
    <div className="border-t border-indigo-100 bg-indigo-50/60 px-3 py-1.5 lg:hidden dark:border-indigo-900/40 dark:bg-indigo-950/30">
      <p className="nums text-center text-xs font-semibold text-indigo-800 dark:text-indigo-200">
        {formatYmdDisplay(filter.from)} — {formatYmdDisplay(filter.to)}
      </p>
    </div>
  );
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useApp();
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItemsAll: {
    path: string;
    icon: typeof LayoutDashboard;
    label: string;
    exact: boolean;
    key: AppRouteKey | 'users' | 'statistics';
  }[] = [
    { path: '/', icon: LayoutDashboard, label: t.navDashboard, exact: true, key: 'dashboard' },
    { path: '/warehouse', icon: Boxes, label: t.navWarehouse, exact: false, key: 'warehouse' },
    { path: '/sales', icon: Receipt, label: t.navSales, exact: false, key: 'sales' },
    { path: '/customers', icon: Users, label: t.navCustomers, exact: false, key: 'customers' },
    { path: '/suppliers', icon: Truck, label: t.navSuppliers, exact: false, key: 'suppliers' },
    {
      path: '/street-objects',
      icon: MapPin,
      label: t.navStreetObjects,
      exact: false,
      key: 'streetObjects',
    },
    { path: '/expenses', icon: Wallet, label: t.navExpenses, exact: false, key: 'expenses' },
    { path: '/statistics', icon: BarChart3, label: t.navStatistics, exact: false, key: 'statistics' },
    { path: '/users', icon: UserCog, label: t.navSystemUsers, exact: false, key: 'users' },
  ];

  const navItems = navItemsAll.filter((item) => {
    if (!user) return false;
    if (item.key === 'users' || item.key === 'statistics') return user.role === 'ADMIN';
    return hasPageAccess(user, item.key);
  });

  const PAGE_TITLES: Record<string, string> = {
    '/': t.dashTitle,
    '/warehouse': t.whTitle,
    '/sales': t.salesTitle,
    '/customers': t.custTitle,
    '/suppliers': t.suppTitle,
    '/street-objects': t.streetTitle,
    '/expenses': t.expTitle,
    '/statistics': t.statTitle,
    '/users': t.usersTitle,
  };
  const pageTitle = PAGE_TITLES[location.pathname] ?? t.brandName;

  // Mobil drawer ochilganda body skroli o'chirilsin
  useEffect(() => {
    if (mobileOpen) {
      document.documentElement.classList.add('overflow-hidden');
      return () => document.documentElement.classList.remove('overflow-hidden');
    }
  }, [mobileOpen]);

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-700/50 dark:bg-slate-900 ${
          collapsed ? 'w-16' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand */}
        <div
          className={`flex items-center gap-3 border-b border-slate-100 px-4 py-5 dark:border-slate-700/50 ${
            collapsed ? 'justify-center px-2' : ''
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30">
            <Recycle size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                {t.brandName}
              </p>
              <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                {t.brandSubtitle}
              </p>
            </div>
          )}
          {/* Mobile close */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-150 ${
                  isActive
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 ${
                    isActive
                      ? 'text-indigo-500 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white'
                  }`}
                />
                {!collapsed && <span className="truncate text-xs font-medium">{item.label}</span>}
                {!collapsed && isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                )}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-xl group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop) */}
        <div className="border-t border-slate-100 p-2 dark:border-slate-700/50">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden w-full items-center justify-center rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white lg:flex"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ${
          collapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        {/* Header */}
        <header className="z-10 shrink-0 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col px-3 py-2 lg:h-14 lg:flex-row lg:items-center lg:gap-3 lg:px-5 lg:py-0">
          <div className="flex min-w-0 items-center gap-2 lg:flex-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Menu"
            >
              <Menu size={18} />
            </button>

            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-white sm:text-base">
              {pageTitle}
            </h1>
          </div>

          <div className="mt-1.5 flex min-w-0 items-center gap-1 overflow-x-auto pb-0.5 hide-scrollbar sm:gap-1.5 lg:mt-0 lg:shrink-0 lg:overflow-visible lg:pb-0">
            <NavbarDateRangePicker />

            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Theme"
            >
              {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <FontScaleControls />

            <LanguageDropdown />

            <div className="hidden shrink-0 items-center gap-2 border-l border-slate-200 pl-2 dark:border-slate-700 md:flex">
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="flex max-w-[200px] items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                title={t.authProfileTitle}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600">
                  <UserIcon size={12} className="text-white" />
                </div>
                <div className="hidden min-w-0 lg:block">
                  <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                    {user?.fullName ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {user?.positions?.length ? (
                      <span className="line-clamp-2 block text-slate-600 dark:text-slate-300">
                        {user.positions.join(' · ')}
                      </span>
                    ) : (
                      <span className="truncate text-slate-500">{user?.login ?? ''}</span>
                    )}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => logout()}
                title={t.authLogout}
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <LogOut size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              title={t.authProfileTitle}
              className="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            >
              <UserIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => logout()}
              title={t.authLogout}
              className="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            >
              <LogOut size={16} />
            </button>
          </div>
          </div>
          <NavMobileDateRangeBar />
        </header>

        <ProfileCredentialsDialog open={profileOpen} onOpenChange={setProfileOpen} />

        {/* Page content */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
