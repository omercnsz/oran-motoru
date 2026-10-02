// Jeton bakiyesi, oyun raporu ve son turlar; veritabanı değişince kendiliğinden yenilenir.
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import { gameReport, recentOutcomes, tokenBalance, type GameReport } from '@/db/games';

interface GamesSnapshot {
  balance: number;
  crash: GameReport;
  roulette: GameReport;
  recent: { crash: number[]; roulette: number[] };
}

let version = 0;
let snapshot: { version: number; value: GamesSnapshot } | null = null;

function subscribe(onChange: () => void) {
  const sub = addDatabaseChangeListener(() => { version++; onChange(); });
  return () => sub.remove();
}

function read(): GamesSnapshot {
  if (snapshot?.version !== version) {
    snapshot = {
      version,
      value: {
        balance: tokenBalance(),
        crash: gameReport('crash'),
        roulette: gameReport('roulette'),
        recent: { crash: recentOutcomes('crash'), roulette: recentOutcomes('roulette', 12) },
      },
    };
  }
  return snapshot.value;
}

export const useGames = (): GamesSnapshot => useSyncExternalStore(subscribe, read, read);
