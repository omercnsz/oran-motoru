// Rastgelelik. Oyun sonuçları her zaman [0, 1) aralığında düzgün dağılmış bir sayıdan türetilir.
// Uygulamada güvenli kaynak (işletim sisteminin rastgele sayı üreteci), testlerde tekrarlanabilir tohumlu üreteç kullanılır.

export type Random = () => number;

/** 7 rastgele bayttan 53 bitlik düzgün sayı: [0, 1) aralığında, double hassasiyetinin tamamıyla */
export function uniformFromBytes(bytes: Uint8Array): number {
  if (bytes.length < 7) throw new Error('7 bayt gerekli');
  let hi = 0;
  for (let i = 0; i < 3; i++) hi = hi * 256 + bytes[i]; // 24 bit
  hi = Math.floor(hi / 8); // 21 bit
  let lo = 0;
  for (let i = 3; i < 7; i++) lo = lo * 256 + bytes[i]; // 32 bit
  return (hi * 2 ** 32 + lo) / 2 ** 53;
}

/** Tohumlu üreteç (xoshiro128**): testler ve simülasyonlar aynı sonucu versin diye. Oyunda kullanılmaz. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0 || 1, b = 0x9e3779b9, c = 0x243f6a88, d = 0xb7e15162;
  const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k));
  const next32 = () => {
    const result = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotl(d, 11);
    return result;
  };
  for (let i = 0; i < 16; i++) next32(); // tohumu karıştır
  return () => ((next32() >>> 11) * 2 ** 32 + next32()) / 2 ** 53;
}
