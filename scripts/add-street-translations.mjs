import fs from 'fs';

const path = 'src/app/i18n/translations.ts';
let src = fs.readFileSync(path, 'utf8');

if (src.includes('navStreetObjects:')) {
  console.log('already done');
  process.exit(0);
}

const replacers = {
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

const suppKeys = [...src.matchAll(/^\s+(supp[A-Za-z]+): string;/gm)].map((m) => m[1]);

src = src.replace(/(navSuppliers: string;\n)/, '$1  navStreetObjects: string;\n');
src = src.replace(
  /(whPurchasePricePerUnit: string;\n)/,
  '$1  whStreetPurchasePricePerUnit: string;\n',
);
const ifaceStreet = suppKeys.map((k) => `  ${k.replace(/^supp/, 'street')}: string;`).join('\n');
src = src.replace(/(suppDebtOrphanBanner: string;\n\n  \/\/ Expenses)/, `$1\n${ifaceStreet}\n\n  // Expenses`);

function extractSuppValue(localeBody, key) {
  const start = localeBody.indexOf(`  ${key}:`);
  if (start < 0) return null;
  let rest = localeBody.slice(start + `  ${key}:`.length);
  if (rest.startsWith('\n    ')) {
    const end = rest.search(/\n  [a-z]/);
    rest = end >= 0 ? rest.slice(0, end) : rest;
  } else {
    const end = rest.indexOf(',\n');
    rest = end >= 0 ? rest.slice(0, end) : rest;
  }
  return rest.trim();
}

function escapeSingle(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatValue(raw, repl) {
  const t = raw.trim();
  if (t.startsWith("'")) {
    const inner = t.slice(1, -1).replace(/\\'/g, "'");
    return `'${escapeSingle(repl(inner))}'`;
  }
  if (t.startsWith('"')) {
    const inner = t.slice(1, -1);
    return `'${escapeSingle(repl(inner))}'`;
  }
  return `'${escapeSingle(repl(t))}'`;
}

for (const locale of ['uz_latin', 'uz_cyrillic', 'ru']) {
  const re = new RegExp(`const ${locale}: T = \\{([\\s\\S]*?)\\n\\};`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`locale ${locale} not found`);
  const body = m[1];
  const repl = replacers[locale];
  const lines = [];
  for (const k of suppKeys) {
    const sk = k.replace(/^supp/, 'street');
    const raw = extractSuppValue(body, k);
    if (!raw) {
      console.warn(`skip ${k} in ${locale}`);
      continue;
    }
    lines.push(`  ${sk}: ${formatValue(raw, repl)},`);
  }
  let newBody = body;
  if (locale === 'uz_latin') {
    newBody = newBody.replace(
      /(navSuppliers: 'Baza olish',)/,
      "$1\n  navStreetObjects: \"Ko'cha obyektlari olish\",",
    );
    newBody = newBody.replace(
      /(whPurchasePricePerUnit: '[^']+',)/,
      "$1\n  whStreetPurchasePricePerUnit: \"Ko'cha obyektlari narxi (1 birlik, soʻm, ixtiyoriy)\",",
    );
    newBody = newBody.replace(
      /(whPurchasePricePerUnit: 'Sotib olish narxi)/,
      "whPurchasePricePerUnit: 'Baza olish narxi",
    );
  } else if (locale === 'uz_cyrillic') {
    newBody = newBody.replace(
      /(navSuppliers: 'База олиш',)/,
      "$1\n  navStreetObjects: 'Кўча объектлари олиш',",
    );
    newBody = newBody.replace(
      /(whPurchasePricePerUnit: '[^']+',)/,
      "$1\n  whStreetPurchasePricePerUnit: 'Кўча объектлари нархи (1 бирлик, сўм, ихтиёрий)',",
    );
  } else {
    newBody = newBody.replace(
      /(navSuppliers: 'База — получение',)/,
      "$1\n  navStreetObjects: 'Уличные объекты — получение',",
    );
    newBody = newBody.replace(
      /(whPurchasePricePerUnit: '[^']+',)/,
      "$1\n  whStreetPurchasePricePerUnit: 'Цена закупки с уличного объекта (за 1 ед., сум, необязательно)',",
    );
  }
  const insertAt = newBody.indexOf('\n  expTitle:');
  if (insertAt < 0) throw new Error(`expTitle not found in ${locale}`);
  newBody = newBody.slice(0, insertAt) + '\n\n' + lines.join('\n') + newBody.slice(insertAt);
  src = src.replace(re, `const ${locale}: T = {${newBody}\n};`);
}

fs.writeFileSync(path, src);
console.log('ok');
