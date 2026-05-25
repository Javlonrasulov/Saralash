export function isPurchaseFormDirty(form) {
    if (form.partyId.trim() || form.notes.trim() || form.onCredit)
        return true;
    if (form.paidAmount.trim())
        return true;
    for (const line of form.lines) {
        if (line.warehouseItemId)
            return true;
        if (line.qtyParts.length > 0 || line.quantity.trim())
            return true;
        if (line.pricePerUnit.trim())
            return true;
    }
    return false;
}
