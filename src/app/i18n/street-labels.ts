import type { Language, T } from './translations';

/** Barcha `t.*` kalitlari (joriy va `street*` kengaytmalari). */
export type TWithStreet = T & Record<string, string>;

/** `supp*` matnlardan `street*` kalitlarini hosil qiladi (alohida tarjima fayli kerak emas). */
export function extendWithStreetLabels(base: T, lang: Language): TWithStreet {
  const extra: Record<string, string> = {};

  for (const key of Object.keys(base) as (keyof T)[]) {
    const k = String(key);
    if (!k.startsWith('supp')) continue;
    const sk = `street${k.slice(4)}`;
    const val = base[key];
    if (typeof val === 'string') extra[sk] = val;
  }

  const navStreet: Record<Language, string> = {
    uz_latin: 'Baza olish',
    uz_cyrillic: 'База олиш',
    ru: 'База — получение',
  };

  const whStreetPurchase: Record<Language, string> = {
    uz_latin: 'Baza narxi (1 birlik, soʻm, ixtiyoriy)',
    uz_cyrillic: 'База нархи (1 бирлик, сўм, ихтиёрий)',
    ru: 'Цена закупки с базы (за 1 ед., сум, необязательно)',
  };

  extra.navStreetObjects = navStreet[lang];
  extra.whStreetPurchasePricePerUnit = whStreetPurchase[lang];

  const streetOnly: Record<Language, Record<string, string>> = {
    uz_latin: {
      streetDailyPurchaseSummaryDay: 'Olingan mahsulotlar',
      streetDailyPurchaseEmptyDay: 'Bu kunda xarid qayd etilmagan',
      streetQtyRunningTotal: 'Jami miqdor',
      streetQtyAddPart: "Qo'shish",
      streetHistoryPeriodSummary: 'Tanlangan davr xulosasi',
      streetHistoryPeriodGrandTotal: 'Jami xarid summasi',
      streetHistoryPeriodEmpty: 'Bu davrda xarid qayd etilmagan',
      streetHistoryPeriodByProduct: 'Mahsulotlar bo‘yicha',
      streetTitle: 'Baza',
    },
    uz_cyrillic: {
      streetDailyPurchaseSummaryDay: 'Олинган маҳсулотлар',
      streetDailyPurchaseEmptyDay: 'Бу кунда харид қайд этилмаган',
      streetQtyRunningTotal: 'Жами миқдор',
      streetQtyAddPart: 'Қўшиш',
      streetHistoryPeriodSummary: 'Танланган давр хулосаси',
      streetHistoryPeriodGrandTotal: 'Жами харид суммаси',
      streetHistoryPeriodEmpty: 'Бу даврда харид қайд этилмаган',
      streetHistoryPeriodByProduct: 'Маҳсулотлар бўйича',
      streetTitle: 'База',
    },
    ru: {
      streetDailyPurchaseSummaryDay: 'Закуплено',
      streetDailyPurchaseEmptyDay: 'За этот день закупок нет',
      streetQtyRunningTotal: 'Итого количество',
      streetQtyAddPart: 'Добавить',
      streetHistoryPeriodSummary: 'Итог за период',
      streetHistoryPeriodGrandTotal: 'Сумма закупок',
      streetHistoryPeriodEmpty: 'За период закупок нет',
      streetHistoryPeriodByProduct: 'По товарам',
      streetTitle: 'База',
    },
  };
  Object.assign(extra, streetOnly[lang]);

  const suppOnly: Record<string, string> = {
    suppDailyPurchaseSummaryDay: streetOnly[lang].streetDailyPurchaseSummaryDay,
    suppDailyPurchaseEmptyDay: streetOnly[lang].streetDailyPurchaseEmptyDay,
    suppQtyRunningTotal: streetOnly[lang].streetQtyRunningTotal,
    suppQtyAddPart: streetOnly[lang].streetQtyAddPart,
    suppHistoryPeriodSummary: streetOnly[lang].streetHistoryPeriodSummary,
    suppHistoryPeriodGrandTotal: streetOnly[lang].streetHistoryPeriodGrandTotal,
    suppHistoryPeriodEmpty: streetOnly[lang].streetHistoryPeriodEmpty,
    suppHistoryPeriodByProduct: streetOnly[lang].streetHistoryPeriodByProduct,
  };
  const baseMap = base as unknown as Record<string, string | undefined>;
  for (const [k, v] of Object.entries(suppOnly)) {
    if (!(k in baseMap) || !baseMap[k]) extra[k] = v;
  }

  return { ...base, ...extra } as TWithStreet;
}
