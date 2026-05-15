import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { useApp } from '../i18n/app-context';
export function RequireRoute({ routeKey, children, }) {
    const { user, loading, isAuthenticated } = useAuth();
    const { t } = useApp();
    if (loading) {
        return (_jsx("div", { className: "flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400", children: t.loading }));
    }
    if (!isAuthenticated || !user)
        return null;
    if (routeKey === 'users' || routeKey === 'statistics') {
        if (user.role !== 'ADMIN')
            return _jsx(Navigate, { to: "/", replace: true });
        return _jsx(_Fragment, { children: children });
    }
    if (user.role === 'ADMIN')
        return _jsx(_Fragment, { children: children });
    if (!user.allowedRoutes.includes(routeKey))
        return _jsx(Navigate, { to: "/", replace: true });
    return _jsx(_Fragment, { children: children });
}
