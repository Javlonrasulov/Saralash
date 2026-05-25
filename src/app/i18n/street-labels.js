/** Ko‘cha obyektlari sahifasi: `supp*` dan nusxa, lekin «baza» emas. */
const STREET_ENTITY_LABELS = {
    uz_latin: {
        navStreetObjects: "Ko'cha obyektlari",
        streetTitle: "Ko'cha obyektlari",
        streetIntro: "Bu yerda ko'cha obyektlarini ro'yxatga olasiz. «Xarid»da ombordagi mahsulot qatorini tanlab, kirim miqdorini shu qator qoldig'iga qo'shasiz.",
        streetName: "Ko'cha obyekt",
        streetAdd: "Yangi ko'cha obyekt",
        streetEdit: "Ko'cha obyektini tahrirlash",
        streetDeleteConfirm: "Ko'cha obyektini o'chirishni tasdiqlaysizmi? Ombordagi yozuvlar saqlanadi.",
        streetPurchasePickSupplier: "Ko'cha obyektini tanlash",
        streetDebtPreview: "Ko'cha obyektga qarz",
        streetHistorySearch: "Mahsulot, ko'cha obyekt...",
        streetHistoryFilterSupplier: "Ko'cha obyekt",
        streetHistoryColSupplier: "Ko'cha obyekt",
        streetDebtIntro: "Qarzga olingan xaridlar bo'yicha qoldiq. Ko'cha obyektga naqd berilgan summani bu yerda qayd eting — qoldiq kamayadi.",
        streetDebtNoSuppliers: "Ko'cha obyektlar yo'q",
        streetDebtRepayColSupplier: "Ko'cha obyekt",
        streetDebtOrphanBanner: "O'chirilgan ko'cha obyekt bilan bog'langan xaridlarda qarz qoldi (bu summani bu yerda to'lab bo'lmaydi):",
        streetSupplierPurchasesDialogDesc: "Bu ko'cha obyektdan olingan mahsulotlar: sana, miqdor, jami, to'langan va qarz.",
        streetPricePerUnit: "Ko'cha narxi (1 birlik, so'm, ixtiyoriy)",
        whStreetPurchasePricePerUnit: "Ko'cha narxi (1 birlik, so'm, ixtiyoriy)",
        whKochaPurchasePricePerUnit: "Ko'cha obyektlari (1 birlik, so'm, ixtiyoriy)",
        streetDailyPurchaseSummaryDay: 'Olingan mahsulotlar',
        streetDailyPurchaseEmptyDay: 'Bu kunda xarid qayd etilmagan',
        streetQtyRunningTotal: 'Jami miqdor',
        streetQtyAddPart: "Qo'shish",
        streetHistoryPeriodSummary: 'Tanlangan davr xulosasi',
        streetHistoryPeriodGrandTotal: 'Jami xarid summasi',
        streetHistoryPeriodEmpty: 'Bu davrda xarid qayd etilmagan',
        streetHistoryPeriodByProduct: 'Mahsulotlar bo‘yicha',
    },
    uz_cyrillic: {
        navStreetObjects: 'Кўча объектлари',
        streetTitle: 'Кўча объектлари',
        streetIntro: 'Бу ерда кўча объектларини рўйхатга оласиз. «Харид»да омбордаги маҳсулот қаторини танлаб, кирим миқдорини шу қатор қолдиғига қўшасиз.',
        streetName: 'Кўча объект',
        streetAdd: 'Янги кўча объект',
        streetEdit: 'Кўча объектни таҳрирлаш',
        streetDeleteConfirm: 'Кўча объектни ўчиришни тасдиқлайсизми? Омбордаги ёзувлар сақланади.',
        streetPurchasePickSupplier: 'Кўча объектни танлаш',
        streetDebtPreview: 'Кўча объектга қарз',
        streetHistorySearch: 'Маҳсулот, кўча объект...',
        streetHistoryFilterSupplier: 'Кўча объект',
        streetHistoryColSupplier: 'Кўча объект',
        streetDebtIntro: 'Қарзга олинган харидлар бўйича қолдиқ. Кўча объектга нақд берилган суммани бу ерда қайд этинг — қолдиқ камаяди.',
        streetDebtNoSuppliers: 'Кўча объектлар йўқ',
        streetDebtRepayColSupplier: 'Кўча объект',
        streetDebtOrphanBanner: 'Ўчирилган кўча объект билан боғланган харидларда қарз қолди (бу суммани бу ерда тўлаб бўлмайди):',
        streetSupplierPurchasesDialogDesc: 'Бу кўча объектдан олинган маҳсулотлар: сана, миқдор, жами, тўланган ва қарз.',
        streetPricePerUnit: 'Кўча нархи (1 бирлик, сўм, ихтиёрий)',
        whStreetPurchasePricePerUnit: 'Кўча нархи (1 бирлик, сўм, ихтиёрий)',
        whKochaPurchasePricePerUnit: 'Кўча объектлари (1 бирлик, сўм, ихтиёрий)',
        streetDailyPurchaseSummaryDay: 'Олинган маҳсулотлар',
        streetDailyPurchaseEmptyDay: 'Бу кунда харид қайд этилмаган',
        streetQtyRunningTotal: 'Жами миқдор',
        streetQtyAddPart: 'Қўшиш',
        streetHistoryPeriodSummary: 'Танланган давр хулосаси',
        streetHistoryPeriodGrandTotal: 'Жами харид суммаси',
        streetHistoryPeriodEmpty: 'Бу даврда харид қайд этилмаган',
        streetHistoryPeriodByProduct: 'Маҳсулотлар бўйича',
    },
    ru: {
        navStreetObjects: 'Уличные объекты',
        streetTitle: 'Уличные объекты',
        streetIntro: 'Здесь ведёте список уличных объектов. В «Закупке» выберите позицию на складе — приход добавится к её остатку.',
        streetName: 'Уличный объект',
        streetAdd: 'Новый уличный объект',
        streetEdit: 'Изменить уличный объект',
        streetDeleteConfirm: 'Удалить уличный объект? Записи на складе сохранятся.',
        streetPurchasePickSupplier: 'Выберите уличный объект',
        streetDebtPreview: 'Долг уличному объекту',
        streetHistorySearch: 'Товар, уличный объект...',
        streetHistoryFilterSupplier: 'Уличный объект',
        streetHistoryColSupplier: 'Уличный объект',
        streetDebtIntro: 'Остаток долга по закупкам в кредит. Здесь фиксируйте оплату уличному объекту наличными — остаток уменьшится.',
        streetDebtNoSuppliers: 'Нет уличных объектов',
        streetDebtRepayColSupplier: 'Уличный объект',
        streetDebtOrphanBanner: 'Остался долг по закупкам с удалённым уличным объектом (здесь оплатить нельзя):',
        streetSupplierPurchasesDialogDesc: 'Закупки у этого уличного объекта: дата, количество, сумма, оплачено и долг.',
        streetPricePerUnit: 'Цена с улицы (за 1 ед., сум, необязательно)',
        whStreetPurchasePricePerUnit: 'Цена с улицы (за 1 ед., сум, необязательно)',
        whKochaPurchasePricePerUnit: 'Уличные объекты (за 1 ед., сум, необязательно)',
        streetDailyPurchaseSummaryDay: 'Закуплено',
        streetDailyPurchaseEmptyDay: 'За этот день закупок нет',
        streetQtyRunningTotal: 'Итого количество',
        streetQtyAddPart: 'Добавить',
        streetHistoryPeriodSummary: 'Итог за период',
        streetHistoryPeriodGrandTotal: 'Сумма закупок',
        streetHistoryPeriodEmpty: 'За период закупок нет',
        streetHistoryPeriodByProduct: 'По товарам',
    },
};
/** `supp*` matnlardan `street*` kalitlarini hosil qiladi; keyin ko‘cha obyektlari matnlari bilan almashtiriladi. */
export function extendWithStreetLabels(base, lang) {
    const extra = {};
    for (const key of Object.keys(base)) {
        const k = String(key);
        if (!k.startsWith('supp'))
            continue;
        const sk = `street${k.slice(4)}`;
        const val = base[key];
        if (typeof val === 'string')
            extra[sk] = val;
    }
    Object.assign(extra, STREET_ENTITY_LABELS[lang]);
    return { ...base, ...extra };
}
