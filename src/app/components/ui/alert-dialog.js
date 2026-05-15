import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from './utils';
import { buttonVariants } from './button';
export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;
export const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Overlay, { ref: ref, className: cn('fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm', className), ...props })));
AlertDialogOverlay.displayName = 'AlertDialogOverlay';
export const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => (_jsxs(AlertDialogPortal, { children: [_jsx(AlertDialogOverlay, {}), _jsx(AlertDialogPrimitive.Content, { ref: ref, className: cn('fixed left-1/2 top-1/2 z-50 w-[min(94vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900', className), ...props })] })));
AlertDialogContent.displayName = 'AlertDialogContent';
export function AlertDialogHeader({ className, ...props }) {
    return _jsx("div", { className: cn('mb-4 flex flex-col gap-1', className), ...props });
}
export function AlertDialogFooter({ className, ...props }) {
    return (_jsx("div", { className: cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className), ...props }));
}
export const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Title, { ref: ref, className: cn('text-base font-semibold text-slate-900 dark:text-white', className), ...props })));
AlertDialogTitle.displayName = 'AlertDialogTitle';
export const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Description, { ref: ref, className: cn('text-sm text-slate-500 dark:text-slate-400', className), ...props })));
AlertDialogDescription.displayName = 'AlertDialogDescription';
export const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Action, { ref: ref, className: cn(buttonVariants({ variant: 'destructive' }), className), ...props })));
AlertDialogAction.displayName = 'AlertDialogAction';
export const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Cancel, { ref: ref, className: cn(buttonVariants({ variant: 'outline' }), className), ...props })));
AlertDialogCancel.displayName = 'AlertDialogCancel';
