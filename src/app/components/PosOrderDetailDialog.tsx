import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  getAvailableKgForWarehouseSale,
  useStore,
  type WarehouseItem,
  type WarehouseOutcome,
} from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { formatDate, formatMoneyInputDisplay, formatNumber, uid } from '../utils/format';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface DraftLine {
  key: string;
  warehouseItemId: string;
  qty: number;
  price: number;
}

function kgInStock(items: WarehouseItem[]): WarehouseItem[] {
  return items.filter((w) => {
    if (w.unit !== 'kg') return false;
    if (w.parentWarehouseId) {
      const p = items.find((x) => x.id === w.parentWarehouseId);
      return Boolean(p && p.unit === 'kg');
    }
    return w.currentQty > 1e-6 || items.some((ch) => ch.parentWarehouseId === w.id && ch.unit === 'kg');
  });
}

function maxQtyForDraftLine(
  items: WarehouseItem[],
  draft: DraftLine[],
  lineIndex: number,
  originalLines: WarehouseOutcome[],
): number {
  const w = items.find((x) => x.id === draft[lineIndex].warehouseItemId);
  if (!w) return 0;
  const avail = getAvailableKgForWarehouseSale(items, w);
  const released = originalLines
    .filter((o) => o.warehouseItemId === w.id)
    .reduce((s, o) => s + o.quantity, 0);
  const others = draft.reduce((s, l, i) => {
    if (i === lineIndex || l.warehouseItemId !== w.id) return s;
    return s + l.qty;
  }, 0);
  return Math.max(0, avail + released - others);
}

export function PosOrderDetailDialog({
  orderId,
  lines,
  open,
  onOpenChange,
  initialEditMode = false,
}: {
  orderId: string;
  lines: WarehouseOutcome[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tarix jadvalidan «Tahrirlash» — dialog ochilganda darhol tahrir rejimi. */
  initialEditMode?: boolean;
}) {
  const { state, updatePosOrder, deletePosOrder } = useStore();
  const { t } = useApp();

  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saleDate, setSaleDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paidInput, setPaidInput] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);

  const first = lines[0];
  const inStock = useMemo(() => kgInStock(state.warehouseItems), [state.warehouseItems]);

  const resetFromProps = useCallback(() => {
    if (!lines.length) return;
    const f = lines[0];
    setSaleDate(f.date);
    setCustomerId(f.customerId?.trim() ?? '');
    const paid =
      f.orderPaidTotal != null && Number.isFinite(f.orderPaidTotal)
        ? Math.round(f.orderPaidTotal)
        : lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
    setPaidInput(formatMoneyInputDisplay(String(paid)));
    setDraftLines(
      lines.map((l) => ({
        key: uid('edit'),
        warehouseItemId: l.warehouseItemId,
        qty: l.quantity,
        price: l.pricePerUnit ?? 0,
      })),
    );
    setEditMode(false);
  }, [lines]);

  useEffect(() => {
    if (!open || !lines.length) return;
    resetFromProps();
    if (initialEditMode) setEditMode(true);
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

  const orderTotal = useMemo(
    () => draftLines.reduce((s, l) => s + l.qty * l.price, 0),
    [draftLines],
  );

  const paidRaw = useMemo(() => {
    const x = parseFloat(String(paidInput).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(x) ? Math.max(0, x) : 0;
  }, [paidInput]);

  const paidClamped = Math.min(paidRaw, orderTotal || 0);
  const debtPreview = Math.max(0, orderTotal - paidClamped);

  const buyerLabel = useMemo(() => {
    if (!first) return '—';
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
    if (!w) return;
    setDraftLines((d) => [
      ...d,
      { key: uid('edit'), warehouseItemId: w.id, qty: 1, price: w.salePricePerUnit ?? 0 },
    ]);
  };

  if (!lines.length) return null;

  const viewTotal = lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
  const viewPaid =
    first.orderPaidTotal != null && Number.isFinite(first.orderPaidTotal)
      ? Math.max(0, Math.min(first.orderPaidTotal, viewTotal))
      : viewTotal;
  const viewDebt = Math.max(0, viewTotal - viewPaid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,720px)] w-[min(96vw,42rem)] max-w-[42rem] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.posOrderDetailTitle}</DialogTitle>
        </DialogHeader>

        {!editMode ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-slate-500">{t.date}</span>
                <p className="font-medium text-slate-900 dark:text-white">{formatDate(first.date)}</p>
              </div>
              <div>
                <span className="text-slate-500">{t.whBuyer}</span>
                <p className="font-medium text-slate-900 dark:text-white">{buyerLabel}</p>
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-slate-500">{t.salesAmount}</span>
                <p className="nums font-semibold text-slate-900 dark:text-white">
                  {formatNumber(viewTotal)} so'm
                </p>
              </div>
              <div>
                <span className="text-slate-500">{t.posPaidLabel}</span>
                <p className="nums font-semibold text-slate-800 dark:text-slate-100">
                  {formatNumber(viewPaid)} so'm
                </p>
              </div>
              <div>
                <span className="text-slate-500">{t.posDebtLabel}</span>
                <p className="nums font-semibold text-amber-600 dark:text-amber-400">
                  {formatNumber(viewDebt)} so'm
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.whProductName}</TableHead>
                  <TableHead className="text-right">{t.quantity}</TableHead>
                  <TableHead className="text-right">{t.whPricePerUnit}</TableHead>
                  <TableHead className="text-right">{t.posLineTotal}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.productName}</TableCell>
                    <TableCell className="nums text-right">
                      {formatNumber(l.quantity)} {l.unit === 'kg' ? 'kg' : t.unitPcs}
                    </TableCell>
                    <TableCell className="nums text-right">
                      {l.pricePerUnit != null ? `${formatNumber(l.pricePerUnit)} so'm` : '—'}
                    </TableCell>
                    <TableCell className="nums text-right font-medium">
                      {formatNumber(l.totalAmount ?? l.quantity * (l.pricePerUnit ?? 0))} so'm
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <Button type="button" className="rounded-xl" onClick={() => setEditMode(true)}>
                {t.posEditOrder}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                onClick={() => setConfirmDelete(true)}
              >
                {t.delete}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">{t.date}</Label>
                <Input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs">{t.posSelectClient}</Label>
                <Select value={customerId || undefined} onValueChange={setCustomerId}>
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue placeholder={t.posSelectClient} />
                  </SelectTrigger>
                  <SelectContent>
                    {state.customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {draftLines.map((line, idx) => {
                const cap = maxQtyForDraftLine(state.warehouseItems, draftLines, idx, lines);
                return (
                  <div
                    key={line.key}
                    className="grid gap-2 rounded-xl border border-slate-100 p-3 dark:border-slate-700 sm:grid-cols-[1fr_5.5rem_6.5rem_2rem]"
                  >
                    <div className="min-w-0 sm:col-span-1">
                      <Label className="text-[10px] text-slate-500">{t.whProductName}</Label>
                      <Select
                        value={line.warehouseItemId}
                        onValueChange={(v) =>
                          setDraftLines((d) => {
                            const next = [...d];
                            const it = state.warehouseItems.find((x) => x.id === v);
                            next[idx] = {
                              ...next[idx],
                              warehouseItemId: v,
                              price:
                                it?.salePricePerUnit != null && Number.isFinite(it.salePricePerUnit)
                                  ? it.salePricePerUnit
                                  : next[idx].price,
                            };
                            return next;
                          })
                        }
                      >
                        <SelectTrigger className="mt-1 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {inStock.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.productName} ({formatNumber(w.currentQty)} kg)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-[10px] text-slate-400">
                        max ~{formatNumber(cap)} kg
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">kg</Label>
                      <Input
                        className="mt-1 rounded-xl"
                        inputMode="decimal"
                        value={String(line.qty).replace('.', ',')}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value.replace(/\s/g, '').replace(',', '.'));
                          setDraftLines((d) => {
                            const next = [...d];
                            next[idx] = { ...next[idx], qty: Number.isFinite(v) && v > 0 ? v : 0 };
                            return next;
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">{t.posPricePerKg}</Label>
                      <Input
                        className="mt-1 rounded-xl"
                        inputMode="numeric"
                        value={formatMoneyInputDisplay(String(line.price))}
                        onChange={(e) => {
                          const raw = formatMoneyInputDisplay(e.target.value);
                          const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
                          setDraftLines((d) => {
                            const next = [...d];
                            next[idx] = { ...next[idx], price: Number.isFinite(n) ? n : 0 };
                            return next;
                          });
                        }}
                      />
                    </div>
                    <div className="flex items-end justify-end pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-600"
                        disabled={draftLines.length <= 1}
                        onClick={() => setDraftLines((d) => d.filter((_, i) => i !== idx))}
                        aria-label={t.posRemove}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addDraftLine}>
              {t.posAddOrderLine}
            </Button>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">{t.salesAmount}</Label>
                <p className="nums mt-1 text-lg font-bold">{formatNumber(orderTotal)} so'm</p>
              </div>
              <div>
                <Label className="text-xs">{t.posPaidLabel}</Label>
                <Input
                  value={paidInput}
                  onChange={(e) => setPaidInput(formatMoneyInputDisplay(e.target.value))}
                  className="mt-1.5 rounded-xl"
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label className="text-xs">{t.posDebtLabel}</Label>
                <p className="nums mt-2 font-semibold text-amber-600 dark:text-amber-400">
                  {formatNumber(debtPreview)} so'm
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  resetFromProps();
                }}
              >
                {t.posCancelEdit}
              </Button>
              <Button type="button" className="rounded-xl bg-sky-500 hover:bg-sky-600" onClick={handleSave}>
                {t.posSaveOrder}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
            <AlertDialogDescription>{t.posDeleteOrderConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
