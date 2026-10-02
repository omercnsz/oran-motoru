// Plinko: top n sıra çividen geçer, her çivide %50 sola ya da sağa sapar; düştüğü cep (sağa sapma sayısı) çarpanı belirler.
// Cep olasılığı binom: C(n, k) / 2^n. Tablolar her sıra sayısı ve risk için kesin geri dönüş oranı ≈ %97 olacak şekilde
// tasarlandı (plinkoRtp ile hesaplanır, testler doğrular). Ortadaki cepler 1'in altında öder: en sık sonuç bir kayıptır
// ve ekranda öyle gösterilir.
// Topun yolu tur başında güvenli rastgele sayılarla çekilir; animasyon bu yolu birebir izler.

import type { Random } from './random.ts';
import { TOKEN } from './crash.ts';

export type PlinkoRows = 8 | 12 | 16;
export type PlinkoRisk = 'low' | 'high';

export const PLINKO_ROWS: readonly PlinkoRows[] = [8, 12, 16];
export const PLINKO_RISKS: readonly PlinkoRisk[] = ['low', 'high'];

const sym = (half: number[]) => [...half, ...half.slice(0, -1).reverse()];

/** Çarpan tabloları (soldan sağa cepler); simetrik */
export const PLINKO_TABLES: Record<PlinkoRows, Record<PlinkoRisk, readonly number[]>> = {
  8: {
    low: sym([2.7, 1.86, 1.28, 0.88, 0.61]),
    high: sym([10.2, 3.93, 1.51, 0.58, 0.22]),
  },
  12: {
    low: sym([4.05, 2.93, 2.12, 1.54, 1.12, 0.81, 0.59]),
    high: sym([32.8, 13.6, 5.69, 2.37, 0.99, 0.41, 0.17]),
  },
  16: {
    low: sym([5.42, 4.1, 3.11, 2.35, 1.78, 1.35, 1.02, 0.78, 0.59]),
    high: sym([94.1, 41.8, 18.6, 8.26, 3.67, 1.63, 0.72, 0.32, 0.14]),
  },
};

const choose = (n: number, k: number) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return c; };

/** Cebe düşme olasılığı */
export const plinkoProbability = (rows: PlinkoRows, slot: number) => choose(rows, slot) / 2 ** rows;

/** Kesin geri dönüş oranı */
export const plinkoRtp = (rows: PlinkoRows, risk: PlinkoRisk) =>
  PLINKO_TABLES[rows][risk].reduce((s, m, k) => s + plinkoProbability(rows, k) * m, 0);

/** Topun yolu: her sırada sağa (true) ya da sola */
export const plinkoPath = (rows: PlinkoRows, random: Random): boolean[] => Array.from({ length: rows }, () => random() < 0.5);

/** Yolun sonundaki cep */
export const plinkoSlot = (path: readonly boolean[]) => path.filter(Boolean).length;

/** Ödeme birim cinsinden (bahis tam jeton): kesin */
export function plinkoPayout(bet: number, rows: PlinkoRows, risk: PlinkoRisk, slot: number): number {
  if (!Number.isInteger(bet / TOKEN) || bet <= 0) throw new RangeError(`bahis tam jeton olmalı: ${bet}`);
  return (bet / TOKEN) * Math.round(PLINKO_TABLES[rows][risk][slot] * 100);
}

export function simulatePlinko(rounds: number, rows: PlinkoRows, risk: PlinkoRisk, random: Random): number {
  let returned = 0;
  for (let i = 0; i < rounds; i++) returned += plinkoPayout(TOKEN, rows, risk, plinkoSlot(plinkoPath(rows, random)));
  return returned / (rounds * TOKEN);
}
