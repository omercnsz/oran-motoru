// Kuponların veritabanına yazılması ve okunması. Kurallar @oran/betting paketinde.
import { indexResults, settleCoupon, totalOdds, type Coupon, type Selection } from '@oran/betting';
import type { ResultsFile } from '@oran/contracts';
import { and, desc, eq, inArray, sum } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { db } from './client';
import { coupons, savings, selections } from './schema';

type CouponRow = typeof coupons.$inferSelect;
type SelectionRow = typeof selections.$inferSelect;

export type StoredCoupon = Coupon & { totalOdds: number; currency: string };

export function toCoupon(row: CouponRow, rows: SelectionRow[]): StoredCoupon {
  return {
    id: row.id,
    createdAt: row.createdAt,
    stake: row.stake,
    currency: row.currency,
    totalOdds: row.totalOdds,
    status: row.status,
    payout: row.payout,
    selections: rows.map((s) => ({
      matchId: s.matchId, league: s.league, home: s.home, away: s.away, date: s.date, kickoff: s.kickoff,
      espnId: s.espnId ?? undefined, live: s.live,
      marketKey: s.marketKey, outcomeKey: s.outcomeKey, odds: s.odds, status: s.status,
      finalScore: s.finalHome !== null && s.finalAway !== null ? { home: s.finalHome, away: s.finalAway } : undefined,
    })),
  };
}

/** Kuponu kaydeder; tutar kumbaraya "yatırılmayan para" olarak eklenir. */
export function createCoupon(slip: Selection[], stake: number, currency: string, now = new Date()): string {
  const id = randomUUID();
  const createdAt = now.toISOString();
  db.transaction((tx) => {
    tx.insert(coupons).values({ id, createdAt, stake, currency, totalOdds: totalOdds(slip), status: 'open' }).run();
    tx.insert(selections).values(slip.map((s) => ({ ...s, couponId: id }))).run();
    tx.insert(savings).values({ createdAt, amount: stake, currency, kind: 'stake', couponId: id }).run();
  });
  return id;
}

/** Tüm kuponlar (yeniden eskiye), seçimleriyle birlikte */
export function loadCoupons(): StoredCoupon[] {
  const rows = db.select().from(coupons).orderBy(desc(coupons.createdAt)).all();
  if (rows.length === 0) return [];
  const sel = db.select().from(selections).where(inArray(selections.couponId, rows.map((r) => r.id)))
    .orderBy(selections.id).all();
  const byCoupon = new Map<string, SelectionRow[]>();
  for (const s of sel) byCoupon.set(s.couponId, [...(byCoupon.get(s.couponId) ?? []), s]);
  return rows.map((r) => toCoupon(r, byCoupon.get(r.id) ?? []));
}

/** Sonucu beklenen seçimler: hangi sonuç kaynaklarının sorgulanacağı */
export function openSelections() {
  return db.selectDistinct({
    league: selections.league, espnId: selections.espnId, date: selections.date,
    home: selections.home, away: selections.away, kickoff: selections.kickoff,
  }).from(selections).where(eq(selections.status, 'open')).all();
}

/** Açık kuponları sonuç dosyalarıyla sonuçlandırır; değişen kupon sayısını döner. */
export function settleOpenCoupons(files: ResultsFile[], now = new Date()): number {
  const results = indexResults(files);
  const open = db.select().from(coupons).where(eq(coupons.status, 'open')).all();
  let changed = 0;
  for (const row of open) {
    const selRows = db.select().from(selections).where(eq(selections.couponId, row.id)).orderBy(selections.id).all();
    const before = toCoupon(row, selRows);
    const after = settleCoupon(before, results, now);
    const selChanged = after.selections.some((s, i) => s.status !== before.selections[i].status);
    if (!selChanged && after.status === before.status) continue;
    changed++;
    db.transaction((tx) => {
      after.selections.forEach((s, i) => {
        if (s.status === before.selections[i].status) return;
        tx.update(selections).set({ status: s.status, finalHome: s.finalScore?.home ?? null, finalAway: s.finalScore?.away ?? null })
          .where(eq(selections.id, selRows[i].id)).run();
      });
      if (after.status !== 'open') {
        tx.update(coupons).set({ status: after.status, payout: after.payout, settledAt: now.toISOString() })
          .where(eq(coupons.id, row.id)).run();
      }
    });
  }
  return changed;
}

/** Kumbaradaki toplam (verilen para biriminde, en küçük birim) */
export function savingsTotal(currency: string): number {
  const [row] = db.select({ total: sum(savings.amount) }).from(savings).where(and(eq(savings.currency, currency))).all();
  return Number(row?.total ?? 0);
}
