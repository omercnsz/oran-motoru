// Jeton bakiyesi, oyun raporu ve son turlar; veritabanı değişince kendiliğinden yenilenir.
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import { crashReport, recentCrashes, tokenBalance, type GameReport } from '@/db/games';

interface GamesSnapshot { balance: number; crash: GameReport; recent: number[] }

let version = 0;
let snapshot: { version: number; value: GamesSnapshot } | null = null;

function subscribe(onChange: () => void) {
  const sub = addDatabaseChangeListener(() => { version++; onChange(); });
  return () => sub.remove();
}

function read(): GamesSnapshot {
  if (snapshot?.version !== version) {
    snapshot = { version, value: { balance: tokenBalance(), crash: crashReport(), recent: recentCrashes() } };
  }
  return snapshot.value;
}

export const useGames = (): GamesSnapshot => useSyncExternalStore(subscribe, read, read);
