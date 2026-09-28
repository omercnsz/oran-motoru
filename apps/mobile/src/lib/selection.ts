import type { Selection } from '@oran/betting';
import type { UpcomingMatch } from '@oran/contracts';

import type { LiveRow } from '@/data/live';

export function toSelection(league: string, m: UpcomingMatch, marketKey: string, outcomeKey: string): Selection | null {
  const odds = m.markets[marketKey]?.[outcomeKey];
  if (!odds) return null;
  return {
    matchId: m.id, league, home: m.home, away: m.away, date: m.date, kickoff: m.kickoff, espnId: m.espnId,
    marketKey, outcomeKey, odds,
  };
}

export function toLiveSelection(row: LiveRow, marketKey: string, outcomeKey: string, odds: number | null): Selection | null {
  if (!odds) return null;
  const m = row.match;
  return {
    matchId: m.id, league: m.league, home: m.home, away: m.away, date: m.date, kickoff: m.kickoff, espnId: m.espnId,
    live: true, marketKey, outcomeKey, odds,
  };
}
