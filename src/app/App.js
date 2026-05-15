import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RouterProvider } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { router } from './routes';
import { AppProvider } from './i18n/app-context';
import { AuthProvider, useAuth } from './auth/auth-context';
import { NavDateRangeProvider } from './context/nav-date-range-context';
import { LoginScreen } from './auth/LoginScreen';
import { Toaster } from './components/ui/sonner';
function AppShell() {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated)
        return _jsx(LoginScreen, {});
    return (_jsx(NavDateRangeProvider, { children: _jsx(RouterProvider, { router: router }) }));
}
export default function App() {
    return (_jsx(ThemeProvider, { attribute: "class", defaultTheme: "light", enableSystem: false, children: _jsx(AppProvider, { children: _jsxs(AuthProvider, { children: [_jsx(AppShell, {}), _jsx(Toaster, {})] }) }) }));
}
