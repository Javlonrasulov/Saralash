export function hasPageAccess(user, route) {
    if (user.role === 'ADMIN')
        return true;
    return user.allowedRoutes.includes(route);
}
export function pathnameToRouteKey(pathname) {
    if (pathname === '/' || pathname === '')
        return 'dashboard';
    if (pathname.startsWith('/warehouse'))
        return 'warehouse';
    if (pathname.startsWith('/sales'))
        return 'sales';
    if (pathname.startsWith('/customers'))
        return 'customers';
    if (pathname.startsWith('/suppliers'))
        return 'suppliers';
    if (pathname.startsWith('/expenses'))
        return 'expenses';
    if (pathname.startsWith('/users'))
        return 'users';
    return null;
}
