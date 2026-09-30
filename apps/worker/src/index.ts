// Cloudflare Worker: ESPN skor tablosunun önünde kenar önbelleği.
// Telefonlar ESPN'e değil buraya sorar; her Cloudflare noktası aynı soruyu ESPN'e en fazla
// önbellek süresinde bir kez iletir. Yanıt, uygulamanın kullandığı biçimde işlenmiş olarak döner.
import { parseScoreboard, scoreboardUrl, type EspnEventsResponse, type EspnScoreboard } from '@oran/live-sources';

import { cacheTtl, parseEspnPath } from './cache-policy.ts';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };

const json = (data: unknown, status: number, maxAge: number) => new Response(JSON.stringify(data), {
  status,
  headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
});

async function espn(request: Request, ctx: ExecutionContext, league: string, dates: string): Promise<Response> {
  // Sorgu parametreleri önbellek anahtarına girmez (önbelleği boşa harcatmasınlar)
  const cacheKey = new Request(new URL(request.url).origin + new URL(request.url).pathname);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set('x-cache', 'HIT');
    return res;
  }

  const upstream = await fetch(scoreboardUrl(league, dates), {
    // Kim olduğumuzu açıkça belirtiyoruz (Workers varsayılan olarak User-Agent göndermez)
    headers: { accept: 'application/json', 'user-agent': 'oran-canli/1.0 (+https://github.com/omercnsz/oran-motoru)' },
  });
  if (!upstream.ok) return json({ error: `ESPN HTTP ${upstream.status}` }, 502, 0); // hata önbelleğe alınmaz

  const now = new Date();
  const body: EspnEventsResponse = {
    league, dates, fetchedAt: now.toISOString(),
    events: parseScoreboard((await upstream.json()) as EspnScoreboard),
  };
  const res = json(body, 200, cacheTtl(dates, now));
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  res.headers.set('x-cache', 'MISS');
  return res;
}

export default {
  async fetch(request, _env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return json({ error: 'Sadece GET' }, 405, 0);
    const url = new URL(request.url);

    const route = parseEspnPath(url.pathname);
    if (route) {
      try {
        return await espn(request, ctx, route.league, route.dates);
      } catch (err) {
        return json({ error: (err as Error).message }, 502, 0);
      }
    }
    if (url.pathname === '/') return json({ endpoints: ['/espn/<lig>/<YYYYMMDD | YYYYMM>'] }, 200, 3600);
    return json({ error: 'Bulunamadı' }, 404, 60);
  },
} satisfies ExportedHandler;
