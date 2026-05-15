import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/auth-context';
import type { AppRouteKey } from '../auth/types';
import { useApp } from '../i18n/app-context';

export function RequireRoute({
  routeKey,
  children,
}: {
  routeKey: AppRouteKey | 'users' | 'statistics';
  children: React.ReactNode;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const { t } = useApp();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {t.loading}
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  if (routeKey === 'users' || routeKey === 'statistics') {
    if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  if (user.role === 'ADMIN') return <>{children}</>;
  if (!user.allowedRoutes.includes(routeKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
