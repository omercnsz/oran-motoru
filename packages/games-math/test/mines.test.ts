import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minesMultiplier, minesPayout, minesRtp, minesSurvival, placeMines, seededRandom, simulateMines, TOKEN } from '../src/index.ts';

test('olasılık ve çarpan', () => {
  assert.equal(minesSurvival(1, 1), 24 / 25);
  assert.equal(minesSurvival(24, 1), 1 / 25);
  assert.equal(minesMultiplier(1, 1), 1.01); // 0,97 / 0,96 = 1,0104
  assert.equal(minesMultiplier(24, 1), 24.25); // 0,97 × 25
  assert.equal(minesMultiplier(3, 1), 1.10);
  assert.throws(() => minesMultiplier(3, 23));
  assert.equal(minesMultiplier(3, 0), 0);
});

test('hangi anda çekilirse çekilsin geri dönüş %97 ya da biraz altı (yuvarlama)', () => {
  for (let m = 1; m <= 24; m++) {
    for (let k = 1; k <= 25 - m; k++) {
      const rtp = minesRtp(m, k);
      assert.ok(rtp <= 0.97 + 1e-12 && rtp > 0.955, `${m} mayın, ${k} kare: ${rtp}`);
    }
  }
});

test('mayınlar: doğru sayıda, tekrarsız, her karede eşit olasılık', () => {
  const random = seededRandom(25);
  const count = new Array(25).fill(0);
  const n = 200_000;
  for (let i = 0; i < n; i++) {
    const mines = placeMines(5, random);
    assert.equal(new Set(mines).size, 5);
    for (const t of mines) count[t]++;
  }
  for (const c of count) assert.ok(Math.abs(c / n - 5 / 25) < 0.004, String(c / n));
});

test('ödeme kesin birim', () => {
  assert.equal(minesPayout(10 * TOKEN, 3, 1), 1100);
  assert.equal(minesPayout(TOKEN, 24, 1), 2425);
  assert.throws(() => minesPayout(150, 3, 1));
});

for (const [m, k] of [[3, 2], [5, 4], [1, 10], [10, 3]]) {
  test(`1 milyon tur, ${m} mayın ${k} kare: simülasyon kesin hesapla uyumlu`, () => {
    const p = minesSurvival(m, k), mult = minesMultiplier(m, k);
    const n = 1_000_000;
    const sd = mult * Math.sqrt(p * (1 - p) / n);
    const rtp = simulateMines(n, m, k, seededRandom(m * 100 + k));
    assert.ok(Math.abs(rtp - minesRtp(m, k)) <= 4 * sd, `${rtp} vs ${minesRtp(m, k)} ±${4 * sd}`);
  });
}
