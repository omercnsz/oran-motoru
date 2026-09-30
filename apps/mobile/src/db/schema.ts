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
