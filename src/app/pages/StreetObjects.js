import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Search, Phone, MapPin, Truck, ShoppingBag, History, Wallet, Trash2, Package, Receipt, } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, getStreetObjectRemainingDebt, getOrphanStreetDebtIncurred, groupStreetPurchasesForHistory, } from '../store/saralash-store';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter, formatYmdDisplay, todayYmd } from '../lib/nav-date-range';
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
import { formatDate, formatNumber, formatQuantity, TODAY, uid } from '../utils/format';
import { StreetObjectPurchaseEditDialog } from '../components/StreetObjectPurchaseEditDialog';
import { CumulativeQuantityField } from '../components/CumulativeQuantityField';
import { appendQtyPart, finalizeQtyParts, lineQtyTotal, switchWarehouseOnLine, } from '../utils/purchase-qty-parts';
import { isIntakePurchaseFormDirty, toIntakePurchaseDraft } from '../utils/purchase-draft-form';
const EMPTY_STREET_OBJECT = {
    fullName: '',
    phone: '',
    address: '',
    notes: '',
};
function newPurchaseLine(warehouseItemId = '', pricePerUnit = '') {
    return { key: uid('spl'), warehouseItemId, quantity: '', qtyParts: [], pricePerUnit };
}
const EMPTY_PURCHASE = {
    streetObjectId: '',
    incomeDate: TODAY,
    paidAmount: '',
    onCredit: false,
    notes: '',
    lines: [newPurchaseLine()],
};
export function StreetObjects() {
    const { state, addStreetObject, updateStreetObject, deleteStreetObject, purchaseLinesFromStreetObject, recordStreetDebtRepayment, } = useStore();
    const { t } = useApp();
    const { filter: navDateFilter } = useNavDateFilter();
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_STREET_OBJECT);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [purchaseDiscardConfirmOpen, setPurchaseDiscardConfirmOpen] = useState(false);
    const [purchaseForm, setPurchaseForm] = useState(EMPTY_PURCHASE);
    /** Qaysi qator kengaytirilgan (qolganlari qisqa qator). */
    const [purchaseEditingKey, setPurchaseEditingKey] = useState('');
    const [mainTab, setMainTab] = useState('list');
    const [historySearch, setHistorySearch] = useState('');
    const [historyStreetObjectId, sethistoryStreetObjectId] = useState('__all');
    const [historyEditBatch, setHistoryEditBatch] = useState(null);
    const [debtRepayOpen, setDebtRepayOpen] = useState(false);
    const [debtRepayStreetObjectId, setDebtRepayStreetObjectId] = useState('');
    const [debtRepayAmount, setDebtRepayAmount] = useState('');
    const [debtRepayDate, setDebtRepayDate] = useState(TODAY);
    const [debtRepayNotes, setDebtRepayNotes] = useState('');
    const [streetObjectDetailOpen, setstreetObjectDetailOpen] = useState(false);
    const [streetObjectDetail, setstreetObjectDetail] = useState(null);
    const debtTabBadgeCount = useMemo(() => {
        let n = state.streetObjects.filter((s) => getStreetObjectRemainingDebt(state, s.id) > 1e-6).length;
        if (getOrphanStreetDebtIncurred(state) > 1e-6)
            n += 1;
        return n;
    }, [state.streetObjects, state.streetPurchases, state.streetDebtRepayments]);
    const sortedDebtRepayments = useMemo(() => [...state.streetDebtRepayments].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [state.streetDebtRepayments]);
    const streetObjectDetailPurchases = useMemo(() => {
        if (!streetObjectDetail)
            return [];
        return state.streetPurchases
            .filter((p) => p.streetObjectId === streetObjectDetail.id)
            .slice()
            .sort((a, b) => String(b.incomeDate).localeCompare(String(a.incomeDate)) ||
            String(b.createdAt).localeCompare(String(a.createdAt)));
    }, [state.streetPurchases, streetObjectDetail]);
    const streetObjectDetailPurchaseGroups = useMemo(() => groupStreetPurchasesForHistory(streetObjectDetailPurchases), [streetObjectDetailPurchases]);
    const debtRepayRemaining = useMemo(() => {
        if (!debtRepayStreetObjectId)
            return 0;
        return getStreetObjectRemainingDebt(state, debtRepayStreetObjectId);
    }, [state, debtRepayStreetObjectId]);
    /** Ombor tartibi: avval ota, keyin uning ajratilgan bolalari. */
    const warehousePurchaseOptions = useMemo(() => {
        const items = state.warehouseItems;
        const roots = items
            .filter((w) => !w.parentWarehouseId)
            .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }));
        const out = [];
        const seen = new Set();
        for (const r of roots) {
            out.push(r);
            seen.add(r.id);
            const kids = items
                .filter((w) => w.parentWarehouseId === r.id)
                .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }));
            for (const k of kids) {
                out.push(k);
                seen.add(k.id);
            }
        }
        for (const w of items) {
            if (!seen.has(w.id))
                out.push(w);
        }
        return out;
    }, [state.warehouseItems]);
    const warehouseProductTitle = (w) => {
        if (!w.parentWarehouseId)
            return w.productName;
        const parent = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
        return `└ ${w.productName} · ${parent?.productName ?? '—'}`;
    };
    const prefPurchasePrice = (w) => {
        if (!w)
            return '';
        const own = w.streetPurchasePricePerUnit != null && Number.isFinite(w.streetPurchasePricePerUnit) && w.streetPurchasePricePerUnit > 0
            ? w.streetPurchasePricePerUnit
            : null;
        if (own != null)
            return String(own);
        if (w.parentWarehouseId) {
            const parent = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
            if (parent?.streetPurchasePricePerUnit != null &&
                Number.isFinite(parent.streetPurchasePricePerUnit) &&
                parent.streetPurchasePricePerUnit > 0) {
                return String(parent.streetPurchasePricePerUnit);
            }
        }
        return '';
    };
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return state.streetObjects;
        return state.streetObjects.filter((s) => s.fullName.toLowerCase().includes(q) ||
            s.phone.toLowerCase().includes(q) ||
            s.address.toLowerCase().includes(q));
    }, [state.streetObjects, search]);
    const purchaseSelectedStreetObject = useMemo(() => state.streetObjects.find((s) => s.id === purchaseForm.streetObjectId), [state.streetObjects, purchaseForm.streetObjectId]);
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
    const sessionQtyByWarehouseId = useMemo(() => {
        const map = new Map();
        for (const line of purchaseForm.lines) {
            const { w, qtyNum } = parseDraftLine(line);
            if (!w || qtyNum == null)
                continue;
            map.set(w.id, (map.get(w.id) ?? 0) + qtyNum);
        }
        return map;
    }, [purchaseForm.lines, state.warehouseItems]);
    const warehouseSessionLabel = (w) => {
        const q = sessionQtyByWarehouseId.get(w.id) ?? 0;
        const u = w.unit === 'kg' ? 'kg' : t.unitPcs;
        return `${warehouseProductTitle(w)} (${formatQuantity(q, w.unit)} ${u})`;
    };
    const purchaseOrderTotal = useMemo(() => {
        let sum = 0;
        let any = false;
        for (const line of purchaseForm.lines) {
            const { lineTotal } = parseDraftLine(line);
            if (lineTotal != null) {
                sum += lineTotal;
                any = true;
            }
        }
        return any ? sum : null;
    }, [purchaseForm.lines, state.warehouseItems]);
    const purchaseByProductSummary = useMemo(() => {
        const map = new Map();
        for (const line of purchaseForm.lines) {
            const { w, qtyNum, lineTotal } = parseDraftLine(line);
            if (!w || qtyNum == null)
                continue;
            const prev = map.get(w.id);
            const amount = (prev?.amount ?? 0) + (lineTotal ?? 0);
            map.set(w.id, {
                id: w.id,
                label: warehouseProductTitle(w),
                unit: w.unit,
                qty: (prev?.qty ?? 0) + qtyNum,
                amount,
                hasPrice: lineTotal != null || (prev?.hasPrice ?? false),
            });
        }
        return [...map.values()].filter((g) => g.qty > 0);
    }, [purchaseForm.lines, state.warehouseItems]);
    const debtPreviewSo = useMemo(() => {
        if (purchaseOrderTotal == null)
            return null;
        const payRaw = purchaseForm.paidAmount.trim().replace(',', '.');
        const paid = payRaw === '' ? 0 : Number.isFinite(parseFloat(payRaw)) ? Math.max(0, parseFloat(payRaw)) : null;
        if (paid == null)
            return null;
        return Math.max(0, purchaseOrderTotal - paid);
    }, [purchaseOrderTotal, purchaseForm.paidAmount]);
    useEffect(() => {
        if (!purchaseOpen || purchaseForm.onCredit || purchaseOrderTotal == null)
            return;
        const next = String(Math.round(purchaseOrderTotal * 100) / 100);
        setPurchaseForm((f) => (f.paidAmount === next ? f : { ...f, paidAmount: next }));
    }, [purchaseOpen, purchaseForm.onCredit, purchaseOrderTotal]);
    const selectPurchaseWarehouse = (editingKey, newWarehouseId) => {
        const item = state.warehouseItems.find((x) => x.id === newWarehouseId);
        const unitFor = (id) => state.warehouseItems.find((x) => x.id === id)?.unit ?? 'kg';
        const { lines, editingKey: nextKey } = switchWarehouseOnLine(purchaseForm.lines, editingKey, newWarehouseId, prefPurchasePrice(item), unitFor, () => newPurchaseLine());
        setPurchaseForm((f) => ({ ...f, lines }));
        setPurchaseEditingKey(nextKey);
    };
    const appendPurchaseQtyPart = (key) => {
        const line = purchaseForm.lines.find((l) => l.key === key);
        if (!line?.warehouseItemId) {
            toast.error(t.required + ': ' + t.streetPurchasePickParent);
            return;
        }
        const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
        const result = appendQtyPart(line, w?.unit ?? 'kg');
        if (!result.ok) {
            if (result.reason === 'pcs_whole')
                toast.error(t.streetPurchasePcsWhole);
            else
                toast.error(t.required + ': ' + t.whQuantity);
            return;
        }
        updatePurchaseLine(key, { qtyParts: result.qtyParts, quantity: result.quantity });
    };
    const updatePurchaseLine = (key, patch) => {
        setPurchaseForm((f) => ({
            ...f,
            lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
        }));
    };
    const removePurchaseLine = (key) => {
        setPurchaseForm((f) => {
            const next = f.lines.filter((l) => l.key !== key);
            const lines = next.length ? next : [newPurchaseLine()];
            if (purchaseEditingKey === key) {
                setPurchaseEditingKey(lines[lines.length - 1].key);
            }
            return { ...f, lines };
        });
    };
    const filteredHistoryRows = useMemo(() => {
        let rows = state.streetPurchases.filter((p) => isYmdInNavFilter(p.incomeDate, navDateFilter));
        if (historyStreetObjectId !== '__all') {
            rows = rows.filter((p) => p.streetObjectId === historyStreetObjectId);
        }
        const q = historySearch.trim().toLowerCase();
        if (q) {
            rows = rows.filter((p) => p.productName.toLowerCase().includes(q) ||
                p.streetObjectName.toLowerCase().includes(q) ||
                String(p.category).toLowerCase().includes(q));
        }
        return rows;
    }, [state.streetPurchases, historySearch, historyStreetObjectId, navDateFilter]);
    const historyGroups = useMemo(() => groupStreetPurchasesForHistory(filteredHistoryRows), [filteredHistoryRows]);
    const historyPeriodLabel = useMemo(() => {
        if (navDateFilter.mode === 'all')
            return '';
        if (navDateFilter.from === navDateFilter.to)
            return formatYmdDisplay(navDateFilter.from);
        return `${formatYmdDisplay(navDateFilter.from)} — ${formatYmdDisplay(navDateFilter.to)}`;
    }, [navDateFilter]);
    const historyPeriodSummary = useMemo(() => {
        if (navDateFilter.mode === 'all')
            return null;
        let rows = state.streetPurchases.filter((p) => isYmdInNavFilter(p.incomeDate, navDateFilter));
        if (historyStreetObjectId !== '__all') {
            rows = rows.filter((p) => p.streetObjectId === historyStreetObjectId);
        }
        const byProduct = new Map();
        let totalAmount = 0;
        let totalKg = 0;
        let totalPcs = 0;
        for (const p of rows) {
            const name = p.productName.split(' (')[0]?.trim() || p.productName;
            const prev = byProduct.get(name);
            const amount = p.totalAmount ?? 0;
            byProduct.set(name, {
                unit: p.unit,
                qty: (prev?.qty ?? 0) + p.quantity,
                amount: (prev?.amount ?? 0) + amount,
            });
            totalAmount += amount;
            if (p.unit === 'kg')
                totalKg += p.quantity;
            else
                totalPcs += p.quantity;
        }
        const products = [...byProduct.entries()]
            .sort((a, b) => b[1].amount - a[1].amount || a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
            .map(([name, { qty, unit, amount }]) => ({ name, qty, unit, amount }));
        return {
            totalAmount,
            totalKg,
            totalPcs,
            productCount: products.length,
            batchCount: groupStreetPurchasesForHistory(rows).length,
            products,
        };
    }, [state.streetPurchases, navDateFilter, historyStreetObjectId]);
    const listPurchaseScope = useMemo(() => {
        const today = todayYmd();
        if (navDateFilter.mode === 'all') {
            return { kind: 'day', day: today, isToday: true };
        }
        const { from, to } = navDateFilter;
        if (from === to) {
            return { kind: 'day', day: from, isToday: from === today };
        }
        return { kind: 'range', from, to, isToday: false };
    }, [navDateFilter]);
    const purchaseSummaryPeriodLabel = useMemo(() => {
        if (listPurchaseScope.kind === 'day')
            return formatYmdDisplay(listPurchaseScope.day);
        return `${formatYmdDisplay(listPurchaseScope.from)} — ${formatYmdDisplay(listPurchaseScope.to)}`;
    }, [listPurchaseScope]);
    const purchaseSummaryTitle = listPurchaseScope.kind === 'day' && listPurchaseScope.isToday
        ? t.streetDailyPurchaseSummary
        : t.streetDailyPurchaseSummaryDay;
    const purchaseSummaryEmpty = listPurchaseScope.kind === 'day' && listPurchaseScope.isToday
        ? t.streetDailyPurchaseEmpty
        : t.streetDailyPurchaseEmptyDay;
    const todayPurchaseItems = useMemo(() => {
        const byProduct = new Map();
        for (const p of state.streetPurchases) {
            if (listPurchaseScope.kind === 'day') {
                if (p.incomeDate !== listPurchaseScope.day)
                    continue;
            }
            else if (!isYmdInNavFilter(p.incomeDate, navDateFilter)) {
                continue;
            }
            const name = p.productName.split(' (')[0]?.trim() || p.productName;
            const prev = byProduct.get(name);
            byProduct.set(name, {
                unit: p.unit,
                qty: (prev?.qty ?? 0) + p.quantity,
            });
        }
        return [...byProduct.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
            .map(([name, { qty, unit }]) => ({ name, qty, unit }));
    }, [state.streetPurchases, listPurchaseScope, navDateFilter]);
    const todayPurchaseStats = useMemo(() => {
        let totalKg = 0;
        let totalPcs = 0;
        for (const i of todayPurchaseItems) {
            if (i.unit === 'kg')
                totalKg += i.qty;
            else
                totalPcs += i.qty;
        }
        return { totalKg, totalPcs, count: todayPurchaseItems.length };
    }, [todayPurchaseItems]);
    const summarizeBatchProducts = (lines) => {
        const map = new Map();
        for (const l of lines) {
            const prev = map.get(l.productName);
            map.set(l.productName, {
                qty: (prev?.qty ?? 0) + l.quantity,
                unit: l.unit,
            });
        }
        return [...map.entries()]
            .map(([name, { qty, unit }]) => {
            const u = unit === 'kg' ? 'kg' : t.unitPcs;
            return `${name} ${formatQuantity(qty, unit)} ${u}`;
        })
            .join(' · ');
    };
    const batchMoneyTotals = (g) => {
        const totalAmount = g.lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
        const paid = g.lines.reduce((s, l) => s + (l.paidAmount ?? 0), 0);
        const debt = g.lines.reduce((s, l) => s + (l.streetObjectDebtAmount ?? 0), 0);
        return { totalAmount, paid, debt };
    };
    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_STREET_OBJECT);
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
    const closePurchaseDialog = () => {
        setPurchaseOpen(false);
        setPurchaseDiscardConfirmOpen(false);
        setPurchaseForm(EMPTY_PURCHASE);
        setPurchaseEditingKey('');
    };
    const requestClosePurchaseDialog = () => {
        if (isIntakePurchaseFormDirty(toIntakePurchaseDraft(purchaseForm))) {
            setPurchaseDiscardConfirmOpen(true);
            return;
        }
        closePurchaseDialog();
    };
    const openPurchaseDialog = () => {
        const first = warehousePurchaseOptions[0];
        const line = newPurchaseLine(first?.id ?? '', first ? prefPurchasePrice(first) : '');
        setPurchaseForm({
            ...EMPTY_PURCHASE,
            lines: [line],
        });
        setPurchaseEditingKey(line.key);
        setPurchaseDiscardConfirmOpen(false);
        setPurchaseOpen(true);
    };
    const openSupplierPurchaseDetail = (s) => {
        setstreetObjectDetail(s);
        setstreetObjectDetailOpen(true);
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
            toast.error(t.required + ': ' + t.streetName + ' / ' + t.streetPhone);
            return;
        }
        if (editing) {
            updateStreetObject({ ...editing, ...trimmed });
            toast.success(t.save);
        }
        else {
            addStreetObject(trimmed);
            toast.success(t.add);
        }
        setDialogOpen(false);
        setForm(EMPTY_STREET_OBJECT);
        setEditing(null);
    };
    const handlePurchaseSubmit = (e) => {
        e.preventDefault();
        const supplier = state.streetObjects.find((s) => s.id === purchaseForm.streetObjectId);
        if (!supplier) {
            toast.error(t.required + ': ' + t.streetPurchasePickSupplier);
            return;
        }
        const resolvedLines = [];
        const linesToSubmit = [];
        for (const line of purchaseForm.lines) {
            if (!line.warehouseItemId)
                continue;
            const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
            const hasAny = line.qtyParts.length > 0 || line.quantity.trim();
            if (!hasAny)
                continue;
            const fin = finalizeQtyParts(line, w?.unit ?? 'kg');
            if (!fin.ok) {
                if (fin.reason === 'pcs_whole')
                    toast.error(t.streetPurchasePcsWhole);
                else
                    toast.error(t.required + ': ' + t.whQuantity);
                return;
            }
            linesToSubmit.push({
                ...line,
                qtyParts: fin.qtyParts,
                quantity: fin.quantity,
            });
        }
        if (!linesToSubmit.length) {
            toast.error(t.required);
            return;
        }
        for (const line of linesToSubmit) {
            const { w, qtyNum, priceNum } = parseDraftLine(line);
            if (!w || qtyNum == null) {
                toast.error(t.required);
                return;
            }
            if (w.unit === 'pcs' && Math.abs(qtyNum - Math.floor(qtyNum)) > 1e-9) {
                toast.error(t.streetPurchasePcsWhole);
                return;
            }
            resolvedLines.push({
                warehouseItemId: line.warehouseItemId,
                quantity: qtyNum,
                streetPurchasePricePerUnit: priceNum,
                w,
            });
        }
        let paidNum = null;
        if (purchaseOrderTotal != null) {
            const payRaw = purchaseForm.paidAmount.trim().replace(',', '.');
            if (purchaseForm.onCredit && payRaw === '') {
                paidNum = 0;
            }
            else if (!payRaw) {
                toast.error(t.required + ': ' + t.streetPaidAmount);
                return;
            }
            else {
                paidNum = parseFloat(payRaw);
                if (!Number.isFinite(paidNum) || paidNum < 0) {
                    toast.error(t.whValidateOptionalPrice);
                    return;
                }
            }
            const eps = 1e-4 * Math.max(1, purchaseOrderTotal);
            if (!purchaseForm.onCredit) {
                if (Math.abs(paidNum - purchaseOrderTotal) > eps) {
                    toast.error(t.streetPaidMustEqualTotal);
                    return;
                }
            }
            else if (paidNum > purchaseOrderTotal + 1e-6) {
                toast.error(t.streetPaidExceedsTotal);
                return;
            }
        }
        const ok = purchaseLinesFromStreetObject(supplier.id, {
            incomeDate: purchaseForm.incomeDate,
            notes: purchaseForm.notes.trim() || undefined,
            onCredit: purchaseForm.onCredit,
            paidAmount: purchaseOrderTotal != null ? paidNum : undefined,
            lines: resolvedLines.map((r) => ({
                warehouseItemId: r.warehouseItemId,
                quantity: r.quantity,
                streetPurchasePricePerUnit: r.streetPurchasePricePerUnit,
            })),
        });
        if (!ok) {
            toast.error(t.required);
            return;
        }
        toast.success(t.streetPurchaseSuccess);
        closePurchaseDialog();
    };
    const handleDelete = () => {
        if (!confirmDelete)
            return;
        deleteStreetObject(confirmDelete.id);
        toast.success(t.delete);
        setConfirmDelete(null);
    };
    const openDebtRepay = (supplierId) => {
        const rem = getStreetObjectRemainingDebt(state, supplierId);
        setDebtRepayStreetObjectId(supplierId);
        setDebtRepayAmount(rem > 1e-6 ? String(Math.round(rem * 100) / 100) : '');
        setDebtRepayDate(TODAY);
        setDebtRepayNotes('');
        setDebtRepayOpen(true);
    };
    const handleDebtRepaySubmit = (e) => {
        e.preventDefault();
        if (!debtRepayStreetObjectId) {
            toast.error(t.required);
            return;
        }
        const max = getStreetObjectRemainingDebt(state, debtRepayStreetObjectId);
        const raw = debtRepayAmount.trim().replace(',', '.');
        if (!raw) {
            toast.error(t.required + ': ' + t.streetDebtPayAmount);
            return;
        }
        const amt = parseFloat(raw);
        if (!Number.isFinite(amt) || amt <= 0) {
            toast.error(t.whValidateOptionalPrice);
            return;
        }
        if (amt > max + 1e-6) {
            toast.error(t.streetDebtExceedsRemaining);
            return;
        }
        const row = recordStreetDebtRepayment(debtRepayStreetObjectId, {
            amount: amt,
            date: debtRepayDate,
            notes: debtRepayNotes.trim() || undefined,
        });
        if (!row) {
            toast.error(t.streetDebtExceedsRemaining);
            return;
        }
        toast.success(t.streetDebtPaySuccess);
        setDebtRepayOpen(false);
        setDebtRepayStreetObjectId('');
        setDebtRepayAmount('');
        setDebtRepayNotes('');
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs(Tabs, { value: mainTab, onValueChange: (v) => setMainTab(v), className: "space-y-4", children: [_jsxs(TabsList, { className: "w-full overflow-x-auto sm:w-auto", children: [_jsxs(TabsTrigger, { value: "list", className: "flex-1 gap-1.5 sm:flex-none", children: [_jsx(Truck, { size: 14 }), t.streetTabSuppliers] }), _jsxs(TabsTrigger, { value: "history", className: "flex-1 gap-1.5 sm:flex-none", children: [_jsx(History, { size: 14 }), t.streetTabHistory, _jsx(Badge, { variant: "muted", className: "ml-0.5 text-[10px]", children: historyGroups.length })] }), _jsxs(TabsTrigger, { value: "debts", className: "flex-1 gap-1.5 sm:flex-none", children: [_jsx(Wallet, { size: 14 }), t.streetTabDebts, debtTabBadgeCount > 0 ? (_jsx(Badge, { variant: "danger", className: "ml-0.5 text-[10px]", children: debtTabBadgeCount })) : null] })] }), _jsxs(TabsContent, { value: "list", className: "mt-0 space-y-4", children: [_jsx(Card, { className: "border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/30", children: _jsx("p", { className: "text-sm text-indigo-900 dark:text-indigo-200", children: t.streetIntro }) }), _jsxs(Card, { className: "overflow-hidden border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 p-0 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/20", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 border-b border-emerald-100/80 px-4 py-3.5 dark:border-emerald-900/50", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25", children: _jsx(Package, { size: 18 }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: purchaseSummaryTitle }), _jsx("p", { className: "mt-0.5 text-xs text-slate-500 dark:text-slate-400", children: purchaseSummaryPeriodLabel })] })] }), todayPurchaseItems.length > 0 && (_jsxs("div", { className: "shrink-0 rounded-xl border border-emerald-100/90 bg-white/80 px-3 py-2 text-right shadow-sm dark:border-emerald-900/50 dark:bg-slate-800/80", children: [todayPurchaseStats.totalKg > 0 && (_jsxs("p", { className: "nums text-lg font-bold leading-none text-emerald-800 dark:text-emerald-300", children: [formatQuantity(todayPurchaseStats.totalKg, 'kg'), _jsx("span", { className: "ml-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400", children: "kg" })] })), todayPurchaseStats.totalPcs > 0 && (_jsxs("p", { className: `nums font-bold leading-none text-emerald-800 dark:text-emerald-300 ${todayPurchaseStats.totalKg > 0
                                                            ? 'mt-1 text-sm'
                                                            : 'text-lg'}`, children: [formatQuantity(todayPurchaseStats.totalPcs, 'pcs'), _jsx("span", { className: "ml-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400", children: t.unitPcs })] })), _jsxs("p", { className: "mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500", children: [formatNumber(todayPurchaseStats.count), " ", t.streetHistoryProductCount] })] }))] }), _jsx("div", { className: "p-4", children: todayPurchaseItems.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-6 text-center", children: [_jsx("div", { className: "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/90 dark:bg-emerald-900/30", children: _jsx(Package, { size: 22, className: "text-emerald-500/70 dark:text-emerald-400/70" }) }), _jsx("p", { className: "max-w-xs text-sm text-slate-500 dark:text-slate-400", children: purchaseSummaryEmpty })] })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: todayPurchaseItems.map((item) => (_jsxs("div", { className: "flex min-w-[6.75rem] max-w-full flex-col gap-0.5 rounded-xl border border-emerald-100/90 bg-white/90 px-3 py-2.5 shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-emerald-900/40 dark:bg-slate-800/90 dark:hover:border-emerald-800/60", children: [_jsx("span", { className: "line-clamp-2 text-xs font-medium leading-snug text-slate-600 dark:text-slate-300", children: item.name }), _jsxs("span", { className: "nums text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400", children: [formatQuantity(item.qty, item.unit), _jsx("span", { className: "ml-1 text-xs font-semibold text-emerald-600/90 dark:text-emerald-500/90", children: item.unit === 'kg' ? 'kg' : t.unitPcs })] })] }, item.name))) })) })] }), _jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", children: [_jsxs("div", { className: "relative min-w-0 flex-1 sm:min-w-[12rem]", children: [_jsx(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: t.streetSearchPlaceholder, className: "pl-9" })] }), _jsxs("div", { className: "flex shrink-0 flex-wrap gap-2 sm:ml-auto", children: [_jsxs(Button, { type: "button", variant: "default", className: "flex-1 sm:flex-none", onClick: openPurchaseDialog, disabled: state.streetObjects.length === 0 || warehousePurchaseOptions.length === 0, title: warehousePurchaseOptions.length === 0 ? t.streetNoParentProducts : undefined, children: [_jsx(ShoppingBag, { size: 16 }), t.streetPurchase] }), _jsxs(Button, { type: "button", onClick: openCreate, className: "flex-1 sm:flex-none", children: [_jsx(Plus, { size: 16 }), t.streetAdd] })] })] }) }), _jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.streetName }), _jsx(TableHead, { children: t.streetPhone }), _jsx(TableHead, { children: t.streetAddress }), _jsx(TableHead, { className: "text-right", children: t.actions })] }) }), _jsx(TableBody, { children: filtered.length === 0 ? (_jsx(TableEmpty, { colSpan: 4, message: t.noData })) : (filtered.map((s) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("button", { type: "button", className: "text-left font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300", onClick: () => openSupplierPurchaseDetail(s), children: s.fullName }) }), _jsx(TableCell, { className: "font-mono text-xs", children: s.phone }), _jsx(TableCell, { className: "max-w-[16rem] truncate text-slate-500 dark:text-slate-400", children: s.address || '—' }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "inline-flex flex-wrap items-center justify-end gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => openEdit(s), "aria-label": t.edit, children: _jsx(Pencil, { size: 14 }) }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => setConfirmDelete(s), "aria-label": t.delete, className: "hover:text-red-600 dark:hover:text-red-400", children: _jsx(Trash2, { size: 14 }) })] }) })] }, s.id)))) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: filtered.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.noData })) : (filtered.map((s) => (_jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white", children: _jsx(Truck, { size: 16 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("button", { type: "button", className: "truncate text-left text-sm font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300", onClick: () => openSupplierPurchaseDetail(s), children: s.fullName }), _jsxs("p", { className: "mt-1 flex items-center gap-1.5 text-xs text-slate-500", children: [_jsx(Phone, { size: 12, className: "text-slate-400" }), _jsx("span", { className: "font-mono", children: s.phone })] }), s.address && (_jsxs("p", { className: "mt-1 flex items-start gap-1.5 text-xs text-slate-500", children: [_jsx(MapPin, { size: 12, className: "mt-0.5 shrink-0 text-slate-400" }), _jsx("span", { className: "line-clamp-2", children: s.address })] }))] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700", children: [_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => openEdit(s), children: [_jsx(Pencil, { size: 14 }), t.edit] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setConfirmDelete(s), className: "hover:text-red-600", children: [_jsx(Trash2, { size: 14 }), t.delete] })] })] }, s.id)))) })] }), _jsxs(TabsContent, { value: "history", className: "mt-0 space-y-4", children: [_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end", children: [_jsxs("div", { className: "relative min-w-0 flex-1", children: [_jsx(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx(Input, { value: historySearch, onChange: (e) => setHistorySearch(e.target.value), placeholder: t.streetHistorySearch, className: "pl-9" })] }), _jsxs("div", { className: "w-full shrink-0 sm:w-56", children: [_jsx(Label, { className: "text-xs text-slate-500", children: t.streetHistoryFilterSupplier }), _jsxs(Select, { value: historyStreetObjectId, onValueChange: sethistoryStreetObjectId, children: [_jsx(SelectTrigger, { className: "mt-1", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__all", children: t.streetHistoryAllSuppliers }), state.streetObjects.map((s) => (_jsx(SelectItem, { value: s.id, children: s.fullName }, s.id)))] })] })] })] }) }), historyPeriodSummary && (_jsxs(Card, { className: "overflow-hidden border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40 p-0 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/20", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 border-b border-indigo-100/80 px-4 py-3.5 dark:border-indigo-900/50", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25", children: _jsx(Receipt, { size: 18 }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.streetHistoryPeriodSummary }), _jsx("p", { className: "mt-0.5 text-xs text-slate-500 dark:text-slate-400", children: historyPeriodLabel }), historyPeriodSummary.batchCount > 0 && (_jsxs("p", { className: "mt-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600/80 dark:text-indigo-400/80", children: [formatNumber(historyPeriodSummary.batchCount), " ", t.streetHistoryProductCount] }))] })] }), historyPeriodSummary.products.length > 0 && (_jsxs("div", { className: "shrink-0 rounded-xl border border-indigo-100/90 bg-white/80 px-3 py-2 text-right shadow-sm dark:border-indigo-900/50 dark:bg-slate-800/80", children: [_jsx("p", { className: "text-[10px] font-medium uppercase tracking-wide text-slate-500", children: t.streetHistoryPeriodGrandTotal }), _jsx("p", { className: "nums text-lg font-bold leading-none text-indigo-800 dark:text-indigo-300", children: historyPeriodSummary.totalAmount > 0
                                                            ? `${formatNumber(historyPeriodSummary.totalAmount)} so'm`
                                                            : '—' }), historyPeriodSummary.totalKg > 0 && (_jsxs("p", { className: "mt-1 nums text-xs font-semibold text-indigo-600 dark:text-indigo-400", children: [formatQuantity(historyPeriodSummary.totalKg, 'kg'), " kg"] }))] }))] }), _jsx("div", { className: "p-4", children: historyPeriodSummary.products.length === 0 ? (_jsx("p", { className: "py-4 text-center text-sm text-slate-500 dark:text-slate-400", children: t.streetHistoryPeriodEmpty })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500", children: t.streetHistoryPeriodByProduct }), _jsx("div", { className: "hidden overflow-hidden rounded-xl border border-indigo-100/80 md:block dark:border-indigo-900/40", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-indigo-100/80 bg-indigo-50/50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-indigo-900/40 dark:bg-indigo-950/30", children: [_jsx("th", { className: "px-3 py-2", children: t.streetHistoryColProduct }), _jsx("th", { className: "px-3 py-2 text-right", children: t.streetHistoryColQty }), _jsx("th", { className: "px-3 py-2 text-right", children: t.streetHistoryColTotal })] }) }), _jsx("tbody", { children: historyPeriodSummary.products.map((item) => (_jsxs("tr", { className: "border-b border-slate-100 last:border-0 dark:border-slate-800", children: [_jsx("td", { className: "px-3 py-2.5 font-medium text-slate-800 dark:text-white", children: item.name }), _jsxs("td", { className: "nums px-3 py-2.5 text-right text-slate-600 dark:text-slate-300", children: [formatQuantity(item.qty, item.unit), ' ', item.unit === 'kg' ? 'kg' : t.unitPcs] }), _jsx("td", { className: "nums px-3 py-2.5 text-right font-semibold text-indigo-800 dark:text-indigo-300", children: item.amount > 0 ? `${formatNumber(item.amount)} so'm` : '—' })] }, item.name))) })] }) }), _jsx("div", { className: "space-y-2 md:hidden", children: historyPeriodSummary.products.map((item) => (_jsxs("div", { className: "rounded-xl border border-indigo-100/90 bg-white/90 px-3 py-2.5 dark:border-indigo-900/40 dark:bg-slate-800/90", children: [_jsx("p", { className: "text-sm font-medium text-slate-800 dark:text-white", children: item.name }), _jsxs("div", { className: "mt-1.5 flex items-center justify-between gap-2 text-sm", children: [_jsxs("span", { className: "nums text-slate-600 dark:text-slate-300", children: [formatQuantity(item.qty, item.unit), ' ', item.unit === 'kg' ? 'kg' : t.unitPcs] }), _jsx("span", { className: "nums font-semibold text-indigo-800 dark:text-indigo-300", children: item.amount > 0 ? `${formatNumber(item.amount)} so'm` : '—' })] })] }, item.name))) })] })) })] })), _jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.streetHistoryColDate }), _jsx(TableHead, { children: t.streetHistoryColSupplier }), _jsx(TableHead, { children: t.streetHistoryColProducts }), _jsx(TableHead, { className: "text-right", children: t.streetHistoryColTotal }), _jsx(TableHead, { className: "text-right", children: t.streetHistoryColPaid }), _jsx(TableHead, { className: "text-right", children: t.streetHistoryColDebt }), _jsx(TableHead, { className: "w-[5.5rem] text-right", children: t.actions })] }) }), _jsx(TableBody, { children: historyGroups.length === 0 ? (_jsx(TableEmpty, { colSpan: 7, message: t.streetHistoryNoData })) : (historyGroups.map((g) => {
                                                const { totalAmount, paid, debt } = batchMoneyTotals(g);
                                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "whitespace-nowrap text-xs text-slate-600 dark:text-slate-300", children: formatDate(g.incomeDate) }), _jsxs(TableCell, { className: "max-w-[10rem]", children: [_jsx("span", { className: "font-medium text-slate-800 dark:text-white", children: g.streetObjectName }), !g.streetObjectId && (_jsxs("span", { className: "ml-1 text-[10px] text-slate-400", children: ["(", t.streetHistoryDeletedSupplier, ")"] }))] }), _jsxs(TableCell, { className: "max-w-[22rem]", children: [_jsx("p", { className: "text-sm font-medium leading-snug text-slate-800 dark:text-white", children: summarizeBatchProducts(g.lines) }), _jsxs("p", { className: "mt-0.5 text-[10px] text-slate-400", children: [g.lines.length, " ", t.streetHistoryProductCount] })] }), _jsx(TableCell, { className: "nums text-right font-semibold text-slate-800 dark:text-white", children: totalAmount > 0 ? `${formatNumber(totalAmount)} so'm` : '—' }), _jsx(TableCell, { className: "nums text-right text-slate-600 dark:text-slate-300", children: paid > 0 || totalAmount > 0 ? `${formatNumber(paid)} so'm` : '—' }), _jsx(TableCell, { className: "nums text-right text-amber-700 dark:text-amber-300", children: debt > 1e-6 ? `${formatNumber(debt)} so'm` : '—' }), _jsx(TableCell, { className: "text-right", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 text-slate-500 hover:text-sky-600", "aria-label": t.streetEditPurchaseTitle, onClick: () => setHistoryEditBatch(g), children: _jsx(Pencil, { size: 15 }) }) })] }, g.batchId));
                                            })) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: historyGroups.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.streetHistoryNoData })) : (historyGroups.map((g) => {
                                    const { totalAmount, paid, debt } = batchMoneyTotals(g);
                                    return (_jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "mb-2 flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-800 dark:text-white", children: g.streetObjectName }), _jsx("p", { className: "text-xs text-slate-500", children: formatDate(g.incomeDate) })] }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 shrink-0 text-slate-500", "aria-label": t.streetEditPurchaseTitle, onClick: () => setHistoryEditBatch(g), children: _jsx(Pencil, { size: 15 }) })] }), _jsx("p", { className: "text-sm leading-snug text-slate-700 dark:text-slate-200", children: summarizeBatchProducts(g.lines) }), _jsxs("p", { className: "mt-2 text-xs text-slate-500", children: [g.lines.length, " ", t.streetHistoryProductCount] }), _jsxs("div", { className: "mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-700", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: t.streetHistoryColTotal }), _jsx("span", { className: "nums font-semibold", children: totalAmount > 0 ? `${formatNumber(totalAmount)} so'm` : '—' })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: t.streetHistoryColPaid }), _jsx("span", { className: "nums", children: paid > 0 ? `${formatNumber(paid)} so'm` : '—' })] }), debt > 1e-6 && (_jsxs("div", { className: "flex justify-between text-amber-700 dark:text-amber-300", children: [_jsx("span", { children: t.streetHistoryColDebt }), _jsxs("span", { className: "nums font-medium", children: [formatNumber(debt), " so'm"] })] }))] })] }, g.batchId));
                                })) })] }), _jsxs(TabsContent, { value: "debts", className: "mt-0 space-y-4", children: [_jsx(Card, { className: "border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/25", children: _jsx("p", { className: "text-sm text-amber-950 dark:text-amber-100", children: t.streetDebtIntro }) }), getOrphanStreetDebtIncurred(state) > 1e-6 && (_jsx(Card, { className: "border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-800 dark:bg-amber-950/40", children: _jsxs("p", { className: "text-sm text-amber-900 dark:text-amber-100", children: [t.streetDebtOrphanBanner, ' ', _jsxs("span", { className: "nums font-semibold", children: [formatNumber(getOrphanStreetDebtIncurred(state)), " so'm"] })] }) })), state.streetObjects.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.streetDebtNoSuppliers })) : (_jsxs(_Fragment, { children: [_jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.streetName }), _jsx(TableHead, { children: t.streetPhone }), _jsx(TableHead, { className: "text-right", children: t.streetDebtColRemaining }), _jsx(TableHead, { className: "text-right", children: t.actions })] }) }), _jsx(TableBody, { children: state.streetObjects.map((s) => {
                                                        const rem = getStreetObjectRemainingDebt(state, s.id);
                                                        return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium text-slate-800 dark:text-white", children: s.fullName }), _jsx(TableCell, { className: "font-mono text-xs", children: s.phone }), _jsx(TableCell, { className: `nums text-right font-semibold ${rem > 1e-6 ? 'text-amber-800 dark:text-amber-200' : 'text-slate-400'}`, children: rem > 1e-6 ? `${formatNumber(rem)} so'm` : '—' }), _jsx(TableCell, { className: "text-right", children: _jsx(Button, { type: "button", size: "sm", variant: "secondary", disabled: rem <= 1e-6, onClick: () => openDebtRepay(s.id), children: t.streetDebtPayBtn }) })] }, s.id));
                                                    }) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: state.streetObjects.map((s) => {
                                            const rem = getStreetObjectRemainingDebt(state, s.id);
                                            return (_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-semibold text-slate-800 dark:text-white", children: s.fullName }), _jsxs("p", { className: "mt-1 flex items-center gap-1.5 text-xs text-slate-500", children: [_jsx(Phone, { size: 12, className: "shrink-0 text-slate-400" }), _jsx("span", { className: "font-mono", children: s.phone })] }), _jsxs("p", { className: `mt-2 nums text-sm ${rem > 1e-6 ? 'font-bold text-amber-800 dark:text-amber-200' : 'text-slate-400'}`, children: [t.streetDebtColRemaining, ": ", rem > 1e-6 ? `${formatNumber(rem)} so'm` : '—'] })] }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", className: "shrink-0", disabled: rem <= 1e-6, onClick: () => openDebtRepay(s.id), children: t.streetDebtPayBtn })] }) }, s.id));
                                        }) })] })), _jsxs(Card, { className: "hidden overflow-hidden md:block", children: [_jsx("div", { className: "border-b border-slate-100 px-4 py-3 dark:border-slate-800", children: _jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.streetDebtRepayHistory }) }), _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.streetDebtRepayColDate }), _jsx(TableHead, { children: t.streetDebtRepayColSupplier }), _jsx(TableHead, { className: "text-right", children: t.streetDebtRepayColAmount })] }) }), _jsx(TableBody, { children: sortedDebtRepayments.length === 0 ? (_jsx(TableEmpty, { colSpan: 3, message: t.streetHistoryNoData })) : (sortedDebtRepayments.map((r) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "whitespace-nowrap text-xs text-slate-600 dark:text-slate-300", children: formatDate(r.date) }), _jsx(TableCell, { className: "font-medium text-slate-800 dark:text-white", children: r.streetObjectName }), _jsxs(TableCell, { className: "nums text-right font-semibold text-emerald-700 dark:text-emerald-300", children: [formatNumber(r.amount), " so'm"] })] }, r.id)))) })] })] }), _jsxs("div", { className: "space-y-3 md:hidden", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.streetDebtRepayHistory }), sortedDebtRepayments.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.streetHistoryNoData })) : (sortedDebtRepayments.map((r) => (_jsxs(Card, { className: "p-4", children: [_jsx("p", { className: "text-sm font-medium text-slate-800 dark:text-white", children: r.streetObjectName }), _jsx("p", { className: "mt-1 text-[11px] text-slate-500", children: formatDate(r.date) }), _jsxs("p", { className: "mt-2 nums text-base font-bold text-emerald-700 dark:text-emerald-300", children: [formatNumber(r.amount), " so'm"] }), r.notes && _jsx("p", { className: "mt-1 text-xs text-slate-500", children: r.notes })] }, r.id))))] })] })] }), _jsx(Dialog, { open: dialogOpen, onOpenChange: setDialogOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: editing ? t.streetEdit : t.streetAdd }), _jsx(DialogDescription, {})] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.streetName, " *"] }), _jsx(Input, { value: form.fullName, onChange: (e) => setForm((f) => ({ ...f, fullName: e.target.value })), className: "mt-1.5", autoFocus: true })] }), _jsxs("div", { children: [_jsxs(Label, { children: [t.streetPhone, " *"] }), _jsx(Input, { value: form.phone, onChange: (e) => setForm((f) => ({ ...f, phone: e.target.value })), className: "mt-1.5" })] }), _jsxs("div", { children: [_jsx(Label, { children: t.streetAddress }), _jsx(Input, { value: form.address, onChange: (e) => setForm((f) => ({ ...f, address: e.target.value })), className: "mt-1.5" })] }), _jsxs("div", { children: [_jsx(Label, { children: t.notes }), _jsx(Input, { value: form.notes, onChange: (e) => setForm((f) => ({ ...f, notes: e.target.value })), className: "mt-1.5" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setDialogOpen(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.save })] })] })] }) }), _jsx(Dialog, { open: purchaseOpen, onOpenChange: (open) => {
                    if (open) {
                        setPurchaseOpen(true);
                        return;
                    }
                    requestClosePurchaseDialog();
                }, children: _jsxs(DialogContent, { className: "max-h-[90vh] overflow-y-auto sm:max-w-xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t.streetPurchaseTitle }), _jsxs(DialogDescription, { className: "space-y-2 text-pretty", children: [purchaseSelectedStreetObject ? (_jsx("span", { className: "font-medium text-slate-800 dark:text-slate-100", children: purchaseSelectedStreetObject.fullName })) : null, _jsx("span", { className: "block", children: t.streetPurchaseDesc }), _jsx("span", { className: "block text-slate-600 dark:text-slate-300", children: t.streetPurchaseParentNote })] })] }), _jsxs("form", { onSubmit: handlePurchaseSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.streetPurchasePickSupplier, " *"] }), _jsxs(Select, { value: purchaseForm.streetObjectId || undefined, onValueChange: (v) => setPurchaseForm((f) => ({ ...f, streetObjectId: v })), children: [_jsx(SelectTrigger, { className: "mt-1.5", children: _jsx(SelectValue, { placeholder: t.streetPurchasePickSupplier }) }), _jsx(SelectContent, { children: state.streetObjects.map((s) => (_jsx(SelectItem, { value: s.id, children: s.fullName }, s.id))) })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t.whIncomeDate }), _jsx(Input, { type: "date", value: purchaseForm.incomeDate, onChange: (e) => setPurchaseForm((f) => ({ ...f, incomeDate: e.target.value })), className: "mt-1.5 max-w-[12rem]" })] }), warehousePurchaseOptions.length === 0 ? (_jsx("p", { className: "text-sm text-amber-700 dark:text-amber-300", children: t.streetNoParentProducts })) : (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t.streetPurchaseLinesTitle }), (() => {
                                            const editingLine = purchaseForm.lines.find((l) => l.key === purchaseEditingKey) ??
                                                purchaseForm.lines[purchaseForm.lines.length - 1];
                                            const collapsedLines = purchaseForm.lines.filter((l) => l.key !== editingLine?.key &&
                                                l.warehouseItemId &&
                                                lineQtyTotal(l, false) > 0);
                                            const { w: editW, lineTotal: editTotal } = editingLine
                                                ? parseDraftLine(editingLine)
                                                : { w: undefined, lineTotal: null };
                                            return (_jsxs(_Fragment, { children: [collapsedLines.map((line) => {
                                                        const { w, qtyNum, priceNum, lineTotal } = parseDraftLine(line);
                                                        const unitLbl = w?.unit === 'kg' ? 'kg' : t.unitPcs;
                                                        return (_jsxs("div", { className: "flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/40", children: [_jsxs("div", { className: "min-w-0 flex-1 text-sm leading-snug", children: [_jsx("span", { className: "font-medium text-slate-800 dark:text-slate-100", children: w ? warehouseProductTitle(w) : '—' }), qtyNum != null && (_jsxs("span", { className: "text-slate-600 dark:text-slate-300", children: [' ', "\u00B7", ' ', _jsxs("span", { className: "nums", children: [formatQuantity(qtyNum, w?.unit ?? 'kg'), " ", unitLbl] }), priceNum != null && (_jsxs(_Fragment, { children: [' ', "\u00B7", ' ', _jsxs("span", { className: "nums", children: [formatNumber(priceNum), " so'm/", unitLbl] })] })), lineTotal != null && (_jsxs(_Fragment, { children: [' ', "\u00B7", ' ', _jsxs("span", { className: "nums font-semibold text-slate-800 dark:text-white", children: [formatNumber(lineTotal), " so'm"] })] }))] }))] }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 shrink-0 text-slate-500 hover:text-sky-600", "aria-label": t.posEditOrder, onClick: () => setPurchaseEditingKey(line.key), children: _jsx(Pencil, { size: 15 }) }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 shrink-0 text-slate-500 hover:text-red-600", "aria-label": t.delete, onClick: () => removePurchaseLine(line.key), children: _jsx(Trash2, { size: 15 }) })] }, line.key));
                                                    }), editingLine && (_jsxs("div", { className: "space-y-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3 dark:border-sky-900/50 dark:bg-sky-950/20", children: [_jsxs(Label, { className: "text-xs", children: [t.streetPurchasePickParent, " *"] }), _jsxs(Select, { value: editingLine.warehouseItemId || undefined, onValueChange: (v) => selectPurchaseWarehouse(editingLine.key, v), children: [_jsx(SelectTrigger, { className: "rounded-xl", children: _jsx(SelectValue, { placeholder: t.streetPurchasePickParent }) }), _jsx(SelectContent, { className: "max-h-72", children: warehousePurchaseOptions.map((opt) => (_jsx(SelectItem, { value: opt.id, children: warehouseSessionLabel(opt) }, opt.id))) })] }), editW && (_jsx("p", { className: "text-[10px] text-slate-500", children: t.streetPurchaseSessionQtyHint })), _jsxs("div", { className: "space-y-2", children: [_jsx(CumulativeQuantityField, { label: _jsxs(_Fragment, { children: [t.whQuantity, " *"] }), quantity: editingLine.quantity, qtyParts: editingLine.qtyParts, unit: editW?.unit ?? 'kg', unitLabel: editW?.unit === 'pcs' ? t.unitPcs : 'kg', runningTotalLabel: t.streetQtyRunningTotal, addAriaLabel: t.streetQtyAddPart, placeholder: editW?.unit === 'kg' ? '2,3' : '5', pcsHint: editW?.unit === 'pcs' ? t.streetPurchasePcsWhole : undefined, onQuantityChange: (value) => updatePurchaseLine(editingLine.key, { quantity: value }), onAddPart: () => appendPurchaseQtyPart(editingLine.key) }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.streetPricePerUnit }), _jsx(Input, { value: editingLine.pricePerUnit, onChange: (e) => updatePurchaseLine(editingLine.key, {
                                                                                    pricePerUnit: e.target.value,
                                                                                }), className: "mt-1 rounded-xl", inputMode: "decimal" })] })] }), _jsxs("p", { className: "text-xs text-slate-600 dark:text-slate-300", children: [t.streetLineTotal, ":", ' ', _jsx("span", { className: "nums font-semibold", children: editTotal != null ? `${formatNumber(editTotal)} so'm` : '—' })] })] }))] }));
                                        })()] })), purchaseByProductSummary.length > 0 && (_jsxs("div", { className: "rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/30", children: [_jsx("p", { className: "text-xs font-medium text-indigo-800 dark:text-indigo-200", children: t.streetByProductSummary }), _jsx("ul", { className: "mt-2 space-y-1.5 text-sm", children: purchaseByProductSummary.map((g) => (_jsxs("li", { className: "flex flex-wrap items-baseline justify-between gap-2 text-slate-800 dark:text-slate-100", children: [_jsx("span", { className: "min-w-0 truncate font-medium", children: g.label }), _jsxs("span", { className: "nums shrink-0 text-right text-xs sm:text-sm", children: [formatQuantity(g.qty, g.unit), " ", g.unit === 'kg' ? 'kg' : t.unitPcs, g.hasPrice ? ` · ${formatNumber(g.amount)} so'm` : ''] })] }, g.id))) })] })), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40", children: [_jsx("p", { className: "text-xs text-slate-500", children: t.streetPurchaseGrandTotal }), _jsx("p", { className: "nums text-lg font-semibold text-slate-900 dark:text-slate-100", children: purchaseOrderTotal != null ? `${formatNumber(purchaseOrderTotal)} so'm` : '—' })] }), _jsxs("div", { children: [_jsxs(Label, { children: [t.streetPaidAmount, purchaseOrderTotal != null ? ' *' : ''] }), _jsx(Input, { value: purchaseForm.paidAmount, onChange: (e) => setPurchaseForm((f) => ({ ...f, paidAmount: e.target.value })), className: "mt-1.5", placeholder: "0", inputMode: "decimal", disabled: purchaseOrderTotal == null || !purchaseForm.onCredit }), purchaseForm.onCredit && purchaseOrderTotal != null && debtPreviewSo != null && (_jsxs("p", { className: "mt-1 text-xs font-medium text-amber-800 dark:text-amber-200", children: [t.streetDebtPreview, ": ", formatNumber(debtPreviewSo), " so'm"] }))] }), _jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700", children: [_jsx("input", { type: "checkbox", className: "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600", checked: purchaseForm.onCredit, onChange: (e) => setPurchaseForm((f) => ({ ...f, onCredit: e.target.checked })) }), _jsx("span", { className: "text-sm leading-snug text-slate-700 dark:text-slate-300", children: t.streetOnCredit })] }), _jsxs("div", { children: [_jsx(Label, { children: t.notes }), _jsx(Input, { value: purchaseForm.notes, onChange: (e) => setPurchaseForm((f) => ({ ...f, notes: e.target.value })), className: "mt-1.5" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setPurchaseDiscardConfirmOpen(true), children: t.cancel }), _jsx(Button, { type: "submit", children: t.streetPurchaseSubmit })] })] })] }) }), _jsx(AlertDialog, { open: purchaseDiscardConfirmOpen, onOpenChange: setPurchaseDiscardConfirmOpen, children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.streetPurchaseDiscardTitle }), _jsx(AlertDialogDescription, { children: t.streetPurchaseDiscardDesc })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: closePurchaseDialog, children: t.confirm })] })] }) }), _jsx(Dialog, { open: debtRepayOpen, onOpenChange: (open) => {
                    setDebtRepayOpen(open);
                    if (!open) {
                        setDebtRepayStreetObjectId('');
                        setDebtRepayAmount('');
                        setDebtRepayDate(TODAY);
                        setDebtRepayNotes('');
                    }
                }, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t.streetDebtPayDialogTitle }), _jsxs(DialogDescription, { className: "space-y-2", children: [_jsx("span", { className: "block font-medium text-slate-800 dark:text-slate-100", children: state.streetObjects.find((s) => s.id === debtRepayStreetObjectId)?.fullName ?? '' }), _jsxs("span", { className: "block text-sm text-slate-600 dark:text-slate-300", children: [t.streetDebtColRemaining, ":", ' ', _jsxs("span", { className: "nums font-semibold text-amber-800 dark:text-amber-200", children: [formatNumber(debtRepayRemaining), " so'm"] })] })] })] }), _jsxs("form", { onSubmit: handleDebtRepaySubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { children: [t.streetDebtPayAmount, " *"] }), _jsx(Input, { value: debtRepayAmount, onChange: (e) => setDebtRepayAmount(e.target.value), className: "mt-1.5", inputMode: "decimal", autoFocus: true })] }), _jsxs("div", { children: [_jsx(Label, { children: t.streetDebtPayDate }), _jsx(Input, { type: "date", value: debtRepayDate, onChange: (e) => setDebtRepayDate(e.target.value), className: "mt-1.5" })] }), _jsxs("div", { children: [_jsx(Label, { children: t.streetDebtPayNotes }), _jsx(Input, { value: debtRepayNotes, onChange: (e) => setDebtRepayNotes(e.target.value), className: "mt-1.5" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setDebtRepayOpen(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.streetDebtPaySubmit })] })] })] }) }), _jsx(Dialog, { open: streetObjectDetailOpen, onOpenChange: (open) => {
                    setstreetObjectDetailOpen(open);
                    if (!open)
                        setstreetObjectDetail(null);
                }, children: _jsxs(DialogContent, { className: "max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: streetObjectDetail?.fullName ?? '' }), _jsx(DialogDescription, { children: t.streetSupplierPurchasesDialogDesc })] }), _jsx("div", { className: "hidden max-h-[min(55vh,28rem)] overflow-auto md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.streetHistoryColDate }), _jsx(TableHead, { children: t.streetHistoryColProducts }), _jsx(TableHead, { className: "text-right", children: t.streetHistoryColTotal }), _jsx(TableHead, { className: "text-right", children: t.streetHistoryColPaid }), _jsx(TableHead, { className: "text-right", children: t.streetHistoryColDebt }), _jsx(TableHead, { className: "w-[3rem]" })] }) }), _jsx(TableBody, { children: streetObjectDetailPurchaseGroups.length === 0 ? (_jsx(TableEmpty, { colSpan: 6, message: t.streetHistoryNoData })) : (streetObjectDetailPurchaseGroups.map((g) => {
                                            const { totalAmount, paid, debt } = batchMoneyTotals(g);
                                            return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "whitespace-nowrap text-xs text-slate-600 dark:text-slate-300", children: formatDate(g.incomeDate) }), _jsxs(TableCell, { className: "max-w-[20rem]", children: [_jsx("p", { className: "text-sm font-medium leading-snug", children: summarizeBatchProducts(g.lines) }), _jsxs("p", { className: "text-[10px] text-slate-400", children: [g.lines.length, " ", t.streetHistoryProductCount] })] }), _jsx(TableCell, { className: "nums text-right font-semibold", children: totalAmount > 0 ? `${formatNumber(totalAmount)} so'm` : '—' }), _jsx(TableCell, { className: "nums text-right text-slate-600 dark:text-slate-300", children: paid > 0 || totalAmount > 0 ? `${formatNumber(paid)} so'm` : '—' }), _jsx(TableCell, { className: "nums text-right text-amber-700 dark:text-amber-300", children: debt > 1e-6 ? `${formatNumber(debt)} so'm` : '—' }), _jsx(TableCell, { children: _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => setHistoryEditBatch(g), children: _jsx(Pencil, { size: 15 }) }) })] }, g.batchId));
                                        })) })] }) }), _jsx("div", { className: "max-h-[min(50vh,24rem)] space-y-3 overflow-y-auto md:hidden", children: streetObjectDetailPurchaseGroups.length === 0 ? (_jsx("p", { className: "py-6 text-center text-sm text-slate-400", children: t.streetHistoryNoData })) : (streetObjectDetailPurchaseGroups.map((g) => {
                                const { totalAmount, paid, debt } = batchMoneyTotals(g);
                                return (_jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "mb-2 flex justify-between", children: [_jsx("span", { className: "text-xs text-slate-500", children: formatDate(g.incomeDate) }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => setHistoryEditBatch(g), children: _jsx(Pencil, { size: 15 }) })] }), _jsx("p", { className: "text-sm leading-snug", children: summarizeBatchProducts(g.lines) }), _jsx("p", { className: "mt-2 nums font-semibold", children: totalAmount > 0 ? `${formatNumber(totalAmount)} so'm` : '—' }), debt > 1e-6 && (_jsxs("p", { className: "text-xs text-amber-700", children: [t.streetHistoryColDebt, ": ", formatNumber(debt), " so'm"] }))] }, g.batchId));
                            })) }), _jsxs(DialogFooter, { className: "flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setstreetObjectDetailOpen(false), children: t.cancel }), streetObjectDetail ? (_jsxs(Button, { type: "button", variant: "secondary", className: "gap-1.5", onClick: () => {
                                        setstreetObjectDetailOpen(false);
                                        setMainTab('history');
                                        sethistoryStreetObjectId(streetObjectDetail.id);
                                    }, children: [_jsx(History, { size: 16 }), t.streetOpenInHistoryTab] })) : null] })] }) }), _jsx(StreetObjectPurchaseEditDialog, { batch: historyEditBatch, open: Boolean(historyEditBatch), onOpenChange: (o) => {
                    if (!o)
                        setHistoryEditBatch(null);
                }, warehouseOptions: warehousePurchaseOptions, warehouseProductTitle: warehouseProductTitle, prefPrice: prefPurchasePrice }), _jsx(AlertDialog, { open: Boolean(confirmDelete), onOpenChange: () => setConfirmDelete(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.streetDeleteConfirm }), _jsx(AlertDialogDescription, { children: confirmDelete?.fullName })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDelete, children: t.confirm })] })] }) })] }));
}
