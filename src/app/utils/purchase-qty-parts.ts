import { formatQuantity } from './format';

export interface QtyPartsDraftLine {
  quantity: string;
  qtyParts?: number[];
}

export function parseQtyEntry(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function lineQtyParts(line: QtyPartsDraftLine): number[] {
  return line.qtyParts ?? [];
}

/** Yig‘ilgan qismlar + ixtiyoriy kutilayotgan kiritish. */
export function lineQtyTotal(line: QtyPartsDraftLine, includePending = false): number {
  const sum = lineQtyParts(line).reduce((s, n) => s + n, 0);
  if (!includePending) return sum;
  const pending = parseQtyEntry(line.quantity);
  return sum + (pending ?? 0);
}

export function formatQtyPartsExpression(parts: number[], unit: 'kg' | 'pcs'): string {
  if (!parts.length) return '';
  return parts.map((n) => formatQuantity(n, unit)).join('+');
}

export function appendQtyPart(
  line: QtyPartsDraftLine,
  unit: 'kg' | 'pcs',
): { ok: true; qtyParts: number[]; quantity: string } | { ok: false; reason: 'empty' | 'pcs_whole' } {
  const n = parseQtyEntry(line.quantity);
  if (n == null) return { ok: false, reason: 'empty' };
  if (unit === 'pcs' && Math.abs(n - Math.floor(n)) > 1e-9) {
    return { ok: false, reason: 'pcs_whole' };
  }
  return {
    ok: true,
    qtyParts: [...lineQtyParts(line), n],
    quantity: '',
  };
}

/** Submit oldin kutilayotgan kiritishni ham qo‘shish. */
export interface WarehouseQtyLine extends QtyPartsDraftLine {
  key: string;
  warehouseItemId: string;
  pricePerUnit: string;
}

/** Mahsulot tanlanganda: avvalgisini saqlaydi, yangisi bo‘sh (yoki oldin saqlangan qatorni ochadi). */
export function switchWarehouseOnLine<T extends WarehouseQtyLine>(
  lines: T[],
  editingKey: string,
  newWarehouseId: string,
  priceForNew: string,
  unitForWarehouse: (warehouseItemId: string) => 'kg' | 'pcs',
  createLine: () => T,
): { lines: T[]; editingKey: string } {
  let next = [...lines];
  const idx = next.findIndex((l) => l.key === editingKey);
  if (idx < 0) return { lines: next, editingKey };

  const cur = next[idx];
  const prevId = cur.warehouseItemId;

  if (prevId === newWarehouseId) return { lines: next, editingKey };

  if (prevId) {
    const fin = finalizeQtyParts(cur, unitForWarehouse(prevId));
    next[idx] = {
      ...cur,
      warehouseItemId: prevId,
      qtyParts: fin.ok ? fin.qtyParts : cur.qtyParts ?? [],
      quantity: fin.ok ? fin.quantity : '',
    };
  }

  const existing = next.find((l) => l.warehouseItemId === newWarehouseId);
  if (existing) {
    return { lines: next, editingKey: existing.key };
  }

  const slot = next[idx];
  const slotEmpty =
    lineQtyTotal(slot, false) <= 0 &&
    !parseQtyEntry(slot.quantity) &&
    (slot.qtyParts?.length ?? 0) === 0;

  if (slotEmpty || !slot.warehouseItemId) {
    next[idx] = {
      ...slot,
      warehouseItemId: newWarehouseId,
      quantity: '',
      qtyParts: [],
      pricePerUnit: priceForNew,
    };
    return { lines: next, editingKey };
  }

  const added = createLine();
  added.warehouseItemId = newWarehouseId;
  added.pricePerUnit = priceForNew;
  added.quantity = '';
  added.qtyParts = [];
  next = [...next, added];
  return { lines: next, editingKey: added.key };
}

export function finalizeQtyParts(
  line: QtyPartsDraftLine,
  unit: 'kg' | 'pcs',
): { ok: true; qtyParts: number[]; quantity: string; total: number } | { ok: false; reason: 'empty' | 'pcs_whole' } {
  const pending = parseQtyEntry(line.quantity);
  if (pending == null) {
    const total = lineQtyTotal(line, false);
    if (total <= 0) return { ok: false, reason: 'empty' };
    return { ok: true, qtyParts: lineQtyParts(line), quantity: '', total };
  }
  if (unit === 'pcs' && Math.abs(pending - Math.floor(pending)) > 1e-9) {
    return { ok: false, reason: 'pcs_whole' };
  }
  const qtyParts = [...lineQtyParts(line), pending];
  return { ok: true, qtyParts, quantity: '', total: qtyParts.reduce((s, n) => s + n, 0) };
}
