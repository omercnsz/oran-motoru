// Genel rapor: spor kuponları ve casino oyunları bir arada, seçilen dönem için.
// Soru hep aynı: "Gerçek parayla oynasaydın ne olurdu?" Oyunlar jetonla oynanır; jetonun para karşılığını kullanıcı seçer
// (raporda açıkça yazılır). Süre, oyun turlarının zamanlarından tahmin edilir.
import type { Coupon, CouponStatus } from './index.ts';

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
export function summarize(coupons: Pick<Coupon, 'stake' | 'status' | 'payout'>[]): Summary {
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

export type Period = 'month' | 'lastMonth' | 'all';

/** 1 jeton = 100 birim (games-math TOKEN ile aynı) */
const TOKEN = 100;
/** Turlar arasında bundan uzun ara varsa yeni oturum sayılır */
export const SESSION_GAP_MS = 10 * 60_000;
/** Tek turluk oturum da en az bu kadar sürmüş sayılır */
const MIN_SESSION_MS = 30_000;

export interface ReportCoupon { createdAt: string; stake: number; status: CouponStatus; payout: number | null; currency: string }
export interface ReportRound { game: string; createdAt: string; endedAt: string | null; bet: number; payout: number; status: string }

export interface ReportInput {
  coupons: ReportCoupon[];
  rounds: ReportRound[];
  /** Ödüllü reklamla jeton dolumlarının zamanları (jeton kaç kez bitti) */
  refills: string[];
  currency: string;
  /** 1 jetonun para karşılığı, para biriminin en küçük biriminde (1 ₺ = 100) */
  tokenValue: number;
}

export interface GameLine { game: string; rounds: number; staked: number; returned: number; net: number; rtp: number | null }

export interface Report {
  from: Date | null;
  to: Date | null;
  /** Sadece seçili para birimindeki kuponlar */
  sports: Summary;
  /** Başka para birimindeki kupon sayısı (raporda toplanmaz) */
  otherCurrencyCoupons: number;
  /** Oyun başına; tutarlar birim (1 jeton = 100) */
  games: GameLine[];
  gamesNet: number;
  gamesRounds: number;
  refills: number;
  /** Gerçek parayla oynasaydın: spor net + oyun net × jeton değeri (en küçük para birimi) */
  ifReal: number;
  sportsMoney: number;
  gamesMoney: number;
  playMs: number;
  sessions: number;
  activeDays: number;
  /** Kümülatif sonuç (en küçük para birimi), gün gün */
  series: { day: string; total: number }[];
}

/** Dönemin başı ve sonu, cihazın saat diliminde (sonu hariç) */
export function periodRange(period: Period, now: Date): { from: Date | null; to: Date | null } {
  const y = now.getFullYear(), m = now.getMonth();
  if (period === 'month') return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
  if (period === 'lastMonth') return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
  return { from: null, to: null };
}

const inRange = (iso: string, from: Date | null, to: Date | null) => {
  const t = Date.parse(iso);
  return (!from || t >= from.getTime()) && (!to || t < to.getTime());
};

/** Yerel takvim günü: YYYY-MM-DD */
export const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Oyun birimini (1 jeton = 100) paraya çevirir */
export const tokensToMoney = (units: number, tokenValue: number) => Math.round((units / TOKEN) * tokenValue);

const GAME_ORDER = ['crash', 'roulette', 'slot', 'mines', 'plinko', 'blackjack'];

export function buildReport(input: ReportInput, period: Period, now: Date): Report {
  const { from, to } = periodRange(period, now);
  const allCoupons = input.coupons.filter((c) => inRange(c.createdAt, from, to));
  const coupons = allCoupons.filter((c) => c.currency === input.currency);
  const rounds = input.rounds.filter((r) => r.status !== 'running' && inRange(r.createdAt, from, to))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sports = summarize(coupons);

  const byGame = new Map<string, GameLine>();
  for (const r of rounds) {
    const g = byGame.get(r.game) ?? { game: r.game, rounds: 0, staked: 0, returned: 0, net: 0, rtp: null };
    g.rounds++;
    g.staked += r.bet;
    g.returned += r.payout;
    g.net = g.returned - g.staked;
    g.rtp = g.returned / g.staked;
    byGame.set(r.game, g);
  }
  const games = [...byGame.values()].sort((a, b) => GAME_ORDER.indexOf(a.game) - GAME_ORDER.indexOf(b.game));
  const gamesNet = games.reduce((s, g) => s + g.net, 0);

  // Oturumlar: aralarında 10 dakikadan az olan turlar
  let playMs = 0, sessions = 0, start = 0, last = 0;
  for (const r of rounds) {
    const begin = Date.parse(r.createdAt), end = Date.parse(r.endedAt ?? r.createdAt);
    if (sessions === 0 || begin - last > SESSION_GAP_MS) {
      if (sessions > 0) playMs += Math.max(MIN_SESSION_MS, last - start);
      sessions++;
      start = begin;
    }
    last = Math.max(last, end);
  }
  if (sessions > 0) playMs += Math.max(MIN_SESSION_MS, last - start);

  // Günlük sonuç → kümülatif. Kupon, oynandığı gün sayılır (sonuçlananlar); tur da öyle.
  const daily = new Map<string, number>();
  const add = (iso: string, money: number) => daily.set(localDay(iso), (daily.get(localDay(iso)) ?? 0) + money);
  for (const c of coupons) if (c.status !== 'open') add(c.createdAt, (c.payout ?? 0) - c.stake);
  for (const r of rounds) add(r.createdAt, tokensToMoney(r.payout - r.bet, input.tokenValue));
  let total = 0;
  const series = [...daily.keys()].sort().map((day) => ({ day, total: (total += daily.get(day)!) }));

  const sportsMoney = sports.net;
  const gamesMoney = tokensToMoney(gamesNet, input.tokenValue);
  return {
    from, to, sports,
    otherCurrencyCoupons: allCoupons.length - coupons.length,
    games, gamesNet, gamesRounds: rounds.length,
    refills: input.refills.filter((t) => inRange(t, from, to)).length,
    ifReal: sportsMoney + gamesMoney, sportsMoney, gamesMoney,
    playMs, sessions,
    activeDays: new Set([...coupons.map((c) => localDay(c.createdAt)), ...rounds.map((r) => localDay(r.createdAt))]).size,
    series,
  };
}
