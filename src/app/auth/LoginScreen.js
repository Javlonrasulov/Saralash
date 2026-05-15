import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Recycle, User } from 'lucide-react';
import { useAuth } from './auth-context';
import { useApp } from '../i18n/app-context';
import { Button } from '../components/ui/button';
export function LoginScreen() {
    const { login, loading } = useAuth();
    const { t } = useApp();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await login(identifier, password);
        }
        catch (err) {
            const code = err instanceof Error ? err.message : '';
            if (code === 'AUTH_SERVER_ERROR')
                setError(t.authServerError);
            else
                setError(t.authError);
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen w-full bg-gradient-to-br from-slate-100 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-300/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40", children: [_jsxs("div", { className: "mb-6 text-center", children: [_jsx("div", { className: "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30", children: _jsx(Recycle, { size: 26, className: "text-white" }) }), _jsx("h1", { className: "mt-4 text-2xl font-bold text-slate-900 dark:text-white", children: t.authTitle }), _jsx("p", { className: "mt-1 text-sm text-slate-500 dark:text-slate-400", children: t.authSubtitle })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300", children: t.authIdentifier }), _jsxs("div", { className: "relative", children: [_jsx(User, { size: 16, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx("input", { value: identifier, onChange: (e) => setIdentifier(e.target.value), autoComplete: "username", className: "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100", placeholder: "admin" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300", children: t.authPassword }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { size: 16, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx("input", { value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "current-password", type: showPassword ? 'text' : 'password', className: "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }), _jsx("button", { type: "button", onClick: () => setShowPassword((v) => !v), "aria-label": showPassword ? t.authHidePassword : t.authShowPassword, className: "absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200", children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), error && (_jsx("div", { className: "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300", children: error })), _jsxs(Button, { type: "submit", disabled: loading || submitting, size: "lg", className: "w-full", children: [_jsx(LogIn, { size: 16 }), submitting ? t.loading : t.authSubmit] }), _jsx("p", { className: "pt-2 text-center text-xs text-slate-400 dark:text-slate-500", children: t.authBackendHint })] })] }) }));
}
