// Örnek: Süper Lig verisiyle güçleri hesapla, bir maçın maç öncesi ve canlı oranlarını yazdır.
// Kullanım: npm run demo -- [EvSahibi] [Deplasman]
import { fitRatings, priceMatch, type PricedMatch } from '@oran/odds-engine';
import { loadSeason } from './football-data.ts';

const [home = 'Galatasaray', away = 'Fenerbahce'] = process.argv.slice(2);
const matches = [
  ...(await loadSeason('T1', '2526', 'data')),
  ...(await loadSeason('T1', '2627', 'data')),
];
const model = fitRatings(matches, { asOf: new Date() });

const pick = (m: PricedMatch, ...keys: string[]) => m.markets.filter((x) => keys.includes(x.key));
function show(title: string, priced: PricedMatch) {
  console.log(`\n=== ${title} ===`);
  console.log(`Beklenen gol: ${priced.home} ${priced.xg.home.toFixed(2)} - ${priced.xg.away.toFixed(2)} ${priced.away}`);
  for (const mk of pick(priced, '1X2', 'DC', 'OU2.5', 'BTTS', 'TG', 'HC-1')) {
    const row = mk.outcomes.map((o) => `${o.label.padEnd(4)} ${o.odds ? o.odds.toFixed(2).padStart(6) : ' kapalı'}  (%${(o.probability * 100).toFixed(1)})`);
    console.log(`${mk.name.padEnd(34)} ${row.join('   ')}`);
  }
  const cs = pick(priced, 'CS')[0].outcomes.filter((o) => o.odds).sort((a, b) => b.probability - a.probability).slice(0, 5);
  console.log(`${'En olası skorlar'.padEnd(34)} ${cs.map((o) => `${o.label} @${o.odds!.toFixed(2)}`).join('   ')}`);
}

console.log('\nEn güçlü 5 hücum:', Object.entries(model.attack).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, v]) => `${t} ${v.toFixed(2)}`).join(', '));
show('Maç öncesi', priceMatch(model, home, away));
show('Canlı: 60. dakika, 1-0', priceMatch(model, home, away, { minute: 60, score: { home: 1, away: 0 } }));
show('Canlı: 60. dakika, 1-0, ev sahibinde kırmızı kart', priceMatch(model, home, away, { minute: 60, score: { home: 1, away: 0 }, redCards: { home: 1, away: 0 } }));
