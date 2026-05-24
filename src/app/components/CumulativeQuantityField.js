import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { formatQtyPartsExpression, lineQtyTotal, } from '../utils/purchase-qty-parts';
import { formatQuantity } from '../utils/format';
export function CumulativeQuantityField({ label, quantity, qtyParts, unit, unitLabel, runningTotalLabel, addAriaLabel, placeholder, pcsHint, onQuantityChange, onAddPart, }) {
    const exprRef = useRef(null);
    const parts = qtyParts;
    const total = lineQtyTotal({ quantity, qtyParts: parts }, false);
    const expr = formatQtyPartsExpression(parts, unit);
    useEffect(() => {
        const el = exprRef.current;
        if (!el)
            return;
        el.scrollLeft = el.scrollWidth;
    }, [expr]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onAddPart();
        }
    };
    return (_jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: label }), _jsxs("div", { className: "mt-1 flex gap-2", children: [_jsxs("div", { className: "flex min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-400/30 dark:border-slate-700 dark:bg-slate-800", children: [expr ? (_jsxs("div", { ref: exprRef, className: "flex max-w-[58%] shrink-0 items-center overflow-x-auto border-r border-slate-100 px-2.5 py-2 text-sm font-medium text-slate-700 scrollbar-none dark:border-slate-700 dark:text-slate-200 sm:max-w-[65%]", title: quantity.trim() ? `${expr}+${quantity}` : expr, children: [_jsx("span", { className: "nums whitespace-nowrap", children: expr }), quantity.trim() ? _jsx("span", { className: "ml-0.5 text-slate-400", children: "+" }) : null] })) : null, _jsx(Input, { value: quantity, onChange: (e) => onQuantityChange(e.target.value.replace(/[^\d.,]/g, '')), onKeyDown: handleKeyDown, className: "min-w-[3.5rem] flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0", inputMode: "decimal", placeholder: placeholder })] }), _jsx(Button, { type: "button", variant: "default", size: "icon", className: "h-10 w-10 shrink-0 rounded-xl", "aria-label": addAriaLabel, onClick: onAddPart, children: _jsx(Plus, { size: 18 }) })] }), total > 0 && (_jsxs("p", { className: "mt-1.5 text-xs text-slate-600 dark:text-slate-300", children: [runningTotalLabel, ":", ' ', _jsxs("span", { className: "nums font-semibold text-indigo-700 dark:text-indigo-300", children: [formatQuantity(total, unit), " ", unitLabel] })] })), unit === 'pcs' && pcsHint ? (_jsx("p", { className: "mt-1 text-[10px] text-slate-500", children: pcsHint })) : null] }));
}
