// Crash: çarpan 1,00×'ten yükselir ve rastgele bir noktada patlar. Oyuncu patlamadan önce çekerse bahis × çarpan kazanır.
//
// Matematik (gerçek crash oyunlarıyla aynı): u düzgün [0,1) ise patlama noktası C = ⌊100·(1−e)/(1−u)⌋ / 100, e = kasa avantajı.
// Böylece her x ≥ 1,01 için P(C ≥ x) = (1−e)/x. Hedefi x olan oyuncunun beklenen getirisi x · (1−e)/x = 1−e:
// hangi çarpanda çekerse çeksin, uzun vadede her 100 jetonun 97'si geri döner. Elle çekmek de bunu değiştirmez
// (P(C ≥ y | C ≥ x) = x/y olduğu için her durma kuralının beklenen getirisi aynıdır).
// Sonuç tur başında belirlenir; oyuncunun ne yaptığına göre değişmez. Yapay "kıl payı" ayarı yoktur.

import type { Random } from './random.ts';

/** Jetonlar yüzde birlik birimlerle tutulur (paradaki kuruş gibi): 1 jeton = 100 birim.
 * Bahis tam jeton olduğu için bahis × çarpan (iki ondalık) her zaman tam birim çıkar; ödemede yuvarlama gerekmez.
 * (Tam jetona yuvarlamak küçük bahislerde sistematik sapma yaratır: 10 jeton × 1,55 = 15,5 → 16 ya da 15.) */
export const TOKEN = 100;

export const CRASH = {
  /** Kasa avantajı: %3 (geri dönüş oranı %97, Aviator ile aynı) */
  houseEdge: 0.03,
  /** Görüntülenen en yüksek çarpan; bu noktada tur kendiliğinden biter */
  maxMultiplier: 10_000,
  /** Çekme aralığı. 1,00×'te çekmek bahsi geri almak olurdu ve %3'lük anında patlamadan kaçmayı sağlardı. */
  minTarget: 1.01,
  maxTarget: 1_000,
  /** Çarpanın büyüme hızı: m(t) = e^(k·t), t saniye. 2× yaklaşık 7 sn, 10× 23 sn, 100× 46 sn. */
  growthPerSecond: 0.1,
} as const;

/** Düzgün dağılmış u ∈ [0,1) sayısından patlama noktası (iki ondalık) */
export function crashPoint(u: number, houseEdge: number = CRASH.houseEdge): number {
  if (!(u >= 0 && u < 1)) throw new RangeError(`u [0,1) aralığında olmalı: ${u}`);
  const raw = Math.floor((100 * (1 - houseEdge)) / (1 - u)) / 100;
  return Math.min(CRASH.maxMultiplier, Math.max(1, raw));
}

/** Tur başladıktan ms milisaniye sonraki çarpan (aşağı yuvarlanmış, iki ondalık) */
export function multiplierAt(ms: number): number {
  const m = Math.exp((CRASH.growthPerSecond * Math.max(0, ms)) / 1000);
  // Kayan nokta hatası 2,00'ı 1,99 yapmasın diye küçük bir pay
  return Math.min(CRASH.maxMultiplier, Math.floor(m * 100 + 1e-9) / 100);
}

/** Çarpanın m değerine ulaştığı an (ms) */
export const msToReach = (m: number): number => (1000 * Math.log(m)) / CRASH.growthPerSecond;

/**
 * Turun sonucu; tutarlar birim (1 jeton = 100). cashout: oyuncunun çektiği çarpan (çekmediyse null).
 * Çarpan patlama noktasına eşitken çekmek kazandırır (P(C ≥ x) tanımıyla uyumlu); geçtiyse oyuncu yetişememiştir.
 * 1,01×'in altında çekilemez.
 * Bahis tam jeton olmalı; ödeme kesindir (Math.round sadece kayan nokta hatasını siler).
 */
export function settleCrash(bet: number, crash: number, cashout: number | null): { won: boolean; payout: number; net: number } {
  if (!Number.isInteger(bet / TOKEN) || bet <= 0) throw new RangeError(`bahis tam jeton olmalı: ${bet}`);
  const won = cashout !== null && cashout >= CRASH.minTarget && cashout <= crash;
  const payout = won ? (bet / TOKEN) * Math.round(cashout * 100) : 0;
  return { won, payout, net: payout - bet };
}

/** Hedefe göre teorik geri dönüş oranı (her hedef için 1 − kasa avantajı) */
export const crashRtp = (target: number, houseEdge: number = CRASH.houseEdge): number =>
  target <= 1 ? 1 : target * Math.min(1, (1 - houseEdge) / target);

/** Simülasyon: sabit hedefle n tur oynanınca gerçekleşen geri dönüş oranı */
export function simulateCrash(rounds: number, target: number, random: Random, bet = 100 * TOKEN): { rtp: number; winRate: number } {
  let returned = 0, wins = 0;
  for (let i = 0; i < rounds; i++) {
    const { won, payout } = settleCrash(bet, crashPoint(random()), target);
    returned += payout;
    if (won) wins++;
  }
  return { rtp: returned / (rounds * bet), winRate: wins / rounds };
}
