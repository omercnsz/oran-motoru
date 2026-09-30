import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSlip, totalOdds, ukKickoffToUtc, utcToUkDate, potentialReturn, indexResults, settleCoupon, summarize,
  formatMoney, parseAmount, minorDigits, oneUnit, formatOdds, defaultOddsFormat,
  type Coupon, type Selection,
} from '../src/index.ts';

const sel = (over: Partial<Selection> = {}): Selection => ({
  matchId: 'T1-2026-09-20-Fenerbahce-Eyupspor', league: 'T1', home: 'Fenerbahce', away: 'Eyupspor',
  date: '2026-09-20', kickoff: '2026-09-20T16:00:00.000Z', marketKey: '1X2', outcomeKey: '1', odds: 1.5, ...over,
});
const coupon = (selections: Selection[], stake = 10_000): Coupon => ({
  id: 'c1', createdAt: '2026-09-19T10:00:00Z', stake, status: 'open', payout: null,
  selections: selections.map((s) => ({ ...s, status: 'open' })),
});
const results = indexResults([{
  league: 'T1', updatedAt: '', results: [
    { date: '2026-09-20', home: 'Fenerbahce', away: 'Eyupspor', score: { home: 8, away: 0 } },
    { date: '2026-09-20', home: 'Goztep', away: 'Rizespor', score: { home: 2, away: 2 } },
  ],
}]);
const now = new Date('2026-09-21T12:00:00Z');
const goztep = sel({ matchId: 'g', home: 'Goztep', away: 'Rizespor', odds: 2.2 });

test('kupon doğrulama', () => {
  const before = new Date('2026-09-20T12:00:00Z');
  assert.equal(validateSlip([sel()], 10_000, before), null);
  assert.deepEqual(validateSlip([], 10_000, before), { code: 'empty' });
  assert.deepEqual(validateSlip([sel(), sel({ outcomeKey: 'X' })], 10_000, before), { code: 'sameMatch' });
  assert.deepEqual(validateSlip([sel({ outcomeKey: 'Z' })], 10_000, before), { code: 'unknownBet' });
  assert.deepEqual(validateSlip([sel({ odds: 1 })], 10_000, before), { code: 'closed', match: 'Fenerbahce – Eyupspor' });
  assert.deepEqual(validateSlip([sel()], 50, before), { code: 'minStake', min: 100 });
  assert.equal(validateSlip([sel()], 1, before, 1), null); // JPY: en küçük tutar 1 yen
  assert.deepEqual(validateSlip([sel()], 10_000, new Date('2026-09-20T16:00:00Z')), { code: 'started', match: 'Fenerbahce – Eyupspor' });
  assert.equal(validateSlip([sel({ live: true })], 10_000, new Date('2026-09-20T17:00:00Z')), null); // canlı bahis
});

test('İngiltere saati → UTC (yaz saati geçişleri dahil)', () => {
  assert.equal(ukKickoffToUtc('2026-09-26', '15:00'), '2026-09-26T14:00:00.000Z'); // yaz saati
  assert.equal(ukKickoffToUtc('2026-12-26', '15:00'), '2026-12-26T15:00:00.000Z'); // kış
  assert.equal(ukKickoffToUtc('2026-10-24', '19:45'), '2026-10-24T18:45:00.000Z'); // geçişten bir gün önce
  assert.equal(ukKickoffToUtc('2026-10-25', '15:00'), '2026-10-25T15:00:00.000Z'); // 2026: 25 Ekim geçiş günü
  assert.equal(ukKickoffToUtc('2026-03-29', '15:00'), '2026-03-29T14:00:00.000Z'); // 2026: 29 Mart yaz saati başlar
  assert.equal(ukKickoffToUtc('2026-03-28', '15:00'), '2026-03-28T15:00:00.000Z');
});

test('kombine oran ve olası kazanç', () => {
  assert.ok(Math.abs(totalOdds([sel(), goztep]) - 3.3) < 1e-9);
  assert.equal(potentialReturn([sel(), goztep], 10_000), 33_000);
  // 100 × 1.15 kayan noktada 114.99999999999999; aşağı yuvarlama bir kuruş kaybettirmemeli
  assert.equal(potentialReturn([sel({ odds: 1.15 })], 100), 115);
});

test('tekli kupon kazanır', () => {
  const c = settleCoupon(coupon([sel()]), results, now);
  assert.equal(c.status, 'won');
  assert.equal(c.payout, 15_000);
  assert.deepEqual(c.selections[0].finalScore, { home: 8, away: 0 });
});

test('kombinede bir seçim kaybederse kupon kaybeder', () => {
  const c = settleCoupon(coupon([sel(), goztep]), results, now); // Göztepe 2-2, "1" kaybetti
  assert.equal(c.status, 'lost');
  assert.equal(c.payout, 0);
});

test('sonucu gelmemiş maç kuponu açık tutar, 7 gün sonra iade olur', () => {
  const pending = sel({ matchId: 'p', home: 'Besiktas', away: 'Konyaspor', odds: 3 });
  const open = settleCoupon(coupon([sel(), pending]), results, now);
  assert.equal(open.status, 'open');
  assert.equal(open.selections[0].status, 'won');
  const later = settleCoupon(open, results, new Date('2026-09-28T12:00:00Z'));
  assert.equal(later.status, 'won');
  assert.equal(later.selections[1].status, 'void');
  assert.equal(later.payout, 15_000); // iade edilen 1.00 sayıldı
});

test('özet: gerçek parayla oynasaydın', () => {
  const won = settleCoupon(coupon([sel()]), results, now); // +5.000
  const lost = settleCoupon(coupon([goztep], 20_000), results, now); // −20.000
  const open = coupon([sel({ matchId: 'x', home: 'A', away: 'B', date: '2026-09-21' })], 5_000);
  const s = summarize([won, lost, open]);
  assert.deepEqual(s, { coupons: 3, open: 1, won: 1, lost: 1, staked: 35_000, returned: 15_000, net: -15_000 });
});

test('para birimleri: kuruş basamağı, biçim, okuma', () => {
  assert.equal(minorDigits('TRY'), 2);
  assert.equal(minorDigits('JPY'), 0);
  assert.equal(minorDigits('KWD'), 3);
  assert.equal(oneUnit('EUR'), 100);
  assert.equal(oneUnit('JPY'), 1);
  const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');
  assert.equal(plain(formatMoney(123_450, 'TRY', 'tr')), '₺1.234,50');
  assert.equal(plain(formatMoney(-5, 'EUR', 'de')), '-0,05 €');
  assert.equal(formatMoney(1_500, 'JPY', 'en'), '¥1,500');
  assert.equal(parseAmount('150', 'TRY', ','), 15_000);
  assert.equal(parseAmount('1.500,75', 'TRY', ','), 150_075);
  assert.equal(parseAmount('1,500.75', 'USD', '.'), 150_075);
  assert.equal(parseAmount('12,5 TL', 'TRY', ','), 1_250);
  assert.equal(parseAmount('1500', 'JPY', '.'), 1_500);
  assert.equal(parseAmount('1500.5', 'JPY', '.'), null); // yende kuruş yok
  assert.equal(parseAmount('abc', 'TRY', ','), null);
  assert.equal(parseAmount('1,234', 'TRY', ','), null); // 3 ondalık basamak
});

test('oran biçimleri', () => {
  assert.equal(formatOdds(2.5), '2.50');
  assert.equal(formatOdds(2.5, 'fractional'), '6/4'); // İngiliz siteleri sadeleştirmez
  assert.equal(formatOdds(1.5, 'fractional'), '1/2');
  assert.equal(formatOdds(11, 'fractional'), '10/1');
  assert.equal(formatOdds(1.91, 'fractional'), '10/11');
  assert.equal(formatOdds(5.29, 'fractional'), '17/4'); // 73/17 değil: standart merdiven
  assert.equal(formatOdds(1.67, 'fractional'), '4/6');
  assert.equal(formatOdds(1.02, 'fractional'), '1/20');
  assert.equal(formatOdds(2.5, 'american'), '+150');
  assert.equal(formatOdds(1.5, 'american'), '-200');
  assert.equal(formatOdds(2, 'american'), '+100');
  assert.equal(defaultOddsFormat('GB'), 'fractional');
  assert.equal(defaultOddsFormat('US'), 'american');
  assert.equal(defaultOddsFormat('TR'), 'decimal');
  assert.equal(defaultOddsFormat(null), 'decimal');
});

test('UTC → İngiltere tarihi', () => {
  assert.equal(utcToUkDate('2026-10-09T17:00:00.000Z'), '2026-10-09');
  assert.equal(utcToUkDate('2026-08-15T23:30:00.000Z'), '2026-08-16'); // yaz saati: İngiltere'de 00:30
  assert.equal(utcToUkDate('2026-12-15T23:30:00.000Z'), '2026-12-15'); // kış: aynı gün
});
