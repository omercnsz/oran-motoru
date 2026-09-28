// Oran motoru: maç sonuçlarından takım güçlerini çıkarır, Poisson (+ Dixon-Coles)
// ile skor olasılıklarını hesaplar, bunlardan bahis marketlerini ve oranları üretir.
// Saf TypeScript, bağımlılık yok: sunucuda (Node, Worker) ve mobil uygulamada aynı kod çalışır.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_GOALS = 10;

export interface Score { home: number; away: number }

export interface MatchResult {
  date: Date;
  home: string;
  away: string;
  hg: number;
  ag: number;
}

export interface EngineConfig {
  halfLifeDays: number;
  priorGames: number;
  rho: number;
  iterations: number;
  margin: Record<string, number> & { default: number };
  redCard: { own: number; opponent: number };
}

/** Takım güçleri. GitHub Pages'teki ratings/<lig>.json dosyası bu biçimdedir. */
export interface Ratings {
  homeAvg: number;
  awayAvg: number;
  attack: Record<string, number>;
  defense: Record<string, number>;
}

export interface Model extends Ratings {
  asOf?: Date;
  cfg?: EngineConfig;
}

export interface LiveState {
  minute: number;
  score?: Score;
  redCards?: Score;
}

export type ScoreMatrix = number[][];

export interface MarketOutcome {
  key: string;
  label: string;
  win: (home: number, away: number) => boolean;
}

export interface Market {
  key: string;
  name: string;
  /** Sonuçlar birbirini dışlamıyor (çifte şans) */
  overlapping?: boolean;
  outcomes: MarketOutcome[];
}

export interface PricedOutcome {
  key: string;
  label: string;
  probability: number;
  /** null = bahis kapalı (sonuç neredeyse kesin ya da imkânsız) */
  odds: number | null;
}

export interface PricedMarket {
  key: string;
  name: string;
  outcomes: PricedOutcome[];
}

export interface PricedMatch {
  home: string;
  away: string;
  xg: Score;
  live: LiveState | null;
  markets: PricedMarket[];
}

export const DEFAULTS: EngineConfig = {
  halfLifeDays: 180, // eski maçların ağırlığı her 180 günde yarıya iner
  priorGames: 6, // az maçı olan takımları lig ortalamasına doğru çeker
  rho: -0.06, // Dixon-Coles düşük skor düzeltmesi (0-0, 1-1 biraz daha olası)
  iterations: 25,
  margin: { '1X2': 0.06, CS: 0.25, default: 0.08 }, // kasa payı (skor tahmininde siteler de yüksek tutar)
  redCard: { own: 0.72, opponent: 1.18 }, // kırmızı kart başına gol hızı çarpanı
};

// ---------------------------------------------------------------------------
// 1) Takım güçleri
// ---------------------------------------------------------------------------

/**
 * Geçmiş maçlardan lig ortalamalarını ve her takımın hücum/savunma katsayısını (1 = lig ortalaması) hesaplar.
 * Katsayılar rakip gücüne göre düzeltilir (iteratif), eski maçlar daha az ağırlık alır.
 */
export function fitRatings(
  matches: MatchResult[],
  { asOf = new Date(), ...opts }: { asOf?: Date } & Partial<EngineConfig> = {},
): Model {
  const cfg: EngineConfig = { ...DEFAULTS, ...opts };
  const xi = Math.LN2 / cfg.halfLifeDays;
  const games = matches
    .filter((m) => m.date < asOf && Number.isFinite(m.hg) && Number.isFinite(m.ag))
    .map((m) => ({ ...m, w: Math.exp((-xi * (asOf.getTime() - m.date.getTime())) / DAY_MS) }));
  if (games.length === 0) throw new Error('Güç hesabı için geçmiş maç yok');

  let sw = 0, shg = 0, sag = 0;
  for (const g of games) { sw += g.w; shg += g.w * g.hg; sag += g.w * g.ag; }
  const homeAvg = shg / sw;
  const awayAvg = sag / sw;
  const goalAvg = (homeAvg + awayAvg) / 2;

  const teams = [...new Set(games.flatMap((g) => [g.home, g.away]))];
  const attack: Record<string, number> = Object.fromEntries(teams.map((t) => [t, 1]));
  const defense: Record<string, number> = Object.fromEntries(teams.map((t) => [t, 1]));

  for (let it = 0; it < cfg.iterations; it++) {
    const scored: Record<string, number> = {}, expScored: Record<string, number> = {};
    const conceded: Record<string, number> = {}, expConceded: Record<string, number> = {};
    for (const t of teams) scored[t] = expScored[t] = conceded[t] = expConceded[t] = 0;
    for (const g of games) {
      // Ev sahibinin golleri: beklenen = ev ortalaması × rakibin savunması
      scored[g.home] += g.w * g.hg;
      expScored[g.home] += g.w * homeAvg * defense[g.away];
      conceded[g.away] += g.w * g.hg;
      expConceded[g.away] += g.w * homeAvg * attack[g.home];
      // Deplasmanın golleri
      scored[g.away] += g.w * g.ag;
      expScored[g.away] += g.w * awayAvg * defense[g.home];
      conceded[g.home] += g.w * g.ag;
      expConceded[g.home] += g.w * awayAvg * attack[g.away];
    }
    const prior = cfg.priorGames * goalAvg;
    for (const t of teams) {
      attack[t] = (scored[t] + prior) / (expScored[t] + prior);
      defense[t] = (conceded[t] + prior) / (expConceded[t] + prior);
    }
    // Ortalama 1'de kalsın (ölçek kaymasın)
    normalize(attack);
    normalize(defense);
  }

  return { homeAvg, awayAvg, attack, defense, asOf, cfg };
}

function normalize(obj: Record<string, number>): void {
  const vals = Object.values(obj);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  for (const k of Object.keys(obj)) obj[k] /= mean;
}

/** Maç için beklenen gol sayıları. Bilinmeyen takım = lig ortalaması. */
export function expectedGoals(model: Ratings, home: string, away: string): Score {
  const a = (t: string) => model.attack[t] ?? 1;
  const d = (t: string) => model.defense[t] ?? 1;
  return {
    home: model.homeAvg * a(home) * d(away),
    away: model.awayAvg * a(away) * d(home),
  };
}

// ---------------------------------------------------------------------------
// 2) Skor olasılık matrisi
// ---------------------------------------------------------------------------

function poissonPmf(lambda: number, max = MAX_GOALS): number[] {
  const p = [Math.exp(-lambda)];
  for (let k = 1; k <= max; k++) p.push((p[k - 1] * lambda) / k);
  return p;
}

/**
 * Nihai skor olasılıkları: matrix[h][a] = P(maç h-a biter).
 * Canlıda: şu anki skor + kalan sürede atılacak goller.
 */
export function scoreMatrix(xg: Score, live: LiveState | null = null, cfg: EngineConfig = DEFAULTS): ScoreMatrix {
  let lh = xg.home, la = xg.away;
  let cur: Score = { home: 0, away: 0 };
  let rho = cfg.rho;

  if (live) {
    const remaining = Math.max(0, 90 - live.minute) / 90;
    lh *= remaining;
    la *= remaining;
    const rh = live.redCards?.home ?? 0, ra = live.redCards?.away ?? 0;
    lh *= cfg.redCard.own ** rh * cfg.redCard.opponent ** ra;
    la *= cfg.redCard.own ** ra * cfg.redCard.opponent ** rh;
    cur = live.score ?? cur;
    rho = live.minute > 0 ? 0 : rho; // DC düzeltmesi sadece maç başı için geçerli
  }

  const ph = poissonPmf(lh), pa = poissonPmf(la);
  const size = MAX_GOALS + 1 + Math.max(cur.home, cur.away);
  const m: ScoreMatrix = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  let total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      let p = ph[i] * pa[j];
      if (rho) {
        if (i === 0 && j === 0) p *= 1 - lh * la * rho;
        else if (i === 0 && j === 1) p *= 1 + lh * rho;
        else if (i === 1 && j === 0) p *= 1 + la * rho;
        else if (i === 1 && j === 1) p *= 1 - rho;
      }
      m[cur.home + i][cur.away + j] = p;
      total += p;
    }
  }
  for (const row of m) for (let j = 0; j < row.length; j++) row[j] /= total;
  return m;
}

// ---------------------------------------------------------------------------
// 3) Marketler (olasılık) ve oranlar
// ---------------------------------------------------------------------------

function sumWhere(m: ScoreMatrix, pred: (h: number, a: number) => boolean): number {
  let s = 0;
  for (let h = 0; h < m.length; h++) for (let a = 0; a < m.length; a++) if (pred(h, a)) s += m[h][a];
  return s;
}

/** Her market sonucu bir win(h, a) fonksiyonu taşır; sonuçlandırma da aynı fonksiyonla yapılır. */
export const MARKETS: Market[] = [
  {
    key: '1X2', name: 'Maç Sonucu',
    outcomes: [
      { key: '1', label: '1', win: (h, a) => h > a },
      { key: 'X', label: 'X', win: (h, a) => h === a },
      { key: '2', label: '2', win: (h, a) => h < a },
    ],
  },
  {
    key: 'DC', name: 'Çifte Şans', overlapping: true,
    outcomes: [
      { key: '1X', label: '1-X', win: (h, a) => h >= a },
      { key: '12', label: '1-2', win: (h, a) => h !== a },
      { key: 'X2', label: 'X-2', win: (h, a) => h <= a },
    ],
  },
  ...[0.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((line): Market => ({
    key: `OU${line}`, name: `${line} Alt/Üst`,
    outcomes: [
      { key: 'U', label: 'Alt', win: (h, a) => h + a < line },
      { key: 'O', label: 'Üst', win: (h, a) => h + a > line },
    ],
  })),
  {
    key: 'BTTS', name: 'Karşılıklı Gol',
    outcomes: [
      { key: 'Y', label: 'Var', win: (h, a) => h > 0 && a > 0 },
      { key: 'N', label: 'Yok', win: (h, a) => h === 0 || a === 0 },
    ],
  },
  {
    key: 'TG', name: 'Toplam Gol Aralığı',
    outcomes: [
      { key: '0-1', label: '0-1', win: (h, a) => h + a <= 1 },
      { key: '2-3', label: '2-3', win: (h, a) => h + a >= 2 && h + a <= 3 },
      { key: '4-5', label: '4-5', win: (h, a) => h + a >= 4 && h + a <= 5 },
      { key: '6+', label: '6+', win: (h, a) => h + a >= 6 },
    ],
  },
  ...[-1, 1].map((hc): Market => ({
    key: `HC${hc > 0 ? '+' : ''}${hc}`, name: `Handikaplı Maç Sonucu (${hc > 0 ? `${hc}:0` : `0:${-hc}`})`,
    outcomes: [
      { key: '1', label: '1', win: (h, a) => h + hc > a },
      { key: 'X', label: 'X', win: (h, a) => h + hc === a },
      { key: '2', label: '2', win: (h, a) => h + hc < a },
    ],
  })),
];

// Tek tek skorlar (doğru skor marketi)
const CS_SCORES: [number, number][] = [];
for (let h = 0; h <= 4; h++) for (let a = 0; a <= 4; a++) CS_SCORES.push([h, a]);
MARKETS.push({
  key: 'CS', name: 'Skor Tahmini',
  outcomes: [
    ...CS_SCORES.map(([h, a]): MarketOutcome => ({ key: `${h}-${a}`, label: `${h}-${a}`, win: (x, y) => x === h && y === a })),
    { key: 'other', label: 'Diğer', win: (x, y) => x > 4 || y > 4 },
  ],
});

const MIN_P = 0.002; // bundan düşük olasılık = bahis kapalı
const MIN_ODDS = 1.02; // bundan düşük oran = sonuç neredeyse kesin, bahis kapalı

/**
 * Power yöntemi: q_i = p_i^k, Σq = Σp × (1 + marj) olacak k (0 < k ≤ 1) bulunur.
 * q < 1 olduğu için oran hep > 1 ve hep adil oranın altındadır; düşük olasılıklı
 * sonuçlar daha çok kasa payı taşır (gerçek bahis sitelerindeki gibi).
 */
function powerMargin(probs: number[], margin: number): number[] {
  const target = probs.reduce((a, b) => a + b, 0) * (1 + margin);
  const total = (k: number) => probs.reduce((s, p) => s + p ** k, 0);
  let lo = 0.01, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (total(mid) > target) lo = mid; else hi = mid;
  }
  return probs.map((p) => p ** ((lo + hi) / 2));
}

/**
 * Olasılıkları kasa paylı oranlara çevirir.
 * Çifte şansta sonuçlar çakışır (olasılık toplamı 2); marj yine toplamın üstüne eklenir.
 */
export function priceMarket(market: Market, matrix: ScoreMatrix, cfg: EngineConfig = DEFAULTS): PricedMarket {
  const margin = cfg.margin[market.key] ?? cfg.margin.default;
  const probs = market.outcomes.map((o) => sumWhere(matrix, o.win));
  const implied = powerMargin(probs, margin);
  return {
    key: market.key,
    name: market.name,
    outcomes: market.outcomes.map((o, i) => {
      const odds = Math.floor(100 / implied[i]) / 100;
      const open = probs[i] > MIN_P && odds >= MIN_ODDS;
      return { key: o.key, label: o.label, probability: probs[i], odds: open ? odds : null };
    }),
  };
}

/** Bir maçın tüm marketlerini fiyatlar. live verilirse canlı oranlar üretilir. */
export function priceMatch(model: Model, home: string, away: string, live: LiveState | null = null): PricedMatch {
  const cfg = model.cfg ?? DEFAULTS;
  const xg = expectedGoals(model, home, away);
  const matrix = scoreMatrix(xg, live, cfg);
  return {
    home, away, xg, live,
    markets: MARKETS.map((mk) => priceMarket(mk, matrix, cfg)),
  };
}

/** Maç bittiğinde bir bahsin kazanıp kazanmadığı (gölge bahis sonuçlandırması için). */
export function settle(marketKey: string, outcomeKey: string, finalScore: Score): boolean {
  const market = MARKETS.find((m) => m.key === marketKey);
  const outcome = market?.outcomes.find((o) => o.key === outcomeKey);
  if (!outcome) throw new Error(`Bilinmeyen bahis: ${marketKey}/${outcomeKey}`);
  return outcome.win(finalScore.home, finalScore.away);
}
