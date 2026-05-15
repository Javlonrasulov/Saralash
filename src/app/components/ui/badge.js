import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from 'class-variance-authority';
import { cn } from './utils';
const badgeVariants = cva('inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium', {
    variants: {
        variant: {
            default: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
            success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
            warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
            danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
            muted: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
            outline: 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
        },
    },
    defaultVariants: { variant: 'default' },
});
export function Badge({ className, variant, ...props }) {
    return _jsx("span", { className: cn(badgeVariants({ variant }), className), ...props });
}
export { badgeVariants };
