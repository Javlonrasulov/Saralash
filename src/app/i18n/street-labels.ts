import type { Language, T } from './translations';

/** Barcha `t.*` kalitlari (joriy va `street*` kengaytmalari). */
export type TWithStreet = T & Record<string, string>;

const replacers: Record<Language, (s: string) => string> = {
  uz_latin: (s) =>
    s
      .replace(/Bazaga/g, "Ko'cha obyektiga")
      .replace(/Bazadan/g, "Ko'cha obyektidan")
      .replace(/bazalar/g, "ko'cha obyektlari")
      .replace(/bazani/g, "ko'cha obyektini")
      .replace(/Bazani/g, "Ko'cha obyektini")
      .replace(/Bazalar/g, "Ko'cha obyektlari")
      .replace(/baza/g, "ko'cha obyekti")
      .replace(/Baza/g, "Ko'cha obyekti"),
  uz_cyrillic: (s) =>
    s
      .replace(/Базага/g, 'Кўча объектига')
      .replace(/Базадан/g, 'Кўча объектидан')
      .replace(/базалар/g, 'кўча объектлари')
      .replace(/базани/g, 'кўча объектини')
      .replace(/Базани/g, 'Кўча объектини')
      .replace(/Базалар/g, 'Кўча объектлари')
      .replace(/база/g, 'кўча объекти')
      .replace(/База/g, 'Кўча объекти'),
  ru: (s) =>
    s
      .replace(/базе/g, 'уличному объекту')
      .replace(/Базе/g, 'Уличному объекту')
      .replace(/базы/g, 'уличных объектов')
      .replace(/Базы/g, 'Уличных объектов')
      .replace(/база/g, 'уличный объект')
      .replace(/База/g, 'Уличный объект'),
};

const navStreet: Record<Language, string> = {
  uz_latin: "Ko'cha obyektlari olish",
  uz_cyrillic: 'Кўча объектлари олиш',
  ru: 'Уличные объекты — получение',
};

const whStreetPurchase: Record<Language, string> = {
  uz_latin: "Ko'cha obyektlari narxi (1 birlik, soʻm, ixtiyoriy)",
  uz_cyrillic: 'Кўча объектлари нархи (1 бирлик, сўм, ихтиёрий)',
  ru: 'Цена закупки с уличного объекта (за 1 ед., сум, необязательно)',
};

/** `supp*` matnlardan `street*` kalitlarini hosil qiladi (alohida tarjima fayli kerak emas). */
export function extendWithStreetLabels(base: T, lang: Language): TWithStreet {
  const repl = replacers[lang];
  const extra: Record<string, string> = {
    navStreetObjects: navStreet[lang],
    whStreetPurchasePricePerUnit: whStreetPurchase[lang],
  };

  for (const key of Object.keys(base) as (keyof T)[]) {
    const k = String(key);
    if (!k.startsWith('supp')) continue;
    const sk = `street${k.slice(4)}`;
    const val = base[key];
    if (typeof val === 'string') extra[sk] = repl(val);
  }

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
      streetTitle: "Ko'cha obyektlari olish",
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
      streetTitle: 'Кўча объектлари олиш',
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
      streetTitle: 'Уличные объекты — получение',
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
