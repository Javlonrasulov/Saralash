import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter } from '../lib/nav-date-range';
import { ShoppingCart, Users, History, Trash2, Pencil, CheckCircle2, ShoppingBag, } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, getAvailableKgForWarehouseSale, } from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { useAuth } from '../auth/auth-context';
import { hasPageAccess } from '../auth/types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, } from '../components/ui/table';
import { formatDate, formatMoneyInputDisplay, formatNumber, TODAY, uid } from '../utils/format';
import { CustomerPurchaseHistoryDialog } from '../components/CustomerPurchaseHistoryDialog';
import { PosOrderDetailDialog } from '../components/PosOrderDetailDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '../components/ui/alert-dialog';
function aggregateSalesStats(outcomes, filter) {
    const sold = outcomes.filter((o) => o.type === 'SOLD' && isYmdInNavFilter(o.date, filter));
    const byOrder = new Map();
    for (const o of sold) {
        const key = o.posOrderId ?? o.id;
        byOrder.set(key, (byOrder.get(key) ?? 0) + (o.totalAmount ?? 0));
    }
    let totalSales = 0;
    for (const v of byOrder.values())
        totalSales += v;
    return { orderCount: byOrder.size, totalSales };
}
export function Sales() {
    const { state, posCheckout, deletePosOrder } = useStore();
    const { t } = useApp();
    const { user } = useAuth();
    const { filter: navDateFilter } = useNavDateFilter();
    const [tab, setTab] = useState('new');
    const [saleDate, setSaleDate] = useState(TODAY);
    const [customerId, setCustomerId] = useState('');
    const [cart, setCart] = useState([]);
    const [productId, setProductId] = useState('');
    const [addQty, setAddQty] = useState('1');
    const [addPrice, setAddPrice] = useState('');
    const [paidInput, setPaidInput] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    const [historyOrderId, setHistoryOrderId] = useState(null);
    const [historyOpenInEditMode, setHistoryOpenInEditMode] = useState(false);
    const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState(null);
    const [purchaseHistoryCustomer, setPurchaseHistoryCustomer] = useState(null);
    const productSelectTriggerRef = useRef(null);
    const qtyInputRef = useRef(null);
    /** kg: ota (zaxira yoki bolalari bor) + bola (0 qoldiq ham ota orqali sotiladi) */
    const inStock = useMemo(() => {
        const items = state.warehouseItems;
        return items.filter((w) => {
            if (w.unit !== 'kg')
                return false;
            if (w.parentWarehouseId) {
                const p = items.find((x) => x.id === w.parentWarehouseId);
                return Boolean(p && p.unit === 'kg');
            }
            return w.currentQty > 1e-6 || items.some((ch) => ch.parentWarehouseId === w.id && ch.unit === 'kg');
        });
    }, [state.warehouseItems]);
    /** Sotuv formasi: barcha kg mahsulotlar (kategoriyasiz, nom bo‘yicha). */
    const saleProducts = useMemo(() => [...inStock].sort((a, b) => a.productName.localeCompare(b.productName, 'uz')), [inStock]);
    const selectedProduct = useMemo(() => inStock.find((w) => w.id === productId) ?? null, [inStock, productId]);
    const stats = useMemo(() => aggregateSalesStats(state.outcomes, navDateFilter), [state.outcomes, navDateFilter]);
    const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.qty * l.price, 0), [cart]);
    /** Savatga qo‘shilmasdan: tanlangan mahsulot + miqdor + narx bo‘yicha ko‘rinish summasi */
    const draftLineSubtotal = useMemo(() => {
        if (!selectedProduct)
            return 0;
        const q = parseFloat(String(addQty).replace(/\s/g, '').replace(',', '.'));
        const price = parseFloat(String(addPrice).replace(/\s/g, '').replace(',', '.'));
        if (!Number.isFinite(q) || q <= 0)
            return 0;
        if (!Number.isFinite(price) || price < 0)
            return 0;
        return q * price;
    }, [selectedProduct, addQty, addPrice]);
    const grandTotalPreview = cartTotal + draftLineSubtotal;
    const cartPaidRaw = useMemo(() => {
        const x = parseFloat(String(paidInput).replace(/\s/g, '').replace(',', '.'));
        return Number.isFinite(x) ? Math.max(0, x) : 0;
    }, [paidInput]);
    const cartPaidClamped = Math.min(cartPaidRaw, cartTotal);
    const debtFromCart = Math.max(0, cartTotal - cartPaidClamped);
    const totalDebt = useMemo(() => state.customers.reduce((s, c) => s + (c.balanceDue > 0 ? c.balanceDue : 0), 0), [state.customers]);
    const clientsWithDebt = useMemo(() => state.customers.filter((c) => c.balanceDue > 0.01).length, [state.customers]);
    const customerNames = useMemo(() => {
        const m = new Map();
        for (const c of state.customers)
            m.set(c.id, c.fullName);
        return m;
    }, [state.customers]);
    const soldInRange = useMemo(() => state.outcomes.filter((o) => o.type === 'SOLD' && isYmdInNavFilter(o.date, navDateFilter)), [state.outcomes, navDateFilter]);
    const historyGroups = useMemo(() => {
        const map = new Map();
        for (const o of soldInRange) {
            const k = o.posOrderId ?? o.id;
            if (!map.has(k))
                map.set(k, []);
            map.get(k).push(o);
        }
        const q = historySearch.trim().toLowerCase();
        const rows = [...map.entries()].map(([orderId, lines]) => {
            const first = lines[0];
            const buyer = (first.customerId && customerNames.get(first.customerId)) || first.customerName || '—';
            const products = lines.map((l) => l.productName).join(', ');
            const total = lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
            const paid = first.orderPaidTotal != null ? first.orderPaidTotal : total;
            const debt = Math.max(0, total - paid);
            return { orderId, lines, first, buyer, products, total, paid, debt };
        });
        rows.sort((a, b) => b.first.date.localeCompare(a.first.date));
        if (!q)
            return rows;
        return rows.filter((r) => r.buyer.toLowerCase().includes(q) ||
            r.products.toLowerCase().includes(q) ||
            r.orderId.toLowerCase().includes(q));
    }, [soldInRange, historySearch, customerNames]);
    const historyDetailGroup = useMemo(() => (historyOrderId ? historyGroups.find((g) => g.orderId === historyOrderId) ?? null : null), [historyOrderId, historyGroups]);
    const openHistoryOrder = (orderId, edit = false) => {
        setHistoryOrderId(orderId);
        setHistoryOpenInEditMode(edit);
    };
    const handleDeleteHistoryOrder = () => {
        if (!confirmDeleteOrderId)
            return;
        const ok = deletePosOrder(confirmDeleteOrderId);
        if (!ok) {
            toast.error(t.posSaleInvalid);
            return;
        }
        toast.success(t.posOrderDeleted);
        if (historyOrderId === confirmDeleteOrderId)
            setHistoryOrderId(null);
        setConfirmDeleteOrderId(null);
    };
    const addToCart = (opts) => {
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
        const alreadyInCart = cart.reduce((s, p) => s + (p.warehouseItemId === selectedProduct.id ? p.qty : 0), 0);
        if (alreadyInCart + q > maxSell + 1e-9) {
            toast.error(t.posSaleInvalid);
            return false;
        }
        const line = {
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
            const already = prev.reduce((s, p) => s + (p.warehouseItemId === selectedProduct.id ? p.qty : 0), 0);
            const i = prev.findIndex((p) => p.warehouseItemId === line.warehouseItemId && p.price === line.price);
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
        if (!opts?.silent)
            toast.success(t.add);
        if (opts?.clearForNext) {
            setProductId('');
            setAddQty('1');
            queueMicrotask(() => productSelectTriggerRef.current?.focus());
        }
        return true;
    };
    const onQtyOrPriceEnter = (e) => {
        if (e.key !== 'Enter' || e.shiftKey)
            return;
        e.preventDefault();
        addToCart({ silent: true, clearForNext: true });
    };
    const removeLine = (key) => setCart((c) => c.filter((x) => x.key !== key));
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
        if (productId && !inStock.some((w) => w.id === productId))
            setProductId('');
    }, [inStock, productId]);
    /** Omborda saqlangan sotish narxi bo'lsa — sotuv formasiga avtomatik */
    useEffect(() => {
        const p = inStock.find((w) => w.id === productId);
        if (p?.salePricePerUnit != null && Number.isFinite(p.salePricePerUnit) && p.salePricePerUnit >= 0) {
            const sp = p.salePricePerUnit;
            if (Math.abs(sp - Math.round(sp)) < 1e-6) {
                setAddPrice(formatMoneyInputDisplay(String(Math.round(sp))));
            }
            else {
                setAddPrice(String(sp).replace('.', ','));
            }
        }
        else {
            setAddPrice('');
        }
    }, [productId, inStock]);
    const canWarehouse = user && hasPageAccess(user, 'warehouse');
    return (_jsxs("div", { className: "space-y-4", children: [canWarehouse && (_jsx("div", { className: "flex justify-end", children: _jsx(Button, { variant: "outline", size: "sm", className: "rounded-xl", asChild: true, children: _jsx(Link, { to: "/warehouse", children: t.navWarehouse }) }) })), _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs(Card, { className: "border-slate-200/80 p-4 shadow-sm dark:border-slate-700", children: [_jsx("p", { className: "text-xs font-medium text-slate-500 dark:text-slate-400", children: t.posStatTotalSales }), _jsxs("p", { className: "nums mt-1 text-xl font-bold text-slate-900 dark:text-white", children: [formatNumber(stats.totalSales), " so'm"] }), _jsxs("p", { className: "mt-1 text-[11px] text-slate-400", children: [stats.orderCount, " ", t.posStatOperations] })] }), _jsxs(Card, { className: "border-slate-200/80 p-4 shadow-sm dark:border-slate-700", children: [_jsx("p", { className: "text-xs font-medium text-slate-500 dark:text-slate-400", children: t.posStatTotalDebt }), _jsxs("p", { className: "nums mt-1 text-xl font-bold text-amber-600 dark:text-amber-400", children: [formatNumber(totalDebt), " so'm"] }), _jsxs("p", { className: "mt-1 text-[11px] text-slate-400", children: [clientsWithDebt, " ", t.posStatDebtClients] })] }), _jsxs(Card, { className: "border-slate-200/80 p-4 shadow-sm dark:border-slate-700", children: [_jsx("p", { className: "text-xs font-medium text-slate-500 dark:text-slate-400", children: t.posKgOnlyTitle }), _jsx("p", { className: "mt-2 text-sm font-semibold text-slate-800 dark:text-white", children: "kg" }), _jsx("p", { className: "mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400", children: t.posKgOnlyNote })] })] }), _jsxs(Tabs, { value: tab, onValueChange: (v) => setTab(v), className: "w-full", children: [_jsxs(TabsList, { className: "grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-slate-100/90 p-1 dark:bg-slate-800", children: [_jsxs(TabsTrigger, { value: "new", className: "rounded-xl py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900", children: [_jsx(ShoppingCart, { size: 16, className: "mr-1.5 shrink-0" }), _jsx("span", { className: "truncate text-xs sm:text-sm", children: t.posTabNewSale })] }), _jsxs(TabsTrigger, { value: "clients", className: "rounded-xl py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900", children: [_jsx(Users, { size: 16, className: "mr-1.5 shrink-0" }), _jsx("span", { className: "truncate text-xs sm:text-sm", children: t.posTabClients })] }), _jsxs(TabsTrigger, { value: "history", className: "rounded-xl py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900", children: [_jsx(History, { size: 16, className: "mr-1.5 shrink-0" }), _jsx("span", { className: "truncate text-xs sm:text-sm", children: t.posTabHistory })] })] }), _jsx(TabsContent, { value: "new", className: "mt-4 space-y-4 outline-none", children: _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { className: "border-slate-200 p-4 shadow-sm dark:border-slate-700", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.posClientDate }), _jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.posSelectClient }), _jsxs(Select, { value: customerId || undefined, onValueChange: setCustomerId, children: [_jsx(SelectTrigger, { className: "mt-1.5 rounded-xl", children: _jsx(SelectValue, { placeholder: t.posSelectClient }) }), _jsx(SelectContent, { children: state.customers.map((c) => (_jsx(SelectItem, { value: c.id, children: c.fullName }, c.id))) })] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.date }), _jsx(Input, { type: "date", value: saleDate, onChange: (e) => setSaleDate(e.target.value), className: "mt-1.5 rounded-xl" })] })] })] }), _jsxs(Card, { className: "border-slate-200 p-4 shadow-sm dark:border-slate-700", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.posAddProduct }), _jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "sm:col-span-2", children: [_jsx(Label, { className: "text-xs", children: t.posProductSelect }), _jsxs(Select, { value: productId ? productId : undefined, onValueChange: setProductId, disabled: !saleProducts.length, children: [_jsx(SelectTrigger, { ref: productSelectTriggerRef, className: "mt-1.5 rounded-xl", children: _jsx(SelectValue, { placeholder: t.posSelectProductFirst }) }), _jsx(SelectContent, { children: saleProducts.map((w) => (_jsxs(SelectItem, { value: w.id, children: [w.productName, " (", formatNumber(w.currentQty), " kg)"] }, w.id))) })] })] }), _jsxs("div", { children: [_jsxs(Label, { className: "text-xs", children: [t.quantity, " (kg)"] }), _jsx(Input, { ref: qtyInputRef, value: addQty, onChange: (e) => setAddQty(e.target.value), onKeyDown: onQtyOrPriceEnter, className: "mt-1.5 rounded-xl", inputMode: "decimal" })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.posPricePerKg }), _jsx(Input, { value: addPrice, onChange: (e) => setAddPrice(formatMoneyInputDisplay(e.target.value)), onKeyDown: onQtyOrPriceEnter, className: "mt-1.5 rounded-xl", inputMode: "numeric", placeholder: "0" })] })] }), _jsxs("div", { className: "mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("p", { className: "max-w-xl text-[11px] leading-relaxed text-slate-500 dark:text-slate-400", children: t.posAddLineEnterHint }), _jsx(Button, { type: "button", variant: "secondary", size: "sm", className: "shrink-0 rounded-xl", onClick: () => addToCart({ silent: true, clearForNext: true }), children: t.posAddToCart })] })] }), _jsxs(Card, { className: "border-slate-200 p-4 shadow-sm dark:border-slate-700", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.posCart }), cart.length === 0 ? (_jsxs("div", { className: "mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-600", children: [_jsx(ShoppingBag, { className: "h-10 w-10 text-slate-300 dark:text-slate-600" }), _jsx("p", { className: "mt-2 text-sm text-slate-400", children: t.posCartEmpty })] })) : (_jsx("div", { className: "mt-3 space-y-2", children: cart.map((line) => (_jsxs("div", { className: "flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-medium text-slate-800 dark:text-white", children: line.productName }), _jsxs("p", { className: "nums text-[11px] text-slate-500", children: [formatNumber(line.qty), " kg \u00D7 ", formatNumber(line.price), " \u2014", ' ', formatNumber(line.qty * line.price), " so'm"] })] }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "shrink-0 text-slate-400 hover:text-red-600", onClick: () => removeLine(line.key), "aria-label": t.posRemove, children: _jsx(Trash2, { size: 16 }) })] }, line.key))) }))] }), _jsxs(Card, { className: "border-slate-200 p-4 shadow-sm dark:border-slate-700", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.posPayment }), _jsx("p", { className: "mt-1 text-xs text-slate-500 dark:text-slate-400", children: t.posPaymentDebtHint }), _jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.posCheckoutTotal }), _jsxs("p", { className: "nums mt-2 text-lg font-bold text-slate-900 dark:text-white", children: [formatNumber(cartTotal), " so'm"] }), draftLineSubtotal > 0 && (_jsxs("p", { className: "mt-1 text-[11px] text-slate-400", children: [t.posTotalDraft, ": +", formatNumber(draftLineSubtotal), " (", t.posDraftNotInCheckout, ")"] }))] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.posPaidLabel }), _jsx(Input, { value: paidInput, onChange: (e) => setPaidInput(formatMoneyInputDisplay(e.target.value)), className: "mt-1.5 rounded-xl", inputMode: "numeric", placeholder: "0", disabled: !cart.length }), _jsxs("button", { type: "button", onClick: syncPaidWithCartTotal, disabled: !cart.length, className: "mt-1 text-[11px] text-sky-600 hover:underline disabled:opacity-40 dark:text-sky-400", children: ["= ", t.posCheckoutTotal] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs", children: t.posDebtLabel }), _jsxs("p", { className: "nums mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-lg font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", children: [formatNumber(debtFromCart), " so'm"] })] })] }), _jsxs("div", { className: "mt-4 border-t border-slate-100 pt-3 dark:border-slate-700", children: [_jsxs(Label, { className: "text-xs text-slate-500", children: [t.total, " (", t.posPreviewWithDraft, ")"] }), _jsxs("p", { className: "nums mt-1 text-xl font-bold text-slate-800 dark:text-white", children: [formatNumber(grandTotalPreview), " so'm"] })] }), _jsx(Button, { type: "button", className: "mt-4 h-11 w-full rounded-xl bg-sky-500 text-base font-semibold hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500", onClick: confirmSale, disabled: !cart.length, children: t.posConfirmSale })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { className: "border-slate-200 p-4 shadow-sm dark:border-slate-700", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.posAvailableProducts }), _jsx("div", { className: "mt-3 max-h-[min(60vh,520px)] space-y-3 overflow-y-auto pr-1", children: inStock.length === 0 ? (_jsx("p", { className: "py-6 text-center text-sm text-slate-400", children: t.posNoKgStock })) : (inStock.map((w) => {
                                                        const q = Math.max(0, w.currentQty);
                                                        const pct = w.initialQty > 0
                                                            ? Math.min(100, Math.round((q / w.initialQty) * 100))
                                                            : q > 0
                                                                ? 100
                                                                : 0;
                                                        return (_jsxs("button", { type: "button", onClick: () => {
                                                                setTab('new');
                                                                setProductId(w.id);
                                                                queueMicrotask(() => {
                                                                    qtyInputRef.current?.focus();
                                                                    qtyInputRef.current?.select();
                                                                });
                                                            }, className: "block w-full rounded-xl border border-slate-100 bg-white p-3 text-left transition-colors hover:border-sky-200 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-900", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "truncate text-sm font-medium text-slate-800 dark:text-white", children: w.productName }), _jsxs("span", { className: "nums shrink-0 text-xs text-slate-500", children: [formatNumber(q), " kg"] })] }), _jsx("div", { className: "mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800", children: _jsx("div", { className: `h-full rounded-full transition-all ${q <= 1e-6 ? 'bg-teal-500/50' : 'bg-violet-500'}`, style: { width: `${pct}%` } }) })] }, w.id));
                                                    })) })] }), _jsxs(Card, { className: "border-slate-200 p-4 shadow-sm dark:border-slate-700", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.posClientsSidebar }), _jsxs("div", { className: "mt-3 space-y-2", children: [state.customers.slice(0, 8).map((c) => (_jsxs("div", { className: "flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-xs dark:border-slate-700", children: [_jsx("span", { className: "truncate font-medium text-slate-700 dark:text-slate-200", children: c.fullName }), c.balanceDue > 0.01 ? (_jsxs("span", { className: "nums shrink-0 font-medium text-amber-600 dark:text-amber-400", children: [formatNumber(c.balanceDue), " so'm"] })) : (_jsxs("span", { className: "flex shrink-0 items-center gap-0.5 text-emerald-600 dark:text-emerald-400", children: [_jsx(CheckCircle2, { size: 12 }), t.posNoDebt] }))] }, c.id))), state.customers.length === 0 && (_jsx("p", { className: "text-center text-xs text-slate-400", children: t.noData })), _jsx(Button, { variant: "outline", size: "sm", className: "mt-2 w-full rounded-xl", asChild: true, children: _jsx(Link, { to: "/customers", children: t.custTitle }) })] })] })] })] }) }), _jsx(TabsContent, { value: "clients", className: "mt-4 outline-none", children: _jsxs(Card, { className: "border-slate-200 p-4 shadow-sm dark:border-slate-700", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.custTitle }), _jsx(Button, { asChild: true, className: "rounded-xl bg-sky-500 hover:bg-sky-600", children: _jsx(Link, { to: "/customers", children: t.custAddCustomer }) })] }), _jsxs(Table, { className: "mt-4", children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.custName }), _jsx(TableHead, { children: t.custPhone }), _jsx(TableHead, { className: "text-right", children: t.custTotalSpent }), _jsx(TableHead, { className: "text-right", children: t.posDebtLabel }), _jsx(TableHead, { className: "w-28 text-center", children: t.custPurchaseHistory })] }) }), _jsx(TableBody, { children: state.customers.length === 0 ? (_jsx(TableEmpty, { colSpan: 5, message: t.noData })) : (state.customers.map((c) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: c.fullName }), _jsx(TableCell, { className: "font-mono text-xs", children: c.phone }), _jsxs(TableCell, { className: "nums text-right text-emerald-600 dark:text-emerald-400", children: [formatNumber(c.totalSpent), " so'm"] }), _jsxs(TableCell, { className: `nums text-right ${c.balanceDue > 0.01 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-400'}`, children: [formatNumber(c.balanceDue), " so'm"] }), _jsx(TableCell, { className: "text-center", children: _jsx(Button, { type: "button", variant: "outline", size: "icon", className: "h-8 w-8 rounded-lg", onClick: () => setPurchaseHistoryCustomer(c), "aria-label": t.custPurchaseHistory, children: _jsx(History, { size: 16 }) }) })] }, c.id)))) })] })] }) }), _jsxs(TabsContent, { value: "history", className: "mt-4 space-y-3 outline-none", children: [_jsx(Card, { className: "border-slate-200 p-4 shadow-sm dark:border-slate-700", children: _jsx(Input, { value: historySearch, onChange: (e) => setHistorySearch(e.target.value), placeholder: t.posHistorySearch, className: "max-w-md rounded-xl" }) }), _jsx(Card, { className: "hidden overflow-hidden border-slate-200 shadow-sm dark:border-slate-700 md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.date }), _jsx(TableHead, { children: t.whBuyer }), _jsx(TableHead, { children: t.whProductName }), _jsx(TableHead, { className: "text-right", children: t.salesAmount }), _jsx(TableHead, { className: "text-right", children: t.posPaidLabel }), _jsx(TableHead, { className: "text-right", children: t.posDebtLabel }), _jsx(TableHead, { className: "w-[5.5rem] text-right", children: t.actions })] }) }), _jsx(TableBody, { children: historyGroups.length === 0 ? (_jsx(TableEmpty, { colSpan: 7, message: t.posNoHistory })) : (historyGroups.map((g) => (_jsxs(TableRow, { className: "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/60", tabIndex: 0, role: "button", onClick: () => openHistoryOrder(g.orderId), onKeyDown: (e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        openHistoryOrder(g.orderId);
                                                    }
                                                }, children: [_jsx(TableCell, { className: "whitespace-nowrap text-xs", children: formatDate(g.first.date) }), _jsx(TableCell, { className: "max-w-[10rem] truncate", children: g.buyer }), _jsx(TableCell, { className: "max-w-[20rem] truncate text-sm", children: g.products }), _jsxs(TableCell, { className: "nums text-right font-medium", children: [formatNumber(g.total), " so'm"] }), _jsxs(TableCell, { className: "nums text-right text-slate-700 dark:text-slate-200", children: [formatNumber(g.paid), " so'm"] }), _jsxs(TableCell, { className: `nums text-right ${g.debt > 0.01 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-400'}`, children: [formatNumber(g.debt), " so'm"] }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "flex justify-end gap-0.5", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), children: [_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 text-slate-500 hover:text-sky-600", "aria-label": t.posEditOrder, onClick: () => openHistoryOrder(g.orderId, true), children: _jsx(Pencil, { size: 15 }) }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 text-slate-500 hover:text-red-600", "aria-label": t.delete, onClick: () => setConfirmDeleteOrderId(g.orderId), children: _jsx(Trash2, { size: 15 }) })] }) })] }, g.orderId)))) })] }) }), _jsx("div", { className: "space-y-2 md:hidden", children: historyGroups.length === 0 ? (_jsx(Card, { className: "p-6 text-center text-sm text-slate-400", children: t.posNoHistory })) : (historyGroups.map((g) => (_jsxs(Card, { className: "cursor-pointer p-3 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50", tabIndex: 0, role: "button", onClick: () => openHistoryOrder(g.orderId), onKeyDown: (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            openHistoryOrder(g.orderId);
                                        }
                                    }, children: [_jsxs("div", { className: "mb-2 flex justify-end gap-0.5", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), children: [_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 text-slate-500", "aria-label": t.posEditOrder, onClick: () => openHistoryOrder(g.orderId, true), children: _jsx(Pencil, { size: 15 }) }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-8 w-8 text-slate-500 hover:text-red-600", "aria-label": t.delete, onClick: () => setConfirmDeleteOrderId(g.orderId), children: _jsx(Trash2, { size: 15 }) })] }), _jsx("p", { className: "text-xs text-slate-500", children: formatDate(g.first.date) }), _jsx("p", { className: "mt-1 font-medium text-slate-800 dark:text-white", children: g.buyer }), _jsx("p", { className: "mt-1 line-clamp-2 text-xs text-slate-500", children: g.products }), _jsxs("div", { className: "mt-2 space-y-1 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: t.salesAmount }), _jsxs("span", { className: "nums font-semibold", children: [formatNumber(g.total), " so'm"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: t.posPaidLabel }), _jsxs("span", { className: "nums", children: [formatNumber(g.paid), " so'm"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: t.posDebtLabel }), _jsxs("span", { className: `nums ${g.debt > 0.01 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-400'}`, children: [formatNumber(g.debt), " so'm"] })] })] })] }, g.orderId)))) })] })] }), _jsx(CustomerPurchaseHistoryDialog, { customer: purchaseHistoryCustomer, outcomes: state.outcomes, open: !!purchaseHistoryCustomer, onOpenChange: (o) => {
                    if (!o)
                        setPurchaseHistoryCustomer(null);
                } }), _jsx(PosOrderDetailDialog, { orderId: historyDetailGroup?.orderId ?? '', lines: historyDetailGroup?.lines ?? [], open: Boolean(historyOrderId && historyDetailGroup), initialEditMode: historyOpenInEditMode, onOpenChange: (o) => {
                    if (!o) {
                        setHistoryOrderId(null);
                        setHistoryOpenInEditMode(false);
                    }
                } }), _jsx(AlertDialog, { open: !!confirmDeleteOrderId, onOpenChange: (o) => !o && setConfirmDeleteOrderId(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.delete }), _jsx(AlertDialogDescription, { children: t.posDeleteOrderConfirm })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDeleteHistoryOrder, children: t.delete })] })] }) })] }));
}
