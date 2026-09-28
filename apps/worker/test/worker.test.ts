import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { LiveFile } from '@oran/contracts';
import { shouldPoll, toLiveMatches, type ApiFixture } from '../src/live.ts';

// Gerçek ratings dosyalarından alınmış örnekler (pipeline çıktısı)
const ratings = (code: string) => readFileSync(new URL(`./fixtures/ratings-${code}.json`, import.meta.url), 'utf8');

// API-Football yanıt biçiminde örnek canlı maçlar
type Side = 'home' | 'away';
const fixture = (
  id: number, leagueId: number, home: string, away: string,
  status: { short: string; elapsed: number }, goals: { home: number; away: number },
  events: { type: string; detail: string; side: Side }[] = [],
): ApiFixture => ({
  fixture: { id, date: '2026-09-25T17:00:00+00:00', status },
  league: { id: leagueId },
  teams: { home: { id: id * 10 + 1, name: home }, away: { id: id * 10 + 2, name: away } },
  goals, events: events.map((e) => ({ ...e, team: { id: id * 10 + (e.side === 'home' ? 1 : 2) } })),
});
const LIVE = [
  fixture(1, 203, 'Fenerbahçe', 'İstanbul Başakşehir', { short: '2H', elapsed: 67 }, { home: 1, away: 1 },
    [{ type: 'Card', detail: 'Red Card', side: 'away' }, { type: 'Card', detail: 'Yellow Card', side: 'home' }]),
  fixture(2, 39, 'Manchester United', 'Nottingham Forest', { short: 'HT', elapsed: 45 }, { home: 0, away: 0 }),
  fixture(3, 203, 'Galatasaray', 'Gizemli FK', { short: '1H', elapsed: 12 }, { home: 0, away: 0 }),
  fixture(4, 999, 'Takip Edilmeyen', 'Lig', { short: '1H', elapsed: 5 }, { home: 0, away: 0 }),
];

test('shouldPoll: canlı maç varken 60 sn, yokken 15 dk, limit dolunca durur', () => {
  const cfg = { dailyLimit: 10000, liveIntervalSec: 60, idleIntervalSec: 900 };
  const now = new Date('2026-09-25T18:00:00Z');
  const ago = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
  assert.equal(shouldPoll({}, now, cfg).poll, true);
  assert.equal(shouldPoll({ day: '2026-09-25', used: 5, lastPoll: ago(30), liveCount: 3 }, now, cfg).poll, false);
  assert.equal(shouldPoll({ day: '2026-09-25', used: 5, lastPoll: ago(60), liveCount: 3 }, now, cfg).poll, true);
  assert.equal(shouldPoll({ day: '2026-09-25', used: 5, lastPoll: ago(300), liveCount: 0 }, now, cfg).poll, false);
  assert.equal(shouldPoll({ day: '2026-09-25', used: 10000, lastPoll: ago(3600) }, now, cfg).poll, false);
  assert.equal(shouldPoll({ day: '2026-09-24', used: 10000, lastPoll: ago(3600) }, now, cfg).poll, true); // yeni gün
});

test('shouldPoll: ücretsiz pakette 100 isteği güne yayar', () => {
  const cfg = { dailyLimit: 100, liveIntervalSec: 60, idleIntervalSec: 900 };
  const now = new Date('2026-09-25T12:00:00Z'); // günün yarısı kaldı, 50 hak kaldı → ~864 sn aralık
  const { interval } = shouldPoll({ day: '2026-09-25', used: 50, lastPoll: now.toISOString(), liveCount: 5 }, now, cfg);
  assert.ok(interval! > 800 && interval! < 900, String(interval));
});

test('toLiveMatches: lig filtreleme, dakika, kırmızı kart, takım eşleşmesi', () => {
  const m = toLiveMatches(LIVE, { T1: Object.keys(JSON.parse(ratings('T1')).attack) });
  assert.equal(m.length, 3);
  assert.deepEqual(
    { home: m[0].home, away: m[0].away, minute: m[0].minute, red: m[0].redCards },
    { home: 'Fenerbahce', away: 'Buyuksehyr', minute: 67, red: { home: 0, away: 1 } },
  );
  assert.equal(m[1].minute, 45);
  assert.equal(m[1].home, null); // E0 takım listesi verilmedi
  assert.equal(m[2].away, null); // bilinmeyen takım
});

// --- Uçtan uca: gerçek Workers çalışma ortamı (workerd), sahte API ---
let mf: Miniflare, apiCalls = 0, apiMode = 'ok';
before(async () => {
  mf = new Miniflare({ cache: false, workers: [{
    name: 'oran-canli',
    modules: true,
    scriptPath: 'dist/index.js',
    compatibilityDate: '2026-07-01',
    kvNamespaces: ['LIVE'],
    bindings: { API_FOOTBALL_KEY: 'test', DATA_BASE_URL: 'https://pages.test', DAILY_LIMIT: '10000', LIVE_INTERVAL_SEC: '60', IDLE_INTERVAL_SEC: '900' },
    outboundService: async (req: Request) => {
      const url = new URL(req.url);
      if (url.hostname === 'v3.football.api-sports.io') {
        apiCalls++;
        assert.equal(req.headers.get('x-apisports-key'), 'test');
        const body = apiMode === 'ok'
          ? { errors: [], response: LIVE }
          : { errors: { requests: 'You have reached the request limit for the day' }, response: [] };
        return new Response(JSON.stringify(body), { headers: { 'x-ratelimit-requests-remaining': '7000' } });
      }
      const m = url.pathname.match(/^\/ratings\/(\w+)\.json$/);
      if (url.hostname === 'pages.test' && m) return new Response(ratings(m[1]));
      return new Response('not found', { status: 404 });
    },
  }] });
});
after(() => mf?.dispose());

const t0 = Date.parse('2026-09-25T18:00:00Z');
// Miniflare'in Fetcher tipi scheduled()'ı içermiyor ama çalışma zamanında mevcut
type ScheduledFetcher = { scheduled(o: { cron: string; scheduledTime: Date }): Promise<unknown> };
const tick = async (sec: number) =>
  ((await mf.getWorker()) as unknown as ScheduledFetcher).scheduled({ cron: '* * * * *', scheduledTime: new Date(t0 + sec * 1000) });
const get = async <T,>(path: string) => (await (await mf.dispatchFetch(`http://worker${path}`)).json()) as T;
type Health = { apiRemaining: number; lastError: { message: string } };

test('uçtan uca: sorgula, eşleştir, yayınla, aralığa uy, hatada eski veriyi koru', async () => {
  await tick(0);
  assert.equal(apiCalls, 1);
  const live = await get<LiveFile>('/live');
  assert.equal(live.matches.length, 3);
  const fb = live.matches.find((x) => x.id === 1)!;
  assert.equal(fb.home, 'Fenerbahce');
  assert.equal(fb.away, 'Buyuksehyr');
  assert.deepEqual(fb.redCards, { home: 0, away: 1 });
  const mu = live.matches.find((x) => x.id === 2)!;
  assert.equal(mu.home, 'Man United');
  assert.equal(mu.away, "Nott'm Forest");

  await tick(30); // 60 sn dolmadı → API çağrılmaz
  assert.equal(apiCalls, 1);
  await tick(60);
  assert.equal(apiCalls, 2);

  apiMode = 'limit';
  await tick(120);
  assert.equal(apiCalls, 3);
  const health = await get<Health>('/health');
  assert.match(health.lastError.message, /request limit/);
  assert.equal(health.apiRemaining, 7000);
  assert.equal((await get<LiveFile>('/live')).matches.length, 3); // eski veri silinmedi
});
