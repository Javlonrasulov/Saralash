import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Boxes, Package, Recycle, ShoppingCart, Users } from 'lucide-react';
import { useStore } from '../store/saralash-store';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter } from '../lib/nav-date-range';
import { useApp } from '../i18n/app-context';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { categoryLabel, categoryMeta, CategoryIconGlyph } from '../utils/category';
import { formatDate, formatKg, formatNumber } from '../utils/format';

interface KpiProps {
  title: string;
  value: string;
  unit?: string;
  icon: React.ElementType;
  iconBg: string;
  hint?: string;
}

function KpiCard({ title, value, unit, icon: Icon, iconBg, hint }: KpiProps) {
  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon size={20} className="text-white" />
        </div>
        {hint && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <ArrowUpRight size={10} />
            {hint}
          </span>
        )}
      </div>
      <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">{title}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="nums text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { state } = useStore();
  const { t } = useApp();
  const { filter: navDateFilter } = useNavDateFilter();

  const totals = useMemo(() => {
    const incoming = state.intakes
      .filter((i) => isYmdInNavFilter(i.date, navDateFilter))
      .reduce((sum, i) => sum + i.weightKg, 0);
    const sorted = state.sortedMaterials
      .filter((s) => isYmdInNavFilter(s.date, navDateFilter))
      .reduce((sum, s) => sum + s.weightKg, 0);
    const processed = state.processedBatches
      .filter((b) => isYmdInNavFilter(b.date, navDateFilter))
      .reduce((sum, b) => sum + b.weightKg, 0);
    const sold = state.outcomes
      .filter((o) => o.type === 'SOLD' && isYmdInNavFilter(o.date, navDateFilter))
      .reduce((sum, o) => sum + o.quantity, 0);
    return { incoming, sorted, processed, sold };
  }, [state, navDateFilter]);

  const totalWarehouseKg = useMemo(() => {
    let sum = 0;
    for (const w of state.warehouseItems) {
      if (w.unit === 'kg') sum += w.currentQty;
    }
    return sum;
  }, [state.warehouseItems]);

  const stockByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of state.warehouseItems) {
      if (item.unit !== 'kg') continue;
      map.set(item.category, (map.get(item.category) ?? 0) + item.currentQty);
    }
    return Array.from(map.entries())
      .map(([cat, qty]) => ({ cat, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [state.warehouseItems]);

  const warehouseStockProducts = useMemo(() => {
    const parentNameByChildId = new Map<string, string>();
    for (const w of state.warehouseItems) {
      if (!w.parentWarehouseId) continue;
      const p = state.warehouseItems.find((x) => x.id === w.parentWarehouseId);
      if (p) parentNameByChildId.set(w.id, p.productName);
    }
    return state.warehouseItems
      .filter((w) => w.unit === 'kg' && w.currentQty > 0)
      .map((w) => ({
        id: w.id,
        name: w.productName,
        parentName: parentNameByChildId.get(w.id),
        category: w.category,
        qty: w.currentQty,
      }))
      .sort((a, b) => b.qty - a.qty);
  }, [state.warehouseItems]);

  const totalStockKg = totalWarehouseKg;

  const recentActivity = useMemo(() => {
    type Item = { id: string; date: string; title: string; subtitle: string; emoji: string };
    const items: Item[] = [];

    state.intakes
      .filter((i) => isYmdInNavFilter(i.date, navDateFilter))
      .slice(0, 5)
      .forEach((i) =>
        items.push({
          id: `intk-${i.id}`,
          date: i.createdAt,
          emoji: '📥',
          title: `${t.sortingIntake}: ${i.materialName}`,
          subtitle: `${formatKg(i.weightKg)} • ${formatDate(i.date)}`,
        }),
      );

    state.processedBatches
      .filter((b) => isYmdInNavFilter(b.date, navDateFilter))
      .slice(0, 5)
      .forEach((b) =>
        items.push({
          id: `proc-${b.id}`,
          date: b.createdAt,
          emoji: '🏭',
          title: `${t.dashTotalProcessed}: ${b.productName}`,
          subtitle: `${formatKg(b.weightKg)} • ${formatDate(b.date)}`,
        }),
      );

    state.outcomes
      .filter((o) => isYmdInNavFilter(o.date, navDateFilter))
      .slice(0, 5)
      .forEach((o) =>
        items.push({
          id: `out-${o.id}`,
          date: o.createdAt,
          emoji: o.type === 'SOLD' ? '💰' : '🔧',
          title:
            o.type === 'SOLD'
              ? `${t.whSell}: ${o.productName}`
              : `${t.whUseInProduction}: ${o.productName}`,
          subtitle: `${formatNumber(o.quantity)} ${o.unit} • ${formatDate(o.date)}`,
        }),
      );

    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  }, [state, t, navDateFilter]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title={t.dashWarehouseStockKg}
          value={formatKg(totalWarehouseKg)}
          icon={Boxes}
          iconBg="bg-gradient-to-br from-violet-500 to-indigo-600"
        />
        <KpiCard
          title={t.dashTotalIncoming}
          value={formatKg(totals.incoming)}
          icon={Package}
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <KpiCard
          title={t.dashTotalSorted}
          value={formatKg(totals.sorted)}
          icon={Recycle}
          iconBg="bg-gradient-to-br from-indigo-500 to-blue-600"
        />
        <KpiCard
          title={t.dashTotalProcessed}
          value={formatKg(totals.processed)}
          icon={Boxes}
          iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <KpiCard
          title={t.dashTotalSold}
          value={formatNumber(totals.sold)}
          unit="kg/dona"
          icon={ShoppingCart}
          iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Warehouse summary */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                {t.dashWarehouseSummary}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t.total}: {formatKg(totalStockKg)}
              </p>
            </div>
            <Link
              to="/warehouse"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
            >
              {t.navWarehouse}
              <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-4 p-5">
            {warehouseStockProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                {t.dashEmpty}
              </p>
            ) : (
              <>
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {warehouseStockProducts.map((row) => {
                    const meta = categoryMeta(row.category);
                    return (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                            {row.name}
                          </p>
                          {row.parentName && (
                            <p className="truncate text-[11px] text-slate-400">
                              {row.parentName}
                            </p>
                          )}
                        </div>
                        <span className={`nums shrink-0 text-sm font-semibold ${meta.text}`}>
                          {formatKg(row.qty)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {stockByCategory.length > 0 && (
                  <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700">
                    {stockByCategory.map(({ cat, qty }) => {
                      const meta = categoryMeta(cat);
                      const pct = totalStockKg > 0 ? (qty / totalStockKg) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                              <CategoryIconGlyph category={cat} size={14} />
                              {categoryLabel(cat, t)}
                            </span>
                            <span className={`nums font-semibold ${meta.text}`}>
                              {formatKg(qty)}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${meta.bar}`}
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Recent activity */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
              {t.dashRecentActivity}
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentActivity.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                {t.dashEmpty}
              </p>
            ) : (
              recentActivity.map((it) => (
                <div key={it.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="text-lg leading-none">{it.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {it.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{it.subtitle}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Users size={20} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.navCustomers}</p>
            <p className="nums text-xl font-bold text-slate-900 dark:text-white">
              {state.customers.length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Package size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.sortingPending}</p>
            <p className="nums text-xl font-bold text-slate-900 dark:text-white">
              {
                state.intakes.filter(
                  (i) => i.status !== 'SORTED' && isYmdInNavFilter(i.date, navDateFilter),
                ).length
              }
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Boxes size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.dashTotalProcessed}</p>
            <p className="nums text-xl font-bold text-slate-900 dark:text-white">
              {state.processedBatches.filter((b) => isYmdInNavFilter(b.date, navDateFilter)).length}
              <Badge variant="muted" className="ml-2 text-[10px]">
                {t.sortingResultBatch}
              </Badge>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
