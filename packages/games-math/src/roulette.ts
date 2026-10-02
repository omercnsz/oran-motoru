// Avrupa ruleti: 0–36, tek sıfır. Her bahis n sayıyı kapsar ve kazanınca bahsin 36/n katı döner (bahis dahil):
// tek sayı 36×, düzine ve sütun 3×, kırmızı/siyah, tek/çift, 1–18/19–36 2×. Böylece her bahsin beklenen getirisi
// n/37 × 36/n = 36/37 ≈ %97,30 (kasa avantajı %2,70); hangi bahis seçilirse seçilsin aynı.
// 0 gelince dış bahislerin hepsi kaybeder ("la partage" gibi yarım iade kuralı yok).

import type { Random } from './random.ts';

export const ROULETTE = {
  pockets: 37,
  houseEdge: 1 / 37,
} as const;

/** Çarktaki dizilim (0'dan saat yönünde), gerçek Avrupa çarkıyla aynı */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export const RED_NUMBERS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColor = 'green' | 'red' | 'black';
export const colorOf = (n: number): PocketColor => (n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black');

/** Bahis anahtarları (kayıtlarda saklanır): n:17, red, black, odd, even, low, high, dozen:1–3, column:1–3 */
export type RouletteBetKey =
  | `n:${number}` | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | `dozen:${1 | 2 | 3}` | `column:${1 | 2 | 3}`;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const ONE_TO_36 = range(1, 36);

/** Bahsin kapsadığı sayılar; geçersiz anahtarda hata */
export const coverage = (key: string): number[] => [...covered(key)];

const cache = new Map<string, ReadonlySet<number>>();
function covered(key: string): ReadonlySet<number> {
  let set = cache.get(key);
  if (!set) {
    set = new Set(computeCoverage(key));
    cache.set(key, set);
  }
  return set;
}

function computeCoverage(key: string): number[] {
  const [kind, arg] = key.split(':');
  const k = Number(arg);
  switch (kind) {
    case 'n':
      if (Number.isInteger(k) && k >= 0 && k <= 36 && arg === String(k)) return [k];
      break;
    case 'red': return ONE_TO_36.filter((n) => RED_NUMBERS.has(n));
    case 'black': return ONE_TO_36.filter((n) => !RED_NUMBERS.has(n));
    case 'odd': return ONE_TO_36.filter((n) => n % 2 === 1);
    case 'even': return ONE_TO_36.filter((n) => n % 2 === 0);
    case 'low': return range(1, 18);
    case 'high': return range(19, 36);
    case 'dozen':
      if (k === 1 || k === 2 || k === 3) return range(12 * (k - 1) + 1, 12 * k);
      break;
    case 'column':
      if (k === 1 || k === 2 || k === 3) return ONE_TO_36.filter((n) => (n - k) % 3 === 0);
      break;
  }
  throw new RangeError(`geçersiz rulet bahsi: ${key}`);
}

/** Kazanınca bahsin kaç katı döner (bahis dahil): 36 / kapsanan sayı adedi */
export const returnMultiple = (key: string): number => 36 / covered(key).size;

/** Düzgün u ∈ [0,1) sayısından kazanan cep */
export function spinOutcome(u: number): number {
  if (!(u >= 0 && u < 1)) throw new RangeError(`u [0,1) aralığında olmalı: ${u}`);
  return Math.floor(u * ROULETTE.pockets);
}

export interface RouletteBet { key: string; amount: number }

/** Bir dönüşün sonucu; tutarlar birim cinsinden. Net sonuç her zaman gösterilir: kazanan bahis olsa da toplamda kayıp olabilir. */
export function settleRoulette(bets: RouletteBet[], outcome: number): { staked: number; returned: number; net: number; winning: string[] } {
  let staked = 0, returned = 0;
  const winning: string[] = [];
  for (const { key, amount } of bets) {
    if (!Number.isInteger(amount) || amount <= 0) throw new RangeError(`geçersiz tutar: ${amount}`);
    staked += amount;
    if (covered(key).has(outcome)) {
      returned += amount * returnMultiple(key);
      winning.push(key);
    }
  }
  return { staked, returned, net: returned - staked, winning };
}

/** Simülasyon: aynı bahislerle n dönüş; gerçekleşen geri dönüş oranı */
export function simulateRoulette(spins: number, bets: RouletteBet[], random: Random): number {
  let staked = 0, returned = 0;
  for (let i = 0; i < spins; i++) {
    const r = settleRoulette(bets, spinOutcome(random()));
    staked += r.staked;
    returned += r.returned;
  }
  return returned / staked;
}
