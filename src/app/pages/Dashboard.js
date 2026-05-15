import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Boxes, Package, Recycle, ShoppingCart, Users } from 'lucide-react';
import { useStore } from '../store/saralash-store';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter } from '../lib/nav-date-range';
import { useApp } from '../i18n/app-context';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { categoryLabel, categoryMeta } from '../utils/category';
import { formatDate, formatKg, formatNumber } from '../utils/format';
function KpiCard({ title, value, unit, icon: Icon, iconBg, hint }) {
    return (_jsxs(Card, { className: "p-5 transition-shadow hover:shadow-md", children: [_jsxs("div", { className: "mb-4 flex items-start justify-between", children: [_jsx("div", { className: `flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`, children: _jsx(Icon, { size: 20, className: "text-white" }) }), hint && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", children: [_jsx(ArrowUpRight, { size: 10 }), hint] }))] }), _jsx("p", { className: "mb-1 text-xs text-slate-500 dark:text-slate-400", children: title }), _jsxs("div", { className: "flex items-baseline gap-1.5", children: [_jsx("span", { className: "nums text-2xl font-bold text-slate-900 dark:text-white", children: value }), unit && _jsx("span", { className: "text-sm text-slate-400", children: unit })] })] }));
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
    const stockByCategory = useMemo(() => {
        const map = new Map();
        for (const item of state.warehouseItems) {
            if (item.unit !== 'kg')
                continue;
            map.set(item.category, (map.get(item.category) ?? 0) + item.currentQty);
        }
        return Array.from(map.entries())
            .map(([cat, qty]) => ({ cat, qty }))
            .sort((a, b) => b.qty - a.qty);
    }, [state.warehouseItems]);
    const totalStockKg = stockByCategory.reduce((sum, r) => sum + r.qty, 0);
    const recentActivity = useMemo(() => {
        const items = [];
        state.intakes
            .filter((i) => isYmdInNavFilter(i.date, navDateFilter))
            .slice(0, 5)
            .forEach((i) => items.push({
            id: `intk-${i.id}`,
            date: i.createdAt,
            emoji: '📥',
            title: `${t.sortingIntake}: ${i.materialName}`,
            subtitle: `${formatKg(i.weightKg)} • ${formatDate(i.date)}`,
        }));
        state.processedBatches
            .filter((b) => isYmdInNavFilter(b.date, navDateFilter))
            .slice(0, 5)
            .forEach((b) => items.push({
            id: `proc-${b.id}`,
            date: b.createdAt,
            emoji: '🏭',
            title: `${t.dashTotalProcessed}: ${b.productName}`,
            subtitle: `${formatKg(b.weightKg)} • ${formatDate(b.date)}`,
        }));
        state.outcomes
            .filter((o) => isYmdInNavFilter(o.date, navDateFilter))
            .slice(0, 5)
            .forEach((o) => items.push({
            id: `out-${o.id}`,
            date: o.createdAt,
            emoji: o.type === 'SOLD' ? '💰' : '🔧',
            title: o.type === 'SOLD'
                ? `${t.whSell}: ${o.productName}`
                : `${t.whUseInProduction}: ${o.productName}`,
            subtitle: `${formatNumber(o.quantity)} ${o.unit} • ${formatDate(o.date)}`,
        }));
        return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
    }, [state, t, navDateFilter]);
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4", children: [_jsx(KpiCard, { title: t.dashTotalIncoming, value: formatKg(totals.incoming), icon: Package, iconBg: "bg-gradient-to-br from-blue-500 to-blue-600" }), _jsx(KpiCard, { title: t.dashTotalSorted, value: formatKg(totals.sorted), icon: Recycle, iconBg: "bg-gradient-to-br from-indigo-500 to-blue-600" }), _jsx(KpiCard, { title: t.dashTotalProcessed, value: formatKg(totals.processed), icon: Boxes, iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600" }), _jsx(KpiCard, { title: t.dashTotalSold, value: formatNumber(totals.sold), unit: "kg/dona", icon: ShoppingCart, iconBg: "bg-gradient-to-br from-amber-500 to-orange-600" })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-3", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.dashWarehouseSummary }), _jsxs("p", { className: "mt-0.5 text-xs text-slate-500 dark:text-slate-400", children: [t.total, ": ", formatKg(totalStockKg)] })] }), _jsxs(Link, { to: "/warehouse", className: "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20", children: [t.navWarehouse, _jsx(ArrowUpRight, { size: 12 })] })] }), _jsx("div", { className: "space-y-3 p-5", children: stockByCategory.length === 0 ? (_jsx("p", { className: "py-8 text-center text-sm text-slate-400 dark:text-slate-500", children: t.dashEmpty })) : (stockByCategory.map(({ cat, qty }) => {
                                    const meta = categoryMeta(cat);
                                    const pct = totalStockKg > 0 ? (qty / totalStockKg) * 100 : 0;
                                    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-1.5 flex items-center justify-between text-xs", children: [_jsxs("span", { className: "flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300", children: [_jsx("span", { children: meta.emoji }), categoryLabel(cat, t)] }), _jsx("span", { className: `nums font-semibold ${meta.text}`, children: formatKg(qty) })] }), _jsx("div", { className: "h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700", children: _jsx("div", { className: `h-full rounded-full transition-all duration-500 ${meta.bar}`, style: { width: `${Math.max(2, pct)}%` } }) })] }, cat));
                                })) })] }), _jsxs(Card, { children: [_jsx("div", { className: "border-b border-slate-100 px-5 py-4 dark:border-slate-700", children: _jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.dashRecentActivity }) }), _jsx("div", { className: "divide-y divide-slate-100 dark:divide-slate-700", children: recentActivity.length === 0 ? (_jsx("p", { className: "px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500", children: t.dashEmpty })) : (recentActivity.map((it) => (_jsxs("div", { className: "flex items-start gap-3 px-5 py-3", children: [_jsx("span", { className: "text-lg leading-none", children: it.emoji }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-medium text-slate-700 dark:text-slate-200", children: it.title }), _jsx("p", { className: "mt-0.5 truncate text-xs text-slate-400", children: it.subtitle })] })] }, it.id)))) })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-3", children: [_jsxs(Card, { className: "flex items-center gap-4 p-5", children: [_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30", children: _jsx(Users, { size: 20, className: "text-violet-600 dark:text-violet-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: t.navCustomers }), _jsx("p", { className: "nums text-xl font-bold text-slate-900 dark:text-white", children: state.customers.length })] })] }), _jsxs(Card, { className: "flex items-center gap-4 p-5", children: [_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30", children: _jsx(Package, { size: 20, className: "text-blue-600 dark:text-blue-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: t.sortingPending }), _jsx("p", { className: "nums text-xl font-bold text-slate-900 dark:text-white", children: state.intakes.filter((i) => i.status !== 'SORTED' && isYmdInNavFilter(i.date, navDateFilter)).length })] })] }), _jsxs(Card, { className: "flex items-center gap-4 p-5", children: [_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30", children: _jsx(Boxes, { size: 20, className: "text-emerald-600 dark:text-emerald-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: t.dashTotalProcessed }), _jsxs("p", { className: "nums text-xl font-bold text-slate-900 dark:text-white", children: [state.processedBatches.filter((b) => isYmdInNavFilter(b.date, navDateFilter)).length, _jsx(Badge, { variant: "muted", className: "ml-2 text-[10px]", children: t.sortingResultBatch })] })] })] })] })] }));
}
