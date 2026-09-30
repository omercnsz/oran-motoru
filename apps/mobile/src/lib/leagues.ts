// Lig seçicide gösterim: bayrak, ülke/kıta adı, arama.
import { BY_CODE, continentOf, type Competition, type Continent } from '@oran/leagues';

import { REGION_NAMES } from '@/i18n/regions';

// Kıta kupalarının bölge kodları → ad tablosundaki anahtar ve dünya küresi
const CONTINENTAL: Record<string, { key: Continent | 'world'; icon: string }> = {
  EU: { key: 'europe', icon: '🌍' },
  AF: { key: 'africa', icon: '🌍' },
  SA: { key: 'southAmerica', icon: '🌎' },
  NA: { key: 'northAmerica', icon: '🌎' },
  AS: { key: 'asia', icon: '🌏' },
  WORLD: { key: 'world', icon: '🌐' },
};

// İngiltere ve İskoçya bayrakları (emoji etiket dizileri)
const SUBDIVISION_FLAGS: Record<string, string> = {
  'GB-ENG': '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  'GB-SCT': '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
};

export function flagOf(c: Pick<Competition, 'kind' | 'region'>): string {
  if (c.kind === 'continental') return CONTINENTAL[c.region]?.icon ?? '🌐';
  if (SUBDIVISION_FLAGS[c.region]) return SUBDIVISION_FLAGS[c.region];
  if (!/^[A-Z]{2}$/.test(c.region)) return '🏳️';
  return String.fromCodePoint(...[...c.region].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Ülke adı (kıta kupalarında kıta adı), kullanıcının dilinde */
export function regionName(c: Pick<Competition, 'kind' | 'region'>, language: string): string {
  const key = c.kind === 'continental' ? CONTINENTAL[c.region]?.key ?? 'world' : c.region;
  return REGION_NAMES[language]?.[key] ?? REGION_NAMES.en[key] ?? c.region;
}

/** Kıta bölümünün adı */
export const continentName = (continent: Continent, language: string) =>
  REGION_NAMES[language]?.[continent] ?? REGION_NAMES.en[continent];

/** Karşılaştırma için sadeleştirme: küçük harf, aksansız, ı → i ("Süper" = "super") */
export const fold = (s: string) =>
  s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

export interface LeagueInfo {
  code: string;
  name: string;
  kind: Competition['kind'];
  region: string;
  continent: Continent | 'international';
  flag: string;
  country: string;
  /** Ad, kod ve ülke adı (kullanıcının dilinde ve İngilizce), sadeleştirilmiş */
  search: string;
}

/** Sunucunun lig listesindeki bir turnuva; uygulamanın tanımadığı yeni turnuvalar da gösterilir */
export function leagueInfo(l: { code: string; name: string; kind: Competition['kind']; region: string }, language: string): LeagueInfo {
  const c: Competition = BY_CODE[l.code] ?? { ...l, slug: '' };
  const country = regionName(c, language);
  return {
    code: c.code,
    name: l.name,
    kind: c.kind,
    region: c.region,
    continent: continentOf(c),
    flag: flagOf(c),
    country,
    search: fold(`${l.name} ${c.code} ${country} ${regionName(c, 'en')}`),
  };
}
