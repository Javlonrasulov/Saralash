import { useState } from 'react';
import {
  Box,
  Coins,
  Cylinder,
  FileText,
  GlassWater,
  Layers,
  Package,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryKey } from '../store/saralash-store';
import type { T } from '../i18n/translations';
import { cn } from '../components/ui/utils';

export interface CategoryMeta {
  badge: string;
  iconBox: string;
  iconColor: string;
  text: string;
  bar: string;
  Icon: LucideIcon;
}

const META: Record<string, CategoryMeta> = {
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

const FALLBACK: CategoryMeta = {
  badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  iconBox: 'border border-emerald-200/90 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/50',
  iconColor: 'text-emerald-700 dark:text-emerald-400',
  text: 'text-emerald-700 dark:text-emerald-400',
  bar: 'bg-emerald-500',
  Icon: Layers,
};

const COPPER_META: CategoryMeta = {
  badge: 'bg-orange-100 text-orange-900 dark:bg-orange-900/35 dark:text-orange-200',
  iconBox: 'border border-orange-300/90 bg-orange-50 dark:border-orange-700/60 dark:bg-orange-950/50',
  iconColor: 'text-orange-800 dark:text-orange-300',
  text: 'text-orange-800 dark:text-orange-300',
  bar: 'bg-orange-600',
  Icon: Coins,
};

export type ProductIconKey = keyof typeof META | 'copper' | 'other';

export const PRODUCT_ICON_OPTIONS: ProductIconKey[] = [
  'paper',
  'plastic',
  'glass',
  'metal',
  'copper',
  'cardboard',
  'other',
];

/** Saqlanadigan rasm identifikatori (`productIconKey` maydoni). */
export type ProductIconPhotoId = string;

export interface ProductIconPickerOption {
  id: ProductIconPhotoId;
  group: ProductIconKey;
}

const ICON_PHOTO = (name: string) => `/product-icons/${name}.jpg`;

/** Tanlov panelidagi barcha rasmlar (har guruhdan 3 ta variant). */
export const PRODUCT_ICON_PICKER_OPTIONS: ProductIconPickerOption[] = [
  { id: 'paper', group: 'paper' },
  { id: 'paper-2', group: 'paper' },
  { id: 'paper-3', group: 'paper' },
  { id: 'plastic', group: 'plastic' },
  { id: 'plastic-2', group: 'plastic' },
  { id: 'plastic-3', group: 'plastic' },
  { id: 'glass', group: 'glass' },
  { id: 'glass-2', group: 'glass' },
  { id: 'glass-3', group: 'glass' },
  { id: 'metal', group: 'metal' },
  { id: 'metal-2', group: 'metal' },
  { id: 'metal-3', group: 'metal' },
  { id: 'copper', group: 'copper' },
  { id: 'copper-2', group: 'copper' },
  { id: 'copper-3', group: 'copper' },
  { id: 'cardboard', group: 'cardboard' },
  { id: 'cardboard-2', group: 'cardboard' },
  { id: 'cardboard-3', group: 'cardboard' },
  { id: 'other', group: 'other' },
  { id: 'other-2', group: 'other' },
  { id: 'other-3', group: 'other' },
];

const PRODUCT_ICON_PHOTO_SRC: Record<string, string> = Object.fromEntries(
  PRODUCT_ICON_PICKER_OPTIONS.map((o) => [o.id, ICON_PHOTO(o.id)]),
);

const PICKER_BY_ID = new Map(PRODUCT_ICON_PICKER_OPTIONS.map((o) => [o.id, o]));

/** Guruh bo‘yicha tanlov (UI uchun). */
export const PRODUCT_ICON_PICKER_GROUPS: ProductIconKey[] = [
  'paper',
  'plastic',
  'glass',
  'metal',
  'copper',
  'cardboard',
  'other',
];

export function isProductIconPhotoId(v: string): boolean {
  return v in PRODUCT_ICON_PHOTO_SRC;
}

export function resolveIconGroup(iconId: string): ProductIconKey {
  const opt = PICKER_BY_ID.get(iconId);
  if (opt) return opt.group;
  if (isProductIconKey(iconId)) return iconId;
  return 'other';
}

export function productIconPhotoSrc(iconId: string): string {
  return PRODUCT_ICON_PHOTO_SRC[iconId] ?? PRODUCT_ICON_PHOTO_SRC.other;
}

type ResolvedCategoryId = ProductIconKey;

export function isProductIconKey(v: string): v is ProductIconKey {
  return (PRODUCT_ICON_OPTIONS as string[]).includes(v);
}

export function resolveProductIconKey(category: CategoryKey): ProductIconKey {
  return resolveCategoryId(String(category));
}

/** Ro‘yxatda ko‘rsatish: saqlangan rasm id yoki kategoriyadan asosiy rasm. */
export function warehouseDisplayIconId(item: {
  category: CategoryKey;
  productIconKey?: string | null;
}): ProductIconPhotoId {
  const raw = item.productIconKey?.trim();
  if (raw && isProductIconPhotoId(raw)) return raw;
  return resolveProductIconKey(item.category);
}

/** @deprecated `warehouseDisplayIconId` ishlating */
export function warehouseDisplayIconKey(item: {
  category: CategoryKey;
  productIconKey?: string | null;
}): ProductIconKey {
  return resolveIconGroup(warehouseDisplayIconId(item));
}

export function productIconMeta(key: ProductIconKey): CategoryMeta {
  if (key === 'copper') return COPPER_META;
  if (key === 'other') return FALLBACK;
  return META[key];
}

function resolveCategoryId(key: string): ResolvedCategoryId {
  const lower = key.trim().toLowerCase();
  if (lower in META) return lower as keyof typeof META;

  if (/qog[''`ʻ]?oz|qo[''`]?qoz|paper|karton|kağız|қағоз|картон|qattiq\s*karton/i.test(lower)) {
    return 'paper';
  }
  if (
    /plastik|plastic|salafan|salfan|bakalash|qopqoq|qop\b|pet\b|polietilen|пластик|бакалаш/i.test(
      lower,
    )
  ) {
    return 'plastic';
  }
  if (/shisha|stakan|glass|ойна|стекло/i.test(lower)) return 'glass';
  if (/mis\b|copper|медь/i.test(lower)) return 'copper';
  if (/bronza|po[''`]?lat/i.test(lower)) return 'metal';
  if (/alyumin|alumin|temir|metal|rangli|bolt|гвозд|металл/i.test(lower)) return 'metal';
  if (/quti|yashik|cardboard|короб/i.test(lower)) return 'cardboard';

  return 'other';
}

export function categoryMeta(key: CategoryKey): CategoryMeta {
  return productIconMeta(resolveCategoryId(String(key)));
}

const BOX_SIZE = { sm: 'h-7 w-7', md: 'h-10 w-10' } as const;
const PHOTO_SIZE = { sm: 'h-9 w-9', md: 'h-12 w-12', lg: 'h-16 w-16' } as const;
const ICON_PX = { sm: 15, md: 20 } as const;

/** Kichik inline ikon (badge, filtr). */
export function CategoryIconGlyph({
  category,
  size = 16,
  className,
}: {
  category: CategoryKey;
  size?: number;
  className?: string;
}) {
  const { Icon, iconColor } = categoryMeta(category);
  return <Icon className={cn(iconColor, className)} size={size} strokeWidth={2} aria-hidden />;
}

function CategoryProductIconSvg({
  meta,
  size,
  className,
}: {
  meta: CategoryMeta;
  size: 'sm' | 'md';
  className?: string;
}) {
  const Icon = meta.Icon;
  const px = ICON_PX[size];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg shadow-sm',
        meta.iconBox,
        BOX_SIZE[size],
        className,
      )}
      aria-hidden
    >
      <Icon className={meta.iconColor} size={px} strokeWidth={2} />
    </span>
  );
}

/** Mahsulot qatori yonidagi belgi — asosan fotosurat, SVG zaxira. */
export function CategoryProductIcon({
  category,
  iconKey,
  size = 'sm',
  variant = 'photo',
  className,
}: {
  category?: CategoryKey;
  /** Saqlangan rasm id yoki guruh kaliti; bo‘lmasa `category` bo‘yicha taxmin. */
  iconKey?: ProductIconPhotoId | ProductIconKey | null;
  size?: 'sm' | 'md' | 'lg';
  /** `photo` — haqiqiy rasm; `svg` — Lucide belgi. */
  variant?: 'photo' | 'svg';
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const iconId =
    iconKey != null && String(iconKey).trim() !== ''
      ? String(iconKey)
      : category != null
        ? resolveProductIconKey(category)
        : 'other';
  const meta = productIconMeta(resolveIconGroup(iconId));
  const svgSize = size === 'lg' ? 'md' : size;

  if (variant === 'svg' || imgFailed) {
    return <CategoryProductIconSvg meta={meta} size={svgSize} className={className} />;
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 shadow-sm dark:border-slate-600 dark:bg-slate-800',
        PHOTO_SIZE[size],
        className,
      )}
      aria-hidden
    >
      <img
        src={productIconPhotoSrc(iconId)}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
      />
    </span>
  );
}

export function categoryLabel(key: CategoryKey, t: T): string {
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

/** Tanlov tugmasi ostidagi qisqa yozuv. */
export function productIconPickerLabel(iconId: string, t: T): string {
  const group = resolveIconGroup(iconId);
  const base = productIconLabel(group, t);
  const variant = iconId.match(/-(\d+)$/)?.[1];
  return variant ? `${base} · ${variant}` : base;
}

/** Mahsulot ikonkasi tanlovi (qog‘oz, plastik, mis …). */
export function productIconLabel(key: ProductIconKey, t: T): string {
  switch (key) {
    case 'paper':
      return t.catPaper;
    case 'plastic':
      return t.catPlastic;
    case 'glass':
      return t.catGlass;
    case 'metal':
      return t.catMetal;
    case 'copper':
      return t.catCopper;
    case 'cardboard':
      return t.catCardboard;
    case 'other':
      return t.catOther;
    default:
      return key;
  }
}
