import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useApp } from '../i18n/app-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, } from './ui/dialog';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, } from './ui/table';
import { formatDate, formatNumber } from '../utils/format';
function groupSoldByOrder(sold) {
    const map = new Map();
    for (const o of sold) {
        const k = o.posOrderId ?? o.id;
        if (!map.has(k))
            map.set(k, []);
        map.get(k).push(o);
    }
    const rows = [...map.entries()].map(([orderId, lines]) => {
        const first = lines[0];
        const total = lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
        return { orderId, lines, first, total };
    });
    rows.sort((a, b) => b.first.date.localeCompare(a.first.date));
    return rows;
}
function formatOrderLines(lines, unitPcsLabel) {
    return lines
        .map((l) => {
        const u = l.unit === 'kg' ? 'kg' : unitPcsLabel;
        return `${l.productName} (${formatNumber(l.quantity)} ${u})`;
    })
        .join(', ');
}
export function CustomerPurchaseHistoryDialog({ customer, outcomes, open, onOpenChange, }) {
    const { t } = useApp();
    const groups = useMemo(() => {
        if (!customer)
            return [];
        const sold = outcomes.filter((o) => o.type === 'SOLD' && o.customerId === customer.id);
        return groupSoldByOrder(sold);
    }, [customer, outcomes]);
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl", children: [_jsx(DialogHeader, { className: "border-b border-slate-100 px-6 py-4 dark:border-slate-800", children: _jsx(DialogTitle, { className: "text-left", children: customer ? `${t.custPurchaseHistory} — ${customer.fullName}` : t.custPurchaseHistory }) }), _jsx("div", { className: "max-h-[min(70vh,520px)] overflow-x-auto overflow-y-auto px-4 py-3 sm:px-6", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "whitespace-nowrap", children: t.date }), _jsx(TableHead, { children: t.custHistoryProducts }), _jsx(TableHead, { className: "text-right whitespace-nowrap", children: t.salesAmount })] }) }), _jsx(TableBody, { children: groups.length === 0 ? (_jsx(TableEmpty, { colSpan: 3, message: t.custNoPurchaseHistory })) : (groups.map((g) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "align-top text-xs whitespace-nowrap text-slate-600 dark:text-slate-300", children: formatDate(g.first.date) }), _jsx(TableCell, { className: "max-w-[min(100vw-8rem,28rem)] text-sm text-slate-800 dark:text-slate-100", children: formatOrderLines(g.lines, t.unitPcs) }), _jsxs(TableCell, { className: "nums align-top text-right font-medium text-emerald-600 dark:text-emerald-400", children: [formatNumber(g.total), " so'm"] })] }, g.orderId)))) })] }) })] }) }));
}
