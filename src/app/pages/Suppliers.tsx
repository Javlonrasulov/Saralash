import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Search,
  Phone,
  MapPin,
  Truck,
  ShoppingBag,
  History,
  Wallet,
  Trash2,
  Package,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useStore,
  type Supplier,
  type SupplierPurchaseRecord,
  type SupplierPurchaseHistoryGroup,
  type WarehouseItem,
  getSupplierRemainingDebt,
  getOrphanSupplierDebtIncurred,
  groupSupplierPurchasesForHistory,
} from '../store/saralash-store';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter, formatYmdDisplay, todayYmd } from '../lib/nav-date-range';
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
import { formatDate, formatNumber, formatQuantity, TODAY, uid } from '../utils/format';
import { SupplierPurchaseEditDialog } from '../components/SupplierPurchaseEditDialog';
import { CumulativeQuantityField } from '../components/CumulativeQuantityField';
import {
  appendQtyPart,
  finalizeQtyParts,
  lineQtyTotal,
  switchWarehouseOnLine,
} from '../utils/purchase-qty-parts';

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

interface PurchaseDraftLine {
  key: string;
  warehouseItemId: string;
  quantity: string;
  qtyParts: number[];
  pricePerUnit: string;
}

interface PurchaseFormState {
  supplierId: string;
  incomeDate: string;
  paidAmount: string;
  onCredit: boolean;
  notes: string;
  lines: PurchaseDraftLine[];
}

function newPurchaseLine(warehouseItemId = '', pricePerUnit = ''): PurchaseDraftLine {
  return { key: uid('spl'), warehouseItemId, quantity: '', qtyParts: [], pricePerUnit };
}

const EMPTY_PURCHASE: PurchaseFormState = {
  supplierId: '',
  incomeDate: TODAY,
  paidAmount: '',
  onCredit: false,
  notes: '',
  lines: [newPurchaseLine()],
};

export function Suppliers() {
  const {
    state,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    purchaseLinesFromSupplier,
    recordSupplierDebtRepayment,
  } = useStore();
  const { t } = useApp();
  const { filter: navDateFilter } = useNavDateFilter();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormState>(EMPTY_SUPPLIER);
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(EMPTY_PURCHASE);
  /** Qaysi qator kengaytirilgan (qolganlari qisqa qator). */
  const [purchaseEditingKey, setPurchaseEditingKey] = useState('');

  const [mainTab, setMainTab] = useState<'list' | 'history' | 'debts'>('list');
  const [historySearch, setHistorySearch] = useState('');
  const [historySupplierId, setHistorySupplierId] = useState<string>('__all');
  const [historyEditBatch, setHistoryEditBatch] = useState<SupplierPurchaseHistoryGroup | null>(null);

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

  const supplierDetailPurchaseGroups = useMemo(
    () => groupSupplierPurchasesForHistory(supplierDetailPurchases),
    [supplierDetailPurchases],
  );

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

  const warehouseProductTitle = (w: WarehouseItem) => {
    if (!w.parentWarehouseId) return w.productName;
    const parent = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
    return `└ ${w.productName} · ${parent?.productName ?? '—'}`;
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

  const parseDraftLine = (line: PurchaseDraftLine) => {
    const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
    const qtyNum = (() => {
      const total = lineQtyTotal(line, false);
      return total > 0 ? total : null;
    })();
    const priceRaw = line.pricePerUnit.trim().replace(',', '.');
    const price = priceRaw ? parseFloat(priceRaw) : null;
    const priceNum =
      price != null && Number.isFinite(price) && price > 0 ? price : null;
    const lineTotal =
      priceNum != null && qtyNum != null ? priceNum * qtyNum : null;
    return { w, qtyNum, priceNum, lineTotal };
  };

  const sessionQtyByWarehouseId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of purchaseForm.lines) {
      const { w, qtyNum } = parseDraftLine(line);
      if (!w || qtyNum == null) continue;
      map.set(w.id, (map.get(w.id) ?? 0) + qtyNum);
    }
    return map;
  }, [purchaseForm.lines, state.warehouseItems]);

  const warehouseSessionLabel = (w: WarehouseItem) => {
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
    const map = new Map<
      string,
      { id: string; label: string; unit: 'kg' | 'pcs'; qty: number; amount: number; hasPrice: boolean }
    >();
    for (const line of purchaseForm.lines) {
      const { w, qtyNum, lineTotal } = parseDraftLine(line);
      if (!w || qtyNum == null) continue;
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
    if (purchaseOrderTotal == null) return null;
    const payRaw = purchaseForm.paidAmount.trim().replace(',', '.');
    const paid =
      payRaw === '' ? 0 : Number.isFinite(parseFloat(payRaw)) ? Math.max(0, parseFloat(payRaw)) : null;
    if (paid == null) return null;
    return Math.max(0, purchaseOrderTotal - paid);
  }, [purchaseOrderTotal, purchaseForm.paidAmount]);

  useEffect(() => {
    if (!purchaseOpen || purchaseForm.onCredit || purchaseOrderTotal == null) return;
    const next = String(Math.round(purchaseOrderTotal * 100) / 100);
    setPurchaseForm((f) => (f.paidAmount === next ? f : { ...f, paidAmount: next }));
  }, [purchaseOpen, purchaseForm.onCredit, purchaseOrderTotal]);

  const selectPurchaseWarehouse = (editingKey: string, newWarehouseId: string) => {
    const item = state.warehouseItems.find((x) => x.id === newWarehouseId);
    const unitFor = (id: string) =>
      state.warehouseItems.find((x) => x.id === id)?.unit ?? 'kg';
    const { lines, editingKey: nextKey } = switchWarehouseOnLine(
      purchaseForm.lines,
      editingKey,
      newWarehouseId,
      prefPurchasePrice(item),
      unitFor,
      () => newPurchaseLine(),
    );
    setPurchaseForm((f) => ({ ...f, lines }));
    setPurchaseEditingKey(nextKey);
  };

  const appendPurchaseQtyPart = (key: string) => {
    const line = purchaseForm.lines.find((l) => l.key === key);
    if (!line?.warehouseItemId) {
      toast.error(t.required + ': ' + t.suppPurchasePickParent);
      return;
    }
    const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
    const result = appendQtyPart(line, w?.unit ?? 'kg');
    if (!result.ok) {
      if (result.reason === 'pcs_whole') toast.error(t.suppPurchasePcsWhole);
      else toast.error(t.required + ': ' + t.whQuantity);
      return;
    }
    updatePurchaseLine(key, { qtyParts: result.qtyParts, quantity: result.quantity });
  };

  const updatePurchaseLine = (key: string, patch: Partial<PurchaseDraftLine>) => {
    setPurchaseForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  };

  const removePurchaseLine = (key: string) => {
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
    let rows = state.supplierPurchases.filter((p) =>
      isYmdInNavFilter(p.incomeDate, navDateFilter),
    );
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
  }, [state.supplierPurchases, historySearch, historySupplierId, navDateFilter]);

  const historyGroups = useMemo(
    () => groupSupplierPurchasesForHistory(filteredHistoryRows),
    [filteredHistoryRows],
  );

  const historyPeriodLabel = useMemo(() => {
    if (navDateFilter.mode === 'all') return '';
    if (navDateFilter.from === navDateFilter.to) return formatYmdDisplay(navDateFilter.from);
    return `${formatYmdDisplay(navDateFilter.from)} — ${formatYmdDisplay(navDateFilter.to)}`;
  }, [navDateFilter]);

  const historyPeriodSummary = useMemo(() => {
    if (navDateFilter.mode === 'all') return null;

    let rows = state.supplierPurchases.filter((p) =>
      isYmdInNavFilter(p.incomeDate, navDateFilter),
    );
    if (historySupplierId !== '__all') {
      rows = rows.filter((p) => p.supplierId === historySupplierId);
    }

    const byProduct = new Map<
      string,
      { qty: number; unit: 'kg' | 'pcs'; amount: number }
    >();
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
      if (p.unit === 'kg') totalKg += p.quantity;
      else totalPcs += p.quantity;
    }

    const products = [...byProduct.entries()]
      .sort((a, b) => b[1].amount - a[1].amount || a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([name, { qty, unit, amount }]) => ({ name, qty, unit, amount }));

    return {
      totalAmount,
      totalKg,
      totalPcs,
      productCount: products.length,
      batchCount: groupSupplierPurchasesForHistory(rows).length,
      products,
    };
  }, [state.supplierPurchases, navDateFilter, historySupplierId]);

  const listPurchaseScope = useMemo(() => {
    const today = todayYmd();
    if (navDateFilter.mode === 'all') {
      return { kind: 'day' as const, day: today, isToday: true };
    }
    const { from, to } = navDateFilter;
    if (from === to) {
      return { kind: 'day' as const, day: from, isToday: from === today };
    }
    return { kind: 'range' as const, from, to, isToday: false };
  }, [navDateFilter]);

  const purchaseSummaryPeriodLabel = useMemo(() => {
    if (listPurchaseScope.kind === 'day') return formatYmdDisplay(listPurchaseScope.day);
    return `${formatYmdDisplay(listPurchaseScope.from)} — ${formatYmdDisplay(listPurchaseScope.to)}`;
  }, [listPurchaseScope]);

  const purchaseSummaryTitle =
    listPurchaseScope.kind === 'day' && listPurchaseScope.isToday
      ? t.suppDailyPurchaseSummary
      : t.suppDailyPurchaseSummaryDay;

  const purchaseSummaryEmpty =
    listPurchaseScope.kind === 'day' && listPurchaseScope.isToday
      ? t.suppDailyPurchaseEmpty
      : t.suppDailyPurchaseEmptyDay;

  const todayPurchaseItems = useMemo(() => {
    const byProduct = new Map<string, { qty: number; unit: 'kg' | 'pcs' }>();
    for (const p of state.supplierPurchases) {
      if (listPurchaseScope.kind === 'day') {
        if (p.incomeDate !== listPurchaseScope.day) continue;
      } else if (!isYmdInNavFilter(p.incomeDate, navDateFilter)) {
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
  }, [state.supplierPurchases, listPurchaseScope, navDateFilter]);

  const todayPurchaseStats = useMemo(() => {
    let totalKg = 0;
    let totalPcs = 0;
    for (const i of todayPurchaseItems) {
      if (i.unit === 'kg') totalKg += i.qty;
      else totalPcs += i.qty;
    }
    return { totalKg, totalPcs, count: todayPurchaseItems.length };
  }, [todayPurchaseItems]);

  const summarizeBatchProducts = (lines: SupplierPurchaseRecord[]) => {
    const map = new Map<string, { qty: number; unit: 'kg' | 'pcs' }>();
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

  const batchMoneyTotals = (g: SupplierPurchaseHistoryGroup) => {
    const totalAmount = g.lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
    const paid = g.lines.reduce((s, l) => s + (l.paidAmount ?? 0), 0);
    const debt = g.lines.reduce((s, l) => s + (l.supplierDebtAmount ?? 0), 0);
    return { totalAmount, paid, debt };
  };

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
    const first = warehousePurchaseOptions[0];
    const line = newPurchaseLine(first?.id ?? '', first ? prefPurchasePrice(first) : '');
    setPurchaseForm({
      ...EMPTY_PURCHASE,
      lines: [line],
    });
    setPurchaseEditingKey(line.key);
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

    const resolvedLines: Array<{
      warehouseItemId: string;
      quantity: number;
      purchasePricePerUnit: number | null;
      w: WarehouseItem;
    }> = [];

    const linesToSubmit: PurchaseDraftLine[] = [];
    for (const line of purchaseForm.lines) {
      if (!line.warehouseItemId) continue;
      const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
      const hasAny = line.qtyParts.length > 0 || line.quantity.trim();
      if (!hasAny) continue;
      const fin = finalizeQtyParts(line, w?.unit ?? 'kg');
      if (!fin.ok) {
        if (fin.reason === 'pcs_whole') toast.error(t.suppPurchasePcsWhole);
        else toast.error(t.required + ': ' + t.whQuantity);
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
        toast.error(t.suppPurchasePcsWhole);
        return;
      }
      resolvedLines.push({
        warehouseItemId: line.warehouseItemId,
        quantity: qtyNum,
        purchasePricePerUnit: priceNum,
        w,
      });
    }

    let paidNum: number | null = null;
    if (purchaseOrderTotal != null) {
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
      const eps = 1e-4 * Math.max(1, purchaseOrderTotal);
      if (!purchaseForm.onCredit) {
        if (Math.abs(paidNum - purchaseOrderTotal) > eps) {
          toast.error(t.suppPaidMustEqualTotal);
          return;
        }
      } else if (paidNum > purchaseOrderTotal + 1e-6) {
        toast.error(t.suppPaidExceedsTotal);
        return;
      }
    }

    const ok = purchaseLinesFromSupplier(supplier.id, {
      incomeDate: purchaseForm.incomeDate,
      notes: purchaseForm.notes.trim() || undefined,
      onCredit: purchaseForm.onCredit,
      paidAmount: purchaseOrderTotal != null ? paidNum! : undefined,
      lines: resolvedLines.map((r) => ({
        warehouseItemId: r.warehouseItemId,
        quantity: r.quantity,
        purchasePricePerUnit: r.purchasePricePerUnit,
      })),
    });
    if (!ok) {
      toast.error(t.required);
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
              {historyGroups.length}
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

          <Card className="overflow-hidden border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 p-0 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/20">
            <div className="flex items-start justify-between gap-3 border-b border-emerald-100/80 px-4 py-3.5 dark:border-emerald-900/50">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25">
                  <Package size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                    {purchaseSummaryTitle}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {purchaseSummaryPeriodLabel}
                  </p>
                </div>
              </div>
              {todayPurchaseItems.length > 0 && (
                <div className="shrink-0 rounded-xl border border-emerald-100/90 bg-white/80 px-3 py-2 text-right shadow-sm dark:border-emerald-900/50 dark:bg-slate-800/80">
                  {todayPurchaseStats.totalKg > 0 && (
                    <p className="nums text-lg font-bold leading-none text-emerald-800 dark:text-emerald-300">
                      {formatQuantity(todayPurchaseStats.totalKg, 'kg')}
                      <span className="ml-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        kg
                      </span>
                    </p>
                  )}
                  {todayPurchaseStats.totalPcs > 0 && (
                    <p
                      className={`nums font-bold leading-none text-emerald-800 dark:text-emerald-300 ${
                        todayPurchaseStats.totalKg > 0
                          ? 'mt-1 text-sm'
                          : 'text-lg'
                      }`}
                    >
                      {formatQuantity(todayPurchaseStats.totalPcs, 'pcs')}
                      <span className="ml-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {t.unitPcs}
                      </span>
                    </p>
                  )}
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {formatNumber(todayPurchaseStats.count)} {t.suppHistoryProductCount}
                  </p>
                </div>
              )}
            </div>
            <div className="p-4">
              {todayPurchaseItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/90 dark:bg-emerald-900/30">
                    <Package size={22} className="text-emerald-500/70 dark:text-emerald-400/70" />
                  </div>
                  <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                    {purchaseSummaryEmpty}
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {todayPurchaseItems.map((item) => (
                    <div
                      key={item.name}
                      className="flex min-w-[6.75rem] max-w-full flex-col gap-0.5 rounded-xl border border-emerald-100/90 bg-white/90 px-3 py-2.5 shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-emerald-900/40 dark:bg-slate-800/90 dark:hover:border-emerald-800/60"
                    >
                      <span className="line-clamp-2 text-xs font-medium leading-snug text-slate-600 dark:text-slate-300">
                        {item.name}
                      </span>
                      <span className="nums text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatQuantity(item.qty, item.unit)}
                        <span className="ml-1 text-xs font-semibold text-emerald-600/90 dark:text-emerald-500/90">
                          {item.unit === 'kg' ? 'kg' : t.unitPcs}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

          {historyPeriodSummary && (
            <Card className="overflow-hidden border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40 p-0 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/20">
              <div className="flex items-start justify-between gap-3 border-b border-indigo-100/80 px-4 py-3.5 dark:border-indigo-900/50">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                    <Receipt size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                      {t.suppHistoryPeriodSummary}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{historyPeriodLabel}</p>
                    {historyPeriodSummary.batchCount > 0 && (
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600/80 dark:text-indigo-400/80">
                        {formatNumber(historyPeriodSummary.batchCount)} {t.suppHistoryProductCount}
                      </p>
                    )}
                  </div>
                </div>
                {historyPeriodSummary.products.length > 0 && (
                  <div className="shrink-0 rounded-xl border border-indigo-100/90 bg-white/80 px-3 py-2 text-right shadow-sm dark:border-indigo-900/50 dark:bg-slate-800/80">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {t.suppHistoryPeriodGrandTotal}
                    </p>
                    <p className="nums text-lg font-bold leading-none text-indigo-800 dark:text-indigo-300">
                      {historyPeriodSummary.totalAmount > 0
                        ? `${formatNumber(historyPeriodSummary.totalAmount)} so'm`
                        : '—'}
                    </p>
                    {historyPeriodSummary.totalKg > 0 && (
                      <p className="mt-1 nums text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatQuantity(historyPeriodSummary.totalKg, 'kg')} kg
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4">
                {historyPeriodSummary.products.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t.suppHistoryPeriodEmpty}
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {t.suppHistoryPeriodByProduct}
                    </p>
                    <div className="hidden overflow-hidden rounded-xl border border-indigo-100/80 md:block dark:border-indigo-900/40">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-indigo-100/80 bg-indigo-50/50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                            <th className="px-3 py-2">{t.suppHistoryColProduct}</th>
                            <th className="px-3 py-2 text-right">{t.suppHistoryColQty}</th>
                            <th className="px-3 py-2 text-right">{t.suppHistoryColTotal}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyPeriodSummary.products.map((item) => (
                            <tr
                              key={item.name}
                              className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                            >
                              <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-white">
                                {item.name}
                              </td>
                              <td className="nums px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                                {formatQuantity(item.qty, item.unit)}{' '}
                                {item.unit === 'kg' ? 'kg' : t.unitPcs}
                              </td>
                              <td className="nums px-3 py-2.5 text-right font-semibold text-indigo-800 dark:text-indigo-300">
                                {item.amount > 0 ? `${formatNumber(item.amount)} so'm` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-2 md:hidden">
                      {historyPeriodSummary.products.map((item) => (
                        <div
                          key={item.name}
                          className="rounded-xl border border-indigo-100/90 bg-white/90 px-3 py-2.5 dark:border-indigo-900/40 dark:bg-slate-800/90"
                        >
                          <p className="text-sm font-medium text-slate-800 dark:text-white">{item.name}</p>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
                            <span className="nums text-slate-600 dark:text-slate-300">
                              {formatQuantity(item.qty, item.unit)}{' '}
                              {item.unit === 'kg' ? 'kg' : t.unitPcs}
                            </span>
                            <span className="nums font-semibold text-indigo-800 dark:text-indigo-300">
                              {item.amount > 0 ? `${formatNumber(item.amount)} so'm` : '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.suppHistoryColDate}</TableHead>
                  <TableHead>{t.suppHistoryColSupplier}</TableHead>
                  <TableHead>{t.suppHistoryColProducts}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColTotal}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColPaid}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColDebt}</TableHead>
                  <TableHead className="w-[5.5rem] text-right">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyGroups.length === 0 ? (
                  <TableEmpty colSpan={7} message={t.suppHistoryNoData} />
                ) : (
                  historyGroups.map((g) => {
                    const { totalAmount, paid, debt } = batchMoneyTotals(g);
                    return (
                      <TableRow key={g.batchId}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                          {formatDate(g.incomeDate)}
                        </TableCell>
                        <TableCell className="max-w-[10rem]">
                          <span className="font-medium text-slate-800 dark:text-white">{g.supplierName}</span>
                          {!g.supplierId && (
                            <span className="ml-1 text-[10px] text-slate-400">({t.suppHistoryDeletedSupplier})</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[22rem]">
                          <p className="text-sm font-medium leading-snug text-slate-800 dark:text-white">
                            {summarizeBatchProducts(g.lines)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {g.lines.length} {t.suppHistoryProductCount}
                          </p>
                        </TableCell>
                        <TableCell className="nums text-right font-semibold text-slate-800 dark:text-white">
                          {totalAmount > 0 ? `${formatNumber(totalAmount)} so'm` : '—'}
                        </TableCell>
                        <TableCell className="nums text-right text-slate-600 dark:text-slate-300">
                          {paid > 0 || totalAmount > 0 ? `${formatNumber(paid)} so'm` : '—'}
                        </TableCell>
                        <TableCell className="nums text-right text-amber-700 dark:text-amber-300">
                          {debt > 1e-6 ? `${formatNumber(debt)} so'm` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-sky-600"
                            aria-label={t.suppEditPurchaseTitle}
                            onClick={() => setHistoryEditBatch(g)}
                          >
                            <Pencil size={15} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {historyGroups.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-400">{t.suppHistoryNoData}</Card>
            ) : (
              historyGroups.map((g) => {
                const { totalAmount, paid, debt } = batchMoneyTotals(g);
                return (
                  <Card key={g.batchId} className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white">{g.supplierName}</p>
                        <p className="text-xs text-slate-500">{formatDate(g.incomeDate)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-500"
                        aria-label={t.suppEditPurchaseTitle}
                        onClick={() => setHistoryEditBatch(g)}
                      >
                        <Pencil size={15} />
                      </Button>
                    </div>
                    <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">
                      {summarizeBatchProducts(g.lines)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {g.lines.length} {t.suppHistoryProductCount}
                    </p>
                    <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t.suppHistoryColTotal}</span>
                        <span className="nums font-semibold">
                          {totalAmount > 0 ? `${formatNumber(totalAmount)} so'm` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t.suppHistoryColPaid}</span>
                        <span className="nums">{paid > 0 ? `${formatNumber(paid)} so'm` : '—'}</span>
                      </div>
                      {debt > 1e-6 && (
                        <div className="flex justify-between text-amber-700 dark:text-amber-300">
                          <span>{t.suppHistoryColDebt}</span>
                          <span className="nums font-medium">{formatNumber(debt)} so'm</span>
                        </div>
                      )}
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
          if (!open) {
            setPurchaseForm(EMPTY_PURCHASE);
            setPurchaseEditingKey('');
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.suppPurchaseTitle}</DialogTitle>
            <DialogDescription className="space-y-2 text-pretty">
              {purchaseSelectedSupplier ? (
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {purchaseSelectedSupplier.fullName}
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
              <Label>{t.whIncomeDate}</Label>
              <Input
                type="date"
                value={purchaseForm.incomeDate}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, incomeDate: e.target.value }))}
                className="mt-1.5 max-w-[12rem]"
              />
            </div>

            {warehousePurchaseOptions.length === 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">{t.suppNoParentProducts}</p>
            ) : (
              <div className="space-y-2">
                <Label>{t.suppPurchaseLinesTitle}</Label>
                {(() => {
                  const editingLine =
                    purchaseForm.lines.find((l) => l.key === purchaseEditingKey) ??
                    purchaseForm.lines[purchaseForm.lines.length - 1];
                  const collapsedLines = purchaseForm.lines.filter(
                    (l) =>
                      l.key !== editingLine?.key &&
                      l.warehouseItemId &&
                      lineQtyTotal(l, false) > 0,
                  );
                  const { w: editW, lineTotal: editTotal } = editingLine
                    ? parseDraftLine(editingLine)
                    : { w: undefined, lineTotal: null };

                  return (
                    <>
                      {collapsedLines.map((line) => {
                        const { w, qtyNum, priceNum, lineTotal } = parseDraftLine(line);
                        const unitLbl = w?.unit === 'kg' ? 'kg' : t.unitPcs;
                        return (
                          <div
                            key={line.key}
                            className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/40"
                          >
                            <div className="min-w-0 flex-1 text-sm leading-snug">
                              <span className="font-medium text-slate-800 dark:text-slate-100">
                                {w ? warehouseProductTitle(w) : '—'}
                              </span>
                              {qtyNum != null && (
                                <span className="text-slate-600 dark:text-slate-300">
                                  {' '}
                                  ·{' '}
                                  <span className="nums">
                                    {formatQuantity(qtyNum, w?.unit ?? 'kg')} {unitLbl}
                                  </span>
                                  {priceNum != null && (
                                    <>
                                      {' '}
                                      ·{' '}
                                      <span className="nums">
                                        {formatNumber(priceNum)} so'm/{unitLbl}
                                      </span>
                                    </>
                                  )}
                                  {lineTotal != null && (
                                    <>
                                      {' '}
                                      ·{' '}
                                      <span className="nums font-semibold text-slate-800 dark:text-white">
                                        {formatNumber(lineTotal)} so'm
                                      </span>
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-slate-500 hover:text-sky-600"
                              aria-label={t.posEditOrder}
                              onClick={() => setPurchaseEditingKey(line.key)}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-slate-500 hover:text-red-600"
                              aria-label={t.delete}
                              onClick={() => removePurchaseLine(line.key)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        );
                      })}

                      {editingLine && (
                        <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                          <Label className="text-xs">{t.suppPurchasePickParent} *</Label>
                          <Select
                            value={editingLine.warehouseItemId || undefined}
                            onValueChange={(v) => selectPurchaseWarehouse(editingLine.key, v)}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder={t.suppPurchasePickParent} />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {warehousePurchaseOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {warehouseSessionLabel(opt)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {editW && (
                            <p className="text-[10px] text-slate-500">{t.suppPurchaseSessionQtyHint}</p>
                          )}
                          <div className="space-y-2">
                            <CumulativeQuantityField
                              label={<>{t.whQuantity} *</>}
                              quantity={editingLine.quantity}
                              qtyParts={editingLine.qtyParts}
                              unit={editW?.unit ?? 'kg'}
                              unitLabel={editW?.unit === 'pcs' ? t.unitPcs : 'kg'}
                              runningTotalLabel={t.suppQtyRunningTotal}
                              addAriaLabel={t.suppQtyAddPart}
                              placeholder={editW?.unit === 'kg' ? '2,3' : '5'}
                              pcsHint={editW?.unit === 'pcs' ? t.suppPurchasePcsWhole : undefined}
                              onQuantityChange={(value) =>
                                updatePurchaseLine(editingLine.key, { quantity: value })
                              }
                              onAddPart={() => appendPurchaseQtyPart(editingLine.key)}
                            />
                            <div>
                              <Label className="text-xs">{t.suppPricePerUnit}</Label>
                              <Input
                                value={editingLine.pricePerUnit}
                                onChange={(e) =>
                                  updatePurchaseLine(editingLine.key, {
                                    pricePerUnit: e.target.value,
                                  })
                                }
                                className="mt-1 rounded-xl"
                                inputMode="decimal"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {t.suppLineTotal}:{' '}
                            <span className="nums font-semibold">
                              {editTotal != null ? `${formatNumber(editTotal)} so'm` : '—'}
                            </span>
                          </p>
                        </div>
                      )}

                    </>
                  );
                })()}
              </div>
            )}

            {purchaseByProductSummary.length > 0 && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200">
                  {t.suppByProductSummary}
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {purchaseByProductSummary.map((g) => (
                    <li
                      key={g.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-slate-800 dark:text-slate-100"
                    >
                      <span className="min-w-0 truncate font-medium">{g.label}</span>
                      <span className="nums shrink-0 text-right text-xs sm:text-sm">
                        {formatQuantity(g.qty, g.unit)} {g.unit === 'kg' ? 'kg' : t.unitPcs}
                        {g.hasPrice ? ` · ${formatNumber(g.amount)} so'm` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500">{t.suppPurchaseGrandTotal}</p>
              <p className="nums text-lg font-semibold text-slate-900 dark:text-slate-100">
                {purchaseOrderTotal != null ? `${formatNumber(purchaseOrderTotal)} so'm` : '—'}
              </p>
            </div>
            <div>
              <Label>
                {t.suppPaidAmount}
                {purchaseOrderTotal != null ? ' *' : ''}
              </Label>
              <Input
                value={purchaseForm.paidAmount}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, paidAmount: e.target.value }))}
                className="mt-1.5"
                placeholder="0"
                inputMode="decimal"
                disabled={purchaseOrderTotal == null || !purchaseForm.onCredit}
              />
              {purchaseForm.onCredit && purchaseOrderTotal != null && debtPreviewSo != null && (
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
                  <TableHead>{t.suppHistoryColProducts}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColTotal}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColPaid}</TableHead>
                  <TableHead className="text-right">{t.suppHistoryColDebt}</TableHead>
                  <TableHead className="w-[3rem]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierDetailPurchaseGroups.length === 0 ? (
                  <TableEmpty colSpan={6} message={t.suppHistoryNoData} />
                ) : (
                  supplierDetailPurchaseGroups.map((g) => {
                    const { totalAmount, paid, debt } = batchMoneyTotals(g);
                    return (
                      <TableRow key={g.batchId}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                          {formatDate(g.incomeDate)}
                        </TableCell>
                        <TableCell className="max-w-[20rem]">
                          <p className="text-sm font-medium leading-snug">{summarizeBatchProducts(g.lines)}</p>
                          <p className="text-[10px] text-slate-400">
                            {g.lines.length} {t.suppHistoryProductCount}
                          </p>
                        </TableCell>
                        <TableCell className="nums text-right font-semibold">
                          {totalAmount > 0 ? `${formatNumber(totalAmount)} so'm` : '—'}
                        </TableCell>
                        <TableCell className="nums text-right text-slate-600 dark:text-slate-300">
                          {paid > 0 || totalAmount > 0 ? `${formatNumber(paid)} so'm` : '—'}
                        </TableCell>
                        <TableCell className="nums text-right text-amber-700 dark:text-amber-300">
                          {debt > 1e-6 ? `${formatNumber(debt)} so'm` : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setHistoryEditBatch(g)}
                          >
                            <Pencil size={15} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="max-h-[min(50vh,24rem)] space-y-3 overflow-y-auto md:hidden">
            {supplierDetailPurchaseGroups.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t.suppHistoryNoData}</p>
            ) : (
              supplierDetailPurchaseGroups.map((g) => {
                const { totalAmount, paid, debt } = batchMoneyTotals(g);
                return (
                  <Card key={g.batchId} className="p-4">
                    <div className="mb-2 flex justify-between">
                      <span className="text-xs text-slate-500">{formatDate(g.incomeDate)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setHistoryEditBatch(g)}
                      >
                        <Pencil size={15} />
                      </Button>
                    </div>
                    <p className="text-sm leading-snug">{summarizeBatchProducts(g.lines)}</p>
                    <p className="mt-2 nums font-semibold">
                      {totalAmount > 0 ? `${formatNumber(totalAmount)} so'm` : '—'}
                    </p>
                    {debt > 1e-6 && (
                      <p className="text-xs text-amber-700">{t.suppHistoryColDebt}: {formatNumber(debt)} so'm</p>
                    )}
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

      <SupplierPurchaseEditDialog
        batch={historyEditBatch}
        open={Boolean(historyEditBatch)}
        onOpenChange={(o) => {
          if (!o) setHistoryEditBatch(null);
        }}
        warehouseOptions={warehousePurchaseOptions}
        warehouseProductTitle={warehouseProductTitle}
        prefPrice={prefPurchasePrice}
      />

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
