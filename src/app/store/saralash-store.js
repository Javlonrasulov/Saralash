import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, } from 'react';
import { TODAY, uid } from '../utils/format';
// ============================================================================
// TYPES
// ============================================================================
/** Asosiy kategoriyalar — qo'shimcha kategoriyalar foydalanuvchi tomonidan kiritilishi mumkin. */
export const DEFAULT_CATEGORIES = ['paper', 'plastic', 'glass', 'metal', 'cardboard', 'other'];
/** Tizim ilk martalik default kategoriyalar (foydalanuvchi keyin tahrirlashi mumkin). */
const DEFAULT_EXPENSE_CATEGORY_NAMES = [
    'Ish haqi',
    'Ijara',
    'Kommunal xizmatlar',
    'Yoqilg‘i',
    'Transport',
    'Ta’minot',
    'Soliqlar',
    'Boshqa',
];
const STORAGE_KEY = 'saralash_state_v1';
const INITIAL_STATE = {
    customers: [],
    suppliers: [],
    supplierPurchases: [],
    supplierDebtRepayments: [],
    intakes: [],
    sortedMaterials: [],
    processedBatches: [],
    warehouseItems: [],
    outcomes: [],
    expenseCategories: [],
    expenses: [],
};
function buildDefaultExpenseCategories() {
    const now = new Date().toISOString();
    return DEFAULT_EXPENSE_CATEGORY_NAMES.map((name, idx) => ({
        id: uid('exc'),
        name,
        builtIn: true,
        /** Tartib (eski → yangi) seed paytida chiroyli ko‘rinishi uchun (tartib createdAt bo‘yicha). */
        createdAt: new Date(Date.now() - (DEFAULT_EXPENSE_CATEGORY_NAMES.length - idx) * 1000).toISOString() ||
            now,
    }));
}
function warehouseChildFromParent(parent, productName, qty, batchCreatedAt) {
    return {
        id: uid('wh'),
        productName,
        category: parent.category,
        unit: parent.unit,
        initialQty: qty,
        currentQty: qty,
        incomeDate: parent.incomeDate,
        source: parent.source,
        sourceBatchId: parent.sourceBatchId ?? null,
        supplierId: parent.supplierId ?? null,
        supplierName: parent.supplierName ?? null,
        parentWarehouseId: parent.id,
        notes: undefined,
        purchasePricePerUnit: parent.purchasePricePerUnit ?? null,
        salePricePerUnit: parent.salePricePerUnit ?? null,
        status: 'IN_STOCK',
        createdAt: batchCreatedAt,
    };
}
/**
 * Bitta qarz to‘lovini xarid qatorlariga qo‘llash (FIFO: avval `incomeDate`, keyin `createdAt` bo‘yicha).
 * `supplierDebtAmount` kamayadi, shu qatorda `paidAmount` ga taqsimlangan summa qo‘shiladi (jami bo‘lsa — `totalAmount` dan oshmaydi).
 */
function applyRepaymentToSupplierPurchases(purchases, repayment) {
    let left = repayment.amount;
    if (!Number.isFinite(left) || left <= 1e-9)
        return purchases;
    const indices = purchases
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.supplierId === repayment.supplierId &&
        p.supplierDebtAmount != null &&
        Number.isFinite(p.supplierDebtAmount) &&
        p.supplierDebtAmount > 1e-9)
        .sort((a, b) => {
        const c = a.p.incomeDate.localeCompare(b.p.incomeDate);
        if (c !== 0)
            return c;
        return String(a.p.createdAt).localeCompare(String(b.p.createdAt));
    })
        .map((x) => x.i);
    if (indices.length === 0)
        return purchases;
    const next = purchases.map((p) => ({ ...p }));
    for (const idx of indices) {
        if (left <= 1e-9)
            break;
        const p = next[idx];
        const d = p.supplierDebtAmount ?? 0;
        if (d <= 1e-9)
            continue;
        const take = Math.min(d, left);
        const newDebt = d - take;
        const nz = newDebt < 1e-6 ? 0 : newDebt;
        const prevPaid = p.paidAmount != null && Number.isFinite(p.paidAmount) && p.paidAmount >= 0 ? p.paidAmount : 0;
        const lineTotal = p.totalAmount != null && Number.isFinite(p.totalAmount) && p.totalAmount > 0 ? p.totalAmount : null;
        /** Jami bo‘lsa: to‘langan = jami − qoldiq qarz (keyingi qarz to‘lovlari bilan ham mos). */
        const nextPaid = lineTotal != null ? Math.max(0, lineTotal - nz) : prevPaid + take;
        next[idx] = {
            ...p,
            supplierDebtAmount: nz,
            paidAmount: nextPaid,
            onCredit: nz > 1e-6 ? p.onCredit : false,
        };
        left -= take;
    }
    return next;
}
/** `totalAmount` bor qatorlarda: to‘langan = jami − qarz (eski saqlanmalardagi 60 so‘m qolib ketishini tuzatish). */
function syncAllSupplierPurchasesPaidFromTotals(purchases) {
    return purchases.map((p) => {
        const T = p.totalAmount;
        if (T == null || !Number.isFinite(T) || T <= 0)
            return p;
        const D = p.supplierDebtAmount != null && Number.isFinite(p.supplierDebtAmount)
            ? Math.max(0, p.supplierDebtAmount)
            : 0;
        const correct = Math.max(0, T - D);
        const prev = p.paidAmount != null && Number.isFinite(p.paidAmount) ? p.paidAmount : 0;
        if (Math.abs(prev - correct) <= 1e-4 * Math.max(1, T))
            return p;
        return { ...p, paidAmount: correct };
    });
}
/** localStorage dan yuklanganda: avval yozilgan to‘lovlar bo‘yicha qarz qatorlarini bir martalik moslashtirish. */
function reconcileSupplierPurchasesDebtsWithRepayments(purchases, repayments) {
    if (!repayments.length)
        return purchases;
    const ordered = [...repayments].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    let next = purchases;
    for (const r of ordered) {
        next = applyRepaymentToSupplierPurchases(next, r);
    }
    return next;
}
/** kg: bola qatorida sotuv/chiqim — avval boladan, yetmasa otadan yechiladi. */
export function getAvailableKgForWarehouseSale(items, w) {
    if (w.unit !== 'kg')
        return w.currentQty;
    if (!w.parentWarehouseId)
        return Math.max(0, w.currentQty);
    const p = items.find((x) => x.id === w.parentWarehouseId);
    if (!p || p.unit !== 'kg')
        return Math.max(0, w.currentQty);
    return Math.max(0, w.currentQty) + Math.max(0, p.currentQty);
}
function cloneWarehouseItemMap(items) {
    return new Map(items.map((x) => [x.id, { ...x }]));
}
function emptyQtyStatus(movement) {
    return movement === 'SOLD' ? 'SOLD_OUT' : 'CONSUMED_OUT';
}
/**
 * kg chiqim: ota-bola oilasida miqdorni yechish.
 * - Ota qatori: faqat o‘z `currentQty` dan.
 * - Bola: `bola + ota` dan, avval bola, qolgani ota.
 */
function applyKgWarehouseMovement(map, warehouseItemId, quantity, movement) {
    const item = map.get(warehouseItemId);
    if (!item || item.unit !== 'kg' || quantity <= 0)
        return false;
    if (!item.parentWarehouseId) {
        const nq = item.currentQty - quantity;
        if (nq < -1e-9)
            return false;
        const z = Math.max(0, nq);
        map.set(item.id, {
            ...item,
            currentQty: z,
            status: z <= 1e-9 ? emptyQtyStatus(movement) : 'IN_STOCK',
        });
        return true;
    }
    const parent = map.get(item.parentWarehouseId);
    if (!parent || parent.unit !== 'kg')
        return false;
    const avail = item.currentQty + parent.currentQty;
    if (quantity - avail > 1e-9)
        return false;
    const fromChild = Math.min(quantity, item.currentQty);
    const fromParent = quantity - fromChild;
    const childNq = item.currentQty - fromChild;
    const parentNq = parent.currentQty - fromParent;
    if (childNq < -1e-9 || parentNq < -1e-9)
        return false;
    map.set(item.id, {
        ...item,
        currentQty: Math.max(0, childNq),
        status: childNq <= 1e-9 ? emptyQtyStatus(movement) : 'IN_STOCK',
    });
    map.set(parent.id, {
        ...parent,
        currentQty: Math.max(0, parentNq),
        status: parentNq <= 1e-9 ? emptyQtyStatus(movement) : 'IN_STOCK',
    });
    return true;
}
/** Sotuvni bekor qilish / chekni yangilash: kg qaytarish (split saqlangan bo‘lsa aniq). */
function restoreKgSoldOutcome(map, outcome) {
    if (outcome.unit !== 'kg' || outcome.quantity <= 0)
        return false;
    const item = map.get(outcome.warehouseItemId);
    if (!item || item.unit !== 'kg')
        return false;
    const Q = outcome.quantity;
    if (!item.parentWarehouseId) {
        const nq = item.currentQty + Q;
        map.set(item.id, {
            ...item,
            currentQty: nq,
            status: nq > 1e-9 ? 'IN_STOCK' : item.status,
        });
        if (nq > 1e-9) {
            const z = map.get(item.id);
            if (z.status === 'SOLD_OUT' || z.status === 'CONSUMED_OUT') {
                map.set(item.id, { ...z, status: 'IN_STOCK' });
            }
        }
        return true;
    }
    const parent = map.get(item.parentWarehouseId);
    if (!parent || parent.unit !== 'kg')
        return false;
    let fc = outcome.soldFromChildKg;
    let fp = outcome.soldFromParentKg;
    if (fc == null ||
        fp == null ||
        !Number.isFinite(fc) ||
        !Number.isFinite(fp) ||
        fc < -1e-9 ||
        fp < -1e-9 ||
        Math.abs(fc + fp - Q) > 1e-3 * Math.max(1, Q)) {
        fc = Q;
        fp = 0;
    }
    const childNq = item.currentQty + fc;
    const parentNq = parent.currentQty + fp;
    map.set(item.id, {
        ...item,
        currentQty: Math.max(0, childNq),
        status: childNq > 1e-9 ? 'IN_STOCK' : item.status,
    });
    map.set(parent.id, {
        ...parent,
        currentQty: Math.max(0, parentNq),
        status: parentNq > 1e-9 ? 'IN_STOCK' : parent.status,
    });
    return true;
}
function reducer(state, action) {
    switch (action.type) {
        case 'HYDRATE':
            return action.payload;
        case 'CUSTOMER_ADD':
            return { ...state, customers: [action.payload, ...state.customers] };
        case 'CUSTOMER_UPDATE':
            return {
                ...state,
                customers: state.customers.map((c) => (c.id === action.payload.id ? action.payload : c)),
            };
        case 'CUSTOMER_DELETE':
            return {
                ...state,
                customers: state.customers.filter((c) => c.id !== action.payload.id),
            };
        case 'SUPPLIER_ADD':
            return { ...state, suppliers: [action.payload, ...state.suppliers] };
        case 'SUPPLIER_UPDATE':
            return {
                ...state,
                suppliers: state.suppliers.map((s) => (s.id === action.payload.id ? action.payload : s)),
                warehouseItems: state.warehouseItems.map((w) => w.supplierId === action.payload.id ? { ...w, supplierName: action.payload.fullName } : w),
            };
        case 'SUPPLIER_DELETE':
            return {
                ...state,
                suppliers: state.suppliers.filter((s) => s.id !== action.payload.id),
                warehouseItems: state.warehouseItems.map((w) => w.supplierId === action.payload.id ? { ...w, supplierId: null } : w),
                supplierPurchases: state.supplierPurchases.map((p) => p.supplierId === action.payload.id ? { ...p, supplierId: null } : p),
            };
        case 'SUPPLIER_PURCHASE_ADD':
            return { ...state, supplierPurchases: [action.payload, ...state.supplierPurchases] };
        case 'SUPPLIER_DEBT_REPAYMENT_ADD': {
            const repayment = action.payload;
            const supplierPurchases = applyRepaymentToSupplierPurchases(state.supplierPurchases, repayment);
            return {
                ...state,
                supplierDebtRepayments: [repayment, ...state.supplierDebtRepayments],
                supplierPurchases,
            };
        }
        case 'INTAKE_ADD':
            return { ...state, intakes: [action.payload, ...state.intakes] };
        case 'INTAKE_DELETE':
            return {
                ...state,
                intakes: state.intakes.filter((i) => i.id !== action.payload.id),
                sortedMaterials: state.sortedMaterials.filter((s) => s.intakeId !== action.payload.id),
            };
        case 'SORT_DISTRIBUTE': {
            const { intakeId, rows } = action.payload;
            const intake = state.intakes.find((i) => i.id === intakeId);
            if (!intake)
                return state;
            const totalDistributed = rows.reduce((sum, r) => sum + r.weightKg, 0);
            const newRemaining = Math.max(0, intake.remainingKg - totalDistributed);
            const nextStatus = newRemaining <= 0 ? 'SORTED' : 'PARTIALLY_SORTED';
            const newSorted = rows.map((r) => ({
                id: uid('srt'),
                intakeId: intake.id,
                intakeName: intake.materialName,
                date: TODAY,
                category: r.category,
                weightKg: r.weightKg,
                remainingKg: r.weightKg,
                status: 'IN_STOCK',
                createdAt: new Date().toISOString(),
            }));
            return {
                ...state,
                intakes: state.intakes.map((i) => i.id === intakeId ? { ...i, remainingKg: newRemaining, status: nextStatus } : i),
                sortedMaterials: [...newSorted, ...state.sortedMaterials],
            };
        }
        case 'PROCESS_BATCH': {
            const { batch, consumedSorted, warehouseItem } = action.payload;
            const consumedById = new Map(consumedSorted.map((c) => [c.id, c.weightKg]));
            return {
                ...state,
                processedBatches: [batch, ...state.processedBatches],
                sortedMaterials: state.sortedMaterials.map((s) => {
                    const consumed = consumedById.get(s.id);
                    if (!consumed)
                        return s;
                    const next = Math.max(0, s.remainingKg - consumed);
                    return {
                        ...s,
                        remainingKg: next,
                        status: next <= 0 ? 'PROCESSED' : s.status,
                    };
                }),
                warehouseItems: [warehouseItem, ...state.warehouseItems],
            };
        }
        case 'WAREHOUSE_ADD':
            return { ...state, warehouseItems: [action.payload, ...state.warehouseItems] };
        case 'WAREHOUSE_UPDATE':
            return {
                ...state,
                warehouseItems: state.warehouseItems.map((w) => w.id === action.payload.id ? action.payload : w),
            };
        case 'WAREHOUSE_ADD_WITH_CHILD_SPLITS': {
            const { parent, splits } = action.payload;
            if (parent.parentWarehouseId)
                return state;
            let parentQty = Math.max(0, parent.currentQty);
            const batchAt = parent.createdAt;
            const children = [];
            for (const s of splits) {
                const name = s.productName.trim();
                let q = s.quantity;
                if (parent.unit === 'pcs')
                    q = Math.floor(Number(q));
                if (!name || !Number.isFinite(q) || q < 0)
                    continue;
                /** 0 kg/dona ajratilgan qator ham ro'yxatda bo'lsin (nom bo'lsa). */
                if (parentQty + 1e-9 >= q) {
                    parentQty -= q;
                    children.push(warehouseChildFromParent(parent, name, q, batchAt));
                }
                else {
                    children.push(warehouseChildFromParent(parent, name, q, batchAt));
                }
            }
            const pq = Math.max(0, parentQty);
            const parentFinal = {
                ...parent,
                currentQty: pq,
                /** Tashqi qator: 0 qoldiq ham ro'yxatda qolishi uchun */
                status: 'IN_STOCK',
            };
            return {
                ...state,
                warehouseItems: [...children, parentFinal, ...state.warehouseItems],
            };
        }
        case 'WAREHOUSE_APPEND_SPLITS_TO_PARENT': {
            const { parent, splits } = action.payload;
            if (parent.parentWarehouseId)
                return state;
            let parentQty = Math.max(0, parent.currentQty);
            const batchAt = parent.createdAt;
            const children = [];
            for (const s of splits) {
                const name = s.productName.trim();
                let q = s.quantity;
                if (parent.unit === 'pcs')
                    q = Math.floor(Number(q));
                if (!name || !Number.isFinite(q) || q < 0)
                    continue;
                if (parentQty + 1e-9 >= q) {
                    parentQty -= q;
                    children.push(warehouseChildFromParent(parent, name, q, batchAt));
                }
                else {
                    children.push(warehouseChildFromParent(parent, name, q, batchAt));
                }
            }
            if (children.length === 0)
                return state;
            const pq = Math.max(0, parentQty);
            const parentFinal = {
                ...parent,
                currentQty: pq,
                status: 'IN_STOCK',
            };
            return {
                ...state,
                warehouseItems: [
                    ...children,
                    ...state.warehouseItems.map((w) => (w.id === parent.id ? parentFinal : w)),
                ],
            };
        }
        case 'WAREHOUSE_DELETE': {
            const { id } = action.payload;
            const target = state.warehouseItems.find((w) => w.id === id);
            if (!target)
                return state;
            let warehouseItems;
            if (target.parentWarehouseId) {
                const pid = target.parentWarehouseId;
                const parent = state.warehouseItems.find((w) => w.id === pid);
                if (!parent) {
                    warehouseItems = state.warehouseItems.filter((w) => w.id !== id);
                }
                else {
                    const returned = target.currentQty;
                    const nextParentQty = parent.currentQty + returned;
                    const mergedParentStatus = nextParentQty > 0 ? 'IN_STOCK' : parent.status;
                    warehouseItems = state.warehouseItems
                        .filter((w) => w.id !== id)
                        .map((w) => w.id === pid
                        ? {
                            ...w,
                            currentQty: nextParentQty,
                            status: mergedParentStatus,
                        }
                        : w);
                }
            }
            else {
                const childIds = new Set(state.warehouseItems.filter((w) => w.parentWarehouseId === id).map((w) => w.id));
                warehouseItems = state.warehouseItems.filter((w) => w.id !== id && !childIds.has(w.id));
            }
            return { ...state, warehouseItems };
        }
        case 'WAREHOUSE_OUTCOME': {
            const { outcome } = action.payload;
            const item = state.warehouseItems.find((w) => w.id === outcome.warehouseItemId);
            if (!item)
                return state;
            let warehouseItems;
            if (outcome.unit === 'kg') {
                const map = cloneWarehouseItemMap(state.warehouseItems);
                if (!applyKgWarehouseMovement(map, outcome.warehouseItemId, outcome.quantity, outcome.type)) {
                    return state;
                }
                warehouseItems = state.warehouseItems.map((w) => map.get(w.id));
            }
            else {
                const newQty = Math.max(0, item.currentQty - outcome.quantity);
                const newStatus = newQty <= 0 ? (outcome.type === 'SOLD' ? 'SOLD_OUT' : 'CONSUMED_OUT') : 'IN_STOCK';
                warehouseItems = state.warehouseItems.map((w) => w.id === outcome.warehouseItemId ? { ...w, currentQty: newQty, status: newStatus } : w);
            }
            // klient sotuv summasini yangilash (to'liq to'langan deb hisoblanadi)
            let nextCustomers = state.customers;
            if (outcome.type === 'SOLD' && outcome.customerId && outcome.totalAmount) {
                nextCustomers = state.customers.map((c) => c.id === outcome.customerId
                    ? {
                        ...c,
                        lastPurchaseDate: outcome.date,
                        totalSpent: c.totalSpent + (outcome.totalAmount ?? 0),
                    }
                    : c);
            }
            return {
                ...state,
                warehouseItems,
                outcomes: [outcome, ...state.outcomes],
                customers: nextCustomers,
            };
        }
        case 'POS_CHECKOUT': {
            const { date, customerId, customerName, paidAmount, lines } = action.payload;
            if (!lines.length)
                return state;
            if (!customerId?.trim())
                return state;
            if (!state.customers.some((c) => c.id === customerId))
                return state;
            const resolved = lines.map((l) => ({
                ...l,
                item: state.warehouseItems.find((w) => w.id === l.warehouseItemId),
            }));
            if (resolved.some((r) => !r.item || r.item.unit !== 'kg' || r.quantity <= 0))
                return state;
            const orderTotal = resolved.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);
            if (orderTotal <= 0)
                return state;
            const paid = Math.max(0, Math.min(paidAmount, orderTotal));
            const debtAdd = orderTotal - paid;
            const simMap = cloneWarehouseItemMap(state.warehouseItems);
            const posOrderId = uid('ord');
            const now = new Date().toISOString();
            const newOutcomes = [];
            for (const r of resolved) {
                const item = r.item;
                const ic = simMap.get(item.id);
                let soldFromChildKg;
                let soldFromParentKg;
                if (ic.parentWarehouseId && ic.unit === 'kg') {
                    soldFromChildKg = Math.min(r.quantity, ic.currentQty);
                    soldFromParentKg = r.quantity - soldFromChildKg;
                }
                if (!applyKgWarehouseMovement(simMap, item.id, r.quantity, 'SOLD'))
                    return state;
                newOutcomes.push({
                    id: uid('out'),
                    posOrderId,
                    orderPaidTotal: paid,
                    warehouseItemId: item.id,
                    productName: item.productName,
                    type: 'SOLD',
                    quantity: r.quantity,
                    unit: item.unit,
                    date,
                    customerId: customerId ?? null,
                    customerName: customerName ?? null,
                    pricePerUnit: r.pricePerUnit,
                    totalAmount: r.quantity * r.pricePerUnit,
                    soldFromChildKg: soldFromChildKg ?? null,
                    soldFromParentKg: soldFromParentKg ?? null,
                    createdAt: now,
                });
            }
            const warehouseItems = state.warehouseItems.map((w) => simMap.get(w.id));
            const nextCustomers = state.customers.map((c) => c.id === customerId
                ? {
                    ...c,
                    lastPurchaseDate: date,
                    totalSpent: c.totalSpent + orderTotal,
                    balanceDue: c.balanceDue + debtAdd,
                }
                : c);
            return {
                ...state,
                warehouseItems,
                outcomes: [...newOutcomes, ...state.outcomes],
                customers: nextCustomers,
            };
        }
        case 'POS_ORDER_UPDATE': {
            const { posOrderId, date, customerId, customerName, paidAmount, lines } = action.payload;
            if (!lines.length || !customerId?.trim())
                return state;
            if (!state.customers.some((c) => c.id === customerId))
                return state;
            const oldOutcomes = state.outcomes.filter((o) => o.type === 'SOLD' && o.posOrderId === posOrderId);
            if (!oldOutcomes.length)
                return state;
            const map = cloneWarehouseItemMap(state.warehouseItems);
            for (const o of [...oldOutcomes].reverse()) {
                if (!restoreKgSoldOutcome(map, o))
                    return state;
            }
            const outcomesWithout = state.outcomes.filter((o) => !(o.type === 'SOLD' && o.posOrderId === posOrderId));
            const oldFirst = oldOutcomes[0];
            const oldCid = oldFirst.customerId;
            const oldOrderTotal = oldOutcomes.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
            const oldPaidRaw = oldFirst.orderPaidTotal;
            const oldPaid = oldPaidRaw != null && Number.isFinite(oldPaidRaw)
                ? Math.max(0, Math.min(oldPaidRaw, oldOrderTotal))
                : oldOrderTotal;
            const oldDebt = Math.max(0, oldOrderTotal - oldPaid);
            let nextCustomers = state.customers;
            if (oldCid) {
                nextCustomers = nextCustomers.map((c) => c.id === oldCid
                    ? {
                        ...c,
                        totalSpent: Math.max(0, c.totalSpent - oldOrderTotal),
                        balanceDue: Math.max(0, c.balanceDue - oldDebt),
                    }
                    : c);
            }
            const tempItems = state.warehouseItems.map((w) => map.get(w.id));
            const resolved = lines.map((l) => ({
                ...l,
                item: tempItems.find((w) => w.id === l.warehouseItemId),
            }));
            if (resolved.some((r) => !r.item || r.item.unit !== 'kg' || r.quantity <= 0))
                return state;
            const orderTotal = resolved.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);
            if (orderTotal <= 0)
                return state;
            const paid = Math.max(0, Math.min(paidAmount, orderTotal));
            const debtAdd = orderTotal - paid;
            const now = new Date().toISOString();
            const newOutcomes = [];
            for (const r of resolved) {
                const item = r.item;
                const ic = map.get(item.id);
                let soldFromChildKg;
                let soldFromParentKg;
                if (ic.parentWarehouseId && ic.unit === 'kg') {
                    soldFromChildKg = Math.min(r.quantity, ic.currentQty);
                    soldFromParentKg = r.quantity - soldFromChildKg;
                }
                if (!applyKgWarehouseMovement(map, item.id, r.quantity, 'SOLD'))
                    return state;
                newOutcomes.push({
                    id: uid('out'),
                    posOrderId,
                    orderPaidTotal: paid,
                    warehouseItemId: item.id,
                    productName: item.productName,
                    type: 'SOLD',
                    quantity: r.quantity,
                    unit: item.unit,
                    date,
                    customerId,
                    customerName: customerName ?? null,
                    pricePerUnit: r.pricePerUnit,
                    totalAmount: r.quantity * r.pricePerUnit,
                    soldFromChildKg: soldFromChildKg ?? null,
                    soldFromParentKg: soldFromParentKg ?? null,
                    createdAt: now,
                });
            }
            const warehouseItems = state.warehouseItems.map((w) => map.get(w.id));
            nextCustomers = nextCustomers.map((c) => c.id === customerId
                ? {
                    ...c,
                    lastPurchaseDate: date,
                    totalSpent: c.totalSpent + orderTotal,
                    balanceDue: c.balanceDue + debtAdd,
                }
                : c);
            return {
                ...state,
                warehouseItems,
                outcomes: [...newOutcomes, ...outcomesWithout],
                customers: nextCustomers,
            };
        }
        case 'EXPENSE_CATEGORY_ADD':
            return {
                ...state,
                expenseCategories: [action.payload, ...state.expenseCategories],
            };
        case 'EXPENSE_CATEGORY_UPDATE': {
            const next = action.payload;
            return {
                ...state,
                expenseCategories: state.expenseCategories.map((c) => c.id === next.id ? next : c),
                /** Kategoriya nomi o‘zgarsa, snapshotlarni ham yangilab qo‘yamiz (tarixga mos). */
                expenses: state.expenses.map((e) => e.categoryId === next.id ? { ...e, categoryName: next.name } : e),
            };
        }
        case 'EXPENSE_CATEGORY_DELETE': {
            const { id } = action.payload;
            return {
                ...state,
                expenseCategories: state.expenseCategories.filter((c) => c.id !== id),
                /** Kategoriya o‘chirilsa, eski yozuvlar nomi snapshotidan ko‘rinadi. */
                expenses: state.expenses.map((e) => e.categoryId === id ? { ...e, categoryId: null } : e),
            };
        }
        case 'EXPENSE_ADD':
            return { ...state, expenses: [action.payload, ...state.expenses] };
        case 'EXPENSE_UPDATE':
            return {
                ...state,
                expenses: state.expenses.map((e) => e.id === action.payload.id ? action.payload : e),
            };
        case 'EXPENSE_DELETE':
            return {
                ...state,
                expenses: state.expenses.filter((e) => e.id !== action.payload.id),
            };
        default:
            return state;
    }
}
/** Shu postavchikka tegishli xaridlar bo‘yicha qoldiq qarz (`supplierDebtAmount` yig‘indisi). */
export function getSupplierPurchaseDebtIncurred(state, supplierId) {
    return state.supplierPurchases.reduce((sum, p) => {
        if (p.supplierId !== supplierId)
            return sum;
        const d = p.supplierDebtAmount;
        if (d == null || !Number.isFinite(d) || d <= 0)
            return sum;
        return sum + d;
    }, 0);
}
/** Qarz bo‘limida qayd etilgan to‘lovlar yig‘indisi (statistika / tarix). */
export function getSupplierDebtRepaid(state, supplierId) {
    return state.supplierDebtRepayments.reduce((sum, r) => {
        if (r.supplierId !== supplierId)
            return sum;
        const a = r.amount;
        if (a == null || !Number.isFinite(a) || a <= 0)
            return sum;
        return sum + a;
    }, 0);
}
/** Qoldiq qarz — xarid qatorlarida qolgan `supplierDebtAmount` (to‘lovlar allaqachon qatorlarga taqsimlangan). */
export function getSupplierRemainingDebt(state, supplierId) {
    return getSupplierPurchaseDebtIncurred(state, supplierId);
}
/** Ro‘yxatdan o‘chirilgan postavchik (`supplierId` null) xaridlaridagi qarz. */
export function getOrphanSupplierDebtIncurred(state) {
    return state.supplierPurchases.reduce((sum, p) => {
        if (p.supplierId != null)
            return sum;
        const d = p.supplierDebtAmount;
        if (d == null || !Number.isFinite(d) || d <= 0)
            return sum;
        return sum + d;
    }, 0);
}
function canPosCheckout(state, input) {
    const { lines, paidAmount, customerId } = input;
    if (!customerId?.trim() || !lines.length)
        return false;
    if (!state.customers.some((c) => c.id === customerId))
        return false;
    const orderTotal = lines.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);
    if (orderTotal <= 0)
        return false;
    const paid = Math.max(0, Math.min(paidAmount, orderTotal));
    if (orderTotal - paid > 1e-6 && !customerId)
        return false;
    const map = cloneWarehouseItemMap(state.warehouseItems);
    for (const l of lines) {
        const w = state.warehouseItems.find((x) => x.id === l.warehouseItemId);
        if (!w || w.unit !== 'kg' || l.quantity <= 0)
            return false;
        if (!applyKgWarehouseMovement(map, l.warehouseItemId, l.quantity, 'SOLD'))
            return false;
    }
    return true;
}
function canPosOrderUpdate(state, input) {
    if (!input.customerId?.trim() || !input.lines.length)
        return false;
    if (!state.customers.some((c) => c.id === input.customerId))
        return false;
    const oldOutcomes = state.outcomes.filter((o) => o.type === 'SOLD' && o.posOrderId === input.posOrderId);
    if (!oldOutcomes.length)
        return false;
    const map = cloneWarehouseItemMap(state.warehouseItems);
    for (const o of [...oldOutcomes].reverse()) {
        if (!restoreKgSoldOutcome(map, o))
            return false;
    }
    const tempItems = state.warehouseItems.map((w) => map.get(w.id));
    const resolved = input.lines.map((l) => ({
        ...l,
        item: tempItems.find((w) => w.id === l.warehouseItemId),
    }));
    if (resolved.some((r) => !r.item || r.item.unit !== 'kg' || r.quantity <= 0))
        return false;
    const orderTotal = resolved.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);
    if (orderTotal <= 0)
        return false;
    const paid = Math.max(0, Math.min(input.paidAmount, orderTotal));
    if (orderTotal - paid > 1e-6 && !input.customerId.trim())
        return false;
    for (const r of resolved) {
        if (!applyKgWarehouseMovement(map, r.item.id, r.quantity, 'SOLD'))
            return false;
    }
    return true;
}
const StoreContext = createContext(null);
function readStoredState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...INITIAL_STATE, expenseCategories: buildDefaultExpenseCategories() };
        }
        const parsed = JSON.parse(raw);
        const customers = Array.isArray(parsed.customers)
            ? parsed.customers.map((c) => ({
                ...c,
                balanceDue: typeof c.balanceDue === 'number' ? c.balanceDue : 0,
            }))
            : [];
        const suppliers = Array.isArray(parsed.suppliers) ? parsed.suppliers : [];
        const hasPurchaseStorage = parsed !== null && typeof parsed === 'object' && 'supplierPurchases' in parsed;
        let supplierPurchases = Array.isArray(parsed.supplierPurchases) ? parsed.supplierPurchases : [];
        /** Eski saqlanmalar: `supplierPurchases` kaliti yo‘q bo‘lsa, ombordagi postavchik kirimlaridan bir marta to‘ldirish. */
        if (!hasPurchaseStorage &&
            Array.isArray(parsed.warehouseItems) &&
            parsed.warehouseItems.length > 0) {
            const items = parsed.warehouseItems;
            supplierPurchases = items
                .filter((w) => w?.source === 'SUPPLIER' && w.supplierId)
                .map((w) => ({
                id: `mig-${w.id}`,
                supplierId: w.supplierId ?? null,
                supplierName: w.supplierName ?? '',
                warehouseItemId: w.id,
                incomeDate: w.incomeDate,
                productName: w.productName,
                category: w.category,
                unit: w.unit,
                quantity: w.initialQty,
                pricePerUnit: null,
                totalAmount: null,
                notes: w.notes ?? null,
                createdAt: w.createdAt,
            }))
                .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        }
        const supplierDebtRepayments = Array.isArray(parsed.supplierDebtRepayments)
            ? parsed.supplierDebtRepayments
            : [];
        supplierPurchases = reconcileSupplierPurchasesDebtsWithRepayments(supplierPurchases, supplierDebtRepayments);
        supplierPurchases = syncAllSupplierPurchasesPaidFromTotals(supplierPurchases);
        const hasExpenseCategoryStorage = parsed !== null && typeof parsed === 'object' && 'expenseCategories' in parsed;
        const expenseCategories = Array.isArray(parsed.expenseCategories)
            ? parsed.expenseCategories
            : hasExpenseCategoryStorage
                ? []
                : buildDefaultExpenseCategories();
        const expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
        return {
            ...INITIAL_STATE,
            ...parsed,
            customers,
            suppliers,
            supplierPurchases,
            supplierDebtRepayments,
            expenseCategories,
            expenses,
        };
    }
    catch {
        return { ...INITIAL_STATE, expenseCategories: buildDefaultExpenseCategories() };
    }
}
export function SaralashProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, undefined, () => readStoredState());
    const stateRef = useRef(state);
    stateRef.current = state;
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
        catch {
            /* ignore */
        }
    }, [state]);
    const addCustomer = useCallback((input) => {
        const customer = {
            ...input,
            id: uid('cust'),
            createdAt: new Date().toISOString(),
            lastPurchaseDate: null,
            totalSpent: 0,
            balanceDue: 0,
        };
        dispatch({ type: 'CUSTOMER_ADD', payload: customer });
        return customer;
    }, []);
    const updateCustomer = useCallback((customer) => {
        dispatch({ type: 'CUSTOMER_UPDATE', payload: customer });
    }, []);
    const deleteCustomer = useCallback((id) => {
        dispatch({ type: 'CUSTOMER_DELETE', payload: { id } });
    }, []);
    const addSupplier = useCallback((input) => {
        const supplier = {
            ...input,
            id: uid('sup'),
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'SUPPLIER_ADD', payload: supplier });
        return supplier;
    }, []);
    const updateSupplier = useCallback((supplier) => {
        dispatch({ type: 'SUPPLIER_UPDATE', payload: supplier });
    }, []);
    const deleteSupplier = useCallback((id) => {
        dispatch({ type: 'SUPPLIER_DELETE', payload: { id } });
    }, []);
    const recordSupplierDebtRepayment = useCallback((supplierId, input) => {
        const supplier = stateRef.current.suppliers.find((s) => s.id === supplierId);
        if (!supplier)
            return null;
        const amt = input.amount;
        if (!Number.isFinite(amt) || amt <= 0)
            return null;
        const remaining = getSupplierRemainingDebt(stateRef.current, supplierId);
        if (amt > remaining + 1e-6)
            return null;
        const row = {
            id: uid('sdr'),
            supplierId,
            supplierName: supplier.fullName,
            amount: amt,
            date: input.date,
            notes: input.notes?.trim() || null,
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'SUPPLIER_DEBT_REPAYMENT_ADD', payload: row });
        return row;
    }, []);
    const addIntake = useCallback((input) => {
        const intake = {
            ...input,
            id: uid('intk'),
            createdAt: new Date().toISOString(),
            status: 'PENDING',
            remainingKg: input.weightKg,
        };
        dispatch({ type: 'INTAKE_ADD', payload: intake });
        return intake;
    }, []);
    const deleteIntake = useCallback((id) => {
        dispatch({ type: 'INTAKE_DELETE', payload: { id } });
    }, []);
    const distributeIntake = useCallback((intakeId, rows) => {
        const filtered = rows.filter((r) => r.weightKg > 0 && r.category);
        if (filtered.length === 0)
            return;
        dispatch({ type: 'SORT_DISTRIBUTE', payload: { intakeId, rows: filtered } });
    }, []);
    const pressSortedMaterials = useCallback(({ productName, category, pickedSorted, outputKg, notes }) => {
        const sourceIds = pickedSorted.map((p) => p.sorted.id);
        const batch = {
            id: uid('batch'),
            date: TODAY,
            productName,
            category,
            weightKg: outputKg,
            sourceSortedIds: sourceIds,
            notes,
            createdAt: new Date().toISOString(),
        };
        const warehouseItem = {
            id: uid('wh'),
            productName,
            category,
            unit: 'kg',
            initialQty: outputKg,
            currentQty: outputKg,
            incomeDate: TODAY,
            source: 'PROCESSED',
            sourceBatchId: batch.id,
            parentWarehouseId: null,
            status: 'IN_STOCK',
            createdAt: new Date().toISOString(),
        };
        dispatch({
            type: 'PROCESS_BATCH',
            payload: {
                batch,
                consumedSorted: pickedSorted.map((p) => ({ id: p.sorted.id, weightKg: p.takeKg })),
                warehouseItem,
            },
        });
        return batch;
    }, []);
    const addWarehouseItem = useCallback((input) => {
        const src = input.source ?? 'EXTERNAL';
        const item = {
            ...input,
            source: src,
            supplierId: src === 'SUPPLIER' ? (input.supplierId ?? null) : null,
            supplierName: src === 'SUPPLIER' ? (input.supplierName ?? null) : null,
            parentWarehouseId: input.parentWarehouseId ?? null,
            id: uid('wh'),
            createdAt: new Date().toISOString(),
            status: 'IN_STOCK',
            currentQty: input.initialQty,
        };
        dispatch({ type: 'WAREHOUSE_ADD', payload: item });
        return item;
    }, []);
    const addWarehouseItemWithSplits = useCallback((input, splits) => {
        const src = input.source ?? 'EXTERNAL';
        const now = new Date().toISOString();
        const item = {
            ...input,
            source: src,
            supplierId: src === 'SUPPLIER' ? (input.supplierId ?? null) : null,
            supplierName: src === 'SUPPLIER' ? (input.supplierName ?? null) : null,
            parentWarehouseId: input.parentWarehouseId ?? null,
            id: uid('wh'),
            createdAt: now,
            status: 'IN_STOCK',
            currentQty: input.initialQty,
        };
        dispatch({ type: 'WAREHOUSE_ADD_WITH_CHILD_SPLITS', payload: { parent: item, splits } });
        return item;
    }, []);
    const appendWarehouseSplitsToParent = useCallback((parent, splits) => {
        if (parent.parentWarehouseId || !splits.length)
            return;
        dispatch({ type: 'WAREHOUSE_APPEND_SPLITS_TO_PARENT', payload: { parent, splits } });
    }, []);
    const purchaseFromSupplier = useCallback((supplierId, input) => {
        const supplier = stateRef.current.suppliers.find((s) => s.id === supplierId);
        if (!supplier)
            return null;
        const parent = stateRef.current.warehouseItems.find((w) => w.id === input.parentWarehouseItemId);
        if (!parent || parent.parentWarehouseId)
            return null;
        let qty = input.quantity;
        if (!Number.isFinite(qty) || qty <= 0)
            return null;
        if (parent.unit === 'pcs') {
            qty = Math.floor(qty);
            if (qty < 1)
                return null;
        }
        const p = input.purchasePricePerUnit;
        const hasPositive = p != null && Number.isFinite(p) && p > 0;
        const lineTotal = hasPositive ? p * qty : null;
        const paidRaw = input.paidAmount;
        const paid = paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
        if (lineTotal != null) {
            if (paid == null)
                return null;
            if (input.onCredit) {
                if (paid > lineTotal + 1e-6)
                    return null;
            }
            else if (Math.abs(paid - lineTotal) > 1e-4 * Math.max(1, lineTotal)) {
                return null;
            }
        }
        const debt = lineTotal != null && paid != null ? Math.max(0, lineTotal - paid) : null;
        const onCreditFlag = Boolean(input.onCredit && lineTotal != null && debt != null && debt > 1e-6);
        const newQty = parent.currentQty + qty;
        const newInitial = parent.initialQty + qty;
        const mergedNotes = [parent.notes?.trim(), input.notes?.trim()].filter(Boolean).join(' | ') || undefined;
        const updated = {
            ...parent,
            currentQty: newQty,
            initialQty: newInitial,
            incomeDate: input.incomeDate,
            purchasePricePerUnit: hasPositive ? p : null,
            supplierId: supplier.id,
            supplierName: supplier.fullName,
            notes: mergedNotes,
            status: newQty > 0 ? 'IN_STOCK' : parent.status,
        };
        dispatch({ type: 'WAREHOUSE_UPDATE', payload: updated });
        const record = {
            id: uid('sph'),
            supplierId: supplier.id,
            supplierName: supplier.fullName,
            warehouseItemId: parent.id,
            incomeDate: input.incomeDate,
            productName: parent.productName,
            category: parent.category,
            unit: parent.unit,
            quantity: qty,
            pricePerUnit: hasPositive ? p : null,
            totalAmount: lineTotal,
            paidAmount: lineTotal != null ? paid : null,
            supplierDebtAmount: debt,
            onCredit: onCreditFlag,
            notes: input.notes?.trim() || null,
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'SUPPLIER_PURCHASE_ADD', payload: record });
        return updated;
    }, [dispatch]);
    const updateWarehouseItem = useCallback((item) => {
        dispatch({ type: 'WAREHOUSE_UPDATE', payload: item });
    }, []);
    const addWarehouseChildQty = useCallback((childId, delta) => {
        const child = stateRef.current.warehouseItems.find((w) => w.id === childId);
        if (!child?.parentWarehouseId)
            return false;
        let d = delta;
        if (child.unit === 'pcs')
            d = Math.floor(d);
        if (!Number.isFinite(d) || d <= 0)
            return false;
        const nextCurrent = child.currentQty + d;
        const nextInitial = child.initialQty + d;
        dispatch({
            type: 'WAREHOUSE_UPDATE',
            payload: {
                ...child,
                currentQty: nextCurrent,
                initialQty: Math.max(0, nextInitial),
                status: nextCurrent > 1e-9 ? 'IN_STOCK' : child.status,
            },
        });
        return true;
    }, []);
    const deleteWarehouseItem = useCallback((id) => {
        dispatch({ type: 'WAREHOUSE_DELETE', payload: { id } });
    }, []);
    const recordOutcome = useCallback((input) => {
        const outcome = {
            ...input,
            id: uid('out'),
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'WAREHOUSE_OUTCOME', payload: { outcome } });
    }, []);
    const posCheckout = useCallback((input) => {
        if (!input.customerId?.trim())
            return false;
        if (!canPosCheckout(stateRef.current, input))
            return false;
        dispatch({ type: 'POS_CHECKOUT', payload: input });
        return true;
    }, []);
    const updatePosOrder = useCallback((input) => {
        if (!canPosOrderUpdate(stateRef.current, input))
            return false;
        dispatch({ type: 'POS_ORDER_UPDATE', payload: input });
        return true;
    }, []);
    const addExpenseCategory = useCallback((input) => {
        const name = input.name.trim();
        if (!name)
            return null;
        const exists = stateRef.current.expenseCategories.some((c) => c.name.trim().toLowerCase() === name.toLowerCase());
        if (exists)
            return null;
        const category = {
            id: uid('exc'),
            name,
            builtIn: input.builtIn ?? false,
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'EXPENSE_CATEGORY_ADD', payload: category });
        return category;
    }, []);
    const updateExpenseCategory = useCallback((category) => {
        const name = category.name.trim();
        if (!name)
            return false;
        const collision = stateRef.current.expenseCategories.some((c) => c.id !== category.id && c.name.trim().toLowerCase() === name.toLowerCase());
        if (collision)
            return false;
        dispatch({ type: 'EXPENSE_CATEGORY_UPDATE', payload: { ...category, name } });
        return true;
    }, []);
    const deleteExpenseCategory = useCallback((id) => {
        dispatch({ type: 'EXPENSE_CATEGORY_DELETE', payload: { id } });
    }, []);
    const addExpense = useCallback((input) => {
        const amount = Number(input.amount);
        if (!Number.isFinite(amount) || amount <= 0)
            return null;
        const category = input.categoryId
            ? stateRef.current.expenseCategories.find((c) => c.id === input.categoryId) ?? null
            : null;
        const categoryName = (input.categoryName ?? category?.name ?? '').trim();
        if (!categoryName)
            return null;
        const expense = {
            id: uid('exp'),
            date: input.date,
            categoryId: category ? category.id : null,
            categoryName,
            amount,
            notes: input.notes?.trim() || null,
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'EXPENSE_ADD', payload: expense });
        return expense;
    }, []);
    const updateExpense = useCallback((expense) => {
        const prev = stateRef.current.expenses.find((e) => e.id === expense.id);
        if (!prev)
            return false;
        const amount = Number(expense.amount);
        if (!Number.isFinite(amount) || amount <= 0)
            return false;
        const category = expense.categoryId
            ? stateRef.current.expenseCategories.find((c) => c.id === expense.categoryId) ?? null
            : null;
        const categoryName = (expense.categoryName ?? category?.name ?? prev.categoryName).trim();
        if (!categoryName)
            return false;
        const next = {
            ...prev,
            date: expense.date,
            categoryId: category ? category.id : null,
            categoryName,
            amount,
            notes: expense.notes?.toString().trim() || null,
        };
        dispatch({ type: 'EXPENSE_UPDATE', payload: next });
        return true;
    }, []);
    const deleteExpense = useCallback((id) => {
        dispatch({ type: 'EXPENSE_DELETE', payload: { id } });
    }, []);
    const value = useMemo(() => ({
        state,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        recordSupplierDebtRepayment,
        purchaseFromSupplier,
        addIntake,
        deleteIntake,
        distributeIntake,
        pressSortedMaterials,
        addWarehouseItem,
        addWarehouseItemWithSplits,
        appendWarehouseSplitsToParent,
        updateWarehouseItem,
        addWarehouseChildQty,
        deleteWarehouseItem,
        recordOutcome,
        posCheckout,
        updatePosOrder,
        addExpenseCategory,
        updateExpenseCategory,
        deleteExpenseCategory,
        addExpense,
        updateExpense,
        deleteExpense,
    }), [
        state,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        recordSupplierDebtRepayment,
        purchaseFromSupplier,
        addIntake,
        deleteIntake,
        distributeIntake,
        pressSortedMaterials,
        addWarehouseItem,
        addWarehouseItemWithSplits,
        appendWarehouseSplitsToParent,
        updateWarehouseItem,
        addWarehouseChildQty,
        deleteWarehouseItem,
        recordOutcome,
        posCheckout,
        updatePosOrder,
        addExpenseCategory,
        updateExpenseCategory,
        deleteExpenseCategory,
        addExpense,
        updateExpense,
        deleteExpense,
    ]);
    return _jsx(StoreContext.Provider, { value: value, children: children });
}
export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx)
        throw new Error('useStore must be used within SaralashProvider');
    return ctx;
}
