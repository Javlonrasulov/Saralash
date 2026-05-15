import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Phone, MapPin, User, History, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, } from '../components/ui/table';
import { formatDate, formatMoneyInputDisplay, formatNumber, TODAY } from '../utils/format';
import { CustomerPurchaseHistoryDialog } from '../components/CustomerPurchaseHistoryDialog';
const EMPTY_FORM = { fullName: '', phone: '', address: '' };
export function Customers() {
    const { state, addCustomer, updateCustomer, deleteCustomer, recordCustomerDebtRepayment } = useStore();
    const { t } = useApp();
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [purchaseHistoryCustomer, setPurchaseHistoryCustomer] = useState(null);
    const [debtPayCustomer, setDebtPayCustomer] = useState(null);
    const [debtPayAmount, setDebtPayAmount] = useState('');
    const [debtPayDate, setDebtPayDate] = useState(TODAY);
    const [debtPayNotes, setDebtPayNotes] = useState('');
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return state.customers;
        return state.customers.filter((c) => c.fullName.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q));
    }, [state.customers, search]);
    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };
    const openEdit = (customer) => {
        setEditing(customer);
        setForm({
            fullName: customer.fullName,
            phone: customer.phone,
            address: customer.address,
        });
        setDialogOpen(true);
    };
    const handleSubmit = (e) => {
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
        }
        else {
            addCustomer(trimmed);
            toast.success(t.add);
        }
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        setEditing(null);
    };
    const handleDelete = () => {
        if (!confirmDelete)
            return;
        deleteCustomer(confirmDelete.id);
        toast.success(t.delete);
        setConfirmDelete(null);
    };
    const openDebtPay = (c) => {
        if (c.balanceDue <= 0.01) {
            toast.error(t.custDebtPayNoDebt);
            return;
        }
        setDebtPayCustomer(c);
        setDebtPayAmount(formatMoneyInputDisplay(String(Math.round(c.balanceDue))));
        setDebtPayDate(TODAY);
        setDebtPayNotes('');
    };
    const submitDebtPay = (e) => {
        e.preventDefault();
        if (!debtPayCustomer)
            return;
        const amt = parseFloat(debtPayAmount.replace(/\s/g, '').replace(',', '.'));
        if (!Number.isFinite(amt) || amt <= 0) {
            toast.error(t.custDebtPayInvalid);
            return;
        }
        const ok = recordCustomerDebtRepayment(debtPayCustomer.id, {
            amount: amt,
            date: debtPayDate,
            notes: debtPayNotes.trim() || undefined,
        });
        if (!ok) {
            toast.error(t.custDebtPayInvalid);
            return;
        }
        toast.success(t.custDebtPaySuccess);
        setDebtPayCustomer(null);
        setDebtPayAmount('');
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: t.custSearchPlaceholder, className: "pl-9" })] }), _jsxs(Button, { onClick: openCreate, className: "shrink-0", children: [_jsx(Plus, { size: 16 }), t.custAddCustomer] })] }) }), _jsx(Card, { className: "hidden overflow-hidden md:block", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t.custName }), _jsx(TableHead, { children: t.custPhone }), _jsx(TableHead, { children: t.custAddress }), _jsx(TableHead, { className: "text-right", children: t.custLastPurchase }), _jsx(TableHead, { className: "text-right", children: t.custTotalSpent }), _jsx(TableHead, { className: "text-right", children: t.posDebtLabel }), _jsx(TableHead, { className: "w-28 text-center", children: t.custDebtPayment }), _jsx(TableHead, { className: "w-24 text-center", children: t.custPurchaseHistory }), _jsx(TableHead, { className: "text-right", children: t.actions })] }) }), _jsx(TableBody, { children: filtered.length === 0 ? (_jsx(TableEmpty, { colSpan: 9, message: t.noData })) : (filtered.map((c) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium text-slate-800 dark:text-white", children: c.fullName }), _jsx(TableCell, { className: "font-mono text-xs", children: c.phone }), _jsx(TableCell, { className: "max-w-[16rem] truncate text-slate-500 dark:text-slate-400", children: c.address || '—' }), _jsx(TableCell, { className: "nums text-right text-xs text-slate-500", children: c.lastPurchaseDate ? formatDate(c.lastPurchaseDate) : t.custNoPurchase }), _jsx(TableCell, { className: "nums text-right font-semibold text-emerald-600 dark:text-emerald-400", children: c.totalSpent > 0 ? formatNumber(c.totalSpent) + " so'm" : '—' }), _jsxs(TableCell, { className: `nums text-right ${c.balanceDue > 0.01 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-400'}`, children: [formatNumber(c.balanceDue), " so'm"] }), _jsx(TableCell, { className: "text-center", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "h-8 gap-1 px-2", disabled: c.balanceDue <= 0.01, onClick: () => openDebtPay(c), children: [_jsx(Wallet, { size: 14 }), _jsx("span", { className: "hidden xl:inline", children: t.custDebtPayment })] }) }), _jsx(TableCell, { className: "text-center", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "h-8 gap-1 px-2", onClick: () => setPurchaseHistoryCustomer(c), children: [_jsx(History, { size: 14 }), _jsx("span", { className: "hidden lg:inline", children: t.custPurchaseHistory })] }) }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "inline-flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => openEdit(c), "aria-label": t.edit, children: _jsx(Pencil, { size: 14 }) }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => setConfirmDelete(c), "aria-label": t.delete, className: "hover:text-red-600 dark:hover:text-red-400", children: _jsx(Trash2, { size: 14 }) })] }) })] }, c.id)))) })] }) }), _jsx("div", { className: "space-y-3 md:hidden", children: filtered.length === 0 ? (_jsx(Card, { className: "p-8 text-center text-sm text-slate-400", children: t.noData })) : (filtered.map((c) => (_jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white", children: _jsx(User, { size: 16 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-semibold text-slate-800 dark:text-white", children: c.fullName }), _jsxs("p", { className: "mt-1 flex items-center gap-1.5 text-xs text-slate-500", children: [_jsx(Phone, { size: 12, className: "text-slate-400" }), _jsx("span", { className: "font-mono", children: c.phone })] }), c.address && (_jsxs("p", { className: "mt-1 flex items-start gap-1.5 text-xs text-slate-500", children: [_jsx(MapPin, { size: 12, className: "mt-0.5 shrink-0 text-slate-400" }), _jsx("span", { className: "line-clamp-2", children: c.address })] })), _jsxs("div", { className: "mt-2 flex items-center justify-between text-[11px]", children: [_jsx("span", { className: "text-slate-400", children: c.lastPurchaseDate ? formatDate(c.lastPurchaseDate) : t.custNoPurchase }), c.totalSpent > 0 && (_jsxs("span", { className: "nums font-semibold text-emerald-600 dark:text-emerald-400", children: [formatNumber(c.totalSpent), " so'm"] }))] }), _jsxs("div", { className: "mt-1 flex items-center justify-between text-[11px]", children: [_jsx("span", { className: "text-slate-500", children: t.posDebtLabel }), _jsxs("span", { className: `nums font-medium ${c.balanceDue > 0.01 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`, children: [formatNumber(c.balanceDue), " so'm"] })] })] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700", children: [_jsxs(Button, { variant: "outline", size: "sm", disabled: c.balanceDue <= 0.01, onClick: () => openDebtPay(c), children: [_jsx(Wallet, { size: 14 }), t.custDebtPayment] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setPurchaseHistoryCustomer(c), children: [_jsx(History, { size: 14 }), t.custPurchaseHistory] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => openEdit(c), children: [_jsx(Pencil, { size: 14 }), t.edit] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setConfirmDelete(c), className: "hover:text-red-600", children: [_jsx(Trash2, { size: 14 }), t.delete] })] })] }, c.id)))) }), _jsx(Dialog, { open: dialogOpen, onOpenChange: setDialogOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: editing ? t.custEditCustomer : t.custAddCustomer }), _jsx(DialogDescription, { children: editing ? '' : "Yangi klient ma'lumotlarini kiriting" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs(Label, { htmlFor: "cust-name", children: [t.custName, " *"] }), _jsx(Input, { id: "cust-name", value: form.fullName, onChange: (e) => setForm((f) => ({ ...f, fullName: e.target.value })), placeholder: "Ali Valiyev", className: "mt-1.5", autoFocus: true })] }), _jsxs("div", { children: [_jsxs(Label, { htmlFor: "cust-phone", children: [t.custPhone, " *"] }), _jsx(Input, { id: "cust-phone", value: form.phone, onChange: (e) => setForm((f) => ({ ...f, phone: e.target.value })), placeholder: "+998 90 123 45 67", className: "mt-1.5", inputMode: "tel" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "cust-address", children: t.custAddress }), _jsx(Input, { id: "cust-address", value: form.address, onChange: (e) => setForm((f) => ({ ...f, address: e.target.value })), placeholder: "Toshkent, Yunusobod tumani...", className: "mt-1.5" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setDialogOpen(false), children: t.cancel }), _jsx(Button, { type: "submit", children: t.save })] })] })] }) }), _jsx(Dialog, { open: !!debtPayCustomer, onOpenChange: (o) => {
                    if (!o)
                        setDebtPayCustomer(null);
                }, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t.custDebtPayTitle }), _jsx(DialogDescription, { children: debtPayCustomer && (_jsxs(_Fragment, { children: [_jsx("span", { className: "font-medium text-slate-800 dark:text-slate-100", children: debtPayCustomer.fullName }), _jsxs("span", { className: "mt-2 block text-sm", children: [t.custDebtPayCurrent, ":", ' ', _jsxs("span", { className: "nums font-semibold text-amber-600 dark:text-amber-400", children: [formatNumber(state.customers.find((x) => x.id === debtPayCustomer.id)?.balanceDue ?? 0), ' ', "so'm"] })] })] })) })] }), debtPayCustomer && (_jsxs("form", { onSubmit: submitDebtPay, className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "debt-amt", children: t.custDebtPayAmount }), _jsx(Input, { id: "debt-amt", className: "mt-1.5", inputMode: "numeric", value: debtPayAmount, onChange: (e) => setDebtPayAmount(formatMoneyInputDisplay(e.target.value)), autoFocus: true }), _jsxs("button", { type: "button", className: "mt-1 text-[11px] text-sky-600 hover:underline dark:text-sky-400", onClick: () => {
                                                const due = state.customers.find((x) => x.id === debtPayCustomer.id)?.balanceDue ?? 0;
                                                if (due > 0.01)
                                                    setDebtPayAmount(formatMoneyInputDisplay(String(Math.round(due))));
                                            }, children: ["= ", t.custDebtPayCurrent] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "debt-date", children: t.custDebtPayDate }), _jsx(Input, { id: "debt-date", type: "date", className: "mt-1.5", value: debtPayDate, onChange: (e) => setDebtPayDate(e.target.value) })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "debt-notes", children: t.custDebtPayNotes }), _jsx(Input, { id: "debt-notes", className: "mt-1.5", value: debtPayNotes, onChange: (e) => setDebtPayNotes(e.target.value) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setDebtPayCustomer(null), children: t.cancel }), _jsx(Button, { type: "submit", children: t.custDebtPaySubmit })] })] }))] }) }), _jsx(CustomerPurchaseHistoryDialog, { customer: purchaseHistoryCustomer, outcomes: state.outcomes, open: !!purchaseHistoryCustomer, onOpenChange: (o) => {
                    if (!o)
                        setPurchaseHistoryCustomer(null);
                } }), _jsx(AlertDialog, { open: !!confirmDelete, onOpenChange: (o) => !o && setConfirmDelete(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t.delete }), _jsxs(AlertDialogDescription, { children: [t.custDeleteConfirm, confirmDelete && (_jsx("span", { className: "mt-2 block font-semibold text-slate-800 dark:text-white", children: confirmDelete.fullName }))] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: t.cancel }), _jsx(AlertDialogAction, { onClick: handleDelete, children: t.delete })] })] }) })] }));
}
