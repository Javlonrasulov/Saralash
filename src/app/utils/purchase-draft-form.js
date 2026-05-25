import { lineQtyTotal } from './purchase-qty-parts';
/** Xarid dialogida foydalanuvchi kiritgan ma'lumot bormi (bekor qilishda ogohlantirish uchun). */
export function isIntakePurchaseFormDirty(form) {
    if (form.entityId.trim())
        return true;
    if (form.notes.trim())
        return true;
    if (form.onCredit)
        return true;
    if (form.paidAmount.trim())
        return true;
    for (const line of form.lines) {
        if (lineQtyTotal(line, false) > 0)
            return true;
        if (line.pricePerUnit.trim())
            return true;
    }
    return false;
}
export function toIntakePurchaseDraft(form) {
    return {
        entityId: form.supplierId ?? form.streetObjectId ?? '',
        incomeDate: form.incomeDate,
        paidAmount: form.paidAmount,
        onCredit: form.onCredit,
        notes: form.notes,
        lines: form.lines,
    };
}
