// Canlı skor mantığı (Cloudflare'e bağlı değil, tek başına test edilebilir).
import { matchTeam } from '@oran/teams';
import type { LiveMatch } from '@oran/contracts';

// Bizim lig kodlarımız → API-Football lig ID'leri.
// Büyük ligler doğrulandı; E2, E3, EC, G1 ve SC0-SC3 için API-Football panelinden kontrol edin.
export const LEAGUE_IDS: Record<string, number> = {
  T1: 203, E0: 39, E1: 40, E2: 41, E3: 42, EC: 43, SP1: 140, SP2: 141, I1: 135, I2: 136,
  D1: 78, D2: 79, F1: 61, F2: 62, N1: 88, P1: 94, B1: 144, G1: 197, SC0: 179, SC1: 180, SC2: 183, SC3: 184,
};
const CODE_BY_ID: Record<number, string> = Object.fromEntries(Object.entries(LEAGUE_IDS).map(([code, id]) => [id, code]));

/** API-Football /fixtures yanıtındaki bir maç (kullandığımız alanlar) */
export interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
  league: { id: number };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  events?: { type: string; detail?: string; team?: { id: number } }[];
}

/** KV'de saklanan durum */
export interface PollState {
  day?: string;
  used?: number;
  apiRemaining?: number;
  lastPoll?: string;
  updatedAt?: string;
  liveCount?: number;
  matches?: LiveMatch[];
  lastError?: { at: string; message: string } | null;
}

export interface PollConfig {
  dailyLimit: number;
  liveIntervalSec: number;
  idleIntervalSec: number;
}

/** Günlük istek hakkını güne yayarak bir sonraki sorgunun zamanı gelip gelmediğine karar verir. */
export function shouldPoll(state: PollState, now: Date, cfg: PollConfig): { poll: boolean; interval?: number; reason?: string } {
  const day = now.toISOString().slice(0, 10);
  const today = state.day === day;
  const used = today ? state.used ?? 0 : 0;
  const remaining = Math.min(cfg.dailyLimit - used, today ? state.apiRemaining ?? Infinity : Infinity);
  if (remaining <= 0) return { poll: false, reason: 'günlük limit doldu' };

  const endOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const spread = (endOfDay - now.getTime()) / 1000 / remaining; // kalan hakkı güne eşit yaymak için gereken aralık
  const base = (state.liveCount ?? 0) > 0 ? cfg.liveIntervalSec : cfg.idleIntervalSec;
  const interval = Math.max(base, spread);
  const since = state.lastPoll ? (now.getTime() - Date.parse(state.lastPoll)) / 1000 : Infinity;
  // Cron dakikada bir tetiklenir; birkaç saniyelik kaymayı tolere et
  return since + 5 >= interval
    ? { poll: true, interval }
    : { poll: false, reason: `${Math.round(interval - since)} sn sonra`, interval };
}

function engineMinute(status: ApiFixture['fixture']['status']): number {
  if (status.short === 'HT') return 45;
  if (['ET', 'BT', 'P'].includes(status.short)) return 90; // uzatma/penaltı: normal süre bitti
  return Math.min(90, status.elapsed ?? 0);
}

function redCards(item: ApiFixture): { home: number; away: number } {
  const count = { home: 0, away: 0 };
  for (const e of item.events ?? []) {
    if (e.type !== 'Card' || !/red|second yellow/i.test(e.detail ?? '')) continue;
    if (e.team?.id === item.teams.home.id) count.home++;
    else if (e.team?.id === item.teams.away.id) count.away++;
  }
  return count;
}

/**
 * API-Football /fixtures?live=all yanıtını uygulamanın kullanacağı biçime çevirir.
 * teamsByLeague: { T1: ['Galatasaray', ...] } — bizim adlarımız (GitHub Pages'teki ratings dosyalarından).
 * home/away eşleşmezse null olur; uygulama bu durumda takımı lig ortalaması sayar.
 */
export function toLiveMatches(items: ApiFixture[], teamsByLeague: Record<string, string[]>): LiveMatch[] {
  return items
    .filter((it) => CODE_BY_ID[it.league?.id])
    .map((it) => {
      const league = CODE_BY_ID[it.league.id];
      const teams = teamsByLeague[league] ?? [];
      return {
        id: it.fixture.id,
        league,
        kickoff: it.fixture.date,
        status: it.fixture.status.short,
        minute: engineMinute(it.fixture.status),
        elapsed: it.fixture.status.elapsed,
        score: { home: it.goals.home ?? 0, away: it.goals.away ?? 0 },
        redCards: redCards(it),
        home: matchTeam(it.teams.home.name, teams),
        away: matchTeam(it.teams.away.name, teams),
        apiHome: it.teams.home.name,
        apiAway: it.teams.away.name,
      };
    });
}

export function liveLeagues(items: ApiFixture[]): string[] {
  return [...new Set(items.map((it) => CODE_BY_ID[it.league?.id]).filter(Boolean))];
}
