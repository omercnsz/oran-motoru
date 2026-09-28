// Yaklaşan ve yeni biten maçlar (ESPN). Bir istek = bir lig × bir ay.
import { parseScoreboard, scoreboardUrl, type EspnEvent, type EspnScoreboard } from '@oran/live-sources';

const monthCode = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** [now − pastDays, now + futureDays] aralığında başlayan maçlar (durumlarıyla birlikte) */
export async function loadEspnEvents(league: string, now: Date, pastDays = 2, futureDays = 14): Promise<EspnEvent[]> {
  const from = now.getTime() - pastDays * 86_400_000;
  const until = now.getTime() + futureDays * 86_400_000;
  const months = new Set([from, now.getTime(), until].map((t) => monthCode(new Date(t))));
  const out = new Map<string, EspnEvent>();
  for (const month of months) {
    const res = await fetch(scoreboardUrl(league, month));
    if (!res.ok) throw new Error(`ESPN ${league} ${month}: HTTP ${res.status}`);
    for (const e of parseScoreboard((await res.json()) as EspnScoreboard)) {
      const t = Date.parse(e.kickoff);
      if (t >= from && t <= until) out.set(e.espnId, e);
    }
  }
  return [...out.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}
