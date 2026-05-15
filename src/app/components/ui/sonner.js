import { jsx as _jsx } from "react/jsx-runtime";
import { Toaster as Sonner } from 'sonner';
import { useTheme } from 'next-themes';
export function Toaster(props) {
    const { resolvedTheme } = useTheme();
    return (_jsx(Sonner, { theme: resolvedTheme, richColors: true, position: "top-center", closeButton: true, toastOptions: {
            classNames: {
                toast: 'bg-white border border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 rounded-xl shadow-lg',
                description: 'text-slate-500 dark:text-slate-400 text-xs',
            },
        }, ...props }));
}
