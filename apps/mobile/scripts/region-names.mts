// Lig seçicideki ülke ve kıta adlarını her dil için üretir: src/i18n/regions.ts
// Adlar Unicode CLDR verisinden gelir (Node'un Intl.DisplayNames'i). Telefondaki JavaScript motoru (Hermes)
// bu API'yi içermediği için adlar önceden üretilip uygulamaya gömülür.
// Çalıştırma (apps/mobile içinde): npm run regions
import { readdirSync, writeFileSync } from 'node:fs';

import { COMPETITIONS, CONTINENTS, type Continent } from '@oran/leagues';

// Kıtaların ve dünyanın BM (M.49) bölge kodları
const M49: Record<Continent | 'world', string> = {
  world: '001', europe: '150', southAmerica: '005', northAmerica: '003', asia: '142', africa: '002', oceania: '009',
};

// CLDR'de alt bölge (İngiltere, İskoçya) adı yok; elle çevrildi
const SUBDIVISIONS: Record<string, Record<'GB-ENG' | 'GB-SCT', string>> = {
  en: { 'GB-ENG': 'England', 'GB-SCT': 'Scotland' },
  tr: { 'GB-ENG': 'İngiltere', 'GB-SCT': 'İskoçya' },
  es: { 'GB-ENG': 'Inglaterra', 'GB-SCT': 'Escocia' },
  pt: { 'GB-ENG': 'Inglaterra', 'GB-SCT': 'Escócia' },
  ar: { 'GB-ENG': 'إنجلترا', 'GB-SCT': 'اسكتلندا' },
  ru: { 'GB-ENG': 'Англия', 'GB-SCT': 'Шотландия' },
  de: { 'GB-ENG': 'England', 'GB-SCT': 'Schottland' },
  fr: { 'GB-ENG': 'Angleterre', 'GB-SCT': 'Écosse' },
  it: { 'GB-ENG': 'Inghilterra', 'GB-SCT': 'Scozia' },
  nl: { 'GB-ENG': 'Engeland', 'GB-SCT': 'Schotland' },
  pl: { 'GB-ENG': 'Anglia', 'GB-SCT': 'Szkocja' },
  ro: { 'GB-ENG': 'Anglia', 'GB-SCT': 'Scoția' },
  el: { 'GB-ENG': 'Αγγλία', 'GB-SCT': 'Σκωτία' },
  sr: { 'GB-ENG': 'Engleska', 'GB-SCT': 'Škotska' },
  hr: { 'GB-ENG': 'Engleska', 'GB-SCT': 'Škotska' },
  bs: { 'GB-ENG': 'Engleska', 'GB-SCT': 'Škotska' },
  sq: { 'GB-ENG': 'Anglia', 'GB-SCT': 'Skocia' },
  bg: { 'GB-ENG': 'Англия', 'GB-SCT': 'Шотландия' },
  mk: { 'GB-ENG': 'Англија', 'GB-SCT': 'Шкотска' },
  sl: { 'GB-ENG': 'Anglija', 'GB-SCT': 'Škotska' },
  zh: { 'GB-ENG': '英格兰', 'GB-SCT': '苏格兰' },
  ja: { 'GB-ENG': 'イングランド', 'GB-SCT': 'スコットランド' },
  ko: { 'GB-ENG': '잉글랜드', 'GB-SCT': '스코틀랜드' },
  id: { 'GB-ENG': 'Inggris', 'GB-SCT': 'Skotlandia' },
  vi: { 'GB-ENG': 'Anh', 'GB-SCT': 'Scotland' },
  th: { 'GB-ENG': 'อังกฤษ', 'GB-SCT': 'สกอตแลนด์' },
  hi: { 'GB-ENG': 'इंग्लैंड', 'GB-SCT': 'स्कॉटलैंड' },
};

// Uygulamada Sırpça Latin alfabesiyle yazılıyor
const CLDR_LOCALE: Record<string, string> = { sr: 'sr-Latn' };

const languages = readdirSync(new URL('../src/i18n/locales', import.meta.url))
  .filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')).sort();
const countries = [...new Set(COMPETITIONS.filter((c) => c.kind !== 'continental').map((c) => c.region))];

const lines = languages.map((lang) => {
  const cldr = new Intl.DisplayNames([CLDR_LOCALE[lang] ?? lang], { type: 'region', fallback: 'none' });
  const names: Record<string, string> = {};
  for (const code of countries) {
    const name = (SUBDIVISIONS[lang] as Record<string, string> | undefined)?.[code] ?? cldr.of(code);
    if (!name) throw new Error(`${lang}: ${code} adı yok`);
    names[code] = name;
  }
  for (const continent of [...CONTINENTS, 'world'] as const) {
    const name = cldr.of(M49[continent]);
    if (!name) throw new Error(`${lang}: ${continent} adı yok`);
    names[continent] = name;
  }
  return `  ${JSON.stringify(lang)}: ${JSON.stringify(names)},`;
});

writeFileSync(new URL('../src/i18n/regions.ts', import.meta.url), `// OTOMATİK ÜRETİLDİ, elle düzenlemeyin: npm run regions (scripts/region-names.mts)
// Ülke ve kıta adları, dil → bölge kodu → ad. Kaynak: Unicode CLDR.
export const REGION_NAMES: Record<string, Record<string, string>> = {
${lines.join('\n')}
};
`);
console.log(`${languages.length} dil, ${countries.length} ülke, ${CONTINENTS.length} kıta + dünya`);
