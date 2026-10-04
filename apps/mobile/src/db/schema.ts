// Telefondaki veritabanı. Kullanıcının bahis geçmişi cihazdan çıkmaz.
// Para her yerde para biriminin en küçük birimi (kuruş, sent…) cinsinden tam sayıdır; birimi currency söyler.
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const coupons = sqliteTable('coupons', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  stake: integer('stake').notNull(),
  /** ISO 4217; bu sütundan önceki kayıtlar TL'ydi */
  currency: text('currency').notNull().default('TRY'),
  totalOdds: real('total_odds').notNull(),
  status: text('status', { enum: ['open', 'won', 'lost'] }).notNull().default('open'),
  payout: integer('payout'),
  settledAt: text('settled_at'),
}, (t) => [index('coupons_status_idx').on(t.status), index('coupons_created_idx').on(t.createdAt)]);

export const selections = sqliteTable('selections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  couponId: text('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  matchId: text('match_id').notNull(),
  league: text('league').notNull(),
  home: text('home').notNull(),
  away: text('away').notNull(),
  date: text('date').notNull(),
  kickoff: text('kickoff').notNull(),
  espnId: text('espn_id'),
  live: integer('live', { mode: 'boolean' }).notNull().default(false),
  marketKey: text('market_key').notNull(),
  outcomeKey: text('outcome_key').notNull(),
  odds: real('odds').notNull(),
  status: text('status', { enum: ['open', 'won', 'lost', 'void'] }).notNull().default('open'),
  finalHome: integer('final_home'),
  finalAway: integer('final_away'),
}, (t) => [index('selections_coupon_idx').on(t.couponId)]);

/** Kumbara hareketleri: kupon tutarı (yatırılmayan para), elle ekleme ve çekme */
export const savings = sqliteTable('savings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  kind: text('kind', { enum: ['stake', 'deposit', 'withdraw'] }).notNull(),
  couponId: text('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
});

/** Sunucudan gelen JSON'ların çevrimdışı kopyası */
export const cache = sqliteTable('cache', {
  key: text('key').primaryKey(),
  body: text('body').notNull(),
  fetchedAt: text('fetched_at').notNull(),
});

// ---------------------------------------------------------------------------
// Oyunlar (Faz 3). Jetonlar satılmaz ve paraya çevrilmez; tutarlar birim cinsinden (1 jeton = 100 birim).
// ---------------------------------------------------------------------------

/** Jeton hareketleri; bakiye = başlangıç jetonu + bunların toplamı */
export const tokenEvents = sqliteTable('token_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull(),
  /** refill: ödüllü reklamla dolum; bet: bahis (eksi); payout: ödeme */
  kind: text('kind', { enum: ['refill', 'bet', 'payout'] }).notNull(),
  amount: integer('amount').notNull(),
  roundId: text('round_id'),
}, (t) => [index('token_events_round_idx').on(t.roundId)]);

/** Oyun turları. Sonuç (outcome) tur başında belirlenir ve kaydedilir; uygulama kapansa da tur aynı sonuçla kapanır. */
export const gameRounds = sqliteTable('game_rounds', {
  id: text('id').primaryKey(),
  game: text('game', { enum: ['crash', 'roulette', 'slot', 'mines', 'plinko', 'blackjack'] }).notNull(),
  createdAt: text('created_at').notNull(),
  endedAt: text('ended_at'),
  bet: integer('bet').notNull(),
  /** Otomatik çekme hedefi (çarpan) */
  target: real('target'),
  /** Crash: patlama noktası; rulet: kazanan sayı; slot: penaltı hariç ödeme, bahsin katı; mines: mayın sayısı; plinko: cep; blackjack: krupiyenin son toplamı */
  outcome: real('outcome').notNull(),
  /** Rulet: bahisler, JSON [{ key, amount }] */
  bets: text('bets'),
  /** Turun çekilişi (JSON). Slot: { stops, freeStops, prizes, pick }; mines: { count, mines, revealed }; plinko: { rows, risk, path }; blackjack: { base, shoe, actions } */
  detail: text('detail'),
  /** Oyuncunun çektiği çarpan; çekmediyse null */
  cashout: real('cashout'),
  payout: integer('payout').notNull().default(0),
  status: text('status', { enum: ['running', 'won', 'lost'] }).notNull().default('running'),
}, (t) => [index('game_rounds_game_idx').on(t.game, t.createdAt)]);
