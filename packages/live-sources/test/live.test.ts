import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ScheduledMatch } from '@oran/contracts';
import { espnDateOf, finalsToResults, parseScoreboard, preMatchProblem, type EspnScoreboard } from '../src/index.ts';

// Gerçek ESPN verisi (Süper Lig, 20 Eylül 2026), kullanılan alanlara indirgenmiş
const real = JSON.parse(readFileSync(new URL('./fixtures/espn-tur1-20260920.json', import.meta.url), 'utf8')) as EspnScoreboard;

test('biten maçlar: skor, kırmızı kart, durum', () => {
  const [fb, amed] = parseScoreboard(real);
  assert.deepEqual({ home: fb.home, away: fb.away, score: fb.score, state: fb.state, fullTime: fb.fullTime, clock: fb.clock },
    { home: 'Fenerbahce', away: 'Eyupspor', score: { home: 8, away: 0 }, state: 'post', fullTime: true, clock: 'MS' });
  assert.ok(fb.homeId && fb.awayId && fb.homeId !== fb.awayId);
  assert.equal(parseScoreboard(real)[1].homeId, '132335'); // Amed SFK'nın ESPN kimliği
  assert.equal(amed.home, 'Amed SFK');
  assert.deepEqual(amed.score, { home: 3, away: 2 });
  assert.deepEqual(amed.redCards, { home: 1, away: 0 }); // 84' Amed (ev sahibi)
});

test('oynanan maç: dakika, devre arası, ertelenen', () => {
  const live = structuredClone(real);
  const e = live.events![0];
  e.status = { clock: 4020, displayClock: "67'", period: 2, type: { name: 'STATUS_SECOND_HALF', state: 'in', completed: false } };
  assert.deepEqual((({ minute, clock, fullTime, state }) => ({ minute, clock, fullTime, state }))(parseScoreboard(live)[0]),
    { minute: 67, clock: "67'", fullTime: false, state: 'in' });
  e.status = { clock: 2700, displayClock: "45'+2'", period: 1, type: { name: 'STATUS_HALFTIME', state: 'in', completed: false } };
  assert.equal(parseScoreboard(live)[0].minute, 45);
  assert.equal(parseScoreboard(live)[0].clock, 'İY');
  e.status = { clock: 0, displayClock: "0'", period: 0, type: { name: 'STATUS_POSTPONED', state: 'post', completed: false } };
  assert.equal(parseScoreboard(live)[0].fullTime, false);
});

test('biten maçlardan sonuç dosyası: adlar bizim veri setimizden', () => {
  const events = parseScoreboard(real);
  const schedule = new Map<string, ScheduledMatch>([[events[1].espnId, {
    league: 'T1', id: 'x', espnId: events[1].espnId, home: 'Amedspor', away: 'Besiktas', date: '2026-09-20', kickoff: events[1].kickoff,
  }]]);
  const r = finalsToResults(events, schedule);
  assert.deepEqual(r.results, [{ date: '2026-09-20', home: 'Amedspor', away: 'Besiktas', score: { home: 3, away: 2 } }]);
});

test('ESPN gün anahtarı ABD Doğu saatine göre', () => {
  assert.equal(espnDateOf('2026-10-09T17:00:00Z'), '20261009');
  assert.equal(espnDateOf('2026-10-10T02:00:00Z'), '20261009'); // New York'ta hâlâ 9 Ekim akşamı
});

test('bahis öncesi kontrol: başlamış, ertelenmiş ve öne alınmış maçlar reddedilir', () => {
  const [fb] = parseScoreboard(real);
  const now = new Date('2026-09-20T12:00:00Z');
  const sel = { espnId: fb.espnId, home: 'Fenerbahce', away: 'Eyupspor' };
  const at = (over: Partial<typeof fb>) => [{ ...fb, ...over }];
  assert.equal(preMatchProblem([sel], at({ state: 'pre', kickoff: '2026-09-20T14:00:00.000Z' }), now), null);
  assert.match(preMatchProblem([sel], at({ state: 'in' }), now)!, /başladı/);
  assert.match(preMatchProblem([sel], at({ state: 'post', fullTime: false, status: 'STATUS_POSTPONED' }), now)!, /ertelendi/);
  // Fikstürde 14:00 yazıyor ama ESPN'e göre 11:30'a alınmış: henüz "pre" görünse de saat geçti
  assert.match(preMatchProblem([sel], at({ state: 'pre', kickoff: '2026-09-20T11:30:00.000Z' }), now)!, /başladı/);
  // Canlı bahis ve ESPN'de bulunamayan maç bu kontrole takılmaz
  assert.equal(preMatchProblem([{ ...sel, live: true }], at({ state: 'in' }), now), null);
  assert.equal(preMatchProblem([{ ...sel, espnId: 'yok' }], at({ state: 'in' }), now), null);
});
