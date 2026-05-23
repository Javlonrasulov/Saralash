import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Package, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store/saralash-store';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter } from '../lib/nav-date-range';
import { useApp } from '../i18n/app-context';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, } from '../components/ui/table';
import { categoryLabel, categoryMeta, CategoryIconGlyph, CategoryProductIcon, PRODUCT_ICON_PICKER_GROUPS, PRODUCT_ICON_PICKER_OPTIONS, productIconLabel, productIconPickerLabel, resolveProductIconKey, warehouseDisplayIconId, } from '../utils/category';
import { formatDate, formatNumber, TODAY, uid } from '../utils/format';
import { cn } from '../components/ui/utils';
function formatWarehouseUnitPrice(n) {
    if (n == null || !Number.isFinite(n))
        return '—';
    return `${formatNumber(n)} so'm`;
}
/** Jadvalda avval ota, keyin uning bolalari. */
function orderWarehouseRows(items) {
    const seen = new Set();
    const out = [];
    const roots = items
        .filter((w) => !w.parentWarehouseId)
        .sort((a, b) => b.incomeDate.localeCompare(a.incomeDate) || a.productName.localeCompare(b.productName));
    for (const r of roots) {
        if (seen.has(r.id))
            continue;
        seen.add(r.id);
        out.push(r);
        const kids = items
            .filter((w) => w.parentWarehouseId === r.id)
            .sort((a, b) => a.productName.localeCompare(b.productName));
        for (const k of kids) {
            if (seen.has(k.id))
                continue;
            seen.add(k.id);
            out.push(k);
        }
    }
    for (const w of items) {
        if (!seen.has(w.id))
            out.push(w);
    }
    return out;
}
const EMPTY_PRODUCT = {
    productName: '',
    category: '',
    productIconKey: 'other',
    unit: 'kg',
    initialQty: '',
    incomeDate: TODAY,
    purchasePrice: '',
    salePrice: '',
    notes: '',
};
function parseOptionalMoney(raw) {
    const s = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (s === '')
        return { ok: true, value: null };
    const n = parseFloat(s);
    if (!Number.isFinite(n) || n < 0)
        return { ok: false };
    return { ok: true, value: n };
}
function ProductDialog({ open, onOpenChange, editing, categorySuggestions, }) {
    const { addWarehouseItemWithSplits, appendWarehouseSplitsToParent, updateWarehouseItem } = useStore();
    const { t } = useApp();
    const [form, setForm] = useState(EMPTY_PRODUCT);
    const [splits, setSplits] = useState([]);
    const [iconLocked, setIconLocked] = useState(false);
    React.useEffect(() => {
        if (open) {
            setSplits([]);
            setIconLocked(false);
            if (editing) {
                const hasSavedIcon = Boolean(editing.productIconKey?.trim());
                setIconLocked(hasSavedIcon);
                setForm({
                    productName: editing.productName,
                    category: editing.category,
                    productIconKey: warehouseDisplayIconId(editing),
                    unit: editing.unit,
                    initialQty: String(editing.initialQty),
                    incomeDate: editing.incomeDate,
                    purchasePrice: editing.purchasePricePerUnit != null && Number.isFinite(editing.purchasePricePerUnit)
                        ? String(editing.purchasePricePerUnit)
                        : '',
                    salePrice: editing.salePricePerUnit != null && Number.isFinite(editing.salePricePerUnit)
                        ? String(editing.salePricePerUnit)
                        : '',
                    notes: editing.notes ?? '',
                });
            }
            else {
                setForm(EMPTY_PRODUCT);
            }
        }
    }, [open, editing]);
    const parseParentQty = () => {
        const raw = form.initialQty.trim();
        if (raw === '')
            return 0;
        const n = parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(n))
            return Number.NaN;
        return form.unit === 'pcs' ? Math.max(0, Math.floor(n)) : Math.max(0, n);
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        const category = form.category.trim();
        if (!form.productName.trim()) {
            toast.error(t.whValidateProductName);
            return;
        }
        if (!category) {
            toast.error(t.whValidateCategory);
            return;
        }
        const parsedPurchase = parseOptionalMoney(form.purchasePrice);
        const parsedSale = parseOptionalMoney(form.salePrice);
        if (!parsedPurchase.ok || !parsedSale.ok) {
            toast.error(t.whValidateOptionalPrice);
            return;
        }
        if (editing) {
            if (editing.parentWarehouseId) {
                let nextInitial = editing.initialQty;
                let nextCurrent = editing.currentQty;
                const qtyRaw = form.initialQty.trim();
                if (qtyRaw !== '') {
                    const n = parseFloat(qtyRaw.replace(',', '.'));
                    if (!Number.isFinite(n) || n < 0) {
                        toast.error(t.whValidateQtyPositive);
                        return;
                    }
                    const parentQty = form.unit === 'pcs' ? Math.max(0, Math.floor(n)) : Math.max(0, n);
                    nextInitial = parentQty;
                    nextCurrent = editing.currentQty + (parentQty - editing.initialQty);
                }
                updateWarehouseItem({
                    ...editing,
                    productName: form.productName.trim(),
                    category: category,
                    productIconKey: form.productIconKey,
                    unit: form.unit,
                    initialQty: nextInitial,
                    currentQty: nextCurrent,
                    incomeDate: form.incomeDate,
                    notes: form.notes.trim() || undefined,
                    purchasePricePerUnit: parsedPurchase.value,
                    salePricePerUnit: parsedSale.value,
                });
                toast.success(t.save);
            }
            else {
                let nextInitial = editing.initialQty;
                let nextCurrent = editing.currentQty;
                const qtyRaw = form.initialQty.trim();
                if (qtyRaw !== '') {
                    const n = parseFloat(qtyRaw.replace(',', '.'));
                    if (!Number.isFinite(n) || n < 0) {
                        toast.error(t.whValidateQtyPositive);
                        return;
                    }
                    const parentQty = form.unit === 'pcs' ? Math.max(0, Math.floor(n)) : Math.max(0, n);
                    nextInitial = parentQty;
                    nextCurrent = editing.currentQty + (parentQty - editing.initialQty);
                }
                const parsedSplits = [];
                for (const row of splits) {
                    const nm = row.name.trim();
                    const qRaw = row.qty.trim() === '' ? 0 : parseFloat(row.qty.replace(',', '.'));
                    const q = form.unit === 'pcs' ? Math.floor(qRaw) : qRaw;
                    if (!nm && (!Number.isFinite(q) || q === 0))
                        continue;
                    if (!nm && Number.isFinite(q) && q > 0) {
                        toast.error(t.whValidateSubName);
                        return;
                    }
                    if (nm && (!Number.isFinite(q) || q < 0)) {
                        toast.error(t.whValidateAllocateQty);
                        return;
                    }
                    if (nm)
                        parsedSplits.push({ productName: nm, quantity: Math.max(0, q) });
                }
                const sumSplits = parsedSplits.reduce((s, x) => s + x.quantity, 0);
                if (nextCurrent > 0 && sumSplits > nextCurrent + 1e-9) {
                    toast.error(t.whSplitsExceedParent);
                    return;
                }
                const updatedParent = {
                    ...editing,
                    productName: form.productName.trim(),
                    category: category,
                    productIconKey: form.productIconKey,
                    unit: form.unit,
                    initialQty: nextInitial,
                    currentQty: nextCurrent,
                    incomeDate: form.incomeDate,
                    notes: form.notes.trim() || undefined,
                    purchasePricePerUnit: parsedPurchase.value,
                    salePricePerUnit: parsedSale.value,
                };
                if (parsedSplits.length > 0) {
                    appendWarehouseSplitsToParent(updatedParent, parsedSplits);
                }
                else {
                    updateWarehouseItem(updatedParent);
                }
                toast.success(t.save);
            }
        }
        else {
            const parentQty = parseParentQty();
            if (!Number.isFinite(parentQty) || parentQty < 0) {
                toast.error(t.whValidateQtyPositive);
                return;
            }
            const parsedSplits = [];
            for (const row of splits) {
                const nm = row.name.trim();
                const qRaw = row.qty.trim() === '' ? 0 : parseFloat(row.qty.replace(',', '.'));
                const q = form.unit === 'pcs' ? Math.floor(qRaw) : qRaw;
                if (!nm && (!Number.isFinite(q) || q === 0))
                    continue;
                if (!nm && Number.isFinite(q) && q > 0) {
                    toast.error(t.whValidateSubName);
                    return;
                }
                if (nm && (!Number.isFinite(q) || q < 0)) {
                    toast.error(t.whValidateAllocateQty);
                    return;
                }
                if (nm)
                    parsedSplits.push({ productName: nm, quantity: Math.max(0, q) });
            }
            const sumSplits = parsedSplits.reduce((s, x) => s + x.quantity, 0);
            if (parentQty > 0 && sumSplits > parentQty + 1e-9) {
                toast.error(t.whSplitsExceedParent);
                return;
            }
            addWarehouseItemWithSplits({
                productName: form.productName.trim(),
                category: category,
                productIconKey: form.productIconKey,
                unit: form.unit,
                initialQty: parentQty,
                incomeDate: form.incomeDate,
                notes: form.notes.trim() || undefined,
                source: 'EXTERNAL',
                parentWarehouseId: null,
                purchasePricePerUnit: parsedPurchase.value,
                salePricePerUnit: parsedSale.value,
            }, parsedSplits);
            toast.success(t.add);
        }
        onOpenChange(false);
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[90vh] overflow-y-auto sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: editing ? t.whEditProduct : t.whAddProduct }), _jsx(DialogDescription, { className: editing ? '' : 'text-pretty', children: !editing ? t.whAddExternalHint : null })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.whProductName, " *"] }), _jsx(Input, { value: form.productName, onChange: (e) => setForm((f) => ({ ...f, productName: e.target.value })), className: "mt-1.5", placeholder: "Press qog'oz", autoFocus: true })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.whCategory, " *"] }), _jsx(Input, { list: "warehouse-category-suggestions", value: form.category, onChange: (e) => setForm((f) => ({ ...f, category: e.target.value })), onBlur: () => {
                                                const cat = form.category.trim();
                                                if (!iconLocked && cat) {
                                                    setForm((f) => ({
                                                        ...f,
                                                        productIconKey: resolveProductIconKey(cat),
                                                    }));
                                                }
                                            }, className: "mt-1.5", placeholder: t.whCategoryPlaceholder, autoComplete: "off" }), _jsx("datalist", { id: "warehouse-category-suggestions", children: categorySuggestions.map((c) => (_jsx("option", { value: c }, c))) })] }), _jsxs("div", { children: [_jsx(Label, { children: t.unit }), _jsxs(Select, { value: form.unit, onValueChange: (v) => setForm((f) => ({ ...f, unit: v })), children: [_jsx(SelectTrigger, { className: "mt-1.5", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "kg", children: "kg" }), _jsx(SelectItem, { value: "pcs", children: "dona" })] })] })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t.whProductIcon }), _jsx("p", { className: "mt-0.5 text-[11px] text-slate-500 dark:text-slate-400", children: t.whProductIconHint }), _jsx("div", { className: "mt-2 max-h-64 space-y-3 overflow-y-auto overscroll-contain pr-1", children: PRODUCT_ICON_PICKER_GROUPS.map((group) => (_jsxs("div", { children: [_jsx("p", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400", children: productIconLabel(group, t) }), _jsx("div", { className: "grid grid-cols-3 gap-2 sm:grid-cols-4", children: PRODUCT_ICON_PICKER_OPTIONS.filter((o) => o.group === group).map((opt) => {
                                                    const selected = form.productIconKey === opt.id;
                                                    return (_jsxs("button", { type: "button", title: productIconPickerLabel(opt.id, t), onClick: () => {
                                                            setIconLocked(true);
                                                            setForm((f) => ({ ...f, productIconKey: opt.id }));
                                                        }, className: cn('flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors', selected
                                                            ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/30 dark:border-violet-400 dark:bg-violet-950/40'
                                                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'), children: [_jsx(CategoryProductIcon, { iconKey: opt.id, size: "lg" }), _jsx("span", { className: "max-w-full truncate text-center text-[9px] leading-tight text-slate-500 dark:text-slate-400", children: productIconPickerLabel(opt.id, t) })] }, opt.id));
                                                }) })] }, group))) })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.whQuantity, editing ? '' : ' *'] }), _jsx(Input, { value: form.initialQty, onChange: (e) => setForm((f) => ({ ...f, initialQty: e.target.value })), placeholder: "0", inputMode: "decimal", className: "mt-1.5" }), _jsx("p", { className: "mt-1 text-[11px] text-slate-500 dark:text-slate-400", children: editing ? t.whQtyOptionalWhenEdit : t.whValidateQtyPositive })] }), _jsxs("div", { children: [_jsx(Label, { children: t.whIncomeDate }), _jsx(Input, { type: "date", value: form.incomeDate, onChange: (e) => setForm((f) => ({ ...f, incomeDate: e.target.value })), className: "mt-1.5" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { children: t.whPurchasePricePerUnit }), _jsx(Input, { value: form.purchasePrice, onChange: (e) => setForm((f) => ({ ...f, purchasePrice: e.target.value })), placeholder: "0", inputMode: "decimal", className: "mt-1.5" })] }), _jsxs("div", { children: [_jsx(Label, { children: t.whSalePricePerUnit }), _jsx(Input, { value: form.salePrice, onChange: (e) => setForm((f) => ({ ...f, salePrice: e.target.value })), placeholder: "0", inputMode: "decimal", className: "mt-1.5" })] })] }), (!editing || (editing && !editing.parentWarehouseId)) && (_jsxs("div", { className: "rounded-lg border border-slate-200 p-3 dark:border-slate-600", children: [_jsxs("div", { className: "mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsx(Label, { className: "text-sm font-medium", children: t.whSplitsSection }), _jsx(Button, { type: "button", variant: "outline", size: "sm", className: "shrink-0", onClick: () => setSplits((s) => [...s, { id: uid('spl'), name: '', qty: '' }]), children: t.whAddSplitRow })] }), _jsx("p", { className: "mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400", children: editing && !editing.parentWarehouseId ? t.whSplitsOnEditParent : t.whWhereSubcategoryHint }), splits.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400 dark:text-slate-500", children: t.whSplitsEmpty })) : (_jsx("div", { className: "space-y-2", children: splits.map((row) => (_jsxs("div", { className: "flex flex-wrap items-end gap-2", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx(Label, { className: "text-xs", children: t.whSubProductName }), _jsx(Input, { value: row.name, onChange: (e) => setSplits((s) => s.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r))), className: "mt-1", placeholder: t.whCategoryPlaceholder })] }), _jsxs("div", { className: "w-28", children: [_jsx(Label, { className: "text-xs", children: t.whQuantity }), _jsx(Input, { value: row.qty, onChange: (e) => setSplits((s) => s.map((r) => (r.id === row.id ? { ...r, qty: e.target.value } : r))), className: "mt-1", placeholder: "0", inputMode: "decimal" })] }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "mb-0.5 shrink-0 text-red-600 hover:text-red-700", onClick: () => setSplits((s) => s.filter((r) => r.id !== row.id)), children: t.whRemoveSplitRow })] }, row.id))) }))] })), _jsxs("div", { children: [_jsx(Label, { children: t.notes }), _jsx(Input, { value: form.notes, onChange: (e) => setForm((f) => ({ ...f, notes: e.target.value })), className: "mt-1.5" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.save })] })] })] }) }));
}
// ============================================================================
// MAIN
// ============================================================================
export function Warehouse() {
    const { state, deleteWarehouseItem, addWarehouseChildQty } = useStore();
    const { t } = useApp();
    const { filter: navDateFilter } = useNavDateFilter();
    const [tab, setTab] = useState('stock');
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('__all');
    const categoryFilterOptions = useMemo(() => {
        const set = new Set();
        for (const w of state.warehouseItems) {
            const c = String(w.category).trim();
            if (c)
                set.add(c);
        }
        return Array.from(set).sort((a, b) => categoryLabel(a, t).localeCompare(categoryLabel(b, t)));
    }, [state.warehouseItems, t]);
    const warehouseCategorySuggestions = useMemo(() => {
        const set = new Set();
        for (const w of state.warehouseItems) {
            const c = String(w.category).trim();
            if (c)
                set.add(c);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [state.warehouseItems]);
    React.useEffect(() => {
        if (filterCategory !== '__all' &&
            !categoryFilterOptions.includes(String(filterCategory))) {
            setFilterCategory('__all');
        }
    }, [filterCategory, categoryFilterOptions]);
    const [productDialogOpen, setProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [childAddTarget, setChildAddTarget] = useState(null);
    const [childAddQtyInput, setChildAddQtyInput] = useState('');
    const parentProductNameByChildId = useMemo(() => {
        const m = new Map();
        for (const w of state.warehouseItems) {
            if (!w.parentWarehouseId)
                continue;
            const p = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
            if (p)
                m.set(w.id, p.productName);
        }
        return m;
    }, [state.warehouseItems]);
    /** Faqat ota ostidagi «ajratilgan» bola qatorlari miqdori yig‘indisi (ota qatori bilan qo‘shilmaydi). */
    const childrenQtySumByRootId = useMemo(() => {
        const m = new Map();
        for (const w of state.warehouseItems) {
            if (!w.parentWarehouseId)
                continue;
            const pid = w.parentWarehouseId;
            m.set(pid, (m.get(pid) ?? 0) + w.currentQty);
        }
        return m;
    }, [state.warehouseItems]);
    const filteredStock = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base = state.warehouseItems.filter((w) => {
            if (filterCategory !== '__all' && w.category !== filterCategory)
                return false;
            if (q) {
                const parentName = parentProductNameByChildId.get(w.id) ?? '';
                const hay = `${w.productName} ${w.category} ${w.supplierName ?? ''} ${parentName}`.toLowerCase();
                if (!hay.includes(q))
                    return false;
            }
            return w.status === 'IN_STOCK' || w.currentQty > 0;
        });
        const ids = new Set(base.map((w) => w.id));
        const catOk = (w) => filterCategory === '__all' || String(w.category) === String(filterCategory);
        for (const w of base) {
            if (w.parentWarehouseId) {
                const p = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
                if (p && catOk(p))
                    ids.add(p.id);
            }
        }
        /** ids ichidagi har bir ota uchun bolalar — 0 yoki SOLD_OUT bo‘lsa ham ombor oilasi bilan chiqsin. */
        const rootsInIds = state.warehouseItems.filter((w) => ids.has(w.id) && !w.parentWarehouseId);
        for (const r of rootsInIds) {
            for (const ch of state.warehouseItems) {
                if (ch.parentWarehouseId === r.id && catOk(ch))
                    ids.add(ch.id);
            }
        }
        return state.warehouseItems.filter((w) => ids.has(w.id));
    }, [state.warehouseItems, search, filterCategory, parentProductNameByChildId]);
    const orderedFilteredStock = useMemo(() => orderWarehouseRows(filteredStock), [filteredStock]);
    /** Jadval/kartalar: har bir ota va uning bolalari bir guruh. Ota filtrda yo‘q bo‘lsa, bola alohildan ildiz sifatida. */
    const warehouseStockGroups = useMemo(() => {
        const inList = new Set(orderedFilteredStock.map((w) => w.id));
        const roots = orderedFilteredStock.filter((w) => !w.parentWarehouseId || !inList.has(w.parentWarehouseId));
        return roots.map((root) => ({
            root,
            children: orderedFilteredStock
                .filter((w) => w.parentWarehouseId === root.id)
                .sort((a, b) => a.productName.localeCompare(b.productName)),
        }));
    }, [orderedFilteredStock]);
    const deleteHasChildren = useMemo(() => {
        if (!confirmDelete)
            return false;
        return state.warehouseItems.some((w) => w.parentWarehouseId === confirmDelete.id);
    }, [confirmDelete, state.warehouseItems]);
    const soldOutcomes = useMemo(() => state.outcomes.filter((o) => o.type === 'SOLD' && isYmdInNavFilter(o.date, navDateFilter)), [state.outcomes, navDateFilter]);
    const totalsByUnit = useMemo(() => {
        const totals = { kg: 0, pcs: 0 };
        for (const w of state.warehouseItems) {
            if (w.unit === 'kg')
                totals.kg += w.currentQty;
            else
                totals.pcs += w.currentQty;
        }
        return totals;
    }, [state.warehouseItems]);
    const handleDelete = () => {
        if (!confirmDelete)
            return;
        deleteWarehouseItem(confirmDelete.id);
        toast.success(t.delete);
        setConfirmDelete(null);
    };
    const submitChildAddQty = () => {
        if (!childAddTarget)
            return;
        const raw = childAddQtyInput.trim().replace(/\s/g, '').replace(',', '.');
        const n = parseFloat(raw);
        if (!Number.isFinite(n) || n <= 0) {
            toast.error(t.whChildAddQtyInvalid);
            return;
        }
        const ok = addWarehouseChildQty(childAddTarget.id, n);
        if (!ok) {
            toast.error(t.whChildAddQtyInvalid);
            return;
        }
        toast.success(t.add);
        setChildAddTarget(null);
        setChildAddQtyInput('');
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: [_jsxs(Card, { className: "flex items-center gap-3 p-4", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30", children: _jsx(Package, { size: 18, className: "text-blue-600 dark:text-blue-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: "kg jami" }), _jsxs("p", { className: "nums text-lg font-bold", children: [formatNumber(totalsByUnit.kg), " kg"] })] })] }), _jsxs(Card, { className: "flex items-center gap-3 p-4", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30", children: _jsx(TrendingUp, { size: 18, className: "text-emerald-600 dark:text-emerald-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: t.whTabSold }), _jsx("p", { className: "nums text-lg font-bold", children: soldOutcomes.length })] })] })] }), _jsxs(Tabs, { value: tab, onValueChange: (v) => setTab(v), children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs(TabsList, { className: "w-full overflow-x-auto sm:w-auto", children: [_jsxs(TabsTrigger, { value: "stock", className: "flex-1 sm:flex-none", children: [t.whTabStock, _jsx(Badge, { variant: "muted", className: "ml-1 text-[10px]", children: orderedFilteredStock.length })] }), _jsxs(TabsTrigger, { value: "sold", className: "flex-1 sm:flex-none", children: [t.whTabSold, _jsx(Badge, { variant: "muted", className: "ml-1 text-[10px]", children: soldOutcomes.length })] })] }), tab === 'stock' && (_jsxs(Button, { onClick: () => {
                                    setEditingProduct(null);
                                    setProductDialogOpen(true);
                                }, className: "shrink-0", children: [_jsx(Plus, { size: 16 }), _jsx("span", { className: "hidden sm:inline", children: t.whAddProduct })] }))] }), _jsxs(TabsContent, { value: "stock", className: "space-y-4", children: [_jsx(Card, { className: "p-3", children: _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: t.whSearchPlaceholder, className: "pl-9" })] }), _jsxs(Select, { value: filterCategory, onValueChange: (v) => setFilterCategory(v), children: [_jsx(SelectTrigger, { className: "sm:w-56", children: _jsx(SelectValue, { placeholder: t.whFilterCategory }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__all", children: t.whFilterAll }), categoryFilterOptions.map((c) => (_jsxs(SelectItem, { value: c, children: [_jsx(CategoryIconGlyph, { category: c, size: 14, className: "mr-1.5 inline" }), categoryLabel(c, t)] }, c)))] })] })] }) }), _jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.whProductName }), _jsx(TableHead, { children: t.whCategory }), _jsx(TableHead, { className: "text-right", children: t.whQuantity }), _jsx(TableHead, { className: "text-right", children: t.whColPurchaseShort }), _jsx(TableHead, { className: "text-right", children: t.whColSaleShort }), _jsx(TableHead, { children: t.whIncomeDate }), _jsx(TableHead, { children: t.notes }), _jsx(TableHead, { className: "text-right", children: t.actions })] }) }), _jsx(TableBody, { children: warehouseStockGroups.length === 0 ? (_jsx(TableEmpty, { colSpan: 8, message: t.noData })) : (warehouseStockGroups.map(({ root, children }, groupIndex) => {
                                                const rows = [root, ...children];
                                                return (_jsxs(React.Fragment, { children: [groupIndex > 0 && (_jsx(TableRow, { className: "border-0 hover:bg-transparent dark:hover:bg-transparent", children: _jsx(TableCell, { colSpan: 8, className: "border-0 bg-transparent p-0 hover:bg-transparent dark:hover:bg-transparent", children: _jsx("div", { className: "mx-4 my-2 h-2 rounded-full bg-slate-200/90 dark:bg-slate-600/80", role: "separator", "aria-hidden": true }) }) })), rows.map((w, rowIndex) => {
                                                            const isChild = w.id !== root.id;
                                                            const rowNumLabel = isChild
                                                                ? `${groupIndex + 1}.${rowIndex}.`
                                                                : `${groupIndex + 1}.`;
                                                            const isLastInGroup = rowIndex === rows.length - 1;
                                                            const meta = categoryMeta(w.category);
                                                            const separatedSum = childrenQtySumByRootId.get(root.id) ?? 0;
                                                            const showSeparatedHint = !isChild && children.length > 0 && separatedSum > 1e-9;
                                                            return (_jsxs(TableRow, { className: cn(isChild
                                                                    ? 'border-l-2 border-indigo-400/70 bg-white dark:border-indigo-500/50 dark:bg-slate-950/30'
                                                                    : 'border-t-2 border-slate-200/90 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/45', isLastInGroup &&
                                                                    'border-b-2 border-slate-200/95 dark:border-slate-600'), children: [_jsx(TableCell, { className: `font-medium text-slate-800 dark:text-white ${isChild ? 'pl-4' : ''}`, children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(CategoryProductIcon, { category: w.category, iconKey: warehouseDisplayIconId(w) }), _jsx("div", { className: "min-w-0", children: _jsxs("div", { className: "flex flex-wrap items-center gap-1", children: [isChild && (_jsx("span", { className: "text-indigo-500 dark:text-indigo-400", "aria-hidden": true, children: "\u2514" })), _jsx("span", { className: "tabular-nums font-medium text-slate-500 dark:text-slate-400", children: rowNumLabel }), _jsx("span", { children: w.productName }), isChild && (_jsx(Badge, { variant: "outline", className: "text-[10px] font-normal", children: t.whSubLineBadge })), w.source === 'PROCESSED' && (_jsx(Badge, { variant: "muted", className: "text-[10px]", children: t.sortingProcessed })), w.source === 'SUPPLIER' && (_jsxs(Badge, { variant: "muted", className: "text-[10px]", children: [t.whSourceSupplier, w.supplierName ? `: ${w.supplierName}` : ''] }))] }) })] }) }), _jsx(TableCell, { children: _jsxs(Badge, { className: cn(meta.badge, 'gap-1'), children: [_jsx(CategoryIconGlyph, { category: w.category, size: 12 }), categoryLabel(w.category, t)] }) }), _jsxs(TableCell, { className: `nums text-right font-semibold ${meta.text}`, children: [_jsxs("span", { children: [formatNumber(w.currentQty), " ", w.unit] }), showSeparatedHint && (_jsxs("span", { className: "mt-0.5 block text-[10px] font-normal text-slate-500 dark:text-slate-400", children: [t.whFamilyTotal, ": ", formatNumber(separatedSum), ' ', w.unit === 'kg' ? 'kg' : t.unitPcs] }))] }), _jsx(TableCell, { className: "nums text-right text-xs text-slate-600 dark:text-slate-300", children: formatWarehouseUnitPrice(w.purchasePricePerUnit) }), _jsx(TableCell, { className: "nums text-right text-xs text-slate-600 dark:text-slate-300", children: formatWarehouseUnitPrice(w.salePricePerUnit) }), _jsx(TableCell, { className: "text-xs text-slate-500", children: formatDate(w.incomeDate) }), _jsx(TableCell, { className: "max-w-[12rem] truncate text-xs text-slate-500", children: w.notes ?? '—' }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "inline-flex flex-wrap items-center justify-end gap-1", children: [isChild && (_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400", title: t.whChildAddQtyTitle, onClick: () => {
                                                                                        setChildAddTarget(w);
                                                                                        setChildAddQtyInput('');
                                                                                    }, children: _jsx(Plus, { size: 13 }) })), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => {
                                                                                        setEditingProduct(w);
                                                                                        setProductDialogOpen(true);
                                                                                    }, children: _jsx(Pencil, { size: 13 }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 hover:text-red-600", onClick: () => setConfirmDelete(w), children: _jsx(Trash2, { size: 13 }) })] }) })] }, w.id));
                                                        })] }, root.id));
                                            })) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: warehouseStockGroups.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.noData })) : (warehouseStockGroups.map(({ root, children }, groupIndex) => {
                                    const rootMeta = categoryMeta(root.category);
                                    const groupNum = groupIndex + 1;
                                    const separatedSum = childrenQtySumByRootId.get(root.id) ?? 0;
                                    const showSeparatedHint = children.length > 0 && separatedSum > 1e-9;
                                    return (_jsxs(Card, { className: "overflow-hidden border-slate-200/90 dark:border-slate-600", children: [_jsxs("div", { className: "border-b border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(CategoryProductIcon, { category: root.category, iconKey: warehouseDisplayIconId(root), size: "md" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "truncate text-sm font-semibold text-slate-800 dark:text-white", children: [_jsxs("span", { className: "mr-1 tabular-nums text-slate-500 dark:text-slate-400", children: [groupNum, "."] }), root.productName] }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-1.5", children: [root.source === 'PROCESSED' && (_jsx(Badge, { variant: "muted", className: "text-[10px]", children: t.sortingProcessed })), root.source === 'SUPPLIER' && (_jsxs(Badge, { variant: "muted", className: "text-[10px]", children: [t.whSourceSupplier, root.supplierName ? `: ${root.supplierName}` : ''] })), _jsx(Badge, { className: rootMeta.badge, children: categoryLabel(root.category, t) }), _jsx("span", { className: "text-[11px] text-slate-400", children: formatDate(root.incomeDate) })] }), _jsxs("p", { className: `mt-2 nums text-base font-bold ${rootMeta.text}`, children: [formatNumber(root.currentQty), " ", root.unit] }), showSeparatedHint && (_jsxs("p", { className: "mt-1 text-[11px] text-slate-500 dark:text-slate-400", children: [t.whFamilyTotal, ": ", formatNumber(separatedSum), ' ', root.unit === 'kg' ? 'kg' : t.unitPcs] })), _jsxs("p", { className: "mt-1 text-[11px] text-slate-600 dark:text-slate-300", children: [t.whColPurchaseShort, ": ", formatWarehouseUnitPrice(root.purchasePricePerUnit), " \u00B7", ' ', t.whColSaleShort, ": ", formatWarehouseUnitPrice(root.salePricePerUnit)] }), _jsx("p", { className: "mt-1 truncate text-xs text-slate-500", children: root.notes ?? '—' })] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-600", children: [_jsx(Button, { size: "sm", variant: "ghost", onClick: () => {
                                                                    setEditingProduct(root);
                                                                    setProductDialogOpen(true);
                                                                }, children: _jsx(Pencil, { size: 13 }) }), _jsx(Button, { size: "sm", variant: "ghost", className: "hover:text-red-600", onClick: () => setConfirmDelete(root), children: _jsx(Trash2, { size: 13 }) })] })] }), children.length > 0 && (_jsx("div", { className: "divide-y divide-slate-100 dark:divide-slate-700", children: children.map((w, childIndex) => {
                                                    const meta = categoryMeta(w.category);
                                                    return (_jsxs("div", { className: "bg-indigo-50/30 p-4 pl-4 dark:bg-indigo-950/15", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(CategoryProductIcon, { category: w.category, iconKey: warehouseDisplayIconId(w) }), _jsx("span", { className: "mt-1.5 font-mono text-indigo-500 dark:text-indigo-400", children: "\u2514" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "truncate text-sm font-medium text-slate-800 dark:text-white", children: [_jsxs("span", { className: "mr-1 tabular-nums text-slate-500 dark:text-slate-400", children: [groupNum, ".", childIndex + 1, "."] }), w.productName, _jsx(Badge, { variant: "outline", className: "ml-2 align-middle text-[9px] font-normal", children: t.whSubLineBadge })] }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-1.5", children: [_jsx(Badge, { className: meta.badge, children: categoryLabel(w.category, t) }), _jsx("span", { className: "text-[11px] text-slate-400", children: formatDate(w.incomeDate) })] }), _jsxs("p", { className: `mt-1.5 nums text-sm font-semibold ${meta.text}`, children: [formatNumber(w.currentQty), " ", w.unit] }), _jsxs("p", { className: "mt-1 text-[11px] text-slate-600 dark:text-slate-300", children: [t.whColPurchaseShort, ": ", formatWarehouseUnitPrice(w.purchasePricePerUnit), " \u00B7", ' ', t.whColSaleShort, ": ", formatWarehouseUnitPrice(w.salePricePerUnit)] })] })] }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "outline", className: "h-8 text-emerald-600", title: t.whChildAddQtyTitle, onClick: () => {
                                                                            setChildAddTarget(w);
                                                                            setChildAddQtyInput('');
                                                                        }, children: _jsx(Plus, { size: 13 }) }), _jsx(Button, { size: "sm", variant: "ghost", className: "h-8", onClick: () => {
                                                                            setEditingProduct(w);
                                                                            setProductDialogOpen(true);
                                                                        }, children: _jsx(Pencil, { size: 13 }) }), _jsx(Button, { size: "sm", variant: "ghost", className: "h-8 hover:text-red-600", onClick: () => setConfirmDelete(w), children: _jsx(Trash2, { size: 13 }) })] })] }, w.id));
                                                }) }))] }, root.id));
                                })) })] }), _jsx(TabsContent, { value: "sold", children: _jsx(Card, { className: "overflow-hidden", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.date }), _jsx(TableHead, { children: t.whProductName }), _jsx(TableHead, { children: t.whBuyer }), _jsx(TableHead, { className: "text-right", children: t.whSellQuantity }), _jsx(TableHead, { className: "text-right", children: t.whPricePerUnit }), _jsx(TableHead, { className: "text-right", children: t.total })] }) }), _jsx(TableBody, { children: soldOutcomes.length === 0 ? (_jsx(TableEmpty, { colSpan: 6, message: t.noData })) : (soldOutcomes.map((o) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "text-xs text-slate-500", children: formatDate(o.date) }), _jsx(TableCell, { className: "font-medium text-slate-800 dark:text-white", children: o.productName }), _jsx(TableCell, { className: "text-xs text-slate-500", children: o.customerName ?? '—' }), _jsxs(TableCell, { className: "nums text-right", children: [formatNumber(o.quantity), " ", o.unit] }), _jsx(TableCell, { className: "nums text-right text-xs text-slate-500", children: o.pricePerUnit ? formatNumber(o.pricePerUnit) + " so'm" : '—' }), _jsx(TableCell, { className: "nums text-right font-semibold text-emerald-600 dark:text-emerald-400", children: o.totalAmount ? formatNumber(o.totalAmount) + " so'm" : '—' })] }, o.id)))) })] }) }) })] }), _jsx(ProductDialog, { open: productDialogOpen, onOpenChange: (o) => {
                    setProductDialogOpen(o);
                    if (!o)
                        setEditingProduct(null);
                }, editing: editingProduct, categorySuggestions: warehouseCategorySuggestions }), _jsx(Dialog, { open: !!childAddTarget, onOpenChange: (o) => {
                    if (!o) {
                        setChildAddTarget(null);
                        setChildAddQtyInput('');
                    }
                }, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t.whChildAddQtyTitle }), _jsx(DialogDescription, { children: childAddTarget
                                        ? t.whChildAddQtyDesc.replace('{name}', parentProductNameByChildId.get(childAddTarget.id) ?? '—')
                                        : null })] }), _jsxs("div", { className: "space-y-2 py-2", children: [_jsxs(Label, { htmlFor: "child-add-qty", children: [t.whChildAddQtyLabel, childAddTarget ? (_jsxs("span", { className: "font-normal text-slate-400", children: [' ', "(", childAddTarget.unit === 'kg' ? 'kg' : t.unitPcs, ")"] })) : null] }), _jsx(Input, { id: "child-add-qty", value: childAddQtyInput, onChange: (e) => setChildAddQtyInput(e.target.value), inputMode: "decimal", placeholder: "0", autoFocus: true, onKeyDown: (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            submitChildAddQty();
                                        }
                                    } })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => {
                                        setChildAddTarget(null);
                                        setChildAddQtyInput('');
                                    }, children: t.cancel }), _jsx(Button, { type: "button", onClick: submitChildAddQty, children: t.add })] })] }) }), _jsx(AlertDialog, { open: !!confirmDelete, onOpenChange: (o) => !o && setConfirmDelete(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.delete }), _jsxs(AlertDialogDescription, { children: [t.whDeleteConfirm, confirmDelete && (_jsx("span", { className: "mt-2 block font-semibold text-slate-800 dark:text-white", children: confirmDelete.productName })), deleteHasChildren && (_jsx("span", { className: "mt-2 block text-sm text-amber-700 dark:text-amber-400", children: t.whDeleteParentChildren }))] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDelete, children: t.delete })] })] }) })] }));
}
