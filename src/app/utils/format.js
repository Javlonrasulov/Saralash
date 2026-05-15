export function toLocalDateString(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime()))
        return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
export const TODAY = toLocalDateString(new Date());
/** Butun son: mingliklar orasida oddiy bo'shliq (masalan 50 000) */
export function formatNumber(n) {
    if (!Number.isFinite(n))
        return '0';
    const rounded = Math.round(n);
    const neg = rounded < 0;
    const s = String(Math.abs(rounded));
    const parts = [];
    for (let i = s.length; i > 0; i -= 3) {
        parts.unshift(s.slice(Math.max(0, i - 3), i));
    }
    return (neg ? '-' : '') + parts.join(' ');
}
/**
 * Summa kiritish maydoni uchun: faqat raqamlar, mingliklar orasida oddiy bo'shliq (masalan 200000 → "200 000").
 */
export function formatMoneyInputDisplay(raw) {
    const digits = raw.replace(/\s/g, '').replace(/[^\d]/g, '');
    if (!digits)
        return '';
    const trimmed = digits.replace(/^0+(?=\d)/, '') || '0';
    const parts = [];
    for (let i = trimmed.length; i > 0; i -= 3) {
        parts.unshift(trimmed.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
}
export function formatDecimal(n, digits = 2) {
    if (!Number.isFinite(n))
        return '0';
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    }).format(n);
}
export function formatKg(kg) {
    if (!Number.isFinite(kg))
        return '0 kg';
    if (kg >= 1000)
        return `${formatDecimal(kg / 1000, 2)} t`;
    return `${formatDecimal(kg, 2)} kg`;
}
export function formatDate(date) {
    if (!date)
        return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime()))
        return date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
}
export function formatDateTime(date) {
    if (!date)
        return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime()))
        return date;
    return `${formatDate(date)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
