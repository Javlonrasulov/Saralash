import React, { useMemo } from 'react';
import type { Customer, WarehouseOutcome } from '../store/saralash-store';
import { useApp } from '../i18n/app-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { formatDate, formatNumber } from '../utils/format';

function groupSoldByOrder(sold: WarehouseOutcome[]) {
  const map = new Map<string, WarehouseOutcome[]>();
  for (const o of sold) {
    const k = o.posOrderId ?? o.id;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(o);
  }
  const rows = [...map.entries()].map(([orderId, lines]) => {
    const first = lines[0];
    const total = lines.reduce((s, l) => s + (l.totalAmount ?? 0), 0);
    return { orderId, lines, first, total };
  });
  rows.sort((a, b) => b.first.date.localeCompare(a.first.date));
  return rows;
}

function formatOrderLines(lines: WarehouseOutcome[], unitPcsLabel: string) {
  return lines
    .map((l) => {
      const u = l.unit === 'kg' ? 'kg' : unitPcsLabel;
      return `${l.productName} (${formatNumber(l.quantity)} ${u})`;
    })
    .join(', ');
}

export function CustomerPurchaseHistoryDialog({
  customer,
  outcomes,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  outcomes: WarehouseOutcome[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useApp();

  const groups = useMemo(() => {
    if (!customer) return [];
    const sold = outcomes.filter(
      (o) => o.type === 'SOLD' && o.customerId === customer.id,
    );
    return groupSoldByOrder(sold);
  }, [customer, outcomes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <DialogTitle className="text-left">
            {customer ? `${t.custPurchaseHistory} — ${customer.fullName}` : t.custPurchaseHistory}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[min(70vh,520px)] overflow-x-auto overflow-y-auto px-4 py-3 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{t.date}</TableHead>
                <TableHead>{t.custHistoryProducts}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t.salesAmount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableEmpty colSpan={3} message={t.custNoPurchaseHistory} />
              ) : (
                groups.map((g) => (
                  <TableRow key={g.orderId}>
                    <TableCell className="align-top text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {formatDate(g.first.date)}
                    </TableCell>
                    <TableCell className="max-w-[min(100vw-8rem,28rem)] text-sm text-slate-800 dark:text-slate-100">
                      {formatOrderLines(g.lines, t.unitPcs)}
                    </TableCell>
                    <TableCell className="nums align-top text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatNumber(g.total)} so'm
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
