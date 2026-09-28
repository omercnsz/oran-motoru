// Geriye dönük test: her maç gününden önce sadece o güne kadarki maçlarla model kurulur,
// maçın 1X2 olasılıkları tahmin edilir ve bahis piyasasının (ortalama oranların) tahminiyle karşılaştırılır.
// Log loss ne kadar düşükse tahmin o kadar iyi. Piyasa çok iyi bir ölçüttür; ona yakın olmak yeterli.
import { fitRatings, priceMatch } from '@oran/odds-engine';
import { loadSeason } from './football-data.ts';

const matches = [
  ...(await loadSeason('T1', '2425', 'data')),
  ...(await loadSeason('T1', '2526', 'data')),
  ...(await loadSeason('T1', '2627', 'data')),
].sort((a, b) => a.date.getTime() - b.date.getTime());

const start = new Date(Date.UTC(2025, 9, 1)); // 2025/26'nın ilk haftalarını ısınma say
const tested = matches.filter((m) => m.date >= start && Number.isFinite(m.hg) && Number.isFinite(m.marketOdds.H));

const byDay = Map.groupBy(tested, (m) => m.date.getTime());
let staked = 0, returned = 0;
let n = 0, llModel = 0, llMarket = 0, absDiff = 0, goalsPred = 0, goalsReal = 0;
const calib = Array.from({ length: 10 }, () => ({ p: 0, hit: 0, n: 0 }));

for (const [day, games] of byDay) {
  const model = fitRatings(matches, { asOf: new Date(day) });
  for (const g of games) {
    const priced = priceMatch(model, g.home, g.away);
    const outs = priced.markets.find((m) => m.key === '1X2')!.outcomes;
    const [p1, px, p2] = outs.map((o) => o.probability);
    const inv = [1 / g.marketOdds.H, 1 / g.marketOdds.D, 1 / g.marketOdds.A];
    const s = inv[0] + inv[1] + inv[2];
    const [q1, qx, q2] = inv.map((x) => x / s);

    const res = g.hg > g.ag ? 0 : g.hg === g.ag ? 1 : 2;
    // Her sonuca 1 birim yatıran biri bizim oranlarımızla ne kadar geri alırdı?
    for (const [i, o] of outs.entries()) if (o.odds) { staked++; if (i === res) returned += o.odds; }
    llModel -= Math.log([p1, px, p2][res]);
    llMarket -= Math.log([q1, qx, q2][res]);
    absDiff += (Math.abs(p1 - q1) + Math.abs(px - qx) + Math.abs(p2 - q2)) / 3;
    goalsPred += priced.xg.home + priced.xg.away;
    goalsReal += g.hg + g.ag;
    const b = calib[Math.min(9, Math.floor(p1 * 10))];
    b.p += p1; b.hit += res === 0 ? 1 : 0; b.n++;
    n++;
  }
}

console.log(`Test edilen maç: ${n}`);
console.log(`Log loss  → bizim motor: ${(llModel / n).toFixed(4)}   piyasa: ${(llMarket / n).toFixed(4)}   (tahminsiz: ${Math.log(3).toFixed(4)})`);
console.log(`Piyasa olasılıklarından ortalama sapma: ${((absDiff / n) * 100).toFixed(1)} puan`);
console.log(`Maç başı gol → tahmin: ${(goalsPred / n).toFixed(2)}   gerçek: ${(goalsReal / n).toFixed(2)}`);
console.log(`Bizim oranlarla her sonuca bahis yapan oyuncunun getirisi: %${(((returned - staked) / staked) * 100).toFixed(1)} (kasa payı ~%6)`);
console.log('\nKalibrasyon (ev sahibi galibiyeti): tahmin edilen vs gerçekleşen');
for (const [i, b] of calib.entries()) {
  if (b.n >= 10) console.log(`  %${i * 10}-${i * 10 + 10}: tahmin %${((b.p / b.n) * 100).toFixed(0).padStart(2)}  gerçek %${((b.hit / b.n) * 100).toFixed(0).padStart(2)}  (${b.n} maç)`);
}
