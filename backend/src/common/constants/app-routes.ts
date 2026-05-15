/** Sahifa kalitlari (frontend marshrutlari bilan mos) */
export const APP_ROUTE_KEYS = ['dashboard', 'warehouse', 'sales', 'customers', 'suppliers'] as const;
export type AppRouteKey = (typeof APP_ROUTE_KEYS)[number];

export function isAppRouteKey(v: string): v is AppRouteKey {
  return (APP_ROUTE_KEYS as readonly string[]).includes(v);
}

export const ALL_APP_ROUTES: AppRouteKey[] = [...APP_ROUTE_KEYS];
