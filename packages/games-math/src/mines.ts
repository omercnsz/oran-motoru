// Mines: 5×5 alanda m mayın. Oyuncu kareleri tek tek açar; her güvenli kareyle çarpan yükselir, istediği an çeker.
// Mayına basarsa bahsi kaybeder.
//
// Matematik: k güvenli kare açma olasılığı P(k) = C(25−m, k) / C(25, k). Çarpan M(k) = (1 − e) / P(k), aşağı yuvarlanmış
// (iki ondalık). Böylece hangi anda çekilirse çekilsin beklenen getiri en fazla %97'dir (yuvarlama kadar az).
// Mayınların yeri tur başında güvenli rastgele sayıyla çekilip kaydedilir; oyuncunun hangi kareyi seçtiğine göre
// değişmez. Tur bitince bütün mayınlar gösterilir.

import type { Random } from './random.ts';
import { TOKEN } from './crash.ts';

export const MINES = {
  tiles: 25,
  houseEdge: 0.03,
  minMines: 1,
  maxMines: 24,
} as const;

/** k güvenli kare açma olasılığı (m mayınla) */
export function minesSurvival(mines: number, k: number): number {
  let p = 1;
  for (let i = 0; i < k; i++) p *= (MINES.tiles - mines - i) / (MINES.tiles - i);
  return p;
}

/** k güvenli kareden sonraki çarpan (iki ondalık, aşağı yuvarlanmış); k = 0'da çekilemez */
export function minesMultiplier(mines: number, k: number): number {
  if (k <= 0) return 0;
  if (mines < MINES.minMines || mines > MINES.maxMines || k > MINES.tiles - mines) throw new RangeError(`geçersiz: ${mines}, ${k}`);
  return Math.floor(((1 - MINES.houseEdge) / minesSurvival(mines, k)) * 100 + 1e-9) / 100;
}

/** Mayınların yerleri (0–24), Fisher–Yates ile */
export function placeMines(mines: number, random: Random): number[] {
  const tiles = Array.from({ length: MINES.tiles }, (_, i) => i);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.slice(0, mines).sort((a, b) => a - b);
}

/** Ödeme birim cinsinden (bahis tam jeton): kesin, yuvarlama yok */
export function minesPayout(bet: number, mines: number, safeRevealed: number): number {
  if (!Number.isInteger(bet / TOKEN) || bet <= 0) throw new RangeError(`bahis tam jeton olmalı: ${bet}`);
  return (bet / TOKEN) * Math.round(minesMultiplier(mines, safeRevealed) * 100);
}

/** "k kare aç, çek" stratejisinin kesin geri dönüş oranı */
export const minesRtp = (mines: number, k: number) => minesSurvival(mines, k) * minesMultiplier(mines, k);

/** Simülasyon: her turda rastgele k kare açıp çeken oyuncu */
export function simulateMines(rounds: number, mines: number, k: number, random: Random): number {
  let returned = 0;
  const bet = TOKEN;
  for (let i = 0; i < rounds; i++) {
    const field = new Set(placeMines(mines, random));
    const picks = placeMines(k, random); // açılacak k farklı kare (mayınlardan bağımsız seçilir)
    if (picks.every((t) => !field.has(t))) returned += minesPayout(bet, mines, k);
  }
  return returned / (rounds * bet);
}
