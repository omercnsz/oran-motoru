import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  basicStrategy, BLACKJACK, bjActions, bjAct, bjHandOutcome, bjPayout, bjStaked, cardValue, dealBlackjack, drawShoe,
  handTotal, replayBlackjack, seededRandom, simulateBlackjack, TOKEN, type BjAction, type Card,
} from '../src/index.ts';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const c = (rank: string, suit = 0): Card => suit * 13 + RANKS.indexOf(rank);
/** Deste: oyuncu, krupiye, oyuncu, krupiye, sonra sıradaki kartlar; kalanı 2'lerle dolar */
const shoe = (...ranks: string[]) => [...ranks.map((r) => c(r)), ...new Array(BLACKJACK.shoeCards - ranks.length).fill(c('2'))];
const BET = 10 * TOKEN;

test('el toplamı: aslar 11 ya da 1', () => {
  assert.deepEqual(handTotal([c('A'), c('6')]), { total: 17, soft: true });
  assert.deepEqual(handTotal([c('A'), c('6'), c('10')]), { total: 17, soft: false });
  assert.deepEqual(handTotal([c('A'), c('A'), c('9')]), { total: 21, soft: true });
  assert.deepEqual(handTotal([c('K'), c('Q'), c('2')]), { total: 22, soft: false });
  assert.equal(cardValue(c('J', 3)), 10);
});

test('blackjack 3:2 öder; ikisinde de varsa berabere; krupiyenin blackjack’i eli hemen bitirir', () => {
  const bj = dealBlackjack(shoe('A', '10', 'K', '7'), BET);
  assert.ok(bj.done);
  assert.equal(bjHandOutcome(bj, 0), 'blackjack');
  assert.equal(bjPayout(bj), 2500);
  const both = dealBlackjack(shoe('A', 'A', 'K', 'Q'), BET);
  assert.equal(bjHandOutcome(both, 0), 'push');
  assert.equal(bjPayout(both), BET);
  const dealer = dealBlackjack(shoe('10', 'A', '9', 'K'), BET);
  assert.ok(dealer.done);
  assert.equal(bjPayout(dealer), 0);
});

test('krupiye yumuşak 17’de durur, 16’da çeker', () => {
  const soft17 = bjAct(dealBlackjack(shoe('10', 'A', '8', '6', '5'), BET), 'stand');
  assert.deepEqual(soft17.dealer, [c('A'), c('6')]);
  assert.equal(bjHandOutcome(soft17, 0), 'win');
  const sixteen = bjAct(dealBlackjack(shoe('10', '10', '8', '6', '5'), BET), 'stand');
  assert.deepEqual(sixteen.dealer, [c('10'), c('6'), c('5')]);
  assert.equal(bjHandOutcome(sixteen, 0), 'lose');
});

test('bütün eller battıysa krupiye kart çekmez', () => {
  const s = bjAct(dealBlackjack(shoe('10', '10', '6', '6', 'K'), BET), 'hit');
  assert.ok(s.done);
  assert.equal(s.dealer.length, 2);
  assert.equal(bjHandOutcome(s, 0), 'bust');
});

test('ikiye katlama: bahis iki kat, tek kart, el kapanır', () => {
  const s = bjAct(dealBlackjack(shoe('6', '6', '5', '10', 'K', '9'), BET), 'double');
  assert.equal(s.hands[0].bet, 2 * BET);
  assert.equal(s.hands[0].cards.length, 3);
  assert.equal(bjStaked(s), 2 * BET);
  // 21'e karşı krupiye 6 + 10 + 9 = 25: battı
  assert.equal(bjPayout(s), 4 * BET);
});

test('bölme: iki el, bir kez; bölünen aslara birer kart ve 21 blackjack sayılmaz', () => {
  const deal = dealBlackjack(shoe('8', '9', '8', '7', '3', '8'), BET);
  assert.ok(bjActions(deal).includes('split'));
  const split = bjAct(deal, 'split');
  assert.equal(split.hands.length, 2);
  assert.deepEqual(split.hands.map((h) => h.cards), [[c('8'), c('3')], [c('8'), c('8')]]);
  assert.ok(!bjActions(split).includes('split'));
  assert.ok(bjActions(split).includes('double')); // bölmeden sonra ikiye katlama var

  const aces = bjAct(dealBlackjack(shoe('A', '9', 'A', '8', 'K', '5'), BET), 'split');
  assert.ok(aces.done);
  assert.deepEqual(aces.hands.map((h) => h.cards.length), [2, 2]);
  assert.equal(bjHandOutcome(aces, 0), 'win'); // A + K = 21, ama 1:1
  assert.equal(bjHandOutcome(aces, 1), 'lose'); // A + 5 = 16, krupiye 9 + 8 = 17
  assert.equal(bjPayout(aces), 2 * BET);
});

test('yeniden oynatma aynı sonucu verir', () => {
  const random = seededRandom(7);
  for (let i = 0; i < 2000; i++) {
    const deck = drawShoe(random);
    let s = dealBlackjack(deck, BET);
    const actions: BjAction[] = [];
    while (!s.done) {
      const a = basicStrategy(s);
      actions.push(a);
      s = bjAct(s, a);
    }
    assert.deepEqual(replayBlackjack(deck, BET, actions), s);
  }
});

test('geçersiz hamle reddedilir', () => {
  const s = bjAct(dealBlackjack(shoe('10', '9', '5', '7', '2'), BET), 'hit');
  assert.throws(() => bjAct(s, 'double'));
  assert.throws(() => bjAct(dealBlackjack(shoe('A', '10', 'K', '7'), BET), 'hit'));
});

test('deste: her kart her yerde eşit olasılıkla, 6 desteden fazla tekrar yok', () => {
  const random = seededRandom(52);
  const first = new Array(52).fill(0);
  const n = 200_000;
  for (let i = 0; i < n; i++) {
    const deck = drawShoe(random);
    first[deck[0]]++;
    if (i < 2000) {
      const count = new Map<number, number>();
      for (const card of deck) count.set(card, (count.get(card) ?? 0) + 1);
      assert.ok(Math.max(...count.values()) <= BLACKJACK.decks);
    }
  }
  for (const k of first) assert.ok(Math.abs(k / n - 1 / 52) < 0.0015, String(k / n));
});

test('temel strateji örnekleri', () => {
  const at = (p1: string, p2: string, up: string) => basicStrategy(dealBlackjack(shoe(p1, up, p2, '2'), BET));
  assert.equal(at('10', '6', '7'), 'hit');
  assert.equal(at('10', '6', '6'), 'stand');
  assert.equal(at('10', '2', '3'), 'hit');
  assert.equal(at('6', '5', '10'), 'double');
  assert.equal(at('6', '5', 'A'), 'hit');
  assert.equal(at('A', '7', '2'), 'stand');
  assert.equal(at('A', '7', '9'), 'hit');
  assert.equal(at('A', '7', '5'), 'double');
  assert.equal(at('8', '8', 'A'), 'split');
  assert.equal(at('10', 'K', '6'), 'stand');
  assert.equal(at('9', '9', '7'), 'stand');
  assert.equal(at('5', '5', '6'), 'double');
  // Jeton yetmiyorsa ikiye katlama yerine çek
  const s = dealBlackjack(shoe('6', '10', '5', '2'), BET);
  assert.equal(basicStrategy(s, ['hit', 'stand']), 'hit');
});

test('temel stratejiyle geri dönüş ≈ %99,6 (1 milyon el)', () => {
  const { rtp } = simulateBlackjack(1_000_000, seededRandom(21));
  assert.ok(Math.abs(rtp - BLACKJACK.basicStrategyRtp) < 0.004, String(rtp));
});
