import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLINKO_RISKS, PLINKO_ROWS, PLINKO_TABLES, plinkoPath, plinkoPayout, plinkoProbability, plinkoRtp, plinkoSlot, seededRandom,
  simulatePlinko, TOKEN,
} from '../src/index.ts';

test('tablolar: doğru cep sayısı, simetrik', () => {
  for (const rows of PLINKO_ROWS) for (const risk of PLINKO_RISKS) {
    const t = PLINKO_TABLES[rows][risk];
    assert.equal(t.length, rows + 1);
    assert.deepEqual([...t], [...t].reverse());
  }
});

test('kesin geri dönüş oranı her tabloda %96,8–97,0', () => {
  for (const rows of PLINKO_ROWS) for (const risk of PLINKO_RISKS) {
    const rtp = plinkoRtp(rows, risk);
    assert.ok(rtp >= 0.968 && rtp <= 0.97, `${rows} ${risk}: ${rtp}`);
  }
});

test('olasılıklar toplamı 1; ödeme kesin birim', () => {
  for (const rows of PLINKO_ROWS) {
    const sum = Array.from({ length: rows + 1 }, (_, k) => plinkoProbability(rows, k)).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-12);
  }
  assert.equal(plinkoPayout(10 * TOKEN, 16, 'high', 0), 94100);
  assert.equal(plinkoPayout(TOKEN, 8, 'low', 4), 61);
  assert.throws(() => plinkoPayout(150, 8, 'low', 0));
});

test('yol: cep = sağa sapma sayısı; dağılım binom', () => {
  assert.equal(plinkoSlot([true, false, true, true]), 3);
  const random = seededRandom(8);
  const counts = new Array(9).fill(0);
  const n = 512_000;
  for (let i = 0; i < n; i++) counts[plinkoSlot(plinkoPath(8, random))]++;
  counts.forEach((c, k) => assert.ok(Math.abs(c / n - plinkoProbability(8, k)) < 0.002, `${k}: ${c / n}`));
});

for (const rows of PLINKO_ROWS) for (const risk of PLINKO_RISKS) {
  test(`2 milyon top, ${rows} sıra ${risk}: simülasyon kesin hesapla uyumlu`, () => {
    const n = 2_000_000;
    const t = PLINKO_TABLES[rows][risk];
    const mean = plinkoRtp(rows, risk);
    const variance = t.reduce((s, m, k) => s + plinkoProbability(rows, k) * (m - mean) ** 2, 0);
    const sd = Math.sqrt(variance / n);
    const rtp = simulatePlinko(n, rows, risk, seededRandom(rows * 10 + (risk === 'low' ? 1 : 2)));
    assert.ok(Math.abs(rtp - mean) <= 4 * sd, `${rtp} vs ${mean} ±${4 * sd}`);
  });
}
