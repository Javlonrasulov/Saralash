/** Navbar global sana filtri — `YYYY-MM-DD` qatorlari (inklyuziv). */
const YMD = /^\d{4}-\d{2}-\d{2}$/;
export function normalizeYmd(raw) {
    const d = String(raw).slice(0, 10);
    return YMD.test(d) ? d : '';
}
/** Omborga tovar kirimi bo‘lgan kunlar (`incomeDate`). */
export function collectGoodsIntakeYmdSet(sources) {
    const set = new Set();
    for (const raw of [...sources.warehouseIncomeDates, ...sources.purchaseIncomeDates]) {
        const ymd = normalizeYmd(raw);
        if (ymd)
            set.add(ymd);
    }
    return set;
}
export function isYmdInNavFilter(ymd, f) {
    if (f.mode === 'all')
        return true;
    const day = normalizeYmd(ymd);
    if (!day)
        return false;
    return day >= f.from && day <= f.to;
}
export function todayYmd() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
export function ymdFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function formatYmdDisplay(ymd) {
    const [y, m, d] = ymd.split('-');
    if (!y || !m || !d)
        return ymd;
    return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
}
/** `dd.mm.yyyy` → `YYYY-MM-DD` yoki null */
export function parseDdMmYyyy(s) {
    const t = s.trim().replace(/\s/g, '');
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
    if (!m)
        return null;
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31)
        return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
        return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function startOfWeekMonday(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
}
export function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
}
export function startOfMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
export function parseStoredNavFilter(raw) {
    if (!raw || typeof raw !== 'object')
        return { mode: 'all' };
    const o = raw;
    if (o.mode === 'all')
        return { mode: 'all' };
    if (o.mode === 'range' && typeof o.from === 'string' && typeof o.to === 'string') {
        const from = normalizeYmd(o.from);
        const to = normalizeYmd(o.to);
        if (from && to && from <= to)
            return { mode: 'range', from, to };
    }
    return { mode: 'all' };
}
/** `ymd` va `max` — `YYYY-MM-DD`; kelajakka tushmasligi uchun */
export function clampYmdToMax(ymd, max) {
    return ymd > max ? max : ymd;
}
/** Oralikni bugungi sanaga qadar qisqartiradi (kelajak yo‘q). */
export function clampFilterToToday(f) {
    const max = todayYmd();
    if (f.mode === 'all')
        return f;
    const from = normalizeYmd(f.from);
    const to = normalizeYmd(f.to);
    if (!from || !to)
        return { mode: 'all' };
    let a = clampYmdToMax(from, max);
    let b = clampYmdToMax(to, max);
    if (a > b)
        [a, b] = [b, a];
    return { mode: 'range', from: a, to: b };
}
