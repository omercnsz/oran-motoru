// Genel rapor: kuponlar, oyun turları ve jeton dolumları; veritabanı değişince kendiliğinden yenilenir.
import { buildReport, minorDigits, oneUnit, type Period, type Report, type ReportInput } from '@oran/betting';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useMemo, useSyncExternalStore } from 'react';

import { loadCoupons } from '@/db/coupons';
import { refillTimes, reportRounds } from '@/db/games';
import { useNow } from '@/hooks/use-now';
import { useLocalization } from '@/i18n';
import { useReportSettings, type TokenValue } from '@/state/report';

type Rows = Omit<ReportInput, 'currency' | 'tokenValue'>;

let version = 0;
let snapshot: { version: number; rows: Rows } | null = null;

function subscribe(onChange: () => void) {
  const sub = addDatabaseChangeListener(() => { version++; onChange(); });
  return () => sub.remove();
}

function read(): Rows {
  if (snapshot?.version !== version) {
    snapshot = { version, rows: { coupons: loadCoupons(), rounds: reportRounds(), refills: refillTimes() } };
  }
  return snapshot.rows;
}

/** Jeton değeri en küçük para biriminde (0,10 ₺ = 10). Kuruşu olmayan para biriminde 0,10 seçilemez: 1'e yuvarlanır. */
export function tokenValueMinor(value: TokenValue, currency: string): number {
  if (value < 1 && minorDigits(currency) === 0) return oneUnit(currency);
  return Math.round(value * oneUnit(currency));
}

export function useReport(period: Period): Report {
  const rows = useSyncExternalStore(subscribe, read, read);
  const currency = useLocalization((l) => l.currency);
  const tokenValue = useReportSettings((s) => s.tokenValue);
  const now = useNow();
  return useMemo(
    () => buildReport({ ...rows, currency, tokenValue: tokenValueMinor(tokenValue, currency) }, period, new Date(now)),
    [rows, currency, tokenValue, period, now],
  );
}
