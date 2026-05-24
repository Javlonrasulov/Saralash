import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import {
  useStore,
  type StreetPurchaseHistoryGroup,
  type WarehouseItem,
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
import { Badge } from './ui/badge';
import { categoryLabel, categoryMeta } from '../utils/category';
import { formatDate, formatNumber, formatQuantity, uid } from '../utils/format';
import { CumulativeQuantityField } from './CumulativeQuantityField';
import {
  appendQtyPart,
  finalizeQtyParts,
  lineQtyTotal,
  switchWarehouseOnLine,
} from '../utils/purchase-qty-parts';
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
  quantity: string;
  qtyParts: number[];
  pricePerUnit: string;
}

function newDraftLine(warehouseItemId = '', pricePerUnit = ''): DraftLine {
  return { key: uid('spe'), warehouseItemId, quantity: '', qtyParts: [], pricePerUnit };
}

export function StreetObjectPurchaseEditDialog({
  batch,
  open,
  onOpenChange,
  warehouseOptions,
  warehouseProductTitle,
  prefPrice,
}: {
  batch: StreetPurchaseHistoryGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseOptions: WarehouseItem[];
  warehouseProductTitle: (w: WarehouseItem) => string;
  prefPrice: (w: WarehouseItem | undefined) => string;
}) {
  const { state, replaceStreetPurchaseBatch, deleteStreetPurchaseBatch } = useStore();
  const { t } = useApp();

  const [streetObjectId, setStreetObjectId] = useState('');
  const [incomeDate, setIncomeDate] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [onCredit, setOnCredit] = useState(false);
  const [notes, setNotes] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [editingKey, setEditingKey] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resetFromBatch = useCallback(() => {
    if (!batch?.lines.length) return;
    const first = batch.lines[0];
    setStreetObjectId(batch.streetObjectId ?? '');
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
      pricePerUnit:
        l.pricePerUnit != null && Number.isFinite(l.pricePerUnit) ? String(l.pricePerUnit) : '',
    }));
    setDraftLines(mapped);
    setEditingKey(mapped[0]?.key ?? '');
    void first;
  }, [batch]);

  useEffect(() => {
    if (open && batch) resetFromBatch();
  }, [open, batch, resetFromBatch]);

  const parseDraftLine = (line: DraftLine) => {
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
    if (orderTotal == null) return null;
    const payRaw = paidAmount.trim().replace(',', '.');
    const paid =
      payRaw === '' ? 0 : Number.isFinite(parseFloat(payRaw)) ? Math.max(0, parseFloat(payRaw)) : null;
    if (paid == null) return null;
    return Math.max(0, orderTotal - paid);
  }, [orderTotal, paidAmount]);

  useEffect(() => {
    if (!open || onCredit || orderTotal == null) return;
    const next = String(Math.round(orderTotal * 100) / 100);
    setPaidAmount((p) => (p === next ? p : next));
  }, [open, onCredit, orderTotal]);

  const sessionQtyByWarehouseId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of draftLines) {
      const { w, qtyNum } = parseDraftLine(line);
      if (!w || qtyNum == null) continue;
      map.set(w.id, (map.get(w.id) ?? 0) + qtyNum);
    }
    return map;
  }, [draftLines, state.warehouseItems]);

  const warehouseSessionLabel = (w: WarehouseItem) => {
    const q = sessionQtyByWarehouseId.get(w.id) ?? 0;
    const u = w.unit === 'kg' ? 'kg' : t.unitPcs;
    return `${warehouseProductTitle(w)} (${formatQuantity(q, w.unit)} ${u})`;
  };

  const selectDraftWarehouse = (lineKey: string, newWarehouseId: string) => {
    const item = state.warehouseItems.find((x) => x.id === newWarehouseId);
    const unitFor = (id: string) =>
      state.warehouseItems.find((x) => x.id === id)?.unit ?? 'kg';
    const { lines, editingKey: nextKey } = switchWarehouseOnLine(
      draftLines,
      lineKey,
      newWarehouseId,
      prefPrice(item),
      unitFor,
      () => newDraftLine(),
    );
    setDraftLines(lines);
    setEditingKey(nextKey);
  };

  const appendDraftQtyPart = (key: string) => {
    const line = draftLines.find((l) => l.key === key);
    if (!line?.warehouseItemId) {
      toast.error(t.required);
      return;
    }
    const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
    const result = appendQtyPart(line, w?.unit ?? 'kg');
    if (!result.ok) {
      if (result.reason === 'pcs_whole') toast.error(t.streetPurchasePcsWhole);
      else toast.error(t.required);
      return;
    }
    updateDraftLine(key, { qtyParts: result.qtyParts, quantity: result.quantity });
  };

  const updateDraftLine = (key: string, patch: Partial<DraftLine>) => {
    setDraftLines((d) => d.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeDraftLine = (key: string) => {
    setDraftLines((d) => {
      const next = d.filter((l) => l.key !== key);
      const lines = next.length ? next : [newDraftLine()];
      if (editingKey === key) setEditingKey(lines[lines.length - 1].key);
      return lines;
    });
  };

  const handleSave = () => {
    if (!batch) return;
    const sid = streetObjectId.trim();
    if (!sid || !state.streetObjects.some((s) => s.id === sid)) {
      toast.error(t.streetPurchasePickSupplier);
      return;
    }

    const resolved: Array<{
      warehouseItemId: string;
      quantity: number;
      streetPurchasePricePerUnit: number | null;
    }> = [];

    for (const line of draftLines) {
      if (!line.warehouseItemId) {
        toast.error(t.required + ': ' + t.streetPurchasePickParent);
        return;
      }
      const w = state.warehouseItems.find((x) => x.id === line.warehouseItemId);
      const finalized = finalizeQtyParts(line, w?.unit ?? 'kg');
      if (!finalized.ok) {
        if (finalized.reason === 'pcs_whole') toast.error(t.streetPurchasePcsWhole);
        else toast.error(t.required + ': ' + t.whQuantity);
        return;
      }
      const normalized = { ...line, qtyParts: finalized.qtyParts, quantity: finalized.quantity };
      const { qtyNum, priceNum } = parseDraftLine(normalized);
      if (!w || qtyNum == null) {
        toast.error(t.required + ': ' + t.whQuantity);
        return;
      }
      if (w.unit === 'pcs' && Math.abs(qtyNum - Math.floor(qtyNum)) > 1e-9) {
        toast.error(t.streetPurchasePcsWhole);
        return;
      }
      resolved.push({
        warehouseItemId: line.warehouseItemId,
        quantity: qtyNum,
        streetPurchasePricePerUnit: priceNum,
      });
    }

    let paidNum: number | null = null;
    if (orderTotal != null) {
      const payRaw = paidAmount.trim().replace(',', '.');
      if (onCredit && payRaw === '') paidNum = 0;
      else if (!payRaw) {
        toast.error(t.required + ': ' + t.streetPaidAmount);
        return;
      } else {
        paidNum = parseFloat(payRaw);
        if (!Number.isFinite(paidNum) || paidNum < 0) {
          toast.error(t.whValidateOptionalPrice);
          return;
        }
      }
      const eps = 1e-4 * Math.max(1, orderTotal);
      if (!onCredit) {
        if (Math.abs(paidNum! - orderTotal) > eps) {
          toast.error(t.streetPaidMustEqualTotal);
          return;
        }
      } else if (paidNum! > orderTotal + 1e-6) {
        toast.error(t.streetPaidExceedsTotal);
        return;
      }
    }

    const ok = replaceStreetPurchaseBatch(batch.batchId, {
      streetObjectId: sid,
      incomeDate,
      notes: notes.trim() || undefined,
      onCredit,
      paidAmount: orderTotal != null ? paidNum! : undefined,
      lines: resolved,
    });
    if (!ok) {
      toast.error(t.streetPurchaseCannotReverse);
      return;
    }
    toast.success(t.streetPurchaseUpdated);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!batch) return;
    const ok = deleteStreetPurchaseBatch(batch.batchId);
    if (!ok) {
      toast.error(t.streetPurchaseCannotReverse);
      return;
    }
    toast.success(t.streetPurchaseDeleted);
    setConfirmDelete(false);
    onOpenChange(false);
  };

  if (!batch) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.streetEditPurchaseTitle}</DialogTitle>
          <p className="text-xs text-slate-500">
            {formatDate(batch.incomeDate)} · {batch.streetObjectName} · {batch.lines.length}{' '}
            {t.streetHistoryProductCount}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t.streetPurchasePickSupplier} *</Label>
            <Select value={streetObjectId || undefined} onValueChange={setStreetObjectId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t.streetPurchasePickSupplier} />
              </SelectTrigger>
              <SelectContent>
                {state.streetObjects.map((s) => (
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
              value={incomeDate}
              onChange={(e) => setIncomeDate(e.target.value)}
              className="mt-1.5 max-w-[12rem]"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.streetPurchaseLinesTitle}</Label>
            {(() => {
              const editingLine =
                draftLines.find((l) => l.key === editingKey) ?? draftLines[draftLines.length - 1];
              const collapsedLines = draftLines.filter(
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
                          <span className="font-medium">{w ? warehouseProductTitle(w) : '—'}</span>
                          {qtyNum != null && (
                            <span className="text-slate-600 dark:text-slate-300">
                              {' '}
                              ·{' '}
                              <span className="nums">
                                {formatQuantity(qtyNum, w?.unit ?? 'kg')} {unitLbl}
                              </span>
                              {lineTotal != null && (
                                <>
                                  {' '}
                                  ·{' '}
                                  <span className="nums font-semibold">
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
                          className="h-8 w-8 shrink-0"
                          onClick={() => setEditingKey(line.key)}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-red-600"
                          onClick={() => removeDraftLine(line.key)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    );
                  })}
                  {editingLine && (
                    <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                      <Select
                        value={editingLine.warehouseItemId || undefined}
                        onValueChange={(v) => selectDraftWarehouse(editingLine.key, v)}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {warehouseOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {warehouseSessionLabel(opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="space-y-2">
                        <CumulativeQuantityField
                          label={<>{t.whQuantity} *</>}
                          quantity={editingLine.quantity}
                          qtyParts={editingLine.qtyParts}
                          unit={editW?.unit ?? 'kg'}
                          unitLabel={editW?.unit === 'pcs' ? t.unitPcs : 'kg'}
                          runningTotalLabel={t.streetQtyRunningTotal}
                          addAriaLabel={t.streetQtyAddPart}
                          placeholder={editW?.unit === 'kg' ? '2,3' : '5'}
                          pcsHint={editW?.unit === 'pcs' ? t.streetPurchasePcsWhole : undefined}
                          onQuantityChange={(value) =>
                            updateDraftLine(editingLine.key, { quantity: value })
                          }
                          onAddPart={() => appendDraftQtyPart(editingLine.key)}
                        />
                        <div>
                          <Label className="text-xs">{t.streetPricePerUnit}</Label>
                          <Input
                            value={editingLine.pricePerUnit}
                            onChange={(e) =>
                              updateDraftLine(editingLine.key, { pricePerUnit: e.target.value })
                            }
                            className="mt-1 rounded-xl"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                      <p className="text-xs">
                        {t.streetLineTotal}:{' '}
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

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-xs text-slate-500">{t.streetPurchaseGrandTotal}</p>
            <p className="nums text-lg font-semibold">
              {orderTotal != null ? `${formatNumber(orderTotal)} so'm` : '—'}
            </p>
          </div>

          <div>
            <Label>
              {t.streetPaidAmount}
              {orderTotal != null ? ' *' : ''}
            </Label>
            <Input
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="mt-1.5"
              disabled={orderTotal == null || !onCredit}
              inputMode="decimal"
            />
            {onCredit && orderTotal != null && debtPreview != null && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {t.streetDebtPreview}: {formatNumber(debtPreview)} so'm
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 dark:border-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={onCredit}
              onChange={(e) => setOnCredit(e.target.checked)}
            />
            <span className="text-sm">{t.streetOnCredit}</span>
          </label>

          <div>
            <Label>{t.notes}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" />
          </div>

          <p className="text-xs text-slate-500">{t.streetPurchaseReverseHint}</p>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="text-red-600"
            onClick={() => setConfirmDelete(true)}
          >
            {t.delete}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="button" onClick={handleSave}>
              {t.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
            <AlertDialogDescription>{t.streetDeletePurchaseConfirm}</AlertDialogDescription>
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
