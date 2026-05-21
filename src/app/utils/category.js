import { jsx as _jsx } from "react/jsx-runtime";
import { Box, Coins, Cylinder, FileText, GlassWater, Layers, Package, } from 'lucide-react';
import { cn } from '../components/ui/utils';
const META = {
    paper: {
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
        iconBox: 'border border-amber-200/90 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/50',
        iconColor: 'text-amber-700 dark:text-amber-400',
        text: 'text-amber-700 dark:text-amber-400',
        bar: 'bg-amber-500',
        Icon: FileText,
    },
    plastic: {
        badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
        iconBox: 'border border-sky-200/90 bg-sky-50 dark:border-sky-800/60 dark:bg-sky-950/50',
        iconColor: 'text-sky-700 dark:text-sky-400',
        text: 'text-sky-700 dark:text-sky-400',
        bar: 'bg-sky-500',
        Icon: Cylinder,
    },
    glass: {
        badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200',
        iconBox: 'border border-cyan-200/90 bg-cyan-50 dark:border-cyan-800/60 dark:bg-cyan-950/50',
        iconColor: 'text-cyan-700 dark:text-cyan-400',
        text: 'text-cyan-700 dark:text-cyan-400',
        bar: 'bg-cyan-500',
        Icon: GlassWater,
    },
    metal: {
        badge: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
        iconBox: 'border border-slate-300/90 bg-slate-100 dark:border-slate-600 dark:bg-slate-800/80',
        iconColor: 'text-slate-600 dark:text-slate-300',
        text: 'text-slate-700 dark:text-slate-300',
        bar: 'bg-slate-500',
        Icon: Package,
    },
    cardboard: {
        badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
        iconBox: 'border border-orange-200/90 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-950/50',
        iconColor: 'text-orange-700 dark:text-orange-400',
        text: 'text-orange-700 dark:text-orange-400',
        bar: 'bg-orange-500',
        Icon: Box,
    },
    other: {
        badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200',
        iconBox: 'border border-violet-200/90 bg-violet-50 dark:border-violet-800/60 dark:bg-violet-950/50',
        iconColor: 'text-violet-700 dark:text-violet-400',
        text: 'text-violet-700 dark:text-violet-400',
        bar: 'bg-violet-500',
        Icon: Layers,
    },
};
const FALLBACK = {
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    iconBox: 'border border-emerald-200/90 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/50',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    Icon: Layers,
};
const COPPER_META = {
    badge: 'bg-orange-100 text-orange-900 dark:bg-orange-900/35 dark:text-orange-200',
    iconBox: 'border border-orange-300/90 bg-orange-50 dark:border-orange-700/60 dark:bg-orange-950/50',
    iconColor: 'text-orange-800 dark:text-orange-300',
    text: 'text-orange-800 dark:text-orange-300',
    bar: 'bg-orange-600',
    Icon: Coins,
};
function resolveCategoryId(key) {
    const lower = key.trim().toLowerCase();
    if (lower in META)
        return lower;
    if (/qog[''`ʻ]?oz|qo[''`]?qoz|paper|karton|kağız|қағоз|картон|qattiq\s*karton/i.test(lower)) {
        return 'paper';
    }
    if (/plastik|plastic|salafan|salfan|bakalash|qopqoq|qop\b|pet\b|polietilen|пластик|бакалаш/i.test(lower)) {
        return 'plastic';
    }
    if (/shisha|stakan|glass|ойна|стекло/i.test(lower))
        return 'glass';
    if (/mis\b|copper|медь/i.test(lower))
        return 'copper';
    if (/bronza|po[''`]?lat/i.test(lower))
        return 'metal';
    if (/alyumin|alumin|temir|metal|rangli|bolt|гвозд|металл/i.test(lower))
        return 'metal';
    if (/quti|yashik|cardboard|короб/i.test(lower))
        return 'cardboard';
    return 'other';
}
export function categoryMeta(key) {
    const id = resolveCategoryId(String(key));
    if (id === 'copper')
        return COPPER_META;
    if (id === 'other')
        return FALLBACK;
    return META[id];
}
const BOX_SIZE = { sm: 'h-7 w-7', md: 'h-10 w-10' };
const ICON_PX = { sm: 15, md: 20 };
/** Kichik inline ikon (badge, filtr). */
export function CategoryIconGlyph({ category, size = 16, className, }) {
    const { Icon, iconColor } = categoryMeta(category);
    return _jsx(Icon, { className: cn(iconColor, className), size: size, strokeWidth: 2, "aria-hidden": true });
}
/** Mahsulot qatori yonidagi kategoriya ikonkasi (SVG, emoji emas). */
export function CategoryProductIcon({ category, size = 'sm', className, }) {
    const meta = categoryMeta(category);
    const Icon = meta.Icon;
    const px = ICON_PX[size];
    return (_jsx("span", { className: cn('inline-flex shrink-0 items-center justify-center rounded-lg shadow-sm', meta.iconBox, BOX_SIZE[size], className), "aria-hidden": true, children: _jsx(Icon, { className: meta.iconColor, size: px, strokeWidth: 2 }) }));
}
export function categoryLabel(key, t) {
    switch (key) {
        case 'paper':
            return t.catPaper;
        case 'plastic':
            return t.catPlastic;
        case 'glass':
            return t.catGlass;
        case 'metal':
            return t.catMetal;
        case 'cardboard':
            return t.catCardboard;
        case 'other':
            return t.catOther;
        default:
            return key;
    }
}
