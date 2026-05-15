import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './utils';
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Overlay, { ref: ref, className: cn('fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className), ...props })));
DialogOverlay.displayName = 'DialogOverlay';
export const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (_jsxs(DialogPortal, { children: [_jsx(DialogOverlay, {}), _jsxs(DialogPrimitive.Content, { ref: ref, className: cn('fixed left-1/2 top-1/2 z-50 w-[min(96vw,32rem)] max-h-[92vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40', className), ...props, children: [children, _jsx(DialogPrimitive.Close, { className: "absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200", "aria-label": "Yopish", children: _jsx(X, { size: 16 }) })] })] })));
DialogContent.displayName = 'DialogContent';
export function DialogHeader({ className, ...props }) {
    return _jsx("div", { className: cn('mb-4 flex flex-col gap-1', className), ...props });
}
export function DialogFooter({ className, ...props }) {
    return (_jsx("div", { className: cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className), ...props }));
}
export const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Title, { ref: ref, className: cn('text-base font-semibold text-slate-900 dark:text-white', className), ...props })));
DialogTitle.displayName = 'DialogTitle';
export const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Description, { ref: ref, className: cn('text-xs text-slate-500 dark:text-slate-400', className), ...props })));
DialogDescription.displayName = 'DialogDescription';
