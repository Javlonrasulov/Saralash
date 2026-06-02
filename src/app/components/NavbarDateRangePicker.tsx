import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useApp } from '../i18n/app-context';
import { useNavDateFilter } from '../context/nav-date-range-context';
import { useStore } from '../store/saralash-store';
import type { NavDateFilter } from '../lib/nav-date-range';
import {
  addDays,
  clampYmdToMax,
  collectGoodsIntakeYmdSet,
  endOfMonth,
  formatYmdDisplay,
  parseDdMmYyyy,
  startOfMonth,
  startOfWeekMonday,
  todayYmd,
  ymdFromDate,
} from '../lib/nav-date-range';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from './ui/utils';

function monthGridCells(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

function localeFromLang(lang: string): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uz_cyrillic') return 'uz-UZ';
  return 'uz-Latn-UZ';
}

export function NavbarDateRangePicker() {
  const { t, lang } = useApp();
  const { filter, setFilter } = useNavDateFilter();
  const { state } = useStore();
  const maxYmd = todayYmd();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [draftFrom, setDraftFrom] = useState(todayYmd());
  const [draftTo, setDraftTo] = useState(todayYmd());
  const [fromInput, setFromInput] = useState(() => formatYmdDisplay(todayYmd()));
  const [toInput, setToInput] = useState(() => formatYmdDisplay(todayYmd()));
  const [activeField, setActiveField] = useState<'from' | 'to'>('from');
  const [pickHint, setPickHint] = useState<'start' | 'end'>('start');

  const locale = useMemo(() => localeFromLang(lang), [lang]);

  const monthTitle = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth, locale]);

  const weekdayLabels = useMemo(() => t.navWeekdayShort.split(',').map((s) => s.trim()), [t.navWeekdayShort]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(max-width: 639px)');
    const lock = () => {
      if (mq.matches) document.documentElement.classList.add('overflow-hidden');
    };
    const unlock = () => document.documentElement.classList.remove('overflow-hidden');
    lock();
    mq.addEventListener('change', lock);
    return () => {
      mq.removeEventListener('change', lock);
      unlock();
    };
  }, [open]);

  const syncInputsFromDraft = (from: string, to: string) => {
    setFromInput(formatYmdDisplay(from));
    setToInput(formatYmdDisplay(to));
  };

  useEffect(() => {
    if (!open) return;
    if (filter.mode === 'range') {
      const from = clampYmdToMax(filter.from, maxYmd);
      const to = clampYmdToMax(filter.to, maxYmd);
      const lo = from <= to ? from : to;
      const hi = from <= to ? to : from;
      setDraftFrom(lo);
      setDraftTo(hi);
      syncInputsFromDraft(lo, hi);
      const d = new Date(
        parseInt(lo.slice(0, 4), 10),
        parseInt(lo.slice(5, 7), 10) - 1,
        parseInt(lo.slice(8, 10), 10),
      );
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    } else {
      const t0 = maxYmd;
      setDraftFrom(t0);
      setDraftTo(t0);
      syncInputsFromDraft(t0, t0);
      const n = new Date();
      setViewYear(n.getFullYear());
      setViewMonth(n.getMonth());
    }
    setPickHint('start');
    setActiveField('from');
  }, [open, filter, maxYmd]);

  const triggerLabel =
    filter.mode === 'all'
      ? t.posDateRangeAll
      : `${formatYmdDisplay(filter.from)} — ${formatYmdDisplay(filter.to)}`;

  const draftRangeLabel = `${formatYmdDisplay(draftFrom)} — ${formatYmdDisplay(draftTo)}`;

  const applyPreset = (f: NavDateFilter) => {
    if (f.mode === 'all') {
      setFilter(f);
      setOpen(false);
      return;
    }
    setDraftFrom(f.from);
    setDraftTo(f.to);
    syncInputsFromDraft(f.from, f.to);
    const d = new Date(
      parseInt(f.from.slice(0, 4), 10),
      parseInt(f.from.slice(5, 7), 10) - 1,
      parseInt(f.from.slice(8, 10), 10),
    );
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setPickHint('end');
  };

  const presetToday = () => {
    const t0 = todayYmd();
    applyPreset({ mode: 'range', from: t0, to: t0 });
  };

  const presetWeek = () => {
    const s = startOfWeekMonday(new Date());
    const fromY = ymdFromDate(s);
    let toY = ymdFromDate(addDays(s, 6));
    if (toY > maxYmd) toY = maxYmd;
    applyPreset({ mode: 'range', from: fromY, to: toY });
  };

  const presetMonth = () => {
    const n = new Date();
    const s = startOfMonth(n);
    const e = endOfMonth(n);
    let toY = ymdFromDate(e);
    if (toY > maxYmd) toY = maxYmd;
    applyPreset({ mode: 'range', from: ymdFromDate(s), to: toY });
  };

  const clearRange = () => {
    setFilter({ mode: 'all' });
    setOpen(false);
  };

  const onDayClick = (day: number) => {
    const ymd = ymdFromDate(new Date(viewYear, viewMonth, day));
    if (ymd > maxYmd) return;
    if (pickHint === 'start' || !draftFrom) {
      setDraftFrom(ymd);
      setDraftTo(ymd);
      syncInputsFromDraft(ymd, ymd);
      setPickHint('end');
      setActiveField('to');
      return;
    }
    let a = draftFrom;
    let b = ymd;
    if (b < a) [a, b] = [b, a];
    setDraftFrom(a);
    setDraftTo(b);
    setPickHint('start');
    setActiveField('from');
    syncInputsFromDraft(a, b);
  };

  const applyDraft = () => {
    const pf = parseDdMmYyyy(fromInput);
    const pt = parseDdMmYyyy(toInput);
    let a = pf ?? draftFrom;
    let b = pt ?? draftTo;
    if (!a || !b) return;
    if (b < a) [a, b] = [b, a];
    setFilter({ mode: 'range', from: a, to: b });
    setOpen(false);
  };

  const commitFromInput = () => {
    const p = parseDdMmYyyy(fromInput);
    if (!p) {
      setFromInput(formatYmdDisplay(draftFrom));
      return;
    }
    const c = clampYmdToMax(p, maxYmd);
    let newTo = clampYmdToMax(draftTo, maxYmd);
    if (newTo < c) newTo = c;
    setDraftFrom(c);
    setDraftTo(newTo);
    syncInputsFromDraft(c, newTo);
  };

  const commitToInput = () => {
    const p = parseDdMmYyyy(toInput);
    if (!p) {
      setToInput(formatYmdDisplay(draftTo));
      return;
    }
    const c = clampYmdToMax(p, maxYmd);
    let newFrom = clampYmdToMax(draftFrom, maxYmd);
    if (newFrom > c) newFrom = c;
    setDraftFrom(newFrom);
    setDraftTo(c);
    syncInputsFromDraft(newFrom, c);
  };

  const cells = useMemo(() => monthGridCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const goodsIntakeDates = useMemo(
    () =>
      collectGoodsIntakeYmdSet({
        warehouseIncomeDates: state.warehouseItems.map((w) => w.incomeDate),
        purchaseIncomeDates: [
          ...state.supplierPurchases.map((p) => p.incomeDate),
          ...state.streetPurchases.map((p) => p.incomeDate),
        ],
      }),
    [state.warehouseItems, state.supplierPurchases, state.streetPurchases],
  );

  const now = new Date();
  const canGoNextMonth =
    viewYear < now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth < now.getMonth());

  const inRangeVisual = (ymd: string) => {
    if (!draftFrom || !draftTo) return false;
    const lo = draftFrom <= draftTo ? draftFrom : draftTo;
    const hi = draftFrom <= draftTo ? draftTo : draftFrom;
    return ymd >= lo && ymd <= hi;
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={triggerLabel}
          aria-label={triggerLabel}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-2.5 text-xs font-semibold text-indigo-800 transition-colors hover:border-indigo-300 hover:bg-indigo-50 sm:max-w-[14rem] sm:bg-white sm:px-2.5 sm:text-sm sm:text-slate-600 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:border-indigo-400 sm:dark:border-slate-700 sm:dark:bg-slate-800 sm:dark:text-slate-300',
            filter.mode === 'range' ? 'min-w-[7.5rem] max-w-[9.5rem] sm:min-w-0' : 'min-w-[6.5rem] sm:min-w-0',
          )}
        >
          <CalendarIcon size={16} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="truncate sm:max-w-[10rem]">{triggerLabel}</span>
        </button>
        {filter.mode === 'range' && (
          <button
            type="button"
            onClick={clearRange}
            title={t.navDateClearAria}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[84] bg-slate-900/30 sm:hidden"
            aria-label={t.cancel}
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              'fixed inset-x-0 bottom-0 z-[85] flex max-h-[min(92dvh,36rem)] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50',
              'sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:max-h-[min(32rem,calc(100dvh-6rem))] sm:w-[22rem] sm:rounded-2xl',
            )}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={presetToday}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.posDateRangeToday}
            </button>
            <button
              type="button"
              onClick={presetWeek}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.navDateThisWeek}
            </button>
            <button
              type="button"
              onClick={presetMonth}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.posDateRangeMonth}
            </button>
            <button
              type="button"
              onClick={() => applyPreset({ mode: 'all' })}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.posDateRangeAll}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {t.navDateFrom}
              </p>
              <Input
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                onFocus={() => {
                  setActiveField('from');
                  setPickHint('start');
                }}
                onBlur={commitFromInput}
                className={cn(
                  'h-9 rounded-xl text-xs',
                  activeField === 'from' && 'ring-2 ring-indigo-400/40 border-indigo-300',
                )}
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {t.navDateTo}
              </p>
              <Input
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onFocus={() => {
                  setActiveField('to');
                  setPickHint('end');
                }}
                onBlur={commitToInput}
                className={cn(
                  'h-9 rounded-xl text-xs',
                  activeField === 'to' && 'ring-2 ring-indigo-400/40 border-indigo-300',
                )}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
            <button
              type="button"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                const d = new Date(viewYear, viewMonth - 1, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <p className="text-sm font-semibold capitalize text-slate-800 dark:text-white">{monthTitle}</p>
            <button
              type="button"
              disabled={!canGoNextMonth}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-slate-800"
              onClick={() => {
                if (!canGoNextMonth) return;
                const d = new Date(viewYear, viewMonth + 1, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-slate-400">
            {weekdayLabels.map((w, i) => (
              <div key={i} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="mt-0.5 grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day == null) {
                return <div key={`e-${idx}`} className="aspect-square" />;
              }
              const ymd = ymdFromDate(new Date(viewYear, viewMonth, day));
              const isFuture = ymd > maxYmd;
              const isEdge = ymd === draftFrom || ymd === draftTo;
              const mid = inRangeVisual(ymd) && !isEdge && !isFuture;
              const hasGoodsIntake = !isFuture && goodsIntakeDates.has(ymd);
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={isFuture}
                  onClick={() => onDayClick(day)}
                  title={hasGoodsIntake ? t.navDateHasGoodsIntake : undefined}
                  className={cn(
                    'relative flex aspect-square flex-col items-center justify-center rounded-lg pb-1 text-xs font-medium transition-colors',
                    isFuture && 'cursor-not-allowed text-slate-300 opacity-35 dark:text-slate-600',
                    !isFuture &&
                      isEdge &&
                      'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500 dark:text-white',
                    !isFuture && mid && 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
                    !isFuture &&
                      !inRangeVisual(ymd) &&
                      'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
                  )}
                >
                  <span className="leading-none">{day}</span>
                  {hasGoodsIntake && (
                    <span
                      className={cn(
                        'mt-0.5 h-1 w-1 shrink-0 rounded-full',
                        isEdge ? 'bg-white/95' : 'bg-emerald-500 dark:bg-emerald-400',
                      )}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 space-y-1">
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <CalendarIcon size={12} className="shrink-0 opacity-70" />
              {pickHint === 'start' ? t.navDatePickStart : t.navDatePickEnd}
            </p>
            <p className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              {t.navDateGoodsIntakeLegend}
            </p>
          </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="nums mb-2.5 text-center text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                {draftRangeLabel}
              </p>
              <Button
                type="button"
                className="h-11 w-full rounded-xl text-sm font-semibold"
                onClick={applyDraft}
              >
                {t.navDateApply}
              </Button>
            </div>
        </div>
        </>
      )}
    </div>
  );
}
