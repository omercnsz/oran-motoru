// Oyun jetonları ve turları. Jeton satılmaz, paraya çevrilmez; tutarlar birim cinsinden (1 jeton = TOKEN birim).
import {
  bjAct, bjActions, bjExtraBet, bjPayout, bjStaked, dealBlackjack, drawShoe, handTotal, replayBlackjack,
  coverage, crashPoint, drawSlotRound, MINES, minesPayout, placeMines, plinkoPath, plinkoPayout, plinkoSlot, resolveSlotRound,
  roundMultiple, roundPayout, settleCrash, settleRoulette, spinOutcome, TOKEN, uniformFromBytes,
  type BjAction, type BjState, type Card, type PlinkoRisk, type PlinkoRows, type RouletteBet, type SlotDraw,
} from '@oran/games-math';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getRandomBytes, randomUUID } from 'expo-crypto';

import { db } from './client';
import { gameRounds, tokenEvents } from './schema';

export type Game = 'crash' | 'roulette' | 'slot' | 'mines' | 'plinko' | 'blackjack';

/** İşletim sisteminin güvenli rastgele sayı üreteci, [0, 1) */
const secureRandom = () => uniformFromBytes(getRandomBytes(7));

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
  const outcome = crashPoint(secureRandom());
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

/** Yeni rulet dönüşü: bahisler düşülür, kazanan sayı güvenli rastgele sayıyla belirlenip bahislerle birlikte kaydedilir */
export function startRouletteRound(bets: RouletteBet[], now = new Date()): { id: string; outcome: number } {
  if (bets.length === 0) throw new RangeError('bahis yok');
  for (const b of bets) {
    coverage(b.key); // geçersiz anahtarda hata
    if (!Number.isInteger(b.amount) || b.amount <= 0 || b.amount % TOKEN !== 0) throw new RangeError(`geçersiz tutar: ${b.amount}`);
  }
  const total = bets.reduce((s, b) => s + b.amount, 0);
  if (total > tokenBalance()) throw new RangeError('yetersiz jeton');
  const id = randomUUID();
  const outcome = spinOutcome(secureRandom());
  const createdAt = now.toISOString();
  db.transaction((tx) => {
    tx.insert(gameRounds).values({ id, game: 'roulette', createdAt, bet: total, outcome, bets: JSON.stringify(bets), status: 'running' }).run();
    tx.insert(tokenEvents).values({ createdAt, kind: 'bet', amount: -total, roundId: id }).run();
  });
  return { id, outcome };
}

/** Dönüşü kapatır (çark durunca ya da uygulama dönüş sırasında kapandıysa): sonuç baştan belli olduğu için aynıdır */
export function finishRouletteRound(id: string, now = new Date()): ReturnType<typeof settleRoulette> | null {
  const [round] = db.select().from(gameRounds).where(eq(gameRounds.id, id)).all();
  if (!round || round.status !== 'running') return null;
  const result = settleRoulette(JSON.parse(round.bets ?? '[]') as RouletteBet[], round.outcome);
  const endedAt = now.toISOString();
  db.transaction((tx) => {
    // Kazandı = toplamda kâr; bir bahis tutsa da toplamda kayıpsa kayıp sayılır
    tx.update(gameRounds).set({ endedAt, payout: result.returned, status: result.net > 0 ? 'won' : 'lost' })
      .where(eq(gameRounds.id, id)).run();
    if (result.returned > 0) tx.insert(tokenEvents).values({ createdAt: endedAt, kind: 'payout', amount: result.returned, roundId: id }).run();
  });
  return result;
}

/**
 * Yeni slot turu: bahis düşülür; ana dönüş, varsa 10 bedava dönüş ve penaltı köşelerindeki ödüller tur başında
 * güvenli rastgele sayılarla çekilip kaydedilir. Ekran sadece bunu gösterir.
 */
export function startSlotRound(bet: number, now = new Date()): { id: string; draw: SlotDraw } {
  if (bet < MIN_BET || bet % TOKEN !== 0) throw new RangeError(`geçersiz bahis: ${bet}`);
  if (bet > tokenBalance()) throw new RangeError('yetersiz jeton');
  const id = randomUUID();
  const draw = drawSlotRound(secureRandom);
  const createdAt = now.toISOString();
  db.transaction((tx) => {
    tx.insert(gameRounds).values({
      id, game: 'slot', createdAt, bet, outcome: roundMultiple(resolveSlotRound(draw), null) - (draw.prizes ? draw.prizes[1] : 0),
      detail: JSON.stringify(draw), status: 'running',
    }).run();
    tx.insert(tokenEvents).values({ createdAt, kind: 'bet', amount: -bet, roundId: id }).run();
  });
  return { id, draw };
}

/** Slot turunu kapatır; pick: penaltıda seçilen köşe (0 sol, 1 orta, 2 sağ). Seçim yapılmadıysa orta köşe. */
export function finishSlotRound(id: string, pick: number | null, now = new Date()): { payout: number } | null {
  const [round] = db.select().from(gameRounds).where(eq(gameRounds.id, id)).all();
  if (!round || round.status !== 'running') return null;
  const draw = JSON.parse(round.detail ?? '{}') as SlotDraw;
  const payout = roundPayout(resolveSlotRound(draw), pick, round.bet);
  const endedAt = now.toISOString();
  db.transaction((tx) => {
    tx.update(gameRounds).set({
      endedAt, payout, status: payout > round.bet ? 'won' : 'lost', detail: JSON.stringify({ ...draw, pick }),
    }).where(eq(gameRounds.id, id)).run();
    if (payout > 0) tx.insert(tokenEvents).values({ createdAt: endedAt, kind: 'payout', amount: payout, roundId: id }).run();
  });
  return { payout };
}

function checkBet(bet: number) {
  if (bet < MIN_BET || bet % TOKEN !== 0) throw new RangeError(`geçersiz bahis: ${bet}`);
  if (bet > tokenBalance()) throw new RangeError('yetersiz jeton');
}

/** Turu ödemeyle kapatır (kazandı = ödeme bahisten fazla) */
function closeRound(id: string, bet: number, payout: number, detail: unknown, now: Date, outcome?: number) {
  const endedAt = now.toISOString();
  db.transaction((tx) => {
    tx.update(gameRounds).set({ endedAt, payout, status: payout > bet ? 'won' : 'lost', detail: JSON.stringify(detail), ...(outcome === undefined ? {} : { outcome }) })
      .where(eq(gameRounds.id, id)).run();
    if (payout > 0) tx.insert(tokenEvents).values({ createdAt: endedAt, kind: 'payout', amount: payout, roundId: id }).run();
  });
}

export interface MinesState { count: number; mines: number[]; revealed: number[] }

/** Yeni Mines turu: mayınların yeri güvenli rastgele sayıyla çekilip kaydedilir */
export function startMinesRound(bet: number, count: number, now = new Date()): { id: string } {
  checkBet(bet);
  if (count < MINES.minMines || count > MINES.maxMines) throw new RangeError(`geçersiz mayın sayısı: ${count}`);
  const id = randomUUID();
  const state: MinesState = { count, mines: placeMines(count, secureRandom), revealed: [] };
  const createdAt = now.toISOString();
  db.transaction((tx) => {
    tx.insert(gameRounds).values({ id, game: 'mines', createdAt, bet, outcome: count, detail: JSON.stringify(state), status: 'running' }).run();
    tx.insert(tokenEvents).values({ createdAt, kind: 'bet', amount: -bet, roundId: id }).run();
  });
  return { id };
}

function minesRound(id: string) {
  const [round] = db.select().from(gameRounds).where(eq(gameRounds.id, id)).all();
  if (!round || round.status !== 'running' || round.game !== 'mines') return null;
  return { round, state: JSON.parse(round.detail ?? '{}') as MinesState };
}

/**
 * Kare açar. Mayınsa tur kaybedilir; bütün güvenli kareler açıldıysa tur kendiliğinden çekilir.
 * Dönüş: mine, açılan güvenli kare sayısı ve tur bittiyse mayınların yeri ile ödeme.
 */
export function revealMinesTile(id: string, tile: number, now = new Date()):
  { mine: boolean; safe: number; finished: { mines: number[]; payout: number } | null } | null {
  const r = minesRound(id);
  if (!r || tile < 0 || tile >= MINES.tiles || r.state.revealed.includes(tile)) return null;
  const state = { ...r.state, revealed: [...r.state.revealed, tile] };
  if (state.mines.includes(tile)) {
    closeRound(id, r.round.bet, 0, state, now);
    return { mine: true, safe: state.revealed.length - 1, finished: { mines: state.mines, payout: 0 } };
  }
  const safe = state.revealed.length;
  if (safe === MINES.tiles - state.count) {
    const payout = minesPayout(r.round.bet, state.count, safe);
    closeRound(id, r.round.bet, payout, state, now);
    return { mine: false, safe, finished: { mines: state.mines, payout } };
  }
  db.update(gameRounds).set({ detail: JSON.stringify(state) }).where(eq(gameRounds.id, id)).run();
  return { mine: false, safe, finished: null };
}

/** Çeker: açılan güvenli kare sayısına göre öder. Hiç kare açılmadıysa bahis iade edilir (oynanmamış sayılır). */
export function cashOutMines(id: string, now = new Date()): { mines: number[]; payout: number } | null {
  const r = minesRound(id);
  if (!r) return null;
  const safe = r.state.revealed.length;
  const payout = safe === 0 ? r.round.bet : minesPayout(r.round.bet, r.state.count, safe);
  closeRound(id, r.round.bet, payout, r.state, now);
  return { mines: r.state.mines, payout };
}

export interface PlinkoState { rows: PlinkoRows; risk: PlinkoRisk; path: boolean[] }

/** Yeni Plinko atışı: topun yolu güvenli rastgele sayılarla çekilip kaydedilir; ekran bu yolu gösterir */
export function startPlinkoRound(bet: number, rows: PlinkoRows, risk: PlinkoRisk, now = new Date()): { id: string; path: boolean[]; slot: number } {
  checkBet(bet);
  const id = randomUUID();
  const path = plinkoPath(rows, secureRandom);
  const slot = plinkoSlot(path);
  const createdAt = now.toISOString();
  db.transaction((tx) => {
    tx.insert(gameRounds).values({
      id, game: 'plinko', createdAt, bet, outcome: slot, detail: JSON.stringify({ rows, risk, path } satisfies PlinkoState), status: 'running',
    }).run();
    tx.insert(tokenEvents).values({ createdAt, kind: 'bet', amount: -bet, roundId: id }).run();
  });
  return { id, path, slot };
}

/** Top cebe düşünce: kayıtlı sonuçla öder */
export function finishPlinkoRound(id: string, now = new Date()): { payout: number } | null {
  const [round] = db.select().from(gameRounds).where(eq(gameRounds.id, id)).all();
  if (!round || round.status !== 'running' || round.game !== 'plinko') return null;
  const state = JSON.parse(round.detail ?? '{}') as PlinkoState;
  const payout = plinkoPayout(round.bet, state.rows, state.risk, plinkoSlot(state.path));
  closeRound(id, round.bet, payout, state, now);
  return { payout };
}

export interface BlackjackRecord { base: number; shoe: Card[]; actions: BjAction[] }

/** El bitince: ödeme, krupiyenin son toplamı sonuç olarak */
function settleBlackjack(id: string, state: BjState, record: BlackjackRecord, now: Date): number {
  const payout = bjPayout(state);
  closeRound(id, bjStaked(state), payout, record, now, handTotal(state.dealer).total);
  return payout;
}

/** Yeni blackjack eli: 6 deste güvenli rastgele sayıyla karılır, kullanılabilecek ilk kartlar kaydedilir. Blackjack varsa el hemen biter. */
export function startBlackjackRound(bet: number, now = new Date()): { id: string; state: BjState; payout: number | null } {
  checkBet(bet);
  const id = randomUUID();
  const record: BlackjackRecord = { base: bet, shoe: drawShoe(secureRandom), actions: [] };
  const state = dealBlackjack(record.shoe, bet);
  const createdAt = now.toISOString();
  db.transaction((tx) => {
    tx.insert(gameRounds).values({ id, game: 'blackjack', createdAt, bet, outcome: 0, detail: JSON.stringify(record), status: 'running' }).run();
    tx.insert(tokenEvents).values({ createdAt, kind: 'bet', amount: -bet, roundId: id }).run();
  });
  return { id, state, payout: state.done ? settleBlackjack(id, state, record, now) : null };
}

function blackjackRound(id: string) {
  const [round] = db.select().from(gameRounds).where(eq(gameRounds.id, id)).all();
  if (!round || round.status !== 'running' || round.game !== 'blackjack') return null;
  const record = JSON.parse(round.detail ?? '{}') as BlackjackRecord;
  return { round, record, state: replayBlackjack(record.shoe, record.base, record.actions) };
}

/**
 * Hamle. İkiye katlama ve bölme oynanan elin bahsi kadar ek bahis ister (jeton yetmezse null).
 * Bütün eller bitince krupiye oynar ve el ödenir. Hamleler kaydedilir: el desteden yeniden oynatılabilir.
 */
export function blackjackAction(id: string, action: BjAction, now = new Date()): { state: BjState; payout: number | null } | null {
  const r = blackjackRound(id);
  if (!r || !bjActions(r.state).includes(action)) return null;
  const extra = bjExtraBet(r.state, action);
  if (extra > tokenBalance()) return null;
  const state = bjAct(r.state, action);
  const record = { ...r.record, actions: [...r.record.actions, action] };
  const createdAt = now.toISOString();
  db.transaction((tx) => {
    tx.update(gameRounds).set({ bet: r.round.bet + extra, detail: JSON.stringify(record) }).where(eq(gameRounds.id, id)).run();
    if (extra > 0) tx.insert(tokenEvents).values({ createdAt, kind: 'bet', amount: -extra, roundId: id }).run();
  });
  return { state, payout: state.done ? settleBlackjack(id, state, record, now) : null };
}

/** Yarıda kalan el: kalan eller "dur" ile oynanır */
function standOutBlackjack(id: string, now = new Date()) {
  const r = blackjackRound(id);
  if (!r) return;
  let state = r.state;
  const actions = [...r.record.actions];
  while (!state.done) {
    state = bjAct(state, 'stand');
    actions.push('stand');
  }
  settleBlackjack(id, state, { ...r.record, actions }, now);
}

/** Uygulama tur sırasında kapandıysa turlar kurala göre kapanır.
 * Crash: otomatik hedef patlamadan önceyse o hedefte kazanır, yoksa kaybeder. Rulet ve slot: kayıtlı sonuçla
 * (slotta penaltı seçilmediyse orta köşe; ödüller köşelere rastgele dağıtıldığı için bu oyuncuyu kayırmaz ya da cezalandırmaz).
 * Mines: açılan karelere göre çekilmiş sayılır (hiç açılmadıysa bahis iade). Plinko: kayıtlı yolla. Blackjack: kalan eller durur. */
export function closeInterruptedRounds(): void {
  const running = db.select().from(gameRounds).where(eq(gameRounds.status, 'running')).all();
  for (const r of running) {
    if (r.game === 'roulette') finishRouletteRound(r.id);
    else if (r.game === 'slot') finishSlotRound(r.id, null);
    else if (r.game === 'mines') cashOutMines(r.id);
    else if (r.game === 'plinko') finishPlinkoRound(r.id);
    else if (r.game === 'blackjack') standOutBlackjack(r.id);
    else finishCrashRound(r.id, r.target !== null && r.target <= r.outcome ? r.target : null);
  }
}

export interface GameReport {
  rounds: number;
  staked: number;
  returned: number;
  /** Gerçekleşen geri dönüş oranı (toplam ödeme / toplam bahis); hiç tur yoksa null */
  rtp: number | null;
}

/** Biten turların özeti; since verilirse o andan sonrası (gerçeklik uyarısı için) */
export function gameReport(game: Game, since?: string): GameReport {
  const filters = [eq(gameRounds.game, game), sql`${gameRounds.status} != 'running'`];
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

/** Son turların sonuçları (Crash: patlama noktası, rulet: sayı), yeniden eskiye */
export function recentOutcomes(game: Game, limit = 10): number[] {
  return db.select({ outcome: gameRounds.outcome }).from(gameRounds)
    .where(and(eq(gameRounds.game, game), sql`${gameRounds.status} != 'running'`))
    .orderBy(desc(gameRounds.createdAt)).limit(limit).all().map((r) => r.outcome);
}

/** Son turlarda bahsin kaç katı geri döndü (Plinko geçmişi: sıra ve risk değişebildiği için cep değil çarpan) */
export function recentReturns(game: Game, limit = 10): number[] {
  return db.select({ bet: gameRounds.bet, payout: gameRounds.payout }).from(gameRounds)
    .where(and(eq(gameRounds.game, game), sql`${gameRounds.status} != 'running'`))
    .orderBy(desc(gameRounds.createdAt)).limit(limit).all().map((r) => r.payout / r.bet);
}

/** Rapor için bütün turlar (biten ve süren) */
export const reportRounds = () =>
  db.select({
    game: gameRounds.game, createdAt: gameRounds.createdAt, endedAt: gameRounds.endedAt,
    bet: gameRounds.bet, payout: gameRounds.payout, status: gameRounds.status,
  }).from(gameRounds).all();

/** Ödüllü reklamla jeton dolumlarının zamanları (jeton kaç kez bitti) */
export const refillTimes = () =>
  db.select({ createdAt: tokenEvents.createdAt }).from(tokenEvents).where(eq(tokenEvents.kind, 'refill')).all().map((r) => r.createdAt);
