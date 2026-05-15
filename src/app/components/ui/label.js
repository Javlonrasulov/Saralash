import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from './utils';
export const Label = React.forwardRef(({ className, ...props }, ref) => (_jsx(LabelPrimitive.Root, { ref: ref, className: cn('text-xs font-medium text-slate-600 dark:text-slate-300', className), ...props })));
Label.displayName = 'Label';
