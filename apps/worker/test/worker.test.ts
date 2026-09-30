import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { EspnEventsResponse } from '@oran/live-sources';
import { cacheTtl, parseEspnPath } from '../src/cache-policy.ts';

// Gerçek ESPN verisi (Süper Lig, 20 Eylül 2026), paylaşılan test dosyası
const ESPN_BODY = readFileSync(new URL('../../../packages/live-sources/test/fixtures/espn-tur1-20260920.json', import.meta.url), 'utf8');

test('yol doğrulama: sadece bizim liglerimiz ve geçerli tarihler', () => {
  assert.deepEqual(parseEspnPath('/espn/T1/20260920'), { league: 'T1', dates: '20260920' });
  assert.deepEqual(parseEspnPath('/espn/E0/202610'), { league: 'E0', dates: '202610' });
  assert.equal(parseEspnPath('/espn/XX/20260920'), null); // tanımsız lig
  assert.equal(parseEspnPath('/espn/T1/2026-09-20'), null);
  assert.equal(parseEspnPath('/espn/T1/20260920/../../x'), null);
  assert.equal(parseEspnPath('/espn/t1/20260920'), null);
});

test('önbellek süresi: canlı günler kısa, geçmiş uzun', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  assert.equal(cacheTtl('20260930', now), 20); // bugün
  assert.equal(cacheTtl('20260929', now), 20); // dün (ABD saatiyle hâlâ bugün olabilir)
  assert.equal(cacheTtl('20261001', now), 20); // yarın
  assert.equal(cacheTtl('20260920', now), 3600); // geçmiş
  assert.equal(cacheTtl('20261009', now), 300); // ileri tarih
  assert.equal(cacheTtl('202610', now), 600); // aylık
});

// --- Uçtan uca: gerçek Workers çalışma ortamı (workerd), sahte ESPN ---
let mf: Miniflare, espnCalls = 0, espnStatus = 200;
before(async () => {
  mf = new Miniflare({
    modules: true,
    scriptPath: 'dist/index.js',
    compatibilityDate: '2026-07-01',
    outboundService: async (req: Request) => {
      const url = new URL(req.url);
      assert.equal(url.hostname, 'site.api.espn.com');
      espnCalls++;
      return new Response(espnStatus === 200 ? ESPN_BODY : 'hata', { status: espnStatus });
    },
  });
});
after(() => mf?.dispose());

const get = (path: string) => mf.dispatchFetch(`http://worker${path}`);

test('uçtan uca: ESPN verisini işler, önbellekten sunar, hatayı önbelleğe almaz', async () => {
  const first = await get('/espn/T1/20260920');
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-cache'), 'MISS');
  assert.equal(first.headers.get('access-control-allow-origin'), '*');
  const body = (await first.json()) as EspnEventsResponse;
  assert.equal(body.events.length, 2);
  assert.deepEqual(body.events.find((e) => e.home === 'Amed SFK')?.redCards, { home: 1, away: 0 });
  assert.equal(espnCalls, 1);

  const second = await get('/espn/T1/20260920?x=cache-kirma-denemesi');
  assert.equal(second.headers.get('x-cache'), 'HIT');
  assert.equal(espnCalls, 1); // ESPN'e ikinci kez gidilmedi

  assert.equal((await get('/espn/XX/20260920')).status, 404);
  assert.equal(espnCalls, 1);

  espnStatus = 500;
  assert.equal((await get('/espn/E0/20260920')).status, 502);
  espnStatus = 200;
  assert.equal((await get('/espn/E0/20260920')).headers.get('x-cache'), 'MISS'); // hata önbelleğe alınmamış
  assert.equal(espnCalls, 3);
});
