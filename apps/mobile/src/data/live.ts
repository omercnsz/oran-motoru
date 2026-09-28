// Canlı skorlar: telefon doğrudan ESPN'den çeker; ESPN çalışmazsa (ve adres tanımlıysa) bizim Worker'a geçer.
// Sadece şu an oynanıyor olabilecek maçların ligleri sorgulanır.
import type { LiveFile, ScheduledMatch, ScheduleFile } from '@oran/contracts';
import { espnDateOf, parseScoreboard, scoreboardUrl, type EspnEvent, type EspnScoreboard } from '@oran/live-sources';
import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/data/api';

export interface LiveRow {
  match: ScheduledMatch;
  event: Pick<EspnEvent, 'state' | 'status' | 'minute' | 'clock' | 'score' | 'redCards' | 'fullTime'>;
}

export interface LiveData {
  rows: LiveRow[];
  source: 'espn' | 'worker';
  fetchedAt: number;
}

const BEFORE_MS = 30 * 60_000; // başlamasına 30 dk kalanlar
const AFTER_MS = 3 * 3_600_000; // başlayalı 3 saati geçmeyenler (uzatmalar, gecikmeler dahil)

/** Şu an canlı ekranda olması gereken maçlar */
export function activeMatches(schedule: ScheduleFile | undefined, now: number): ScheduledMatch[] {
  return (schedule?.matches ?? []).filter((m) => {
    const t = Date.parse(m.kickoff);
    return t - BEFORE_MS <= now && now <= t + AFTER_MS;
  });
}

export async function fetchEspnEvents(pairs: { league: string; espnDate: string }[]): Promise<EspnEvent[]> {
  const bodies = await Promise.all(pairs.map(async ({ league, espnDate }) => {
    const res = await fetch(scoreboardUrl(league, espnDate));
    if (!res.ok) throw new Error(`ESPN ${league}: HTTP ${res.status}`);
    return (await res.json()) as EspnScoreboard;
  }));
  return bodies.flatMap(parseScoreboard);
}

async function fromEspn(matches: ScheduledMatch[]): Promise<LiveRow[]> {
  const keys = new Map<string, { league: string; espnDate: string }>();
  for (const m of matches) {
    const espnDate = espnDateOf(m.kickoff);
    keys.set(`${m.league}|${espnDate}`, { league: m.league, espnDate });
  }
  const byId = new Map((await fetchEspnEvents([...keys.values()])).map((e) => [e.espnId, e]));
  return matches.flatMap((m) => {
    const e = byId.get(m.espnId);
    return e ? [{ match: m, event: e }] : [];
  });
}

/** Yedek: Worker /live (API-Football). Takım adları Worker'da zaten bizim adlarımıza eşlenmiş olarak gelir. */
async function fromWorker(matches: ScheduledMatch[]): Promise<LiveRow[]> {
  const url = process.env.EXPO_PUBLIC_LIVE_URL;
  if (!url) throw new Error('Yedek canlı skor servisi tanımlı değil');
  const res = await fetch(`${url.replace(/\/$/, '')}/live`);
  if (!res.ok) throw new Error(`Canlı skor servisi: HTTP ${res.status}`);
  const live = (await res.json()) as LiveFile;
  return matches.flatMap((m) => {
    const l = live.matches.find((x) => x.league === m.league && x.home === m.home && x.away === m.away);
    if (!l) return [];
    const finished = l.status === 'FT';
    return [{ match: m, event: {
      state: finished ? 'post' : 'in', status: l.status, minute: l.minute, clock: finished ? 'MS' : l.status === 'HT' ? 'İY' : `${l.elapsed ?? l.minute}'`,
      score: l.score, redCards: l.redCards, fullTime: finished,
    } }];
  });
}

export function useSchedule() {
  return useQuery({ queryKey: ['schedule'], queryFn: () => fetchJson<ScheduleFile>('schedule.json'), staleTime: 30 * 60_000 });
}

/** Canlı skorlar: oynanan maç varken 30 sn'de bir, yokken 2 dk'da bir yenilenir (uygulama öndeyken). */
export function useLive(now: number) {
  const schedule = useSchedule();
  const matches = activeMatches(schedule.data, now);
  const ids = matches.map((m) => m.espnId).join(',');
  const query = useQuery({
    queryKey: ['live', ids],
    enabled: matches.length > 0,
    queryFn: async (): Promise<LiveData> => {
      try {
        return { rows: await fromEspn(matches), source: 'espn', fetchedAt: Date.now() };
      } catch (err) {
        try {
          return { rows: await fromWorker(matches), source: 'worker', fetchedAt: Date.now() };
        } catch {
          throw err;
        }
      }
    },
    refetchInterval: (q) => (q.state.data?.rows.some((r) => r.event.state === 'in') ? 30_000 : 120_000),
  });
  return { schedule, matches, ...query };
}
