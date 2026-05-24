import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { useStore, } from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from './ui/select';
import { formatDate, formatNumber, formatQuantity, uid } from '../utils/format';
import { CumulativeQuantityField } from './CumulativeQuantityField';
import { appendQtyPart, finalizeQtyParts, lineQtyTotal, switchWarehouseOnLine, } from '../utils/purchase-qty-parts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from './ui/alert-dialog';
function newDraftLine(warehouseItemId = '', pricePerUnit = '') {
    return { key: uid('spe'), warehouseItemId, quantity: '', qtyParts: [], pricePerUnit };
}
export function SupplierPurchaseEditDialog({ batch, open, onOpenChange, warehouseOptions, warehouseProductTitle, prefPrice, }) {
    const { state, replaceSupplierPurchaseBatch, deleteSupplierPurchaseBatch } = useStore();
    const { t } = useApp();
    const [supplierId, setSupplierId] = useState('');
    const [incomeDate, setIncomeDate] = useState('');
    const [paidAmount, setPaidAmount] = useState('');
    const [onCredit, setOnCredit] = useState(false);
    const [notes, setNotes] = useState('');
    const [draftLines, setDraftLines] = useState([]);
    const [editingKey, setEditingKey] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const resetFromBatch = useCallback(() => {
        if (!batch?.lines.length)
            return;
        const first = batch.lines[0];
        setSupplierId(batch.supplierId ?? '');
        setIncomeDate(batch.incomeDate);
        setNotes(batch.notes?.trim() ?? '');
        setOnCredit(batch.lines.some((l) => l.onCredit));
        const orderTotal = batch.lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
        const paid = batch.lines.reduce((s, l) => s + (l.paidAmount ?? 0), 0);
        setPaidAmount(orderTotal > 0 ? String(Math.round(paid * 100) / 100) : '');
        const mapped = batch.lines.map((l) => ({
            key: uid('spe'),
            warehouseItemId: l.warehouseItemId,
            quantity: '',
            qtyParts: [l.quantity],
            pricePerUnit: l.pricePerUnit != null && Number.isFinite(l.pricePerUnit) ? String(l.pricePerUnit) : '',
        }));
        setDraftLines(mapped);
        setEditingKey(mapped[0]?.key ?? '');
        void first;
    }, [batch]);
    useEffect(() => {
        if (open && batch)
            resetFromBatch();
    }, [open, batch, resetFromBatch]);
    const parseDraftLine = (line) => {
        const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
        const qtyNum = (() => {
            const total = lineQtyTotal(line, false);
            return total > 0 ? total : null;
        })();
        const priceRaw = line.pricePerUnit.trim().replace(',', '.');
        const price = priceRaw ? parseFloat(priceRaw) : null;
        const priceNum = price != null && Number.isFinite(price) && price > 0 ? price : null;
        const lineTotal = priceNum != null && qtyNum != null ? priceNum * qtyNum : null;
        return { w, qtyNum, priceNum, lineTotal };
    };
    const orderTotal = useMemo(() => {
        let sum = 0;
        let any = false;
        for (const line of draftLines) {
            const { lineTotal } = parseDraftLine(line);
            if (lineTotal != null) {
                sum += lineTotal;
                any = true;
            }
        }
        return any ? sum : null;
    }, [draftLines, state.warehouseItems]);
    const debtPreview = useMemo(() => {
        if (orderTotal == null)
            return null;
        const payRaw = paidAmount.trim().replace(',', '.');
        const paid = payRaw === '' ? 0 : Number.isFinite(parseFloat(payRaw)) ? Math.max(0, parseFloat(payRaw)) : null;
        if (paid == null)
            return null;
        return Math.max(0, orderTotal - paid);
    }, [orderTotal, paidAmount]);
    useEffect(() => {
        if (!open || onCredit || orderTotal == null)
            return;
        const next = String(Math.round(orderTotal * 100) / 100);
        setPaidAmount((p) => (p === next ? p : next));
    }, [open, onCredit, orderTotal]);
    const sessionQtyByWarehouseId = useMemo(() => {
        const map = new Map();
        for (const line of draftLines) {
            const { w, qtyNum } = parseDraftLine(line);
            if (!w || qtyNum == null)
                continue;
            map.set(w.id, (map.get(w.id) ?? 0) + qtyNum);
        }
        return map;
    }, [draftLines, state.warehouseItems]);
    const warehouseSessionLabel = (w) => {
        const q = sessionQtyByWarehouseId.get(w.id) ?? 0;
        const u = w.unit === 'kg' ? 'kg' : t.unitPcs;
        return `${warehouseProductTitle(w)} (${formatQuantity(q, w.unit)} ${u})`;
    };
    const selectDraftWarehouse = (lineKey, newWarehouseId) => {
        const item = state.warehouseItems.find((x) => x.id === newWarehouseId);
        const unitFor = (id) => state.warehouseItems.find((x) => x.id === id)?.unit ?? 'kg';
        const { lines, editingKey: nextKey } = switchWarehouseOnLine(draftLines, lineKey, newWarehouseId, prefPrice(item), unitFor, () => newDraftLine());
        setDraftLines(lines);
        setEditingKey(nextKey);
    };
    const appendDraftQtyPart = (key) => {
        const line = draftLines.find((l) => l.key === key);
        if (!line?.warehouseItemId) {
            toast.error(t.required);
            return;
        }
        const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
        const result = appendQtyPart(line, w?.unit ?? 'kg');
        if (!result.ok) {
            if (result.reason === 'pcs_whole')
                toast.error(t.suppPurchasePcsWhole);
            else
                toast.error(t.required);
            return;
        }
        updateDraftLine(key, { qtyParts: result.qtyParts, quantity: result.quantity });
    };
    const updateDraftLine = (key, patch) => {
        setDraftLines((d) => d.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    };
    const removeDraftLine = (key) => {
        setDraftLines((d) => {
            const next = d.filter((l) => l.key !== key);
            const lines = next.length ? next : [newDraftLine()];
            if (editingKey === key)
                setEditingKey(lines[lines.length - 1].key);
            return lines;
        });
    };
    const handleSave = () => {
        if (!batch)
            return;
        const sid = supplierId.trim();
        if (!sid || !state.suppliers.some((s) => s.id === sid)) {
            toast.error(t.suppPurchasePickSupplier);
            return;
        }
        const resolved = [];
        for (const line of draftLines) {
            if (!line.warehouseItemId) {
                toast.error(t.required + ': ' + t.suppPurchasePickParent);
                return;
            }
            const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
            const finalized = finalizeQtyParts(line, w?.unit ?? 'kg');
            if (!finalized.ok) {
                if (finalized.reason === 'pcs_whole')
                    toast.error(t.suppPurchasePcsWhole);
                else
                    toast.error(t.required + ': ' + t.whQuantity);
                return;
            }
            const normalized = { ...line, qtyParts: finalized.qtyParts, quantity: finalized.quantity };
            const { qtyNum, priceNum } = parseDraftLine(normalized);
            if (!w || qtyNum == null) {
                toast.error(t.required + ': ' + t.whQuantity);
                return;
            }
            if (w.unit === 'pcs' && Math.abs(qtyNum - Math.floor(qtyNum)) > 1e-9) {
                toast.error(t.suppPurchasePcsWhole);
                return;
            }
            resolved.push({
                warehouseItemId: line.warehouseItemId,
                quantity: qtyNum,
                purchasePricePerUnit: priceNum,
            });
        }
        let paidNum = null;
        if (orderTotal != null) {
            const payRaw = paidAmount.trim().replace(',', '.');
            if (onCredit && payRaw === '')
                paidNum = 0;
            else if (!payRaw) {
                toast.error(t.required + ': ' + t.suppPaidAmount);
                return;
            }
            else {
                paidNum = parseFloat(payRaw);
                if (!Number.isFinite(paidNum) || paidNum < 0) {
                    toast.error(t.whValidateOptionalPrice);
                    return;
                }
            }
            const eps = 1e-4 * Math.max(1, orderTotal);
            if (!onCredit) {
                if (Math.abs(paidNum - orderTotal) > eps) {
                    toast.error(t.suppPaidMustEqualTotal);
                    return;
                }
            }
            else if (paidNum > orderTotal + 1e-6) {
                toast.error(t.suppPaidExceedsTotal);
                return;
            }
        }
        const ok = replaceSupplierPurchaseBatch(batch.batchId, {
            supplierId: sid,
            incomeDate,
            notes: notes.trim() || undefined,
            onCredit,
            paidAmount: orderTotal != null ? paidNum : undefined,
            lines: resolved,
        });
        if (!ok) {
            toast.error(t.suppPurchaseCannotReverse);
            return;
        }
        toast.success(t.suppPurchaseUpdated);
        onOpenChange(false);
    };
    const handleDelete = () => {
        if (!batch)
            return;
        const ok = deleteSupplierPurchaseBatch(batch.batchId);
        if (!ok) {
            toast.error(t.suppPurchaseCannotReverse);
            return;
        }
        toast.success(t.suppPurchaseDeleted);
        setConfirmDelete(false);
        onOpenChange(false);
    };
    if (!batch)
        return null;
    return (_jsxs(Dialog, { open: open, onOpenChange: onOpenChange, children: [_jsxs(DialogContent, { className: "max-h-[90vh] overflow-y-auto sm:max-w-xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t.suppEditPurchaseTitle }), _jsxs("p", { className: "text-xs text-slate-500", children: [formatDate(batch.incomeDate), " \u00B7 ", batch.supplierName, " \u00B7 ", batch.lines.length, ' ', t.suppHistoryProductCount] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.suppPurchasePickSupplier, " *"] }), _jsxs(Select, { value: supplierId || undefined, onValueChange: setSupplierId, children: [_jsx(SelectTrigger, { className: "mt-1.5", children: _jsx(SelectValue, { placeholder: t.suppPurchasePickSupplier }) }), _jsx(SelectContent, { children: state.suppliers.map((s) => (_jsx(SelectItem, { value: s.id, children: s.fullName }, s.id))) })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t.whIncomeDate }), _jsx(Input, { type: "date", value: incomeDate, onChange: (e) => setIncomeDate(e.target.value), className: "mt-1.5 max-w-[12rem]" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t.suppPurchaseLinesTitle }), (() => {
                                        const editingLine = draftLines.find((l) => l.key === editingKey) ?? draftLines[draftLines.length - 1];
                                        const collapsedLines = draftLines.filter((l) => l.key !== editingLine?.key &&
                                            l.warehouseItemId &&
                                            lineQtyTotal(l, false) > 0);
                                        const { w: editW, lineTotal: editTotal } = editingLine
                                            ? parseDraftLine(editingLine)
                                            : { w: undefined, lineTotal: null };
                                        return (_jsxs(_Fragment, { children: [collapsedLines.map((line) => {
                                                    const { w, qtyNum, priceNum, lineTotal } = parseDraftLine(line);
                                                    const unitLbl = w?.unit === 'kg' ? 'kg' : t.unitPcs;
                                                    return (_jsxs("div", { className: "flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/40", children: [_jsxs("div", { className: "min-w-0 flex-1 text-sm leading-snug", children: [_jsx("span", { className: "font-medium", children: w ? warehouseProductTitle(w) : '—' }), qtyNum != null && (_jsxs("span", { className: "text-slate-600 dark:text-slate-300", children: [' ', "\u00B7", ' ', _jsxs("span", { className: "nums", children: [formatQuantity(qtyNum, w?.unit ?? 'kg'), " ", unitLbl] }), lineTotal != null && (_jsxs(_Fragment, { children: [' ', "\u00B7", ' ', _jsxs("span", { className: "nums font-semibold", children: [formatNumber(lineTotal), " so'm"] })] }))] }))] }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 shrink-0", onClick: () => setEditingKey(line.key), children: _jsx(Pencil, { size: 15 }) }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 shrink-0 text-red-600", onClick: () => removeDraftLine(line.key), children: _jsx(Trash2, { size: 15 }) })] }, line.key));
                                                }), editingLine && (_jsxs("div", { className: "space-y-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3 dark:border-sky-900/50 dark:bg-sky-950/20", children: [_jsxs(Select, { value: editingLine.warehouseItemId || undefined, onValueChange: (v) => selectDraftWarehouse(editingLine.key, v), children: [_jsx(SelectTrigger, { className: "rounded-xl", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { className: "max-h-72", children: warehouseOptions.map((opt) => (_jsx(SelectItem, { value: opt.id, children: warehouseSessionLabel(opt) }, opt.id))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(CumulativeQuantityField, { label: _jsxs(_Fragment, { children: [t.whQuantity, " *"] }), quantity: editingLine.quantity, qtyParts: editingLine.qtyParts, unit: editW?.unit ?? 'kg', unitLabel: editW?.unit === 'pcs' ? t.unitPcs : 'kg', runningTotalLabel: t.suppQtyRunningTotal, addAriaLabel: t.suppQtyAddPart, placeholder: editW?.unit === 'kg' ? '2,3' : '5', pcsHint: editW?.unit === 'pcs' ? t.suppPurchasePcsWhole : undefined, onQuantityChange: (value) => updateDraftLine(editingLine.key, { quantity: value }), onAddPart: () => appendDraftQtyPart(editingLine.key) }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.suppPricePerUnit }), _jsx(Input, { value: editingLine.pricePerUnit, onChange: (e) => updateDraftLine(editingLine.key, { pricePerUnit: e.target.value }), className: "mt-1 rounded-xl", inputMode: "decimal" })] })] }), _jsxs("p", { className: "text-xs", children: [t.suppLineTotal, ":", ' ', _jsx("span", { className: "nums font-semibold", children: editTotal != null ? `${formatNumber(editTotal)} so'm` : '—' })] })] }))] }));
                                    })()] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40", children: [_jsx("p", { className: "text-xs text-slate-500", children: t.suppPurchaseGrandTotal }), _jsx("p", { className: "nums text-lg font-semibold", children: orderTotal != null ? `${formatNumber(orderTotal)} so'm` : '—' })] }), _jsxs("div", { children: [_jsxs(Label, { children: [t.suppPaidAmount, orderTotal != null ? ' *' : ''] }), _jsx(Input, { value: paidAmount, onChange: (e) => setPaidAmount(e.target.value), className: "mt-1.5", disabled: orderTotal == null || !onCredit, inputMode: "decimal" }), onCredit && orderTotal != null && debtPreview != null && (_jsxs("p", { className: "mt-1 text-xs text-amber-700 dark:text-amber-300", children: [t.suppDebtPreview, ": ", formatNumber(debtPreview), " so'm"] }))] }), _jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-lg border p-3 dark:border-slate-700", children: [_jsx("input", { type: "checkbox", className: "mt-0.5 h-4 w-4", checked: onCredit, onChange: (e) => setOnCredit(e.target.checked) }), _jsx("span", { className: "text-sm", children: t.suppOnCredit })] }), _jsxs("div", { children: [_jsx(Label, { children: t.notes }), _jsx(Input, { value: notes, onChange: (e) => setNotes(e.target.value), className: "mt-1.5" })] }), _jsx("p", { className: "text-xs text-slate-500", children: t.suppPurchaseReverseHint })] }), _jsxs(DialogFooter, { className: "flex-wrap gap-2 sm:justify-between", children: [_jsx(Button, { type: "button", variant: "outline", className: "text-red-600", onClick: () => setConfirmDelete(true), children: t.delete }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: t.cancel }), _jsx(Button, { type: "button", onClick: handleSave, children: t.save })] })] })] }), _jsx(AlertDialog, { open: confirmDelete, onOpenChange: setConfirmDelete, children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.delete }), _jsx(AlertDialogDescription, { children: t.suppDeletePurchaseConfirm })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDelete, children: t.delete })] })] }) })] }));
}
