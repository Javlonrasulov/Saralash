import type { WarehouseItem } from '../store/saralash-store';

function positivePrice(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Ombor qatorining 1 birlik sotib olish narxi: avval baza, keyin ko‘cha. */
export function warehousePurchaseUnitPrice(item: WarehouseItem): number {
  return (
    positivePrice(item.purchasePricePerUnit) ??
    positivePrice(item.streetPurchasePricePerUnit) ??
    0
  );
}

/** Joriy qoldiq × sotib olish narxi. */
export function warehouseStockLineValue(item: WarehouseItem): number {
  const qty = item.currentQty;
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return qty * warehousePurchaseUnitPrice(item);
}
