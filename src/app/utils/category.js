const META = {
    paper: {
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        iconBg: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        bar: 'bg-amber-500',
        emoji: '📄',
    },
    plastic: {
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        iconBg: 'bg-blue-500',
        text: 'text-blue-600 dark:text-blue-400',
        bar: 'bg-blue-500',
        emoji: '🧴',
    },
    glass: {
        badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
        iconBg: 'bg-cyan-500',
        text: 'text-cyan-600 dark:text-cyan-400',
        bar: 'bg-cyan-500',
        emoji: '🍾',
    },
    metal: {
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
        iconBg: 'bg-slate-500',
        text: 'text-slate-600 dark:text-slate-300',
        bar: 'bg-slate-500',
        emoji: '🔩',
    },
    cardboard: {
        badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
        iconBg: 'bg-orange-500',
        text: 'text-orange-600 dark:text-orange-400',
        bar: 'bg-orange-500',
        emoji: '📦',
    },
    other: {
        badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
        iconBg: 'bg-violet-500',
        text: 'text-violet-600 dark:text-violet-400',
        bar: 'bg-violet-500',
        emoji: '🗂️',
    },
};
const FALLBACK = {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    iconBg: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    emoji: '🏷️',
};
export function categoryMeta(key) {
    return META[key] ?? FALLBACK;
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
