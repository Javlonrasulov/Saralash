import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useNavDateFilter } from '../context/nav-date-range-context';
import type { NavDateFilter } from '../lib/nav-date-range';
import { isYmdInNavFilter } from '../lib/nav-date-range';
import {
  ShoppingCart,
  Users,
  History,
  Trash2,
  Pencil,
  CheckCircle2,
  ShoppingBag,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useStore,
  getAvailableKgForWarehouseSale,
  resolveOrderPaymentMethod,
  type CategoryKey,
  type Customer,
  type PosPaymentMethod,
  type WarehouseOutcome,
} from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { useAuth } from '../auth/auth-context';
import { hasPageAccess } from '../auth/types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { formatDate, formatMoneyInputDisplay, formatNumber, TODAY, uid } from '../utils/format';
import { CustomerPurchaseHistoryDialog } from '../components/CustomerPurchaseHistoryDialog';
import { PosOrderDetailDialog } from '../components/PosOrderDetailDialog';
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

function aggregateSalesStats(
  outcomes: WarehouseOutcome[],
  filter: NavDateFilter,
): { orderCount: number; totalSales: number } {
  const sold = outcomes.filter((o) => o.type === 'SOLD' && isYmdInNavFilter(o.date, filter));
  const byOrder = new Map<string, number>();
  for (const o of sold) {
    const key = o.posOrderId ?? o.id;
    byOrder.set(key, (byOrder.get(key) ?? 0) + (o.totalAmount ?? 0));
  }
  let totalSales = 0;
  for (const v of byOrder.values()) totalSales += v;
  return { orderCount: byOrder.size, totalSales };
}

interface CartLine {
  key: string;
  warehouseItemId: string;
  productName: string;
  category: CategoryKey;
  qty: number;
  price: number;
  maxQty: number;
}

export function Sales() {
  const { state, posCheckout, deletePosOrder } = useStore();
  const { t } = useApp();
  const { user } = useAuth();
  const { filter: navDateFilter } = useNavDateFilter();

  const [tab, setTab] = useState<'new' | 'clients' | 'history'>('new');

  const [saleDate, setSaleDate] = useState(TODAY);
  const [customerId, setCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productId, setProductId] = useState<string>('');
  const [addQty, setAddQty] = useState('1');
  const [addPrice, setAddPrice] = useState('');
  const [paidInput, setPaidInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('CASH');

  const [historySearch, setHistorySearch] = useState('');
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [historyOpenInEditMode, setHistoryOpenInEditMode] = useState(false);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);
  const [purchaseHistoryCustomer, setPurchaseHistoryCustomer] = useState<Customer | null>(null);

  const productSelectTriggerRef = useRef<HTMLButtonElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  /** kg: ota (zaxira yoki bolalari bor) + bola (0 qoldiq ham ota orqali sotiladi) */
  const inStock = useMemo(() => {
    const items = state.warehouseItems;
    return items.filter((w) => {
      if (w.unit !== 'kg') return false;
      if (w.parentWarehouseId) {
        const p = items.find((x) => x.id === w.parentWarehouseId);
        return Boolean(p && p.unit === 'kg');
      }
      return w.currentQty > 1e-6 || items.some((ch) => ch.parentWarehouseId === w.id && ch.unit === 'kg');
    });
  }, [state.warehouseItems]);

  /** Sotuv formasi: barcha kg mahsulotlar (kategoriyasiz, nom bo‘yicha). */
  const saleProducts = useMemo(
    () => [...inStock].sort((a, b) => a.productName.localeCompare(b.productName, 'uz')),
    [inStock],
  );

  const selectedProduct = useMemo(
    () => inStock.find((w) => w.id === productId) ?? null,
    [inStock, productId],
  );

  const stats = useMemo(
    () => aggregateSalesStats(state.outcomes, navDateFilter),
    [state.outcomes, navDateFilter],
  );

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.qty * l.price, 0),
    [cart],
  );

  /** Savatga qo‘shilmasdan: tanlangan mahsulot + miqdor + narx bo‘yicha ko‘rinish summasi */
  const draftLineSubtotal = useMemo(() => {
    if (!selectedProduct) return 0;
    const q = parseFloat(String(addQty).replace(/\s/g, '').replace(',', '.'));
    const price = parseFloat(String(addPrice).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(q) || q <= 0) return 0;
    if (!Number.isFinite(price) || price < 0) return 0;
    return q * price;
  }, [selectedProduct, addQty, addPrice]);

  const grandTotalPreview = cartTotal + draftLineSubtotal;

  const cartPaidRaw = useMemo(() => {
    const x = parseFloat(String(paidInput).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(x) ? Math.max(0, x) : 0;
  }, [paidInput]);

  const cartPaidClamped = Math.min(cartPaidRaw, cartTotal);
  const debtFromCart = Math.max(0, cartTotal - cartPaidClamped);

  const totalDebt = useMemo(
    () => state.customers.reduce((s, c) => s + (c.balanceDue > 0 ? c.balanceDue : 0), 0),
    [state.customers],
  );

  const clientsWithDebt = useMemo(
    () => state.customers.filter((c) => c.balanceDue > 0.01).length,
    [state.customers],
  );

  const customerNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of state.customers) m.set(c.id, c.fullName);
    return m;
  }, [state.customers]);

  const soldInRange = useMemo(
    () => state.outcomes.filter((o) => o.type === 'SOLD' && isYmdInNavFilter(o.date, navDateFilter)),
    [state.outcomes, navDateFilter],
  );

  const historyGroups = useMemo(() => {
    const map = new Map<string, WarehouseOutcome[]>();
    for (const o of soldInRange) {
      const k = o.posOrderId ?? o.id;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(o);
    }
    const q = historySearch.trim().toLowerCase();
    const rows = [...map.entries()].map(([orderId, lines]) => {
      const first = lines[0];
      const buyer =
        (first.customerId && customerNames.get(first.customerId)) || first.customerName || '—';
      const products = lines.map((l) => l.productName).join(', ');
      const total = lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
      const paid = first.orderPaidTotal != null ? first.orderPaidTotal : total;
      const debt = Math.max(0, total - paid);
      const method = resolveOrderPaymentMethod(first);
      const cashPaid = method === 'CASH' ? paid : 0;
      const cardPaid = method === 'CARD' ? paid : 0;
      return { orderId, lines, first, buyer, products, total, paid, debt, method, cashPaid, cardPaid };
    });
    rows.sort((a, b) => b.first.date.localeCompare(a.first.date));
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.buyer.toLowerCase().includes(q) ||
        r.products.toLowerCase().includes(q) ||
        r.orderId.toLowerCase().includes(q),
    );
  }, [soldInRange, historySearch, customerNames]);

  /** Navbar kalendari oralig‘i bo‘yicha: mahsulot kg + naqd/plastik jami */
  const periodSoldStats = useMemo(() => {
    const orderMap = new Map<string, WarehouseOutcome[]>();
    for (const o of soldInRange) {
      const k = o.posOrderId ?? o.id;
      if (!orderMap.has(k)) orderMap.set(k, []);
      orderMap.get(k)!.push(o);
    }
    const productKg = new Map<string, number>();
    let cashPaid = 0;
    let cardPaid = 0;
    let totalSales = 0;
    for (const lines of orderMap.values()) {
      const first = lines[0];
      const orderTotal = lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
      const paid =
        first.orderPaidTotal != null && Number.isFinite(first.orderPaidTotal)
          ? Math.max(0, Math.min(first.orderPaidTotal, orderTotal))
          : orderTotal;
      totalSales += orderTotal;
      if (resolveOrderPaymentMethod(first) === 'CARD') cardPaid += paid;
      else cashPaid += paid;
      for (const l of lines) {
        if (l.unit === 'kg') {
          productKg.set(l.productName, (productKg.get(l.productName) ?? 0) + l.quantity);
        }
      }
    }
    const products = [...productKg.entries()]
      .map(([name, kg]) => ({ name, kg }))
      .sort((a, b) => a.name.localeCompare(b.name, 'uz'));
    return { products, cashPaid, cardPaid, totalSales, orderCount: orderMap.size };
  }, [soldInRange]);

  const historyDetailGroup = useMemo(
    () => (historyOrderId ? historyGroups.find((g) => g.orderId === historyOrderId) ?? null : null),
    [historyOrderId, historyGroups],
  );

  const openHistoryOrder = (orderId: string, edit = false) => {
    setHistoryOrderId(orderId);
    setHistoryOpenInEditMode(edit);
  };

  const handleDeleteHistoryOrder = () => {
    if (!confirmDeleteOrderId) return;
    const ok = deletePosOrder(confirmDeleteOrderId);
    if (!ok) {
      toast.error(t.posSaleInvalid);
      return;
    }
    toast.success(t.posOrderDeleted);
    if (historyOrderId === confirmDeleteOrderId) setHistoryOrderId(null);
    setConfirmDeleteOrderId(null);
  };

  type AddLineOpts = { silent?: boolean; clearForNext?: boolean };

  const addToCart = (opts?: AddLineOpts): boolean => {
    if (!selectedProduct) {
      toast.error(t.posSelectProductFirst);
      return false;
    }
    const q = parseFloat(addQty.replace(',', '.'));
    const price = parseFloat(String(addPrice).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(q) || q <= 0) {
      toast.error(t.required + ': ' + t.quantity);
      return false;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error(t.required + ': ' + t.whPricePerUnit);
      return false;
    }
    const maxSell = getAvailableKgForWarehouseSale(state.warehouseItems, selectedProduct);
    const alreadyInCart = cart.reduce(
      (s, p) => s + (p.warehouseItemId === selectedProduct.id ? p.qty : 0),
      0,
    );
    if (alreadyInCart + q > maxSell + 1e-9) {
      toast.error(t.posSaleInvalid);
      return false;
    }
    const line: CartLine = {
      key: uid('cart'),
      warehouseItemId: selectedProduct.id,
      productName: selectedProduct.productName,
      category: selectedProduct.category,
      qty: q,
      price,
      maxQty: maxSell,
    };
    setCart((prev) => {
      const maxForId = getAvailableKgForWarehouseSale(state.warehouseItems, selectedProduct);
      const already = prev.reduce(
        (s, p) => s + (p.warehouseItemId === selectedProduct.id ? p.qty : 0),
        0,
      );
      const i = prev.findIndex(
        (p) => p.warehouseItemId === line.warehouseItemId && p.price === line.price,
      );
      if (i >= 0) {
        const next = [...prev];
        const others = already - next[i].qty;
        const capLine = Math.max(0, maxForId - others);
        const merged = next[i].qty + line.qty;
        next[i] = {
          ...next[i],
          qty: Math.min(merged, capLine),
          maxQty: maxForId,
        };
        return next;
      }
      return [...prev, line];
    });
    if (!opts?.silent) toast.success(t.add);
    if (opts?.clearForNext) {
      setProductId('');
      setAddQty('1');
      queueMicrotask(() => productSelectTriggerRef.current?.focus());
    }
    return true;
  };

  const onQtyOrPriceEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    addToCart({ silent: true, clearForNext: true });
  };

  const removeLine = (key: string) => setCart((c) => c.filter((x) => x.key !== key));

  const confirmSale = () => {
    if (!cart.length) {
      toast.error(t.posCartEmpty);
      return;
    }
    if (!customerId.trim()) {
      toast.error(t.posCustomerRequired);
      return;
    }
    const cust = state.customers.find((c) => c.id === customerId);
    if (!cust) {
      toast.error(t.posCustomerRequired);
      return;
    }
    const orderTotal = cartTotal;
    const paid = Math.min(cartPaidRaw, orderTotal);
    const ok = posCheckout({
      date: saleDate,
      customerId: cust.id,
      customerName: cust.fullName,
      paidAmount: paid,
      paymentMethod,
      lines: cart.map((l) => ({
        warehouseItemId: l.warehouseItemId,
        quantity: l.qty,
        pricePerUnit: l.price,
      })),
    });
    if (!ok) {
      toast.error(t.posSaleInvalid);
      return;
    }
    toast.success(t.posConfirmSale);
    setCart([]);
    setAddQty('1');
    setAddPrice('');
    setPaidInput('');
  };

  useEffect(() => {
    if (cart.length === 0) {
      setPaidInput('');
      return;
    }
    setPaidInput(formatMoneyInputDisplay(String(Math.round(cartTotal))));
  }, [cart.length, cartTotal]);

  const syncPaidWithCartTotal = useCallback(() => {
    setPaidInput(formatMoneyInputDisplay(String(Math.round(cartTotal))));
  }, [cartTotal]);

  /** Tanlangan mahsulot ro‘yxatdan chiqsa — tanlovni tozalash */
  useEffect(() => {
    if (productId && !inStock.some((w) => w.id === productId)) setProductId('');
  }, [inStock, productId]);

  /** Omborda saqlangan sotish narxi bo'lsa — sotuv formasiga avtomatik */
  useEffect(() => {
    const p = inStock.find((w) => w.id === productId);
    if (p?.salePricePerUnit != null && Number.isFinite(p.salePricePerUnit) && p.salePricePerUnit >= 0) {
      const sp = p.salePricePerUnit;
      if (Math.abs(sp - Math.round(sp)) < 1e-6) {
        setAddPrice(formatMoneyInputDisplay(String(Math.round(sp))));
      } else {
        setAddPrice(String(sp).replace('.', ','));
      }
    } else {
      setAddPrice('');
    }
  }, [productId, inStock]);

  const canWarehouse = user && hasPageAccess(user, 'warehouse');

  return (
    <div className="space-y-4">
      {canWarehouse && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link to="/warehouse">{t.navWarehouse}</Link>
          </Button>
        </div>
      )}

      {/* Stat kartalar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-200/80 p-4 shadow-sm dark:border-slate-700">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.posStatTotalSales}</p>
          <p className="nums mt-1 text-xl font-bold text-slate-900 dark:text-white">
            {formatNumber(stats.totalSales)} so'm
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {stats.orderCount} {t.posStatOperations}
          </p>
        </Card>
        <Card className="border-slate-200/80 p-4 shadow-sm dark:border-slate-700">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.posStatTotalDebt}</p>
          <p className="nums mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
            {formatNumber(totalDebt)} so'm
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {clientsWithDebt} {t.posStatDebtClients}
          </p>
        </Card>
        <Card className="border-slate-200/80 p-4 shadow-sm dark:border-slate-700">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.posKgOnlyTitle}</p>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">kg</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t.posKgOnlyNote}
          </p>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-slate-100/90 p-1 dark:bg-slate-800">
          <TabsTrigger
            value="new"
            className="rounded-xl py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
          >
            <ShoppingCart size={16} className="mr-1.5 shrink-0" />
            <span className="truncate text-xs sm:text-sm">{t.posTabNewSale}</span>
          </TabsTrigger>
          <TabsTrigger
            value="clients"
            className="rounded-xl py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
          >
            <Users size={16} className="mr-1.5 shrink-0" />
            <span className="truncate text-xs sm:text-sm">{t.posTabClients}</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-xl py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
          >
            <History size={16} className="mr-1.5 shrink-0" />
            <span className="truncate text-xs sm:text-sm">{t.posTabHistory}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4 space-y-4 outline-none">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Chap: sotuv paneli */}
            <div className="space-y-4">
              <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t.posClientDate}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  <div>
                    <Label className="text-xs">{t.date}</Label>
                    <Input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                </div>
              </Card>

              <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{t.posAddProduct}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">{t.posProductSelect}</Label>
                    <Select
                      value={productId ? productId : undefined}
                      onValueChange={setProductId}
                      disabled={!saleProducts.length}
                    >
                      <SelectTrigger ref={productSelectTriggerRef} className="mt-1.5 rounded-xl">
                        <SelectValue placeholder={t.posSelectProductFirst} />
                      </SelectTrigger>
                      <SelectContent>
                        {saleProducts.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.productName} ({formatNumber(w.currentQty)} kg)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">
                      {t.quantity} (kg)
                    </Label>
                    <Input
                      ref={qtyInputRef}
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      onKeyDown={onQtyOrPriceEnter}
                      className="mt-1.5 rounded-xl"
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t.posPricePerKg}</Label>
                    <Input
                      value={addPrice}
                      onChange={(e) => setAddPrice(formatMoneyInputDisplay(e.target.value))}
                      onKeyDown={onQtyOrPriceEnter}
                      className="mt-1.5 rounded-xl"
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {t.posAddLineEnterHint}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 rounded-xl"
                    onClick={() => addToCart({ silent: true, clearForNext: true })}
                  >
                    {t.posAddToCart}
                  </Button>
                </div>
              </Card>

              <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{t.posCart}</h3>
                {cart.length === 0 ? (
                  <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-600">
                    <ShoppingBag className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="mt-2 text-sm text-slate-400">{t.posCartEmpty}</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {cart.map((line) => (
                      <div
                        key={line.key}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-white">
                            {line.productName}
                          </p>
                          <p className="nums text-[11px] text-slate-500">
                            {formatNumber(line.qty)} kg × {formatNumber(line.price)} —{' '}
                            {formatNumber(line.qty * line.price)} so'm
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-slate-400 hover:text-red-600"
                          onClick={() => removeLine(line.key)}
                          aria-label={t.posRemove}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{t.posPayment}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.posPaymentDebtHint}</p>
                <div className="mt-3">
                  <Label className="text-xs">{t.posPaymentMethod}</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                      className={`h-10 rounded-xl ${paymentMethod === 'CASH' ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
                      onClick={() => setPaymentMethod('CASH')}
                      disabled={!cart.length}
                    >
                      <Banknote size={16} className="mr-1.5 shrink-0" />
                      {t.posPaymentCash}
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'CARD' ? 'default' : 'outline'}
                      className={`h-10 rounded-xl ${paymentMethod === 'CARD' ? 'bg-violet-500 hover:bg-violet-600' : ''}`}
                      onClick={() => setPaymentMethod('CARD')}
                      disabled={!cart.length}
                    >
                      <CreditCard size={16} className="mr-1.5 shrink-0" />
                      {t.posPaymentCard}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">{t.posCheckoutTotal}</Label>
                    <p className="nums mt-2 text-lg font-bold text-slate-900 dark:text-white">
                      {formatNumber(cartTotal)} so'm
                    </p>
                    {draftLineSubtotal > 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {t.posTotalDraft}: +{formatNumber(draftLineSubtotal)} ({t.posDraftNotInCheckout})
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">{t.posPaidLabel}</Label>
                    <Input
                      value={paidInput}
                      onChange={(e) => setPaidInput(formatMoneyInputDisplay(e.target.value))}
                      className="mt-1.5 rounded-xl"
                      inputMode="numeric"
                      placeholder="0"
                      disabled={!cart.length}
                    />
                    <button
                      type="button"
                      onClick={syncPaidWithCartTotal}
                      disabled={!cart.length}
                      className="mt-1 text-[11px] text-sky-600 hover:underline disabled:opacity-40 dark:text-sky-400"
                    >
                      = {t.posCheckoutTotal}
                    </button>
                  </div>
                  <div>
                    <Label className="text-xs">{t.posDebtLabel}</Label>
                    <p className="nums mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-lg font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {formatNumber(debtFromCart)} so'm
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
                  <Label className="text-xs text-slate-500">{t.total} ({t.posPreviewWithDraft})</Label>
                  <p className="nums mt-1 text-xl font-bold text-slate-800 dark:text-white">
                    {formatNumber(grandTotalPreview)} so'm
                  </p>
                </div>
                <Button
                  type="button"
                  className="mt-4 h-11 w-full rounded-xl bg-sky-500 text-base font-semibold hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
                  onClick={confirmSale}
                  disabled={!cart.length}
                >
                  {t.posConfirmSale}
                </Button>
              </Card>
            </div>

            {/* O‘ng: zaxira + klientlar */}
            <div className="space-y-4">
              <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t.posAvailableProducts}
                </h3>
                <div className="mt-3 max-h-[min(60vh,520px)] space-y-3 overflow-y-auto pr-1">
                  {inStock.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">{t.posNoKgStock}</p>
                  ) : (
                    inStock.map((w) => {
                      const q = Math.max(0, w.currentQty);
                      const pct =
                        w.initialQty > 0
                          ? Math.min(100, Math.round((q / w.initialQty) * 100))
                          : q > 0
                            ? 100
                            : 0;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            setTab('new');
                            setProductId(w.id);
                            queueMicrotask(() => {
                              qtyInputRef.current?.focus();
                              qtyInputRef.current?.select();
                            });
                          }}
                          className="block w-full rounded-xl border border-slate-100 bg-white p-3 text-left transition-colors hover:border-sky-200 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-900"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-slate-800 dark:text-white">
                              {w.productName}
                            </span>
                            <span className="nums shrink-0 text-xs text-slate-500">
                              {formatNumber(q)} kg
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-full rounded-full transition-all ${q <= 1e-6 ? 'bg-teal-500/50' : 'bg-violet-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </Card>

              <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t.posClientsSidebar}
                </h3>
                <div className="mt-3 space-y-2">
                  {state.customers.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-xs dark:border-slate-700"
                    >
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {c.fullName}
                      </span>
                      {c.balanceDue > 0.01 ? (
                        <span className="nums shrink-0 font-medium text-amber-600 dark:text-amber-400">
                          {formatNumber(c.balanceDue)} so'm
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={12} />
                          {t.posNoDebt}
                        </span>
                      )}
                    </div>
                  ))}
                  {state.customers.length === 0 && (
                    <p className="text-center text-xs text-slate-400">{t.noData}</p>
                  )}
                  <Button variant="outline" size="sm" className="mt-2 w-full rounded-xl" asChild>
                    <Link to="/customers">{t.custTitle}</Link>
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="clients" className="mt-4 outline-none">
          <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{t.custTitle}</h3>
              <Button asChild className="rounded-xl bg-sky-500 hover:bg-sky-600">
                <Link to="/customers">{t.custAddCustomer}</Link>
              </Button>
            </div>
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.custName}</TableHead>
                  <TableHead>{t.custPhone}</TableHead>
                  <TableHead className="text-right">{t.custTotalSpent}</TableHead>
                  <TableHead className="text-right">{t.posDebtLabel}</TableHead>
                  <TableHead className="w-28 text-center">{t.custPurchaseHistory}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.customers.length === 0 ? (
                  <TableEmpty colSpan={5} message={t.noData} />
                ) : (
                  state.customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.fullName}</TableCell>
                      <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                      <TableCell className="nums text-right text-emerald-600 dark:text-emerald-400">
                        {formatNumber(c.totalSpent)} so'm
                      </TableCell>
                      <TableCell
                        className={`nums text-right ${c.balanceDue > 0.01 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}
                      >
                        {formatNumber(c.balanceDue)} so'm
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => setPurchaseHistoryCustomer(c)}
                          aria-label={t.custPurchaseHistory}
                        >
                          <History size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3 outline-none">
          <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
            <Input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder={t.posHistorySearch}
              className="max-w-md rounded-xl"
            />
          </Card>
          {periodSoldStats.orderCount > 0 && (
            <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-700">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                    {t.posPeriodProductSummary}
                  </h3>
                  <ul className="mt-3 space-y-1.5">
                    {periodSoldStats.products.map((p) => (
                      <li
                        key={p.name}
                        className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <span className="min-w-0 truncate">{p.name}</span>
                        <span className="nums shrink-0 font-medium">{formatNumber(p.kg)} kg</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                    {t.posPeriodPaymentSummary}
                  </h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-sky-50/60 px-3 py-2 dark:border-slate-700 dark:bg-sky-950/20">
                      <span className="text-sm text-slate-600 dark:text-slate-300">{t.posHistoryPaidCash}</span>
                      <span className="nums font-semibold text-sky-700 dark:text-sky-300">
                        {formatNumber(periodSoldStats.cashPaid)} so'm
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-violet-50/60 px-3 py-2 dark:border-slate-700 dark:bg-violet-950/20">
                      <span className="text-sm text-slate-600 dark:text-slate-300">{t.posHistoryPaidCard}</span>
                      <span className="nums font-semibold text-violet-700 dark:text-violet-300">
                        {formatNumber(periodSoldStats.cardPaid)} so'm
                      </span>
                    </div>
                    <p className="pt-1 text-[11px] text-slate-400">
                      {periodSoldStats.orderCount} {t.posStatOperations} · {formatNumber(periodSoldStats.totalSales)} so'm
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}
          <Card className="hidden overflow-hidden border-slate-200 shadow-sm dark:border-slate-700 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.whBuyer}</TableHead>
                  <TableHead>{t.whProductName}</TableHead>
                  <TableHead className="text-right">{t.salesAmount}</TableHead>
                  <TableHead className="text-right">{t.posHistoryPaidCash}</TableHead>
                  <TableHead className="text-right">{t.posHistoryPaidCard}</TableHead>
                  <TableHead className="text-right">{t.posDebtLabel}</TableHead>
                  <TableHead className="w-[5.5rem] text-right">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyGroups.length === 0 ? (
                  <TableEmpty colSpan={8} message={t.posNoHistory} />
                ) : (
                  historyGroups.map((g) => (
                    <TableRow
                      key={g.orderId}
                      className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                      tabIndex={0}
                      role="button"
                      onClick={() => openHistoryOrder(g.orderId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openHistoryOrder(g.orderId);
                        }
                      }}
                    >
                      <TableCell className="whitespace-nowrap text-xs">{formatDate(g.first.date)}</TableCell>
                      <TableCell className="max-w-[10rem] truncate">{g.buyer}</TableCell>
                      <TableCell className="max-w-[20rem] truncate text-sm">{g.products}</TableCell>
                      <TableCell className="nums text-right font-medium">
                        {formatNumber(g.total)} so'm
                      </TableCell>
                      <TableCell className="nums text-right text-sky-700 dark:text-sky-300">
                        {g.cashPaid > 0.01 ? `${formatNumber(g.cashPaid)} so'm` : '—'}
                      </TableCell>
                      <TableCell className="nums text-right text-violet-700 dark:text-violet-300">
                        {g.cardPaid > 0.01 ? `${formatNumber(g.cardPaid)} so'm` : '—'}
                      </TableCell>
                      <TableCell
                        className={`nums text-right ${g.debt > 0.01 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}
                      >
                        {formatNumber(g.debt)} so'm
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-sky-600"
                            aria-label={t.posEditOrder}
                            onClick={() => openHistoryOrder(g.orderId, true)}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                            aria-label={t.delete}
                            onClick={() => setConfirmDeleteOrderId(g.orderId)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
          <div className="space-y-2 md:hidden">
            {historyGroups.length === 0 ? (
              <Card className="p-6 text-center text-sm text-slate-400">{t.posNoHistory}</Card>
            ) : (
              historyGroups.map((g) => (
                <Card
                  key={g.orderId}
                  className="cursor-pointer p-3 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                  tabIndex={0}
                  role="button"
                  onClick={() => openHistoryOrder(g.orderId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openHistoryOrder(g.orderId);
                    }
                  }}
                >
                  <div
                    className="mb-2 flex justify-end gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500"
                      aria-label={t.posEditOrder}
                      onClick={() => openHistoryOrder(g.orderId, true)}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-600"
                      aria-label={t.delete}
                      onClick={() => setConfirmDeleteOrderId(g.orderId)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(g.first.date)}</p>
                  <p className="mt-1 font-medium text-slate-800 dark:text-white">{g.buyer}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{g.products}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t.salesAmount}</span>
                      <span className="nums font-semibold">{formatNumber(g.total)} so'm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t.posHistoryPaidCash}</span>
                      <span className="nums text-sky-700 dark:text-sky-300">
                        {g.cashPaid > 0.01 ? `${formatNumber(g.cashPaid)} so'm` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t.posHistoryPaidCard}</span>
                      <span className="nums text-violet-700 dark:text-violet-300">
                        {g.cardPaid > 0.01 ? `${formatNumber(g.cardPaid)} so'm` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t.posDebtLabel}</span>
                      <span
                        className={`nums ${g.debt > 0.01 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}
                      >
                        {formatNumber(g.debt)} so'm
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CustomerPurchaseHistoryDialog
        customer={purchaseHistoryCustomer}
        outcomes={state.outcomes}
        open={!!purchaseHistoryCustomer}
        onOpenChange={(o) => {
          if (!o) setPurchaseHistoryCustomer(null);
        }}
      />

      <PosOrderDetailDialog
        orderId={historyDetailGroup?.orderId ?? ''}
        lines={historyDetailGroup?.lines ?? []}
        open={Boolean(historyOrderId && historyDetailGroup)}
        initialEditMode={historyOpenInEditMode}
        onOpenChange={(o) => {
          if (!o) {
            setHistoryOrderId(null);
            setHistoryOpenInEditMode(false);
          }
        }}
      />

      <AlertDialog
        open={!!confirmDeleteOrderId}
        onOpenChange={(o) => !o && setConfirmDeleteOrderId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
            <AlertDialogDescription>{t.posDeleteOrderConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteHistoryOrder}>{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
