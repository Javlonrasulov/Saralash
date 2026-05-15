import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Wallet, Tag, CalendarDays, ListChecks, TrendingDown, StickyNote, } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, } from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter } from '../lib/nav-date-range';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '../components/ui/alert-dialog';
import { formatDate, formatMoneyInputDisplay, formatNumber, TODAY } from '../utils/format';
const ALL_CATEGORIES = '__all';
const EMPTY_EXPENSE = {
    date: TODAY,
    categoryId: '',
    amount: '',
    notes: '',
};
const EMPTY_CATEGORY = { name: '' };
function parseAmount(raw) {
    const cleaned = raw.replace(/\s/g, '').replace(',', '.');
    if (!cleaned)
        return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return n;
}
export function Expenses() {
    const { state, addExpense, updateExpense, deleteExpense, addExpenseCategory, updateExpenseCategory, deleteExpenseCategory, } = useStore();
    const { t } = useApp();
    const { filter: navDateFilter } = useNavDateFilter();
    const [tab, setTab] = useState('list');
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState(ALL_CATEGORIES);
    const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
    const [confirmDeleteExpense, setConfirmDeleteExpense] = useState(null);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);
    const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
    const categoriesSorted = useMemo(() => [...state.expenseCategories].sort((a, b) => a.name.localeCompare(b.name, 'ru')), [state.expenseCategories]);
    const usageCountByCategory = useMemo(() => {
        const m = new Map();
        for (const e of state.expenses) {
            if (!e.categoryId)
                continue;
            m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + 1);
        }
        return m;
    }, [state.expenses]);
    const expensesInRange = useMemo(() => state.expenses.filter((e) => isYmdInNavFilter(e.date, navDateFilter)), [state.expenses, navDateFilter]);
    const filteredExpenses = useMemo(() => {
        const q = search.trim().toLowerCase();
        return expensesInRange
            .filter((e) => filterCategory === ALL_CATEGORIES || e.categoryId === filterCategory)
            .filter((e) => {
            if (!q)
                return true;
            return (e.categoryName.toLowerCase().includes(q) ||
                (e.notes ?? '').toLowerCase().includes(q) ||
                formatNumber(e.amount).toLowerCase().includes(q));
        })
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }, [expensesInRange, filterCategory, search]);
    const summary = useMemo(() => {
        const total = expensesInRange.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0);
        const count = expensesInRange.length;
        const byCat = new Map();
        for (const e of expensesInRange) {
            const key = e.categoryId ?? `__name:${e.categoryName}`;
            const prev = byCat.get(key);
            if (prev)
                prev.total += e.amount;
            else
                byCat.set(key, { name: e.categoryName || '—', total: e.amount });
        }
        let topName = null;
        let topTotal = 0;
        for (const v of byCat.values()) {
            if (v.total > topTotal) {
                topTotal = v.total;
                topName = v.name;
            }
        }
        return { total, count, topName, topTotal };
    }, [expensesInRange]);
    // ---- Expense handlers ----
    const openCreateExpense = () => {
        if (categoriesSorted.length === 0) {
            setTab('categories');
            toast.error(t.expValidateCategory);
            return;
        }
        setEditingExpense(null);
        setExpenseForm({
            ...EMPTY_EXPENSE,
            categoryId: categoriesSorted[0].id,
        });
        setExpenseDialogOpen(true);
    };
    const openEditExpense = (expense) => {
        setEditingExpense(expense);
        setExpenseForm({
            date: expense.date,
            categoryId: expense.categoryId ?? '',
            amount: formatMoneyInputDisplay(String(Math.round(expense.amount))),
            notes: expense.notes ?? '',
        });
        setExpenseDialogOpen(true);
    };
    const submitExpense = (e) => {
        e.preventDefault();
        const amount = parseAmount(expenseForm.amount);
        if (amount === null) {
            toast.error(t.expValidateAmount);
            return;
        }
        if (!expenseForm.categoryId) {
            toast.error(t.expValidateCategory);
            return;
        }
        const date = expenseForm.date || TODAY;
        if (editingExpense) {
            const ok = updateExpense({
                id: editingExpense.id,
                date,
                categoryId: expenseForm.categoryId,
                amount,
                notes: expenseForm.notes,
            });
            if (!ok) {
                toast.error(t.usersSaveError);
                return;
            }
            toast.success(t.save);
        }
        else {
            const created = addExpense({
                date,
                categoryId: expenseForm.categoryId,
                amount,
                notes: expenseForm.notes,
            });
            if (!created) {
                toast.error(t.usersSaveError);
                return;
            }
            toast.success(t.add);
        }
        setExpenseDialogOpen(false);
        setEditingExpense(null);
        setExpenseForm(EMPTY_EXPENSE);
    };
    const handleDeleteExpense = () => {
        if (!confirmDeleteExpense)
            return;
        deleteExpense(confirmDeleteExpense.id);
        toast.success(t.delete);
        setConfirmDeleteExpense(null);
    };
    // ---- Category handlers ----
    const openCreateCategory = () => {
        setEditingCategory(null);
        setCategoryForm(EMPTY_CATEGORY);
        setCategoryDialogOpen(true);
    };
    const openEditCategory = (category) => {
        setEditingCategory(category);
        setCategoryForm({ name: category.name });
        setCategoryDialogOpen(true);
    };
    const submitCategory = (e) => {
        e.preventDefault();
        const name = categoryForm.name.trim();
        if (!name) {
            toast.error(t.required);
            return;
        }
        if (editingCategory) {
            const ok = updateExpenseCategory({ ...editingCategory, name });
            if (!ok) {
                toast.error(t.expCategoryNameTaken);
                return;
            }
            toast.success(t.save);
        }
        else {
            const created = addExpenseCategory({ name });
            if (!created) {
                toast.error(t.expCategoryNameTaken);
                return;
            }
            toast.success(t.add);
        }
        setCategoryDialogOpen(false);
        setEditingCategory(null);
        setCategoryForm(EMPTY_CATEGORY);
    };
    const handleDeleteCategory = () => {
        if (!confirmDeleteCategory)
            return;
        deleteExpenseCategory(confirmDeleteCategory.id);
        toast.success(t.delete);
        setConfirmDeleteCategory(null);
    };
    // ---- UI ----
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(Card, { className: "overflow-hidden border-slate-200/80 bg-gradient-to-br from-indigo-50/60 via-white to-white p-4 dark:border-slate-700/60 dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/30", children: _jsx(Wallet, { size: 18 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-800 dark:text-white sm:text-base", children: t.expTitle }), _jsx("p", { className: "mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-[13px]", children: t.expIntro })] })] }) }), _jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3", children: [_jsx(SummaryCard, { icon: _jsx(TrendingDown, { size: 16 }), label: t.expSummaryTotal, value: `${formatNumber(summary.total)} so'm`, tone: "danger" }), _jsx(SummaryCard, { icon: _jsx(ListChecks, { size: 16 }), label: t.expSummaryCount, value: formatNumber(summary.count), tone: "muted" }), _jsx(SummaryCard, { icon: _jsx(Tag, { size: 16 }), label: t.expSummaryTopCategory, value: summary.topName ?? '—', hint: summary.topName ? `${formatNumber(summary.topTotal)} so'm` : undefined, tone: "primary" })] }), _jsxs(Tabs, { value: tab, onValueChange: (v) => setTab(v), children: [_jsxs(TabsList, { className: "w-full overflow-x-auto sm:w-auto", children: [_jsxs(TabsTrigger, { value: "list", children: [_jsx(Wallet, { size: 14 }), t.expTabList] }), _jsxs(TabsTrigger, { value: "categories", children: [_jsx(Tag, { size: 14 }), t.expTabCategories, _jsx("span", { className: "ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300", children: state.expenseCategories.length })] })] }), _jsxs(TabsContent, { value: "list", className: "space-y-4", children: [_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-center", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: t.expSearchPlaceholder, className: "pl-9" })] }), _jsxs("div", { className: "flex items-center gap-2 sm:w-auto", children: [_jsx("div", { className: "min-w-[14rem] flex-1", children: _jsxs(Select, { value: filterCategory, onValueChange: setFilterCategory, children: [_jsx(SelectTrigger, { className: "h-10", children: _jsx(SelectValue, { placeholder: t.expFilterCategory }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: ALL_CATEGORIES, children: t.expFilterAll }), categoriesSorted.map((c) => (_jsx(SelectItem, { value: c.id, children: c.name }, c.id)))] })] }) }), _jsxs(Button, { onClick: openCreateExpense, className: "shrink-0", children: [_jsx(Plus, { size: 16 }), _jsx("span", { className: "hidden sm:inline", children: t.expAdd })] })] })] }) }), _jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-32", children: t.expColDate }), _jsx(TableHead, { children: t.expColCategory }), _jsx(TableHead, { className: "text-right", children: t.expColAmount }), _jsx(TableHead, { children: t.expColNotes }), _jsx(TableHead, { className: "w-28 text-right", children: t.actions })] }) }), _jsx(TableBody, { children: filteredExpenses.length === 0 ? (_jsx(TableEmpty, { colSpan: 5, message: t.expNoData })) : (filteredExpenses.map((e) => {
                                                const isOrphan = !e.categoryId;
                                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "nums whitespace-nowrap text-xs text-slate-500", children: formatDate(e.date) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Badge, { variant: isOrphan ? 'muted' : 'default', className: "shrink-0", children: [_jsx(Tag, { size: 10 }), e.categoryName || '—'] }), isOrphan && (_jsxs("span", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: ["(", t.expCategoryDeletedTag, ")"] }))] }) }), _jsxs(TableCell, { className: "nums text-right font-semibold text-rose-600 dark:text-rose-400", children: [formatNumber(e.amount), " so'm"] }), _jsx(TableCell, { className: "max-w-[20rem] text-xs text-slate-500 dark:text-slate-400", children: _jsx("span", { className: "line-clamp-2", children: e.notes || '—' }) }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "inline-flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => openEditExpense(e), "aria-label": t.edit, children: _jsx(Pencil, { size: 14 }) }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => setConfirmDeleteExpense(e), "aria-label": t.delete, className: "hover:text-red-600 dark:hover:text-red-400", children: _jsx(Trash2, { size: 14 }) })] }) })] }, e.id));
                                            })) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: filteredExpenses.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.expNoData })) : (filteredExpenses.map((e) => {
                                    const isOrphan = !e.categoryId;
                                    return (_jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white", children: _jsx(TrendingDown, { size: 16 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "truncate text-sm font-semibold text-slate-800 dark:text-white", children: [e.categoryName || '—', isOrphan && (_jsxs("span", { className: "ml-1 text-[10px] uppercase text-slate-400", children: ["(", t.expCategoryDeletedTag, ")"] }))] }), _jsxs("p", { className: "mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500", children: [_jsx(CalendarDays, { size: 11, className: "text-slate-400" }), formatDate(e.date)] })] }), _jsxs("span", { className: "nums shrink-0 text-sm font-semibold text-rose-600 dark:text-rose-400", children: [formatNumber(e.amount), " so'm"] })] }), e.notes && (_jsxs("p", { className: "mt-2 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400", children: [_jsx(StickyNote, { size: 11, className: "mt-0.5 shrink-0 text-slate-400" }), _jsx("span", { className: "line-clamp-3", children: e.notes })] }))] })] }), _jsxs("div", { className: "mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700", children: [_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => openEditExpense(e), children: [_jsx(Pencil, { size: 14 }), t.edit] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setConfirmDeleteExpense(e), className: "hover:text-red-600", children: [_jsx(Trash2, { size: 14 }), t.delete] })] })] }, e.id));
                                })) })] }), _jsxs(TabsContent, { value: "categories", className: "space-y-4", children: [_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: t.expCategoriesTitle }), _jsx("p", { className: "mt-1 text-xs text-slate-500 dark:text-slate-400", children: t.expCategoriesIntro })] }), _jsxs(Button, { onClick: openCreateCategory, className: "shrink-0", children: [_jsx(Plus, { size: 16 }), t.expCategoryAdd] })] }) }), categoriesSorted.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.expCategoryNoData })) : (_jsx("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3", children: categoriesSorted.map((c) => {
                                    const used = usageCountByCategory.get(c.id) ?? 0;
                                    return (_jsxs(Card, { className: "group flex flex-col gap-3 p-4 transition-shadow hover:shadow-md", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300", children: _jsx(Tag, { size: 15 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-semibold text-slate-800 dark:text-white", children: c.name }), _jsxs("p", { className: "mt-0.5 text-[11px] text-slate-400", children: [formatNumber(used), " ", t.expCategoryUsedCount] })] }), used > 0 && (_jsx(Badge, { variant: "muted", className: "shrink-0 text-[10px]", children: used }))] }), _jsxs("div", { className: "flex items-center justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-700", children: [_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => openEditCategory(c), children: [_jsx(Pencil, { size: 14 }), t.edit] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setConfirmDeleteCategory(c), className: "hover:text-red-600", children: [_jsx(Trash2, { size: 14 }), t.delete] })] })] }, c.id));
                                }) }))] })] }), _jsx(Dialog, { open: expenseDialogOpen, onOpenChange: setExpenseDialogOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: editingExpense ? t.expEdit : t.expAdd }), _jsx(DialogDescription, { children: t.expIntro })] }), _jsxs("form", { onSubmit: submitExpense, className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsxs(Label, { htmlFor: "exp-date", children: [t.expDate, " *"] }), _jsx(Input, { id: "exp-date", type: "date", value: expenseForm.date, onChange: (e) => setExpenseForm((f) => ({ ...f, date: e.target.value })), className: "mt-1.5", max: TODAY, required: true })] }), _jsxs("div", { children: [_jsxs(Label, { htmlFor: "exp-amount", children: [t.expAmount, " *"] }), _jsx(Input, { id: "exp-amount", inputMode: "numeric", autoComplete: "off", value: expenseForm.amount, onChange: (e) => setExpenseForm((f) => ({
                                                        ...f,
                                                        amount: formatMoneyInputDisplay(e.target.value),
                                                    })), placeholder: "0", className: "mt-1.5 font-mono nums", required: true })] })] }), _jsxs("div", { children: [_jsxs(Label, { htmlFor: "exp-category", children: [t.expCategory, " *"] }), _jsx("div", { className: "mt-1.5", children: _jsxs(Select, { value: expenseForm.categoryId, onValueChange: (v) => setExpenseForm((f) => ({ ...f, categoryId: v })), children: [_jsx(SelectTrigger, { id: "exp-category", children: _jsx(SelectValue, { placeholder: t.expCategoryPickerPlaceholder }) }), _jsx(SelectContent, { children: categoriesSorted.length === 0 ? (_jsx("div", { className: "px-3 py-2 text-xs text-slate-400", children: t.expCategoryNoData })) : (categoriesSorted.map((c) => (_jsx(SelectItem, { value: c.id, children: c.name }, c.id)))) })] }) })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "exp-notes", children: t.expNotes }), _jsx("textarea", { id: "exp-notes", value: expenseForm.notes, onChange: (e) => setExpenseForm((f) => ({ ...f, notes: e.target.value })), rows: 3, className: "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500", placeholder: t.notes })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setExpenseDialogOpen(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.save })] })] })] }) }), _jsx(Dialog, { open: categoryDialogOpen, onOpenChange: setCategoryDialogOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: editingCategory ? t.expCategoryEdit : t.expCategoryAdd }), _jsx(DialogDescription, { children: t.expCategoriesIntro })] }), _jsxs("form", { onSubmit: submitCategory, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { htmlFor: "exp-cat-name", children: [t.expCategoryName, " *"] }), _jsx(Input, { id: "exp-cat-name", value: categoryForm.name, onChange: (e) => setCategoryForm({ name: e.target.value }), placeholder: t.expCategoryNamePlaceholder, className: "mt-1.5", autoFocus: true, required: true })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setCategoryDialogOpen(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.save })] })] })] }) }), _jsx(AlertDialog, { open: !!confirmDeleteExpense, onOpenChange: (o) => !o && setConfirmDeleteExpense(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.delete }), _jsxs(AlertDialogDescription, { children: [t.expDeleteConfirm, confirmDeleteExpense && (_jsxs("span", { className: "mt-2 block font-semibold text-slate-800 dark:text-white", children: [confirmDeleteExpense.categoryName, " \u2014", ' ', formatNumber(confirmDeleteExpense.amount), " so'm"] }))] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDeleteExpense, children: t.delete })] })] }) }), _jsx(AlertDialog, { open: !!confirmDeleteCategory, onOpenChange: (o) => !o && setConfirmDeleteCategory(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.delete }), _jsxs(AlertDialogDescription, { children: [t.expDeleteCategoryConfirm, confirmDeleteCategory && (_jsx("span", { className: "mt-2 block font-semibold text-slate-800 dark:text-white", children: confirmDeleteCategory.name }))] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDeleteCategory, children: t.delete })] })] }) })] }));
}
function SummaryCard({ icon, label, value, hint, tone }) {
    const toneClasses = tone === 'danger'
        ? 'from-rose-500 to-orange-500'
        : tone === 'primary'
            ? 'from-indigo-500 to-blue-600'
            : 'from-slate-500 to-slate-700';
    const valueColor = tone === 'danger'
        ? 'text-rose-600 dark:text-rose-400'
        : tone === 'primary'
            ? 'text-slate-800 dark:text-white'
            : 'text-slate-800 dark:text-white';
    return (_jsxs(Card, { className: "flex items-center gap-3 p-4", children: [_jsx("div", { className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${toneClasses} text-white shadow-md shadow-slate-300/30 dark:shadow-black/20`, children: icon }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-[11px] uppercase tracking-wide text-slate-400", children: label }), _jsx("p", { className: `nums mt-0.5 truncate text-base font-semibold ${valueColor}`, children: value }), hint && _jsx("p", { className: "nums mt-0.5 truncate text-[11px] text-slate-400", children: hint })] })] }));
}
