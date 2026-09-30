// Geriye dönük test: global model mi, lig bazlı model mi daha iyi tahmin ediyor?
// Son 12 ayın maçları haftalık olarak, sadece o haftadan önceki verilerle tahmin edilir ve
// bahis piyasasının (football-data.co.uk ortalama oranları) tahminiyle karşılaştırılır.
// Log loss ne kadar düşükse tahmin o kadar iyi.
import { BY_CODE, COMPETITIONS } from '@oran/leagues';
import type { EspnEvent } from '@oran/live-sources';
import { fitRatings, priceMatch, type MatchResult } from '@oran/odds-engine';
import { matchTeam } from '@oran/teams';
import { loadCompetition } from './espn.ts';
import { loadSeason, seasonCode, type CsvMatch } from './football-data.ts';

const DAY = 86_400_000;
const TEST_LEAGUES = ['T1', 'E0', 'SP1', 'I1', 'D1', 'F1'];
const now = new Date();
const testFrom = new Date(now.getTime() - 365 * DAY);
const historyFrom = new Date(testFrom.getTime() - 400 * DAY);

// ESPN: tüm turnuvalar (global model için hepsi gerekli)
const byComp = new Map<string, EspnEvent[]>();
for (const comp of COMPETITIONS) {
  try { byComp.set(comp.code, await loadCompetition(comp, historyFrom, now, now, 'data/espn')); } catch { /* atla */ }
}
const toResult = (e: EspnEvent): MatchResult => ({ date: new Date(e.kickoff), home: e.homeId, away: e.awayId, hg: e.score.home, ag: e.score.away });
const allPlayed = [...new Map([...byComp.values()].flat().filter((e) => e.fullTime).map((e) => [e.espnId, e])).values()];

// Piyasa oranları (football-data) → ESPN maçlarıyla eşleştir
type Test = { league: string; e: EspnEvent; market: [number, number, number] };
const tests: Test[] = [];
for (const code of TEST_LEAGUES) {
  const fd: CsvMatch[] = [];
  for (const s of [seasonCode(now, -1), seasonCode(now)]) fd.push(...await loadSeason(code, s, 'data').catch((): CsvMatch[] => []));
  const fdTeams = [...new Set(fd.flatMap((m) => [m.home, m.away]))];
  const key = (d: string, h: string, a: string) => `${d}|${h}|${a}`;
  const fdByKey = new Map(fd.filter((m) => Number.isFinite(m.marketOdds.H)).map((m) => [key(m.date.toISOString().slice(0, 10), m.home, m.away), m]));
  for (const e of byComp.get(code) ?? []) {
    if (!e.fullTime || Date.parse(e.kickoff) < testFrom.getTime()) continue;
    const h = matchTeam(e.home, fdTeams), a = matchTeam(e.away, fdTeams);
    if (!h || !a) continue;
    // Tarih farkı olabilir (saat dilimi): aynı gün ya da bir gün önce
    const d0 = e.kickoff.slice(0, 10), d1 = new Date(Date.parse(e.kickoff) - DAY).toISOString().slice(0, 10);
    const m = fdByKey.get(key(d0, h, a)) ?? fdByKey.get(key(d1, h, a));
    if (!m) continue;
    const inv = [1 / m.marketOdds.H, 1 / m.marketOdds.D, 1 / m.marketOdds.A];
    const s = inv[0] + inv[1] + inv[2];
    tests.push({ league: code, e, market: [inv[0] / s, inv[1] / s, inv[2] / s] });
  }
}

// Haftalık yeniden kurulan modeller
const weekOf = (t: number) => Math.floor(t / (7 * DAY));
const byWeek = new Map<number, Test[]>();
for (const t of tests) byWeek.set(weekOf(Date.parse(t.e.kickoff)), [...(byWeek.get(weekOf(Date.parse(t.e.kickoff))) ?? []), t]);

const score = { global: new Map<string, number>(), perLeague: new Map<string, number>(), market: new Map<string, number>(), n: new Map<string, number>() };
const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
for (const [week, games] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
  const asOf = new Date(week * 7 * DAY);
  const windowStart = asOf.getTime() - 400 * DAY;
  const past = allPlayed.filter((e) => { const t = Date.parse(e.kickoff); return t < asOf.getTime() && t >= windowStart; });
  const global = fitRatings(past.map(toResult), { asOf });
  const perLeague = new Map<string, ReturnType<typeof fitRatings>>();
  for (const code of new Set(games.map((g) => g.league))) {
    const ids = new Set((byComp.get(code) ?? []).map((e) => e.espnId));
    perLeague.set(code, fitRatings(past.filter((e) => ids.has(e.espnId)).map(toResult), { asOf }));
  }
  for (const g of games) {
    const res = g.e.score.home > g.e.score.away ? 0 : g.e.score.home === g.e.score.away ? 1 : 2;
    const p = (model: ReturnType<typeof fitRatings>) =>
      priceMatch(model, g.e.homeId, g.e.awayId).markets.find((m) => m.key === '1X2')!.outcomes[res].probability;
    for (const k of [g.league, 'TOPLAM']) {
      add(score.global, k, -Math.log(p(global)));
      add(score.perLeague, k, -Math.log(p(perLeague.get(g.league)!)));
      add(score.market, k, -Math.log(g.market[res]));
      add(score.n, k, 1);
    }
  }
}

console.log(`Test: ${tests.length} maç, ${byWeek.size} hafta (${testFrom.toISOString().slice(0, 10)} → bugün). Log loss, düşük daha iyi:\n`);
console.log('Lig'.padEnd(18), 'Maç'.padStart(5), 'Global'.padStart(9), 'Lig bazlı'.padStart(10), 'Piyasa'.padStart(9));
for (const k of [...TEST_LEAGUES, 'TOPLAM']) {
  const n = score.n.get(k) ?? 0;
  if (!n) continue;
  const f = (m: Map<string, number>) => ((m.get(k) ?? 0) / n).toFixed(4).padStart(9);
  console.log((BY_CODE[k]?.name ?? k).padEnd(18), String(n).padStart(5), f(score.global), f(score.perLeague).padStart(10), f(score.market));
}
console.log(`\nTahminsiz (her sonuca 1/3): ${Math.log(3).toFixed(4)}`);
