// Cloudflare Worker: dakikada bir tetiklenir, gerektiğinde API-Football'dan canlı skorları çeker,
// takım adlarını bizim verimizle eşler ve KV'ye yazar. Uygulama GET /live ile okur.
import type { LiveFile, RatingsFile } from '@oran/contracts';
import { shouldPoll, toLiveMatches, liveLeagues, type ApiFixture, type PollConfig, type PollState } from './live.ts';

const API = 'https://v3.football.api-sports.io';

export interface Env {
  LIVE: KVNamespace;
  API_FOOTBALL_KEY: string;
  DATA_BASE_URL: string;
  DAILY_LIMIT?: string;
  LIVE_INTERVAL_SEC?: string;
  IDLE_INTERVAL_SEC?: string;
}

function config(env: Env): PollConfig {
  return {
    dailyLimit: Number(env.DAILY_LIMIT ?? 100),
    liveIntervalSec: Number(env.LIVE_INTERVAL_SEC ?? 60),
    idleIntervalSec: Number(env.IDLE_INTERVAL_SEC ?? 900),
  };
}

async function loadTeams(env: Env, leagues: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  await Promise.all(leagues.map(async (code) => {
    try {
      // GitHub Pages dosyaları saatte bir değişir; Cloudflare önbelleğinde 1 saat tut
      const res = await fetch(`${env.DATA_BASE_URL}/ratings/${code}.json`, { cf: { cacheTtl: 3600, cacheEverything: true } });
      if (res.ok) out[code] = Object.keys((await res.json<RatingsFile>()).attack);
    } catch { /* eşleşme olmadan devam: takım adları null kalır */ }
  }));
  return out;
}

async function poll(env: Env, now: Date) {
  const state = (await env.LIVE.get<PollState>('state', 'json')) ?? {};
  const decision = shouldPoll(state, now, config(env));
  if (!decision.poll) return { skipped: decision.reason };

  const day = now.toISOString().slice(0, 10);
  const used = (state.day === day ? state.used ?? 0 : 0) + 1;
  const next: PollState = { ...state, day, used, lastPoll: now.toISOString() };
  try {
    const res = await fetch(`${API}/fixtures?live=all`, { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } });
    const remainingHeader = res.headers.get('x-ratelimit-requests-remaining');
    if (remainingHeader !== null) next.apiRemaining = Number(remainingHeader);
    const body = await res.json<{ errors?: string[] | Record<string, string>; response?: ApiFixture[] }>();
    // API-Football hataları 200 koduyla "errors" alanında döndürür (limit, geçersiz anahtar...)
    const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors ?? {});
    if (!res.ok || errors.length) throw new Error(`API-Football: ${res.status} ${errors.join('; ')}`);

    const items = body.response ?? [];
    const matches = toLiveMatches(items, await loadTeams(env, liveLeagues(items)));
    Object.assign(next, { updatedAt: now.toISOString(), liveCount: matches.length, matches, lastError: null });
  } catch (err) {
    next.lastError = { at: now.toISOString(), message: (err as Error).message };
  }
  await env.LIVE.put('state', JSON.stringify(next));
  return { polled: true, used, liveCount: next.liveCount, error: next.lastError?.message };
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const json = (data: unknown, maxAge: number) => new Response(JSON.stringify(data), {
  headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
});

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(poll(env, new Date(controller.scheduledTime)).then((r) => console.log(JSON.stringify(r))));
  },

  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    if (url.pathname === '/live') {
      // Her istekte KV okumamak için 15 sn'lik kenar önbelleği (KV ücretsiz okuma limiti günde 100 bin)
      const cache = caches.default;
      const hit = await cache.match(request);
      if (hit) return hit;
      const state = (await env.LIVE.get<PollState>('state', 'json')) ?? {};
      const body: LiveFile = { updatedAt: state.updatedAt ?? null, matches: state.matches ?? [] };
      const res = json(body, 15);
      ctx.waitUntil(cache.put(request, res.clone()));
      return res;
    }

    if (url.pathname === '/health') {
      const s = (await env.LIVE.get<PollState>('state', 'json')) ?? {};
      const { dailyLimit } = config(env);
      return json({ updatedAt: s.updatedAt, lastPoll: s.lastPoll, liveCount: s.liveCount ?? 0,
        usedToday: s.used ?? 0, dailyLimit, apiRemaining: s.apiRemaining, lastError: s.lastError ?? null }, 0);
    }

    return json({ endpoints: ['/live', '/health'] }, 60);
  },
} satisfies ExportedHandler<Env>;
