import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Phone, MapPin, User, History } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, type Customer } from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { formatDate, formatNumber } from '../utils/format';
import { CustomerPurchaseHistoryDialog } from '../components/CustomerPurchaseHistoryDialog';

interface FormState {
  fullName: string;
  phone: string;
  address: string;
}

const EMPTY_FORM: FormState = { fullName: '', phone: '', address: '' };

export function Customers() {
  const { state, addCustomer, updateCustomer, deleteCustomer } = useStore();
  const { t } = useApp();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [purchaseHistoryCustomer, setPurchaseHistoryCustomer] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.customers;
    return state.customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [state.customers, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      fullName: customer.fullName,
      phone: customer.phone,
      address: customer.address,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };
    if (!trimmed.fullName || !trimmed.phone) {
      toast.error(t.required + ': ' + t.custName + ' / ' + t.custPhone);
      return;
    }
    if (editing) {
      updateCustomer({ ...editing, ...trimmed });
      toast.success(t.save);
    } else {
      addCustomer(trimmed);
      toast.success(t.add);
    }
    setDialogOpen(false);
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteCustomer(confirmDelete.id);
    toast.success(t.delete);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.custSearchPlaceholder}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus size={16} />
            {t.custAddCustomer}
          </Button>
        </div>
      </Card>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.custName}</TableHead>
              <TableHead>{t.custPhone}</TableHead>
              <TableHead>{t.custAddress}</TableHead>
              <TableHead className="text-right">{t.custLastPurchase}</TableHead>
              <TableHead className="text-right">{t.custTotalSpent}</TableHead>
              <TableHead className="w-24 text-center">{t.custPurchaseHistory}</TableHead>
              <TableHead className="text-right">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmpty colSpan={7} message={t.noData} />
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-slate-800 dark:text-white">
                    {c.fullName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-slate-500 dark:text-slate-400">
                    {c.address || '—'}
                  </TableCell>
                  <TableCell className="nums text-right text-xs text-slate-500">
                    {c.lastPurchaseDate ? formatDate(c.lastPurchaseDate) : t.custNoPurchase}
                  </TableCell>
                  <TableCell className="nums text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {c.totalSpent > 0 ? formatNumber(c.totalSpent) + " so'm" : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 px-2"
                      onClick={() => setPurchaseHistoryCustomer(c)}
                    >
                      <History size={14} />
                      <span className="hidden lg:inline">{t.custPurchaseHistory}</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                        aria-label={t.edit}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(c)}
                        aria-label={t.delete}
                        className="hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-400">{t.noData}</Card>
        ) : (
          filtered.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                  <User size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                    {c.fullName}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone size={12} className="text-slate-400" />
                    <span className="font-mono">{c.phone}</span>
                  </p>
                  {c.address && (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
                      <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2">{c.address}</span>
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      {c.lastPurchaseDate ? formatDate(c.lastPurchaseDate) : t.custNoPurchase}
                    </span>
                    {c.totalSpent > 0 && (
                      <span className="nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatNumber(c.totalSpent)} so'm
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                <Button variant="outline" size="sm" onClick={() => setPurchaseHistoryCustomer(c)}>
                  <History size={14} />
                  {t.custPurchaseHistory}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                  <Pencil size={14} />
                  {t.edit}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(c)}
                  className="hover:text-red-600"
                >
                  <Trash2 size={14} />
                  {t.delete}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.custEditCustomer : t.custAddCustomer}</DialogTitle>
            <DialogDescription>
              {editing ? '' : "Yangi klient ma'lumotlarini kiriting"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="cust-name">{t.custName} *</Label>
              <Input
                id="cust-name"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Ali Valiyev"
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="cust-phone">{t.custPhone} *</Label>
              <Input
                id="cust-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+998 90 123 45 67"
                className="mt-1.5"
                inputMode="tel"
              />
            </div>
            <div>
              <Label htmlFor="cust-address">{t.custAddress}</Label>
              <Input
                id="cust-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Toshkent, Yunusobod tumani..."
                className="mt-1.5"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{t.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CustomerPurchaseHistoryDialog
        customer={purchaseHistoryCustomer}
        outcomes={state.outcomes}
        open={!!purchaseHistoryCustomer}
        onOpenChange={(o) => {
          if (!o) setPurchaseHistoryCustomer(null);
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.custDeleteConfirm}
              {confirmDelete && (
                <span className="mt-2 block font-semibold text-slate-800 dark:text-white">
                  {confirmDelete.fullName}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
