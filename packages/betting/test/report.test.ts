import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, periodRange, tokensToMoney, type ReportInput } from '../src/index.ts';

// Yerel saatle tarih (testler hangi saat diliminde çalışırsa çalışsın)
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const NOW = new Date(2026, 9, 15, 12); // 15 Ekim 2026

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  currency: 'TRY',
  tokenValue: 100, // 1 jeton = 1 ₺
  refills: [],
  coupons: [
    { createdAt: at(2026, 10, 2), stake: 10_000, status: 'lost', payout: 0, currency: 'TRY' },
    { createdAt: at(2026, 10, 3), stake: 5_000, status: 'won', payout: 12_000, currency: 'TRY' },
    { createdAt: at(2026, 10, 4), stake: 2_000, status: 'open', payout: null, currency: 'TRY' },
    { createdAt: at(2026, 10, 4), stake: 999, status: 'lost', payout: 0, currency: 'USD' },
    { createdAt: at(2026, 9, 20), stake: 3_000, status: 'lost', payout: 0, currency: 'TRY' },
  ],
  rounds: [
    { game: 'slot', createdAt: at(2026, 10, 5, 20, 0), endedAt: at(2026, 10, 5, 20, 0), bet: 1_000, payout: 0, status: 'lost' },
    { game: 'crash', createdAt: at(2026, 10, 5, 20, 5), endedAt: at(2026, 10, 5, 20, 6), bet: 10_000, payout: 15_000, status: 'won' },
    { game: 'crash', createdAt: at(2026, 10, 5, 22, 0), endedAt: at(2026, 10, 5, 22, 0), bet: 10_000, payout: 0, status: 'lost' },
    { game: 'roulette', createdAt: at(2026, 10, 6), endedAt: at(2026, 10, 6), bet: 5_000, payout: 0, status: 'running' },
  ],
  ...over,
});

test('dönem sınırları cihazın takvimine göre', () => {
  assert.deepEqual(periodRange('month', NOW), { from: new Date(2026, 9, 1), to: new Date(2026, 10, 1) });
  assert.deepEqual(periodRange('lastMonth', NOW), { from: new Date(2026, 8, 1), to: new Date(2026, 9, 1) });
  assert.deepEqual(periodRange('lastMonth', new Date(2026, 0, 10)), { from: new Date(2025, 11, 1), to: new Date(2026, 0, 1) });
  assert.deepEqual(periodRange('all', NOW), { from: null, to: null });
});

test('bu ay: spor + oyunlar, gerçek parayla sonuç', () => {
  const r = buildReport(input(), 'month', NOW);
  // Spor: −100 ₺ + (120 − 50) ₺ = −30 ₺; açık kupon sonuçta yok, USD kuponu ayrı
  assert.equal(r.sports.coupons, 3);
  assert.equal(r.sports.net, -3_000);
  assert.equal(r.otherCurrencyCoupons, 1);
  // Oyunlar: slot −10, crash +50 −100 = −60 jeton; süren tur sayılmaz
  assert.equal(r.gamesRounds, 3);
  assert.equal(r.gamesNet, -6_000);
  assert.deepEqual(r.games.map((g) => [g.game, g.rounds, g.net]), [['crash', 2, -5_000], ['slot', 1, -1_000]]);
  assert.equal(r.gamesMoney, -6_000); // 1 jeton = 1 ₺ → −60 ₺
  assert.equal(r.ifReal, -9_000);
});

test('geçen ay ve tüm zamanlar', () => {
  assert.equal(buildReport(input(), 'lastMonth', NOW).ifReal, -3_000);
  assert.equal(buildReport(input(), 'all', NOW).ifReal, -12_000);
});

test('jeton değeri: 1 jeton = 0,10 ₺ ya da 10 ₺', () => {
  assert.equal(buildReport(input({ tokenValue: 10 }), 'month', NOW).gamesMoney, -600);
  assert.equal(buildReport(input({ tokenValue: 1_000 }), 'month', NOW).gamesMoney, -60_000);
  assert.equal(tokensToMoney(-150, 100), -150); // −1,5 jeton = −1,50 ₺
});

test('süre: 10 dakikadan uzun ara yeni oturum; tek tur en az 30 sn', () => {
  const r = buildReport(input(), 'month', NOW);
  // 20:00–20:06 (6 dk) ve 22:00 (tek tur, 30 sn)
  assert.equal(r.sessions, 2);
  assert.equal(r.playMs, 6 * 60_000 + 30_000);
  assert.equal(r.activeDays, 4); // 2, 3, 4 ve 5 Ekim (açık kupon da oynanan gün)
});

test('kümülatif seri gün sırasıyla; son değer toplam sonuç', () => {
  const r = buildReport(input(), 'month', NOW);
  assert.deepEqual(r.series.map((p) => p.total), [-10_000, -3_000, -9_000]);
  assert.equal(r.series.at(-1)!.total, r.ifReal);
});

test('dolumlar dönemine göre sayılır; boş dönem', () => {
  assert.equal(buildReport(input({ refills: [at(2026, 10, 1), at(2026, 9, 30)] }), 'month', NOW).refills, 1);
  const empty = buildReport(input({ coupons: [], rounds: [] }), 'month', NOW);
  assert.deepEqual([empty.ifReal, empty.sessions, empty.playMs, empty.series.length], [0, 0, 0, 0]);
});
