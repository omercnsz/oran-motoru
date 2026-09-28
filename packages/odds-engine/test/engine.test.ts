import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitRatings, priceMatch, scoreMatrix, settle, MARKETS, DEFAULTS, type MatchResult, type PricedMatch } from '../src/index.ts';

// Küçük yapay lig: A güçlü, C zayıf
const day = (d: number) => new Date(Date.UTC(2026, 0, d));
const matches: MatchResult[] = [];
for (let r = 0; r < 6; r++) {
  matches.push({ date: day(r * 7 + 1), home: 'A', away: 'B', hg: 2, ag: 1 });
  matches.push({ date: day(r * 7 + 2), home: 'B', away: 'C', hg: 2, ag: 0 });
  matches.push({ date: day(r * 7 + 3), home: 'C', away: 'A', hg: 0, ag: 3 });
}
const model = fitRatings(matches, { asOf: day(60) });
const market = (priced: PricedMatch, key: string) => priced.markets.find((m) => m.key === key)!;

test('güçlü takım favori çıkar', () => {
  assert.ok(model.attack.A > model.attack.B && model.attack.B > model.attack.C);
  const o = market(priceMatch(model, 'A', 'C'), '1X2').outcomes;
  assert.ok(o[0].probability > 0.6 && o[0].odds! < o[2].odds!);
});

test('skor matrisi toplamı 1', () => {
  for (const live of [null, { minute: 45, score: { home: 2, away: 1 } }]) {
    const total = scoreMatrix({ home: 1.6, away: 1.1 }, live).flat().reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
  }
});

test('çakışmayan marketlerde olasılıklar 1 eder, kasa payı istenen kadar', () => {
  const priced = priceMatch(model, 'A', 'B');
  for (const mk of MARKETS.filter((m) => !m.overlapping)) {
    const out = market(priced, mk.key).outcomes;
    assert.ok(Math.abs(out.reduce((s, o) => s + o.probability, 0) - 1) < 1e-9, mk.key);
    if (out.every((o) => o.odds)) {
      const overround = out.reduce((s, o) => s + 1 / o.odds!, 0) - 1;
      const margin = DEFAULTS.margin[mk.key] ?? DEFAULTS.margin.default;
      assert.ok(overround >= margin - 1e-9 && overround < margin + 0.02, `${mk.key}: ${overround}`);
    }
  }
});

test('hiçbir oran adil oranın üstünde değil (oyuncu avantajı yok)', () => {
  const cases = [null, { minute: 60, score: { home: 1, away: 0 } }, { minute: 85, score: { home: 3, away: 0 } }];
  for (const live of cases) {
    for (const mk of priceMatch(model, 'A', 'C', live).markets) {
      for (const o of mk.outcomes) if (o.odds) assert.ok(o.odds * o.probability < 1, `${mk.key}/${o.key} ${o.odds}`);
    }
  }
});

test('canlı: kesinleşen bahisler kapanır', () => {
  const priced = priceMatch(model, 'A', 'B', { minute: 30, score: { home: 2, away: 1 } });
  const ou = market(priced, 'OU2.5').outcomes;
  assert.equal(ou.find((o) => o.key === 'U')!.odds, null); // 3 gol oldu, alt kaybetti
  assert.equal(ou.find((o) => o.key === 'O')!.odds, null); // üst kazandı, bahis alınmaz
  assert.equal(market(priced, 'BTTS').outcomes.find((o) => o.key === 'Y')!.odds, null);
});

test('canlı: kırmızı kart gören takımın şansı düşer', () => {
  const live = { minute: 30, score: { home: 0, away: 0 } };
  const normal = market(priceMatch(model, 'A', 'B', live), '1X2').outcomes[0].probability;
  const red = market(priceMatch(model, 'A', 'B', { ...live, redCards: { home: 1, away: 0 } }), '1X2').outcomes[0].probability;
  assert.ok(red < normal);
});

test('bahis sonuçlandırma', () => {
  assert.equal(settle('1X2', '1', { home: 2, away: 1 }), true);
  assert.equal(settle('OU2.5', 'O', { home: 1, away: 1 }), false);
  assert.equal(settle('HC-1', 'X', { home: 2, away: 1 }), true);
  assert.equal(settle('CS', 'other', { home: 5, away: 0 }), true);
});
