// GitHub Actions'ın saatte bir çalıştırdığı betik:
// tüm turnuvaların maçlarını ESPN'den indirir, dünyadaki bütün takımlar için TEK bir güç modeli kurar
// (kıta kupaları ve kupalar ligleri birbirine bağlar), yaklaşan maçların oranlarını üretir ve
// uygulamanın okuyacağı JSON dosyalarını public/ klasörüne yazar.
import { mkdir, writeFile } from 'node:fs/promises';
import { utcToUkDate } from '@oran/betting';
import type { IndexFile, OddsFile, RatingsFile, ResultsFile, ScheduleFile, ScheduledMatch, UpcomingMatch } from '@oran/contracts';
import { COMPETITIONS } from '@oran/leagues';
import type { EspnEvent } from '@oran/live-sources';
import { fitRatings, priceMatch, type MatchResult } from '@oran/odds-engine';
import { loadCompetition, requestCount } from './espn.ts';

const OUT = 'public';
const CACHE = 'data/espn';
const DAY = 86_400_000;
const HISTORY_DAYS = 400; // model bu kadar geriye bakar (eski maçların ağırlığı zaten azalıyor)
const FUTURE_DAYS = 14;
const MIN_MATCHES = 4; // hakkında bundan az maç olan takıma oran üretilmez (ör. kupadaki amatör takımlar)

const now = new Date();
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const json = (path: string, data: IndexFile | OddsFile | RatingsFile | ResultsFile | ScheduleFile) =>
  writeFile(`${OUT}/${path}`, JSON.stringify(data));

for (const d of ['ratings', 'odds', 'results']) await mkdir(`${OUT}/${d}`, { recursive: true });

// 1) Tüm turnuvaların maçları
const from = new Date(now.getTime() - HISTORY_DAYS * DAY);
const until = new Date(now.getTime() + FUTURE_DAYS * DAY);
const byComp = new Map<string, EspnEvent[]>();
for (const comp of COMPETITIONS) {
  try {
    byComp.set(comp.code, await loadCompetition(comp, from, until, now, CACHE));
  } catch (err) {
    console.warn(`${comp.code} atlandı: ${(err as Error).message}`);
  }
}

// 2) Global model: bütün turnuvaların biten maçları, takımlar ESPN kimliğiyle
const names = new Map<string, string>(); // ESPN takım kimliği → en güncel ad
const played = new Map<string, MatchResult>();
const matchCount = new Map<string, number>();
for (const events of byComp.values()) {
  for (const e of events) {
    names.set(e.homeId, e.home);
    names.set(e.awayId, e.away);
    if (!e.fullTime || played.has(e.espnId)) continue;
    played.set(e.espnId, { date: new Date(e.kickoff), home: e.homeId, away: e.awayId, hg: e.score.home, ag: e.score.away });
    for (const id of [e.homeId, e.awayId]) matchCount.set(id, (matchCount.get(id) ?? 0) + 1);
  }
}
const model = fitRatings([...played.values()], { asOf: now });
console.log(`Model: ${played.size} maç, ${Object.keys(model.attack).length} takım (${requestCount} ESPN isteği)`);

// 3) Turnuva başına dosyalar
const index: IndexFile = { updatedAt: now.toISOString(), leagues: [] };
const schedule: ScheduledMatch[] = [];
let skipped = 0;
for (const comp of COMPETITIONS) {
  const events = byComp.get(comp.code);
  if (!events) continue;

  // Takım güçleri (bu turnuvadaki takımlar, adlarıyla): uygulama canlı oranları bununla hesaplar
  const attack: Record<string, number> = {}, defense: Record<string, number> = {};
  for (const e of events) {
    for (const [id, name] of [[e.homeId, e.home], [e.awayId, e.away]]) {
      if (model.attack[id] === undefined || attack[name] !== undefined) continue;
      attack[name] = round(model.attack[id]);
      defense[name] = round(model.defense[id]);
    }
  }
  await json(`ratings/${comp.code}.json`, {
    league: comp.code, updatedAt: now.toISOString(),
    homeAvg: round(model.homeAvg), awayAvg: round(model.awayAvg), attack, defense,
  });

  // Program (son 2 gün + önümüzdeki 14 gün) ve maç öncesi oranlar
  const odds: UpcomingMatch[] = [];
  for (const e of events) {
    const t = Date.parse(e.kickoff);
    if (t < now.getTime() - 2 * DAY) continue;
    const date = utcToUkDate(e.kickoff);
    const id = `${comp.code}-${e.espnId}`;
    schedule.push({ league: comp.code, id, espnId: e.espnId, home: e.home, away: e.away, date, kickoff: e.kickoff });
    if (e.state !== 'pre' || t <= now.getTime()) continue;
    if ((matchCount.get(e.homeId) ?? 0) < MIN_MATCHES || (matchCount.get(e.awayId) ?? 0) < MIN_MATCHES) {
      skipped++;
      continue;
    }
    const priced = priceMatch(model, e.homeId, e.awayId);
    odds.push({
      id, espnId: e.espnId, date, kickoff: e.kickoff, home: e.home, away: e.away,
      xg: { home: round(priced.xg.home, 2), away: round(priced.xg.away, 2) },
      markets: Object.fromEntries(priced.markets.map((mk) => [mk.key, Object.fromEntries(mk.outcomes.map((o) => [o.key, o.odds]))])),
    });
  }
  await json(`odds/${comp.code}.json`, { league: comp.code, updatedAt: now.toISOString(), matches: odds });

  // Son 30 günün sonuçları: gölge kuponları sonuçlandırmak için
  const results = events.filter((e) => e.fullTime && Date.parse(e.kickoff) >= now.getTime() - 30 * DAY)
    .map((e) => ({ date: utcToUkDate(e.kickoff), home: e.home, away: e.away, score: e.score }));
  await json(`results/${comp.code}.json`, { league: comp.code, updatedAt: now.toISOString(), results });

  index.leagues.push({ code: comp.code, name: comp.name, kind: comp.kind, region: comp.region, teams: Object.keys(attack).length, upcoming: odds.length, results: results.length });
}

await json('index.json', index);
schedule.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
await json('schedule.json', { updatedAt: now.toISOString(), matches: schedule });
const withMatches = index.leagues.filter((l) => l.upcoming > 0).length;
console.log(`${index.leagues.length} turnuva (${withMatches} tanesinde yaklaşan maç), ${index.leagues.reduce((a, l) => a + l.upcoming, 0)} oranlı maç, programda ${schedule.length} maç; yetersiz veri yüzünden ${skipped} maç atlandı`);
