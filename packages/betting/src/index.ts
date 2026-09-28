// Gölge kupon kuralları: kupon kurma, sonuçlandırma ve kumbara hesabı.
// Veritabanından ve ekranlardan bağımsız; telefon olmadan test edilebilir.
// Para her yerde kuruş cinsinden tam sayıdır (kayan nokta yuvarlama hatası olmasın).
import type { ResultsFile } from '@oran/contracts';
import { MARKETS, settle } from '@oran/odds-engine';

export type SelectionStatus = 'open' | 'won' | 'lost' | 'void';
export type CouponStatus = 'open' | 'won' | 'lost';

export interface Selection {
  matchId: string;
  league: string;
  home: string;
  away: string;
  /** YYYY-MM-DD (football-data.co.uk tarihi; sonuç eşleştirmesi bununla yapılır) */
  date: string;
  /** Başlama zamanı, ISO UTC */
  kickoff: string;
  /** ESPN maç kimliği: maç biter bitmez sonuçlandırma için */
  espnId?: string;
  /** Canlı bahis (maç sırasında, o anki canlı oranla) */
  live?: boolean;
  marketKey: string;
  outcomeKey: string;
  odds: number;
}

export interface SettledSelection extends Selection {
  status: SelectionStatus;
  finalScore?: { home: number; away: number };
}

export interface Coupon {
  id: string;
  createdAt: string;
  /** Kuruş */
  stake: number;
  selections: SettledSelection[];
  status: CouponStatus;
  /** Kuruş; kaybeden kuponda 0, açık kuponda null */
  payout: number | null;
}

export const MIN_STAKE = 100; // 1 TL
export const MAX_SELECTIONS = 20;
/** Sonucu bu kadar gün içinde gelmeyen maç ertelenmiş sayılır ve iade edilir (oran 1.00) */
export const VOID_AFTER_DAYS = 7;

/** Kupon kurulurken seçilebilecek sonuçlar geçerli mi? Hata mesajı döner, geçerliyse null. */
export function validateSlip(selections: Selection[], stake: number, now: Date): string | null {
  if (selections.length === 0) return 'Kupona en az bir maç ekle';
  if (selections.length > MAX_SELECTIONS) return `Bir kuponda en fazla ${MAX_SELECTIONS} maç olabilir`;
  const ids = new Set(selections.map((s) => s.matchId));
  if (ids.size !== selections.length) return 'Aynı maçtan kupona birden fazla seçim eklenemez';
  for (const s of selections) {
    const market = MARKETS.find((m) => m.key === s.marketKey);
    if (!market?.outcomes.some((o) => o.key === s.outcomeKey)) return `Bilinmeyen bahis: ${s.marketKey}/${s.outcomeKey}`;
    if (!(s.odds > 1)) return `${s.home} – ${s.away} için bahis kapalı`;
    if (!s.live && Date.parse(s.kickoff) <= now.getTime()) return `${s.home} – ${s.away} başladı; maç öncesi bahis kapandı`;
  }
  if (!Number.isInteger(stake) || stake < MIN_STAKE) return 'Tutar en az 1 TL olmalı';
  return null;
}

/** Kombine oran: seçimlerin çarpımı (iade edilenler 1.00 sayılır) */
export function totalOdds(selections: (Selection & { status?: SelectionStatus })[]): number {
  return selections.reduce((acc, s) => acc * (s.status === 'void' ? 1 : s.odds), 1);
}

/** Kazanç (kuruş): aşağı yuvarlanır; 2.9999999 gibi kayan nokta artıkları bir kuruş kaybettirmesin */
function payoutOf(stake: number, odds: number): number {
  return Math.floor(stake * odds + 1e-6);
}

/** Olası kazanç (kuruş) */
export function potentialReturn(selections: Selection[], stake: number): number {
  return payoutOf(stake, totalOdds(selections));
}

const key = (date: string, home: string, away: string) => `${date}|${home}|${away}`;

/** results/<lig>.json dosyalarından hızlı arama tablosu */
export function indexResults(files: ResultsFile[]): Map<string, { home: number; away: number }> {
  const map = new Map<string, { home: number; away: number }>();
  for (const f of files) for (const r of f.results) map.set(key(r.date, r.home, r.away), r.score);
  return map;
}

/** Tek seçimi sonuçlandırır; sonuç henüz yoksa ve süre dolmadıysa açık bırakır. */
export function settleSelection(
  s: SettledSelection,
  results: Map<string, { home: number; away: number }>,
  now: Date,
): SettledSelection {
  if (s.status !== 'open') return s;
  const score = results.get(key(s.date, s.home, s.away));
  if (score) return { ...s, status: settle(s.marketKey, s.outcomeKey, score) ? 'won' : 'lost', finalScore: score };
  const ageDays = (now.getTime() - Date.parse(`${s.date}T00:00:00Z`)) / 86_400_000;
  return ageDays > VOID_AFTER_DAYS ? { ...s, status: 'void' } : s;
}

/**
 * Kuponu sonuçlandırır. Bir seçim kaybederse kupon hemen kaybeder (diğerlerini beklemeye gerek yok);
 * hepsi kazanır ya da iade olursa kupon kazanır.
 */
export function settleCoupon(c: Coupon, results: Map<string, { home: number; away: number }>, now: Date): Coupon {
  if (c.status !== 'open') return c;
  const selections = c.selections.map((s) => settleSelection(s, results, now));
  if (selections.some((s) => s.status === 'lost')) return { ...c, selections, status: 'lost', payout: 0 };
  if (selections.every((s) => s.status !== 'open')) {
    return { ...c, selections, status: 'won', payout: payoutOf(c.stake, totalOdds(selections)) };
  }
  return { ...c, selections };
}

export interface Summary {
  coupons: number;
  open: number;
  won: number;
  lost: number;
  /** Toplam yatırılacak olan (kuruş) = kumbaraya giden para */
  staked: number;
  /** Sonuçlanan kuponlardan geri dönen (kuruş) */
  returned: number;
  /** Gerçek parayla oynasaydın net sonuç (kuruş): sonuçlanan kuponlarda dönen − yatırılan */
  net: number;
}

/** Dönem özeti: "Gerçek parayla oynasaydın" raporu */
export function summarize(coupons: Coupon[]): Summary {
  const s: Summary = { coupons: coupons.length, open: 0, won: 0, lost: 0, staked: 0, returned: 0, net: 0 };
  for (const c of coupons) {
    s.staked += c.stake;
    s[c.status]++;
    if (c.status !== 'open') {
      s.returned += c.payout ?? 0;
      s.net += (c.payout ?? 0) - c.stake;
    }
  }
  return s;
}

/** Kuruşu "1.234,50 TL" biçiminde yazar */
export function formatTL(kurus: number): string {
  const sign = kurus < 0 ? '−' : '';
  const abs = Math.abs(kurus);
  const lira = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const k = (abs % 100).toString().padStart(2, '0');
  return `${sign}${lira},${k} TL`;
}

/** Kullanıcının yazdığı "150", "150,5", "1.500,75" → kuruş; geçersizse null */
export function parseTL(text: string): number | null {
  const t = text.trim().replace(/\s|TL/gi, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Mart ya da Ekim'in son pazarı (İngiltere yaz saati geçiş günleri) */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/**
 * football-data.co.uk maç saatleri İngiltere saatidir (kışın UTC, yazın UTC+1).
 * Yaz saati: Mart'ın son pazarı 01:00 UTC → Ekim'in son pazarı 01:00 UTC.
 */
export function ukKickoffToUtc(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const bstStart = Date.UTC(y, 2, lastSunday(y, 2), 1);
  const bstEnd = Date.UTC(y, 9, lastSunday(y, 9), 1);
  const offsetHours = asUtc - 3_600_000 >= bstStart && asUtc - 3_600_000 < bstEnd ? 1 : 0;
  return new Date(asUtc - offsetHours * 3_600_000).toISOString();
}

/** UTC zamanın İngiltere'deki takvim tarihi (YYYY-MM-DD). football-data.co.uk sonuçları bu tarihle kaydedilir. */
export function utcToUkDate(iso: string): string {
  const t = Date.parse(iso);
  const y = new Date(t).getUTCFullYear();
  const bst = t >= Date.UTC(y, 2, lastSunday(y, 2), 1) && t < Date.UTC(y, 9, lastSunday(y, 9), 1);
  return new Date(t + (bst ? 3_600_000 : 0)).toISOString().slice(0, 10);
}
