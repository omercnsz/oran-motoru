import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPETITIONS, CONTINENT_COUNTRIES, continentOf, defaultFavorites, homeCompetition } from '../src/index.ts';

test('kodlar ve ESPN adresleri tekil', () => {
  assert.equal(new Set(COMPETITIONS.map((c) => c.code)).size, COMPETITIONS.length);
  assert.equal(new Set(COMPETITIONS.map((c) => c.slug)).size, COMPETITIONS.length);
});

test('her ülke bir kıtada', () => {
  const known = new Set(Object.values(CONTINENT_COUNTRIES).flat());
  for (const c of COMPETITIONS.filter((x) => x.kind !== 'continental')) assert.ok(known.has(c.region), `${c.code}: ${c.region}`);
});

test('kıta kupaları uluslararası bölümünde', () => {
  assert.equal(continentOf(COMPETITIONS.find((c) => c.code === 'LIB')!), 'international');
  assert.equal(continentOf(COMPETITIONS.find((c) => c.code === 'KSA1')!), 'asia'); // SA burada Suudi Arabistan
});

test('cihazın ülkesinin ligi', () => {
  assert.equal(homeCompetition('TR')?.code, 'T1');
  assert.equal(homeCompetition('GB')?.code, 'E0');
  assert.equal(homeCompetition('SA')?.code, 'KSA1');
  assert.equal(homeCompetition('EG'), undefined);
  assert.equal(homeCompetition(null), undefined);
});

test('ilk favoriler', () => {
  assert.deepEqual(defaultFavorites('TR'), ['T1', 'UCL', 'E0', 'SP1', 'I1', 'D1', 'F1']);
  assert.deepEqual(defaultFavorites('BR'), ['BRA1', 'LIB', 'UCL', 'E0', 'SP1', 'I1', 'D1', 'F1']);
  assert.deepEqual(defaultFavorites('GB'), ['E0', 'UCL', 'SP1', 'I1', 'D1', 'F1']);
  assert.deepEqual(defaultFavorites(undefined), ['UCL', 'E0', 'SP1', 'I1', 'D1', 'F1']);
});
