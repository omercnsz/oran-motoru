// GitHub Actions'ın düzenli çalıştırdığı betik:
// maç sonuçlarını indirir, takım güçlerini hesaplar, yaklaşan maçların oranlarını üretir
// ve uygulamanın okuyacağı JSON dosyalarını public/ klasörüne yazar.
import { mkdir, writeFile } from 'node:fs/promises';
import { utcToUkDate } from '@oran/betting';
import { matchTeam } from '@oran/teams';
import { fitRatings, priceMatch } from '@oran/odds-engine';
import type { IndexFile, OddsFile, RatingsFile, ResultsFile, ScheduleFile, ScheduledMatch, UpcomingMatch } from '@oran/contracts';
import { loadSeason, seasonCode, type CsvMatch } from './football-data.ts';
import { loadEspnEvents } from './espn.ts';

const LEAGUES: Record<string, string> = {
  T1: 'Süper Lig',
  E0: 'Premier League', E1: 'Championship', E2: 'League One', E3: 'League Two', EC: 'National League',
  SP1: 'La Liga', SP2: 'La Liga 2', I1: 'Serie A', I2: 'Serie B', D1: 'Bundesliga', D2: '2. Bundesliga',
  F1: 'Ligue 1', F2: 'Ligue 2', N1: 'Eredivisie', P1: 'Liga Portugal', B1: 'Jupiler Pro League', G1: 'Super League Yunanistan',
  SC0: 'İskoçya Premiership', SC1: 'İskoçya Championship', SC2: 'İskoçya League One', SC3: 'İskoçya League Two',
};
const OUT = 'public';
const now = new Date();
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const json = (path: string, data: IndexFile | OddsFile | RatingsFile | ResultsFile | ScheduleFile) => writeFile(`${OUT}/${path}`, JSON.stringify(data));

await mkdir(`${OUT}/ratings`, { recursive: true });
await mkdir(`${OUT}/odds`, { recursive: true });
await mkdir(`${OUT}/results`, { recursive: true });
await mkdir('data', { recursive: true });

const index: IndexFile = { updatedAt: now.toISOString(), leagues: [] };
const schedule: ScheduledMatch[] = [];
for (const [code, name] of Object.entries(LEAGUES)) {
  let matches: CsvMatch[];
  try {
    const seasons = await Promise.all([seasonCode(now, -1), seasonCode(now)].map((s) =>
      loadSeason(code, s, 'data').catch((): CsvMatch[] => [])));
    matches = seasons.flat();
    if (matches.length === 0) throw new Error('veri yok');
  } catch (err) {
    console.warn(`${code} atlandı: ${(err as Error).message}`);
    continue;
  }

  // 1) Takım güçleri: uygulama canlı oranları bu dosyayla cihazda hesaplar
  const model = fitRatings(matches, { asOf: now });
  const r = (obj: Record<string, number>) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, round(v)]));
  await json(`ratings/${code}.json`, {
    league: code, updatedAt: now.toISOString(),
    homeAvg: round(model.homeAvg), awayAvg: round(model.awayAvg),
    attack: r(model.attack), defense: r(model.defense),
  });

  // 2) Son 2 gün + önümüzdeki 14 günün maçları (ESPN). Başlamamış olanlara maç öncesi oran üretilir;
  // hepsi schedule.json'a girer (canlı ekran ve hızlı sonuçlandırma için).
  // Takım adları bizim veri setimize eşlenir; eşleşmeyen maç atlanır (oranı güvenilir olmaz).
  const teams = Object.keys(model.attack);
  let fixtures: Awaited<ReturnType<typeof loadEspnEvents>> = [];
  try {
    fixtures = await loadEspnEvents(code, now);
  } catch (err) {
    console.warn(`${code} fikstür alınamadı: ${(err as Error).message}`);
  }
  const odds: UpcomingMatch[] = [];
  for (const f of fixtures) {
    const home = matchTeam(f.home, teams), away = matchTeam(f.away, teams);
    if (!home || !away) {
      console.warn(`${code} eşleşmedi: ${f.home}${home ? '' : ' (?)'} – ${f.away}${away ? '' : ' (?)'}`);
      continue;
    }
    const date = utcToUkDate(f.kickoff);
    const id = `${code}-${date}-${home}-${away}`.replace(/\s+/g, '_');
    schedule.push({ league: code, id, espnId: f.espnId, home, away, date, kickoff: f.kickoff });
    if (f.state !== 'pre' || Date.parse(f.kickoff) <= now.getTime()) continue;
    const priced = priceMatch(model, home, away);
    odds.push({
      id, espnId: f.espnId,
      date, kickoff: f.kickoff,
      home, away,
      xg: { home: round(priced.xg.home, 2), away: round(priced.xg.away, 2) },
      markets: Object.fromEntries(priced.markets.map((mk) => [mk.key,
        Object.fromEntries(mk.outcomes.map((o) => [o.key, o.odds]))])),
    });
  }
  await json(`odds/${code}.json`, { league: code, updatedAt: now.toISOString(), matches: odds });

  // 3) Son 30 günün sonuçları: gölge bahis kuponlarını sonuçlandırmak için
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const results = matches.filter((m) => m.date >= since && Number.isFinite(m.hg))
    .map((m) => ({ date: m.date.toISOString().slice(0, 10), home: m.home, away: m.away, score: { home: m.hg, away: m.ag } }));
  await json(`results/${code}.json`, { league: code, updatedAt: now.toISOString(), results });

  index.leagues.push({ code, name, teams: Object.keys(model.attack).length, upcoming: odds.length, results: results.length });
  console.log(`${code.padEnd(4)} ${name.padEnd(20)} ${String(Object.keys(model.attack).length).padStart(2)} takım, ${String(odds.length).padStart(2)} yaklaşan maç, ${results.length} sonuç`);
}

await json('index.json', index);
schedule.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
await json('schedule.json', { updatedAt: now.toISOString(), matches: schedule });
console.log(`\n${index.leagues.length} lig, programda ${schedule.length} maç → ${OUT}/`);
