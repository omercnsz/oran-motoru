// Farklı kaynaklardaki takım adlarını bizim veri setimizdeki (football-data.co.uk) adlara eşler.
// Örn. API-Football "İstanbul Başakşehir" → "Buyuksehyr", "Manchester United" → "Man United".

// Anlam taşımayan kulüp ekleri
const NOISE = new Set([
  'fc', 'cf', 'sk', 'fk', 'jk', 'as', 'ac', 'afc', 'sc', 'rc', 'ogc', 'aj', 'sco', 'osc', 'cp',
  'vfb', 'vfl', 'tsg', 'fsv', 'sv', 'ssc', 'ss', 'us', 'calcio', 'club', 'de', 'cd', 'ud', 'sd', 'rcd',
]);

// Kısaltmalar: iki taraf da aynı biçime getirilir ("Boston Utd" = "Boston United")
const SYNONYMS: Record<string, string> = { utd: 'united', rvs: 'rovers', st: 'saint', ii: 'b' };

// Otomatik eşleşmeyen adlar (normalize edilmiş API adı → bizim ad)
const ALIASES: Record<string, string> = {
  'manchester united': 'Man United', 'manchester city': 'Man City', 'nottingham forest': "Nott'm Forest",
  'wolverhampton wanderers': 'Wolves', 'sheffield utd': 'Sheffield United',
  'athletic': 'Ath Bilbao', 'athletic bilbao': 'Ath Bilbao', 'atletico madrid': 'Ath Madrid', 'espanyol': 'Espanol',
  'bayern munchen': 'Bayern Munich', 'eintracht frankfurt': 'Ein Frankfurt', 'borussia monchengladbach': "M'gladbach",
  'hamburger': 'Hamburg',
  'paris saint germain': 'Paris SG', 'olympique lyonnais': 'Lyon', 'stade rennais': 'Rennes', 'stade brestois': 'Brest',
  'inter': 'Inter', 'internazionale': 'Inter',
  'istanbul basaksehir': 'Buyuksehyr', 'basaksehir': 'Buyuksehyr', 'goztepe': 'Goztep', 'amed': 'Amedspor',
  'amed sportif faaliyetler': 'Amedspor', 'amed sfk': 'Amedspor', 'erzurum bb': 'Erzurumspor',
  'sporting': 'Sp Lisbon', 'sporting lisbon': 'Sp Lisbon', 'braga': 'Sp Braga', 'vitoria guimaraes': 'Guimaraes',
  'fortuna sittard': 'For Sittard', 'psv': 'PSV Eindhoven', 'az': 'AZ Alkmaar',
  // ESPN adları
  'cologne': 'FC Koln', 'west bromwich albion': 'West Brom', 'queens park rangers': 'QPR',
  'peterborough united': 'Peterboro', 'heart of midlothian': 'Hearts', 'inverness caledonian thistle': 'Inverness C',
  'deportivo': 'La Coruna', 'celta fortuna': 'Celta B', 'sporting gijon': 'Sp Gijon',
  'oh leuven': 'Oud-Heverlee Leuven', 'sint truidense': 'St Truiden', 'union saint gilloise': 'St. Gilloise',
};

export function normalize(name: string): string {
  return name
    .replace(/[ıİ]/g, 'i')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t) && !/^\d+$/.test(t))
    .map((t) => SYNONYMS[t] ?? t)
    .join(' ');
}

function bigrams(s: string): Map<string, number> {
  const b = new Map<string, number>();
  const t = s.replace(/ /g, '');
  for (let i = 0; i < t.length - 1; i++) b.set(t.slice(i, i + 2), (b.get(t.slice(i, i + 2)) ?? 0) + 1);
  return b;
}

function dice(a: string, b: string): number {
  const x = bigrams(a), y = bigrams(b);
  let inter = 0, total = 0;
  for (const [k, v] of x) { inter += Math.min(v, y.get(k) ?? 0); total += v; }
  for (const v of y.values()) total += v;
  return total ? (2 * inter) / total : 0;
}

/**
 * name'i candidates listesindeki bir takıma eşler; emin olamazsa null döner.
 * Sıra: birebir → takma ad → kelime kapsama ("West Ham United" ⊇ "West Ham") → benzerlik.
 */
export function matchTeam(name: string, candidates: string[]): string | null {
  const n = normalize(name);
  const norm = candidates.map((c) => ({ c, n: normalize(c) }));

  const exact = norm.find((x) => x.n === n);
  if (exact) return exact.c;

  const alias = ALIASES[n];
  if (alias && candidates.includes(alias)) return alias;

  const tokens = new Set(n.split(' '));
  const contained = norm.filter((x) => {
    const ct = x.n.split(' ');
    return x.n && (ct.every((t) => tokens.has(t)) || [...tokens].every((t) => ct.includes(t)));
  });
  if (contained.length === 1) return contained[0].c;

  const scored = norm.map((x) => ({ c: x.c, s: dice(n, x.n) })).sort((a, b) => b.s - a.s);
  if (scored.length && scored[0].s >= 0.75 && (scored.length === 1 || scored[0].s - scored[1].s >= 0.1)) return scored[0].c;
  return null;
}
