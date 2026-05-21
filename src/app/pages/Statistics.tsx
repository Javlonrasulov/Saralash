import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Receipt,
  Boxes,
  PiggyBank,
  Coins,
  Gauge,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  CalendarRange,
  Factory,
  Tag,
} from 'lucide-react';
import {
  useStore,
  type CategoryKey,
  type WarehouseItem,
  type WarehouseOutcome,
} from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter, formatYmdDisplay } from '../lib/nav-date-range';
import { Card } from '../components/ui/card';
import { categoryLabel, categoryMeta, CategoryIconGlyph } from '../utils/category';
import { formatDecimal, formatKg, formatNumber } from '../utils/format';

interface KpiTone {
  iconBg: string;
  iconText: string;
  ring: string;
  badgeBg: string;
}

const TONE_INDIGO: KpiTone = {
  iconBg: 'bg-indigo-100 dark:bg-indigo-500/15',
  iconText: 'text-indigo-600 dark:text-indigo-300',
  ring: 'ring-indigo-100 dark:ring-indigo-500/20',
  badgeBg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
};
const TONE_AMBER: KpiTone = {
  iconBg: 'bg-amber-100 dark:bg-amber-500/15',
  iconText: 'text-amber-600 dark:text-amber-300',
  ring: 'ring-amber-100 dark:ring-amber-500/20',
  badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};
const TONE_EMERALD: KpiTone = {
  iconBg: 'bg-emerald-100 dark:bg-emerald-500/15',
  iconText: 'text-emerald-600 dark:text-emerald-300',
  ring: 'ring-emerald-100 dark:ring-emerald-500/20',
  badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};
const TONE_VIOLET: KpiTone = {
  iconBg: 'bg-violet-100 dark:bg-violet-500/15',
  iconText: 'text-violet-600 dark:text-violet-300',
  ring: 'ring-violet-100 dark:ring-violet-500/20',
  badgeBg: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};
const TONE_ROSE: KpiTone = {
  iconBg: 'bg-rose-100 dark:bg-rose-500/15',
  iconText: 'text-rose-600 dark:text-rose-300',
  ring: 'ring-rose-100 dark:ring-rose-500/20',
  badgeBg: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};
const TONE_SKY: KpiTone = {
  iconBg: 'bg-sky-100 dark:bg-sky-500/15',
  iconText: 'text-sky-600 dark:text-sky-300',
  ring: 'ring-sky-100 dark:ring-sky-500/20',
  badgeBg: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
};

interface KpiCardProps {
  title: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone: KpiTone;
}

function KpiCard({ title, value, hint, icon: Icon, tone }: KpiCardProps) {
  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ring-4 ${tone.iconBg} ${tone.ring}`}
        >
          <Icon size={20} className={tone.iconText} />
        </div>
      </div>
      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className="nums truncate text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
        {value}
      </p>
      {hint && (
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </Card>
  );
}

interface MoneyRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: KpiTone;
  /** 0..100 — orqa fonda yengil progress bar */
  share?: number;
  emphasize?: boolean;
}

function MoneyRow({ icon: Icon, label, value, tone, share, emphasize }: MoneyRowProps) {
  const pct = share != null ? Math.max(0, Math.min(100, share)) : 0;
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
      {share != null && (
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 ${tone.iconBg} opacity-60 dark:opacity-40`}
          style={{ width: `${pct}%` }}
        />
      )}
      <div className="relative flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.iconBg}`}
        >
          <Icon size={16} className={tone.iconText} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
          <p
            className={`nums mt-0.5 truncate text-sm font-bold ${
              emphasize ? tone.iconText : 'text-slate-900 dark:text-white'
            }`}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

interface DailyPoint {
  ymd: string;
  revenue: number;
  profit: number;
}

function ymdAt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDailySeries(
  sold: WarehouseOutcome[],
  warehouseById: Map<string, WarehouseItem>,
  fromYmd: string,
  toYmd: string,
): DailyPoint[] {
  const start = new Date(fromYmd + 'T00:00:00');
  const end = new Date(toYmd + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const days: DailyPoint[] = [];
  const idx = new Map<string, number>();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = ymdAt(d);
    idx.set(key, days.length);
    days.push({ ymd: key, revenue: 0, profit: 0 });
  }
  /** Bir buyurtma summasi — orqaga taqsimlanmasligi uchun (`posOrderId` boʻyicha bir marta hisoblash). */
  const seenOrderRevenue = new Set<string>();
  for (const o of sold) {
    const day = (o.date ?? '').slice(0, 10);
    const i = idx.get(day);
    if (i == null) continue;
    const orderKey = `${day}:${o.posOrderId ?? o.id}`;
    if (!seenOrderRevenue.has(orderKey)) {
      seenOrderRevenue.add(orderKey);
      const orderTotal = o.orderPaidTotal ?? o.totalAmount ?? 0;
      days[i].revenue += orderTotal;
    }
    /** Foyda — har qator boʻyicha alohida (qatorning tannarxi). */
    const item = warehouseById.get(o.warehouseItemId);
    const lineCost = (item?.purchasePricePerUnit ?? 0) * o.quantity;
    const lineRevenue = o.totalAmount ?? 0;
    days[i].profit += lineRevenue - lineCost;
  }
  return days;
}

interface TrendChartProps {
  data: DailyPoint[];
  emptyLabel: string;
  bestLabel: string;
  avgLabel: string;
}

function TrendChart({ data, emptyLabel, bestLabel, avgLabel }: TrendChartProps) {
  const hasData = data.some((d) => d.revenue > 0);
  if (!hasData) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-500">
        <Activity size={20} />
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.revenue));
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const avg = total / data.length;
  const best = data.reduce((b, d) => (d.revenue > b.revenue ? d : b), data[0]);
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{bestLabel}</p>
          <p className="nums mt-0.5 text-sm font-bold text-emerald-800 dark:text-emerald-200">
            {formatNumber(best.revenue)}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
            {formatYmdDisplay(best.ymd)}
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-2.5 dark:border-sky-500/20 dark:bg-sky-500/10">
          <p className="text-[11px] font-medium text-sky-700 dark:text-sky-300">{avgLabel}</p>
          <p className="nums mt-0.5 text-sm font-bold text-sky-800 dark:text-sky-200">
            {formatNumber(avg)}
          </p>
          <p className="mt-0.5 text-[10px] text-sky-600/80 dark:text-sky-400/80">
            {data.length} {data.length === 1 ? 'kun' : 'kun'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50/70 to-white p-3 dark:border-slate-700/70 dark:from-slate-800/40 dark:to-slate-900/40">
        <div className="flex h-44 items-end gap-[3px]">
          {data.map((d, i) => {
            const h = max > 0 ? (d.revenue / max) * 100 : 0;
            const isBest = d.ymd === best.ymd && d.revenue > 0;
            return (
              <div key={d.ymd} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    isBest
                      ? 'bg-gradient-to-t from-emerald-500 to-emerald-400'
                      : d.revenue > 0
                        ? 'bg-gradient-to-t from-indigo-500 to-indigo-400 group-hover:from-indigo-600 group-hover:to-indigo-500'
                        : 'bg-slate-200/70 dark:bg-slate-700/40'
                  }`}
                  style={{ height: `${Math.max(d.revenue > 0 ? 4 : 2, h)}%` }}
                  title={`${formatYmdDisplay(d.ymd)} — ${formatNumber(d.revenue)}`}
                />
                {(i === 0 || i === data.length - 1 || i % labelStep === 0) && (
                  <span className="mt-1.5 hidden text-[9px] text-slate-400 sm:block">
                    {d.ymd.slice(8, 10)}.{d.ymd.slice(5, 7)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Statistics() {
  const { state } = useStore();
  const { t } = useApp();
  const { filter } = useNavDateFilter();

  const warehouseById = useMemo(() => {
    const m = new Map<string, WarehouseItem>();
    for (const w of state.warehouseItems) m.set(w.id, w);
    return m;
  }, [state.warehouseItems]);

  /** Davr boʻyicha sotuv (SOLD) qatorlari. */
  const soldLines = useMemo(
    () => state.outcomes.filter((o) => o.type === 'SOLD' && isYmdInNavFilter(o.date, filter)),
    [state.outcomes, filter],
  );

  /** Davr boʻyicha ko‘cha obyekti xaridlari. */
  const purchases = useMemo(
    () => state.supplierPurchases.filter((p) => isYmdInNavFilter(p.incomeDate, filter)),
    [state.supplierPurchases, filter],
  );

  /** Davr boʻyicha «Chiqim» yozuvlari. */
  const expensesInRange = useMemo(
    () => state.expenses.filter((e) => isYmdInNavFilter(e.date, filter)),
    [state.expenses, filter],
  );

  /** Asosiy moliyaviy KPI lar (revenue, COGS, chiqimlar, sof foyda, marja) — sana filtri bilan. */
  const finance = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    /** Buyurtma summasini takrorlamaslik uchun (`posOrderId` bir nechta qatorda boʻladi). */
    const orderTotals = new Map<string, number>();
    for (const o of soldLines) {
      const item = warehouseById.get(o.warehouseItemId);
      const lineCost = (item?.purchasePricePerUnit ?? 0) * o.quantity;
      cogs += lineCost;
      const lineRevenue = o.totalAmount ?? 0;
      revenue += lineRevenue;
      const orderKey = o.posOrderId ?? o.id;
      orderTotals.set(orderKey, (orderTotals.get(orderKey) ?? 0) + lineRevenue);
    }
    const expensesTotal = expensesInRange.reduce(
      (s, e) => s + (e.amount > 0 && Number.isFinite(e.amount) ? e.amount : 0),
      0,
    );
    const profit = revenue - cogs - expensesTotal;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const orderCount = orderTotals.size;
    let avgOrder = 0;
    if (orderCount > 0) avgOrder = revenue / orderCount;
    return { revenue, cogs, expensesTotal, profit, margin, orderCount, avgOrder };
  }, [soldLines, warehouseById, expensesInRange]);

  /** Operatsiya statistikasi: faol klient/ko‘cha obyekti soni, sotilgan kg. */
  const ops = useMemo(() => {
    const customerSet = new Set<string>();
    for (const o of soldLines) if (o.customerId) customerSet.add(o.customerId);
    const supplierSet = new Set<string>();
    for (const p of purchases) if (p.supplierId) supplierSet.add(p.supplierId);
    const soldKg = soldLines.reduce((s, o) => s + (o.unit === 'kg' ? o.quantity : 0), 0);
    return {
      activeCustomers: customerSet.size,
      activeSuppliers: supplierSet.size,
      soldKg,
    };
  }, [soldLines, purchases]);

  /** Pul harakati: tushum, jami xarid, toʻlangan, qarz qoldigʻi va klientlar jami xaridi. */
  const cash = useMemo(() => {
    const totalPurchased = purchases.reduce((s, p) => s + (p.totalAmount ?? 0), 0);
    const paidToSuppliers = purchases.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
    /** Qoldiq qarz — snapshot (sana filtridan mustaqil), chunki keyingi toʻlovlar qoldiqni kamaytiradi. */
    const supplierDebt = state.supplierPurchases.reduce(
      (s, p) => s + (p.supplierDebtAmount ?? 0),
      0,
    );
    const customerSpent = state.customers.reduce((s, c) => s + (c.totalSpent ?? 0), 0);
    return { totalPurchased, paidToSuppliers, supplierDebt, customerSpent };
  }, [purchases, state.supplierPurchases, state.customers]);

  /** Sana oraligʻi — diagramma uchun: filter range boʻlsa shuni, aks holda oxirgi 30 kun. */
  const chartRange = useMemo<{ from: string; to: string }>(() => {
    const today = new Date();
    if (filter.mode === 'range') {
      const fromD = new Date(filter.from + 'T00:00:00');
      const toD = new Date(filter.to + 'T00:00:00');
      const ms = toD.getTime() - fromD.getTime();
      const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
      if (days > 60) {
        /** Filter ham juda keng boʻlsa — diagramma uchun oxirgi 60 kunni olib tashlash. */
        const cutFrom = new Date(toD);
        cutFrom.setDate(cutFrom.getDate() - 59);
        return { from: ymdAt(cutFrom > fromD ? cutFrom : fromD), to: filter.to };
      }
      return { from: filter.from, to: filter.to };
    }
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { from: ymdAt(start), to: ymdAt(today) };
  }, [filter]);

  const dailySeries = useMemo(
    () => buildDailySeries(soldLines, warehouseById, chartRange.from, chartRange.to),
    [soldLines, warehouseById, chartRange],
  );

  /** Kategoriyalar boʻyicha foyda. */
  const byCategory = useMemo(() => {
    const map = new Map<
      string,
      { cat: string; revenue: number; cogs: number; profit: number; qty: number }
    >();
    for (const o of soldLines) {
      const item = warehouseById.get(o.warehouseItemId);
      const cat = String(item?.category ?? 'other');
      const cur = map.get(cat) ?? { cat, revenue: 0, cogs: 0, profit: 0, qty: 0 };
      const lineRev = o.totalAmount ?? 0;
      const lineCost = (item?.purchasePricePerUnit ?? 0) * o.quantity;
      cur.revenue += lineRev;
      cur.cogs += lineCost;
      cur.profit += lineRev - lineCost;
      cur.qty += o.quantity;
      map.set(cat, cur);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [soldLines, warehouseById]);

  const totalCategoryRevenue = byCategory.reduce((s, x) => s + x.revenue, 0);

  /** Mahsulot boʻyicha TOP-5 (sof foyda). */
  const topProducts = useMemo(() => {
    type Row = { name: string; cat: string; revenue: number; profit: number; qty: number; orders: number };
    const map = new Map<string, Row>();
    for (const o of soldLines) {
      const item = warehouseById.get(o.warehouseItemId);
      const key = `${o.warehouseItemId}:${o.productName}`;
      const cur = map.get(key) ?? {
        name: o.productName,
        cat: String(item?.category ?? 'other'),
        revenue: 0,
        profit: 0,
        qty: 0,
        orders: 0,
      };
      const lineRev = o.totalAmount ?? 0;
      const lineCost = (item?.purchasePricePerUnit ?? 0) * o.quantity;
      cur.revenue += lineRev;
      cur.profit += lineRev - lineCost;
      cur.qty += o.quantity;
      cur.orders += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.profit - a.profit).slice(0, 5);
  }, [soldLines, warehouseById]);

  /** Klient boʻyicha TOP-5 (xarid summasi). */
  const topCustomers = useMemo(() => {
    type Row = { id: string; name: string; revenue: number; orders: number };
    const map = new Map<string, Row>();
    const ordersSeen = new Set<string>();
    for (const o of soldLines) {
      if (!o.customerId) continue;
      const cur = map.get(o.customerId) ?? {
        id: o.customerId,
        name: o.customerName ?? '—',
        revenue: 0,
        orders: 0,
      };
      cur.revenue += o.totalAmount ?? 0;
      const orderKey = `${o.customerId}:${o.posOrderId ?? o.id}`;
      if (!ordersSeen.has(orderKey)) {
        ordersSeen.add(orderKey);
        cur.orders += 1;
      }
      /** Joriy klient nomini ustun qoʻyish — agar mavjud boʻlsa. */
      const c = state.customers.find((x) => x.id === o.customerId);
      if (c) cur.name = c.fullName;
      map.set(o.customerId, cur);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [soldLines, state.customers]);

  /** Ko‘cha obyekti boʻyicha TOP-5 (xarid summasi). */
  const topSuppliers = useMemo(() => {
    type Row = {
      id: string;
      name: string;
      total: number;
      paid: number;
      debt: number;
      count: number;
    };
    const map = new Map<string, Row>();
    for (const p of purchases) {
      const id = p.supplierId ?? '__orphan__';
      const cur = map.get(id) ?? {
        id,
        name: p.supplierName || '—',
        total: 0,
        paid: 0,
        debt: 0,
        count: 0,
      };
      cur.total += p.totalAmount ?? 0;
      cur.paid += p.paidAmount ?? 0;
      cur.debt += p.supplierDebtAmount ?? 0;
      cur.count += 1;
      map.set(id, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [purchases]);

  /** Hozirgi ombor xulosasi (sana filtridan mustaqil). */
  const inventory = useMemo(() => {
    let cost = 0;
    let sale = 0;
    let lines = 0;
    for (const w of state.warehouseItems) {
      if (w.currentQty <= 0) continue;
      lines += 1;
      cost += w.currentQty * (w.purchasePricePerUnit ?? 0);
      sale += w.currentQty * (w.salePricePerUnit ?? 0);
    }
    return { cost, sale, potential: sale - cost, lines };
  }, [state.warehouseItems]);

  const periodLabel =
    filter.mode === 'all'
      ? t.statPeriodAll
      : `${formatYmdDisplay(filter.from)} — ${formatYmdDisplay(filter.to)}`;

  const heroIsLoss = finance.profit < 0;

  return (
    <div className="space-y-5">
      {/* Hero — sof foyda */}
      <Card className="relative overflow-hidden border-0 p-0 shadow-md">
        <div
          className={`relative p-5 sm:p-7 ${
            heroIsLoss
              ? 'bg-gradient-to-br from-rose-500 via-rose-500 to-orange-500'
              : 'bg-gradient-to-br from-indigo-500 via-indigo-500 to-blue-600'
          }`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/10 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
                  <CalendarRange size={12} />
                  {t.statPeriodLabel}: {periodLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur`}
                >
                  {heroIsLoss ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {formatDecimal(finance.margin, 1)}%
                </span>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/80">
                {t.statHeroLabel}
              </p>
              <p className="nums mt-1 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                {formatNumber(finance.profit)}{' '}
                <span className="text-xl font-bold text-white/85 sm:text-2xl">so'm</span>
              </p>
              <p className="mt-2 max-w-2xl text-xs text-white/85 sm:text-sm">{t.statHeroNote}</p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:gap-3 lg:w-auto lg:min-w-[320px]">
              <div className="rounded-xl bg-white/15 p-2.5 text-white backdrop-blur sm:p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/80">
                  {t.statKpiRevenue}
                </p>
                <p className="nums mt-1 text-sm font-bold sm:text-base lg:text-lg">
                  {formatNumber(finance.revenue)}
                </p>
              </div>
              <div className="rounded-xl bg-white/15 p-2.5 text-white backdrop-blur sm:p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/80">
                  {t.statKpiCogs}
                </p>
                <p className="nums mt-1 text-sm font-bold sm:text-base lg:text-lg">
                  {formatNumber(finance.cogs)}
                </p>
              </div>
              <div className="rounded-xl bg-white/15 p-2.5 text-white backdrop-blur sm:p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/80">
                  {t.statKpiExpenses}
                </p>
                <p className="nums mt-1 text-sm font-bold sm:text-base lg:text-lg">
                  {formatNumber(finance.expensesTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI: tushum, tannarx, chiqimlar, sof foyda, marja */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        <KpiCard
          title={t.statKpiRevenue}
          value={`${formatNumber(finance.revenue)} so'm`}
          hint={t.statKpiRevenueHint}
          icon={Coins}
          tone={TONE_INDIGO}
        />
        <KpiCard
          title={t.statKpiCogs}
          value={`${formatNumber(finance.cogs)} so'm`}
          hint={t.statKpiCogsHint}
          icon={Package}
          tone={TONE_AMBER}
        />
        <KpiCard
          title={t.statKpiExpenses}
          value={`${formatNumber(finance.expensesTotal)} so'm`}
          hint={t.statKpiExpensesHint}
          icon={Tag}
          tone={TONE_SKY}
        />
        <KpiCard
          title={t.statKpiProfit}
          value={`${formatNumber(finance.profit)} so'm`}
          hint={t.statKpiProfitHint}
          icon={heroIsLoss ? TrendingDown : TrendingUp}
          tone={heroIsLoss ? TONE_ROSE : TONE_EMERALD}
        />
        <KpiCard
          title={t.statKpiMargin}
          value={`${formatDecimal(finance.margin, 1)}%`}
          hint={t.statKpiMarginHint}
          icon={Gauge}
          tone={TONE_VIOLET}
        />
      </div>

      {/* Pul harakati va Operatsiyalar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                <Wallet size={16} className="text-indigo-500" />
                {t.statSectionMoney}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {t.statSectionMoneyDesc}
              </p>
            </div>
          </div>
          <div className="space-y-2.5 p-5">
            {(() => {
              const moneyMax = Math.max(
                finance.revenue,
                cash.totalPurchased,
                cash.paidToSuppliers,
                finance.expensesTotal,
                cash.supplierDebt,
                cash.customerSpent,
                1,
              );
              const share = (v: number) => (v / moneyMax) * 100;
              return (
                <>
                  <MoneyRow
                    icon={ArrowDownLeft}
                    label={t.statMoneySalesIn}
                    value={`${formatNumber(finance.revenue)} so'm`}
                    tone={TONE_EMERALD}
                    share={share(finance.revenue)}
                    emphasize
                  />
                  <MoneyRow
                    icon={ArrowUpRight}
                    label={t.statMoneyPurchases}
                    value={`${formatNumber(cash.totalPurchased)} so'm`}
                    tone={TONE_AMBER}
                    share={share(cash.totalPurchased)}
                  />
                  <MoneyRow
                    icon={Receipt}
                    label={t.statMoneyPaidSuppliers}
                    value={`${formatNumber(cash.paidToSuppliers)} so'm`}
                    tone={TONE_SKY}
                    share={share(cash.paidToSuppliers)}
                  />
                  <MoneyRow
                    icon={Tag}
                    label={t.statMoneyExpenses}
                    value={`${formatNumber(finance.expensesTotal)} so'm`}
                    tone={TONE_INDIGO}
                    share={share(finance.expensesTotal)}
                  />
                  <MoneyRow
                    icon={PiggyBank}
                    label={t.statMoneySupplierDebt}
                    value={`${formatNumber(cash.supplierDebt)} so'm`}
                    tone={TONE_ROSE}
                    share={share(cash.supplierDebt)}
                  />
                  <MoneyRow
                    icon={Users}
                    label={t.statMoneyCustomerSpent}
                    value={`${formatNumber(cash.customerSpent)} so'm`}
                    tone={TONE_VIOLET}
                    share={share(cash.customerSpent)}
                  />
                </>
              );
            })()}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                <Activity size={16} className="text-indigo-500" />
                {t.statSectionOps}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {t.statSectionOpsDesc}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <ShoppingCart size={16} />
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t.statOpsOrders}
              </p>
              <p className="nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatNumber(finance.orderCount)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Receipt size={16} />
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t.statOpsAvgOrder}
              </p>
              <p className="nums mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">
                {formatNumber(finance.avgOrder)} <span className="text-xs text-slate-400">so'm</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                <Users size={16} />
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t.statOpsActiveCustomers}
              </p>
              <p className="nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatNumber(ops.activeCustomers)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Truck size={16} />
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t.statOpsActiveSuppliers}
              </p>
              <p className="nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatNumber(ops.activeSuppliers)}
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                    <Boxes size={16} />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t.statOpsItemsSold}
                  </p>
                </div>
                <p className="nums truncate text-lg font-bold text-slate-900 dark:text-white">
                  {formatKg(ops.soldKg)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Sotuv dinamikasi */}
      <Card>
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
            <TrendingUp size={16} className="text-indigo-500" />
            {t.statSectionTrend}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {t.statSectionTrendDesc}
          </p>
        </div>
        <div className="p-5">
          <TrendChart
            data={dailySeries}
            emptyLabel={t.statTrendNoData}
            bestLabel={t.statTrendBest}
            avgLabel={t.statTrendAvg}
          />
        </div>
      </Card>

      {/* Kategoriyalar */}
      <Card>
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
            <Boxes size={16} className="text-violet-500" />
            {t.statSectionCategories}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {t.statSectionCategoriesDesc}
          </p>
        </div>
        <div className="p-5">
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              {t.statEmpty}
            </p>
          ) : (
            <div className="space-y-4">
              {byCategory.map((row) => {
                const meta = categoryMeta(row.cat as CategoryKey);
                const share =
                  totalCategoryRevenue > 0 ? (row.revenue / totalCategoryRevenue) * 100 : 0;
                const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
                const isLoss = row.profit < 0;
                return (
                  <div key={row.cat}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <CategoryIconGlyph category={row.cat as CategoryKey} size={16} />
                        <span className="truncate">{categoryLabel(row.cat as CategoryKey, t)}</span>
                        <span className="nums shrink-0 text-[10px] text-slate-400">
                          {formatKg(row.qty)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3 text-xs">
                        <span className="nums text-slate-500 dark:text-slate-400">
                          {formatNumber(row.revenue)} so'm
                        </span>
                        <span
                          className={`nums font-semibold ${
                            isLoss
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isLoss ? '−' : '+'}
                          {formatNumber(Math.abs(row.profit))}
                        </span>
                        <span
                          className={`hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline-block ${
                            isLoss
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                          }`}
                        >
                          {formatDecimal(margin, 1)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${meta.bar}`}
                        style={{ width: `${Math.max(2, share)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Top mahsulotlar / klientlar / ko‘cha obyektlari */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
              <Package size={16} className="text-amber-500" />
              {t.statSectionTopProducts}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t.statSectionTopProductsDesc}
            </p>
          </div>
          <div className="p-5">
            {topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                {t.statEmpty}
              </p>
            ) : (
              <ol className="space-y-3">
                {topProducts.map((row, i) => {
                  const meta = categoryMeta(row.cat as CategoryKey);
                  const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
                  const isLoss = row.profit < 0;
                  const maxProfit = Math.max(...topProducts.map((p) => Math.abs(p.profit)), 1);
                  const share = (Math.abs(row.profit) / maxProfit) * 100;
                  return (
                    <li key={`${row.name}-${i}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${meta.bar}`}
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-white">
                              {row.name}
                            </p>
                            <p className="nums mt-0.5 text-[10px] text-slate-400">
                              {formatKg(row.qty)} • {formatNumber(row.orders)} {t.statColOrders}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`nums text-sm font-bold ${
                              isLoss
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isLoss ? '−' : '+'}
                            {formatNumber(Math.abs(row.profit))}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatDecimal(margin, 1)}%
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isLoss ? 'bg-rose-400' : meta.bar
                          }`}
                          style={{ width: `${Math.max(2, share)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
              <Users size={16} className="text-violet-500" />
              {t.statSectionTopCustomers}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t.statSectionTopCustomersDesc}
            </p>
          </div>
          <div className="p-5">
            {topCustomers.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                {t.statEmpty}
              </p>
            ) : (
              <ol className="space-y-3">
                {topCustomers.map((row, i) => {
                  const max = Math.max(...topCustomers.map((p) => p.revenue), 1);
                  const share = (row.revenue / max) * 100;
                  return (
                    <li key={row.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-500 text-[11px] font-bold text-white">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-white">
                              {row.name}
                            </p>
                            <p className="nums mt-0.5 text-[10px] text-slate-400">
                              {formatNumber(row.orders)} {t.statColOrders}
                            </p>
                          </div>
                        </div>
                        <p className="nums shrink-0 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatNumber(row.revenue)}
                        </p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                          style={{ width: `${Math.max(2, share)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
              <Truck size={16} className="text-amber-500" />
              {t.statSectionTopSuppliers}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t.statSectionTopSuppliersDesc}
            </p>
          </div>
          <div className="p-5">
            {topSuppliers.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                {t.statEmpty}
              </p>
            ) : (
              <ol className="space-y-3">
                {topSuppliers.map((row, i) => {
                  const max = Math.max(...topSuppliers.map((p) => p.total), 1);
                  const share = (row.total / max) * 100;
                  return (
                    <li key={row.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500 text-[11px] font-bold text-white">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-white">
                              {row.name}
                            </p>
                            <p className="nums mt-0.5 text-[10px] text-slate-400">
                              {formatNumber(row.count)} {t.statColPurchases}
                              {row.debt > 0 && (
                                <>
                                  {' '}
                                  • <span className="text-rose-500">−{formatNumber(row.debt)}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <p className="nums shrink-0 text-sm font-bold text-amber-600 dark:text-amber-300">
                          {formatNumber(row.total)}
                        </p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                          style={{ width: `${Math.max(2, share)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>
      </div>

      {/* Hozirgi ombor xulosasi */}
      <Card>
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
            <Factory size={16} className="text-sky-500" />
            {t.statSectionInventory}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {t.statSectionInventoryDesc}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Coins size={16} />
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t.statInvCost}
            </p>
            <p className="nums mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">
              {formatNumber(inventory.cost)}{' '}
              <span className="text-xs text-slate-400">so'm</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
              <Receipt size={16} />
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t.statInvSale}
            </p>
            <p className="nums mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">
              {formatNumber(inventory.sale)}{' '}
              <span className="text-xs text-slate-400">so'm</span>
            </p>
          </div>
          <div
            className={`rounded-xl border p-4 ${
              inventory.potential < 0
                ? 'border-rose-100 bg-rose-50/60 dark:border-rose-500/20 dark:bg-rose-500/10'
                : 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10'
            }`}
          >
            <div
              className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${
                inventory.potential < 0
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
              }`}
            >
              {inventory.potential < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            </div>
            <p
              className={`text-[11px] font-medium ${
                inventory.potential < 0
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {t.statInvPotential}
            </p>
            <p
              className={`nums mt-1 truncate text-lg font-bold ${
                inventory.potential < 0
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {inventory.potential < 0 ? '−' : '+'}
              {formatNumber(Math.abs(inventory.potential))}{' '}
              <span className="text-xs opacity-70">so'm</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Boxes size={16} />
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t.statInvItems}
            </p>
            <p className="nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {formatNumber(inventory.lines)}
            </p>
          </div>
        </div>
      </Card>

      {/* Hisoblash ohangiga oid izoh */}
      <Card className="border-amber-100 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
            <Coins size={16} />
          </div>
          <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            {t.statHintCalc}
          </p>
        </div>
      </Card>
    </div>
  );
}
