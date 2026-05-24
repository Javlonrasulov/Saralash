import React, { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  formatQtyPartsExpression,
  lineQtyTotal,
} from '../utils/purchase-qty-parts';
import { formatQuantity } from '../utils/format';

interface CumulativeQuantityFieldProps {
  label: React.ReactNode;
  quantity: string;
  qtyParts: number[];
  unit: 'kg' | 'pcs';
  unitLabel: string;
  runningTotalLabel: string;
  addAriaLabel: string;
  placeholder?: string;
  pcsHint?: string;
  onQuantityChange: (value: string) => void;
  onAddPart: () => void;
}

export function CumulativeQuantityField({
  label,
  quantity,
  qtyParts,
  unit,
  unitLabel,
  runningTotalLabel,
  addAriaLabel,
  placeholder,
  pcsHint,
  onQuantityChange,
  onAddPart,
}: CumulativeQuantityFieldProps) {
  const exprRef = useRef<HTMLDivElement>(null);
  const parts = qtyParts;
  const total = lineQtyTotal({ quantity, qtyParts: parts }, false);
  const expr = formatQtyPartsExpression(parts, unit);

  useEffect(() => {
    const el = exprRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [expr]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddPart();
    }
  };

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex gap-2">
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-400/30 dark:border-slate-700 dark:bg-slate-800">
          {expr ? (
            <div
              ref={exprRef}
              className="flex max-w-[58%] shrink-0 items-center overflow-x-auto border-r border-slate-100 px-2.5 py-2 text-sm font-medium text-slate-700 scrollbar-none dark:border-slate-700 dark:text-slate-200 sm:max-w-[65%]"
              title={quantity.trim() ? `${expr}+${quantity}` : expr}
            >
              <span className="nums whitespace-nowrap">{expr}</span>
              {quantity.trim() ? <span className="ml-0.5 text-slate-400">+</span> : null}
            </div>
          ) : null}
          <Input
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-[3.5rem] flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
            inputMode="decimal"
            placeholder={placeholder}
          />
        </div>
        <Button
          type="button"
          variant="default"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          aria-label={addAriaLabel}
          onClick={onAddPart}
        >
          <Plus size={18} />
        </Button>
      </div>
      {total > 0 && (
        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
          {runningTotalLabel}:{' '}
          <span className="nums font-semibold text-indigo-700 dark:text-indigo-300">
            {formatQuantity(total, unit)} {unitLabel}
          </span>
        </p>
      )}
      {unit === 'pcs' && pcsHint ? (
        <p className="mt-1 text-[10px] text-slate-500">{pcsHint}</p>
      ) : null}
    </div>
  );
}
