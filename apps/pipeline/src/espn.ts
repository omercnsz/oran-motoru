// ESPN'den geçmiş ve gelecek maçlar. Bir istek = bir turnuva × bir ay.
// Bitmiş ayların verisi diske yazılır ve bir daha indirilmez; saatlik çalışmada sadece son aylar yenilenir.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Competition } from '@oran/leagues';
import { parseScoreboard, scoreboardUrl, type EspnEvent, type EspnScoreboard } from '@oran/live-sources';

const USER_AGENT = 'oran-pipeline/1.0 (+https://github.com/omercnsz/oran-motoru)';
const PAUSE_MS = 150; // ESPN'e nazik olmak için istekler arası bekleme
const FINAL_AFTER_DAYS = 7; // ay bittikten bu kadar gün sonra sonuçlar kesin sayılır (ertelenen maçlar vb.)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export let requestCount = 0;

async function fetchMonth(league: string, month: string): Promise<EspnEvent[]> {
  for (let attempt = 1; ; attempt++) {
    await sleep(PAUSE_MS);
    requestCount++;
    const res = await fetch(scoreboardUrl(league, month), { headers: { 'user-agent': USER_AGENT } });
    if (res.ok) return parseScoreboard((await res.json()) as EspnScoreboard);
    if (attempt >= 3 || (res.status !== 429 && res.status < 500)) throw new Error(`ESPN ${league} ${month}: HTTP ${res.status}`);
    await sleep(2000 * attempt);
  }
}

function monthsBetween(from: Date, until: Date): string[] {
  const out: string[] = [];
  for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)); d <= until; d.setUTCMonth(d.getUTCMonth() + 1)) {
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Turnuvanın [from, until] aralığındaki maçları (aylık önbellekle) */
export async function loadCompetition(comp: Competition, from: Date, until: Date, now: Date, cacheDir: string): Promise<EspnEvent[]> {
  const dir = `${cacheDir}/${comp.slug}`;
  await mkdir(dir, { recursive: true });
  const events: EspnEvent[] = [];
  for (const month of monthsBetween(from, until)) {
    const y = Number(month.slice(0, 4)), m = Number(month.slice(4));
    const final = Date.UTC(y, m, 1) + FINAL_AFTER_DAYS * 86_400_000 < now.getTime();
    const path = `${dir}/${month}.json`;
    let monthEvents: EspnEvent[] | null = null;
    if (final) monthEvents = await readFile(path, 'utf8').then((t) => JSON.parse(t) as EspnEvent[]).catch(() => null);
    if (!monthEvents) {
      monthEvents = await fetchMonth(comp.code, month);
      if (final) await writeFile(path, JSON.stringify(monthEvents));
    }
    events.push(...monthEvents);
  }
  const t0 = from.getTime(), t1 = until.getTime();
  const unique = new Map(events.filter((e) => { const t = Date.parse(e.kickoff); return t >= t0 && t <= t1; }).map((e) => [e.espnId, e]));
  return [...unique.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}
