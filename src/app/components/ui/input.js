import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from './utils';
export const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (_jsx("input", { ref: ref, type: type, className: cn('h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500', className), ...props })));
Input.displayName = 'Input';
