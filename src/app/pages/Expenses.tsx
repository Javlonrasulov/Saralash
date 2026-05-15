import React, { useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Wallet,
  Tag,
  CalendarDays,
  ListChecks,
  TrendingDown,
  StickyNote,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useStore,
  type Expense,
  type ExpenseCategory,
} from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { isYmdInNavFilter } from '../lib/nav-date-range';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { formatDate, formatMoneyInputDisplay, formatNumber, TODAY } from '../utils/format';

const ALL_CATEGORIES = '__all';

interface ExpenseFormState {
  date: string;
  categoryId: string;
  amount: string;
  notes: string;
}

const EMPTY_EXPENSE: ExpenseFormState = {
  date: TODAY,
  categoryId: '',
  amount: '',
  notes: '',
};

interface CategoryFormState {
  name: string;
}

const EMPTY_CATEGORY: CategoryFormState = { name: '' };

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function Expenses() {
  const {
    state,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
  } = useStore();
  const { t } = useApp();
  const { filter: navDateFilter } = useNavDateFilter();

  const [tab, setTab] = useState<'list' | 'categories'>('list');

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>(ALL_CATEGORIES);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(EMPTY_EXPENSE);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<Expense | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<ExpenseCategory | null>(null);

  const categoriesSorted = useMemo(
    () => [...state.expenseCategories].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [state.expenseCategories],
  );

  const usageCountByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of state.expenses) {
      if (!e.categoryId) continue;
      m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + 1);
    }
    return m;
  }, [state.expenses]);

  const expensesInRange = useMemo(
    () => state.expenses.filter((e) => isYmdInNavFilter(e.date, navDateFilter)),
    [state.expenses, navDateFilter],
  );

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expensesInRange
      .filter((e) => filterCategory === ALL_CATEGORIES || e.categoryId === filterCategory)
      .filter((e) => {
        if (!q) return true;
        return (
          e.categoryName.toLowerCase().includes(q) ||
          (e.notes ?? '').toLowerCase().includes(q) ||
          formatNumber(e.amount).toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      );
  }, [expensesInRange, filterCategory, search]);

  const summary = useMemo(() => {
    const total = expensesInRange.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0);
    const count = expensesInRange.length;
    const byCat = new Map<string, { name: string; total: number }>();
    for (const e of expensesInRange) {
      const key = e.categoryId ?? `__name:${e.categoryName}`;
      const prev = byCat.get(key);
      if (prev) prev.total += e.amount;
      else byCat.set(key, { name: e.categoryName || '—', total: e.amount });
    }
    let topName: string | null = null;
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

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      date: expense.date,
      categoryId: expense.categoryId ?? '',
      amount: formatMoneyInputDisplay(String(Math.round(expense.amount))),
      notes: expense.notes ?? '',
    });
    setExpenseDialogOpen(true);
  };

  const submitExpense = (e: React.FormEvent) => {
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
    } else {
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
    if (!confirmDeleteExpense) return;
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

  const openEditCategory = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setCategoryDialogOpen(true);
  };

  const submitCategory = (e: React.FormEvent) => {
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
    } else {
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
    if (!confirmDeleteCategory) return;
    deleteExpenseCategory(confirmDeleteCategory.id);
    toast.success(t.delete);
    setConfirmDeleteCategory(null);
  };

  // ---- UI ----

  return (
    <div className="space-y-4">
      {/* Intro */}
      <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-br from-indigo-50/60 via-white to-white p-4 dark:border-slate-700/60 dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/30">
            <Wallet size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-white sm:text-base">
              {t.expTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-[13px]">
              {t.expIntro}
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<TrendingDown size={16} />}
          label={t.expSummaryTotal}
          value={`${formatNumber(summary.total)} so'm`}
          tone="danger"
        />
        <SummaryCard
          icon={<ListChecks size={16} />}
          label={t.expSummaryCount}
          value={formatNumber(summary.count)}
          tone="muted"
        />
        <SummaryCard
          icon={<Tag size={16} />}
          label={t.expSummaryTopCategory}
          value={summary.topName ?? '—'}
          hint={summary.topName ? `${formatNumber(summary.topTotal)} so'm` : undefined}
          tone="primary"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'list' | 'categories')}>
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="list">
            <Wallet size={14} />
            {t.expTabList}
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag size={14} />
            {t.expTabCategories}
            <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              {state.expenseCategories.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Expenses list tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Toolbar */}
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.expSearchPlaceholder}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 sm:w-auto">
                <div className="min-w-[14rem] flex-1">
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={t.expFilterCategory} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CATEGORIES}>{t.expFilterAll}</SelectItem>
                      {categoriesSorted.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={openCreateExpense} className="shrink-0">
                  <Plus size={16} />
                  <span className="hidden sm:inline">{t.expAdd}</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">{t.expColDate}</TableHead>
                  <TableHead>{t.expColCategory}</TableHead>
                  <TableHead className="text-right">{t.expColAmount}</TableHead>
                  <TableHead>{t.expColNotes}</TableHead>
                  <TableHead className="w-28 text-right">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableEmpty colSpan={5} message={t.expNoData} />
                ) : (
                  filteredExpenses.map((e) => {
                    const isOrphan = !e.categoryId;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="nums whitespace-nowrap text-xs text-slate-500">
                          {formatDate(e.date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={isOrphan ? 'muted' : 'default'} className="shrink-0">
                              <Tag size={10} />
                              {e.categoryName || '—'}
                            </Badge>
                            {isOrphan && (
                              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                ({t.expCategoryDeletedTag})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="nums text-right font-semibold text-rose-600 dark:text-rose-400">
                          {formatNumber(e.amount)} so'm
                        </TableCell>
                        <TableCell className="max-w-[20rem] text-xs text-slate-500 dark:text-slate-400">
                          <span className="line-clamp-2">{e.notes || '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditExpense(e)}
                              aria-label={t.edit}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmDeleteExpense(e)}
                              aria-label={t.delete}
                              className="hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filteredExpenses.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-400">{t.expNoData}</Card>
            ) : (
              filteredExpenses.map((e) => {
                const isOrphan = !e.categoryId;
                return (
                  <Card key={e.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white">
                        <TrendingDown size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                              {e.categoryName || '—'}
                              {isOrphan && (
                                <span className="ml-1 text-[10px] uppercase text-slate-400">
                                  ({t.expCategoryDeletedTag})
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                              <CalendarDays size={11} className="text-slate-400" />
                              {formatDate(e.date)}
                            </p>
                          </div>
                          <span className="nums shrink-0 text-sm font-semibold text-rose-600 dark:text-rose-400">
                            {formatNumber(e.amount)} so'm
                          </span>
                        </div>
                        {e.notes && (
                          <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <StickyNote size={11} className="mt-0.5 shrink-0 text-slate-400" />
                            <span className="line-clamp-3">{e.notes}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                      <Button variant="ghost" size="sm" onClick={() => openEditExpense(e)}>
                        <Pencil size={14} />
                        {t.edit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteExpense(e)}
                        className="hover:text-red-600"
                      >
                        <Trash2 size={14} />
                        {t.delete}
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Categories tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t.expCategoriesTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t.expCategoriesIntro}
                </p>
              </div>
              <Button onClick={openCreateCategory} className="shrink-0">
                <Plus size={16} />
                {t.expCategoryAdd}
              </Button>
            </div>
          </Card>

          {categoriesSorted.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-400">{t.expCategoryNoData}</Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoriesSorted.map((c) => {
                const used = usageCountByCategory.get(c.id) ?? 0;
                return (
                  <Card
                    key={c.id}
                    className="group flex flex-col gap-3 p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                        <Tag size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                          {c.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {formatNumber(used)} {t.expCategoryUsedCount}
                        </p>
                      </div>
                      {used > 0 && (
                        <Badge variant="muted" className="shrink-0 text-[10px]">
                          {used}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-700">
                      <Button variant="ghost" size="sm" onClick={() => openEditCategory(c)}>
                        <Pencil size={14} />
                        {t.edit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteCategory(c)}
                        className="hover:text-red-600"
                      >
                        <Trash2 size={14} />
                        {t.delete}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add / Edit expense dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? t.expEdit : t.expAdd}</DialogTitle>
            <DialogDescription>{t.expIntro}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitExpense} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="exp-date">{t.expDate} *</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1.5"
                  max={TODAY}
                  required
                />
              </div>
              <div>
                <Label htmlFor="exp-amount">{t.expAmount} *</Label>
                <Input
                  id="exp-amount"
                  inputMode="numeric"
                  autoComplete="off"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm((f) => ({
                      ...f,
                      amount: formatMoneyInputDisplay(e.target.value),
                    }))
                  }
                  placeholder="0"
                  className="mt-1.5 font-mono nums"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="exp-category">{t.expCategory} *</Label>
              <div className="mt-1.5">
                <Select
                  value={expenseForm.categoryId}
                  onValueChange={(v) => setExpenseForm((f) => ({ ...f, categoryId: v }))}
                >
                  <SelectTrigger id="exp-category">
                    <SelectValue placeholder={t.expCategoryPickerPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesSorted.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400">
                        {t.expCategoryNoData}
                      </div>
                    ) : (
                      categoriesSorted.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="exp-notes">{t.expNotes}</Label>
              <textarea
                id="exp-notes"
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder={t.notes}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpenseDialogOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button type="submit">{t.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit category dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t.expCategoryEdit : t.expCategoryAdd}
            </DialogTitle>
            <DialogDescription>{t.expCategoriesIntro}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCategory} className="space-y-4">
            <div>
              <Label htmlFor="exp-cat-name">{t.expCategoryName} *</Label>
              <Input
                id="exp-cat-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ name: e.target.value })}
                placeholder={t.expCategoryNamePlaceholder}
                className="mt-1.5"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button type="submit">{t.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirms */}
      <AlertDialog
        open={!!confirmDeleteExpense}
        onOpenChange={(o) => !o && setConfirmDeleteExpense(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.expDeleteConfirm}
              {confirmDeleteExpense && (
                <span className="mt-2 block font-semibold text-slate-800 dark:text-white">
                  {confirmDeleteExpense.categoryName} —{' '}
                  {formatNumber(confirmDeleteExpense.amount)} so'm
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense}>{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmDeleteCategory}
        onOpenChange={(o) => !o && setConfirmDeleteCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.expDeleteCategoryConfirm}
              {confirmDeleteCategory && (
                <span className="mt-2 block font-semibold text-slate-800 dark:text-white">
                  {confirmDeleteCategory.name}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: 'primary' | 'danger' | 'muted';
}

function SummaryCard({ icon, label, value, hint, tone }: SummaryCardProps) {
  const toneClasses =
    tone === 'danger'
      ? 'from-rose-500 to-orange-500'
      : tone === 'primary'
        ? 'from-indigo-500 to-blue-600'
        : 'from-slate-500 to-slate-700';
  const valueColor =
    tone === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'primary'
        ? 'text-slate-800 dark:text-white'
        : 'text-slate-800 dark:text-white';

  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${toneClasses} text-white shadow-md shadow-slate-300/30 dark:shadow-black/20`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`nums mt-0.5 truncate text-base font-semibold ${valueColor}`}>{value}</p>
        {hint && <p className="nums mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </Card>
  );
}
