// ESPN'in herkese açık (resmî olarak belgelenmemiş) skor tablosu.
// Anahtar istemez. Bir istek = bir lig × bir gün (YYYYMMDD) ya da bir ay (YYYYMM).
import type { ResultsFile, ScheduledMatch } from '@oran/contracts';

export const ESPN_SLUGS: Record<string, string> = {
  T1: 'tur.1', E0: 'eng.1', E1: 'eng.2', E2: 'eng.3', E3: 'eng.4', EC: 'eng.5',
  SP1: 'esp.1', SP2: 'esp.2', I1: 'ita.1', I2: 'ita.2', D1: 'ger.1', D2: 'ger.2',
  F1: 'fra.1', F2: 'fra.2', N1: 'ned.1', P1: 'por.1', B1: 'bel.1', G1: 'gre.1',
  SC0: 'sco.1', SC1: 'sco.2', SC2: 'sco.3', SC3: 'sco.4',
};

export function scoreboardUrl(league: string, dates: string): string {
  const slug = ESPN_SLUGS[league];
  if (!slug) throw new Error(`ESPN'de tanımsız lig: ${league}`);
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dates}&limit=500`;
}

const nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

/** ESPN günleri ABD Doğu saatine göre ayırır: bir maçı getirmek için hangi gün sorgulanmalı (YYYYMMDD) */
export function espnDateOf(kickoffIso: string): string {
  return nyDate.format(new Date(kickoffIso)).replace(/-/g, '');
}

/** ESPN yanıtının kullandığımız kısmı */
export interface EspnScoreboard {
  events?: {
    id: string;
    date: string;
    status: {
      clock?: number;
      displayClock?: string;
      period?: number;
      type: { name: string; state: 'pre' | 'in' | 'post'; completed: boolean };
    };
    competitions: {
      competitors: { homeAway: 'home' | 'away'; score?: string; team: { id: string; displayName: string } }[];
      details?: { redCard?: boolean; team?: { id: string } }[];
    }[];
  }[];
}

export interface EspnEvent {
  espnId: string;
  /** ISO UTC */
  kickoff: string;
  state: 'pre' | 'in' | 'post';
  /** ESPN durum adı, ör. STATUS_SECOND_HALF, STATUS_HALFTIME, STATUS_FULL_TIME, STATUS_POSTPONED */
  status: string;
  /** Normal süre sonucu kesin (90 dk bitti) */
  fullTime: boolean;
  /** Oran motoruna verilecek dakika (0–90) */
  minute: number;
  /** Ekranda gösterilecek süre, ör. "67'", "90'+4'" */
  clock: string;
  home: string;
  away: string;
  score: { home: number; away: number };
  redCards: { home: number; away: number };
}

export function parseScoreboard(body: EspnScoreboard): EspnEvent[] {
  return (body.events ?? []).map((e) => {
    const comp = e.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === 'home')!;
    const away = comp.competitors.find((c) => c.homeAway === 'away')!;
    const reds = { home: 0, away: 0 };
    for (const d of comp.details ?? []) {
      if (!d.redCard) continue;
      if (d.team?.id === home.team.id) reds.home++;
      else if (d.team?.id === away.team.id) reds.away++;
    }
    const status = e.status.type.name;
    const state = e.status.type.state;
    const minute = status === 'STATUS_HALFTIME' ? 45
      : state === 'post' ? 90
      : state === 'in' ? Math.min(90, Math.floor((e.status.clock ?? 0) / 60)) : 0;
    return {
      espnId: e.id,
      kickoff: new Date(e.date).toISOString(),
      state,
      status,
      fullTime: status === 'STATUS_FULL_TIME' && e.status.type.completed,
      minute,
      clock: status === 'STATUS_HALFTIME' ? 'İY' : state === 'post' ? 'MS' : e.status.displayClock ?? '',
      home: home.team.displayName,
      away: away.team.displayName,
      score: { home: Number(home.score ?? 0), away: Number(away.score ?? 0) },
      redCards: reds,
    };
  });
}

/**
 * Biten maçları sonuç dosyası biçimine çevirir (kupon sonuçlandırma bu biçimi kullanır).
 * Takım adları ve tarih bizim veri setimizden (program dosyası) alınır; ESPN adları kullanılmaz.
 * Sadece normal sürede biten maçlar alınır: ertelenen/yarıda kalan maçlar 7 gün sonra iade olur.
 */
export function finalsToResults(events: EspnEvent[], schedule: Map<string, ScheduledMatch>): ResultsFile {
  const results: ResultsFile['results'] = [];
  for (const e of events) {
    const m = schedule.get(e.espnId);
    if (m && e.fullTime) results.push({ date: m.date, home: m.home, away: m.away, score: e.score });
  }
  return { league: 'espn', updatedAt: new Date().toISOString(), results };
}

/**
 * Maç öncesi bahisler kaydedilmeden önce son kontrol: fikstür dosyası en fazla bir saat eski olabilir,
 * maç o arada öne alınmış, başlamış ya da ertelenmiş olabilir. ESPN'deki anlık duruma bakılır.
 * Sorun varsa açıklamasını, yoksa null döner. ESPN'de bulunamayan maç engellenmez (saat kontrolü yine geçerli).
 */
export function preMatchProblem(
  selections: { espnId?: string; live?: boolean; home: string; away: string }[],
  events: EspnEvent[],
  now: Date,
): string | null {
  const byId = new Map(events.map((e) => [e.espnId, e]));
  for (const s of selections) {
    if (s.live || !s.espnId) continue;
    const e = byId.get(s.espnId);
    if (!e) continue;
    if (e.state === 'post' && !e.fullTime) return `${s.home} – ${s.away} ertelendi ya da iptal edildi`;
    if (e.state !== 'pre' || Date.parse(e.kickoff) <= now.getTime()) return `${s.home} – ${s.away} başladı; maç öncesi bahis kapandı`;
  }
  return null;
}

/** Worker'ın /espn/<lig>/<tarih> yanıtı: ESPN verisi işlenmiş hâlde */
export interface EspnEventsResponse {
  league: string;
  dates: string;
  fetchedAt: string;
  events: EspnEvent[];
}
