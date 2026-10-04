// Canlı skorlar: telefon önce Cloudflare'deki ESPN önbelleğimize (Worker) sorar, ulaşamazsa ESPN'e doğrudan bağlanır.
// Sadece şu an oynanıyor olabilecek maçların ligleri sorgulanır.
import type { ScheduledMatch, ScheduleFile } from '@oran/contracts';
import {
  espnDateOf, parseScoreboard, scoreboardUrl, type EspnEvent, type EspnEventsResponse, type EspnScoreboard,
} from '@oran/live-sources';
import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/data/api';

export interface LiveRow {
  match: ScheduledMatch;
  event: Pick<EspnEvent, 'state' | 'status' | 'minute' | 'clock' | 'score' | 'redCards' | 'fullTime' | 'homeStyle' | 'awayStyle'>;
}

export interface LiveData {
  rows: LiveRow[];
  /** cache: Cloudflare önbelleği; espn: ESPN'e doğrudan (yedek) */
  source: 'cache' | 'espn';
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

const CACHE_URL = process.env.EXPO_PUBLIC_LIVE_URL?.replace(/\/$/, '');

async function fromCache(league: string, espnDate: string): Promise<EspnEvent[]> {
  const res = await fetch(`${CACHE_URL}/espn/${league}/${espnDate}`);
  if (!res.ok) throw new Error(`Önbellek ${league}: HTTP ${res.status}`);
  return ((await res.json()) as EspnEventsResponse).events;
}

async function fromEspn(league: string, espnDate: string): Promise<EspnEvent[]> {
  const res = await fetch(scoreboardUrl(league, espnDate));
  if (!res.ok) throw new Error(`ESPN ${league}: HTTP ${res.status}`);
  return parseScoreboard((await res.json()) as EspnScoreboard);
}

/** Lig × gün çiftlerinin maçları. Önbellek tanımlıysa önce ona, olmazsa ESPN'e doğrudan sorar. */
export async function fetchEspnEvents(
  pairs: { league: string; espnDate: string }[],
): Promise<{ events: EspnEvent[]; source: LiveData['source'] }> {
  if (CACHE_URL) {
    try {
      const lists = await Promise.all(pairs.map((p) => fromCache(p.league, p.espnDate)));
      return { events: lists.flat(), source: 'cache' };
    } catch (err) {
      console.warn('ESPN önbelleğine ulaşılamadı, ESPN\'e doğrudan bağlanılıyor:', (err as Error).message);
    }
  }
  const lists = await Promise.all(pairs.map((p) => fromEspn(p.league, p.espnDate)));
  return { events: lists.flat(), source: 'espn' };
}

async function liveRows(matches: ScheduledMatch[]): Promise<Omit<LiveData, 'fetchedAt'>> {
  const keys = new Map<string, { league: string; espnDate: string }>();
  for (const m of matches) {
    const espnDate = espnDateOf(m.kickoff);
    keys.set(`${m.league}|${espnDate}`, { league: m.league, espnDate });
  }
  const { events, source } = await fetchEspnEvents([...keys.values()]);
  const byId = new Map(events.map((e) => [e.espnId, e]));
  const rows = matches.flatMap((m) => {
    const e = byId.get(m.espnId);
    return e ? [{ match: m, event: e }] : [];
  });
  return { rows, source };
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
    queryFn: async (): Promise<LiveData> => ({ ...(await liveRows(matches)), fetchedAt: Date.now() }),
    refetchInterval: (q) => (q.state.data?.rows.some((r) => r.event.state === 'in') ? 30_000 : 120_000),
  });
  return { schedule, matches, ...query };
}
