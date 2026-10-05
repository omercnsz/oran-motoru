// Sunucu verisi (GitHub Pages / geliştirmede yerel veri sunucusu).
// Her başarılı indirme SQLite'a da yazılır; internet yokken son kopya kullanılır.
import type { IndexFile, OddsFile, ResultsFile } from '@oran/contracts';
import { useQueries, useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { db } from '@/db/client';
import { cache } from '@/db/schema';

/** Yayında: EXPO_PUBLIC_DATA_BASE_URL (GitHub Pages). Geliştirmede: Metro'nun çalıştığı bilgisayardaki veri sunucusu (8090). */
function dataBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_DATA_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Platform.OS === 'web'
    ? globalThis.location?.hostname
    : Constants.expoConfig?.hostUri?.split(':')[0];
  if (!__DEV__ || !host) throw new Error('EXPO_PUBLIC_DATA_BASE_URL tanımlı değil');
  return `http://${host}:8090`;
}

export async function fetchJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${dataBaseUrl()}/${path}`);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    const text = await res.text();
    const body = JSON.parse(text) as T;
    db.insert(cache).values({ key: path, body: text, fetchedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: cache.key, set: { body: text, fetchedAt: new Date().toISOString() } }).run();
    return body;
  } catch (err) {
    const [row] = db.select().from(cache).where(eq(cache.key, path)).all();
    if (row) return JSON.parse(row.body) as T;
    throw err;
  }
}

export const useLeagueIndex = () =>
  useQuery({ queryKey: ['index'], queryFn: () => fetchJson<IndexFile>('index.json'), staleTime: 30 * 60_000 });

export const useOdds = (league: string | undefined) =>
  useQuery({
    queryKey: ['odds', league],
    queryFn: () => fetchJson<OddsFile>(`odds/${league}.json`),
    enabled: !!league,
    staleTime: 30 * 60_000,
  });

export const fetchResults = (leagues: string[]) =>
  Promise.all(leagues.map((l) => fetchJson<ResultsFile>(`results/${l}.json`)));

/** Birden fazla ligin maç öncesi oranları (öne çıkan maçlar için) */
export function useOddsMany(leagues: string[]) {
  return useQueries({
    queries: leagues.map((league) => ({
      queryKey: ['odds', league],
      queryFn: () => fetchJson<OddsFile>(`odds/${league}.json`),
      staleTime: 30 * 60_000,
    })),
  });
}
