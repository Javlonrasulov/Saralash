import { jsx as _jsx } from "react/jsx-runtime";
import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { SaralashProvider } from './store/saralash-store';
import { Dashboard } from './pages/Dashboard';
import { Warehouse } from './pages/Warehouse';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Sales } from './pages/Sales';
import { Expenses } from './pages/Expenses';
import { Statistics } from './pages/Statistics';
import { SystemUsers } from './pages/SystemUsers';
import { RequireRoute } from './components/RequireRoute';
function Root() {
    return (_jsx(SaralashProvider, { children: _jsx(Layout, {}) }));
}
export const router = createBrowserRouter([
    {
        path: '/',
        Component: Root,
        children: [
            {
                index: true,
                element: (_jsx(RequireRoute, { routeKey: "dashboard", children: _jsx(Dashboard, {}) })),
            },
            {
                path: 'warehouse',
                element: (_jsx(RequireRoute, { routeKey: "warehouse", children: _jsx(Warehouse, {}) })),
            },
            {
                path: 'sales',
                element: (_jsx(RequireRoute, { routeKey: "sales", children: _jsx(Sales, {}) })),
            },
            {
                path: 'customers',
                element: (_jsx(RequireRoute, { routeKey: "customers", children: _jsx(Customers, {}) })),
            },
            {
                path: 'suppliers',
                element: (_jsx(RequireRoute, { routeKey: "suppliers", children: _jsx(Suppliers, {}) })),
            },
            {
                path: 'expenses',
                element: (_jsx(RequireRoute, { routeKey: "expenses", children: _jsx(Expenses, {}) })),
            },
            {
                path: 'statistics',
                element: (_jsx(RequireRoute, { routeKey: "statistics", children: _jsx(Statistics, {}) })),
            },
            {
                path: 'users',
                element: (_jsx(RequireRoute, { routeKey: "users", children: _jsx(SystemUsers, {}) })),
            },
        ],
    },
]);
