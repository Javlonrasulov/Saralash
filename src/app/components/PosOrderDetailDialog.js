import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getAvailableKgForWarehouseSale, useStore, } from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from './ui/table';
import { formatDate, formatMoneyInputDisplay, formatNumber, uid } from '../utils/format';
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from './ui/alert-dialog';
function kgInStock(items) {
    return items.filter((w) => {
        if (w.unit !== 'kg')
            return false;
        if (w.parentWarehouseId) {
            const p = items.find((x) => x.id === w.parentWarehouseId);
            return Boolean(p && p.unit === 'kg');
        }
        return w.currentQty > 1e-6 || items.some((ch) => ch.parentWarehouseId === w.id && ch.unit === 'kg');
    });
}
function maxQtyForDraftLine(items, draft, lineIndex, originalLines) {
    const w = items.find((x) => x.id === draft[lineIndex].warehouseItemId);
    if (!w)
        return 0;
    const avail = getAvailableKgForWarehouseSale(items, w);
    const released = originalLines
        .filter((o) => o.warehouseItemId === w.id)
        .reduce((s, o) => s + o.quantity, 0);
    const others = draft.reduce((s, l, i) => {
        if (i === lineIndex || l.warehouseItemId !== w.id)
            return s;
        return s + l.qty;
    }, 0);
    return Math.max(0, avail + released - others);
}
export function PosOrderDetailDialog({ orderId, lines, open, onOpenChange, initialEditMode = false, }) {
    const { state, updatePosOrder, deletePosOrder } = useStore();
    const { t } = useApp();
    const [editMode, setEditMode] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saleDate, setSaleDate] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [paidInput, setPaidInput] = useState('');
    const [draftLines, setDraftLines] = useState([]);
    const first = lines[0];
    const inStock = useMemo(() => kgInStock(state.warehouseItems), [state.warehouseItems]);
    const resetFromProps = useCallback(() => {
        if (!lines.length)
            return;
        const f = lines[0];
        setSaleDate(f.date);
        setCustomerId(f.customerId?.trim() ?? '');
        const paid = f.orderPaidTotal != null && Number.isFinite(f.orderPaidTotal)
            ? Math.round(f.orderPaidTotal)
            : lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
        setPaidInput(formatMoneyInputDisplay(String(paid)));
        setDraftLines(lines.map((l) => ({
            key: uid('edit'),
            warehouseItemId: l.warehouseItemId,
            qty: l.quantity,
            price: l.pricePerUnit ?? 0,
        })));
        setEditMode(false);
    }, [lines]);
    useEffect(() => {
        if (!open || !lines.length)
            return;
        resetFromProps();
        if (initialEditMode)
            setEditMode(true);
    }, [open, lines, resetFromProps, initialEditMode]);
    const handleDelete = () => {
        const ok = deletePosOrder(orderId);
        if (!ok) {
            toast.error(t.posSaleInvalid);
            return;
        }
        toast.success(t.posOrderDeleted);
        setConfirmDelete(false);
        onOpenChange(false);
    };
    const orderTotal = useMemo(() => draftLines.reduce((s, l) => s + l.qty * l.price, 0), [draftLines]);
    const paidRaw = useMemo(() => {
        const x = parseFloat(String(paidInput).replace(/\s/g, '').replace(',', '.'));
        return Number.isFinite(x) ? Math.max(0, x) : 0;
    }, [paidInput]);
    const paidClamped = Math.min(paidRaw, orderTotal || 0);
    const debtPreview = Math.max(0, orderTotal - paidClamped);
    const buyerLabel = useMemo(() => {
        if (!first)
            return '—';
        if (first.customerId) {
            const c = state.customers.find((x) => x.id === first.customerId);
            return c?.fullName ?? first.customerName ?? '—';
        }
        return first.customerName?.trim() || '—';
    }, [first, state.customers]);
    const handleSave = () => {
        if (!customerId.trim()) {
            toast.error(t.posCustomerRequired);
            return;
        }
        if (!draftLines.length) {
            toast.error(t.posCartEmpty);
            return;
        }
        for (let i = 0; i < draftLines.length; i++) {
            const l = draftLines[i];
            if (!l.warehouseItemId || l.qty <= 0 || l.price < 0) {
                toast.error(t.posSaleInvalid);
                return;
            }
            const cap = maxQtyForDraftLine(state.warehouseItems, draftLines, i, lines);
            if (l.qty - cap > 1e-6) {
                toast.error(t.posSaleInvalid);
                return;
            }
        }
        const cust = state.customers.find((c) => c.id === customerId);
        if (!cust) {
            toast.error(t.posCustomerRequired);
            return;
        }
        const ok = updatePosOrder({
            posOrderId: orderId,
            date: saleDate,
            customerId: cust.id,
            customerName: cust.fullName,
            paidAmount: paidClamped,
            lines: draftLines.map((l) => ({
                warehouseItemId: l.warehouseItemId,
                quantity: l.qty,
                pricePerUnit: l.price,
            })),
        });
        if (!ok) {
            toast.error(t.posSaleInvalid);
            return;
        }
        toast.success(t.posSaleUpdated);
        onOpenChange(false);
    };
    const addDraftLine = () => {
        const w = inStock[0];
        if (!w)
            return;
        setDraftLines((d) => [
            ...d,
            { key: uid('edit'), warehouseItemId: w.id, qty: 1, price: w.salePricePerUnit ?? 0 },
        ]);
    };
    if (!lines.length)
        return null;
    const viewTotal = lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
    const viewPaid = first.orderPaidTotal != null && Number.isFinite(first.orderPaidTotal)
        ? Math.max(0, Math.min(first.orderPaidTotal, viewTotal))
        : viewTotal;
    const viewDebt = Math.max(0, viewTotal - viewPaid);
    return (_jsxs(Dialog, { open: open, onOpenChange: onOpenChange, children: [_jsxs(DialogContent, { className: "max-h-[min(92vh,720px)] w-[min(96vw,42rem)] max-w-[42rem] overflow-y-auto", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t.posOrderDetailTitle }) }), !editMode ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-2 text-sm sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: t.date }), _jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: formatDate(first.date) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: t.whBuyer }), _jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: buyerLabel })] })] }), _jsxs("div", { className: "grid gap-2 text-sm sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: t.salesAmount }), _jsxs("p", { className: "nums font-semibold text-slate-900 dark:text-white", children: [formatNumber(viewTotal), " so'm"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: t.posPaidLabel }), _jsxs("p", { className: "nums font-semibold text-slate-800 dark:text-slate-100", children: [formatNumber(viewPaid), " so'm"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: t.posDebtLabel }), _jsxs("p", { className: "nums font-semibold text-amber-600 dark:text-amber-400", children: [formatNumber(viewDebt), " so'm"] })] })] }), _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.whProductName }), _jsx(TableHead, { className: "text-right", children: t.quantity }), _jsx(TableHead, { className: "text-right", children: t.whPricePerUnit }), _jsx(TableHead, { className: "text-right", children: t.posLineTotal })] }) }), _jsx(TableBody, { children: lines.map((l) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: l.productName }), _jsxs(TableCell, { className: "nums text-right", children: [formatNumber(l.quantity), " ", l.unit === 'kg' ? 'kg' : t.unitPcs] }), _jsx(TableCell, { className: "nums text-right", children: l.pricePerUnit != null ? `${formatNumber(l.pricePerUnit)} so'm` : '—' }), _jsxs(TableCell, { className: "nums text-right font-medium", children: [formatNumber(l.totalAmount ?? l.quantity * (l.pricePerUnit ?? 0)), " so'm"] })] }, l.id))) })] }), _jsxs(DialogFooter, { className: "flex-wrap gap-2 sm:justify-between", children: [_jsx(Button, { type: "button", className: "rounded-xl", onClick: () => setEditMode(true), children: t.posEditOrder }), _jsx(Button, { type: "button", variant: "outline", className: "rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40", onClick: () => setConfirmDelete(true), children: t.delete })] })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.date }), _jsx(Input, { type: "date", value: saleDate, onChange: (e) => setSaleDate(e.target.value), className: "mt-1.5 rounded-xl" })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.posSelectClient }), _jsxs(Select, { value: customerId || undefined, onValueChange: setCustomerId, children: [_jsx(SelectTrigger, { className: "mt-1.5 rounded-xl", children: _jsx(SelectValue, { placeholder: t.posSelectClient }) }), _jsx(SelectContent, { children: state.customers.map((c) => (_jsx(SelectItem, { value: c.id, children: c.fullName }, c.id))) })] })] })] }), _jsx("div", { className: "space-y-2", children: draftLines.map((line, idx) => {
                                    const cap = maxQtyForDraftLine(state.warehouseItems, draftLines, idx, lines);
                                    return (_jsxs("div", { className: "grid gap-2 rounded-xl border border-slate-100 p-3 dark:border-slate-700 sm:grid-cols-[1fr_5.5rem_6.5rem_2rem]", children: [_jsxs("div", { className: "min-w-0 sm:col-span-1", children: [_jsx(Label, { className: "text-[10px] text-slate-500", children: t.whProductName }), _jsxs(Select, { value: line.warehouseItemId, onValueChange: (v) => setDraftLines((d) => {
                                                            const next = [...d];
                                                            const it = state.warehouseItems.find((x) => x.id === v);
                                                            next[idx] = {
                                                                ...next[idx],
                                                                warehouseItemId: v,
                                                                price: it?.salePricePerUnit != null && Number.isFinite(it.salePricePerUnit)
                                                                    ? it.salePricePerUnit
                                                                    : next[idx].price,
                                                            };
                                                            return next;
                                                        }), children: [_jsx(SelectTrigger, { className: "mt-1 rounded-xl", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: inStock.map((w) => (_jsxs(SelectItem, { value: w.id, children: [w.productName, " (", formatNumber(w.currentQty), " kg)"] }, w.id))) })] }), _jsxs("p", { className: "mt-1 text-[10px] text-slate-400", children: ["max ~", formatNumber(cap), " kg"] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-[10px] text-slate-500", children: "kg" }), _jsx(Input, { className: "mt-1 rounded-xl", inputMode: "decimal", value: String(line.qty).replace('.', ','), onChange: (e) => {
                                                            const v = parseFloat(e.target.value.replace(/\s/g, '').replace(',', '.'));
                                                            setDraftLines((d) => {
                                                                const next = [...d];
                                                                next[idx] = { ...next[idx], qty: Number.isFinite(v) && v > 0 ? v : 0 };
                                                                return next;
                                                            });
                                                        } })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-[10px] text-slate-500", children: t.posPricePerKg }), _jsx(Input, { className: "mt-1 rounded-xl", inputMode: "numeric", value: formatMoneyInputDisplay(String(line.price)), onChange: (e) => {
                                                            const raw = formatMoneyInputDisplay(e.target.value);
                                                            const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
                                                            setDraftLines((d) => {
                                                                const next = [...d];
                                                                next[idx] = { ...next[idx], price: Number.isFinite(n) ? n : 0 };
                                                                return next;
                                                            });
                                                        } })] }), _jsx("div", { className: "flex items-end justify-end pb-1", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "text-slate-400 hover:text-red-600", disabled: draftLines.length <= 1, onClick: () => setDraftLines((d) => d.filter((_, i) => i !== idx)), "aria-label": t.posRemove, children: _jsx(Trash2, { size: 16 }) }) })] }, line.key));
                                }) }), _jsx(Button, { type: "button", variant: "outline", size: "sm", className: "rounded-xl", onClick: addDraftLine, children: t.posAddOrderLine }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.salesAmount }), _jsxs("p", { className: "nums mt-1 text-lg font-bold", children: [formatNumber(orderTotal), " so'm"] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.posPaidLabel }), _jsx(Input, { value: paidInput, onChange: (e) => setPaidInput(formatMoneyInputDisplay(e.target.value)), className: "mt-1.5 rounded-xl", inputMode: "numeric" })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.posDebtLabel }), _jsxs("p", { className: "nums mt-2 font-semibold text-amber-600 dark:text-amber-400", children: [formatNumber(debtPreview), " so'm"] })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", className: "rounded-xl", onClick: () => {
                                            resetFromProps();
                                        }, children: t.posCancelEdit }), _jsx(Button, { type: "button", className: "rounded-xl bg-sky-500 hover:bg-sky-600", onClick: handleSave, children: t.posSaveOrder })] })] }))] }), _jsx(AlertDialog, { open: confirmDelete, onOpenChange: setConfirmDelete, children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.delete }), _jsx(AlertDialogDescription, { children: t.posDeleteOrderConfirm })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDelete, children: t.delete })] })] }) })] }));
}
