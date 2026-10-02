// Slot: 5 makara × 3 sıra, 10 sabit çizgi. Tema: futbol ("Stadyum").
//
// Dürüstlük kuralları (gerçek slotlardaki aldatmacaların tersi):
// - Her makara gerçek bir şerittir ve durma noktası şeritte düzgün dağılır. Gerçek slotlardaki "sanal makara"
//   (kazandıran sembolün hemen üstüne/altına boşlukları fazla koyarak yapay kıl payı kaçırma) yok: ekranda görünen,
//   şeridin kendisidir.
// - Makaralar hep aynı hızda ve sırayla durur; iki bedava dönüş topu gelince son makarayı yavaşlatıp heyecan
//   yaratma ("anticipation") yok.
// - Kazanç bahisten azsa kutlama yok, net sonuç (−) gösterilir (bunu ekran yapar).
// - Penaltı bonusunda ödüller gerçekten üç köşeye rastgele dağıtılır; oyuncunun seçimi gerçek, seçimden sonra
//   diğer köşeler de gösterilir.
//
// Geri dönüş oranı ödeme tablosu ve şeritlerden kesin olarak hesaplanır (slotRtp); testler bunu simülasyonla doğrular.

import type { Random } from './random.ts';

export const SLOT_SYMBOLS = [
  'wild', 'scatter', 'bonus', 'boot', 'gloves', 'jersey', 'flag', 'watch', 'yellow', 'red', 'scarf',
] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];
type LineSymbol = Exclude<SlotSymbol, 'scatter' | 'bonus'>;

export const SLOT = {
  reels: 5,
  rows: 3,
  /** Toplam bahis çizgi sayısının katı olmalı: çizgi bahsi = toplam / 10 */
  lines: 10,
  freeSpins: 10,
  freeSpinMultiplier: 2,
} as const;

/** Çizgi ödemeleri, çizgi bahsinin katı: [3'lü, 4'lü, 5'li] (soldan sağa, ilk makaradan başlayarak) */
export const PAYTABLE: Record<LineSymbol, readonly [number, number, number]> = {
  wild: [20, 100, 500],
  boot: [15, 60, 250],
  gloves: [12, 40, 150],
  jersey: [10, 30, 100],
  flag: [6, 20, 60],
  watch: [5, 15, 50],
  yellow: [3, 10, 30],
  red: [3, 10, 30],
  scarf: [2, 8, 25],
};

/** Bedava dönüş topu (scatter): ekranın herhangi bir yerinde; ödeme toplam bahsin katı. 3+ top: 10 bedava dönüş. */
export const SCATTER_PAY: Readonly<Record<number, number>> = { 3: 2, 4: 10, 5: 50 };

/** Penaltı bonusu (düdük 1., 3. ve 5. makarada): üç köşedeki ödüller, toplam bahsin katı */
export const PENALTY_PRIZES = [5, 10, 25] as const;
/** Düdüğün çıkabildiği makaralar */
export const BONUS_REELS = [0, 2, 4] as const;

/** Çizgiler: her makarada hangi sıra (0 üst, 1 orta, 2 alt) */
export const LINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 2, 1, 0, 1],
];

export type Reels = readonly (readonly SlotSymbol[])[];

/**
 * Her makarada hangi sembolden kaç tane var. Şeritler bunlardan belirli bir kuralla dizilir (arrangeStrip);
 * geri dönüş oranı sadece adetlere bağlıdır (dizilim sadece görüntüyü belirler).
 */
const COMMON = { wild: 3, boot: 2, gloves: 2, jersey: 3, flag: 3, watch: 3, yellow: 4, red: 4, scarf: 4, scatter: 1 } as const;
export const REEL_COUNTS: readonly Partial<Record<SlotSymbol, number>>[] = [
  { ...COMMON, yellow: 3, scarf: 3, bonus: 2 },
  { ...COMMON, red: 3, scarf: 2 },
  { ...COMMON, scarf: 3, bonus: 1 },
  { ...COMMON },
  { ...COMMON, watch: 4, scarf: 5, bonus: 1 },
];

/**
 * Şerit dizilimi: top ve düdükler eşit aralıklarla (pencerede en fazla biri görünsün), diğer semboller
 * adetleriyle orantılı ve dağınık (aynı sembol yığılmasın). Rastgelelik yok; her zaman aynı şerit.
 */
export function arrangeStrip(counts: Partial<Record<SlotSymbol, number>>): SlotSymbol[] {
  const length = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const strip: (SlotSymbol | null)[] = new Array(length).fill(null);
  // Top ve düdükler sırayla (top, düdük, top…) ve şerit boyunca eşit aralıklarla
  const specials: SlotSymbol[] = [];
  for (let k = 0; k < Math.max(counts.scatter ?? 0, counts.bonus ?? 0); k++) {
    if (k < (counts.scatter ?? 0)) specials.push('scatter');
    if (k < (counts.bonus ?? 0)) specials.push('bonus');
  }
  specials.forEach((sym, k) => { strip[Math.floor((k * length) / specials.length) + 1] = sym; });
  // Diğerleri: her adımda "olması gerekenden en geride kalan" sembol (Bresenham benzeri dağıtım)
  const others = SLOT_SYMBOLS.filter((x) => x !== 'scatter' && x !== 'bonus' && (counts[x] ?? 0) > 0);
  const placed = new Map<SlotSymbol, number>(others.map((x) => [x, 0]));
  const free = strip.length - specials.length;
  let step = 0;
  for (let i = 0; i < strip.length; i++) {
    if (strip[i]) continue;
    step++;
    let best = others[0], bestDeficit = -Infinity;
    for (const x of others) {
      const deficit = ((counts[x] ?? 0) * step) / free - (placed.get(x) ?? 0);
      if (deficit > bestDeficit) { bestDeficit = deficit; best = x; }
    }
    strip[i] = best;
    placed.set(best, (placed.get(best) ?? 0) + 1);
  }
  return strip as SlotSymbol[];
}

/** Makara şeritleri */
export const REELS: Reels = REEL_COUNTS.map(arrangeStrip);

/** Durma noktalarından görünen pencere: grid[makara][sıra]; üst sıra şeritte durma noktasındaki sembol */
export function windowOf(stops: readonly number[], reels: Reels = REELS): SlotSymbol[][] {
  return reels.map((strip, i) => [0, 1, 2].map((r) => strip[(stops[i] + r) % strip.length]));
}

/**
 * Ekran ilk açıldığında gösterilen durma noktaları: hiçbir şey kazandırmayan, top, düdük ve joker içermeyen bir pencere.
 * (Açılışta "neredeyse kazanıyordun" izlenimi veren bir vitrin gösterilmez.)
 */
export function neutralStops(reels: Reels = REELS): number[] {
  const plain = (strip: readonly SlotSymbol[], stop: number) =>
    [0, 1, 2].every((r) => !['scatter', 'bonus', 'wild'].includes(strip[(stop + r) % strip.length]));
  const stops = reels.map((strip) => strip.findIndex((_, i) => plain(strip, i)));
  for (let shift = 0; shift < 50; shift++) {
    if (evaluateSpin(windowOf(stops, reels)).win === 0) return stops;
    // Kazanç varsa son makaraları bir sonraki uygun konuma kaydır
    const reel = 4 - (shift % 3);
    const strip = reels[reel];
    let next = (stops[reel] + 1) % strip.length;
    while (!plain(strip, next)) next = (next + 1) % strip.length;
    stops[reel] = next;
  }
  throw new Error('nötr pencere bulunamadı');
}

/** Rastgele durma noktaları (her makarada şerit üzerinde düzgün) */
export const randomStops = (random: Random, reels: Reels = REELS): number[] =>
  reels.map((strip) => Math.floor(random() * strip.length));

export interface LineWin { line: number; symbol: LineSymbol; count: number; pay: number }

/**
 * Tek çizgi: soldan sağa ardışık aynı sembol (joker yerine geçer). Top ve düdük çizgiyi keser.
 * Hem "joker + sembol" hem "sadece joker" yorumu varsa yüksek ödeyen alınır.
 */
export function evaluateLine(symbols: readonly SlotSymbol[]): Omit<LineWin, 'line'> | null {
  const first = symbols.find((s) => s !== 'wild');
  let wildRun = 0;
  while (wildRun < symbols.length && symbols[wildRun] === 'wild') wildRun++;
  let best: Omit<LineWin, 'line'> | null = null;
  const consider = (symbol: LineSymbol, count: number) => {
    if (count < 3) return;
    const pay = PAYTABLE[symbol][count - 3];
    if (!best || pay > best.pay) best = { symbol, count, pay };
  };
  consider('wild', wildRun);
  if (first && first !== 'scatter' && first !== 'bonus') {
    let run = 0;
    while (run < symbols.length && (symbols[run] === first || symbols[run] === 'wild')) run++;
    consider(first, run);
  }
  return best;
}

export interface SpinResult {
  grid: SlotSymbol[][];
  lineWins: LineWin[];
  scatters: number;
  /** Kazanç, çizgi bahsinin katı (çizgi + top ödemesi); bedava dönüş çarpanı uygulanmamış */
  win: number;
  freeSpins: boolean;
  bonus: boolean;
}

/** Bir dönüşün sonucu (bonus ve bedava dönüş tetiklenmesi dahil) */
export function evaluateSpin(grid: SlotSymbol[][]): SpinResult {
  const lineWins: LineWin[] = [];
  LINES.forEach((rows, line) => {
    const w = evaluateLine(rows.map((r, reel) => grid[reel][r]));
    if (w) lineWins.push({ line, ...w });
  });
  const scatters = grid.reduce((n, col) => n + col.filter((s) => s === 'scatter').length, 0);
  const scatterPay = (SCATTER_PAY[Math.min(scatters, 5)] ?? 0) * SLOT.lines;
  const bonus = BONUS_REELS.every((reel) => grid[reel].includes('bonus'));
  return {
    grid,
    lineWins,
    scatters,
    win: lineWins.reduce((s, w) => s + w.pay, 0) + scatterPay,
    freeSpins: scatters >= 3,
    bonus,
  };
}

/** Penaltı ödüllerinin köşelere rastgele dağılımı (Fisher–Yates) */
export function shufflePrizes(random: Random): number[] {
  const prizes: number[] = [...PENALTY_PRIZES];
  for (let i = prizes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [prizes[i], prizes[j]] = [prizes[j], prizes[i]];
  }
  return prizes;
}

/** Tam bir oyun turu: ana dönüş, varsa 10 bedava dönüş (×2, yeniden tetiklenmez, bonus çıkmaz) ve penaltı ödülleri */
export interface SlotRound {
  base: SpinResult;
  free: SpinResult[];
  /** Bonus varsa köşelerdeki ödüller (toplam bahsin katı); seçim yapılınca ödenir */
  prizes: number[] | null;
}

/** Turun bütün rastgele kısmı: tur başında çekilir ve kaydedilir; sonuç bundan yeniden hesaplanabilir */
export interface SlotDraw { stops: number[]; freeStops: number[][]; prizes: number[] | null }

export function drawSlotRound(random: Random, reels: Reels = REELS): SlotDraw {
  const stops = randomStops(random, reels);
  const base = evaluateSpin(windowOf(stops, reels));
  const freeStops = base.freeSpins ? Array.from({ length: SLOT.freeSpins }, () => randomStops(random, reels)) : [];
  return { stops, freeStops, prizes: base.bonus ? shufflePrizes(random) : null };
}

export const resolveSlotRound = (draw: SlotDraw, reels: Reels = REELS): SlotRound => ({
  base: evaluateSpin(windowOf(draw.stops, reels)),
  free: draw.freeStops.map((stops) => evaluateSpin(windowOf(stops, reels))),
  prizes: draw.prizes,
});

export const playSlotRound = (random: Random, reels: Reels = REELS): SlotRound => resolveSlotRound(drawSlotRound(random, reels), reels);

/** Turun toplam ödemesi, toplam bahsin katı; pick: penaltıda seçilen köşe */
export function roundMultiple(round: SlotRound, pick: number | null): number {
  const free = round.free.reduce((s, f) => s + f.win, 0) * SLOT.freeSpinMultiplier;
  const bonus = round.prizes ? round.prizes[pick ?? 1] : 0;
  return (round.base.win + free) / SLOT.lines + bonus;
}

/** Ödeme birim cinsinden: bahis 10 jetonun katı olduğu için her zaman tam sayı */
export function roundPayout(round: SlotRound, pick: number | null, bet: number): number {
  if (bet % SLOT.lines !== 0) throw new RangeError(`bahis ${SLOT.lines}'un katı olmalı: ${bet}`);
  const lineBet = bet / SLOT.lines;
  const free = round.free.reduce((s, f) => s + f.win, 0) * SLOT.freeSpinMultiplier;
  const bonus = round.prizes ? round.prizes[pick ?? 1] * bet : 0;
  return (round.base.win + free) * lineBet + bonus;
}

// ---------------------------------------------------------------------------
// Kesin hesap
// ---------------------------------------------------------------------------

const counts = (strip: readonly SlotSymbol[]) => {
  const c = new Map<SlotSymbol, number>();
  for (const s of strip) c.set(s, (c.get(s) ?? 0) + 1);
  return c;
};

/** Bir sembolün penceresinde görünme olasılığı (şeritte aralarında en az 3 hücre olmak koşuluyla: pencerede en fazla 1) */
const visible = (strip: readonly SlotSymbol[], symbol: SlotSymbol) => (3 * (counts(strip).get(symbol) ?? 0)) / strip.length;

/** Şeritte top ve düdükler arasında en az 3 hücre var mı (pencerede en fazla bir tane) */
export function spacedCorrectly(strip: readonly SlotSymbol[], symbol: SlotSymbol): boolean {
  const at = strip.flatMap((s, i) => (s === symbol ? [i] : []));
  return at.every((p, k) => {
    const next = at[(k + 1) % at.length];
    const gap = (next - p + strip.length) % strip.length || strip.length;
    return gap >= 3;
  });
}

export interface SlotMath {
  rtp: number;
  /** Ana oyunda çizgi ödemelerinin beklenen değeri (toplam bahsin katı) */
  lines: number;
  scatter: number;
  freeSpins: number;
  bonus: number;
  pFreeSpins: number;
  pBonus: number;
}

/** Kesin geri dönüş oranı: her çizgi her makarada bir hücre kullanır ve hücreler bağımsızdır */
export function slotMath(reels: Reels = REELS): SlotMath {
  const dist = reels.map((strip) => {
    const c = counts(strip);
    return [...c].map(([symbol, n]) => [symbol, n / strip.length] as const);
  });
  // Bir çizginin beklenen ödemesi (çizgi bahsinin katı): 5 makaradaki sembollerin bütün birleşimleri
  let lineEv = 0;
  const walk = (reel: number, symbols: SlotSymbol[], p: number) => {
    if (reel === reels.length) {
      lineEv += p * (evaluateLine(symbols)?.pay ?? 0);
      return;
    }
    for (const [s, q] of dist[reel]) walk(reel + 1, [...symbols, s], p * q);
  };
  walk(0, [], 1);
  const lines = lineEv; // 10 çizgi × çizgi bahsi (toplam/10) = 1 çizginin beklenen ödemesi × toplam bahis

  // Top sayısının dağılımı (makaralar bağımsız)
  let pScatter = [1];
  for (const strip of reels) {
    const q = visible(strip, 'scatter');
    const next = new Array(pScatter.length + 1).fill(0);
    pScatter.forEach((p, k) => { next[k] += p * (1 - q); next[k + 1] += p * q; });
    pScatter = next;
  }
  const scatter = pScatter.reduce((s, p, k) => s + p * (SCATTER_PAY[Math.min(k, 5)] ?? 0), 0);
  const pFreeSpins = pScatter.slice(3).reduce((s, p) => s + p, 0);
  const pBonus = BONUS_REELS.reduce((p, reel) => p * visible(reels[reel], 'bonus'), 1);
  const baseSpin = lines + scatter;
  const freeSpins = pFreeSpins * SLOT.freeSpins * SLOT.freeSpinMultiplier * baseSpin;
  const bonus = pBonus * (PENALTY_PRIZES.reduce((s, p) => s + p, 0) / PENALTY_PRIZES.length);
  return { rtp: baseSpin + freeSpins + bonus, lines, scatter, freeSpins, bonus, pFreeSpins, pBonus };
}

/** Simülasyon: n tur; gerçekleşen geri dönüş oranı ve tur başına sonucun standart sapması (toplam bahsin katı) */
export function simulateSlot(rounds: number, random: Random, reels: Reels = REELS): { rtp: number; sd: number; hitRate: number } {
  let sum = 0, sumSq = 0, hits = 0;
  for (let i = 0; i < rounds; i++) {
    const r = playSlotRound(random, reels);
    const m = roundMultiple(r, r.prizes ? Math.floor(random() * 3) : null);
    sum += m;
    sumSq += m * m;
    if (r.base.win > 0) hits++;
  }
  const mean = sum / rounds;
  return { rtp: mean, sd: Math.sqrt(sumSq / rounds - mean * mean), hitRate: hits / rounds };
}
