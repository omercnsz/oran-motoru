import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  colorOf, coverage, RED_NUMBERS, returnMultiple, seededRandom, settleRoulette, simulateRoulette, spinOutcome, TOKEN, WHEEL_ORDER,
} from '../src/index.ts';

const SPINS = 10_000_000;
const ALL_KEYS = [
  ...Array.from({ length: 37 }, (_, n) => `n:${n}`),
  'red', 'black', 'odd', 'even', 'low', 'high', 'dozen:1', 'dozen:2', 'dozen:3', 'column:1', 'column:2', 'column:3',
];

test('çark: 37 cep, her sayı bir kez; 18 kırmızı, 18 siyah', () => {
  assert.equal(WHEEL_ORDER.length, 37);
  assert.deepEqual([...WHEEL_ORDER].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
  assert.equal(RED_NUMBERS.size, 18);
  assert.equal(colorOf(0), 'green');
  // Çarkta 0 dışında renkler sırayla değişir
  for (let i = 1; i < 36; i++) assert.notEqual(colorOf(WHEEL_ORDER[i]), colorOf(WHEEL_ORDER[i + 1]), String(WHEEL_ORDER[i]));
});

test('bahislerin kapsamı ve ödemesi', () => {
  assert.deepEqual(coverage('n:17'), [17]);
  assert.equal(returnMultiple('n:0'), 36);
  assert.equal(coverage('dozen:2').join(), '13,14,15,16,17,18,19,20,21,22,23,24');
  assert.equal(coverage('column:1').join(), '1,4,7,10,13,16,19,22,25,28,31,34');
  assert.equal(returnMultiple('dozen:3'), 3);
  assert.equal(returnMultiple('red'), 2);
  for (const k of ['n:37', 'n:-1', 'n:1.5', 'n:07', 'dozen:4', 'column:0', 'green', '']) assert.throws(() => coverage(k), k);
  // 0 dış bahislerin hiçbirinde yok
  for (const k of ALL_KEYS.filter((k) => !k.startsWith('n:'))) assert.ok(!coverage(k).includes(0), k);
});

test('kesin hesap: her bahsin beklenen getirisi tam olarak 36/37', () => {
  for (const key of ALL_KEYS) {
    let returned = 0;
    for (let n = 0; n <= 36; n++) returned += settleRoulette([{ key, amount: TOKEN }], n).returned;
    assert.equal(returned * 37, 36 * 37 * TOKEN, key); // 37 sonucun toplamı = 36 × bahis
  }
});

test('ödeme her zaman tam birim (yuvarlama yok)', () => {
  for (const key of ALL_KEYS) assert.ok(Number.isInteger(10 * TOKEN * returnMultiple(key)), key);
});

test('kazanan bahis olsa da net sonuç kayıp olabilir', () => {
  const r = settleRoulette([{ key: 'red', amount: 100 * TOKEN }, { key: 'n:0', amount: 10 * TOKEN }, { key: 'dozen:3', amount: 100 * TOKEN }], 1);
  assert.deepEqual(r, { staked: 210 * TOKEN, returned: 200 * TOKEN, net: -10 * TOKEN, winning: ['red'] });
  assert.equal(settleRoulette([{ key: 'odd', amount: TOKEN }], 0).returned, 0); // 0 gelince dış bahis kaybeder
  assert.throws(() => settleRoulette([{ key: 'red', amount: 0 }], 1));
});

test('dönüş sonucu düzgün dağılır (ki-kare)', () => {
  const counts = new Array(37).fill(0);
  const random = seededRandom(37);
  const n = 3_700_000;
  for (let i = 0; i < n; i++) counts[spinOutcome(random())]++;
  const expected = n / 37;
  const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
  assert.ok(chi2 < 70, `ki-kare ${chi2.toFixed(1)} (36 serbestlik derecesi; %99,9 sınırı ≈ 67,99)`);
  assert.equal(spinOutcome(0), 0);
  assert.equal(spinOutcome(0.999999999), 36);
  assert.throws(() => spinOutcome(1));
});

// Faz 4 bitiş ölçütü: 10 milyon dönüşte geri dönüş oranı %97,30 ± %0,1
test('10 milyon dönüş, kırmızıya: RTP %97,30 ± %0,1', () => {
  const rtp = simulateRoulette(SPINS, [{ key: 'red', amount: TOKEN }], seededRandom(2));
  assert.ok(Math.abs(rtp - 36 / 37) <= 0.001, `RTP ${rtp}`);
});

test('10 milyon dönüş, düzine + sütun + tek sayı karışık: RTP %97,30 (istatistiksel sınır içinde)', () => {
  const bets = [{ key: 'dozen:2', amount: 50 * TOKEN }, { key: 'column:3', amount: 30 * TOKEN }, { key: 'n:17', amount: 10 * TOKEN }];
  const rtp = simulateRoulette(SPINS, bets, seededRandom(17));
  assert.ok(Math.abs(rtp - 36 / 37) <= 0.003, `RTP ${rtp}`);
});

test('10 milyon dönüş, tek sayıya: RTP %97,30 (4 standart sapma)', () => {
  const p = 1 / 37;
  const sd = 36 * Math.sqrt((p * (1 - p)) / SPINS);
  const rtp = simulateRoulette(SPINS, [{ key: 'n:7', amount: TOKEN }], seededRandom(7));
  assert.ok(Math.abs(rtp - 36 / 37) <= 4 * sd, `RTP ${rtp}, sınır ±${(4 * sd).toFixed(4)}`);
});
