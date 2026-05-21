export function toLocalDateString(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const TODAY = toLocalDateString(new Date());

/** Butun son: mingliklar orasida oddiy bo'shliq (masalan 50 000) */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n);
  const neg = rounded < 0;
  const s = String(Math.abs(rounded));
  const parts: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    parts.unshift(s.slice(Math.max(0, i - 3), i));
  }
  return (neg ? '-' : '') + parts.join(' ');
}

/** Miqdor (kg: 2,3; dona: butun son). */
export function formatQuantity(n: number, unit: 'kg' | 'pcs' = 'kg'): string {
  if (!Number.isFinite(n)) return '0';
  if (unit === 'pcs') return formatNumber(Math.floor(n));
  const v = Math.round(n * 1000) / 1000;
  const neg = v < 0;
  const abs = Math.abs(v);
  const intPart = Math.floor(abs);
  const frac = Math.round((abs - intPart) * 1000);
  const intStr = formatNumber(intPart);
  if (frac <= 0) return (neg ? '-' : '') + intStr;
  const fracStr = String(frac).padStart(3, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${intStr},${fracStr}`;
}

/**
 * Summa kiritish maydoni uchun: faqat raqamlar, mingliklar orasida oddiy bo'shliq (masalan 200000 → "200 000").
 */
export function formatMoneyInputDisplay(raw: string): string {
  const digits = raw.replace(/\s/g, '').replace(/[^\d]/g, '');
  if (!digits) return '';
  const trimmed = digits.replace(/^0+(?=\d)/, '') || '0';
  const parts: string[] = [];
  for (let i = trimmed.length; i > 0; i -= 3) {
    parts.unshift(trimmed.slice(Math.max(0, i - 3), i));
  }
  return parts.join(' ');
}

export function formatDecimal(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatKg(kg: number): string {
  if (!Number.isFinite(kg)) return '0 kg';
  if (kg >= 1000) return `${formatDecimal(kg / 1000, 2)} t`;
  return `${formatDecimal(kg, 2)} kg`;
}

export function formatDate(date: string): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

export function formatDateTime(date: string): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${formatDate(date)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
