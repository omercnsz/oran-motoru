import type { ResultsFile, ScheduledMatch } from '@oran/contracts';
import { espnDateOf, finalsToResults } from '@oran/live-sources';
import { useFocusEffect } from 'expo-router';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useCallback, useSyncExternalStore } from 'react';

import { fetchResults } from '@/data/api';
import { fetchEspnEvents } from '@/data/live';
import { loadCoupons, openSelections, savingsTotal, settleOpenCoupons, type StoredCoupon } from '@/db/coupons';
import { useLocalization } from '@/i18n';
import { syncReminders } from '@/notifications';

// Veritabanı bir dış veri kaynağı gibi dinlenir: her değişiklikte sürüm artar, anlık görüntü yeniden okunur.
let dbVersion = 0;
let snapshot: { key: string; value: { coupons: StoredCoupon[]; savings: number } } | null = null;

function subscribe(onChange: () => void) {
  const sub = addDatabaseChangeListener(() => { dbVersion++; onChange(); });
  return () => sub.remove();
}

function read(currency: string) {
  const key = `${dbVersion}|${currency}`;
  if (snapshot?.key !== key) snapshot = { key, value: { coupons: loadCoupons(), savings: savingsTotal(currency) } };
  return snapshot.value;
}

/** Kuponlar ve kumbara toplamı (seçili para biriminde); veritabanı değişince kendiliğinden yenilenir. */
export function useCoupons(): { coupons: StoredCoupon[]; savings: number } {
  const currency = useLocalization((l) => l.currency);
  const get = useCallback(() => read(currency), [currency]);
  return useSyncExternalStore(subscribe, get, get);
}

const MATCH_LENGTH_MS = 105 * 60_000; // 90 dk + devre arası

/**
 * Açık kuponları sonuçlandırır. İki kaynak birlikte kullanılır:
 * ESPN (maç biter bitmez) ve football-data.co.uk sonuç dosyaları (birkaç gün gecikmeli ama kesin).
 */
export async function settleNow(now = Date.now()): Promise<number> {
  const open = openSelections();
  if (open.length === 0) return 0;
  const files: ResultsFile[] = [];

  const finished = open.filter((s) => s.espnId && Date.parse(s.kickoff) + MATCH_LENGTH_MS < now);
  if (finished.length > 0) {
    const pairs = new Map(finished.map((s) => {
      const espnDate = espnDateOf(s.kickoff);
      return [`${s.league}|${espnDate}`, { league: s.league, espnDate }];
    }));
    const byEspnId = new Map<string, ScheduledMatch>(finished.map((s) => [s.espnId!, {
      league: s.league, id: '', espnId: s.espnId!, home: s.home, away: s.away, date: s.date, kickoff: s.kickoff,
    }]));
    try {
      files.push(finalsToResults((await fetchEspnEvents([...pairs.values()])).events, byEspnId));
    } catch (err) {
      console.warn('ESPN sonuçları alınamadı:', (err as Error).message);
    }
  }
  try {
    files.push(...await fetchResults([...new Set(open.map((s) => s.league))]));
  } catch (err) {
    console.warn('Sonuç dosyaları alınamadı:', (err as Error).message);
  }
  const changed = files.length ? settleOpenCoupons(files, new Date(now)) : 0;
  // Kaybeden kuponun maçları için hatırlatma kalmasın
  if (changed > 0) void syncReminders();
  return changed;
}

/** Ekran her açıldığında açık kuponları sonuçlandırır. */
export function useSettlement() {
  useFocusEffect(useCallback(() => { void settleNow(); }, []));
}
