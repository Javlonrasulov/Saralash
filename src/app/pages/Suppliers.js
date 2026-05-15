import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Phone, MapPin, Truck, ShoppingBag, History, Wallet, } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, getSupplierRemainingDebt, getOrphanSupplierDebtIncurred, } from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { categoryLabel, categoryMeta } from '../utils/category';
import { formatDate, formatNumber, TODAY } from '../utils/format';
const EMPTY_SUPPLIER = {
    fullName: '',
    phone: '',
    address: '',
    notes: '',
};
const EMPTY_PURCHASE = {
    supplierId: '',
    parentWarehouseItemId: '',
    quantity: '',
    incomeDate: TODAY,
    pricePerUnit: '',
    paidAmount: '',
    onCredit: false,
    notes: '',
};
export function Suppliers() {
    const { state, addSupplier, updateSupplier, deleteSupplier, purchaseFromSupplier, recordSupplierDebtRepayment, } = useStore();
    const { t } = useApp();
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_SUPPLIER);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [purchaseForm, setPurchaseForm] = useState(EMPTY_PURCHASE);
    const [mainTab, setMainTab] = useState('list');
    const [historySearch, setHistorySearch] = useState('');
    const [historySupplierId, setHistorySupplierId] = useState('__all');
    const [debtRepayOpen, setDebtRepayOpen] = useState(false);
    const [debtRepaySupplierId, setDebtRepaySupplierId] = useState('');
    const [debtRepayAmount, setDebtRepayAmount] = useState('');
    const [debtRepayDate, setDebtRepayDate] = useState(TODAY);
    const [debtRepayNotes, setDebtRepayNotes] = useState('');
    const [supplierDetailOpen, setSupplierDetailOpen] = useState(false);
    const [supplierDetail, setSupplierDetail] = useState(null);
    const debtTabBadgeCount = useMemo(() => {
        let n = state.suppliers.filter((s) => getSupplierRemainingDebt(state, s.id) > 1e-6).length;
        if (getOrphanSupplierDebtIncurred(state) > 1e-6)
            n += 1;
        return n;
    }, [state.suppliers, state.supplierPurchases, state.supplierDebtRepayments]);
    const sortedDebtRepayments = useMemo(() => [...state.supplierDebtRepayments].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [state.supplierDebtRepayments]);
    const supplierDetailPurchases = useMemo(() => {
        if (!supplierDetail)
            return [];
        return state.supplierPurchases
            .filter((p) => p.supplierId === supplierDetail.id)
            .slice()
            .sort((a, b) => String(b.incomeDate).localeCompare(String(a.incomeDate)) ||
            String(b.createdAt).localeCompare(String(a.createdAt)));
    }, [state.supplierPurchases, supplierDetail]);
    const debtRepayRemaining = useMemo(() => {
        if (!debtRepaySupplierId)
            return 0;
        return getSupplierRemainingDebt(state, debtRepaySupplierId);
    }, [state, debtRepaySupplierId]);
    const parentWarehouseOptions = useMemo(() => state.warehouseItems
        .filter((w) => !w.parentWarehouseId)
        .slice()
        .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' })), [state.warehouseItems]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return state.suppliers;
        return state.suppliers.filter((s) => s.fullName.toLowerCase().includes(q) ||
            s.phone.toLowerCase().includes(q) ||
            s.address.toLowerCase().includes(q));
    }, [state.suppliers, search]);
    const purchaseSelectedSupplier = useMemo(() => state.suppliers.find((s) => s.id === purchaseForm.supplierId), [state.suppliers, purchaseForm.supplierId]);
    const purchaseSelectedParent = useMemo(() => state.warehouseItems.find((w) => w.id === purchaseForm.parentWarehouseItemId), [state.warehouseItems, purchaseForm.parentWarehouseItemId]);
    const purchaseQtyNum = useMemo(() => {
        const raw = purchaseForm.quantity.trim().replace(',', '.');
        if (!raw)
            return null;
        const v = parseFloat(raw);
        return Number.isFinite(v) && v > 0 ? v : null;
    }, [purchaseForm.quantity]);
    const purchasePriceNum = useMemo(() => {
        const raw = purchaseForm.pricePerUnit.trim().replace(',', '.');
        if (!raw)
            return null;
        const v = parseFloat(raw);
        return Number.isFinite(v) && v > 0 ? v : null;
    }, [purchaseForm.pricePerUnit]);
    const purchaseLineTotal = useMemo(() => {
        if (purchasePriceNum == null || purchaseQtyNum == null)
            return null;
        return purchasePriceNum * purchaseQtyNum;
    }, [purchasePriceNum, purchaseQtyNum]);
    const debtPreviewSo = useMemo(() => {
        if (purchaseLineTotal == null)
            return null;
        const payRaw = purchaseForm.paidAmount.trim().replace(',', '.');
        const paid = payRaw === '' ? 0 : Number.isFinite(parseFloat(payRaw)) ? Math.max(0, parseFloat(payRaw)) : null;
        if (paid == null)
            return null;
        return Math.max(0, purchaseLineTotal - paid);
    }, [purchaseLineTotal, purchaseForm.paidAmount]);
    useEffect(() => {
        if (!purchaseOpen || purchaseForm.onCredit || purchaseLineTotal == null)
            return;
        const next = String(Math.round(purchaseLineTotal * 100) / 100);
        setPurchaseForm((f) => (f.paidAmount === next ? f : { ...f, paidAmount: next }));
    }, [purchaseOpen, purchaseForm.onCredit, purchaseLineTotal]);
    const filteredHistory = useMemo(() => {
        let rows = state.supplierPurchases;
        if (historySupplierId !== '__all') {
            rows = rows.filter((p) => p.supplierId === historySupplierId);
        }
        const q = historySearch.trim().toLowerCase();
        if (q) {
            rows = rows.filter((p) => p.productName.toLowerCase().includes(q) ||
                p.supplierName.toLowerCase().includes(q) ||
                String(p.category).toLowerCase().includes(q));
        }
        return rows;
    }, [state.supplierPurchases, historySearch, historySupplierId]);
    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_SUPPLIER);
        setDialogOpen(true);
    };
    const openEdit = (supplier) => {
        setEditing(supplier);
        setForm({
            fullName: supplier.fullName,
            phone: supplier.phone,
            address: supplier.address,
            notes: supplier.notes ?? '',
        });
        setDialogOpen(true);
    };
    const openPurchaseDialog = () => {
        setPurchaseForm(EMPTY_PURCHASE);
        setPurchaseOpen(true);
    };
    const openSupplierPurchaseDetail = (s) => {
        setSupplierDetail(s);
        setSupplierDetailOpen(true);
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = {
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            notes: form.notes.trim() || undefined,
        };
        if (!trimmed.fullName || !trimmed.phone) {
            toast.error(t.required + ': ' + t.suppName + ' / ' + t.suppPhone);
            return;
        }
        if (editing) {
            updateSupplier({ ...editing, ...trimmed });
            toast.success(t.save);
        }
        else {
            addSupplier(trimmed);
            toast.success(t.add);
        }
        setDialogOpen(false);
        setForm(EMPTY_SUPPLIER);
        setEditing(null);
    };
    const handlePurchaseSubmit = (e) => {
        e.preventDefault();
        const supplier = state.suppliers.find((s) => s.id === purchaseForm.supplierId);
        if (!supplier) {
            toast.error(t.required + ': ' + t.suppPurchasePickSupplier);
            return;
        }
        if (!purchaseForm.parentWarehouseItemId) {
            toast.error(t.required + ': ' + t.suppPurchasePickParent);
            return;
        }
        const parent = state.warehouseItems.find((w) => w.id === purchaseForm.parentWarehouseItemId);
        if (!parent || parent.parentWarehouseId) {
            toast.error(t.required);
            return;
        }
        const qty = parseFloat(purchaseForm.quantity.replace(',', '.'));
        if (!Number.isFinite(qty) || qty <= 0) {
            toast.error(t.required);
            return;
        }
        const priceRaw = purchaseForm.pricePerUnit.trim().replace(',', '.');
        let purchasePricePerUnit;
        if (!priceRaw) {
            purchasePricePerUnit = null;
        }
        else {
            const v = parseFloat(priceRaw);
            if (!Number.isFinite(v) || v <= 0) {
                toast.error(t.whValidateOptionalPrice);
                return;
            }
            purchasePricePerUnit = v;
        }
        const lineTotal = purchasePricePerUnit != null && Number.isFinite(purchasePricePerUnit) && purchasePricePerUnit > 0
            ? purchasePricePerUnit * qty
            : null;
        let paidNum = null;
        if (lineTotal != null) {
            const payRaw = purchaseForm.paidAmount.trim().replace(',', '.');
            if (purchaseForm.onCredit && payRaw === '') {
                paidNum = 0;
            }
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
            const eps = 1e-4 * Math.max(1, lineTotal);
            if (!purchaseForm.onCredit) {
                if (Math.abs(paidNum - lineTotal) > eps) {
                    toast.error(t.suppPaidMustEqualTotal);
                    return;
                }
            }
            else if (paidNum > lineTotal + 1e-6) {
                toast.error(t.suppPaidExceedsTotal);
                return;
            }
        }
        const created = purchaseFromSupplier(supplier.id, {
            parentWarehouseItemId: purchaseForm.parentWarehouseItemId,
            quantity: qty,
            incomeDate: purchaseForm.incomeDate,
            notes: purchaseForm.notes.trim() || undefined,
            purchasePricePerUnit,
            paidAmount: lineTotal != null ? paidNum : undefined,
            onCredit: purchaseForm.onCredit,
        });
        if (!created) {
            if (parent.unit === 'pcs' &&
                Number.isFinite(qty) &&
                qty > 0 &&
                Math.abs(qty - Math.floor(qty)) > 1e-9) {
                toast.error(t.suppPurchasePcsWhole);
            }
            else {
                toast.error(t.required);
            }
            return;
        }
        toast.success(t.suppPurchaseSuccess);
        setPurchaseOpen(false);
        setPurchaseForm(EMPTY_PURCHASE);
    };
    const handleDelete = () => {
        if (!confirmDelete)
            return;
        deleteSupplier(confirmDelete.id);
        toast.success(t.delete);
        setConfirmDelete(null);
    };
    const openDebtRepay = (supplierId) => {
        const rem = getSupplierRemainingDebt(state, supplierId);
        setDebtRepaySupplierId(supplierId);
        setDebtRepayAmount(rem > 1e-6 ? String(Math.round(rem * 100) / 100) : '');
        setDebtRepayDate(TODAY);
        setDebtRepayNotes('');
        setDebtRepayOpen(true);
    };
    const handleDebtRepaySubmit = (e) => {
        e.preventDefault();
        if (!debtRepaySupplierId) {
            toast.error(t.required);
            return;
        }
        const max = getSupplierRemainingDebt(state, debtRepaySupplierId);
        const raw = debtRepayAmount.trim().replace(',', '.');
        if (!raw) {
            toast.error(t.required + ': ' + t.suppDebtPayAmount);
            return;
        }
        const amt = parseFloat(raw);
        if (!Number.isFinite(amt) || amt <= 0) {
            toast.error(t.whValidateOptionalPrice);
            return;
        }
        if (amt > max + 1e-6) {
            toast.error(t.suppDebtExceedsRemaining);
            return;
        }
        const row = recordSupplierDebtRepayment(debtRepaySupplierId, {
            amount: amt,
            date: debtRepayDate,
            notes: debtRepayNotes.trim() || undefined,
        });
        if (!row) {
            toast.error(t.suppDebtExceedsRemaining);
            return;
        }
        toast.success(t.suppDebtPaySuccess);
        setDebtRepayOpen(false);
        setDebtRepaySupplierId('');
        setDebtRepayAmount('');
        setDebtRepayNotes('');
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs(Tabs, { value: mainTab, onValueChange: (v) => setMainTab(v), className: "space-y-4", children: [_jsxs(TabsList, { className: "w-full overflow-x-auto sm:w-auto", children: [_jsxs(TabsTrigger, { value: "list", className: "flex-1 gap-1.5 sm:flex-none", children: [_jsx(Truck, { size: 14 }), t.suppTabSuppliers] }), _jsxs(TabsTrigger, { value: "history", className: "flex-1 gap-1.5 sm:flex-none", children: [_jsx(History, { size: 14 }), t.suppTabHistory, _jsx(Badge, { variant: "muted", className: "ml-0.5 text-[10px]", children: state.supplierPurchases.length })] }), _jsxs(TabsTrigger, { value: "debts", className: "flex-1 gap-1.5 sm:flex-none", children: [_jsx(Wallet, { size: 14 }), t.suppTabDebts, debtTabBadgeCount > 0 ? (_jsx(Badge, { variant: "danger", className: "ml-0.5 text-[10px]", children: debtTabBadgeCount })) : null] })] }), _jsxs(TabsContent, { value: "list", className: "mt-0 space-y-4", children: [_jsx(Card, { className: "border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/30", children: _jsx("p", { className: "text-sm text-indigo-900 dark:text-indigo-200", children: t.suppIntro }) }), _jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", children: [_jsxs("div", { className: "relative min-w-0 flex-1 sm:min-w-[12rem]", children: [_jsx(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: t.suppSearchPlaceholder, className: "pl-9" })] }), _jsxs("div", { className: "flex shrink-0 flex-wrap gap-2 sm:ml-auto", children: [_jsxs(Button, { type: "button", variant: "default", className: "flex-1 sm:flex-none", onClick: openPurchaseDialog, disabled: state.suppliers.length === 0 || parentWarehouseOptions.length === 0, title: parentWarehouseOptions.length === 0 ? t.suppNoParentProducts : undefined, children: [_jsx(ShoppingBag, { size: 16 }), t.suppPurchase] }), _jsxs(Button, { type: "button", onClick: openCreate, className: "flex-1 sm:flex-none", children: [_jsx(Plus, { size: 16 }), t.suppAdd] })] })] }) }), _jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.suppName }), _jsx(TableHead, { children: t.suppPhone }), _jsx(TableHead, { children: t.suppAddress }), _jsx(TableHead, { className: "text-right", children: t.actions })] }) }), _jsx(TableBody, { children: filtered.length === 0 ? (_jsx(TableEmpty, { colSpan: 4, message: t.noData })) : (filtered.map((s) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("button", { type: "button", className: "text-left font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300", onClick: () => openSupplierPurchaseDetail(s), children: s.fullName }) }), _jsx(TableCell, { className: "font-mono text-xs", children: s.phone }), _jsx(TableCell, { className: "max-w-[16rem] truncate text-slate-500 dark:text-slate-400", children: s.address || '—' }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "inline-flex flex-wrap items-center justify-end gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => openEdit(s), "aria-label": t.edit, children: _jsx(Pencil, { size: 14 }) }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => setConfirmDelete(s), "aria-label": t.delete, className: "hover:text-red-600 dark:hover:text-red-400", children: _jsx(Trash2, { size: 14 }) })] }) })] }, s.id)))) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: filtered.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.noData })) : (filtered.map((s) => (_jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white", children: _jsx(Truck, { size: 16 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("button", { type: "button", className: "truncate text-left text-sm font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300", onClick: () => openSupplierPurchaseDetail(s), children: s.fullName }), _jsxs("p", { className: "mt-1 flex items-center gap-1.5 text-xs text-slate-500", children: [_jsx(Phone, { size: 12, className: "text-slate-400" }), _jsx("span", { className: "font-mono", children: s.phone })] }), s.address && (_jsxs("p", { className: "mt-1 flex items-start gap-1.5 text-xs text-slate-500", children: [_jsx(MapPin, { size: 12, className: "mt-0.5 shrink-0 text-slate-400" }), _jsx("span", { className: "line-clamp-2", children: s.address })] }))] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700", children: [_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => openEdit(s), children: [_jsx(Pencil, { size: 14 }), t.edit] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setConfirmDelete(s), className: "hover:text-red-600", children: [_jsx(Trash2, { size: 14 }), t.delete] })] })] }, s.id)))) })] }), _jsxs(TabsContent, { value: "history", className: "mt-0 space-y-4", children: [_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end", children: [_jsxs("div", { className: "relative min-w-0 flex-1", children: [_jsx(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx(Input, { value: historySearch, onChange: (e) => setHistorySearch(e.target.value), placeholder: t.suppHistorySearch, className: "pl-9" })] }), _jsxs("div", { className: "w-full shrink-0 sm:w-56", children: [_jsx(Label, { className: "text-xs text-slate-500", children: t.suppHistoryFilterSupplier }), _jsxs(Select, { value: historySupplierId, onValueChange: setHistorySupplierId, children: [_jsx(SelectTrigger, { className: "mt-1", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__all", children: t.suppHistoryAllSuppliers }), state.suppliers.map((s) => (_jsx(SelectItem, { value: s.id, children: s.fullName }, s.id)))] })] })] })] }) }), _jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.suppHistoryColDate }), _jsx(TableHead, { children: t.suppHistoryColSupplier }), _jsx(TableHead, { children: t.suppHistoryColProduct }), _jsx(TableHead, { children: t.suppHistoryColCategory }), _jsx(TableHead, { className: "text-right", children: t.suppHistoryColQty }), _jsx(TableHead, { className: "text-right", children: t.suppHistoryColTotal }), _jsx(TableHead, { className: "text-right", children: t.suppHistoryColPaid }), _jsx(TableHead, { className: "text-right", children: t.suppHistoryColDebt })] }) }), _jsx(TableBody, { children: filteredHistory.length === 0 ? (_jsx(TableEmpty, { colSpan: 8, message: t.suppHistoryNoData })) : (filteredHistory.map((row) => {
                                                const meta = categoryMeta(row.category);
                                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "whitespace-nowrap text-xs text-slate-600 dark:text-slate-300", children: formatDate(row.incomeDate) }), _jsxs(TableCell, { className: "max-w-[10rem]", children: [_jsx("span", { className: "font-medium text-slate-800 dark:text-white", children: row.supplierName }), !row.supplierId && (_jsxs("span", { className: "ml-1 text-[10px] text-slate-400", children: ["(", t.suppHistoryDeletedSupplier, ")"] }))] }), _jsx(TableCell, { className: "font-medium text-slate-800 dark:text-white", children: row.productName }), _jsx(TableCell, { children: _jsxs(Badge, { className: meta.badge, children: [meta.emoji, " ", categoryLabel(row.category, t)] }) }), _jsxs(TableCell, { className: `nums text-right font-semibold ${meta.text}`, children: [formatNumber(row.quantity), " ", row.unit] }), _jsx(TableCell, { className: "nums text-right text-slate-600 dark:text-slate-300", children: row.totalAmount != null && row.totalAmount > 0
                                                                ? `${formatNumber(row.totalAmount)} so'm`
                                                                : '—' }), _jsx(TableCell, { className: "nums text-right text-slate-600 dark:text-slate-300", children: row.paidAmount != null ? `${formatNumber(row.paidAmount)} so'm` : '—' }), _jsx(TableCell, { className: "nums text-right text-amber-700 dark:text-amber-300", children: row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6
                                                                ? `${formatNumber(row.supplierDebtAmount)} so'm`
                                                                : '—' })] }, row.id));
                                            })) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: filteredHistory.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.suppHistoryNoData })) : (filteredHistory.map((row) => {
                                    const meta = categoryMeta(row.category);
                                    return (_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg} text-lg`, children: _jsx("span", { children: meta.emoji }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-semibold text-slate-800 dark:text-white", children: row.productName }), _jsxs("p", { className: "mt-0.5 text-xs text-slate-500", children: [row.supplierName, !row.supplierId && (_jsxs("span", { className: "text-slate-400", children: [" \u00B7 ", t.suppHistoryDeletedSupplier] }))] }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2", children: [_jsx(Badge, { className: meta.badge, children: categoryLabel(row.category, t) }), _jsx("span", { className: "text-[11px] text-slate-400", children: formatDate(row.incomeDate) })] }), _jsxs("p", { className: `mt-2 nums text-base font-bold ${meta.text}`, children: [formatNumber(row.quantity), " ", row.unit] }), row.totalAmount != null && row.totalAmount > 0 && (_jsxs("p", { className: "mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400", children: [t.suppLineTotal, ": ", formatNumber(row.totalAmount), " so'm"] })), row.paidAmount != null && (_jsxs("p", { className: "mt-0.5 text-xs text-slate-600 dark:text-slate-400", children: [t.suppHistoryColPaid, ": ", formatNumber(row.paidAmount), " so'm"] })), row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6 && (_jsxs("p", { className: "mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300", children: [t.suppHistoryColDebt, ": ", formatNumber(row.supplierDebtAmount), " so'm"] })), row.onCredit && row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6 && (_jsx(Badge, { variant: "outline", className: "mt-1 text-[10px]", children: t.suppHistoryColDebt }))] })] }) }, row.id));
                                })) })] }), _jsxs(TabsContent, { value: "debts", className: "mt-0 space-y-4", children: [_jsx(Card, { className: "border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/25", children: _jsx("p", { className: "text-sm text-amber-950 dark:text-amber-100", children: t.suppDebtIntro }) }), getOrphanSupplierDebtIncurred(state) > 1e-6 && (_jsx(Card, { className: "border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-800 dark:bg-amber-950/40", children: _jsxs("p", { className: "text-sm text-amber-900 dark:text-amber-100", children: [t.suppDebtOrphanBanner, ' ', _jsxs("span", { className: "nums font-semibold", children: [formatNumber(getOrphanSupplierDebtIncurred(state)), " so'm"] })] }) })), state.suppliers.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.suppDebtNoSuppliers })) : (_jsxs(_Fragment, { children: [_jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.suppName }), _jsx(TableHead, { children: t.suppPhone }), _jsx(TableHead, { className: "text-right", children: t.suppDebtColRemaining }), _jsx(TableHead, { className: "text-right", children: t.actions })] }) }), _jsx(TableBody, { children: state.suppliers.map((s) => {
                                                        const rem = getSupplierRemainingDebt(state, s.id);
                                                        return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium text-slate-800 dark:text-white", children: s.fullName }), _jsx(TableCell, { className: "font-mono text-xs", children: s.phone }), _jsx(TableCell, { className: `nums text-right font-semibold ${rem > 1e-6 ? 'text-amber-800 dark:text-amber-200' : 'text-slate-400'}`, children: rem > 1e-6 ? `${formatNumber(rem)} so'm` : '—' }), _jsx(TableCell, { className: "text-right", children: _jsx(Button, { type: "button", size: "sm", variant: "secondary", disabled: rem <= 1e-6, onClick: () => openDebtRepay(s.id), children: t.suppDebtPayBtn }) })] }, s.id));
                                                    }) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: state.suppliers.map((s) => {
                                            const rem = getSupplierRemainingDebt(state, s.id);
                                            return (_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-semibold text-slate-800 dark:text-white", children: s.fullName }), _jsxs("p", { className: "mt-1 flex items-center gap-1.5 text-xs text-slate-500", children: [_jsx(Phone, { size: 12, className: "shrink-0 text-slate-400" }), _jsx("span", { className: "font-mono", children: s.phone })] }), _jsxs("p", { className: `mt-2 nums text-sm ${rem > 1e-6 ? 'font-bold text-amber-800 dark:text-amber-200' : 'text-slate-400'}`, children: [t.suppDebtColRemaining, ": ", rem > 1e-6 ? `${formatNumber(rem)} so'm` : '—'] })] }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", className: "shrink-0", disabled: rem <= 1e-6, onClick: () => openDebtRepay(s.id), children: t.suppDebtPayBtn })] }) }, s.id));
                                        }) })] })), _jsxs(Card, { className: "hidden overflow-hidden md:block", children: [_jsx("div", { className: "border-b border-slate-100 px-4 py-3 dark:border-slate-800", children: _jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.suppDebtRepayHistory }) }), _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.suppDebtRepayColDate }), _jsx(TableHead, { children: t.suppDebtRepayColSupplier }), _jsx(TableHead, { className: "text-right", children: t.suppDebtRepayColAmount })] }) }), _jsx(TableBody, { children: sortedDebtRepayments.length === 0 ? (_jsx(TableEmpty, { colSpan: 3, message: t.suppHistoryNoData })) : (sortedDebtRepayments.map((r) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "whitespace-nowrap text-xs text-slate-600 dark:text-slate-300", children: formatDate(r.date) }), _jsx(TableCell, { className: "font-medium text-slate-800 dark:text-white", children: r.supplierName }), _jsxs(TableCell, { className: "nums text-right font-semibold text-emerald-700 dark:text-emerald-300", children: [formatNumber(r.amount), " so'm"] })] }, r.id)))) })] })] }), _jsxs("div", { className: "space-y-3 md:hidden", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.suppDebtRepayHistory }), sortedDebtRepayments.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.suppHistoryNoData })) : (sortedDebtRepayments.map((r) => (_jsxs(Card, { className: "p-4", children: [_jsx("p", { className: "text-sm font-medium text-slate-800 dark:text-white", children: r.supplierName }), _jsx("p", { className: "mt-1 text-[11px] text-slate-500", children: formatDate(r.date) }), _jsxs("p", { className: "mt-2 nums text-base font-bold text-emerald-700 dark:text-emerald-300", children: [formatNumber(r.amount), " so'm"] }), r.notes && _jsx("p", { className: "mt-1 text-xs text-slate-500", children: r.notes })] }, r.id))))] })] })] }), _jsx(Dialog, { open: dialogOpen, onOpenChange: setDialogOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: editing ? t.suppEdit : t.suppAdd }), _jsx(DialogDescription, {})] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.suppName, " *"] }), _jsx(Input, { value: form.fullName, onChange: (e) => setForm((f) => ({ ...f, fullName: e.target.value })), className: "mt-1.5", autoFocus: true })] }), _jsxs("div", { children: [_jsxs(Label, { children: [t.suppPhone, " *"] }), _jsx(Input, { value: form.phone, onChange: (e) => setForm((f) => ({ ...f, phone: e.target.value })), className: "mt-1.5" })] }), _jsxs("div", { children: [_jsx(Label, { children: t.suppAddress }), _jsx(Input, { value: form.address, onChange: (e) => setForm((f) => ({ ...f, address: e.target.value })), className: "mt-1.5" })] }), _jsxs("div", { children: [_jsx(Label, { children: t.notes }), _jsx(Input, { value: form.notes, onChange: (e) => setForm((f) => ({ ...f, notes: e.target.value })), className: "mt-1.5" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setDialogOpen(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.save })] })] })] }) }), _jsx(Dialog, { open: purchaseOpen, onOpenChange: (open) => {
                    setPurchaseOpen(open);
                    if (!open)
                        setPurchaseForm(EMPTY_PURCHASE);
                }, children: _jsxs(DialogContent, { className: "max-h-[90vh] overflow-y-auto sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t.suppPurchaseTitle }), _jsxs(DialogDescription, { className: "space-y-2 text-pretty", children: [purchaseSelectedSupplier ? (_jsx("span", { className: "font-medium text-slate-800 dark:text-slate-100", children: purchaseSelectedSupplier.fullName })) : null, purchaseSelectedParent ? (_jsx("span", { className: "block font-medium text-slate-800 dark:text-slate-100", children: purchaseSelectedParent.productName })) : null, _jsx("span", { className: "block", children: t.suppPurchaseDesc }), _jsx("span", { className: "block text-slate-600 dark:text-slate-300", children: t.suppPurchaseParentNote })] })] }), _jsxs("form", { onSubmit: handlePurchaseSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.suppPurchasePickSupplier, " *"] }), _jsxs(Select, { value: purchaseForm.supplierId || undefined, onValueChange: (v) => setPurchaseForm((f) => ({ ...f, supplierId: v })), children: [_jsx(SelectTrigger, { className: "mt-1.5", children: _jsx(SelectValue, { placeholder: t.suppPurchasePickSupplier }) }), _jsx(SelectContent, { children: state.suppliers.map((s) => (_jsx(SelectItem, { value: s.id, children: s.fullName }, s.id))) })] })] }), _jsxs("div", { children: [_jsxs(Label, { children: [t.suppPurchasePickParent, " *"] }), parentWarehouseOptions.length === 0 ? (_jsx("p", { className: "mt-2 text-sm text-amber-700 dark:text-amber-300", children: t.suppNoParentProducts })) : (_jsxs(Select, { value: purchaseForm.parentWarehouseItemId || undefined, onValueChange: (v) => {
                                                const w = state.warehouseItems.find((x) => x.id === v);
                                                const pref = w?.purchasePricePerUnit != null &&
                                                    Number.isFinite(w.purchasePricePerUnit) &&
                                                    w.purchasePricePerUnit > 0
                                                    ? String(w.purchasePricePerUnit)
                                                    : '';
                                                setPurchaseForm((f) => ({
                                                    ...f,
                                                    parentWarehouseItemId: v,
                                                    pricePerUnit: pref,
                                                }));
                                            }, children: [_jsx(SelectTrigger, { className: "mt-1.5", children: _jsx(SelectValue, { placeholder: t.suppPurchasePickParent }) }), _jsx(SelectContent, { className: "max-h-72", children: parentWarehouseOptions.map((w) => (_jsxs(SelectItem, { value: w.id, children: [w.productName, " (", formatNumber(w.currentQty), " ", w.unit, ")"] }, w.id))) })] })), purchaseSelectedParent && (_jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [_jsxs(Badge, { className: categoryMeta(purchaseSelectedParent.category).badge, children: [categoryMeta(purchaseSelectedParent.category).emoji, ' ', categoryLabel(purchaseSelectedParent.category, t)] }), _jsxs("span", { className: "text-xs text-slate-500", children: [t.unit, ": ", purchaseSelectedParent.unit === 'kg' ? 'kg' : t.unitPcs] })] }))] }), _jsxs("div", { children: [_jsxs(Label, { children: [t.whQuantity, " *"] }), _jsx(Input, { value: purchaseForm.quantity, onChange: (e) => setPurchaseForm((f) => ({ ...f, quantity: e.target.value })), className: "mt-1.5", inputMode: "decimal" }), purchaseSelectedParent?.unit === 'pcs' && (_jsx("p", { className: "mt-1 text-xs text-slate-500", children: t.suppPurchasePcsWhole }))] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { children: t.whIncomeDate }), _jsx(Input, { type: "date", value: purchaseForm.incomeDate, onChange: (e) => setPurchaseForm((f) => ({ ...f, incomeDate: e.target.value })), className: "mt-1.5" })] }), _jsxs("div", { children: [_jsx(Label, { children: t.suppPricePerUnit }), _jsx(Input, { value: purchaseForm.pricePerUnit, onChange: (e) => setPurchaseForm((f) => ({ ...f, pricePerUnit: e.target.value })), className: "mt-1.5", placeholder: "\u2014", inputMode: "decimal" })] })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40", children: [_jsx("p", { className: "text-xs text-slate-500", children: t.suppLineTotal }), _jsx("p", { className: "nums text-lg font-semibold text-slate-900 dark:text-slate-100", children: purchaseLineTotal != null ? `${formatNumber(purchaseLineTotal)} so'm` : '—' })] }), _jsxs("div", { children: [_jsxs(Label, { children: [t.suppPaidAmount, purchaseLineTotal != null ? ' *' : ''] }), _jsx(Input, { value: purchaseForm.paidAmount, onChange: (e) => setPurchaseForm((f) => ({ ...f, paidAmount: e.target.value })), className: "mt-1.5", placeholder: "0", inputMode: "decimal", disabled: purchaseLineTotal == null || !purchaseForm.onCredit }), purchaseForm.onCredit && purchaseLineTotal != null && debtPreviewSo != null && (_jsxs("p", { className: "mt-1 text-xs font-medium text-amber-800 dark:text-amber-200", children: [t.suppDebtPreview, ": ", formatNumber(debtPreviewSo), " so'm"] }))] }), _jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700", children: [_jsx("input", { type: "checkbox", className: "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600", checked: purchaseForm.onCredit, onChange: (e) => setPurchaseForm((f) => ({ ...f, onCredit: e.target.checked })) }), _jsx("span", { className: "text-sm leading-snug text-slate-700 dark:text-slate-300", children: t.suppOnCredit })] }), _jsxs("div", { children: [_jsx(Label, { children: t.notes }), _jsx(Input, { value: purchaseForm.notes, onChange: (e) => setPurchaseForm((f) => ({ ...f, notes: e.target.value })), className: "mt-1.5" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setPurchaseOpen(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.suppPurchaseSubmit })] })] })] }) }), _jsx(Dialog, { open: debtRepayOpen, onOpenChange: (open) => {
                    setDebtRepayOpen(open);
                    if (!open) {
                        setDebtRepaySupplierId('');
                        setDebtRepayAmount('');
                        setDebtRepayDate(TODAY);
                        setDebtRepayNotes('');
                    }
                }, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t.suppDebtPayDialogTitle }), _jsxs(DialogDescription, { className: "space-y-2", children: [_jsx("span", { className: "block font-medium text-slate-800 dark:text-slate-100", children: state.suppliers.find((s) => s.id === debtRepaySupplierId)?.fullName ?? '' }), _jsxs("span", { className: "block text-sm text-slate-600 dark:text-slate-300", children: [t.suppDebtColRemaining, ":", ' ', _jsxs("span", { className: "nums font-semibold text-amber-800 dark:text-amber-200", children: [formatNumber(debtRepayRemaining), " so'm"] })] })] })] }), _jsxs("form", { onSubmit: handleDebtRepaySubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.suppDebtPayAmount, " *"] }), _jsx(Input, { value: debtRepayAmount, onChange: (e) => setDebtRepayAmount(e.target.value), className: "mt-1.5", inputMode: "decimal", autoFocus: true })] }), _jsxs("div", { children: [_jsx(Label, { children: t.suppDebtPayDate }), _jsx(Input, { type: "date", value: debtRepayDate, onChange: (e) => setDebtRepayDate(e.target.value), className: "mt-1.5" })] }), _jsxs("div", { children: [_jsx(Label, { children: t.suppDebtPayNotes }), _jsx(Input, { value: debtRepayNotes, onChange: (e) => setDebtRepayNotes(e.target.value), className: "mt-1.5" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setDebtRepayOpen(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.suppDebtPaySubmit })] })] })] }) }), _jsx(Dialog, { open: supplierDetailOpen, onOpenChange: (open) => {
                    setSupplierDetailOpen(open);
                    if (!open)
                        setSupplierDetail(null);
                }, children: _jsxs(DialogContent, { className: "max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: supplierDetail?.fullName ?? '' }), _jsx(DialogDescription, { children: t.suppSupplierPurchasesDialogDesc })] }), _jsx("div", { className: "hidden max-h-[min(55vh,28rem)] overflow-auto md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.suppHistoryColDate }), _jsx(TableHead, { children: t.suppHistoryColProduct }), _jsx(TableHead, { children: t.suppHistoryColCategory }), _jsx(TableHead, { className: "text-right", children: t.suppHistoryColQty }), _jsx(TableHead, { className: "text-right", children: t.suppHistoryColTotal }), _jsx(TableHead, { className: "text-right", children: t.suppHistoryColPaid }), _jsx(TableHead, { className: "text-right", children: t.suppHistoryColDebt })] }) }), _jsx(TableBody, { children: supplierDetailPurchases.length === 0 ? (_jsx(TableEmpty, { colSpan: 7, message: t.suppHistoryNoData })) : (supplierDetailPurchases.map((row) => {
                                            const meta = categoryMeta(row.category);
                                            return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "whitespace-nowrap text-xs text-slate-600 dark:text-slate-300", children: formatDate(row.incomeDate) }), _jsx(TableCell, { className: "font-medium text-slate-800 dark:text-white", children: row.productName }), _jsx(TableCell, { children: _jsxs(Badge, { className: meta.badge, children: [meta.emoji, " ", categoryLabel(row.category, t)] }) }), _jsxs(TableCell, { className: `nums text-right font-semibold ${meta.text}`, children: [formatNumber(row.quantity), " ", row.unit] }), _jsx(TableCell, { className: "nums text-right text-slate-600 dark:text-slate-300", children: row.totalAmount != null && row.totalAmount > 0
                                                            ? `${formatNumber(row.totalAmount)} so'm`
                                                            : '—' }), _jsx(TableCell, { className: "nums text-right text-slate-600 dark:text-slate-300", children: row.paidAmount != null ? `${formatNumber(row.paidAmount)} so'm` : '—' }), _jsx(TableCell, { className: "nums text-right text-amber-700 dark:text-amber-300", children: row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6
                                                            ? `${formatNumber(row.supplierDebtAmount)} so'm`
                                                            : '—' })] }, row.id));
                                        })) })] }) }), _jsx("div", { className: "max-h-[min(50vh,24rem)] space-y-3 overflow-y-auto md:hidden", children: supplierDetailPurchases.length === 0 ? (_jsx("p", { className: "py-6 text-center text-sm text-slate-400", children: t.suppHistoryNoData })) : (supplierDetailPurchases.map((row) => {
                                const meta = categoryMeta(row.category);
                                return (_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg} text-lg`, children: _jsx("span", { children: meta.emoji }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-semibold text-slate-800 dark:text-white", children: row.productName }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2", children: [_jsx(Badge, { className: meta.badge, children: categoryLabel(row.category, t) }), _jsx("span", { className: "text-[11px] text-slate-400", children: formatDate(row.incomeDate) })] }), _jsxs("p", { className: `mt-2 nums text-base font-bold ${meta.text}`, children: [formatNumber(row.quantity), " ", row.unit] }), row.totalAmount != null && row.totalAmount > 0 && (_jsxs("p", { className: "mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400", children: [t.suppLineTotal, ": ", formatNumber(row.totalAmount), " so'm"] })), row.paidAmount != null && (_jsxs("p", { className: "mt-0.5 text-xs text-slate-600 dark:text-slate-400", children: [t.suppHistoryColPaid, ": ", formatNumber(row.paidAmount), " so'm"] })), row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6 && (_jsxs("p", { className: "mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300", children: [t.suppHistoryColDebt, ": ", formatNumber(row.supplierDebtAmount), " so'm"] }))] })] }) }, row.id));
                            })) }), _jsxs(DialogFooter, { className: "flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setSupplierDetailOpen(false), children: t.cancel }), supplierDetail ? (_jsxs(Button, { type: "button", variant: "secondary", className: "gap-1.5", onClick: () => {
                                        setSupplierDetailOpen(false);
                                        setMainTab('history');
                                        setHistorySupplierId(supplierDetail.id);
                                    }, children: [_jsx(History, { size: 16 }), t.suppOpenInHistoryTab] })) : null] })] }) }), _jsx(AlertDialog, { open: Boolean(confirmDelete), onOpenChange: () => setConfirmDelete(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.suppDeleteConfirm }), _jsx(AlertDialogDescription, { children: confirmDelete?.fullName })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDelete, children: t.confirm })] })] }) })] }));
}
