import { lineQtyTotal } from './purchase-qty-parts';

export type IntakePurchaseDraftLine = {
  warehouseItemId: string;
  quantity: string;
  qtyParts: number[];
  pricePerUnit: string;
};

export type IntakePurchaseDraftForm = {
  entityId: string;
  incomeDate: string;
  paidAmount: string;
  onCredit: boolean;
  notes: string;
  lines: IntakePurchaseDraftLine[];
};

/** Xarid dialogida foydalanuvchi kiritgan ma'lumot bormi (bekor qilishda ogohlantirish uchun). */
export function isIntakePurchaseFormDirty(form: IntakePurchaseDraftForm): boolean {
  if (form.entityId.trim()) return true;
  if (form.notes.trim()) return true;
  if (form.onCredit) return true;
  if (form.paidAmount.trim()) return true;
  for (const line of form.lines) {
    if (lineQtyTotal(line, false) > 0) return true;
    if (line.pricePerUnit.trim()) return true;
  }
  return false;
}

export function toIntakePurchaseDraft(
  form: {
    supplierId?: string;
    streetObjectId?: string;
    incomeDate: string;
    paidAmount: string;
    onCredit: boolean;
    notes: string;
    lines: IntakePurchaseDraftLine[];
  },
): IntakePurchaseDraftForm {
  return {
    entityId: form.supplierId ?? form.streetObjectId ?? '',
    incomeDate: form.incomeDate,
    paidAmount: form.paidAmount,
    onCredit: form.onCredit,
    notes: form.notes,
    lines: form.lines,
  };
}
