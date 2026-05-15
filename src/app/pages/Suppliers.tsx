import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  MapPin,
  Truck,
  ShoppingBag,
  History,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useStore,
  type Supplier,
  type WarehouseItem,
  getSupplierRemainingDebt,
  getOrphanSupplierDebtIncurred,
} from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { categoryLabel, categoryMeta } from '../utils/category';
import { formatDate, formatNumber, TODAY } from '../utils/format';

interface SupplierFormState {
  fullName: string;
  phone: string;
  address: string;
  notes: string;
}

const EMPTY_SUPPLIER: SupplierFormState = {
  fullName: '',
  phone: '',
  address: '',
  notes: '',
};

interface PurchaseFormState {
  supplierId: string;
  parentWarehouseItemId: string;
  quantity: string;
  incomeDate: string;
  pricePerUnit: string;
  paidAmount: string;
  onCredit: boolean;
  notes: string;
}

const EMPTY_PURCHASE: PurchaseFormState = {
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
  const {
    state,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    purchaseFromSupplier,
    recordSupplierDebtRepayment,
  } = useStore();
  const { t } = useApp();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormState>(EMPTY_SUPPLIER);
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(EMPTY_PURCHASE);

  const [mainTab, setMainTab] = useState<'list' | 'history' | 'debts'>('list');
  const [historySearch, setHistorySearch] = useState('');
  const [historySupplierId, setHistorySupplierId] = useState<string>('__all');

  const [debtRepayOpen, setDebtRepayOpen] = useState(false);
  const [debtRepaySupplierId, setDebtRepaySupplierId] = useState('');
  const [debtRepayAmount, setDebtRepayAmount] = useState('');
  const [debtRepayDate, setDebtRepayDate] = useState(TODAY);
  const [debtRepayNotes, setDebtRepayNotes] = useState('');

  const [supplierDetailOpen, setSupplierDetailOpen] = useState(false);
  const [supplierDetail, setSupplierDetail] = useState<Supplier | null>(null);

  const debtTabBadgeCount = useMemo(() => {
    let n = state.suppliers.filter((s) => getSupplierRemainingDebt(state, s.id) > 1e-6).length;
    if (getOrphanSupplierDebtIncurred(state) > 1e-6) n += 1;
    return n;
  }, [state.suppliers, state.supplierPurchases, state.supplierDebtRepayments]);

  const sortedDebtRepayments = useMemo(
    () =>
      [...state.supplierDebtRepayments].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      ),
    [state.supplierDebtRepayments],
  );

  const supplierDetailPurchases = useMemo(() => {
    if (!supplierDetail) return [];
    return state.supplierPurchases
      .filter((p) => p.supplierId === supplierDetail.id)
      .slice()
      .sort(
        (a, b) =>
          String(b.incomeDate).localeCompare(String(a.incomeDate)) ||
          String(b.createdAt).localeCompare(String(a.createdAt)),
      );
  }, [state.supplierPurchases, supplierDetail]);

  const debtRepayRemaining = useMemo(() => {
    if (!debtRepaySupplierId) return 0;
    return getSupplierRemainingDebt(state, debtRepaySupplierId);
  }, [state, debtRepaySupplierId]);

  /** Ombor tartibi: avval ota, keyin uning ajratilgan bolalari. */
  const warehousePurchaseOptions = useMemo(() => {
    const items = state.warehouseItems;
    const roots = items
      .filter((w) => !w.parentWarehouseId)
      .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }));
    const out: WarehouseItem[] = [];
    const seen = new Set<string>();
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
      if (!seen.has(w.id)) out.push(w);
    }
    return out;
  }, [state.warehouseItems]);

  const warehousePurchaseLabel = (w: WarehouseItem) => {
    const qty = `${formatNumber(w.currentQty)} ${w.unit}`;
    if (!w.parentWarehouseId) return `${w.productName} (${qty})`;
    const parent = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
    return `└ ${w.productName} · ${parent?.productName ?? '—'} (${qty})`;
  };

  const prefPurchasePrice = (w: WarehouseItem | undefined) => {
    if (!w) return '';
    const own =
      w.purchasePricePerUnit != null && Number.isFinite(w.purchasePricePerUnit) && w.purchasePricePerUnit > 0
        ? w.purchasePricePerUnit
        : null;
    if (own != null) return String(own);
    if (w.parentWarehouseId) {
      const parent = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
      if (
        parent?.purchasePricePerUnit != null &&
        Number.isFinite(parent.purchasePricePerUnit) &&
        parent.purchasePricePerUnit > 0
      ) {
        return String(parent.purchasePricePerUnit);
      }
    }
    return '';
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.suppliers;
    return state.suppliers.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q),
    );
  }, [state.suppliers, search]);

  const purchaseSelectedSupplier = useMemo(
    () => state.suppliers.find((s) => s.id === purchaseForm.supplierId),
    [state.suppliers, purchaseForm.supplierId],
  );

  const purchaseSelectedParent = useMemo(
    () => state.warehouseItems.find((w) => w.id === purchaseForm.parentWarehouseItemId),
    [state.warehouseItems, purchaseForm.parentWarehouseItemId],
  );

  const purchaseQtyNum = useMemo(() => {
    const raw = purchaseForm.quantity.trim().replace(',', '.');
    if (!raw) return null;
    const v = parseFloat(raw);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [purchaseForm.quantity]);

  const purchasePriceNum = useMemo(() => {
    const raw = purchaseForm.pricePerUnit.trim().replace(',', '.');
    if (!raw) return null;
    const v = parseFloat(raw);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [purchaseForm.pricePerUnit]);

  const purchaseLineTotal = useMemo(() => {
    if (purchasePriceNum == null || purchaseQtyNum == null) return null;
    return purchasePriceNum * purchaseQtyNum;
  }, [purchasePriceNum, purchaseQtyNum]);

  const debtPreviewSo = useMemo(() => {
    if (purchaseLineTotal == null) return null;
    const payRaw = purchaseForm.paidAmount.trim().replace(',', '.');
    const paid =
      payRaw === '' ? 0 : Number.isFinite(parseFloat(payRaw)) ? Math.max(0, parseFloat(payRaw)) : null;
    if (paid == null) return null;
    return Math.max(0, purchaseLineTotal - paid);
  }, [purchaseLineTotal, purchaseForm.paidAmount]);

  useEffect(() => {
    if (!purchaseOpen || purchaseForm.onCredit || purchaseLineTotal == null) return;
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
      rows = rows.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          String(p.category).toLowerCase().includes(q),
      );
    }
    return rows;
  }, [state.supplierPurchases, historySearch, historySupplierId]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SUPPLIER);
    setDialogOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
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

  const openSupplierPurchaseDetail = (s: Supplier) => {
    setSupplierDetail(s);
    setSupplierDetailOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
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
    } else {
      addSupplier(trimmed);
      toast.success(t.add);
    }
    setDialogOpen(false);
    setForm(EMPTY_SUPPLIER);
    setEditing(null);
  };

  const handlePurchaseSubmit = (e: React.FormEvent) => {
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
    const warehouseItem = state.warehouseItems.find((w) => w.id === purchaseForm.parentWarehouseItemId);
    if (!warehouseItem) {
      toast.error(t.required);
      return;
    }
    const qty = parseFloat(purchaseForm.quantity.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t.required);
      return;
    }
    const priceRaw = purchaseForm.pricePerUnit.trim().replace(',', '.');
    let purchasePricePerUnit: number | null;
    if (!priceRaw) {
      purchasePricePerUnit = null;
    } else {
      const v = parseFloat(priceRaw);
      if (!Number.isFinite(v) || v <= 0) {
        toast.error(t.whValidateOptionalPrice);
        return;
      }
      purchasePricePerUnit = v;
    }
    const lineTotal =
      purchasePricePerUnit != null && Number.isFinite(purchasePricePerUnit) && purchasePricePerUnit > 0
        ? purchasePricePerUnit * qty
        : null;

    let paidNum: number | null = null;
    if (lineTotal != null) {
      const payRaw = purchaseForm.paidAmount.trim().replace(',', '.');
      if (purchaseForm.onCredit && payRaw === '') {
        paidNum = 0;
      } else if (!payRaw) {
        toast.error(t.required + ': ' + t.suppPaidAmount);
        return;
      } else {
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
      } else if (paidNum > lineTotal + 1e-6) {
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
      paidAmount: lineTotal != null ? paidNum! : undefined,
      onCredit: purchaseForm.onCredit,
    });
    if (!created) {
      if (
        warehouseItem.unit === 'pcs' &&
        Number.isFinite(qty) &&
        qty > 0 &&
        Math.abs(qty - Math.floor(qty)) > 1e-9
      ) {
        toast.error(t.suppPurchasePcsWhole);
      } else {
        toast.error(t.required);
      }
      return;
    }
    toast.success(t.suppPurchaseSuccess);
    setPurchaseOpen(false);
    setPurchaseForm(EMPTY_PURCHASE);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteSupplier(confirmDelete.id);
    toast.success(t.delete);
    setConfirmDelete(null);
  };

  const openDebtRepay = (supplierId: string) => {
    const rem = getSupplierRemainingDebt(state, supplierId);
    setDebtRepaySupplierId(supplierId);
    setDebtRepayAmount(rem > 1e-6 ? String(Math.round(rem * 100) / 100) : '');
    setDebtRepayDate(TODAY);
    setDebtRepayNotes('');
    setDebtRepayOpen(true);
  };

  const handleDebtRepaySubmit = (e: React.FormEvent) => {
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

  return (
    <div className="space-y-4">
      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(v as 'list' | 'history' | 'debts')}
        className="space-y-4"
      >
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="list" className="flex-1 gap-1.5 sm:flex-none">
            <Truck size={14} />
            {t.suppTabSuppliers}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1.5 sm:flex-none">
            <History size={14} />
            {t.suppTabHistory}
            <Badge variant="muted" className="ml-0.5 text-[10px]">
              {state.supplierPurchases.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="debts" className="flex-1 gap-1.5 sm:flex-none">
            <Wallet size={14} />
            {t.suppTabDebts}
            {debtTabBadgeCount > 0 ? (
              <Badge variant="danger" className="ml-0.5 text-[10px]">
                {debtTabBadgeCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-0 space-y-4">
          <Card className="border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/30">
            <p className="text-sm text-indigo-900 dark:text-indigo-200">{t.suppIntro}</p>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-0 flex-1 sm:min-w-[12rem]">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.suppSearchPlaceholder}
                  className="pl-9"
                />
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">
                <Button
                  type="button"
                  variant="default"
                  className="flex-1 sm:flex-none"
                  onClick={openPurchaseDialog}
                  disabled={state.suppliers.length === 0 || warehousePurchaseOptions.length === 0}
                  title={
                    warehousePurchaseOptions.length === 0 ? t.suppNoParentProducts : undefined
                  }
                >
                  <ShoppingBag size={16} />
                  {t.suppPurchase}
                </Button>
                <Button type="button" onClick={openCreate} className="flex-1 sm:flex-none">
                  <Plus size={16} />
                  {t.suppAdd}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.suppName}</TableHead>
              <TableHead>{t.suppPhone}</TableHead>
              <TableHead>{t.suppAddress}</TableHead>
              <TableHead className="text-right">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmpty colSpan={4} message={t.noData} />
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
                      onClick={() => openSupplierPurchaseDetail(s)}
                    >
                      {s.fullName}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.phone}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-slate-500 dark:text-slate-400">
                    {s.address || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={t.edit}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(s)}
                        aria-label={t.delete}
                        className="hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-400">{t.noData}</Card>
        ) : (
          filtered.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Truck size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="truncate text-left text-sm font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
                    onClick={() => openSupplierPurchaseDetail(s)}
                  >
                    {s.fullName}
                  </button>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone size={12} className="text-slate-400" />
                    <span className="font-mono">{s.phone}</span>
                  </p>
                  {s.address && (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
                      <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2">{s.address}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                  <Pencil size={14} />
                  {t.edit}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(s)} className="hover:text-red-600">
                  <Trash2 size={14} />
                  {t.delete}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder={t.suppHistorySearch}
                  className="pl-9"
                />
              </div>
              <div className="w-full shrink-0 sm:w-56">
                <Label className="text-xs text-slate-500">{t.suppHistoryFilterSupplier}</Label>
                <Select value={historySupplierId} onValueChange={setHistorySupplierId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">{t.suppHistoryAllSuppliers}</SelectItem>
                    {state.suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.suppHistoryColDate}</TableHead>
                  <TableHead>{t.suppHistoryColSupplier}</TableHead>
                  <TableHead>{t.suppHistoryColProduct}</TableHead>
                  <TableHead>{t.suppHistoryColCategory}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColQty}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColTotal}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColPaid}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColDebt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableEmpty colSpan={8} message={t.suppHistoryNoData} />
                ) : (
                  filteredHistory.map((row) => {
                    const meta = categoryMeta(row.category);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                          {formatDate(row.incomeDate)}
                        </TableCell>
                        <TableCell className="max-w-[10rem]">
                          <span className="font-medium text-slate-800 dark:text-white">{row.supplierName}</span>
                          {!row.supplierId && (
                            <span className="ml-1 text-[10px] text-slate-400">({t.suppHistoryDeletedSupplier})</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800 dark:text-white">
                          {row.productName}
                        </TableCell>
                        <TableCell>
                          <Badge className={meta.badge}>
                            {meta.emoji} {categoryLabel(row.category, t)}
                          </Badge>
                        </TableCell>
                        <TableCell className={`nums text-right font-semibold ${meta.text}`}>
                          {formatNumber(row.quantity)} {row.unit}
                        </TableCell>
                        <TableCell className="nums text-right text-slate-600 dark:text-slate-300">
                          {row.totalAmount != null && row.totalAmount > 0
                            ? `${formatNumber(row.totalAmount)} so'm`
                            : '—'}
                        </TableCell>
                        <TableCell className="nums text-right text-slate-600 dark:text-slate-300">
                          {row.paidAmount != null ? `${formatNumber(row.paidAmount)} so'm` : '—'}
                        </TableCell>
                        <TableCell className="nums text-right text-amber-700 dark:text-amber-300">
                          {row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6
                            ? `${formatNumber(row.supplierDebtAmount)} so'm`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {filteredHistory.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-400">{t.suppHistoryNoData}</Card>
            ) : (
              filteredHistory.map((row) => {
                const meta = categoryMeta(row.category);
                return (
                  <Card key={row.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg} text-lg`}
                      >
                        <span>{meta.emoji}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                          {row.productName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.supplierName}
                          {!row.supplierId && (
                            <span className="text-slate-400"> · {t.suppHistoryDeletedSupplier}</span>
                          )}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge className={meta.badge}>{categoryLabel(row.category, t)}</Badge>
                          <span className="text-[11px] text-slate-400">{formatDate(row.incomeDate)}</span>
                        </div>
                        <p className={`mt-2 nums text-base font-bold ${meta.text}`}>
                          {formatNumber(row.quantity)} {row.unit}
                        </p>
                        {row.totalAmount != null && row.totalAmount > 0 && (
                          <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {t.suppLineTotal}: {formatNumber(row.totalAmount)} so'm
                          </p>
                        )}
                        {row.paidAmount != null && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            {t.suppHistoryColPaid}: {formatNumber(row.paidAmount)} so'm
                          </p>
                        )}
                        {row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6 && (
                          <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {t.suppHistoryColDebt}: {formatNumber(row.supplierDebtAmount)} so'm
                          </p>
                        )}
                        {row.onCredit && row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6 && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {t.suppHistoryColDebt}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="debts" className="mt-0 space-y-4">
          <Card className="border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/25">
            <p className="text-sm text-amber-950 dark:text-amber-100">{t.suppDebtIntro}</p>
          </Card>

          {getOrphanSupplierDebtIncurred(state) > 1e-6 && (
            <Card className="border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                {t.suppDebtOrphanBanner}{' '}
                <span className="nums font-semibold">{formatNumber(getOrphanSupplierDebtIncurred(state))} so'm</span>
              </p>
            </Card>
          )}

          {state.suppliers.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-400">{t.suppDebtNoSuppliers}</Card>
          ) : (
            <>
              <Card className="hidden overflow-hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.suppName}</TableHead>
                      <TableHead>{t.suppPhone}</TableHead>
                      <TableHead className="text-right">{t.suppDebtColRemaining}</TableHead>
                      <TableHead className="text-right">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.suppliers.map((s) => {
                      const rem = getSupplierRemainingDebt(state, s.id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-slate-800 dark:text-white">{s.fullName}</TableCell>
                          <TableCell className="font-mono text-xs">{s.phone}</TableCell>
                          <TableCell
                            className={`nums text-right font-semibold ${
                              rem > 1e-6 ? 'text-amber-800 dark:text-amber-200' : 'text-slate-400'
                            }`}
                          >
                            {rem > 1e-6 ? `${formatNumber(rem)} so'm` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={rem <= 1e-6}
                              onClick={() => openDebtRepay(s.id)}
                            >
                              {t.suppDebtPayBtn}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              <div className="space-y-3 md:hidden">
                {state.suppliers.map((s) => {
                  const rem = getSupplierRemainingDebt(state, s.id);
                  return (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-white">{s.fullName}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone size={12} className="shrink-0 text-slate-400" />
                            <span className="font-mono">{s.phone}</span>
                          </p>
                          <p
                            className={`mt-2 nums text-sm ${
                              rem > 1e-6 ? 'font-bold text-amber-800 dark:text-amber-200' : 'text-slate-400'
                            }`}
                          >
                            {t.suppDebtColRemaining}: {rem > 1e-6 ? `${formatNumber(rem)} so'm` : '—'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="shrink-0"
                          disabled={rem <= 1e-6}
                          onClick={() => openDebtRepay(s.id)}
                        >
                          {t.suppDebtPayBtn}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          <Card className="hidden overflow-hidden md:block">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{t.suppDebtRepayHistory}</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.suppDebtRepayColDate}</TableHead>
                  <TableHead>{t.suppDebtRepayColSupplier}</TableHead>
                  <TableHead className="text-right">{t.suppDebtRepayColAmount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDebtRepayments.length === 0 ? (
                  <TableEmpty colSpan={3} message={t.suppHistoryNoData} />
                ) : (
                  sortedDebtRepayments.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(r.date)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 dark:text-white">{r.supplierName}</TableCell>
                      <TableCell className="nums text-right font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatNumber(r.amount)} so'm
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{t.suppDebtRepayHistory}</p>
            {sortedDebtRepayments.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-400">{t.suppHistoryNoData}</Card>
            ) : (
              sortedDebtRepayments.map((r) => (
                <Card key={r.id} className="p-4">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{r.supplierName}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatDate(r.date)}</p>
                  <p className="mt-2 nums text-base font-bold text-emerald-700 dark:text-emerald-300">
                    {formatNumber(r.amount)} so'm
                  </p>
                  {r.notes && <p className="mt-1 text-xs text-slate-500">{r.notes}</p>}
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.suppEdit : t.suppAdd}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t.suppName} *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <Label>{t.suppPhone} *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{t.suppAddress}</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{t.notes}</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{t.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={purchaseOpen}
        onOpenChange={(open) => {
          setPurchaseOpen(open);
          if (!open) setPurchaseForm(EMPTY_PURCHASE);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.suppPurchaseTitle}</DialogTitle>
            <DialogDescription className="space-y-2 text-pretty">
              {purchaseSelectedSupplier ? (
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {purchaseSelectedSupplier.fullName}
                </span>
              ) : null}
              {purchaseSelectedParent ? (
                <span className="block font-medium text-slate-800 dark:text-slate-100">
                  {purchaseSelectedParent.productName}
                </span>
              ) : null}
              <span className="block">{t.suppPurchaseDesc}</span>
              <span className="block text-slate-600 dark:text-slate-300">{t.suppPurchaseParentNote}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePurchaseSubmit} className="space-y-4">
            <div>
              <Label>{t.suppPurchasePickSupplier} *</Label>
              <Select
                value={purchaseForm.supplierId || undefined}
                onValueChange={(v) => setPurchaseForm((f) => ({ ...f, supplierId: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t.suppPurchasePickSupplier} />
                </SelectTrigger>
                <SelectContent>
                  {state.suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.suppPurchasePickParent} *</Label>
              {warehousePurchaseOptions.length === 0 ? (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{t.suppNoParentProducts}</p>
              ) : (
                <Select
                  value={purchaseForm.parentWarehouseItemId || undefined}
                  onValueChange={(v) => {
                    const w = state.warehouseItems.find((x) => x.id === v);
                    setPurchaseForm((f) => ({
                      ...f,
                      parentWarehouseItemId: v,
                      pricePerUnit: prefPurchasePrice(w),
                    }));
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={t.suppPurchasePickParent} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {warehousePurchaseOptions.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {warehousePurchaseLabel(w)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {purchaseSelectedParent && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className={categoryMeta(purchaseSelectedParent.category).badge}>
                    {categoryMeta(purchaseSelectedParent.category).emoji}{' '}
                    {categoryLabel(purchaseSelectedParent.category, t)}
                  </Badge>
                  {purchaseSelectedParent.parentWarehouseId ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {t.whSubLineBadge}
                    </Badge>
                  ) : null}
                  <span className="text-xs text-slate-500">
                    {t.unit}: {purchaseSelectedParent.unit === 'kg' ? 'kg' : t.unitPcs}
                  </span>
                </div>
              )}
            </div>
            <div>
              <Label>{t.whQuantity} *</Label>
              <Input
                value={purchaseForm.quantity}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, quantity: e.target.value }))}
                className="mt-1.5"
                inputMode="decimal"
              />
              {purchaseSelectedParent?.unit === 'pcs' && (
                <p className="mt-1 text-xs text-slate-500">{t.suppPurchasePcsWhole}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>{t.whIncomeDate}</Label>
                <Input
                  type="date"
                  value={purchaseForm.incomeDate}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, incomeDate: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>{t.suppPricePerUnit}</Label>
                <Input
                  value={purchaseForm.pricePerUnit}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                  className="mt-1.5"
                  placeholder="—"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500">{t.suppLineTotal}</p>
              <p className="nums text-lg font-semibold text-slate-900 dark:text-slate-100">
                {purchaseLineTotal != null ? `${formatNumber(purchaseLineTotal)} so'm` : '—'}
              </p>
            </div>
            <div>
              <Label>
                {t.suppPaidAmount}
                {purchaseLineTotal != null ? ' *' : ''}
              </Label>
              <Input
                value={purchaseForm.paidAmount}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, paidAmount: e.target.value }))}
                className="mt-1.5"
                placeholder="0"
                inputMode="decimal"
                disabled={purchaseLineTotal == null || !purchaseForm.onCredit}
              />
              {purchaseForm.onCredit && purchaseLineTotal != null && debtPreviewSo != null && (
                <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                  {t.suppDebtPreview}: {formatNumber(debtPreviewSo)} so'm
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                checked={purchaseForm.onCredit}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, onCredit: e.target.checked }))}
              />
              <span className="text-sm leading-snug text-slate-700 dark:text-slate-300">{t.suppOnCredit}</span>
            </label>
            <div>
              <Label>{t.notes}</Label>
              <Input
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPurchaseOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{t.suppPurchaseSubmit}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={debtRepayOpen}
        onOpenChange={(open) => {
          setDebtRepayOpen(open);
          if (!open) {
            setDebtRepaySupplierId('');
            setDebtRepayAmount('');
            setDebtRepayDate(TODAY);
            setDebtRepayNotes('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.suppDebtPayDialogTitle}</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block font-medium text-slate-800 dark:text-slate-100">
                {state.suppliers.find((s) => s.id === debtRepaySupplierId)?.fullName ?? ''}
              </span>
              <span className="block text-sm text-slate-600 dark:text-slate-300">
                {t.suppDebtColRemaining}:{' '}
                <span className="nums font-semibold text-amber-800 dark:text-amber-200">
                  {formatNumber(debtRepayRemaining)} so'm
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDebtRepaySubmit} className="space-y-4">
            <div>
              <Label>{t.suppDebtPayAmount} *</Label>
              <Input
                value={debtRepayAmount}
                onChange={(e) => setDebtRepayAmount(e.target.value)}
                className="mt-1.5"
                inputMode="decimal"
                autoFocus
              />
            </div>
            <div>
              <Label>{t.suppDebtPayDate}</Label>
              <Input
                type="date"
                value={debtRepayDate}
                onChange={(e) => setDebtRepayDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{t.suppDebtPayNotes}</Label>
              <Input
                value={debtRepayNotes}
                onChange={(e) => setDebtRepayNotes(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDebtRepayOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{t.suppDebtPaySubmit}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={supplierDetailOpen}
        onOpenChange={(open) => {
          setSupplierDetailOpen(open);
          if (!open) setSupplierDetail(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{supplierDetail?.fullName ?? ''}</DialogTitle>
            <DialogDescription>{t.suppSupplierPurchasesDialogDesc}</DialogDescription>
          </DialogHeader>

          <div className="hidden max-h-[min(55vh,28rem)] overflow-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.suppHistoryColDate}</TableHead>
                  <TableHead>{t.suppHistoryColProduct}</TableHead>
                  <TableHead>{t.suppHistoryColCategory}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColQty}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColTotal}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColPaid}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColDebt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierDetailPurchases.length === 0 ? (
                  <TableEmpty colSpan={7} message={t.suppHistoryNoData} />
                ) : (
                  supplierDetailPurchases.map((row) => {
                    const meta = categoryMeta(row.category);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                          {formatDate(row.incomeDate)}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800 dark:text-white">
                          {row.productName}
                        </TableCell>
                        <TableCell>
                          <Badge className={meta.badge}>
                            {meta.emoji} {categoryLabel(row.category, t)}
                          </Badge>
                        </TableCell>
                        <TableCell className={`nums text-right font-semibold ${meta.text}`}>
                          {formatNumber(row.quantity)} {row.unit}
                        </TableCell>
                        <TableCell className="nums text-right text-slate-600 dark:text-slate-300">
                          {row.totalAmount != null && row.totalAmount > 0
                            ? `${formatNumber(row.totalAmount)} so'm`
                            : '—'}
                        </TableCell>
                        <TableCell className="nums text-right text-slate-600 dark:text-slate-300">
                          {row.paidAmount != null ? `${formatNumber(row.paidAmount)} so'm` : '—'}
                        </TableCell>
                        <TableCell className="nums text-right text-amber-700 dark:text-amber-300">
                          {row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6
                            ? `${formatNumber(row.supplierDebtAmount)} so'm`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="max-h-[min(50vh,24rem)] space-y-3 overflow-y-auto md:hidden">
            {supplierDetailPurchases.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t.suppHistoryNoData}</p>
            ) : (
              supplierDetailPurchases.map((row) => {
                const meta = categoryMeta(row.category);
                return (
                  <Card key={row.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg} text-lg`}
                      >
                        <span>{meta.emoji}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                          {row.productName}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge className={meta.badge}>{categoryLabel(row.category, t)}</Badge>
                          <span className="text-[11px] text-slate-400">{formatDate(row.incomeDate)}</span>
                        </div>
                        <p className={`mt-2 nums text-base font-bold ${meta.text}`}>
                          {formatNumber(row.quantity)} {row.unit}
                        </p>
                        {row.totalAmount != null && row.totalAmount > 0 && (
                          <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {t.suppLineTotal}: {formatNumber(row.totalAmount)} so'm
                          </p>
                        )}
                        {row.paidAmount != null && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            {t.suppHistoryColPaid}: {formatNumber(row.paidAmount)} so'm
                          </p>
                        )}
                        {row.supplierDebtAmount != null && row.supplierDebtAmount > 1e-6 && (
                          <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {t.suppHistoryColDebt}: {formatNumber(row.supplierDebtAmount)} so'm
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          <DialogFooter className="flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setSupplierDetailOpen(false)}>
              {t.cancel}
            </Button>
            {supplierDetail ? (
              <Button
                type="button"
                variant="secondary"
                className="gap-1.5"
                onClick={() => {
                  setSupplierDetailOpen(false);
                  setMainTab('history');
                  setHistorySupplierId(supplierDetail.id);
                }}
              >
                <History size={16} />
                {t.suppOpenInHistoryTab}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.suppDeleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDelete?.fullName}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
