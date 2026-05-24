export type AppRouteKey =
  | 'dashboard'
  | 'warehouse'
  | 'sales'
  | 'customers'
  | 'suppliers'
  | 'streetObjects'
  | 'expenses';

export interface SessionUser {
  id: string;
  login: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  allowedRoutes: AppRouteKey[];
  /** Korxonadagi lavozim nomlari (o‘zingiz yozasiz) */
  positions: string[];
}

export function hasPageAccess(user: SessionUser, route: AppRouteKey): boolean {
  if (user.role === 'ADMIN') return true;
  return user.allowedRoutes.includes(route);
}

export function pathnameToRouteKey(pathname: string): AppRouteKey | 'users' | null {
  if (pathname === '/' || pathname === '') return 'dashboard';
  if (pathname.startsWith('/warehouse')) return 'warehouse';
  if (pathname.startsWith('/sales')) return 'sales';
  if (pathname.startsWith('/customers')) return 'customers';
  if (pathname.startsWith('/street-objects')) return 'streetObjects';
  if (pathname.startsWith('/suppliers')) return 'suppliers';
  if (pathname.startsWith('/expenses')) return 'expenses';
  if (pathname.startsWith('/users')) return 'users';
  return null;
}
