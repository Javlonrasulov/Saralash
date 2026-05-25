import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Package, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, type CategoryKey, type WarehouseItem } from '../store/saralash-store';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter } from '../lib/nav-date-range';
import { useApp } from '../i18n/app-context';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  categoryLabel,
  categoryMeta,
  CategoryIconGlyph,
  CategoryProductIcon,
  PRODUCT_ICON_PICKER_GROUPS,
  PRODUCT_ICON_PICKER_OPTIONS,
  productIconLabel,
  productIconPickerLabel,
  resolveProductIconKey,
  warehouseDisplayIconId,
  type ProductIconPhotoId,
} from '../utils/category';
import { formatDate, formatNumber, TODAY, uid } from '../utils/format';
import { cn } from '../components/ui/utils';

function formatWarehouseUnitPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${formatNumber(n)} so'm`;
}

/** Jadvalda avval ota, keyin uning bolalari. */
function orderWarehouseRows(items: WarehouseItem[]): WarehouseItem[] {
  const seen = new Set<string>();
  const out: WarehouseItem[] = [];
  const roots = items
    .filter((w) => !w.parentWarehouseId)
    .sort((a, b) => b.incomeDate.localeCompare(a.incomeDate) || a.productName.localeCompare(b.productName));
  for (const r of roots) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
    const kids = items
      .filter((w) => w.parentWarehouseId === r.id)
      .sort((a, b) => a.productName.localeCompare(b.productName));
    for (const k of kids) {
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      out.push(k);
    }
  }
  for (const w of items) {
    if (!seen.has(w.id)) out.push(w);
  }
  return out;
}

// ============================================================================
// PRODUCT FORM
// ============================================================================

interface ProductFormState {
  productName: string;
  category: string;
  productIconKey: ProductIconPhotoId;
  unit: 'kg' | 'pcs';
  incomeDate: string;
  purchasePrice: string;
  streetPurchasePrice: string;
  salePrice: string;
  notes: string;
}

const EMPTY_PRODUCT: ProductFormState = {
  productName: '',
  category: '',
  productIconKey: 'other',
  unit: 'kg',
  incomeDate: TODAY,
  purchasePrice: '',
  streetPurchasePrice: '',
  salePrice: '',
  notes: '',
};

function parseOptionalMoney(raw: string): { ok: true; value: number | null } | { ok: false } {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return { ok: true, value: null };
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

interface SplitFormRow {
  id: string;
  name: string;
  qty: string;
}

function ProductDialog({
  open,
  onOpenChange,
  editing,
  categorySuggestions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: WarehouseItem | null;
  /** Oldingi mahsulotlardan — nomni qayta ishlatish uchun ixtiyoriy tavsiyalar (majburiy emas). */
  categorySuggestions: string[];
}) {
  const { addWarehouseItemWithSplits, appendWarehouseSplitsToParent, updateWarehouseItem } = useStore();
  const { t } = useApp();
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT);
  const [splits, setSplits] = useState<SplitFormRow[]>([]);
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
          incomeDate: editing.incomeDate,
          purchasePrice:
            editing.purchasePricePerUnit != null && Number.isFinite(editing.purchasePricePerUnit)
              ? String(editing.purchasePricePerUnit)
              : '',
          streetPurchasePrice:
            editing.streetPurchasePricePerUnit != null &&
            Number.isFinite(editing.streetPurchasePricePerUnit)
              ? String(editing.streetPurchasePricePerUnit)
              : '',
          salePrice:
            editing.salePricePerUnit != null && Number.isFinite(editing.salePricePerUnit)
              ? String(editing.salePricePerUnit)
              : '',
          notes: editing.notes ?? '',
        });
      } else {
        setForm(EMPTY_PRODUCT);
      }
    }
  }, [open, editing]);

  const handleSubmit = (e: React.FormEvent) => {
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
    const parsedStreetPurchase = parseOptionalMoney(form.streetPurchasePrice);
    const parsedSale = parseOptionalMoney(form.salePrice);
    if (!parsedPurchase.ok || !parsedStreetPurchase.ok || !parsedSale.ok) {
      toast.error(t.whValidateOptionalPrice);
      return;
    }

    if (editing) {
      if (editing.parentWarehouseId) {
        updateWarehouseItem({
          ...editing,
          productName: form.productName.trim(),
          category: category as CategoryKey,
          productIconKey: form.productIconKey,
          unit: form.unit,
          incomeDate: form.incomeDate,
          notes: form.notes.trim() || undefined,
          purchasePricePerUnit: parsedPurchase.value,
          streetPurchasePricePerUnit: parsedStreetPurchase.value,
          salePricePerUnit: parsedSale.value,
        });
        toast.success(t.save);
      } else {
        const parsedSplits: { productName: string; quantity: number }[] = [];
        for (const row of splits) {
          const nm = row.name.trim();
          const qRaw = row.qty.trim() === '' ? 0 : parseFloat(row.qty.replace(',', '.'));
          const q = form.unit === 'pcs' ? Math.floor(qRaw) : qRaw;
          if (!nm && (!Number.isFinite(q) || q === 0)) continue;
          if (!nm && Number.isFinite(q) && q > 0) {
            toast.error(t.whValidateSubName);
            return;
          }
          if (nm && (!Number.isFinite(q) || q < 0)) {
            toast.error(t.whValidateAllocateQty);
            return;
          }
          if (nm) parsedSplits.push({ productName: nm, quantity: Math.max(0, q) });
        }

        const sumSplits = parsedSplits.reduce((s, x) => s + x.quantity, 0);
        if (editing.currentQty > 0 && sumSplits > editing.currentQty + 1e-9) {
          toast.error(t.whSplitsExceedParent);
          return;
        }

        const updatedParent: WarehouseItem = {
          ...editing,
          productName: form.productName.trim(),
          category: category as CategoryKey,
          productIconKey: form.productIconKey,
          unit: form.unit,
          incomeDate: form.incomeDate,
          notes: form.notes.trim() || undefined,
          purchasePricePerUnit: parsedPurchase.value,
          streetPurchasePricePerUnit: parsedStreetPurchase.value,
          salePricePerUnit: parsedSale.value,
        };

        if (parsedSplits.length > 0) {
          appendWarehouseSplitsToParent(updatedParent, parsedSplits);
        } else {
          updateWarehouseItem(updatedParent);
        }
        toast.success(t.save);
      }
    } else {
      const parsedSplits: { productName: string; quantity: number }[] = [];
      for (const row of splits) {
        const nm = row.name.trim();
        const qRaw = row.qty.trim() === '' ? 0 : parseFloat(row.qty.replace(',', '.'));
        const q = form.unit === 'pcs' ? Math.floor(qRaw) : qRaw;
        if (!nm && (!Number.isFinite(q) || q === 0)) continue;
        if (!nm && Number.isFinite(q) && q > 0) {
          toast.error(t.whValidateSubName);
          return;
        }
        if (nm && (!Number.isFinite(q) || q < 0)) {
          toast.error(t.whValidateAllocateQty);
          return;
        }
        if (nm) parsedSplits.push({ productName: nm, quantity: Math.max(0, q) });
      }

      addWarehouseItemWithSplits(
        {
          productName: form.productName.trim(),
          category: category as CategoryKey,
          productIconKey: form.productIconKey,
          unit: form.unit,
          initialQty: 0,
          incomeDate: form.incomeDate,
          notes: form.notes.trim() || undefined,
          source: 'EXTERNAL',
          parentWarehouseId: null,
          purchasePricePerUnit: parsedPurchase.value,
          streetPurchasePricePerUnit: parsedStreetPurchase.value,
          salePricePerUnit: parsedSale.value,
        },
        parsedSplits,
      );
      toast.success(t.add);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t.whEditProduct : t.whAddProduct}</DialogTitle>
          <DialogDescription className={editing ? '' : 'text-pretty'}>
            {!editing ? t.whAddExternalHint : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t.whProductName} *</Label>
            <Input
              value={form.productName}
              onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
              className="mt-1.5"
              placeholder="Press qog'oz"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>{t.whCategory} *</Label>
              <Input
                list="warehouse-category-suggestions"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                onBlur={() => {
                  const cat = form.category.trim();
                  if (!iconLocked && cat) {
                    setForm((f) => ({
                      ...f,
                      productIconKey: resolveProductIconKey(cat as CategoryKey),
                    }));
                  }
                }}
                className="mt-1.5"
                placeholder={t.whCategoryPlaceholder}
                autoComplete="off"
              />
              <datalist id="warehouse-category-suggestions">
                {categorySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>{t.unit}</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => setForm((f) => ({ ...f, unit: v as 'kg' | 'pcs' }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="pcs">dona</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>{t.whProductIcon}</Label>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t.whProductIconHint}</p>
            <div className="mt-2 max-h-64 space-y-3 overflow-y-auto overscroll-contain pr-1">
              {PRODUCT_ICON_PICKER_GROUPS.map((group) => (
                <div key={group}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {productIconLabel(group, t)}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {PRODUCT_ICON_PICKER_OPTIONS.filter((o) => o.group === group).map((opt) => {
                      const selected = form.productIconKey === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          title={productIconPickerLabel(opt.id, t)}
                          onClick={() => {
                            setIconLocked(true);
                            setForm((f) => ({ ...f, productIconKey: opt.id }));
                          }}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors',
                            selected
                              ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/30 dark:border-violet-400 dark:bg-violet-950/40'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500',
                          )}
                        >
                          <CategoryProductIcon iconKey={opt.id} size="lg" />
                          <span className="max-w-full truncate text-center text-[9px] leading-tight text-slate-500 dark:text-slate-400">
                            {productIconPickerLabel(opt.id, t)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>{t.whIncomeDate}</Label>
            <Input
              type="date"
              value={form.incomeDate}
              onChange={(e) => setForm((f) => ({ ...f, incomeDate: e.target.value }))}
              className="mt-1.5 sm:max-w-xs"
            />
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
            <Label className="text-sm font-medium">{t.whPurchasePricesSection}</Label>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {t.whPurchasePricesHint}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/25">
                <Label className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                  {t.whBazaPurchasePricePerUnit}
                </Label>
                <Input
                  value={form.purchasePrice}
                  onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                  placeholder="0"
                  inputMode="decimal"
                  className="mt-1.5"
                />
              </div>
              <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3 dark:border-sky-900/50 dark:bg-sky-950/25">
                <Label className="text-xs font-semibold text-sky-900 dark:text-sky-200">
                  {t.whKochaPurchasePricePerUnit}
                </Label>
                <Input
                  value={form.streetPurchasePrice}
                  onChange={(e) => setForm((f) => ({ ...f, streetPurchasePrice: e.target.value }))}
                  placeholder="0"
                  inputMode="decimal"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
          <div>
            <Label>{t.whSalePricePerUnit}</Label>
            <Input
              value={form.salePrice}
              onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
              placeholder="0"
              inputMode="decimal"
              className="mt-1.5 sm:max-w-xs"
            />
          </div>

          {(!editing || (editing && !editing.parentWarehouseId)) && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-sm font-medium">{t.whSplitsSection}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSplits((s) => [...s, { id: uid('spl'), name: '', qty: '' }])}
                >
                  {t.whAddSplitRow}
                </Button>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {editing && !editing.parentWarehouseId ? t.whSplitsOnEditParent : t.whWhereSubcategoryHint}
              </p>
              {splits.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">{t.whSplitsEmpty}</p>
              ) : (
                <div className="space-y-2">
                  {splits.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <Label className="text-xs">{t.whSubProductName}</Label>
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            setSplits((s) =>
                              s.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)),
                            )
                          }
                          className="mt-1"
                          placeholder={t.whCategoryPlaceholder}
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">{t.whQuantity}</Label>
                        <Input
                          value={row.qty}
                          onChange={(e) =>
                            setSplits((s) =>
                              s.map((r) => (r.id === row.id ? { ...r, qty: e.target.value } : r)),
                            )
                          }
                          className="mt-1"
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mb-0.5 shrink-0 text-red-600 hover:text-red-700"
                        onClick={() => setSplits((s) => s.filter((r) => r.id !== row.id))}
                      >
                        {t.whRemoveSplitRow}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>{t.notes}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit">{t.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export function Warehouse() {
  const { state, deleteWarehouseItem, addWarehouseChildQty } = useStore();
  const { t } = useApp();
  const { filter: navDateFilter } = useNavDateFilter();

  const [tab, setTab] = useState<'stock' | 'sold'>('stock');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<CategoryKey | '__all'>('__all');

  const categoryFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const w of state.warehouseItems) {
      const c = String(w.category).trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => categoryLabel(a, t).localeCompare(categoryLabel(b, t)));
  }, [state.warehouseItems, t]);

  const warehouseCategorySuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const w of state.warehouseItems) {
      const c = String(w.category).trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [state.warehouseItems]);

  React.useEffect(() => {
    if (
      filterCategory !== '__all' &&
      !categoryFilterOptions.includes(String(filterCategory))
    ) {
      setFilterCategory('__all');
    }
  }, [filterCategory, categoryFilterOptions]);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<WarehouseItem | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<WarehouseItem | null>(null);
  const [childAddTarget, setChildAddTarget] = useState<WarehouseItem | null>(null);
  const [childAddQtyInput, setChildAddQtyInput] = useState('');

  const parentProductNameByChildId = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of state.warehouseItems) {
      if (!w.parentWarehouseId) continue;
      const p = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
      if (p) m.set(w.id, p.productName);
    }
    return m;
  }, [state.warehouseItems]);

  /** Faqat ota ostidagi «ajratilgan» bola qatorlari miqdori yig‘indisi (ota qatori bilan qo‘shilmaydi). */
  const childrenQtySumByRootId = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of state.warehouseItems) {
      if (!w.parentWarehouseId) continue;
      const pid = w.parentWarehouseId;
      m.set(pid, (m.get(pid) ?? 0) + w.currentQty);
    }
    return m;
  }, [state.warehouseItems]);

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = state.warehouseItems.filter((w) => {
      if (filterCategory !== '__all' && w.category !== filterCategory) return false;
      if (q) {
        const parentName = parentProductNameByChildId.get(w.id) ?? '';
        const hay = `${w.productName} ${w.category} ${w.supplierName ?? ''} ${parentName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return w.status === 'IN_STOCK' || w.currentQty > 0;
    });

    const ids = new Set(base.map((w) => w.id));
    const catOk = (w: WarehouseItem) =>
      filterCategory === '__all' || String(w.category) === String(filterCategory);

    for (const w of base) {
      if (w.parentWarehouseId) {
        const p = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
        if (p && catOk(p)) ids.add(p.id);
      }
    }
    /** ids ichidagi har bir ota uchun bolalar — 0 yoki SOLD_OUT bo‘lsa ham ombor oilasi bilan chiqsin. */
    const rootsInIds = state.warehouseItems.filter((w) => ids.has(w.id) && !w.parentWarehouseId);
    for (const r of rootsInIds) {
      for (const ch of state.warehouseItems) {
        if (ch.parentWarehouseId === r.id && catOk(ch)) ids.add(ch.id);
      }
    }

    return state.warehouseItems.filter((w) => ids.has(w.id));
  }, [state.warehouseItems, search, filterCategory, parentProductNameByChildId]);

  const orderedFilteredStock = useMemo(
    () => orderWarehouseRows(filteredStock),
    [filteredStock],
  );

  /** Jadval/kartalar: har bir ota va uning bolalari bir guruh. Ota filtrda yo‘q bo‘lsa, bola alohildan ildiz sifatida. */
  const warehouseStockGroups = useMemo(() => {
    const inList = new Set(orderedFilteredStock.map((w) => w.id));
    const roots = orderedFilteredStock.filter(
      (w) => !w.parentWarehouseId || !inList.has(w.parentWarehouseId),
    );
    return roots.map((root) => ({
      root,
      children: orderedFilteredStock
        .filter((w) => w.parentWarehouseId === root.id)
        .sort((a, b) => a.productName.localeCompare(b.productName)),
    }));
  }, [orderedFilteredStock]);

  const deleteHasChildren = useMemo(() => {
    if (!confirmDelete) return false;
    return state.warehouseItems.some((w) => w.parentWarehouseId === confirmDelete.id);
  }, [confirmDelete, state.warehouseItems]);

  const soldOutcomes = useMemo(
    () =>
      state.outcomes.filter((o) => o.type === 'SOLD' && isYmdInNavFilter(o.date, navDateFilter)),
    [state.outcomes, navDateFilter],
  );
  const totalsByUnit = useMemo(() => {
    const totals = { kg: 0, pcs: 0 };
    for (const w of state.warehouseItems) {
      if (w.unit === 'kg') totals.kg += w.currentQty;
      else totals.pcs += w.currentQty;
    }
    return totals;
  }, [state.warehouseItems]);

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteWarehouseItem(confirmDelete.id);
    toast.success(t.delete);
    setConfirmDelete(null);
  };

  const submitChildAddQty = () => {
    if (!childAddTarget) return;
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

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Package size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">kg jami</p>
            <p className="nums text-lg font-bold">{formatNumber(totalsByUnit.kg)} kg</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.whTabSold}</p>
            <p className="nums text-lg font-bold">{soldOutcomes.length}</p>
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full overflow-x-auto sm:w-auto">
            <TabsTrigger value="stock" className="flex-1 sm:flex-none">
              {t.whTabStock}
              <Badge variant="muted" className="ml-1 text-[10px]">
                {orderedFilteredStock.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="sold" className="flex-1 sm:flex-none">
              {t.whTabSold}
              <Badge variant="muted" className="ml-1 text-[10px]">
                {soldOutcomes.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {tab === 'stock' && (
            <Button
              onClick={() => {
                setEditingProduct(null);
                setProductDialogOpen(true);
              }}
              className="shrink-0"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">{t.whAddProduct}</span>
            </Button>
          )}
        </div>

        {/* TAB: STOCK */}
        <TabsContent value="stock" className="space-y-4">
          {/* Filters */}
          <Card className="p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.whSearchPlaceholder}
                  className="pl-9"
                />
              </div>
              <Select
                value={filterCategory}
                onValueChange={(v) => setFilterCategory(v as CategoryKey | '__all')}
              >
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder={t.whFilterCategory} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t.whFilterAll}</SelectItem>
                  {categoryFilterOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      <CategoryIconGlyph category={c} size={14} className="mr-1.5 inline" />
                      {categoryLabel(c, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.whProductName}</TableHead>
                  <TableHead>{t.whCategory}</TableHead>
                  <TableHead className="text-right">{t.whQuantity}</TableHead>
                  <TableHead className="text-right">{t.whColBazaPurchaseShort}</TableHead>
                  <TableHead className="text-right">{t.whColKochaPurchaseShort}</TableHead>
                  <TableHead className="text-right">{t.whColSaleShort}</TableHead>
                  <TableHead>{t.whIncomeDate}</TableHead>
                  <TableHead>{t.notes}</TableHead>
                  <TableHead className="text-right">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouseStockGroups.length === 0 ? (
                  <TableEmpty colSpan={9} message={t.noData} />
                ) : (
                  warehouseStockGroups.map(({ root, children }, groupIndex) => {
                    const rows = [root, ...children];
                    return (
                      <React.Fragment key={root.id}>
                        {groupIndex > 0 && (
                          <TableRow className="border-0 hover:bg-transparent dark:hover:bg-transparent">
                            <TableCell
                              colSpan={9}
                              className="border-0 bg-transparent p-0 hover:bg-transparent dark:hover:bg-transparent"
                            >
                              <div
                                className="mx-4 my-2 h-2 rounded-full bg-slate-200/90 dark:bg-slate-600/80"
                                role="separator"
                                aria-hidden
                              />
                            </TableCell>
                          </TableRow>
                        )}
                        {rows.map((w, rowIndex) => {
                          const isChild = w.id !== root.id;
                          const rowNumLabel = isChild
                            ? `${groupIndex + 1}.${rowIndex}.`
                            : `${groupIndex + 1}.`;
                          const isLastInGroup = rowIndex === rows.length - 1;
                          const meta = categoryMeta(w.category);
                          const separatedSum = childrenQtySumByRootId.get(root.id) ?? 0;
                          const showSeparatedHint =
                            !isChild && children.length > 0 && separatedSum > 1e-9;
                          return (
                            <TableRow
                              key={w.id}
                              className={cn(
                                isChild
                                  ? 'border-l-2 border-indigo-400/70 bg-white dark:border-indigo-500/50 dark:bg-slate-950/30'
                                  : 'border-t-2 border-slate-200/90 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/45',
                                isLastInGroup &&
                                  'border-b-2 border-slate-200/95 dark:border-slate-600',
                              )}
                            >
                              <TableCell
                                className={`font-medium text-slate-800 dark:text-white ${isChild ? 'pl-4' : ''}`}
                              >
                                <div className="flex items-center gap-2">
                                  <CategoryProductIcon
                                    category={w.category}
                                    iconKey={warehouseDisplayIconId(w)}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1">
                                      {isChild && (
                                        <span
                                          className="text-indigo-500 dark:text-indigo-400"
                                          aria-hidden
                                        >
                                          └
                                        </span>
                                      )}
                                      <span className="tabular-nums font-medium text-slate-500 dark:text-slate-400">
                                        {rowNumLabel}
                                      </span>
                                      <span>{w.productName}</span>
                                      {isChild && (
                                        <Badge variant="outline" className="text-[10px] font-normal">
                                          {t.whSubLineBadge}
                                        </Badge>
                                      )}
                                      {w.source === 'PROCESSED' && (
                                        <Badge variant="muted" className="text-[10px]">
                                          {t.sortingProcessed}
                                        </Badge>
                                      )}
                                      {w.source === 'SUPPLIER' && (
                                        <Badge variant="muted" className="text-[10px]">
                                          {t.whSourceSupplier}
                                          {w.supplierName ? `: ${w.supplierName}` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={cn(meta.badge, 'gap-1')}>
                                  <CategoryIconGlyph category={w.category} size={12} />
                                  {categoryLabel(w.category, t)}
                                </Badge>
                              </TableCell>
                              <TableCell className={`nums text-right font-semibold ${meta.text}`}>
                                <span>
                                  {formatNumber(w.currentQty)} {w.unit}
                                </span>
                                {showSeparatedHint && (
                                  <span className="mt-0.5 block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                                    {t.whFamilyTotal}: {formatNumber(separatedSum)}{' '}
                                    {w.unit === 'kg' ? 'kg' : t.unitPcs}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="nums text-right text-xs text-slate-600 dark:text-slate-300">
                                {formatWarehouseUnitPrice(w.purchasePricePerUnit)}
                              </TableCell>
                              <TableCell className="nums text-right text-xs text-slate-600 dark:text-slate-300">
                                {formatWarehouseUnitPrice(w.streetPurchasePricePerUnit)}
                              </TableCell>
                              <TableCell className="nums text-right text-xs text-slate-600 dark:text-slate-300">
                                {formatWarehouseUnitPrice(w.salePricePerUnit)}
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {formatDate(w.incomeDate)}
                              </TableCell>
                              <TableCell className="max-w-[12rem] truncate text-xs text-slate-500">
                                {w.notes ?? '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex flex-wrap items-center justify-end gap-1">
                                  {isChild && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                      title={t.whChildAddQtyTitle}
                                      onClick={() => {
                                        setChildAddTarget(w);
                                        setChildAddQtyInput('');
                                      }}
                                    >
                                      <Plus size={13} />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setEditingProduct(w);
                                      setProductDialogOpen(true);
                                    }}
                                  >
                                    <Pencil size={13} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:text-red-600"
                                    onClick={() => setConfirmDelete(w)}
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {warehouseStockGroups.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-400">{t.noData}</Card>
            ) : (
              warehouseStockGroups.map(({ root, children }, groupIndex) => {
                const rootMeta = categoryMeta(root.category);
                const groupNum = groupIndex + 1;
                const separatedSum = childrenQtySumByRootId.get(root.id) ?? 0;
                const showSeparatedHint = children.length > 0 && separatedSum > 1e-9;
                return (
                  <Card key={root.id} className="overflow-hidden border-slate-200/90 dark:border-slate-600">
                    <div className="border-b border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex items-start gap-3">
                        <CategoryProductIcon
                          category={root.category}
                          iconKey={warehouseDisplayIconId(root)}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                            <span className="mr-1 tabular-nums text-slate-500 dark:text-slate-400">
                              {groupNum}.
                            </span>
                            {root.productName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {root.source === 'PROCESSED' && (
                              <Badge variant="muted" className="text-[10px]">
                                {t.sortingProcessed}
                              </Badge>
                            )}
                            {root.source === 'SUPPLIER' && (
                              <Badge variant="muted" className="text-[10px]">
                                {t.whSourceSupplier}
                                {root.supplierName ? `: ${root.supplierName}` : ''}
                              </Badge>
                            )}
                            <Badge className={rootMeta.badge}>
                              {categoryLabel(root.category, t)}
                            </Badge>
                            <span className="text-[11px] text-slate-400">{formatDate(root.incomeDate)}</span>
                          </div>
                          <p className={`mt-2 nums text-base font-bold ${rootMeta.text}`}>
                            {formatNumber(root.currentQty)} {root.unit}
                          </p>
                          {showSeparatedHint && (
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {t.whFamilyTotal}: {formatNumber(separatedSum)}{' '}
                              {root.unit === 'kg' ? 'kg' : t.unitPcs}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                            {t.whColBazaPurchaseShort}: {formatWarehouseUnitPrice(root.purchasePricePerUnit)} ·{' '}
                            {t.whColKochaPurchaseShort}:{' '}
                            {formatWarehouseUnitPrice(root.streetPurchasePricePerUnit)} · {t.whColSaleShort}:{' '}
                            {formatWarehouseUnitPrice(root.salePricePerUnit)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">{root.notes ?? '—'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-600">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingProduct(root);
                            setProductDialogOpen(true);
                          }}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hover:text-red-600"
                          onClick={() => setConfirmDelete(root)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                    {children.length > 0 && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {children.map((w, childIndex) => {
                          const meta = categoryMeta(w.category);
                          return (
                            <div key={w.id} className="bg-indigo-50/30 p-4 pl-4 dark:bg-indigo-950/15">
                              <div className="flex items-start gap-3">
                                <CategoryProductIcon
                                  category={w.category}
                                  iconKey={warehouseDisplayIconId(w)}
                                />
                                <span className="mt-1.5 font-mono text-indigo-500 dark:text-indigo-400">└</span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-800 dark:text-white">
                                    <span className="mr-1 tabular-nums text-slate-500 dark:text-slate-400">
                                      {groupNum}.{childIndex + 1}.
                                    </span>
                                    {w.productName}
                                    <Badge variant="outline" className="ml-2 align-middle text-[9px] font-normal">
                                      {t.whSubLineBadge}
                                    </Badge>
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <Badge className={meta.badge}>{categoryLabel(w.category, t)}</Badge>
                                    <span className="text-[11px] text-slate-400">{formatDate(w.incomeDate)}</span>
                                  </div>
                                  <p className={`mt-1.5 nums text-sm font-semibold ${meta.text}`}>
                                    {formatNumber(w.currentQty)} {w.unit}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                    {t.whColBazaPurchaseShort}: {formatWarehouseUnitPrice(w.purchasePricePerUnit)} ·{' '}
                                    {t.whColKochaPurchaseShort}:{' '}
                                    {formatWarehouseUnitPrice(w.streetPurchasePricePerUnit)} · {t.whColSaleShort}:{' '}
                                    {formatWarehouseUnitPrice(w.salePricePerUnit)}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-emerald-600"
                                  title={t.whChildAddQtyTitle}
                                  onClick={() => {
                                    setChildAddTarget(w);
                                    setChildAddQtyInput('');
                                  }}
                                >
                                  <Plus size={13} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8"
                                  onClick={() => {
                                    setEditingProduct(w);
                                    setProductDialogOpen(true);
                                  }}
                                >
                                  <Pencil size={13} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 hover:text-red-600"
                                  onClick={() => setConfirmDelete(w)}
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* TAB: SOLD */}
        <TabsContent value="sold">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.whProductName}</TableHead>
                  <TableHead>{t.whBuyer}</TableHead>
                  <TableHead className="text-right">{t.whSellQuantity}</TableHead>
                  <TableHead className="text-right">{t.whPricePerUnit}</TableHead>
                  <TableHead className="text-right">{t.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soldOutcomes.length === 0 ? (
                  <TableEmpty colSpan={6} message={t.noData} />
                ) : (
                  soldOutcomes.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(o.date)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 dark:text-white">
                        {o.productName}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {o.customerName ?? '—'}
                      </TableCell>
                      <TableCell className="nums text-right">
                        {formatNumber(o.quantity)} {o.unit}
                      </TableCell>
                      <TableCell className="nums text-right text-xs text-slate-500">
                        {o.pricePerUnit ? formatNumber(o.pricePerUnit) + " so'm" : '—'}
                      </TableCell>
                      <TableCell className="nums text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {o.totalAmount ? formatNumber(o.totalAmount) + " so'm" : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={(o) => {
          setProductDialogOpen(o);
          if (!o) setEditingProduct(null);
        }}
        editing={editingProduct}
        categorySuggestions={warehouseCategorySuggestions}
      />
      <Dialog
        open={!!childAddTarget}
        onOpenChange={(o) => {
          if (!o) {
            setChildAddTarget(null);
            setChildAddQtyInput('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.whChildAddQtyTitle}</DialogTitle>
            <DialogDescription>
              {childAddTarget
                ? t.whChildAddQtyDesc.replace(
                    '{name}',
                    parentProductNameByChildId.get(childAddTarget.id) ?? '—',
                  )
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="child-add-qty">
              {t.whChildAddQtyLabel}
              {childAddTarget ? (
                <span className="font-normal text-slate-400">
                  {' '}
                  ({childAddTarget.unit === 'kg' ? 'kg' : t.unitPcs})
                </span>
              ) : null}
            </Label>
            <Input
              id="child-add-qty"
              value={childAddQtyInput}
              onChange={(e) => setChildAddQtyInput(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitChildAddQty();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setChildAddTarget(null);
                setChildAddQtyInput('');
              }}
            >
              {t.cancel}
            </Button>
            <Button type="button" onClick={submitChildAddQty}>
              {t.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.whDeleteConfirm}
              {confirmDelete && (
                <span className="mt-2 block font-semibold text-slate-800 dark:text-white">
                  {confirmDelete.productName}
                </span>
              )}
              {deleteHasChildren && (
                <span className="mt-2 block text-sm text-amber-700 dark:text-amber-400">
                  {t.whDeleteParentChildren}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
