import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateLine, evaluateSpin, LINES, neutralStops, PENALTY_PRIZES, playSlotRound, REELS, roundMultiple, roundPayout, seededRandom,
  shufflePrizes, simulateSlot, slotMath, spacedCorrectly, TOKEN, windowOf, type SlotSymbol,
} from '../src/index.ts';

test('çizgi kuralları', () => {
  assert.deepEqual(evaluateLine(['boot', 'boot', 'boot', 'red', 'boot']), { symbol: 'boot', count: 3, pay: 15 });
  assert.deepEqual(evaluateLine(['wild', 'boot', 'wild', 'boot', 'scarf']), { symbol: 'boot', count: 4, pay: 60 });
  assert.equal(evaluateLine(['boot', 'boot', 'red', 'boot', 'boot']), null); // 2'li ödemez
  assert.equal(evaluateLine(['red', 'boot', 'boot', 'boot', 'boot']), null); // soldan başlamalı
  // Sadece joker yorumu daha yüksekse o ödenir; değilse sembolünki
  assert.deepEqual(evaluateLine(['wild', 'wild', 'wild', 'wild', 'scarf']), { symbol: 'wild', count: 4, pay: 100 });
  assert.deepEqual(evaluateLine(['wild', 'wild', 'wild', 'boot', 'boot']), { symbol: 'boot', count: 5, pay: 250 });
  // Top ve düdük çizgiyi keser, joker onların yerine geçmez
  assert.equal(evaluateLine(['scatter', 'boot', 'boot', 'boot', 'boot']), null);
  assert.deepEqual(evaluateLine(['wild', 'wild', 'wild', 'bonus', 'boot']), { symbol: 'wild', count: 3, pay: 20 });
});

test('şeritler: 5 makara; top ve düdükler arasında en az 3 hücre (pencerede en fazla bir tane)', () => {
  assert.equal(REELS.length, 5);
  for (const strip of REELS) {
    assert.ok(spacedCorrectly(strip, 'scatter'));
    assert.ok(spacedCorrectly(strip, 'bonus'));
  }
  // Düdük sadece 1., 3. ve 5. makarada
  assert.deepEqual(REELS.map((s) => s.includes('bonus')), [true, false, true, false, true]);
  assert.equal(LINES.length, 10);
});

test('kesin geri dönüş oranı %94–96 aralığında', () => {
  const m = slotMath();
  assert.ok(m.rtp >= 0.94 && m.rtp <= 0.96, String(m.rtp));
  assert.equal(m.rtp.toFixed(4), '0.9503');
  assert.ok(m.pFreeSpins > 1 / 150 && m.pFreeSpins < 1 / 80, `bedava dönüş 1/${(1 / m.pFreeSpins).toFixed(0)}`);
  assert.ok(m.pBonus > 1 / 800 && m.pBonus < 1 / 300, `bonus 1/${(1 / m.pBonus).toFixed(0)}`);
});

// Kesin hesap bağımsız simülasyonla doğrulanır (dönüş, bedava dönüşler ve rastgele penaltı seçimi dahil).
// Slot kazançları çok uzun kuyruklu: sınır, örneklemden ölçülen standart sapmanın 4 katı.
test('5 milyon tur simülasyonu kesin hesapla uyumlu', () => {
  const n = 5_000_000;
  const exact = slotMath().rtp;
  const s = simulateSlot(n, seededRandom(55));
  const se = s.sd / Math.sqrt(n);
  assert.ok(Math.abs(s.rtp - exact) <= 4 * se, `simülasyon ${s.rtp.toFixed(5)}, kesin ${exact.toFixed(5)}, ±${(4 * se).toFixed(5)}`);
});

test('ödeme her zaman tam birim; bahis 10 jetonun katı olmalı', () => {
  const random = seededRandom(9);
  for (let i = 0; i < 20_000; i++) {
    const r = playSlotRound(random);
    for (const bet of [10, 20, 50, 100].map((t) => t * TOKEN)) {
      const pay = roundPayout(r, r.prizes ? 0 : null, bet);
      assert.ok(Number.isInteger(pay), String(pay));
      assert.equal(pay, Math.round(roundMultiple(r, r.prizes ? 0 : null) * bet));
    }
  }
  assert.throws(() => roundPayout(playSlotRound(random), null, 15 * TOKEN + 5));
});

test('bedava dönüş: 3+ top → 10 dönüş, yeniden tetiklenmez; bonus: düdük 1., 3. ve 5. makarada', () => {
  const grid = (cols: SlotSymbol[][]) => evaluateSpin(cols);
  const filler: SlotSymbol[] = ['red', 'yellow', 'scarf'];
  const g = grid([['scatter', 'red', 'yellow'], filler, ['red', 'scatter', 'yellow'], filler, ['scarf', 'red', 'scatter']]);
  assert.equal(g.scatters, 3);
  assert.ok(g.freeSpins);
  assert.equal(g.win, 2 * 10 + g.lineWins.reduce((s, w) => s + w.pay, 0)); // top ödemesi: 2 × toplam bahis = 20 çizgi bahsi
  const b = grid([['bonus', 'red', 'yellow'], filler, ['red', 'bonus', 'yellow'], filler, ['scarf', 'red', 'bonus']]);
  assert.ok(b.bonus);
  assert.ok(!grid([['bonus', 'red', 'yellow'], filler, filler, filler, ['scarf', 'red', 'bonus']]).bonus);
  // Bedava dönüşler oynanınca tam 10 tane
  const random = seededRandom(4);
  let found = 0;
  for (let i = 0; i < 20_000 && found < 20; i++) {
    const r = playSlotRound(random);
    if (r.base.freeSpins) { assert.equal(r.free.length, 10); found++; } else assert.equal(r.free.length, 0);
  }
  assert.ok(found > 0);
});

test('penaltı: ödüller köşelere eşit olasılıkla dağılır', () => {
  const random = seededRandom(3);
  const at = [new Map<number, number>(), new Map<number, number>(), new Map<number, number>()];
  const n = 300_000;
  for (let i = 0; i < n; i++) {
    const p = shufflePrizes(random);
    assert.deepEqual([...p].sort((a, b) => a - b), [...PENALTY_PRIZES]);
    p.forEach((prize, corner) => at[corner].set(prize, (at[corner].get(prize) ?? 0) + 1));
  }
  for (const m of at) for (const prize of PENALTY_PRIZES) assert.ok(Math.abs((m.get(prize) ?? 0) / n - 1 / 3) < 0.005);
});

test('pencere şeritten okunur (yapay sembol yok)', () => {
  const stops = [3, 7, 0, 28, 31];
  const g = windowOf(stops);
  g.forEach((col, i) => col.forEach((s, r) => assert.equal(s, REELS[i][(stops[i] + r) % REELS[i].length])));
});

test('açılış penceresi nötr: kazanç, top, düdük ve joker yok', () => {
  const spin = evaluateSpin(windowOf(neutralStops()));
  assert.equal(spin.win, 0);
  assert.ok(spin.grid.flat().every((x) => !['scatter', 'bonus', 'wild'].includes(x)), spin.grid.flat().join());
});
