import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRASH, TOKEN, crashPoint, crashRtp, multiplierAt, msToReach, seededRandom, settleCrash, simulateCrash, uniformFromBytes,
} from '../src/index.ts';

const ROUNDS = 10_000_000;

test('patlama noktası: sınırlar', () => {
  assert.equal(crashPoint(0), 1); // %3'lük anında patlama bölgesi
  assert.equal(crashPoint(1 - 0.97 / 2), 2);
  assert.equal(crashPoint(1 - 0.97 / 10), 10);
  assert.equal(crashPoint(1 - 1e-15), CRASH.maxMultiplier);
  assert.throws(() => crashPoint(1));
  assert.throws(() => crashPoint(-0.1));
});

test('patlama noktası iki ondalıklı ve en az 1,00', () => {
  const random = seededRandom(7);
  for (let i = 0; i < 100_000; i++) {
    const c = crashPoint(random());
    assert.ok(c >= 1);
    assert.equal(Math.round(c * 100) / 100, c);
  }
});

// Faz 3'ün bitiş ölçütü: 10 milyon turda geri dönüş oranı hedefin (%97) ±0,1 puan içinde
for (const target of [1.5, 2]) {
  test(`10 milyon tur, hedef ${target}×: RTP %97 ± %0,1`, () => {
    const { rtp, winRate } = simulateCrash(ROUNDS, target, seededRandom(Math.round(target * 1000)));
    assert.ok(Math.abs(rtp - 0.97) <= 0.001, `RTP ${rtp}`);
    assert.ok(Math.abs(winRate - 0.97 / target) <= 0.001, `kazanma oranı ${winRate}`);
  });
}

// Yüksek hedeflerde tek tur çok değişken; tolerans istatistiksel (4 standart sapma)
for (const target of [10, 100]) {
  test(`10 milyon tur, hedef ${target}×: RTP %97 (istatistiksel sınır içinde)`, () => {
    const p = 0.97 / target;
    const sd = target * Math.sqrt(p * (1 - p) / ROUNDS);
    const { rtp } = simulateCrash(ROUNDS, target, seededRandom(target));
    assert.ok(Math.abs(rtp - 0.97) <= 4 * sd, `RTP ${rtp}, sınır ±${(4 * sd).toFixed(4)}`);
  });
}

test('teorik RTP her hedefte aynı: elle çekmek avantaj sağlamaz', () => {
  for (const t of [1.01, 1.5, 2, 3.33, 10, 250, 1000]) assert.ok(Math.abs(crashRtp(t) - 0.97) < 1e-12, String(t));
});

test('her tur farklı hedefle oynayan oyuncu da uzun vadede %97 alır', () => {
  const random = seededRandom(42);
  let staked = 0, returned = 0;
  for (let i = 0; i < 2_000_000; i++) {
    const target = Math.round((1.01 + random() * 4) * 100) / 100; // 1,01–5,01 arası rastgele hedef
    returned += settleCrash(100, crashPoint(random()), target).payout;
    staked += 100;
  }
  assert.ok(Math.abs(returned / staked - 0.97) <= 0.003, String(returned / staked));
});

test('küçük bahiste de ödeme kesin: yuvarlama sapması yok', () => {
  // 10 jeton × 1,55 = 15,50 jeton (tam jetona yuvarlansaydı bu kombinasyonda RTP %100'ü geçerdi)
  assert.equal(settleCrash(10 * TOKEN, 3, 1.55).payout, 1550);
  const { rtp } = simulateCrash(ROUNDS / 5, 1.55, seededRandom(155), 10 * TOKEN);
  assert.ok(Math.abs(rtp - 0.97) <= 0.003, `RTP ${rtp}`);
});

test('sonuçlandırma', () => {
  const bet = 100 * TOKEN;
  assert.deepEqual(settleCrash(bet, 2.5, 2), { won: true, payout: 2 * bet, net: bet });
  assert.deepEqual(settleCrash(bet, 2.5, 2.5), { won: true, payout: 2.5 * bet, net: 1.5 * bet });
  assert.deepEqual(settleCrash(bet, 2.5, 2.51), { won: false, payout: 0, net: -bet }); // patlamaya yetişemedi
  assert.deepEqual(settleCrash(bet, 1, null), { won: false, payout: 0, net: -bet });
  assert.equal(settleCrash(TOKEN, 3, 1.07).payout, 107); // kayan nokta: 1,07 × 100 = 107,00000000000001
  assert.throws(() => settleCrash(150, 3, 2)); // 1,5 jeton bahis olmaz
  // 1,00×'te çekmek bahsi geri almak olurdu: anında patlamadan (%3) kaçmayı engellemek için kayıp sayılır
  assert.equal(settleCrash(bet, 1, 1).won, false);
  assert.equal(settleCrash(bet, 5, 1).won, false);
});

test('çarpan zamanla artar; 2× yaklaşık 7 saniyede', () => {
  assert.equal(multiplierAt(0), 1);
  assert.equal(multiplierAt(msToReach(2)), 2);
  assert.ok(Math.abs(msToReach(2) - 6931) < 1);
  let last = 1;
  for (let ms = 0; ms < 60_000; ms += 17) {
    const m = multiplierAt(ms);
    assert.ok(m >= last);
    last = m;
  }
});

test('rastgelelik: baytlardan [0,1) aralığında sayı; tohumlu üreteç tekrarlanabilir ve düzgün', () => {
  assert.equal(uniformFromBytes(new Uint8Array(7)), 0);
  assert.ok(uniformFromBytes(new Uint8Array(7).fill(255)) < 1);
  const a = seededRandom(1), b = seededRandom(1);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
  const r = seededRandom(3);
  let sum = 0;
  const n = 1_000_000;
  for (let i = 0; i < n; i++) sum += r();
  assert.ok(Math.abs(sum / n - 0.5) < 0.002);
});
