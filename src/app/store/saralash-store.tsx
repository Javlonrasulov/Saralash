import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../auth/auth-context';
import { fetchSharedAppState, putSharedAppState } from '../lib/app-state-sync';
import { TODAY, uid } from '../utils/format';

// ============================================================================
// TYPES
// ============================================================================

/** Asosiy kategoriyalar — qo'shimcha kategoriyalar foydalanuvchi tomonidan kiritilishi mumkin. */
export const DEFAULT_CATEGORIES = ['paper', 'plastic', 'glass', 'metal', 'cardboard', 'other'] as const;
export type CategoryKey = (typeof DEFAULT_CATEGORIES)[number] | string;

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  /** Oxirgi xarid sanasi (YYYY-MM-DD) */
  lastPurchaseDate: string | null;
  /** Umumiy xarid summasi (so'm) */
  totalSpent: number;
  /** To'lanmagan qarz (so'm) */
  balanceDue: number;
  createdAt: string;
}

export type IntakeStatus = 'PENDING' | 'PARTIALLY_SORTED' | 'SORTED';

/** Korxonaga kelgan xomashyo — saralanmagan holatda. */
export interface Intake {
  id: string;
  date: string;
  /** Erkin nomi: "Aralash xomashyo", "Plastik qoplar" va h.k. */
  materialName: string;
  /** Umumiy og'irlik (kg) */
  weightKg: number;
  /** Olib kelgan kishi/firma — Customer id (ixtiyoriy) */
  sourceCustomerId?: string | null;
  sourceCustomerName?: string | null;
  status: IntakeStatus;
  /** Saralash qoldig'i */
  remainingKg: number;
  notes?: string;
  createdAt: string;
}

export type SortedStatus = 'IN_STOCK' | 'PROCESSED';

/** Saralangan xomashyo — kategoriya bo'yicha guruhlangan. */
export interface SortedMaterial {
  id: string;
  intakeId: string;
  intakeName: string;
  date: string;
  category: CategoryKey;
  weightKg: number;
  remainingKg: number;
  status: SortedStatus;
  createdAt: string;
}

/** Press qilingan tayyor mahsulot — omborga tushadi. */
export interface ProcessedBatch {
  id: string;
  date: string;
  /** Mahsulot nomi */
  productName: string;
  category: CategoryKey;
  weightKg: number;
  /** Manba — saralangan xomashyo idlar */
  sourceSortedIds: string[];
  notes?: string;
  createdAt: string;
}

export type WarehouseItemSource = 'PROCESSED' | 'EXTERNAL' | 'SUPPLIER';
export type WarehouseStatus = 'IN_STOCK' | 'SOLD_OUT' | 'CONSUMED_OUT';

/** Ko‘cha obyekti — tashqi tomondan xarid. */
export interface Supplier {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  notes?: string;
  createdAt: string;
}

/** Baza (ta’minotchi)dan xarid qaydi (ombor bilan bog‘langan, o‘chirilsa ham saqlanadi). */
export interface SupplierPurchaseRecord {
  id: string;
  supplierId: string | null;
  /** Xarid paytidagi nom (ko‘cha obyekti o‘chirilganda ham ko‘rinadi). */
  supplierName: string;
  warehouseItemId: string;
  incomeDate: string;
  productName: string;
  category: CategoryKey;
  unit: 'kg' | 'pcs';
  quantity: number;
  pricePerUnit?: number | null;
  totalAmount?: number | null;
  /** Ko‘cha obyektiga naqd to‘langan (so‘m). */
  paidAmount?: number | null;
  /** Ko‘cha obyektiga qolgan qarz: jami − to‘langan (so‘m). */
  supplierDebtAmount?: number | null;
  /** To‘liq to‘lanmagan qismi qarz sifatida. */
  onCredit?: boolean;
  notes?: string | null;
  /** Bir xarid sessiyasidagi qatorlar (bir klient, bir «Omborga kirim»). */
  purchaseBatchId?: string | null;
  createdAt: string;
}

/** Tarix jadvalida bitta qator — bitta xarid (bir nechta mahsulot qatori). */
export interface SupplierPurchaseHistoryGroup {
  batchId: string;
  supplierId: string | null;
  supplierName: string;
  incomeDate: string;
  notes: string | null;
  createdAt: string;
  lines: SupplierPurchaseRecord[];
}

export function getSupplierPurchaseBatchKey(p: SupplierPurchaseRecord): string {
  if (p.purchaseBatchId) return p.purchaseBatchId;
  const bucket = Math.floor(new Date(p.createdAt).getTime() / 5000);
  return `legacy:${p.supplierId ?? '_'}:${p.incomeDate}:${(p.notes ?? '').trim()}:${bucket}`;
}

export function groupSupplierPurchasesForHistory(
  purchases: SupplierPurchaseRecord[],
): SupplierPurchaseHistoryGroup[] {
  const map = new Map<string, SupplierPurchaseHistoryGroup>();
  for (const p of purchases) {
    const batchId = getSupplierPurchaseBatchKey(p);
    let g = map.get(batchId);
    if (!g) {
      g = {
        batchId,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        incomeDate: p.incomeDate,
        notes: p.notes ?? null,
        createdAt: p.createdAt,
        lines: [],
      };
      map.set(batchId, g);
    }
    g.lines.push(p);
    if (p.createdAt < g.createdAt) g.createdAt = p.createdAt;
  }
  for (const g of map.values()) {
    g.lines.sort((a, b) =>
      a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }),
    );
  }
  return [...map.values()].sort(
    (a, b) =>
      b.incomeDate.localeCompare(a.incomeDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

function migrateSupplierPurchaseBatchIds(
  purchases: SupplierPurchaseRecord[],
): SupplierPurchaseRecord[] {
  if (!purchases.some((p) => !p.purchaseBatchId)) return purchases;
  const legacyToId = new Map<string, string>();
  return purchases.map((p) => {
    if (p.purchaseBatchId) return p;
    const lk = getSupplierPurchaseBatchKey(p);
    let bid = legacyToId.get(lk);
    if (!bid) {
      bid = uid('spb');
      legacyToId.set(lk, bid);
    }
    return { ...p, purchaseBatchId: bid };
  });
}

/** Bazaga qarzdan to‘lov (qarz qoldig‘ini kamaytirish). */
export interface SupplierDebtRepayment {
  id: string;
  supplierId: string;
  /** To‘lov paytidagi nom. */
  supplierName: string;
  amount: number;
  date: string;
  notes?: string | null;
  createdAt: string;
}

/** Ko‘cha obyekti (manzil / nuqta). */
export interface StreetObject {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  notes?: string;
  createdAt: string;
}

/** Ko‘cha obyektidan xarid qaydi. */
export interface StreetPurchaseRecord {
  id: string;
  streetObjectId: string | null;
  streetObjectName: string;
  warehouseItemId: string;
  incomeDate: string;
  productName: string;
  category: CategoryKey;
  unit: 'kg' | 'pcs';
  quantity: number;
  pricePerUnit?: number | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  streetObjectDebtAmount?: number | null;
  onCredit?: boolean;
  notes?: string | null;
  purchaseBatchId?: string | null;
  createdAt: string;
}

export interface StreetPurchaseHistoryGroup {
  batchId: string;
  streetObjectId: string | null;
  streetObjectName: string;
  incomeDate: string;
  notes: string | null;
  createdAt: string;
  lines: StreetPurchaseRecord[];
}

export function getStreetPurchaseBatchKey(p: StreetPurchaseRecord): string {
  if (p.purchaseBatchId) return p.purchaseBatchId;
  const bucket = Math.floor(new Date(p.createdAt).getTime() / 5000);
  return `legacy:${p.streetObjectId ?? '_'}:${p.incomeDate}:${(p.notes ?? '').trim()}:${bucket}`;
}

export function groupStreetPurchasesForHistory(
  purchases: StreetPurchaseRecord[],
): StreetPurchaseHistoryGroup[] {
  const map = new Map<string, StreetPurchaseHistoryGroup>();
  for (const p of purchases) {
    const batchId = getStreetPurchaseBatchKey(p);
    let g = map.get(batchId);
    if (!g) {
      g = {
        batchId,
        streetObjectId: p.streetObjectId,
        streetObjectName: p.streetObjectName,
        incomeDate: p.incomeDate,
        notes: p.notes ?? null,
        createdAt: p.createdAt,
        lines: [],
      };
      map.set(batchId, g);
    }
    g.lines.push(p);
    if (p.createdAt < g.createdAt) g.createdAt = p.createdAt;
  }
  for (const g of map.values()) {
    g.lines.sort((a, b) =>
      a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }),
    );
  }
  return [...map.values()].sort(
    (a, b) =>
      b.incomeDate.localeCompare(a.incomeDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

function migrateStreetPurchaseBatchIds(
  purchases: StreetPurchaseRecord[],
): StreetPurchaseRecord[] {
  if (!purchases.some((p) => !p.purchaseBatchId)) return purchases;
  const legacyToId = new Map<string, string>();
  return purchases.map((p) => {
    if (p.purchaseBatchId) return p;
    const lk = getStreetPurchaseBatchKey(p);
    let bid = legacyToId.get(lk);
    if (!bid) {
      bid = uid('stpb');
      legacyToId.set(lk, bid);
    }
    return { ...p, purchaseBatchId: bid };
  });
}

/** Ko‘cha obyektiga qarzdan to‘lov. */
export interface StreetDebtRepayment {
  id: string;
  streetObjectId: string;
  streetObjectName: string;
  amount: number;
  date: string;
  notes?: string | null;
  createdAt: string;
}

/** Mijozdan qarz uchun kelgan to‘lov (balanceDue kamayadi). */
export interface CustomerDebtRepayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  notes?: string | null;
  createdAt: string;
}

/** Ombordagi mahsulot. */
export interface WarehouseItem {
  id: string;
  productName: string;
  category: CategoryKey;
  /** Birlik: 'kg' yoki 'pcs' (dona) */
  unit: 'kg' | 'pcs';
  initialQty: number;
  /** Hozirgi qoldiq */
  currentQty: number;
  incomeDate: string;
  source: WarehouseItemSource;
  /** Press batch idsi (agar source = PROCESSED bo'lsa) */
  sourceBatchId?: string | null;
  /** Ko‘cha obyektidan kirim (source = SUPPLIER) */
  supplierId?: string | null;
  supplierName?: string | null;
  /**
   * Ota qator id (masalan umumiy "qog'oz" qoldig'i). Bo'lsa — bu qator ota zaxirasidan ajratilgan tur.
   * Ajratishda ota currentQty kamayadi, bolada shu miqdor turadi; jami (ota + bolalar) fizik jami.
   */
  parentWarehouseId?: string | null;
  notes?: string;
  /** Baza olish: 1 kg yoki 1 dona sotib olish narxi (so'm), ixtiyoriy */
  purchasePricePerUnit?: number | null;
  /** Ko‘cha obyektlari olish: 1 kg yoki 1 dona sotib olish narxi (so'm), ixtiyoriy */
  streetPurchasePricePerUnit?: number | null;
  /** Tavsiya / reja sotish narxi (so'm), ixtiyoriy */
  salePricePerUnit?: number | null;
  /** Ro‘yxat ikonkasi: paper | plastic | glass | metal | copper | cardboard | other */
  productIconKey?: string | null;
  status: WarehouseStatus;
  createdAt: string;
}

export type OutcomeType = 'SOLD' | 'CONSUMED';

/** Ombordan chiqim — sotuv yoki ishlatilish. */
export interface WarehouseOutcome {
  id: string;
  warehouseItemId: string;
  productName: string;
  type: OutcomeType;
  quantity: number;
  unit: 'kg' | 'pcs';
  date: string;
  /** Sotuvda — xaridor (Customer.id) yoki erkin matn */
  customerId?: string | null;
  customerName?: string | null;
  /** 1 birlik narxi (so'm) — faqat SOLD uchun */
  pricePerUnit?: number;
  totalAmount?: number;
  /** CONSUMED — sabab */
  reason?: string;
  notes?: string;
  /** Bir chek bo'yicha guruh (POS ko'p qatorli sotuv) */
  posOrderId?: string | null;
  /** Shu buyurtma bo'yicha mijoz to'lagan summa (barcha qatorlarda bir xil) */
  orderPaidTotal?: number | null;
  /** Shu buyurtma bo'yicha to'lov usuli: naqd yoki plastik (karta) */
  orderPaymentMethod?: PosPaymentMethod | null;
  /** kg bola qatorida sotuv: boladan/otadan yechilgan ulush (buyurtmani qayta yozish uchun) */
  soldFromChildKg?: number | null;
  soldFromParentKg?: number | null;
  createdAt: string;
}

export interface PosCheckoutLine {
  warehouseItemId: string;
  quantity: number;
  pricePerUnit: number;
}

/** POS sotuvda to‘lov usuli */
export type PosPaymentMethod = 'CASH' | 'CARD';

export function resolveOrderPaymentMethod(
  outcome: Pick<WarehouseOutcome, 'orderPaymentMethod'> | null | undefined,
): PosPaymentMethod {
  return outcome?.orderPaymentMethod === 'CARD' ? 'CARD' : 'CASH';
}

/**
 * Chiqim kategoriyasi — foydalanuvchi tomonidan boshqariladi.
 * `builtIn` true bo‘lsa, default seed kategoriya (foydalanuvchi qo‘lda yaratmagan).
 */
export interface ExpenseCategory {
  id: string;
  name: string;
  builtIn?: boolean;
  createdAt: string;
}

/**
 * Korxona chiqimi (ish haqi, ijara, kommunal, va h.k.).
 * `categoryName` — yozilgan paytdagi snapshot: kategoriya o‘chirilsa ham qatorda ko‘rinadi.
 */
export interface Expense {
  id: string;
  date: string;
  categoryId: string | null;
  categoryName: string;
  /** So‘mda chiqim summasi (musbat raqam). */
  amount: number;
  notes?: string | null;
  createdAt: string;
}

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
] as const;

// ============================================================================
// STATE & ACTIONS
// ============================================================================

export interface SaralashState {
  customers: Customer[];
  suppliers: Supplier[];
  /** Baza olish zakup tarixlari. */
  supplierPurchases: SupplierPurchaseRecord[];
  /** Bazaga qarz to‘lovlari. */
  supplierDebtRepayments: SupplierDebtRepayment[];
  streetObjects: StreetObject[];
  streetPurchases: StreetPurchaseRecord[];
  streetDebtRepayments: StreetDebtRepayment[];
  /** Mijoz qarzlaridan kelgan to‘lovlar. */
  customerDebtRepayments: CustomerDebtRepayment[];
  intakes: Intake[];
  sortedMaterials: SortedMaterial[];
  processedBatches: ProcessedBatch[];
  warehouseItems: WarehouseItem[];
  outcomes: WarehouseOutcome[];
  /** Chiqim kategoriyalari (boshqarish: «Chiqim» sahifasi). */
  expenseCategories: ExpenseCategory[];
  /** Chiqim yozuvlari (sana, kategoriya, summa). */
  expenses: Expense[];
}

type Action =
  | { type: 'CUSTOMER_ADD'; payload: Customer }
  | { type: 'CUSTOMER_UPDATE'; payload: Customer }
  | { type: 'CUSTOMER_DELETE'; payload: { id: string } }
  | { type: 'CUSTOMER_DEBT_REPAYMENT_ADD'; payload: CustomerDebtRepayment }
  | { type: 'SUPPLIER_ADD'; payload: Supplier }
  | { type: 'SUPPLIER_UPDATE'; payload: Supplier }
  | { type: 'SUPPLIER_DELETE'; payload: { id: string } }
  | { type: 'SUPPLIER_PURCHASE_ADD'; payload: SupplierPurchaseRecord }
  | {
      type: 'SUPPLIER_PURCHASE_BATCH';
      payload: {
        supplierId: string;
        incomeDate: string;
        notes?: string;
        onCredit: boolean;
        paidAmount?: number | null;
        lines: Array<{
          warehouseItemId: string;
          quantity: number;
          purchasePricePerUnit?: number | null;
        }>;
      };
    }
  | { type: 'SUPPLIER_PURCHASE_DELETE'; payload: { id: string } }
  | { type: 'SUPPLIER_PURCHASE_BATCH_DELETE'; payload: { batchId: string } }
  | {
      type: 'SUPPLIER_PURCHASE_BATCH_REPLACE';
      payload: {
        batchId: string;
        supplierId: string;
        incomeDate: string;
        notes?: string;
        onCredit: boolean;
        paidAmount?: number | null;
        lines: Array<{
          warehouseItemId: string;
          quantity: number;
          purchasePricePerUnit?: number | null;
        }>;
      };
    }
  | {
      type: 'SUPPLIER_PURCHASE_UPDATE';
      payload: {
        id: string;
        supplierId: string | null;
        supplierName: string;
        warehouseItemId: string;
        quantity: number;
        incomeDate: string;
        notes?: string;
        purchasePricePerUnit?: number | null;
        paidAmount?: number | null;
        onCredit: boolean;
      };
    }
  | { type: 'SUPPLIER_DEBT_REPAYMENT_ADD'; payload: SupplierDebtRepayment }
  | { type: 'STREET_OBJECT_ADD'; payload: StreetObject }
  | { type: 'STREET_OBJECT_UPDATE'; payload: StreetObject }
  | { type: 'STREET_OBJECT_DELETE'; payload: { id: string } }
  | { type: 'STREET_PURCHASE_ADD'; payload: StreetPurchaseRecord }
  | {
      type: 'STREET_PURCHASE_BATCH';
      payload: {
        streetObjectId: string;
        incomeDate: string;
        notes?: string;
        onCredit: boolean;
        paidAmount?: number | null;
        lines: Array<{
          warehouseItemId: string;
          quantity: number;
          streetPurchasePricePerUnit?: number | null;
        }>;
      };
    }
  | { type: 'STREET_PURCHASE_DELETE'; payload: { id: string } }
  | { type: 'STREET_PURCHASE_BATCH_DELETE'; payload: { batchId: string } }
  | {
      type: 'STREET_PURCHASE_BATCH_REPLACE';
      payload: {
        batchId: string;
        streetObjectId: string;
        incomeDate: string;
        notes?: string;
        onCredit: boolean;
        paidAmount?: number | null;
        lines: Array<{
          warehouseItemId: string;
          quantity: number;
          streetPurchasePricePerUnit?: number | null;
        }>;
      };
    }
  | {
      type: 'STREET_PURCHASE_UPDATE';
      payload: {
        id: string;
        streetObjectId: string | null;
        streetObjectName: string;
        warehouseItemId: string;
        quantity: number;
        incomeDate: string;
        notes?: string;
        streetPurchasePricePerUnit?: number | null;
        paidAmount?: number | null;
        onCredit: boolean;
      };
    }
  | { type: 'STREET_DEBT_REPAYMENT_ADD'; payload: StreetDebtRepayment }
  | { type: 'INTAKE_ADD'; payload: Intake }
  | { type: 'INTAKE_DELETE'; payload: { id: string } }
  | { type: 'SORT_DISTRIBUTE'; payload: { intakeId: string; rows: Array<{ category: CategoryKey; weightKg: number }> } }
  | { type: 'PROCESS_BATCH'; payload: { batch: ProcessedBatch; consumedSorted: Array<{ id: string; weightKg: number }>; warehouseItem: WarehouseItem } }
  | { type: 'WAREHOUSE_ADD'; payload: WarehouseItem }
  | { type: 'WAREHOUSE_UPDATE'; payload: WarehouseItem }
  | {
      type: 'WAREHOUSE_ADD_WITH_CHILD_SPLITS';
      payload: {
        parent: WarehouseItem;
        splits: Array<{ productName: string; quantity: number }>;
      };
    }
  | {
      type: 'WAREHOUSE_APPEND_SPLITS_TO_PARENT';
      payload: {
        parent: WarehouseItem;
        splits: Array<{ productName: string; quantity: number }>;
      };
    }
  | { type: 'WAREHOUSE_DELETE'; payload: { id: string } }
  | { type: 'WAREHOUSE_OUTCOME'; payload: { outcome: WarehouseOutcome } }
  | {
      type: 'POS_CHECKOUT';
      payload: {
        date: string;
        customerId: string | null;
        customerName: string | null;
        /** Naqd (yoki karta) — jami chekdan kam bo‘lsa, farq `balanceDue` ga yoziladi (faqat mijoz tanlangan bo‘lsa). */
        paidAmount: number;
        paymentMethod: PosPaymentMethod;
        lines: PosCheckoutLine[];
      };
    }
  | {
      type: 'POS_ORDER_UPDATE';
      payload: {
        posOrderId: string;
        date: string;
        customerId: string;
        customerName: string | null;
        paidAmount: number;
        paymentMethod: PosPaymentMethod;
        lines: PosCheckoutLine[];
      };
    }
  | { type: 'POS_ORDER_DELETE'; payload: { orderId: string } }
  | { type: 'EXPENSE_CATEGORY_ADD'; payload: ExpenseCategory }
  | { type: 'EXPENSE_CATEGORY_UPDATE'; payload: ExpenseCategory }
  | { type: 'EXPENSE_CATEGORY_DELETE'; payload: { id: string } }
  | { type: 'EXPENSE_ADD'; payload: Expense }
  | { type: 'EXPENSE_UPDATE'; payload: Expense }
  | { type: 'EXPENSE_DELETE'; payload: { id: string } }
  | { type: 'HYDRATE'; payload: SaralashState };

const STORAGE_KEY = 'saralash_state_v1';

const INITIAL_STATE: SaralashState = {
  customers: [],
  suppliers: [],
  supplierPurchases: [],
  supplierDebtRepayments: [],
  streetObjects: [],
  streetPurchases: [],
  streetDebtRepayments: [],
  customerDebtRepayments: [],
  intakes: [],
  sortedMaterials: [],
  processedBatches: [],
  warehouseItems: [],
  outcomes: [],
  expenseCategories: [],
  expenses: [],
};

function buildDefaultExpenseCategories(): ExpenseCategory[] {
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

function warehouseChildFromParent(
  parent: WarehouseItem,
  productName: string,
  qty: number,
  batchCreatedAt: string,
): WarehouseItem {
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
    streetPurchasePricePerUnit: parent.streetPurchasePricePerUnit ?? null,
    salePricePerUnit: parent.salePricePerUnit ?? null,
    productIconKey: parent.productIconKey ?? null,
    status: 'IN_STOCK',
    createdAt: batchCreatedAt,
  };
}

/**
 * Bitta qarz to‘lovini xarid qatorlariga qo‘llash (FIFO: avval `incomeDate`, keyin `createdAt` bo‘yicha).
 * `supplierDebtAmount` kamayadi, shu qatorda `paidAmount` ga taqsimlangan summa qo‘shiladi (jami bo‘lsa — `totalAmount` dan oshmaydi).
 */
function applyRepaymentToSupplierPurchases(
  purchases: SupplierPurchaseRecord[],
  repayment: Pick<SupplierDebtRepayment, 'supplierId' | 'amount'>,
): SupplierPurchaseRecord[] {
  let left = repayment.amount;
  if (!Number.isFinite(left) || left <= 1e-9) return purchases;

  const indices = purchases
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        p.supplierId === repayment.supplierId &&
        p.supplierDebtAmount != null &&
        Number.isFinite(p.supplierDebtAmount) &&
        p.supplierDebtAmount > 1e-9,
    )
    .sort((a, b) => {
      const c = a.p.incomeDate.localeCompare(b.p.incomeDate);
      if (c !== 0) return c;
      return String(a.p.createdAt).localeCompare(String(b.p.createdAt));
    })
    .map((x) => x.i);

  if (indices.length === 0) return purchases;

  const next = purchases.map((p) => ({ ...p }));
  for (const idx of indices) {
    if (left <= 1e-9) break;
    const p = next[idx];
    const d = p.supplierDebtAmount ?? 0;
    if (d <= 1e-9) continue;
    const take = Math.min(d, left);
    const newDebt = d - take;
    const nz = newDebt < 1e-6 ? 0 : newDebt;
    const prevPaid =
      p.paidAmount != null && Number.isFinite(p.paidAmount) && p.paidAmount >= 0 ? p.paidAmount : 0;
    const lineTotal =
      p.totalAmount != null && Number.isFinite(p.totalAmount) && p.totalAmount > 0 ? p.totalAmount : null;
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
function syncAllSupplierPurchasesPaidFromTotals(purchases: SupplierPurchaseRecord[]): SupplierPurchaseRecord[] {
  return purchases.map((p) => {
    const T = p.totalAmount;
    if (T == null || !Number.isFinite(T) || T <= 0) return p;
    const D =
      p.supplierDebtAmount != null && Number.isFinite(p.supplierDebtAmount)
        ? Math.max(0, p.supplierDebtAmount)
        : 0;
    const correct = Math.max(0, T - D);
    const prev = p.paidAmount != null && Number.isFinite(p.paidAmount) ? p.paidAmount : 0;
    if (Math.abs(prev - correct) <= 1e-4 * Math.max(1, T)) return p;
    return { ...p, paidAmount: correct };
  });
}

/** localStorage dan yuklanganda: avval yozilgan to‘lovlar bo‘yicha qarz qatorlarini bir martalik moslashtirish. */
function reconcileSupplierPurchasesDebtsWithRepayments(
  purchases: SupplierPurchaseRecord[],
  repayments: SupplierDebtRepayment[],
): SupplierPurchaseRecord[] {
  if (!repayments.length) return purchases;
  const ordered = [...repayments].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  let next = purchases;
  for (const r of ordered) {
    next = applyRepaymentToSupplierPurchases(next, r);
  }
  return next;
}

/** kg: bola qatorida sotuv/chiqim — avval boladan, yetmasa otadan yechiladi. */
export function getAvailableKgForWarehouseSale(items: WarehouseItem[], w: WarehouseItem): number {
  if (w.unit !== 'kg') return w.currentQty;
  if (!w.parentWarehouseId) return Math.max(0, w.currentQty);
  const p = items.find((x) => x.id === w.parentWarehouseId);
  if (!p || p.unit !== 'kg') return Math.max(0, w.currentQty);
  return Math.max(0, w.currentQty) + Math.max(0, p.currentQty);
}

function cloneWarehouseItemMap(items: WarehouseItem[]): Map<string, WarehouseItem> {
  return new Map(items.map((x) => [x.id, { ...x }]));
}

function emptyQtyStatus(movement: 'SOLD' | 'CONSUMED'): WarehouseStatus {
  return movement === 'SOLD' ? 'SOLD_OUT' : 'CONSUMED_OUT';
}

/**
 * kg chiqim: ota-bola oilasida miqdorni yechish.
 * - Ota qatori: faqat o‘z `currentQty` dan.
 * - Bola: `bola + ota` dan, avval bola, qolgani ota.
 */
function applyKgWarehouseMovement(
  map: Map<string, WarehouseItem>,
  warehouseItemId: string,
  quantity: number,
  movement: 'SOLD' | 'CONSUMED',
): boolean {
  const item = map.get(warehouseItemId);
  if (!item || item.unit !== 'kg' || quantity <= 0) return false;

  if (!item.parentWarehouseId) {
    const nq = item.currentQty - quantity;
    if (nq < -1e-9) return false;
    const z = Math.max(0, nq);
    map.set(item.id, {
      ...item,
      currentQty: z,
      status: z <= 1e-9 ? emptyQtyStatus(movement) : 'IN_STOCK',
    });
    return true;
  }

  const parent = map.get(item.parentWarehouseId);
  if (!parent || parent.unit !== 'kg') return false;
  const avail = item.currentQty + parent.currentQty;
  if (quantity - avail > 1e-9) return false;
  const fromChild = Math.min(quantity, item.currentQty);
  const fromParent = quantity - fromChild;
  const childNq = item.currentQty - fromChild;
  const parentNq = parent.currentQty - fromParent;
  if (childNq < -1e-9 || parentNq < -1e-9) return false;

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
function restoreKgSoldOutcome(map: Map<string, WarehouseItem>, outcome: WarehouseOutcome): boolean {
  if (outcome.unit !== 'kg' || outcome.quantity <= 0) return false;
  const item = map.get(outcome.warehouseItemId);
  if (!item || item.unit !== 'kg') return false;
  const Q = outcome.quantity;

  if (!item.parentWarehouseId) {
    const nq = item.currentQty + Q;
    map.set(item.id, {
      ...item,
      currentQty: nq,
      status: nq > 1e-9 ? 'IN_STOCK' : item.status,
    });
    if (nq > 1e-9) {
      const z = map.get(item.id)!;
      if (z.status === 'SOLD_OUT' || z.status === 'CONSUMED_OUT') {
        map.set(item.id, { ...z, status: 'IN_STOCK' });
      }
    }
    return true;
  }

  const parent = map.get(item.parentWarehouseId);
  if (!parent || parent.unit !== 'kg') return false;

  let fc = outcome.soldFromChildKg;
  let fp = outcome.soldFromParentKg;
  if (
    fc == null ||
    fp == null ||
    !Number.isFinite(fc) ||
    !Number.isFinite(fp) ||
    fc < -1e-9 ||
    fp < -1e-9 ||
    Math.abs(fc + fp - Q) > 1e-3 * Math.max(1, Q)
  ) {
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

/** `posOrderId` yoki eski bitta-qatorli yozuv (`id` = orderKey). */
function soldOutcomesForOrderKey(outcomes: WarehouseOutcome[], orderKey: string): WarehouseOutcome[] {
  return outcomes.filter(
    (o) =>
      o.type === 'SOLD' &&
      (o.posOrderId === orderKey || (!o.posOrderId && o.id === orderKey)),
  );
}

function isSoldOutcomeForOrderKey(o: WarehouseOutcome, orderKey: string): boolean {
  return (
    o.type === 'SOLD' &&
    (o.posOrderId === orderKey || (!o.posOrderId && o.id === orderKey))
  );
}

function normalizeSupplierPurchaseQty(item: WarehouseItem, qty: number): number | null {
  if (!Number.isFinite(qty) || qty <= 0) return null;
  if (item.unit === 'pcs') {
    const q = Math.floor(qty);
    return q >= 1 ? q : null;
  }
  return qty;
}

/** Xarid bekor qilinsa: ombordan miqdor ayiriladi (sotilgan bo‘lsa — yetmasa, false). */
function reverseSupplierPurchaseWarehouse(
  warehouseItems: WarehouseItem[],
  warehouseItemId: string,
  quantity: number,
): WarehouseItem[] | null {
  const item = warehouseItems.find((w) => w.id === warehouseItemId);
  if (!item) return null;
  let qty = quantity;
  if (item.unit === 'pcs') qty = Math.floor(qty);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  if (item.currentQty < qty - 1e-9) return null;

  const newCurrent = Math.max(0, item.currentQty - qty);
  const newInitial = Math.max(0, item.initialQty - qty);
  const updated: WarehouseItem = {
    ...item,
    currentQty: newCurrent,
    initialQty: newInitial,
    status: newCurrent > 1e-9 ? 'IN_STOCK' : item.status,
  };
  return warehouseItems.map((w) => (w.id === item.id ? updated : w));
}

/** O‘chirish/tahrirdan keyin shu ko‘cha obyekti bo‘yicha qarzni qayta hisoblash. */
function reconcileSupplierPurchasesAfterChange(
  purchases: SupplierPurchaseRecord[],
  repayments: SupplierDebtRepayment[],
  supplierId: string | null,
): SupplierPurchaseRecord[] {
  if (!supplierId) return purchases;
  let next = purchases.map((p) => {
    if (p.supplierId !== supplierId) return p;
    const T = p.totalAmount;
    if (T == null || !Number.isFinite(T) || T <= 0) {
      return { ...p, supplierDebtAmount: null, onCredit: false };
    }
    const paid =
      p.paidAmount != null && Number.isFinite(p.paidAmount) ? Math.max(0, p.paidAmount) : 0;
    const debt = Math.max(0, T - paid);
    return {
      ...p,
      supplierDebtAmount: debt,
      onCredit: debt > 1e-6,
      paidAmount: paid,
    };
  });
  const ordered = [...repayments]
    .filter((r) => r.supplierId === supplierId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const r of ordered) {
    next = applyRepaymentToSupplierPurchases(next, r);
  }
  return syncAllSupplierPurchasesPaidFromTotals(next);
}

/** Bir qator xarid: ombor yangilanishi + tarix yozuvi. */
function buildSupplierPurchaseUpdate(
  supplier: Supplier,
  warehouseItems: WarehouseItem[],
  input: {
    warehouseItemId: string;
    quantity: number;
    incomeDate: string;
    notes?: string | null;
    purchasePricePerUnit?: number | null;
    paidAmount?: number | null;
    onCredit?: boolean;
    recordSupplierId?: string | null;
    recordSupplierName?: string;
    purchaseBatchId?: string | null;
    batchCreatedAt?: string;
  },
  preserve?: { id: string; createdAt: string },
): { warehouseItems: WarehouseItem[]; record: SupplierPurchaseRecord } | null {
  const item = warehouseItems.find((w) => w.id === input.warehouseItemId);
  if (!item) return null;

  const qty = normalizeSupplierPurchaseQty(item, input.quantity);
  if (qty == null) return null;

  const p = input.purchasePricePerUnit;
  const hasPositive = p != null && Number.isFinite(p) && p > 0;
  const lineTotal = hasPositive ? p * qty : null;
  const paidRaw = input.paidAmount;
  const paid =
    paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
  if (lineTotal != null) {
    if (paid == null) return null;
    if (input.onCredit) {
      if (paid > lineTotal + 1e-6) return null;
    } else if (Math.abs(paid - lineTotal) > 1e-4 * Math.max(1, lineTotal)) {
      return null;
    }
  }
  const debt =
    lineTotal != null && paid != null ? Math.max(0, lineTotal - paid) : null;
  const onCreditFlag = Boolean(input.onCredit && lineTotal != null && debt != null && debt > 1e-6);

  const newQty = item.currentQty + qty;
  const newInitial = item.initialQty + qty;
  const mergedNotes = [item.notes?.trim(), input.notes?.trim()].filter(Boolean).join(' | ') || undefined;

  const updated: WarehouseItem = {
    ...item,
    currentQty: newQty,
    initialQty: newInitial,
    incomeDate: input.incomeDate,
    purchasePricePerUnit: hasPositive ? p : (item.purchasePricePerUnit ?? null),
    supplierId: supplier.id,
    supplierName: supplier.fullName,
    notes: mergedNotes,
    status: newQty > 0 ? 'IN_STOCK' : item.status,
  };

  const parentRow = item.parentWarehouseId
    ? warehouseItems.find((w) => w.id === item.parentWarehouseId)
    : null;
  const historyProductName = parentRow
    ? `${item.productName} (${parentRow.productName})`
    : item.productName;

  const record: SupplierPurchaseRecord = {
    id: preserve?.id ?? uid('sph'),
    supplierId: input.recordSupplierId !== undefined ? input.recordSupplierId : supplier.id,
    supplierName: input.recordSupplierName ?? supplier.fullName,
    warehouseItemId: item.id,
    incomeDate: input.incomeDate,
    productName: historyProductName,
    category: item.category,
    unit: item.unit,
    quantity: qty,
    pricePerUnit: hasPositive ? p : null,
    totalAmount: lineTotal,
    paidAmount: lineTotal != null ? paid : null,
    supplierDebtAmount: debt,
    onCredit: onCreditFlag,
    notes: input.notes?.trim() || null,
    purchaseBatchId: input.purchaseBatchId ?? null,
    createdAt: preserve?.createdAt ?? input.batchCreatedAt ?? new Date().toISOString(),
  };

  const nextWarehouseItems = warehouseItems.map((w) => (w.id === updated.id ? updated : w));
  return { warehouseItems: nextWarehouseItems, record };
}

function applyRepaymentToStreetPurchases(
  purchases: StreetPurchaseRecord[],
  repayment: Pick<StreetDebtRepayment, 'streetObjectId' | 'amount'>,
): StreetPurchaseRecord[] {
  let left = repayment.amount;
  if (!Number.isFinite(left) || left <= 1e-9) return purchases;

  const indices = purchases
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        p.streetObjectId === repayment.streetObjectId &&
        p.streetObjectDebtAmount != null &&
        Number.isFinite(p.streetObjectDebtAmount) &&
        p.streetObjectDebtAmount > 1e-9,
    )
    .sort((a, b) => {
      const c = a.p.incomeDate.localeCompare(b.p.incomeDate);
      if (c !== 0) return c;
      return String(a.p.createdAt).localeCompare(String(b.p.createdAt));
    })
    .map((x) => x.i);

  if (indices.length === 0) return purchases;

  const next = purchases.map((p) => ({ ...p }));
  for (const idx of indices) {
    if (left <= 1e-9) break;
    const p = next[idx];
    const d = p.streetObjectDebtAmount ?? 0;
    if (d <= 1e-9) continue;
    const take = Math.min(d, left);
    const newDebt = d - take;
    const nz = newDebt < 1e-6 ? 0 : newDebt;
    const prevPaid =
      p.paidAmount != null && Number.isFinite(p.paidAmount) && p.paidAmount >= 0 ? p.paidAmount : 0;
    const lineTotal =
      p.totalAmount != null && Number.isFinite(p.totalAmount) && p.totalAmount > 0 ? p.totalAmount : null;
    const nextPaid = lineTotal != null ? Math.max(0, lineTotal - nz) : prevPaid + take;
    next[idx] = {
      ...p,
      streetObjectDebtAmount: nz,
      paidAmount: nextPaid,
      onCredit: nz > 1e-6 ? p.onCredit : false,
    };
    left -= take;
  }
  return next;
}

function syncAllStreetPurchasesPaidFromTotals(purchases: StreetPurchaseRecord[]): StreetPurchaseRecord[] {
  return purchases.map((p) => {
    const T = p.totalAmount;
    if (T == null || !Number.isFinite(T) || T <= 0) return p;
    const D =
      p.streetObjectDebtAmount != null && Number.isFinite(p.streetObjectDebtAmount)
        ? Math.max(0, p.streetObjectDebtAmount)
        : 0;
    const correct = Math.max(0, T - D);
    const prev = p.paidAmount != null && Number.isFinite(p.paidAmount) ? p.paidAmount : 0;
    if (Math.abs(prev - correct) <= 1e-4 * Math.max(1, T)) return p;
    return { ...p, paidAmount: correct };
  });
}

function reconcileStreetPurchasesDebtsWithRepayments(
  purchases: StreetPurchaseRecord[],
  repayments: StreetDebtRepayment[],
): StreetPurchaseRecord[] {
  if (!repayments.length) return purchases;
  const ordered = [...repayments].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  let next = purchases;
  for (const r of ordered) {
    next = applyRepaymentToStreetPurchases(next, r);
  }
  return next;
}

function reconcileStreetPurchasesAfterChange(
  purchases: StreetPurchaseRecord[],
  repayments: StreetDebtRepayment[],
  streetObjectId: string | null,
): StreetPurchaseRecord[] {
  if (!streetObjectId) return purchases;
  let next = purchases.map((p) => {
    if (p.streetObjectId !== streetObjectId) return p;
    const T = p.totalAmount;
    if (T == null || !Number.isFinite(T) || T <= 0) {
      return { ...p, streetObjectDebtAmount: null, onCredit: false };
    }
    const paid =
      p.paidAmount != null && Number.isFinite(p.paidAmount) ? Math.max(0, p.paidAmount) : 0;
    const debt = Math.max(0, T - paid);
    return {
      ...p,
      streetObjectDebtAmount: debt,
      onCredit: debt > 1e-6,
      paidAmount: paid,
    };
  });
  const ordered = [...repayments]
    .filter((r) => r.streetObjectId === streetObjectId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const r of ordered) {
    next = applyRepaymentToStreetPurchases(next, r);
  }
  return syncAllStreetPurchasesPaidFromTotals(next);
}

function buildStreetPurchaseUpdate(
  streetObject: StreetObject,
  warehouseItems: WarehouseItem[],
  input: {
    warehouseItemId: string;
    quantity: number;
    incomeDate: string;
    notes?: string | null;
    streetPurchasePricePerUnit?: number | null;
    paidAmount?: number | null;
    onCredit?: boolean;
    recordStreetObjectId?: string | null;
    recordStreetObjectName?: string;
    purchaseBatchId?: string | null;
    batchCreatedAt?: string;
  },
  preserve?: { id: string; createdAt: string },
): { warehouseItems: WarehouseItem[]; record: StreetPurchaseRecord } | null {
  const item = warehouseItems.find((w) => w.id === input.warehouseItemId);
  if (!item) return null;

  const qty = normalizeSupplierPurchaseQty(item, input.quantity);
  if (qty == null) return null;

  const p = input.streetPurchasePricePerUnit;
  const hasPositive = p != null && Number.isFinite(p) && p > 0;
  const lineTotal = hasPositive ? p * qty : null;
  const paidRaw = input.paidAmount;
  const paid =
    paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
  if (lineTotal != null) {
    if (paid == null) return null;
    if (input.onCredit) {
      if (paid > lineTotal + 1e-6) return null;
    } else if (Math.abs(paid - lineTotal) > 1e-4 * Math.max(1, lineTotal)) {
      return null;
    }
  }
  const debt =
    lineTotal != null && paid != null ? Math.max(0, lineTotal - paid) : null;
  const onCreditFlag = Boolean(input.onCredit && lineTotal != null && debt != null && debt > 1e-6);

  const newQty = item.currentQty + qty;
  const newInitial = item.initialQty + qty;
  const mergedNotes = [item.notes?.trim(), input.notes?.trim()].filter(Boolean).join(' | ') || undefined;

  const updated: WarehouseItem = {
    ...item,
    currentQty: newQty,
    initialQty: newInitial,
    incomeDate: input.incomeDate,
    streetPurchasePricePerUnit: hasPositive ? p : item.streetPurchasePricePerUnit ?? null,
    notes: mergedNotes,
    status: newQty > 0 ? 'IN_STOCK' : item.status,
  };

  const parentRow = item.parentWarehouseId
    ? warehouseItems.find((w) => w.id === item.parentWarehouseId)
    : null;
  const historyProductName = parentRow
    ? `${item.productName} (${parentRow.productName})`
    : item.productName;

  const record: StreetPurchaseRecord = {
    id: preserve?.id ?? uid('sth'),
    streetObjectId:
      input.recordStreetObjectId !== undefined ? input.recordStreetObjectId : streetObject.id,
    streetObjectName: input.recordStreetObjectName ?? streetObject.fullName,
    warehouseItemId: item.id,
    incomeDate: input.incomeDate,
    productName: historyProductName,
    category: item.category,
    unit: item.unit,
    quantity: qty,
    pricePerUnit: hasPositive ? p : null,
    totalAmount: lineTotal,
    paidAmount: lineTotal != null ? paid : null,
    streetObjectDebtAmount: debt,
    onCredit: onCreditFlag,
    notes: input.notes?.trim() || null,
    purchaseBatchId: input.purchaseBatchId ?? null,
    createdAt: preserve?.createdAt ?? input.batchCreatedAt ?? new Date().toISOString(),
  };

  const nextWarehouseItems = warehouseItems.map((w) => (w.id === updated.id ? updated : w));
  return { warehouseItems: nextWarehouseItems, record };
}

/** Qatorlar bo‘yicha to‘lovni ketma-ket taqsimlash (qarzda qolgan to‘lov keyingi qatorlarga o‘tadi). */
function allocateSupplierPurchasePaid(
  lineTotals: number[],
  orderPaid: number,
  onCredit: boolean,
): number[] | null {
  if (!onCredit) {
    const sum = lineTotals.reduce((s, t) => s + t, 0);
    if (Math.abs(orderPaid - sum) > 1e-4 * Math.max(1, sum)) return null;
    return lineTotals.map((t) => t);
  }
  let remaining = orderPaid;
  return lineTotals.map((total) => {
    const linePaid = Math.min(remaining, total);
    remaining = Math.max(0, remaining - linePaid);
    return linePaid;
  });
}

function reducer(state: SaralashState, action: Action): SaralashState {
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
        customerDebtRepayments: state.customerDebtRepayments.filter(
          (r) => r.customerId !== action.payload.id,
        ),
      };

    case 'CUSTOMER_DEBT_REPAYMENT_ADD': {
      const r = action.payload;
      const cust = state.customers.find((c) => c.id === r.customerId);
      if (!cust || r.amount <= 1e-9) return state;
      const pay = Math.min(r.amount, Math.max(0, cust.balanceDue));
      if (pay <= 1e-9) return state;
      return {
        ...state,
        customerDebtRepayments: [r, ...state.customerDebtRepayments],
        customers: state.customers.map((c) =>
          c.id === r.customerId ? { ...c, balanceDue: Math.max(0, c.balanceDue - pay) } : c,
        ),
      };
    }

    case 'SUPPLIER_ADD':
      return { ...state, suppliers: [action.payload, ...state.suppliers] };

    case 'SUPPLIER_UPDATE':
      return {
        ...state,
        suppliers: state.suppliers.map((s) => (s.id === action.payload.id ? action.payload : s)),
        warehouseItems: state.warehouseItems.map((w) =>
          w.supplierId === action.payload.id ? { ...w, supplierName: action.payload.fullName } : w,
        ),
      };

    case 'SUPPLIER_DELETE':
      return {
        ...state,
        suppliers: state.suppliers.filter((s) => s.id !== action.payload.id),
        warehouseItems: state.warehouseItems.map((w) =>
          w.supplierId === action.payload.id ? { ...w, supplierId: null } : w,
        ),
        supplierPurchases: state.supplierPurchases.map((p) =>
          p.supplierId === action.payload.id ? { ...p, supplierId: null } : p,
        ),
      };

    case 'SUPPLIER_PURCHASE_ADD':
      return { ...state, supplierPurchases: [action.payload, ...state.supplierPurchases] };

    case 'SUPPLIER_PURCHASE_BATCH': {
      const { supplierId, incomeDate, notes, onCredit, paidAmount, lines } = action.payload;
      if (!lines.length) return state;
      const supplier = state.suppliers.find((s) => s.id === supplierId);
      if (!supplier) return state;

      const resolved: Array<{
        warehouseItemId: string;
        quantity: number;
        purchasePricePerUnit?: number | null;
        lineTotal: number | null;
      }> = [];

      for (const line of lines) {
        const item = state.warehouseItems.find((w) => w.id === line.warehouseItemId);
        if (!item) return state;
        const qty = normalizeSupplierPurchaseQty(item, line.quantity);
        if (qty == null) return state;
        const p = line.purchasePricePerUnit;
        const hasPositive = p != null && Number.isFinite(p) && p > 0;
        const lineTotal = hasPositive ? p * qty : null;
        resolved.push({
          warehouseItemId: line.warehouseItemId,
          quantity: qty,
          purchasePricePerUnit: line.purchasePricePerUnit,
          lineTotal,
        });
      }

      const priced = resolved.filter((r) => r.lineTotal != null) as Array<
        (typeof resolved)[0] & { lineTotal: number }
      >;
      const orderTotal = priced.reduce((s, r) => s + r.lineTotal, 0);

      let perLinePaid: (number | null)[] = resolved.map(() => null);
      if (orderTotal > 0) {
        const paidRaw = paidAmount;
        const paid =
          paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
        if (paid == null) return state;
        if (onCredit && paid > orderTotal + 1e-6) return state;
        const totals = priced.map((r) => r.lineTotal);
        const allocated = allocateSupplierPurchasePaid(totals, paid, onCredit);
        if (!allocated) return state;
        let ai = 0;
        perLinePaid = resolved.map((r) => {
          if (r.lineTotal == null) return null;
          const v = allocated[ai];
          ai += 1;
          return v;
        });
      }

      let warehouseItems = state.warehouseItems;
      const newRecords: SupplierPurchaseRecord[] = [];
      const sharedNotes = notes?.trim() || null;
      const purchaseBatchId = uid('spb');
      const batchCreatedAt = new Date().toISOString();

      for (let i = 0; i < resolved.length; i++) {
        const r = resolved[i];
        const result = buildSupplierPurchaseUpdate(supplier, warehouseItems, {
          warehouseItemId: r.warehouseItemId,
          quantity: r.quantity,
          incomeDate,
          notes: sharedNotes,
          purchasePricePerUnit: r.purchasePricePerUnit,
          paidAmount: perLinePaid[i],
          onCredit,
          purchaseBatchId,
          batchCreatedAt,
        });
        if (!result) return state;
        warehouseItems = result.warehouseItems;
        newRecords.push(result.record);
      }

      return {
        ...state,
        warehouseItems,
        supplierPurchases: [...newRecords, ...state.supplierPurchases],
      };
    }

    case 'SUPPLIER_PURCHASE_DELETE': {
      const { id } = action.payload;
      const old = state.supplierPurchases.find((p) => p.id === id);
      if (!old) return state;
      const warehouseItems = reverseSupplierPurchaseWarehouse(
        state.warehouseItems,
        old.warehouseItemId,
        old.quantity,
      );
      if (!warehouseItems) return state;
      let supplierPurchases = state.supplierPurchases.filter((p) => p.id !== id);
      supplierPurchases = reconcileSupplierPurchasesAfterChange(
        supplierPurchases,
        state.supplierDebtRepayments,
        old.supplierId,
      );
      return { ...state, warehouseItems, supplierPurchases };
    }

    case 'SUPPLIER_PURCHASE_BATCH_DELETE': {
      const { batchId } = action.payload;
      const olds = state.supplierPurchases.filter(
        (p) => getSupplierPurchaseBatchKey(p) === batchId,
      );
      if (!olds.length) return state;

      let warehouseItems = state.warehouseItems;
      for (const o of [...olds].reverse()) {
        const rev = reverseSupplierPurchaseWarehouse(
          warehouseItems,
          o.warehouseItemId,
          o.quantity,
        );
        if (!rev) return state;
        warehouseItems = rev;
      }

      let supplierPurchases = state.supplierPurchases.filter(
        (p) => getSupplierPurchaseBatchKey(p) !== batchId,
      );
      const sid = olds[0].supplierId;
      supplierPurchases = reconcileSupplierPurchasesAfterChange(
        supplierPurchases,
        state.supplierDebtRepayments,
        sid,
      );
      return { ...state, warehouseItems, supplierPurchases };
    }

    case 'SUPPLIER_PURCHASE_BATCH_REPLACE': {
      const { batchId, supplierId, incomeDate, notes, onCredit, paidAmount, lines } =
        action.payload;
      const supplier = state.suppliers.find((s) => s.id === supplierId);
      if (!supplier || !lines.length) return state;

      const olds = state.supplierPurchases.filter(
        (p) => getSupplierPurchaseBatchKey(p) === batchId,
      );
      if (!olds.length) return state;

      let warehouseItems = state.warehouseItems;
      for (const o of [...olds].reverse()) {
        const rev = reverseSupplierPurchaseWarehouse(
          warehouseItems,
          o.warehouseItemId,
          o.quantity,
        );
        if (!rev) return state;
        warehouseItems = rev;
      }

      const batchCreatedAt = olds.reduce(
        (min, p) => (p.createdAt < min ? p.createdAt : min),
        olds[0].createdAt,
      );
      let supplierPurchases = state.supplierPurchases.filter(
        (p) => getSupplierPurchaseBatchKey(p) !== batchId,
      );

      const resolved: Array<{
        warehouseItemId: string;
        quantity: number;
        purchasePricePerUnit?: number | null;
        lineTotal: number | null;
      }> = [];

      for (const line of lines) {
        const item = warehouseItems.find((w) => w.id === line.warehouseItemId);
        if (!item) return state;
        const qty = normalizeSupplierPurchaseQty(item, line.quantity);
        if (qty == null) return state;
        const p = line.purchasePricePerUnit;
        const hasPositive = p != null && Number.isFinite(p) && p > 0;
        resolved.push({
          warehouseItemId: line.warehouseItemId,
          quantity: qty,
          purchasePricePerUnit: line.purchasePricePerUnit,
          lineTotal: hasPositive ? p * qty : null,
        });
      }

      const priced = resolved.filter((r) => r.lineTotal != null) as Array<
        (typeof resolved)[0] & { lineTotal: number }
      >;
      const orderTotal = priced.reduce((s, r) => s + r.lineTotal, 0);

      let perLinePaid: (number | null)[] = resolved.map(() => null);
      if (orderTotal > 0) {
        const paidRaw = paidAmount;
        const paid =
          paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
        if (paid == null) return state;
        if (onCredit && paid > orderTotal + 1e-6) return state;
        const allocated = allocateSupplierPurchasePaid(
          priced.map((r) => r.lineTotal),
          paid,
          onCredit,
        );
        if (!allocated) return state;
        let ai = 0;
        perLinePaid = resolved.map((r) => {
          if (r.lineTotal == null) return null;
          const v = allocated[ai];
          ai += 1;
          return v;
        });
      }

      const newRecords: SupplierPurchaseRecord[] = [];
      const sharedNotes = notes?.trim() || null;

      for (let i = 0; i < resolved.length; i++) {
        const r = resolved[i];
        const result = buildSupplierPurchaseUpdate(supplier, warehouseItems, {
          warehouseItemId: r.warehouseItemId,
          quantity: r.quantity,
          incomeDate,
          notes: sharedNotes,
          purchasePricePerUnit: r.purchasePricePerUnit,
          paidAmount: perLinePaid[i],
          onCredit,
          purchaseBatchId: batchId,
          batchCreatedAt,
        });
        if (!result) return state;
        warehouseItems = result.warehouseItems;
        newRecords.push(result.record);
      }

      supplierPurchases = [...newRecords, ...supplierPurchases];
      supplierPurchases = reconcileSupplierPurchasesAfterChange(
        supplierPurchases,
        state.supplierDebtRepayments,
        supplierId,
      );
      return { ...state, warehouseItems, supplierPurchases };
    }

    case 'SUPPLIER_PURCHASE_UPDATE': {
      const {
        id,
        supplierId,
        supplierName,
        warehouseItemId,
        quantity,
        incomeDate,
        notes,
        purchasePricePerUnit,
        paidAmount,
        onCredit,
      } = action.payload;
      const old = state.supplierPurchases.find((p) => p.id === id);
      if (!old) return state;

      const supplierStub: Supplier = {
        id: supplierId ?? 'orphan',
        fullName: supplierName,
        phone: '',
        address: '',
        notes: '',
        createdAt: old.createdAt,
      };
      if (supplierId && !state.suppliers.some((s) => s.id === supplierId)) return state;

      let warehouseItems = reverseSupplierPurchaseWarehouse(
        state.warehouseItems,
        old.warehouseItemId,
        old.quantity,
      );
      if (!warehouseItems) return state;

      const purchasesWithout = state.supplierPurchases.filter((p) => p.id !== id);
      const result = buildSupplierPurchaseUpdate(
        supplierStub,
        warehouseItems,
        {
          warehouseItemId,
          quantity,
          incomeDate,
          notes: notes ?? null,
          purchasePricePerUnit,
          paidAmount,
          onCredit,
          recordSupplierId: supplierId,
          recordSupplierName: supplierName,
        },
        { id: old.id, createdAt: old.createdAt },
      );
      if (!result) return state;

      let supplierPurchases = [...purchasesWithout, result.record];
      if (old.supplierId && old.supplierId !== supplierId) {
        supplierPurchases = reconcileSupplierPurchasesAfterChange(
          supplierPurchases,
          state.supplierDebtRepayments,
          old.supplierId,
        );
      }
      if (supplierId) {
        supplierPurchases = reconcileSupplierPurchasesAfterChange(
          supplierPurchases,
          state.supplierDebtRepayments,
          supplierId,
        );
      }
      return { ...state, warehouseItems: result.warehouseItems, supplierPurchases };
    }

    case 'SUPPLIER_DEBT_REPAYMENT_ADD': {
      const repayment = action.payload;
      const supplierPurchases = applyRepaymentToSupplierPurchases(state.supplierPurchases, repayment);
      return {
        ...state,
        supplierDebtRepayments: [repayment, ...state.supplierDebtRepayments],
        supplierPurchases,
      };
    }

    case 'STREET_OBJECT_ADD':
      return { ...state, streetObjects: [action.payload, ...state.streetObjects] };

    case 'STREET_OBJECT_UPDATE':
      return {
        ...state,
        streetObjects: state.streetObjects.map((s) =>
          s.id === action.payload.id ? action.payload : s,
        ),
        streetPurchases: state.streetPurchases.map((p) =>
          p.streetObjectId === action.payload.id
            ? { ...p, streetObjectName: action.payload.fullName }
            : p,
        ),
      };

    case 'STREET_OBJECT_DELETE':
      return {
        ...state,
        streetObjects: state.streetObjects.filter((s) => s.id !== action.payload.id),
        streetPurchases: state.streetPurchases.map((p) =>
          p.streetObjectId === action.payload.id ? { ...p, streetObjectId: null } : p,
        ),
      };

    case 'STREET_PURCHASE_ADD':
      return { ...state, streetPurchases: [action.payload, ...state.streetPurchases] };

    case 'STREET_PURCHASE_BATCH': {
      const { streetObjectId, incomeDate, notes, onCredit, paidAmount, lines } = action.payload;
      if (!lines.length) return state;
      const streetObject = state.streetObjects.find((s) => s.id === streetObjectId);
      if (!streetObject) return state;

      const resolved: Array<{
        warehouseItemId: string;
        quantity: number;
        streetPurchasePricePerUnit?: number | null;
        lineTotal: number | null;
      }> = [];

      for (const line of lines) {
        const item = state.warehouseItems.find((w) => w.id === line.warehouseItemId);
        if (!item) return state;
        const qty = normalizeSupplierPurchaseQty(item, line.quantity);
        if (qty == null) return state;
        const p = line.streetPurchasePricePerUnit;
        const hasPositive = p != null && Number.isFinite(p) && p > 0;
        resolved.push({
          warehouseItemId: line.warehouseItemId,
          quantity: qty,
          streetPurchasePricePerUnit: line.streetPurchasePricePerUnit,
          lineTotal: hasPositive ? p * qty : null,
        });
      }

      const priced = resolved.filter((r) => r.lineTotal != null) as Array<
        (typeof resolved)[0] & { lineTotal: number }
      >;
      const orderTotal = priced.reduce((s, r) => s + r.lineTotal, 0);

      let perLinePaid: (number | null)[] = resolved.map(() => null);
      if (orderTotal > 0) {
        const paidRaw = paidAmount;
        const paid =
          paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
        if (paid == null) return state;
        if (onCredit && paid > orderTotal + 1e-6) return state;
        const allocated = allocateSupplierPurchasePaid(
          priced.map((r) => r.lineTotal),
          paid,
          onCredit,
        );
        if (!allocated) return state;
        let ai = 0;
        perLinePaid = resolved.map((r) => {
          if (r.lineTotal == null) return null;
          const v = allocated[ai];
          ai += 1;
          return v;
        });
      }

      let warehouseItems = state.warehouseItems;
      const newRecords: StreetPurchaseRecord[] = [];
      const sharedNotes = notes?.trim() || null;
      const purchaseBatchId = uid('stpb');
      const batchCreatedAt = new Date().toISOString();

      for (let i = 0; i < resolved.length; i++) {
        const r = resolved[i];
        const result = buildStreetPurchaseUpdate(streetObject, warehouseItems, {
          warehouseItemId: r.warehouseItemId,
          quantity: r.quantity,
          incomeDate,
          notes: sharedNotes,
          streetPurchasePricePerUnit: r.streetPurchasePricePerUnit,
          paidAmount: perLinePaid[i],
          onCredit,
          purchaseBatchId,
          batchCreatedAt,
        });
        if (!result) return state;
        warehouseItems = result.warehouseItems;
        newRecords.push(result.record);
      }

      return {
        ...state,
        warehouseItems,
        streetPurchases: [...newRecords, ...state.streetPurchases],
      };
    }

    case 'STREET_PURCHASE_DELETE': {
      const { id } = action.payload;
      const old = state.streetPurchases.find((p) => p.id === id);
      if (!old) return state;
      const warehouseItems = reverseSupplierPurchaseWarehouse(
        state.warehouseItems,
        old.warehouseItemId,
        old.quantity,
      );
      if (!warehouseItems) return state;
      let streetPurchases = state.streetPurchases.filter((p) => p.id !== id);
      streetPurchases = reconcileStreetPurchasesAfterChange(
        streetPurchases,
        state.streetDebtRepayments,
        old.streetObjectId,
      );
      return { ...state, warehouseItems, streetPurchases };
    }

    case 'STREET_PURCHASE_BATCH_DELETE': {
      const { batchId } = action.payload;
      const olds = state.streetPurchases.filter((p) => getStreetPurchaseBatchKey(p) === batchId);
      if (!olds.length) return state;

      let warehouseItems = state.warehouseItems;
      for (const o of [...olds].reverse()) {
        const rev = reverseSupplierPurchaseWarehouse(
          warehouseItems,
          o.warehouseItemId,
          o.quantity,
        );
        if (!rev) return state;
        warehouseItems = rev;
      }

      let streetPurchases = state.streetPurchases.filter(
        (p) => getStreetPurchaseBatchKey(p) !== batchId,
      );
      streetPurchases = reconcileStreetPurchasesAfterChange(
        streetPurchases,
        state.streetDebtRepayments,
        olds[0].streetObjectId,
      );
      return { ...state, warehouseItems, streetPurchases };
    }

    case 'STREET_PURCHASE_BATCH_REPLACE': {
      const { batchId, streetObjectId, incomeDate, notes, onCredit, paidAmount, lines } =
        action.payload;
      const streetObject = state.streetObjects.find((s) => s.id === streetObjectId);
      if (!streetObject || !lines.length) return state;

      const olds = state.streetPurchases.filter((p) => getStreetPurchaseBatchKey(p) === batchId);
      if (!olds.length) return state;

      let warehouseItems = state.warehouseItems;
      for (const o of [...olds].reverse()) {
        const rev = reverseSupplierPurchaseWarehouse(
          warehouseItems,
          o.warehouseItemId,
          o.quantity,
        );
        if (!rev) return state;
        warehouseItems = rev;
      }

      const batchCreatedAt = olds.reduce(
        (min, p) => (p.createdAt < min ? p.createdAt : min),
        olds[0].createdAt,
      );
      let streetPurchases = state.streetPurchases.filter(
        (p) => getStreetPurchaseBatchKey(p) !== batchId,
      );

      const resolved: Array<{
        warehouseItemId: string;
        quantity: number;
        streetPurchasePricePerUnit?: number | null;
        lineTotal: number | null;
      }> = [];

      for (const line of lines) {
        const item = warehouseItems.find((w) => w.id === line.warehouseItemId);
        if (!item) return state;
        const qty = normalizeSupplierPurchaseQty(item, line.quantity);
        if (qty == null) return state;
        const p = line.streetPurchasePricePerUnit;
        const hasPositive = p != null && Number.isFinite(p) && p > 0;
        resolved.push({
          warehouseItemId: line.warehouseItemId,
          quantity: qty,
          streetPurchasePricePerUnit: line.streetPurchasePricePerUnit,
          lineTotal: hasPositive ? p * qty : null,
        });
      }

      const priced = resolved.filter((r) => r.lineTotal != null) as Array<
        (typeof resolved)[0] & { lineTotal: number }
      >;
      const orderTotal = priced.reduce((s, r) => s + r.lineTotal, 0);

      let perLinePaid: (number | null)[] = resolved.map(() => null);
      if (orderTotal > 0) {
        const paidRaw = paidAmount;
        const paid =
          paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
        if (paid == null) return state;
        if (onCredit && paid > orderTotal + 1e-6) return state;
        const allocated = allocateSupplierPurchasePaid(
          priced.map((r) => r.lineTotal),
          paid,
          onCredit,
        );
        if (!allocated) return state;
        let ai = 0;
        perLinePaid = resolved.map((r) => {
          if (r.lineTotal == null) return null;
          const v = allocated[ai];
          ai += 1;
          return v;
        });
      }

      const newRecords: StreetPurchaseRecord[] = [];
      const sharedNotes = notes?.trim() || null;

      for (let i = 0; i < resolved.length; i++) {
        const r = resolved[i];
        const result = buildStreetPurchaseUpdate(streetObject, warehouseItems, {
          warehouseItemId: r.warehouseItemId,
          quantity: r.quantity,
          incomeDate,
          notes: sharedNotes,
          streetPurchasePricePerUnit: r.streetPurchasePricePerUnit,
          paidAmount: perLinePaid[i],
          onCredit,
          purchaseBatchId: batchId,
          batchCreatedAt,
        });
        if (!result) return state;
        warehouseItems = result.warehouseItems;
        newRecords.push(result.record);
      }

      streetPurchases = [...newRecords, ...streetPurchases];
      streetPurchases = reconcileStreetPurchasesAfterChange(
        streetPurchases,
        state.streetDebtRepayments,
        streetObjectId,
      );
      return { ...state, warehouseItems, streetPurchases };
    }

    case 'STREET_PURCHASE_UPDATE': {
      const {
        id,
        streetObjectId,
        streetObjectName,
        warehouseItemId,
        quantity,
        incomeDate,
        notes,
        streetPurchasePricePerUnit,
        paidAmount,
        onCredit,
      } = action.payload;
      const old = state.streetPurchases.find((p) => p.id === id);
      if (!old) return state;

      const streetStub: StreetObject = {
        id: streetObjectId ?? 'orphan',
        fullName: streetObjectName,
        phone: '',
        address: '',
        notes: '',
        createdAt: old.createdAt,
      };
      if (streetObjectId && !state.streetObjects.some((s) => s.id === streetObjectId)) return state;

      let warehouseItems = reverseSupplierPurchaseWarehouse(
        state.warehouseItems,
        old.warehouseItemId,
        old.quantity,
      );
      if (!warehouseItems) return state;

      const purchasesWithout = state.streetPurchases.filter((p) => p.id !== id);
      const result = buildStreetPurchaseUpdate(
        streetStub,
        warehouseItems,
        {
          warehouseItemId,
          quantity,
          incomeDate,
          notes: notes ?? null,
          streetPurchasePricePerUnit,
          paidAmount,
          onCredit,
          recordStreetObjectId: streetObjectId,
          recordStreetObjectName: streetObjectName,
        },
        { id: old.id, createdAt: old.createdAt },
      );
      if (!result) return state;

      let streetPurchases = [...purchasesWithout, result.record];
      if (old.streetObjectId && old.streetObjectId !== streetObjectId) {
        streetPurchases = reconcileStreetPurchasesAfterChange(
          streetPurchases,
          state.streetDebtRepayments,
          old.streetObjectId,
        );
      }
      if (streetObjectId) {
        streetPurchases = reconcileStreetPurchasesAfterChange(
          streetPurchases,
          state.streetDebtRepayments,
          streetObjectId,
        );
      }
      return { ...state, warehouseItems: result.warehouseItems, streetPurchases };
    }

    case 'STREET_DEBT_REPAYMENT_ADD': {
      const repayment = action.payload;
      const streetPurchases = applyRepaymentToStreetPurchases(state.streetPurchases, repayment);
      return {
        ...state,
        streetDebtRepayments: [repayment, ...state.streetDebtRepayments],
        streetPurchases,
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
      if (!intake) return state;

      const totalDistributed = rows.reduce((sum, r) => sum + r.weightKg, 0);
      const newRemaining = Math.max(0, intake.remainingKg - totalDistributed);
      const nextStatus: IntakeStatus = newRemaining <= 0 ? 'SORTED' : 'PARTIALLY_SORTED';

      const newSorted: SortedMaterial[] = rows.map((r) => ({
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
        intakes: state.intakes.map((i) =>
          i.id === intakeId ? { ...i, remainingKg: newRemaining, status: nextStatus } : i,
        ),
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
          if (!consumed) return s;
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
        warehouseItems: state.warehouseItems.map((w) =>
          w.id === action.payload.id ? action.payload : w,
        ),
      };

    case 'WAREHOUSE_ADD_WITH_CHILD_SPLITS': {
      const { parent, splits } = action.payload;
      if (parent.parentWarehouseId) return state;

      let parentQty = Math.max(0, parent.currentQty);
      const batchAt = parent.createdAt;
      const children: WarehouseItem[] = [];

      for (const s of splits) {
        const name = s.productName.trim();
        let q = s.quantity;
        if (parent.unit === 'pcs') q = Math.floor(Number(q));
        if (!name || !Number.isFinite(q) || q < 0) continue;
        /** 0 kg/dona ajratilgan qator ham ro'yxatda bo'lsin (nom bo'lsa). */

        if (parentQty + 1e-9 >= q) {
          parentQty -= q;
          children.push(warehouseChildFromParent(parent, name, q, batchAt));
        } else {
          children.push(warehouseChildFromParent(parent, name, q, batchAt));
        }
      }

      const pq = Math.max(0, parentQty);
      const parentFinal: WarehouseItem = {
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
      if (parent.parentWarehouseId) return state;

      let parentQty = Math.max(0, parent.currentQty);
      const batchAt = parent.createdAt;
      const children: WarehouseItem[] = [];

      for (const s of splits) {
        const name = s.productName.trim();
        let q = s.quantity;
        if (parent.unit === 'pcs') q = Math.floor(Number(q));
        if (!name || !Number.isFinite(q) || q < 0) continue;

        if (parentQty + 1e-9 >= q) {
          parentQty -= q;
          children.push(warehouseChildFromParent(parent, name, q, batchAt));
        } else {
          children.push(warehouseChildFromParent(parent, name, q, batchAt));
        }
      }

      if (children.length === 0) return state;

      const pq = Math.max(0, parentQty);
      const parentFinal: WarehouseItem = {
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
      if (!target) return state;

      let warehouseItems: WarehouseItem[];

      if (target.parentWarehouseId) {
        const pid = target.parentWarehouseId;
        const parent = state.warehouseItems.find((w) => w.id === pid);
        if (!parent) {
          warehouseItems = state.warehouseItems.filter((w) => w.id !== id);
        } else {
          const returned = target.currentQty;
          const nextParentQty = parent.currentQty + returned;
          const mergedParentStatus: WarehouseStatus =
            nextParentQty > 0 ? 'IN_STOCK' : parent.status;
          warehouseItems = state.warehouseItems
            .filter((w) => w.id !== id)
            .map((w) =>
              w.id === pid
                ? {
                    ...w,
                    currentQty: nextParentQty,
                    status: mergedParentStatus,
                  }
                : w,
            );
        }
      } else {
        const childIds = new Set(
          state.warehouseItems.filter((w) => w.parentWarehouseId === id).map((w) => w.id),
        );
        warehouseItems = state.warehouseItems.filter((w) => w.id !== id && !childIds.has(w.id));
      }

      return { ...state, warehouseItems };
    }

    case 'WAREHOUSE_OUTCOME': {
      const { outcome } = action.payload;
      const item = state.warehouseItems.find((w) => w.id === outcome.warehouseItemId);
      if (!item) return state;

      let warehouseItems: WarehouseItem[];

      if (outcome.unit === 'kg') {
        const map = cloneWarehouseItemMap(state.warehouseItems);
        if (!applyKgWarehouseMovement(map, outcome.warehouseItemId, outcome.quantity, outcome.type)) {
          return state;
        }
        warehouseItems = state.warehouseItems.map((w) => map.get(w.id)!);
      } else {
        const newQty = Math.max(0, item.currentQty - outcome.quantity);
        const newStatus: WarehouseStatus =
          newQty <= 0 ? (outcome.type === 'SOLD' ? 'SOLD_OUT' : 'CONSUMED_OUT') : 'IN_STOCK';
        warehouseItems = state.warehouseItems.map((w) =>
          w.id === outcome.warehouseItemId ? { ...w, currentQty: newQty, status: newStatus } : w,
        );
      }

      // klient sotuv summasini yangilash (to'liq to'langan deb hisoblanadi)
      let nextCustomers = state.customers;
      if (outcome.type === 'SOLD' && outcome.customerId && outcome.totalAmount) {
        nextCustomers = state.customers.map((c) =>
          c.id === outcome.customerId
            ? {
                ...c,
                lastPurchaseDate: outcome.date,
                totalSpent: c.totalSpent + (outcome.totalAmount ?? 0),
              }
            : c,
        );
      }

      return {
        ...state,
        warehouseItems,
        outcomes: [outcome, ...state.outcomes],
        customers: nextCustomers,
      };
    }

    case 'POS_CHECKOUT': {
      const { date, customerId, customerName, paidAmount, paymentMethod, lines } = action.payload;
      if (!lines.length) return state;
      if (!customerId?.trim()) return state;
      if (!state.customers.some((c) => c.id === customerId)) return state;

      const resolved = lines.map((l) => ({
        ...l,
        item: state.warehouseItems.find((w) => w.id === l.warehouseItemId),
      }));
      if (resolved.some((r) => !r.item || r.item.unit !== 'kg' || r.quantity <= 0)) return state;

      const orderTotal = resolved.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);
      if (orderTotal <= 0) return state;

      const paid = Math.max(0, Math.min(paidAmount, orderTotal));
      const debtAdd = orderTotal - paid;

      const simMap = cloneWarehouseItemMap(state.warehouseItems);
      const posOrderId = uid('ord');
      const now = new Date().toISOString();
      const newOutcomes: WarehouseOutcome[] = [];

      for (const r of resolved) {
        const item = r.item!;
        const ic = simMap.get(item.id)!;
        let soldFromChildKg: number | undefined;
        let soldFromParentKg: number | undefined;
        if (ic.parentWarehouseId && ic.unit === 'kg') {
          soldFromChildKg = Math.min(r.quantity, ic.currentQty);
          soldFromParentKg = r.quantity - soldFromChildKg;
        }
        if (!applyKgWarehouseMovement(simMap, item.id, r.quantity, 'SOLD')) return state;
        newOutcomes.push({
          id: uid('out'),
          posOrderId,
          orderPaidTotal: paid,
          orderPaymentMethod: paymentMethod,
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

      const warehouseItems = state.warehouseItems.map((w) => simMap.get(w.id)!);
      const nextCustomers = state.customers.map((c) =>
        c.id === customerId
          ? {
              ...c,
              lastPurchaseDate: date,
              totalSpent: c.totalSpent + orderTotal,
              balanceDue: c.balanceDue + debtAdd,
            }
          : c,
      );

      return {
        ...state,
        warehouseItems,
        outcomes: [...newOutcomes, ...state.outcomes],
        customers: nextCustomers,
      };
    }

    case 'POS_ORDER_UPDATE': {
      const { posOrderId, date, customerId, customerName, paidAmount, paymentMethod, lines } =
        action.payload;
      if (!lines.length || !customerId?.trim()) return state;
      if (!state.customers.some((c) => c.id === customerId)) return state;

      const oldOutcomes = soldOutcomesForOrderKey(state.outcomes, posOrderId);
      if (!oldOutcomes.length) return state;

      const map = cloneWarehouseItemMap(state.warehouseItems);
      for (const o of [...oldOutcomes].reverse()) {
        if (!restoreKgSoldOutcome(map, o)) return state;
      }

      const outcomesWithout = state.outcomes.filter((o) => !isSoldOutcomeForOrderKey(o, posOrderId));

      const oldFirst = oldOutcomes[0];
      const oldCid = oldFirst.customerId;
      const oldOrderTotal = oldOutcomes.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
      const oldPaidRaw = oldFirst.orderPaidTotal;
      const oldPaid =
        oldPaidRaw != null && Number.isFinite(oldPaidRaw)
          ? Math.max(0, Math.min(oldPaidRaw, oldOrderTotal))
          : oldOrderTotal;
      const oldDebt = Math.max(0, oldOrderTotal - oldPaid);

      let nextCustomers = state.customers;
      if (oldCid) {
        nextCustomers = nextCustomers.map((c) =>
          c.id === oldCid
            ? {
                ...c,
                totalSpent: Math.max(0, c.totalSpent - oldOrderTotal),
                balanceDue: Math.max(0, c.balanceDue - oldDebt),
              }
            : c,
        );
      }

      const tempItems = state.warehouseItems.map((w) => map.get(w.id)!);
      const resolved = lines.map((l) => ({
        ...l,
        item: tempItems.find((w) => w.id === l.warehouseItemId),
      }));
      if (resolved.some((r) => !r.item || r.item.unit !== 'kg' || r.quantity <= 0)) return state;

      const orderTotal = resolved.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);
      if (orderTotal <= 0) return state;

      const paid = Math.max(0, Math.min(paidAmount, orderTotal));
      const debtAdd = orderTotal - paid;

      const now = new Date().toISOString();
      const newOutcomes: WarehouseOutcome[] = [];

      for (const r of resolved) {
        const item = r.item!;
        const ic = map.get(item.id)!;
        let soldFromChildKg: number | undefined;
        let soldFromParentKg: number | undefined;
        if (ic.parentWarehouseId && ic.unit === 'kg') {
          soldFromChildKg = Math.min(r.quantity, ic.currentQty);
          soldFromParentKg = r.quantity - soldFromChildKg;
        }
        if (!applyKgWarehouseMovement(map, item.id, r.quantity, 'SOLD')) return state;
        newOutcomes.push({
          id: uid('out'),
          posOrderId,
          orderPaidTotal: paid,
          orderPaymentMethod: paymentMethod,
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

      const warehouseItems = state.warehouseItems.map((w) => map.get(w.id)!);
      nextCustomers = nextCustomers.map((c) =>
        c.id === customerId
          ? {
              ...c,
              lastPurchaseDate: date,
              totalSpent: c.totalSpent + orderTotal,
              balanceDue: c.balanceDue + debtAdd,
            }
          : c,
      );

      return {
        ...state,
        warehouseItems,
        outcomes: [...newOutcomes, ...outcomesWithout],
        customers: nextCustomers,
      };
    }

    case 'POS_ORDER_DELETE': {
      const { orderId } = action.payload;
      const oldOutcomes = soldOutcomesForOrderKey(state.outcomes, orderId);
      if (!oldOutcomes.length) return state;

      const map = cloneWarehouseItemMap(state.warehouseItems);
      for (const o of [...oldOutcomes].reverse()) {
        if (!restoreKgSoldOutcome(map, o)) return state;
      }

      const oldFirst = oldOutcomes[0];
      const oldCid = oldFirst.customerId;
      const oldOrderTotal = oldOutcomes.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
      const oldPaidRaw = oldFirst.orderPaidTotal;
      const oldPaid =
        oldPaidRaw != null && Number.isFinite(oldPaidRaw)
          ? Math.max(0, Math.min(oldPaidRaw, oldOrderTotal))
          : oldOrderTotal;
      const oldDebt = Math.max(0, oldOrderTotal - oldPaid);

      let nextCustomers = state.customers;
      if (oldCid) {
        nextCustomers = nextCustomers.map((c) =>
          c.id === oldCid
            ? {
                ...c,
                totalSpent: Math.max(0, c.totalSpent - oldOrderTotal),
                balanceDue: Math.max(0, c.balanceDue - oldDebt),
              }
            : c,
        );
      }

      return {
        ...state,
        warehouseItems: state.warehouseItems.map((w) => map.get(w.id)!),
        outcomes: state.outcomes.filter((o) => !isSoldOutcomeForOrderKey(o, orderId)),
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
        expenseCategories: state.expenseCategories.map((c) =>
          c.id === next.id ? next : c,
        ),
        /** Kategoriya nomi o‘zgarsa, snapshotlarni ham yangilab qo‘yamiz (tarixga mos). */
        expenses: state.expenses.map((e) =>
          e.categoryId === next.id ? { ...e, categoryName: next.name } : e,
        ),
      };
    }

    case 'EXPENSE_CATEGORY_DELETE': {
      const { id } = action.payload;
      return {
        ...state,
        expenseCategories: state.expenseCategories.filter((c) => c.id !== id),
        /** Kategoriya o‘chirilsa, eski yozuvlar nomi snapshotidan ko‘rinadi. */
        expenses: state.expenses.map((e) =>
          e.categoryId === id ? { ...e, categoryId: null } : e,
        ),
      };
    }

    case 'EXPENSE_ADD':
      return { ...state, expenses: [action.payload, ...state.expenses] };

    case 'EXPENSE_UPDATE':
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.payload.id ? action.payload : e,
        ),
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

/** Shu ko‘cha obyektiga tegishli xaridlar bo‘yicha qoldiq qarz (`supplierDebtAmount` yig‘indisi). */
export function getSupplierPurchaseDebtIncurred(state: SaralashState, supplierId: string): number {
  return state.supplierPurchases.reduce((sum, p) => {
    if (p.supplierId !== supplierId) return sum;
    const d = p.supplierDebtAmount;
    if (d == null || !Number.isFinite(d) || d <= 0) return sum;
    return sum + d;
  }, 0);
}

/** Qarz bo‘limida qayd etilgan to‘lovlar yig‘indisi (statistika / tarix). */
export function getSupplierDebtRepaid(state: SaralashState, supplierId: string): number {
  return state.supplierDebtRepayments.reduce((sum, r) => {
    if (r.supplierId !== supplierId) return sum;
    const a = r.amount;
    if (a == null || !Number.isFinite(a) || a <= 0) return sum;
    return sum + a;
  }, 0);
}

/** Qoldiq qarz — xarid qatorlarida qolgan `supplierDebtAmount` (to‘lovlar allaqachon qatorlarga taqsimlangan). */
export function getSupplierRemainingDebt(state: SaralashState, supplierId: string): number {
  return getSupplierPurchaseDebtIncurred(state, supplierId);
}

/** Ro‘yxatdan o‘chirilgan baza (`supplierId` null) xaridlaridagi qarz. */
export function getOrphanSupplierDebtIncurred(state: SaralashState): number {
  return state.supplierPurchases.reduce((sum, p) => {
    if (p.supplierId != null) return sum;
    const d = p.supplierDebtAmount;
    if (d == null || !Number.isFinite(d) || d <= 0) return sum;
    return sum + d;
  }, 0);
}

export function getStreetPurchaseDebtIncurred(state: SaralashState, streetObjectId: string): number {
  return state.streetPurchases.reduce((sum, p) => {
    if (p.streetObjectId !== streetObjectId) return sum;
    const d = p.streetObjectDebtAmount;
    if (d == null || !Number.isFinite(d) || d <= 0) return sum;
    return sum + d;
  }, 0);
}

export function getStreetDebtRepaid(state: SaralashState, streetObjectId: string): number {
  return state.streetDebtRepayments.reduce((sum, r) => {
    if (r.streetObjectId !== streetObjectId) return sum;
    const a = r.amount;
    if (a == null || !Number.isFinite(a) || a <= 0) return sum;
    return sum + a;
  }, 0);
}

export function getStreetObjectRemainingDebt(state: SaralashState, streetObjectId: string): number {
  return getStreetPurchaseDebtIncurred(state, streetObjectId);
}

export function getOrphanStreetDebtIncurred(state: SaralashState): number {
  return state.streetPurchases.reduce((sum, p) => {
    if (p.streetObjectId != null) return sum;
    const d = p.streetObjectDebtAmount;
    if (d == null || !Number.isFinite(d) || d <= 0) return sum;
    return sum + d;
  }, 0);
}

// ============================================================================
// CONTEXT
// ============================================================================

export type AddWarehouseItemInput = Omit<
  WarehouseItem,
  'id' | 'createdAt' | 'status' | 'currentQty' | 'source' | 'supplierId' | 'supplierName'
> &
  Partial<Pick<WarehouseItem, 'supplierId' | 'supplierName' | 'sourceBatchId'>> & {
    source?: WarehouseItemSource;
  };

interface StoreContextValue {
  state: SaralashState;
  // Customers
  addCustomer: (input: Omit<Customer, 'id' | 'createdAt' | 'lastPurchaseDate' | 'totalSpent' | 'balanceDue'>) => Customer;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  /** Mijoz qarzidan kelgan to‘lov (balanceDue kamayadi). */
  recordCustomerDebtRepayment: (
    customerId: string,
    input: { amount: number; date: string; notes?: string },
  ) => CustomerDebtRepayment | null;
  // Suppliers
  addSupplier: (input: Omit<Supplier, 'id' | 'createdAt'>) => Supplier;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  /** Ko‘cha obyektiga qarzdan to‘lov; `amount` qoldiqdan oshmasligi kerak. */
  recordSupplierDebtRepayment: (
    supplierId: string,
    input: { amount: number; date: string; notes?: string },
  ) => SupplierDebtRepayment | null;
  purchaseFromSupplier: (
    supplierId: string,
    input: {
      /** Ombordagi qator (ota yoki ajratilgan bola). */
      parentWarehouseItemId: string;
      quantity: number;
      incomeDate: string;
      notes?: string;
      /** Ombor `purchasePricePerUnit`: musbat raqam yoki `null` (maydon bo‘sh — narxdan voz kechish). */
      purchasePricePerUnit?: number | null;
      /** Jami bo‘lsa — to‘langan summa (so‘m). */
      paidAmount?: number | null;
      /** `true`: to‘langan jami dan kam bo‘lishi mumkin (qarz). */
      onCredit?: boolean;
    },
  ) => WarehouseItem | null;
  /** Bir xaridda bir nechta mahsulot qatori (bitta to‘lov / qarz). */
  purchaseLinesFromSupplier: (
    supplierId: string,
    input: {
      incomeDate: string;
      notes?: string;
      onCredit: boolean;
      paidAmount?: number | null;
      lines: Array<{
        warehouseItemId: string;
        quantity: number;
        purchasePricePerUnit?: number | null;
      }>;
    },
  ) => boolean;
  /** Xarid tarixidan yozuvni o‘chirish (ombor miqdori kamayadi). */
  deleteSupplierPurchase: (purchaseId: string) => boolean;
  /** Butun xarid (bir nechta mahsulot qatori)ni o‘chirish. */
  deleteSupplierPurchaseBatch: (batchId: string) => boolean;
  /** Butun xaridni almashtirish (ombor qayta hisoblanadi). */
  replaceSupplierPurchaseBatch: (
    batchId: string,
    input: {
      supplierId: string;
      incomeDate: string;
      notes?: string;
      onCredit: boolean;
      paidAmount?: number | null;
      lines: Array<{
        warehouseItemId: string;
        quantity: number;
        purchasePricePerUnit?: number | null;
      }>;
    },
  ) => boolean;
  /** Xarid tarixini tahrirlash (eski miqdor qaytariladi, yangisi qo‘llanadi). */
  updateSupplierPurchase: (
    purchaseId: string,
    input: {
      supplierId: string | null;
      warehouseItemId: string;
      quantity: number;
      incomeDate: string;
      notes?: string;
      purchasePricePerUnit?: number | null;
      paidAmount?: number | null;
      onCredit: boolean;
    },
  ) => boolean;
  // Street objects (ko‘cha obyektlari olish)
  addStreetObject: (input: Omit<StreetObject, 'id' | 'createdAt'>) => StreetObject;
  updateStreetObject: (streetObject: StreetObject) => void;
  deleteStreetObject: (id: string) => void;
  recordStreetDebtRepayment: (
    streetObjectId: string,
    input: { amount: number; date: string; notes?: string },
  ) => StreetDebtRepayment | null;
  purchaseLinesFromStreetObject: (
    streetObjectId: string,
    input: {
      incomeDate: string;
      notes?: string;
      onCredit: boolean;
      paidAmount?: number | null;
      lines: Array<{
        warehouseItemId: string;
        quantity: number;
        streetPurchasePricePerUnit?: number | null;
      }>;
    },
  ) => boolean;
  deleteStreetPurchase: (purchaseId: string) => boolean;
  deleteStreetPurchaseBatch: (batchId: string) => boolean;
  replaceStreetPurchaseBatch: (
    batchId: string,
    input: {
      streetObjectId: string;
      incomeDate: string;
      notes?: string;
      onCredit: boolean;
      paidAmount?: number | null;
      lines: Array<{
        warehouseItemId: string;
        quantity: number;
        streetPurchasePricePerUnit?: number | null;
      }>;
    },
  ) => boolean;
  updateStreetPurchase: (
    purchaseId: string,
    input: {
      streetObjectId: string | null;
      warehouseItemId: string;
      quantity: number;
      incomeDate: string;
      notes?: string;
      streetPurchasePricePerUnit?: number | null;
      paidAmount?: number | null;
      onCredit: boolean;
    },
  ) => boolean;
  // Intakes
  addIntake: (input: Omit<Intake, 'id' | 'createdAt' | 'status' | 'remainingKg'>) => Intake;
  deleteIntake: (id: string) => void;
  distributeIntake: (intakeId: string, rows: Array<{ category: CategoryKey; weightKg: number }>) => void;
  // Press / Process
  pressSortedMaterials: (input: {
    productName: string;
    category: CategoryKey;
    pickedSorted: Array<{ sorted: SortedMaterial; takeKg: number }>;
    outputKg: number;
    notes?: string;
  }) => ProcessedBatch;
  // Warehouse
  addWarehouseItem: (input: AddWarehouseItemInput) => WarehouseItem;
  /** Ota + ixtiyoriy ajratilgan bolalar bitta amalda (tashqi kirim). */
  addWarehouseItemWithSplits: (
    input: AddWarehouseItemInput,
    splits: Array<{ productName: string; quantity: number }>,
  ) => WarehouseItem;
  /** Mavjud ota qatoriga yangi ajratilganlar (tahrirda). */
  appendWarehouseSplitsToParent: (
    parent: WarehouseItem,
    splits: Array<{ productName: string; quantity: number }>,
  ) => void;
  updateWarehouseItem: (item: WarehouseItem) => void;
  /** Faqat ajratilgan (ota ostidagi) qator: miqdor qo'shiladi, ota o'zgarmaydi. */
  addWarehouseChildQty: (childId: string, delta: number) => boolean;
  deleteWarehouseItem: (id: string) => void;
  recordOutcome: (input: Omit<WarehouseOutcome, 'id' | 'createdAt'>) => void;
  posCheckout: (input: {
    date: string;
    customerId: string | null;
    customerName: string | null;
    paidAmount: number;
    paymentMethod: PosPaymentMethod;
    lines: PosCheckoutLine[];
  }) => boolean;
  /** Mavjud POS buyurtmasini (bir xil `posOrderId`) yangi qatorlar/to‘lov/mijoz bilan almashtirish. */
  updatePosOrder: (input: {
    posOrderId: string;
    date: string;
    customerId: string;
    customerName: string | null;
    paidAmount: number;
    paymentMethod: PosPaymentMethod;
    lines: PosCheckoutLine[];
  }) => boolean;
  /** Sotuv tarixidan buyurtmani o‘chirish (ombor va mijoz statistikasi qaytariladi). */
  deletePosOrder: (orderId: string) => boolean;
  // Expenses
  addExpenseCategory: (
    input: Omit<ExpenseCategory, 'id' | 'createdAt' | 'builtIn'> & { builtIn?: boolean },
  ) => ExpenseCategory | null;
  updateExpenseCategory: (category: ExpenseCategory) => boolean;
  deleteExpenseCategory: (id: string) => void;
  addExpense: (
    input: Omit<Expense, 'id' | 'createdAt' | 'categoryName'> & { categoryName?: string },
  ) => Expense | null;
  updateExpense: (
    expense: Omit<Expense, 'createdAt' | 'categoryName'> & {
      createdAt?: string;
      categoryName?: string;
    },
  ) => boolean;
  deleteExpense: (id: string) => void;
}

function canReverseSupplierPurchase(
  state: SaralashState,
  warehouseItemId: string,
  quantity: number,
): boolean {
  const item = state.warehouseItems.find((w) => w.id === warehouseItemId);
  if (!item) return false;
  let qty = quantity;
  if (item.unit === 'pcs') qty = Math.floor(qty);
  return Number.isFinite(qty) && qty > 0 && item.currentQty >= qty - 1e-9;
}

function canDeleteSupplierPurchase(state: SaralashState, purchaseId: string): boolean {
  const old = state.supplierPurchases.find((p) => p.id === purchaseId);
  if (!old) return false;
  return canReverseSupplierPurchase(state, old.warehouseItemId, old.quantity);
}

function purchasesInBatch(state: SaralashState, batchId: string): SupplierPurchaseRecord[] {
  return state.supplierPurchases.filter((p) => getSupplierPurchaseBatchKey(p) === batchId);
}

function canDeleteSupplierPurchaseBatch(state: SaralashState, batchId: string): boolean {
  const olds = purchasesInBatch(state, batchId);
  if (!olds.length) return false;
  let items = state.warehouseItems;
  for (const o of [...olds].reverse()) {
    const rev = reverseSupplierPurchaseWarehouse(items, o.warehouseItemId, o.quantity);
    if (!rev) return false;
    items = rev;
  }
  return true;
}

function canReplaceSupplierPurchaseBatch(
  state: SaralashState,
  batchId: string,
  input: {
    supplierId: string;
    lines: Array<{
      warehouseItemId: string;
      quantity: number;
      purchasePricePerUnit?: number | null;
    }>;
    paidAmount?: number | null;
    onCredit: boolean;
  },
): boolean {
  if (!canDeleteSupplierPurchaseBatch(state, batchId)) return false;
  return canPurchaseLinesFromSupplier(state, input.supplierId, {
    lines: input.lines,
    paidAmount: input.paidAmount,
    onCredit: input.onCredit,
  });
}

function canUpdateSupplierPurchase(
  state: SaralashState,
  purchaseId: string,
  input: {
    supplierId: string | null;
    warehouseItemId: string;
    quantity: number;
    purchasePricePerUnit?: number | null;
    paidAmount?: number | null;
    onCredit: boolean;
  },
): boolean {
  const old = state.supplierPurchases.find((p) => p.id === purchaseId);
  if (!old) return false;
  if (input.supplierId && !state.suppliers.some((s) => s.id === input.supplierId)) return false;
  if (!canReverseSupplierPurchase(state, old.warehouseItemId, old.quantity)) return false;

  const item = state.warehouseItems.find((w) => w.id === input.warehouseItemId);
  if (!item) return false;
  const qty = normalizeSupplierPurchaseQty(item, input.quantity);
  if (qty == null) return false;

  let items = reverseSupplierPurchaseWarehouse(state.warehouseItems, old.warehouseItemId, old.quantity);
  if (!items) return false;

  const supplier = input.supplierId
    ? state.suppliers.find((s) => s.id === input.supplierId)
    : null;
  const supplierStub: Supplier = supplier ?? {
    id: 'orphan',
    fullName: old.supplierName,
    phone: '',
    address: '',
    notes: '',
    createdAt: old.createdAt,
  };

  const p = input.purchasePricePerUnit;
  const hasPositive = p != null && Number.isFinite(p) && p > 0;
  const lineTotal = hasPositive ? p * qty : null;
  const paidRaw = input.paidAmount;
  const paid =
    paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
  if (lineTotal != null) {
    if (paid == null) return false;
    if (input.onCredit) {
      if (paid > lineTotal + 1e-6) return false;
    } else if (Math.abs(paid - lineTotal) > 1e-4 * Math.max(1, lineTotal)) {
      return false;
    }
  }

  const result = buildSupplierPurchaseUpdate(
    supplierStub,
    items,
    {
      warehouseItemId: input.warehouseItemId,
      quantity: qty,
      incomeDate: old.incomeDate,
      purchasePricePerUnit: input.purchasePricePerUnit,
      paidAmount: paid,
      onCredit: input.onCredit,
      recordSupplierId: input.supplierId,
      recordSupplierName: supplier?.fullName ?? old.supplierName,
    },
    { id: old.id, createdAt: old.createdAt },
  );
  return result != null;
}

function canPurchaseLinesFromSupplier(
  state: SaralashState,
  supplierId: string,
  input: {
    lines: Array<{
      warehouseItemId: string;
      quantity: number;
      purchasePricePerUnit?: number | null;
    }>;
    paidAmount?: number | null;
    onCredit: boolean;
  },
): boolean {
  if (!state.suppliers.some((s) => s.id === supplierId) || !input.lines.length) return false;

  const resolved: Array<{ lineTotal: number | null }> = [];
  for (const line of input.lines) {
    const item = state.warehouseItems.find((w) => w.id === line.warehouseItemId);
    if (!item) return false;
    const qty = normalizeSupplierPurchaseQty(item, line.quantity);
    if (qty == null) return false;
    const p = line.purchasePricePerUnit;
    const hasPositive = p != null && Number.isFinite(p) && p > 0;
    resolved.push({ lineTotal: hasPositive ? p * qty : null });
  }

  const priced = resolved.filter((r) => r.lineTotal != null) as Array<{ lineTotal: number }>;
  const orderTotal = priced.reduce((s, r) => s + r.lineTotal, 0);
  if (orderTotal <= 0) return true;

  const paidRaw = input.paidAmount;
  const paid =
    paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
  if (paid == null) return false;
  if (input.onCredit) {
    if (paid > orderTotal + 1e-6) return false;
    return allocateSupplierPurchasePaid(
      priced.map((r) => r.lineTotal),
      paid,
      true,
    ) != null;
  }
  return allocateSupplierPurchasePaid(
    priced.map((r) => r.lineTotal),
    paid,
    false,
  ) != null;
}

function canPosCheckout(
  state: SaralashState,
  input: {
    lines: PosCheckoutLine[];
    paidAmount: number;
    customerId: string | null;
  },
): boolean {
  const { lines, paidAmount, customerId } = input;
  if (!customerId?.trim() || !lines.length) return false;
  if (!state.customers.some((c) => c.id === customerId)) return false;
  const orderTotal = lines.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);
  if (orderTotal <= 0) return false;
  const paid = Math.max(0, Math.min(paidAmount, orderTotal));
  if (orderTotal - paid > 1e-6 && !customerId) return false;
  const map = cloneWarehouseItemMap(state.warehouseItems);
  for (const l of lines) {
    const w = state.warehouseItems.find((x) => x.id === l.warehouseItemId);
    if (!w || w.unit !== 'kg' || l.quantity <= 0) return false;
    if (!applyKgWarehouseMovement(map, l.warehouseItemId, l.quantity, 'SOLD')) return false;
  }
  return true;
}

function canPosOrderUpdate(
  state: SaralashState,
  input: {
    posOrderId: string;
    customerId: string;
    paidAmount: number;
    lines: PosCheckoutLine[];
  },
): boolean {
  if (!input.customerId?.trim() || !input.lines.length) return false;
  if (!state.customers.some((c) => c.id === input.customerId)) return false;
  const oldOutcomes = soldOutcomesForOrderKey(state.outcomes, input.posOrderId);
  if (!oldOutcomes.length) return false;
  const map = cloneWarehouseItemMap(state.warehouseItems);
  for (const o of [...oldOutcomes].reverse()) {
    if (!restoreKgSoldOutcome(map, o)) return false;
  }
  const tempItems = state.warehouseItems.map((w) => map.get(w.id)!);
  const resolved = input.lines.map((l) => ({
    ...l,
    item: tempItems.find((w) => w.id === l.warehouseItemId),
  }));
  if (resolved.some((r) => !r.item || r.item.unit !== 'kg' || r.quantity <= 0)) return false;
  const orderTotal = resolved.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);
  if (orderTotal <= 0) return false;
  const paid = Math.max(0, Math.min(input.paidAmount, orderTotal));
  if (orderTotal - paid > 1e-6 && !input.customerId.trim()) return false;
  for (const r of resolved) {
    if (!applyKgWarehouseMovement(map, r.item!.id, r.quantity, 'SOLD')) return false;
  }
  return true;
}

function streetPurchasesInBatch(state: SaralashState, batchId: string): StreetPurchaseRecord[] {
  return state.streetPurchases.filter((p) => getStreetPurchaseBatchKey(p) === batchId);
}

function canDeleteStreetPurchase(state: SaralashState, purchaseId: string): boolean {
  const old = state.streetPurchases.find((p) => p.id === purchaseId);
  if (!old) return false;
  return canReverseSupplierPurchase(state, old.warehouseItemId, old.quantity);
}

function canDeleteStreetPurchaseBatch(state: SaralashState, batchId: string): boolean {
  const olds = streetPurchasesInBatch(state, batchId);
  if (!olds.length) return false;
  let items = state.warehouseItems;
  for (const o of [...olds].reverse()) {
    const rev = reverseSupplierPurchaseWarehouse(items, o.warehouseItemId, o.quantity);
    if (!rev) return false;
    items = rev;
  }
  return true;
}

function canReplaceStreetPurchaseBatch(
  state: SaralashState,
  batchId: string,
  input: {
    streetObjectId: string;
    lines: Array<{
      warehouseItemId: string;
      quantity: number;
      streetPurchasePricePerUnit?: number | null;
    }>;
    paidAmount?: number | null;
    onCredit: boolean;
  },
): boolean {
  if (!state.streetObjects.some((s) => s.id === input.streetObjectId) || !input.lines.length) return false;
  const olds = streetPurchasesInBatch(state, batchId);
  if (!olds.length) return false;
  let items = state.warehouseItems;
  for (const o of [...olds].reverse()) {
    const rev = reverseSupplierPurchaseWarehouse(items, o.warehouseItemId, o.quantity);
    if (!rev) return false;
    items = rev;
  }
  return canPurchaseLinesFromStreetObject(state, input.streetObjectId, {
    lines: input.lines,
    paidAmount: input.paidAmount,
    onCredit: input.onCredit,
  });
}

function canUpdateStreetPurchase(
  state: SaralashState,
  purchaseId: string,
  input: {
    streetObjectId: string | null;
    warehouseItemId: string;
    quantity: number;
    streetPurchasePricePerUnit?: number | null;
    paidAmount?: number | null;
    onCredit: boolean;
  },
): boolean {
  const old = state.streetPurchases.find((p) => p.id === purchaseId);
  if (!old) return false;
  if (input.streetObjectId && !state.streetObjects.some((s) => s.id === input.streetObjectId)) return false;
  if (!canReverseSupplierPurchase(state, old.warehouseItemId, old.quantity)) return false;

  const item = state.warehouseItems.find((w) => w.id === input.warehouseItemId);
  if (!item) return false;
  const qty = normalizeSupplierPurchaseQty(item, input.quantity);
  if (qty == null) return false;

  let items = reverseSupplierPurchaseWarehouse(state.warehouseItems, old.warehouseItemId, old.quantity);
  if (!items) return false;

  const streetObject = input.streetObjectId
    ? state.streetObjects.find((s) => s.id === input.streetObjectId)
    : null;
  const streetStub: StreetObject = streetObject ?? {
    id: 'orphan',
    fullName: old.streetObjectName,
    phone: '',
    address: '',
    notes: '',
    createdAt: old.createdAt,
  };

  const p = input.streetPurchasePricePerUnit;
  const hasPositive = p != null && Number.isFinite(p) && p > 0;
  const lineTotal = hasPositive ? p * qty : null;
  const paidRaw = input.paidAmount;
  const paid =
    paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
  if (lineTotal != null) {
    if (paid == null) return false;
    if (input.onCredit) {
      if (paid > lineTotal + 1e-6) return false;
    } else if (Math.abs(paid - lineTotal) > 1e-4 * Math.max(1, lineTotal)) {
      return false;
    }
  }

  const result = buildStreetPurchaseUpdate(
    streetStub,
    items,
    {
      warehouseItemId: input.warehouseItemId,
      quantity: qty,
      incomeDate: old.incomeDate,
      streetPurchasePricePerUnit: input.streetPurchasePricePerUnit,
      paidAmount: paid,
      onCredit: input.onCredit,
      recordStreetObjectId: input.streetObjectId,
      recordStreetObjectName: streetObject?.fullName ?? old.streetObjectName,
    },
    { id: old.id, createdAt: old.createdAt },
  );
  return result != null;
}

function canPurchaseLinesFromStreetObject(
  state: SaralashState,
  streetObjectId: string,
  input: {
    lines: Array<{
      warehouseItemId: string;
      quantity: number;
      streetPurchasePricePerUnit?: number | null;
    }>;
    paidAmount?: number | null;
    onCredit: boolean;
  },
): boolean {
  if (!state.streetObjects.some((s) => s.id === streetObjectId) || !input.lines.length) return false;

  const resolved: Array<{ lineTotal: number | null }> = [];
  for (const line of input.lines) {
    const item = state.warehouseItems.find((w) => w.id === line.warehouseItemId);
    if (!item) return false;
    const qty = normalizeSupplierPurchaseQty(item, line.quantity);
    if (qty == null) return false;
    const p = line.streetPurchasePricePerUnit;
    const hasPositive = p != null && Number.isFinite(p) && p > 0;
    resolved.push({ lineTotal: hasPositive ? p * qty : null });
  }

  const priced = resolved.filter((r) => r.lineTotal != null) as Array<{ lineTotal: number }>;
  const orderTotal = priced.reduce((s, r) => s + r.lineTotal, 0);
  if (orderTotal <= 0) return true;

  const paidRaw = input.paidAmount;
  const paid = paidRaw != null && Number.isFinite(paidRaw) && paidRaw >= 0 ? paidRaw : null;
  if (paid == null) return false;
  if (input.onCredit) {
    if (paid > orderTotal + 1e-6) return false;
    return allocateSupplierPurchasePaid(
      priced.map((r) => r.lineTotal),
      paid,
      true,
    ) != null;
  }
  return allocateSupplierPurchasePaid(
    priced.map((r) => r.lineTotal),
    paid,
    false,
  ) != null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/** localStorage yoki serverdan kelgan qisman JSON ni to‘liq holatga keltiradi. */
export function normalizeAppState(parsed: Partial<SaralashState> | null | undefined): SaralashState {
  try {
    if (!parsed || typeof parsed !== 'object') {
      return { ...INITIAL_STATE, expenseCategories: buildDefaultExpenseCategories() };
    }
    const customers = Array.isArray(parsed.customers)
      ? parsed.customers.map((c) => ({
          ...c,
          balanceDue: typeof (c as Customer).balanceDue === 'number' ? (c as Customer).balanceDue : 0,
        }))
      : [];
    const suppliers = Array.isArray(parsed.suppliers) ? parsed.suppliers : [];
    const hasPurchaseStorage =
      parsed !== null && typeof parsed === 'object' && 'supplierPurchases' in parsed;
    let supplierPurchases = Array.isArray(parsed.supplierPurchases) ? parsed.supplierPurchases : [];

    /** Eski saqlanmalar: `supplierPurchases` kaliti yo‘q bo‘lsa, ombordagi ko‘cha obyekti kirimlaridan bir marta to‘ldirish. */
    if (
      !hasPurchaseStorage &&
      Array.isArray(parsed.warehouseItems) &&
      parsed.warehouseItems.length > 0
    ) {
      const items = parsed.warehouseItems as WarehouseItem[];
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

    const customerDebtRepayments = Array.isArray(
      (parsed as Partial<SaralashState>).customerDebtRepayments,
    )
      ? (parsed as Partial<SaralashState>).customerDebtRepayments!
      : [];

    supplierPurchases = reconcileSupplierPurchasesDebtsWithRepayments(
      supplierPurchases,
      supplierDebtRepayments,
    );
    supplierPurchases = migrateSupplierPurchaseBatchIds(supplierPurchases);
    supplierPurchases = syncAllSupplierPurchasesPaidFromTotals(supplierPurchases);

    const streetObjects = Array.isArray(parsed.streetObjects) ? parsed.streetObjects : [];
    let streetPurchases = Array.isArray(parsed.streetPurchases) ? parsed.streetPurchases : [];
    const streetDebtRepayments = Array.isArray(parsed.streetDebtRepayments)
      ? parsed.streetDebtRepayments
      : [];

    streetPurchases = reconcileStreetPurchasesDebtsWithRepayments(
      streetPurchases,
      streetDebtRepayments,
    );
    streetPurchases = migrateStreetPurchaseBatchIds(streetPurchases);
    streetPurchases = syncAllStreetPurchasesPaidFromTotals(streetPurchases);

    const warehouseItems = Array.isArray(parsed.warehouseItems)
      ? (parsed.warehouseItems as WarehouseItem[]).map((w) => ({
          ...w,
          streetPurchasePricePerUnit:
            w.streetPurchasePricePerUnit != null && Number.isFinite(w.streetPurchasePricePerUnit)
              ? w.streetPurchasePricePerUnit
              : null,
        }))
      : [];

    const hasExpenseCategoryStorage =
      parsed !== null && typeof parsed === 'object' && 'expenseCategories' in parsed;
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
      streetObjects,
      streetPurchases,
      streetDebtRepayments,
      warehouseItems: warehouseItems.length ? warehouseItems : parsed.warehouseItems ?? [],
      customerDebtRepayments,
      expenseCategories,
      expenses,
    };
  } catch {
    return { ...INITIAL_STATE, expenseCategories: buildDefaultExpenseCategories() };
  }
}

function readStoredState(): SaralashState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeAppState(null);
    return normalizeAppState(JSON.parse(raw) as Partial<SaralashState>);
  } catch {
    return normalizeAppState(null);
  }
}

const SHARED_SYNC_POLL_MS = 5000;
const SHARED_SYNC_DEBOUNCE_MS = 1200;

export function SaralashProvider({ children }: { children: React.ReactNode }) {
  const { sessionMode, isAuthenticated, loading } = useAuth();
  const [state, dispatch] = useReducer(reducer, undefined as unknown as SaralashState, () => readStoredState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const serverUpdatedAtRef = useRef<string | null>(null);
  const applyingRemoteRef = useRef(false);
  const [syncReady, setSyncReady] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  useEffect(() => {
    if (loading || !isAuthenticated || sessionMode !== 'api') {
      setSyncReady(false);
      serverUpdatedAtRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const remote = await fetchSharedAppState();
        if (cancelled) return;
        if (remote.updatedAt && remote.payload) {
          applyingRemoteRef.current = true;
          dispatch({
            type: 'HYDRATE',
            payload: normalizeAppState(remote.payload as Partial<SaralashState>),
          });
          serverUpdatedAtRef.current = remote.updatedAt;
        } else {
          const put = await putSharedAppState(stateRef.current);
          serverUpdatedAtRef.current = put.updatedAt;
        }
      } catch {
        /* server yo‘q — faqat mahalliy cache */
      } finally {
        applyingRemoteRef.current = false;
        if (!cancelled) setSyncReady(true);
      }
    })();

    return () => {
      cancelled = true;
      setSyncReady(false);
    };
  }, [loading, isAuthenticated, sessionMode]);

  useEffect(() => {
    if (!syncReady || sessionMode !== 'api' || !isAuthenticated || applyingRemoteRef.current) return;

    const timer = window.setTimeout(() => {
      if (applyingRemoteRef.current) return;
      void putSharedAppState(stateRef.current)
        .then((put) => {
          serverUpdatedAtRef.current = put.updatedAt;
        })
        .catch(() => {
          /* ignore */
        });
    }, SHARED_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [state, syncReady, sessionMode, isAuthenticated]);

  useEffect(() => {
    if (!syncReady || sessionMode !== 'api' || !isAuthenticated) return;

    const pull = async () => {
      try {
        const remote = await fetchSharedAppState();
        if (!remote.payload || !remote.updatedAt) return;
        if (
          serverUpdatedAtRef.current &&
          remote.updatedAt <= serverUpdatedAtRef.current
        ) {
          return;
        }
        applyingRemoteRef.current = true;
        dispatch({
          type: 'HYDRATE',
          payload: normalizeAppState(remote.payload as Partial<SaralashState>),
        });
        serverUpdatedAtRef.current = remote.updatedAt;
      } catch {
        /* ignore */
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const interval = window.setInterval(() => void pull(), SHARED_SYNC_POLL_MS);
    const onFocus = () => void pull();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncReady, sessionMode, isAuthenticated]);

  const addCustomer = useCallback<StoreContextValue['addCustomer']>((input) => {
    const customer: Customer = {
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

  const updateCustomer = useCallback<StoreContextValue['updateCustomer']>((customer) => {
    dispatch({ type: 'CUSTOMER_UPDATE', payload: customer });
  }, []);

  const deleteCustomer = useCallback<StoreContextValue['deleteCustomer']>((id) => {
    dispatch({ type: 'CUSTOMER_DELETE', payload: { id } });
  }, []);

  const recordCustomerDebtRepayment = useCallback<StoreContextValue['recordCustomerDebtRepayment']>(
    (customerId, input) => {
      const customer = stateRef.current.customers.find((c) => c.id === customerId);
      if (!customer) return null;
      const amt = input.amount;
      if (!Number.isFinite(amt) || amt <= 0) return null;
      const due = Math.max(0, customer.balanceDue);
      if (due <= 1e-9 || amt > due + 1e-6) return null;
      const row: CustomerDebtRepayment = {
        id: uid('cdr'),
        customerId,
        customerName: customer.fullName,
        amount: Math.min(amt, due),
        date: input.date,
        notes: input.notes?.trim() || null,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'CUSTOMER_DEBT_REPAYMENT_ADD', payload: row });
      return row;
    },
    [],
  );

  const addSupplier = useCallback<StoreContextValue['addSupplier']>((input) => {
    const supplier: Supplier = {
      ...input,
      id: uid('sup'),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'SUPPLIER_ADD', payload: supplier });
    return supplier;
  }, []);

  const updateSupplier = useCallback<StoreContextValue['updateSupplier']>((supplier) => {
    dispatch({ type: 'SUPPLIER_UPDATE', payload: supplier });
  }, []);

  const deleteSupplier = useCallback<StoreContextValue['deleteSupplier']>((id) => {
    dispatch({ type: 'SUPPLIER_DELETE', payload: { id } });
  }, []);

  const recordSupplierDebtRepayment = useCallback<StoreContextValue['recordSupplierDebtRepayment']>(
    (supplierId, input) => {
      const supplier = stateRef.current.suppliers.find((s) => s.id === supplierId);
      if (!supplier) return null;
      const amt = input.amount;
      if (!Number.isFinite(amt) || amt <= 0) return null;
      const remaining = getSupplierRemainingDebt(stateRef.current, supplierId);
      if (amt > remaining + 1e-6) return null;
      const row: SupplierDebtRepayment = {
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
    },
    [],
  );

  const addIntake = useCallback<StoreContextValue['addIntake']>((input) => {
    const intake: Intake = {
      ...input,
      id: uid('intk'),
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      remainingKg: input.weightKg,
    };
    dispatch({ type: 'INTAKE_ADD', payload: intake });
    return intake;
  }, []);

  const deleteIntake = useCallback<StoreContextValue['deleteIntake']>((id) => {
    dispatch({ type: 'INTAKE_DELETE', payload: { id } });
  }, []);

  const distributeIntake = useCallback<StoreContextValue['distributeIntake']>(
    (intakeId, rows) => {
      const filtered = rows.filter((r) => r.weightKg > 0 && r.category);
      if (filtered.length === 0) return;
      dispatch({ type: 'SORT_DISTRIBUTE', payload: { intakeId, rows: filtered } });
    },
    [],
  );

  const pressSortedMaterials = useCallback<StoreContextValue['pressSortedMaterials']>(
    ({ productName, category, pickedSorted, outputKg, notes }) => {
      const sourceIds = pickedSorted.map((p) => p.sorted.id);
      const batch: ProcessedBatch = {
        id: uid('batch'),
        date: TODAY,
        productName,
        category,
        weightKg: outputKg,
        sourceSortedIds: sourceIds,
        notes,
        createdAt: new Date().toISOString(),
      };
      const warehouseItem: WarehouseItem = {
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
    },
    [],
  );

  const addWarehouseItem = useCallback<StoreContextValue['addWarehouseItem']>((input) => {
    const src = input.source ?? 'EXTERNAL';
    const item: WarehouseItem = {
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

  const addWarehouseItemWithSplits = useCallback<StoreContextValue['addWarehouseItemWithSplits']>(
    (input, splits) => {
      const src = input.source ?? 'EXTERNAL';
      const now = new Date().toISOString();
      const item: WarehouseItem = {
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
    },
    [],
  );

  const appendWarehouseSplitsToParent = useCallback<
    StoreContextValue['appendWarehouseSplitsToParent']
  >((parent, splits) => {
    if (parent.parentWarehouseId || !splits.length) return;
    dispatch({ type: 'WAREHOUSE_APPEND_SPLITS_TO_PARENT', payload: { parent, splits } });
  }, []);

  const purchaseLinesFromSupplier = useCallback<StoreContextValue['purchaseLinesFromSupplier']>(
    (supplierId, input) => {
      if (!canPurchaseLinesFromSupplier(stateRef.current, supplierId, input)) return false;
      dispatch({ type: 'SUPPLIER_PURCHASE_BATCH', payload: { supplierId, ...input } });
      return true;
    },
    [],
  );

  const purchaseFromSupplier = useCallback<StoreContextValue['purchaseFromSupplier']>(
    (supplierId, input) => {
      const ok = purchaseLinesFromSupplier(supplierId, {
        incomeDate: input.incomeDate,
        notes: input.notes,
        onCredit: input.onCredit ?? false,
        paidAmount: input.paidAmount,
        lines: [
          {
            warehouseItemId: input.parentWarehouseItemId,
            quantity: input.quantity,
            purchasePricePerUnit: input.purchasePricePerUnit,
          },
        ],
      });
      if (!ok) return null;
      return (
        stateRef.current.warehouseItems.find((w) => w.id === input.parentWarehouseItemId) ?? null
      );
    },
    [purchaseLinesFromSupplier],
  );

  const deleteSupplierPurchase = useCallback<StoreContextValue['deleteSupplierPurchase']>(
    (purchaseId) => {
      if (!canDeleteSupplierPurchase(stateRef.current, purchaseId)) return false;
      dispatch({ type: 'SUPPLIER_PURCHASE_DELETE', payload: { id: purchaseId } });
      return true;
    },
    [],
  );

  const deleteSupplierPurchaseBatch = useCallback<StoreContextValue['deleteSupplierPurchaseBatch']>(
    (batchId) => {
      if (!canDeleteSupplierPurchaseBatch(stateRef.current, batchId)) return false;
      dispatch({ type: 'SUPPLIER_PURCHASE_BATCH_DELETE', payload: { batchId } });
      return true;
    },
    [],
  );

  const replaceSupplierPurchaseBatch = useCallback<StoreContextValue['replaceSupplierPurchaseBatch']>(
    (batchId, input) => {
      if (!canReplaceSupplierPurchaseBatch(stateRef.current, batchId, input)) return false;
      dispatch({ type: 'SUPPLIER_PURCHASE_BATCH_REPLACE', payload: { batchId, ...input } });
      return true;
    },
    [],
  );

  const updateSupplierPurchase = useCallback<StoreContextValue['updateSupplierPurchase']>(
    (purchaseId, input) => {
      const old = stateRef.current.supplierPurchases.find((p) => p.id === purchaseId);
      if (!old) return false;
      const supplier = input.supplierId
        ? stateRef.current.suppliers.find((s) => s.id === input.supplierId)
        : null;
      if (input.supplierId && !supplier) return false;
      if (
        !canUpdateSupplierPurchase(stateRef.current, purchaseId, {
          supplierId: input.supplierId,
          warehouseItemId: input.warehouseItemId,
          quantity: input.quantity,
          purchasePricePerUnit: input.purchasePricePerUnit,
          paidAmount: input.paidAmount,
          onCredit: input.onCredit,
        })
      ) {
        return false;
      }
      dispatch({
        type: 'SUPPLIER_PURCHASE_UPDATE',
        payload: {
          id: purchaseId,
          supplierId: input.supplierId,
          supplierName: supplier?.fullName ?? old.supplierName,
          warehouseItemId: input.warehouseItemId,
          quantity: input.quantity,
          incomeDate: input.incomeDate,
          notes: input.notes,
          purchasePricePerUnit: input.purchasePricePerUnit,
          paidAmount: input.paidAmount,
          onCredit: input.onCredit,
        },
      });
      return true;
    },
    [],
  );

  const addStreetObject = useCallback<StoreContextValue['addStreetObject']>((input) => {
    const streetObject: StreetObject = {
      ...input,
      id: uid('sto'),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'STREET_OBJECT_ADD', payload: streetObject });
    return streetObject;
  }, []);

  const updateStreetObject = useCallback<StoreContextValue['updateStreetObject']>((streetObject) => {
    dispatch({ type: 'STREET_OBJECT_UPDATE', payload: streetObject });
  }, []);

  const deleteStreetObject = useCallback<StoreContextValue['deleteStreetObject']>((id) => {
    dispatch({ type: 'STREET_OBJECT_DELETE', payload: { id } });
  }, []);

  const recordStreetDebtRepayment = useCallback<StoreContextValue['recordStreetDebtRepayment']>(
    (streetObjectId, input) => {
      const streetObject = stateRef.current.streetObjects.find((s) => s.id === streetObjectId);
      if (!streetObject) return null;
      const amt = input.amount;
      if (!Number.isFinite(amt) || amt <= 0) return null;
      const remaining = getStreetObjectRemainingDebt(stateRef.current, streetObjectId);
      if (amt > remaining + 1e-6) return null;
      const row: StreetDebtRepayment = {
        id: uid('stdr'),
        streetObjectId,
        streetObjectName: streetObject.fullName,
        amount: amt,
        date: input.date,
        notes: input.notes?.trim() || null,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'STREET_DEBT_REPAYMENT_ADD', payload: row });
      return row;
    },
    [],
  );

  const purchaseLinesFromStreetObject = useCallback<StoreContextValue['purchaseLinesFromStreetObject']>(
    (streetObjectId, input) => {
      if (!canPurchaseLinesFromStreetObject(stateRef.current, streetObjectId, input)) return false;
      dispatch({ type: 'STREET_PURCHASE_BATCH', payload: { streetObjectId, ...input } });
      return true;
    },
    [],
  );

  const deleteStreetPurchase = useCallback<StoreContextValue['deleteStreetPurchase']>(
    (purchaseId) => {
      if (!canDeleteStreetPurchase(stateRef.current, purchaseId)) return false;
      dispatch({ type: 'STREET_PURCHASE_DELETE', payload: { id: purchaseId } });
      return true;
    },
    [],
  );

  const deleteStreetPurchaseBatch = useCallback<StoreContextValue['deleteStreetPurchaseBatch']>(
    (batchId) => {
      if (!canDeleteStreetPurchaseBatch(stateRef.current, batchId)) return false;
      dispatch({ type: 'STREET_PURCHASE_BATCH_DELETE', payload: { batchId } });
      return true;
    },
    [],
  );

  const replaceStreetPurchaseBatch = useCallback<StoreContextValue['replaceStreetPurchaseBatch']>(
    (batchId, input) => {
      if (!canReplaceStreetPurchaseBatch(stateRef.current, batchId, input)) return false;
      dispatch({ type: 'STREET_PURCHASE_BATCH_REPLACE', payload: { batchId, ...input } });
      return true;
    },
    [],
  );

  const updateStreetPurchase = useCallback<StoreContextValue['updateStreetPurchase']>(
    (purchaseId, input) => {
      const old = stateRef.current.streetPurchases.find((p) => p.id === purchaseId);
      if (!old) return false;
      const streetObject = input.streetObjectId
        ? stateRef.current.streetObjects.find((s) => s.id === input.streetObjectId)
        : null;
      if (input.streetObjectId && !streetObject) return false;
      if (
        !canUpdateStreetPurchase(stateRef.current, purchaseId, {
          streetObjectId: input.streetObjectId,
          warehouseItemId: input.warehouseItemId,
          quantity: input.quantity,
          streetPurchasePricePerUnit: input.streetPurchasePricePerUnit,
          paidAmount: input.paidAmount,
          onCredit: input.onCredit,
        })
      ) {
        return false;
      }
      dispatch({
        type: 'STREET_PURCHASE_UPDATE',
        payload: {
          id: purchaseId,
          streetObjectId: input.streetObjectId,
          streetObjectName: streetObject?.fullName ?? old.streetObjectName,
          warehouseItemId: input.warehouseItemId,
          quantity: input.quantity,
          incomeDate: input.incomeDate,
          notes: input.notes,
          streetPurchasePricePerUnit: input.streetPurchasePricePerUnit,
          paidAmount: input.paidAmount,
          onCredit: input.onCredit,
        },
      });
      return true;
    },
    [],
  );

  const updateWarehouseItem = useCallback<StoreContextValue['updateWarehouseItem']>((item) => {
    dispatch({ type: 'WAREHOUSE_UPDATE', payload: item });
  }, []);

  const addWarehouseChildQty = useCallback<StoreContextValue['addWarehouseChildQty']>((childId, delta) => {
    const child = stateRef.current.warehouseItems.find((w) => w.id === childId);
    if (!child?.parentWarehouseId) return false;
    let d = delta;
    if (child.unit === 'pcs') d = Math.floor(d);
    if (!Number.isFinite(d) || d <= 0) return false;
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

  const deleteWarehouseItem = useCallback<StoreContextValue['deleteWarehouseItem']>((id) => {
    dispatch({ type: 'WAREHOUSE_DELETE', payload: { id } });
  }, []);

  const recordOutcome = useCallback<StoreContextValue['recordOutcome']>((input) => {
    const outcome: WarehouseOutcome = {
      ...input,
      id: uid('out'),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'WAREHOUSE_OUTCOME', payload: { outcome } });
  }, []);

  const posCheckout = useCallback<StoreContextValue['posCheckout']>((input) => {
    if (!input.customerId?.trim()) return false;
    if (!canPosCheckout(stateRef.current, input)) return false;
    dispatch({ type: 'POS_CHECKOUT', payload: input });
    return true;
  }, []);

  const updatePosOrder = useCallback<StoreContextValue['updatePosOrder']>((input) => {
    if (!canPosOrderUpdate(stateRef.current, input)) return false;
    dispatch({ type: 'POS_ORDER_UPDATE', payload: input });
    return true;
  }, []);

  const deletePosOrder = useCallback<StoreContextValue['deletePosOrder']>((orderId) => {
    const oldOutcomes = soldOutcomesForOrderKey(stateRef.current.outcomes, orderId);
    if (!oldOutcomes.length) return false;
    const map = cloneWarehouseItemMap(stateRef.current.warehouseItems);
    for (const o of [...oldOutcomes].reverse()) {
      if (!restoreKgSoldOutcome(map, o)) return false;
    }
    dispatch({ type: 'POS_ORDER_DELETE', payload: { orderId } });
    return true;
  }, []);

  const addExpenseCategory = useCallback<StoreContextValue['addExpenseCategory']>((input) => {
    const name = input.name.trim();
    if (!name) return null;
    const exists = stateRef.current.expenseCategories.some(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (exists) return null;
    const category: ExpenseCategory = {
      id: uid('exc'),
      name,
      builtIn: input.builtIn ?? false,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'EXPENSE_CATEGORY_ADD', payload: category });
    return category;
  }, []);

  const updateExpenseCategory = useCallback<StoreContextValue['updateExpenseCategory']>(
    (category) => {
      const name = category.name.trim();
      if (!name) return false;
      const collision = stateRef.current.expenseCategories.some(
        (c) => c.id !== category.id && c.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (collision) return false;
      dispatch({ type: 'EXPENSE_CATEGORY_UPDATE', payload: { ...category, name } });
      return true;
    },
    [],
  );

  const deleteExpenseCategory = useCallback<StoreContextValue['deleteExpenseCategory']>((id) => {
    dispatch({ type: 'EXPENSE_CATEGORY_DELETE', payload: { id } });
  }, []);

  const addExpense = useCallback<StoreContextValue['addExpense']>((input) => {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const category = input.categoryId
      ? stateRef.current.expenseCategories.find((c) => c.id === input.categoryId) ?? null
      : null;
    const categoryName = (input.categoryName ?? category?.name ?? '').trim();
    if (!categoryName) return null;
    const expense: Expense = {
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

  const updateExpense = useCallback<StoreContextValue['updateExpense']>((expense) => {
    const prev = stateRef.current.expenses.find((e) => e.id === expense.id);
    if (!prev) return false;
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const category = expense.categoryId
      ? stateRef.current.expenseCategories.find((c) => c.id === expense.categoryId) ?? null
      : null;
    const categoryName = (expense.categoryName ?? category?.name ?? prev.categoryName).trim();
    if (!categoryName) return false;
    const next: Expense = {
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

  const deleteExpense = useCallback<StoreContextValue['deleteExpense']>((id) => {
    dispatch({ type: 'EXPENSE_DELETE', payload: { id } });
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      recordCustomerDebtRepayment,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      recordSupplierDebtRepayment,
      purchaseFromSupplier,
      purchaseLinesFromSupplier,
      deleteSupplierPurchase,
      deleteSupplierPurchaseBatch,
      replaceSupplierPurchaseBatch,
      updateSupplierPurchase,
      addStreetObject,
      updateStreetObject,
      deleteStreetObject,
      recordStreetDebtRepayment,
      purchaseLinesFromStreetObject,
      deleteStreetPurchase,
      deleteStreetPurchaseBatch,
      replaceStreetPurchaseBatch,
      updateStreetPurchase,
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
      deletePosOrder,
      addExpenseCategory,
      updateExpenseCategory,
      deleteExpenseCategory,
      addExpense,
      updateExpense,
      deleteExpense,
    }),
    [
      state,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      recordCustomerDebtRepayment,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      recordSupplierDebtRepayment,
      purchaseFromSupplier,
      purchaseLinesFromSupplier,
      deleteSupplierPurchase,
      deleteSupplierPurchaseBatch,
      replaceSupplierPurchaseBatch,
      updateSupplierPurchase,
      addStreetObject,
      updateStreetObject,
      deleteStreetObject,
      recordStreetDebtRepayment,
      purchaseLinesFromStreetObject,
      deleteStreetPurchase,
      deleteStreetPurchaseBatch,
      replaceStreetPurchaseBatch,
      updateStreetPurchase,
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
      deletePosOrder,
      addExpenseCategory,
      updateExpenseCategory,
      deleteExpenseCategory,
      addExpense,
      updateExpense,
      deleteExpense,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within SaralashProvider');
  return ctx;
}
