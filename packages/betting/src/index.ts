// Gölge kupon kuralları: kupon kurma, sonuçlandırma ve kumbara hesabı.
// Veritabanından ve ekranlardan bağımsız; telefon olmadan test edilebilir.
// Para her yerde para biriminin en küçük birimi (kuruş, sent, yen…) cinsinden tam sayıdır.
// Kullanıcıya gösterilecek metin üretilmez; sorunlar kodla döner, metni uygulama kendi dilinde yazar.
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
  /** En küçük birim (kuruş, sent…) */
  stake: number;
  selections: SettledSelection[];
  status: CouponStatus;
  /** En küçük birim; kaybeden kuponda 0, açık kuponda null */
  payout: number | null;
}

export const MAX_SELECTIONS = 20;
/** Sonucu bu kadar gün içinde gelmeyen maç ertelenmiş sayılır ve iade edilir (oran 1.00) */
export const VOID_AFTER_DAYS = 7;

/** Kupon kurulamama sebebi; metni uygulama kendi dilinde yazar. match: "Ev – Deplasman" */
export type SlipProblem =
  | { code: 'empty' }
  | { code: 'tooMany'; max: number }
  | { code: 'sameMatch' }
  | { code: 'unknownBet' }
  | { code: 'closed'; match: string }
  | { code: 'started'; match: string }
  | { code: 'minStake'; min: number };

/** Kupon geçerli mi? Geçerliyse null. minStake: en küçük birim cinsinden (varsayılan 1 birim = 100) */
export function validateSlip(selections: Selection[], stake: number, now: Date, minStake = 100): SlipProblem | null {
  if (selections.length === 0) return { code: 'empty' };
  if (selections.length > MAX_SELECTIONS) return { code: 'tooMany', max: MAX_SELECTIONS };
  const ids = new Set(selections.map((s) => s.matchId));
  if (ids.size !== selections.length) return { code: 'sameMatch' };
  for (const s of selections) {
    const market = MARKETS.find((m) => m.key === s.marketKey);
    if (!market?.outcomes.some((o) => o.key === s.outcomeKey)) return { code: 'unknownBet' };
    const match = `${s.home} – ${s.away}`;
    if (!(s.odds > 1)) return { code: 'closed', match };
    if (!s.live && Date.parse(s.kickoff) <= now.getTime()) return { code: 'started', match };
  }
  if (!Number.isInteger(stake) || stake < minStake) return { code: 'minStake', min: minStake };
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
  /** Toplam yatırılacak olan (en küçük birim) = kumbaraya giden para */
  staked: number;
  /** Sonuçlanan kuponlardan geri dönen (en küçük birim) */
  returned: number;
  /** Gerçek parayla oynasaydın net sonuç: sonuçlanan kuponlarda dönen − yatırılan */
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

// ---------------------------------------------------------------------------
// Para birimleri
// ---------------------------------------------------------------------------

/** Para biriminin kuruş basamağı: TRY/EUR/USD 2, JPY/KRW 0, KWD/BHD 3 */
export function minorDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Bir tam birim (1 TL, 1 €, 1 ¥) en küçük birim cinsinden */
export const oneUnit = (currency: string) => 10 ** minorDigits(currency);

/** En küçük birimi yerel biçimde yazar: 123450 TRY, "tr" → "₺1.234,50"; 1500 JPY, "ja" → "￥1,500" */
export function formatMoney(minor: number, currency: string, locale: string): string {
  const d = minorDigits(currency);
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d })
    .format(minor / 10 ** d);
}

/**
 * Kullanıcının yazdığı tutarı en küçük birime çevirir; geçersizse null.
 * decimalSeparator: cihazın ondalık ayracı ("," ya da "."); diğer ayraç binlik sayılır.
 * "1.500,75" (",") → 150075; "1,500.75" (".") → 150075; "1500" (JPY) → 1500
 */
export function parseAmount(text: string, currency: string, decimalSeparator: string): number | null {
  const group = decimalSeparator === ',' ? '.' : ',';
  const t = text.trim().replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d.,]/g, '').split(group).join('').replace(decimalSeparator, '.');
  const d = minorDigits(currency);
  const re = d > 0 ? new RegExp(`^\\d+(\\.\\d{1,${d}})?$`) : /^\d+$/;
  if (!re.test(t)) return null;
  return Math.round(Number(t) * 10 ** d);
}

// ---------------------------------------------------------------------------
// Oran biçimleri
// ---------------------------------------------------------------------------

export type OddsFormat = 'decimal' | 'fractional' | 'american';

/** Ülkeye göre alışılmış biçim: İngiltere/İrlanda kesirli, ABD Amerikan, diğerleri ondalık */
export function defaultOddsFormat(regionCode: string | null | undefined): OddsFormat {
  if (regionCode === 'GB' || regionCode === 'IE') return 'fractional';
  if (regionCode === 'US') return 'american';
  return 'decimal';
}

/**
 * İngiliz bahis sitelerinin kullandığı standart kesirli oran merdiveni (kazanç / yatırılan).
 * Siteler kesirleri sadeleştirmeden yazar: 6/4, 4/6, 11/8…
 */
const FRACTION_LADDER = [
  '1/20', '1/16', '1/14', '1/12', '1/10', '1/9', '1/8', '1/7', '1/6', '1/5', '2/9', '1/4', '2/7', '3/10', '1/3', '4/11',
  '2/5', '4/9', '1/2', '8/15', '4/7', '8/13', '4/6', '8/11', '4/5', '5/6', '10/11', '1/1', '21/20', '11/10', '6/5',
  '5/4', '11/8', '6/4', '13/8', '17/10', '7/4', '15/8', '19/10', '2/1', '21/10', '85/40', '9/4', '23/10', '12/5',
  '5/2', '13/5', '11/4', '14/5', '29/10', '3/1', '16/5', '10/3', '17/5', '7/2', '18/5', '15/4', '4/1', '17/4',
  '9/2', '19/4', '5/1', '21/4', '11/2', '23/4', '6/1', '13/2', '7/1', '15/2', '8/1', '17/2', '9/1', '10/1', '11/1', '12/1', '14/1', '16/1',
  '18/1', '20/1', '25/1', '33/1', '40/1', '50/1', '66/1', '80/1', '100/1', '150/1', '200/1', '250/1', '500/1',
].map((f) => { const [n, d] = f.split('/').map(Number); return { text: f, value: n / d }; });

/**
 * Ondalık oranı istenen biçimde yazar: 2.50 → "2.50" | "6/4" | "+150"; 1.50 → "1/2" | "-200".
 * Kesirli biçim görüntü içindir: merdivendeki en yakın kesir gösterilir, ödeme ondalık orandan hesaplanır.
 */
export function formatOdds(decimal: number, format: OddsFormat = 'decimal'): string {
  if (format === 'decimal') return decimal.toFixed(2);
  const profit = decimal - 1;
  if (format === 'american') {
    return profit >= 1 ? `+${Math.round(profit * 100)}` : `-${Math.round(100 / profit)}`;
  }
  let best = FRACTION_LADDER[0];
  for (const f of FRACTION_LADDER) if (Math.abs(f.value - profit) < Math.abs(best.value - profit)) best = f;
  return best.text;
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
