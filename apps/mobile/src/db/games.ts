// Oyun jetonları ve turları. Jeton satılmaz, paraya çevrilmez; tutarlar birim cinsinden (1 jeton = TOKEN birim).
import { crashPoint, settleCrash, TOKEN, uniformFromBytes } from '@oran/games-math';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getRandomBytes, randomUUID } from 'expo-crypto';

import { db } from './client';
import { gameRounds, tokenEvents } from './schema';

export const START_TOKENS = 1_000 * TOKEN;
export const REFILL_TOKENS = 1_000 * TOKEN;
export const MIN_BET = 10 * TOKEN;
/** Bakiye en küçük bahsin altına düşünce ödüllü reklamla dolum açılır */
export const canRefill = (balance: number) => balance < MIN_BET;

export function tokenBalance(): number {
  const [row] = db.select({ total: sql<number>`coalesce(sum(${tokenEvents.amount}), 0)` }).from(tokenEvents).all();
  return START_TOKENS + Number(row?.total ?? 0);
}

/** Ödüllü reklamdan sonra (ya da reklam yokken) jeton yükler; bakiye zaten yeterliyse bir şey yapmaz */
export function refillTokens(now = new Date()): boolean {
  if (!canRefill(tokenBalance())) return false;
  db.insert(tokenEvents).values({ createdAt: now.toISOString(), kind: 'refill', amount: REFILL_TOKENS }).run();
  return true;
}

/** Yeni Crash turu: bahis düşülür, patlama noktası işletim sisteminin güvenli rastgele sayısıyla belirlenip kaydedilir */
export function startCrashRound(bet: number, target: number | null, now = new Date()): { id: string; outcome: number } {
  if (bet < MIN_BET || bet % TOKEN !== 0) throw new RangeError(`geçersiz bahis: ${bet}`);
  if (bet > tokenBalance()) throw new RangeError('yetersiz jeton');
  const id = randomUUID();
  const outcome = crashPoint(uniformFromBytes(getRandomBytes(7)));
  const createdAt = now.toISOString();
  db.transaction((tx) => {
    tx.insert(gameRounds).values({ id, game: 'crash', createdAt, bet, target, outcome, status: 'running' }).run();
    tx.insert(tokenEvents).values({ createdAt, kind: 'bet', amount: -bet, roundId: id }).run();
  });
  return { id, outcome };
}

/** Turu kapatır. cashout: oyuncunun çektiği çarpan; patlamaya yetişemediyse ya da çekmediyse kayıp. */
export function finishCrashRound(id: string, cashout: number | null, now = new Date()): { won: boolean; payout: number } | null {
  const [round] = db.select().from(gameRounds).where(eq(gameRounds.id, id)).all();
  if (!round || round.status !== 'running') return null;
  const { won, payout } = settleCrash(round.bet, round.outcome, cashout);
  const endedAt = now.toISOString();
  db.transaction((tx) => {
    tx.update(gameRounds).set({ endedAt, cashout: won ? cashout : null, payout, status: won ? 'won' : 'lost' })
      .where(eq(gameRounds.id, id)).run();
    if (payout > 0) tx.insert(tokenEvents).values({ createdAt: endedAt, kind: 'payout', amount: payout, roundId: id }).run();
  });
  return { won, payout };
}

/** Uygulama tur sırasında kapandıysa: otomatik hedef patlamadan önceyse o hedefte kazanır, yoksa kaybeder */
export function closeInterruptedRounds(): void {
  const running = db.select().from(gameRounds).where(eq(gameRounds.status, 'running')).all();
  for (const r of running) finishCrashRound(r.id, r.target !== null && r.target <= r.outcome ? r.target : null);
}

export interface GameReport {
  rounds: number;
  staked: number;
  returned: number;
  /** Gerçekleşen geri dönüş oranı (toplam ödeme / toplam bahis); hiç tur yoksa null */
  rtp: number | null;
}

/** Biten turların özeti; since verilirse o andan sonrası (gerçeklik uyarısı için) */
export function crashReport(since?: string): GameReport {
  const filters = [eq(gameRounds.game, 'crash'), sql`${gameRounds.status} != 'running'`];
  if (since) filters.push(gte(gameRounds.createdAt, since));
  const [row] = db.select({
    rounds: sql<number>`count(*)`,
    staked: sql<number>`coalesce(sum(${gameRounds.bet}), 0)`,
    returned: sql<number>`coalesce(sum(${gameRounds.payout}), 0)`,
  }).from(gameRounds).where(and(...filters)).all();
  const staked = Number(row?.staked ?? 0);
  const returned = Number(row?.returned ?? 0);
  return { rounds: Number(row?.rounds ?? 0), staked, returned, rtp: staked > 0 ? returned / staked : null };
}

/** Son turların patlama noktaları (yeniden eskiye) */
export function recentCrashes(limit = 10): number[] {
  return db.select({ outcome: gameRounds.outcome }).from(gameRounds)
    .where(and(eq(gameRounds.game, 'crash'), sql`${gameRounds.status} != 'running'`))
    .orderBy(desc(gameRounds.createdAt)).limit(limit).all().map((r) => r.outcome);
}
