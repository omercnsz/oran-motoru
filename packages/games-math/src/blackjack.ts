// Blackjack: 6 deste, her elde yeniden karılır (sürekli karıştırıcılı masa gibi). Krupiye 17'de durur (yumuşak 17 dahil),
// açık kartı as ya da 10 ise önce blackjack'e bakar: blackjack'i varsa el hemen biter. Blackjack 3:2, diğer kazançlar 1:1,
// beraberlikte bahis geri döner. İlk iki kartta ikiye katlanabilir; aynı değerde iki kart bir kez bölünebilir (bölünen
// ellerde de ikiye katlanabilir; bölünen aslara birer kart verilir ve bölünen elde 21 blackjack sayılmaz). Sigorta ve
// teslim yok.
// Kartlar el başında güvenli rastgele sayıyla çekilip kaydedilir; hamleler de kaydedildiği için el yeniden oynatılabilir.

import type { Random } from './random.ts';

export const BLACKJACK = {
  decks: 6,
  /**
   * Bir elde gereken en fazla kart. Oyuncu eli 21'e ulaşınca kapanır, aslar 1 sayılsa bile her kart en az 1 olduğu için
   * bir el en fazla 21 kart alır (bölünmüş iki el 42); krupiye 17'ye ulaşınca durur (en fazla 17 kart). 42 + 17 = 59.
   */
  shoeCards: 60,
  /** Temel stratejiyle uzun vadede geri dönüş: dönen / yatırılan (ikiye katlama ve bölme dahil). Simülasyonla; testler doğrular. */
  basicStrategyRtp: 0.996,
} as const;

/** Kart 0–51: değer sırası c % 13 (0 as, 1–8 → 2–9, 9 → 10, 10–12 → J, Q, K), renk Math.floor(c / 13) */
export type Card = number;
export const cardRank = (c: Card) => c % 13;
export const cardSuit = (c: Card) => Math.floor(c / 13) % 4;
export const cardValue = (c: Card) => {
  const r = c % 13;
  return r === 0 ? 11 : r >= 9 ? 10 : r + 1;
};

/** Karılmış 6 destenin ilk n kartı. Kısmi Fisher–Yates: tam karıştırmanın ilk n kartıyla aynı dağılım. */
const FULL_SHOE: readonly Card[] = Array.from({ length: 52 * BLACKJACK.decks }, (_, i) => i % 52);

export function drawShoe(random: Random, n: number = BLACKJACK.shoeCards): Card[] {
  const shoe = FULL_SHOE.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (shoe.length - i));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe.slice(0, n);
}

/** Elin toplamı; soft: bir as hâlâ 11 sayılıyor */
export function handTotal(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const c of cards) {
    const v = cardValue(c);
    total += v;
    if (v === 11) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: readonly Card[]) => cards.length === 2 && handTotal(cards).total === 21;

export type BjAction = 'hit' | 'stand' | 'double' | 'split';
export type BjOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';

export interface BjHand {
  cards: Card[];
  /** Bu elin bahsi (birim); ikiye katlanınca iki katı */
  bet: number;
  doubled: boolean;
  /** Bölünmüş el: 21 blackjack sayılmaz */
  split: boolean;
  done: boolean;
}

export interface BjState {
  shoe: readonly Card[];
  /** Sıradaki kartın destedeki yeri */
  next: number;
  /** Krupiyenin kartları; ikincisi el bitene kadar kapalı */
  dealer: Card[];
  hands: BjHand[];
  /** Oynanan elin sırası */
  active: number;
  done: boolean;
}

const clone = (s: BjState): BjState => ({ ...s, dealer: [...s.dealer], hands: s.hands.map((h) => ({ ...h, cards: [...h.cards] })) });

/** Dağıtım: oyuncu, krupiye, oyuncu, krupiye. Blackjack olan varsa el hemen biter. */
export function dealBlackjack(shoe: readonly Card[], bet: number): BjState {
  if (shoe.length < BLACKJACK.shoeCards) throw new RangeError('deste kısa');
  const hand: BjHand = { cards: [shoe[0], shoe[2]], bet, doubled: false, split: false, done: false };
  const s: BjState = { shoe, next: 4, dealer: [shoe[1], shoe[3]], hands: [hand], active: 0, done: false };
  if (isBlackjack(hand.cards) || isBlackjack(s.dealer)) {
    hand.done = true;
    s.done = true;
  }
  return s;
}

/** Oynanan elde yapılabilecek hamleler */
export function bjActions(s: BjState): BjAction[] {
  if (s.done) return [];
  const h = s.hands[s.active];
  const actions: BjAction[] = ['hit', 'stand'];
  if (h.cards.length === 2) {
    actions.push('double');
    if (s.hands.length === 1 && cardValue(h.cards[0]) === cardValue(h.cards[1])) actions.push('split');
  }
  return actions;
}

/** Hamlenin ek bahsi (ikiye katlama ve bölme, oynanan elin bahsi kadar) */
export const bjExtraBet = (s: BjState, action: BjAction) =>
  action === 'double' || action === 'split' ? s.hands[s.active].bet : 0;

/** Hamle: yeni durum döner (eskisi değişmez). Bütün eller bitince krupiye oynar. */
export function bjAct(state: BjState, action: BjAction): BjState {
  if (!bjActions(state).includes(action)) throw new RangeError(`geçersiz hamle: ${action}`);
  const s = clone(state);
  const draw = () => s.shoe[s.next++];
  const h = s.hands[s.active];
  if (action === 'hit') {
    h.cards.push(draw());
    if (handTotal(h.cards).total >= 21) h.done = true;
  } else if (action === 'stand') {
    h.done = true;
  } else if (action === 'double') {
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(draw());
    h.done = true;
  } else {
    const aces = cardValue(h.cards[0]) === 11;
    s.hands = h.cards.map((c) => {
      const cards = [c, draw()];
      return { cards, bet: h.bet, doubled: false, split: true, done: aces || handTotal(cards).total === 21 };
    });
  }
  while (s.active < s.hands.length && s.hands[s.active].done) s.active++;
  if (s.active === s.hands.length) {
    s.active = s.hands.length - 1;
    s.done = true;
    // Bütün eller battıysa krupiye kart çekmez
    if (s.hands.some((x) => handTotal(x.cards).total <= 21)) {
      while (handTotal(s.dealer).total < 17) s.dealer.push(draw());
    }
  }
  return s;
}

export function bjHandOutcome(s: BjState, i: number): BjOutcome {
  const h = s.hands[i];
  const player = handTotal(h.cards).total;
  const dealerBj = isBlackjack(s.dealer);
  if (!h.split && isBlackjack(h.cards)) return dealerBj ? 'push' : 'blackjack';
  if (dealerBj) return 'lose';
  if (player > 21) return 'bust';
  const dealer = handTotal(s.dealer).total;
  if (dealer > 21 || player > dealer) return 'win';
  return player === dealer ? 'push' : 'lose';
}

/** Elin ödemesi (birim): blackjack 2,5×, kazanç 2×, beraberlik 1× bahis. Bahis tam jeton olduğu için kesin. */
export function bjHandPayout(s: BjState, i: number): number {
  const { bet } = s.hands[i];
  const o = bjHandOutcome(s, i);
  return o === 'blackjack' ? (bet / 2) * 5 : o === 'win' ? bet * 2 : o === 'push' ? bet : 0;
}

export const bjPayout = (s: BjState) => s.hands.reduce((sum, _, i) => sum + bjHandPayout(s, i), 0);
export const bjStaked = (s: BjState) => s.hands.reduce((sum, h) => sum + h.bet, 0);

/** Kayıttan yeniden oynatma: deste + hamleler */
export const replayBlackjack = (shoe: readonly Card[], bet: number, actions: readonly BjAction[]) =>
  actions.reduce(bjAct, dealBlackjack(shoe, bet));

/**
 * Temel strateji (6 deste, krupiye yumuşak 17'de durur, bölmeden sonra ikiye katlama var, teslim yok).
 * allowed: yapılabilecek hamleler (ör. jeton yetmiyorsa ikiye katlama ve bölme çıkarılır).
 */
export function basicStrategy(s: BjState, allowed: readonly BjAction[] = bjActions(s)): BjAction {
  const h = s.hands[s.active];
  const up = cardValue(s.dealer[0]);
  const { total, soft } = handTotal(h.cards);
  const canDouble = allowed.includes('double');
  const double = (when: boolean, otherwise: BjAction): BjAction => (when && canDouble ? 'double' : otherwise);
  if (allowed.includes('split')) {
    const v = cardValue(h.cards[0]);
    if (
      v === 11 || v === 8 ||
      (v === 9 && up !== 7 && up < 10) ||
      ((v === 7 || v === 3 || v === 2) && up <= 7) ||
      (v === 6 && up <= 6) ||
      (v === 4 && (up === 5 || up === 6))
    ) return 'split';
  }
  if (soft) {
    if (total >= 19) return 'stand';
    if (total === 18) return up >= 3 && up <= 6 ? double(true, 'stand') : up <= 8 ? 'stand' : 'hit';
    if (total === 17) return double(up >= 3 && up <= 6, 'hit');
    if (total >= 15) return double(up >= 4 && up <= 6, 'hit');
    if (total >= 13) return double(up >= 5 && up <= 6, 'hit');
    return 'hit';
  }
  if (total >= 17) return 'stand';
  if (total >= 13) return up <= 6 ? 'stand' : 'hit';
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (total === 11) return double(up <= 10, 'hit');
  if (total === 10) return double(up <= 9, 'hit');
  if (total === 9) return double(up >= 3 && up <= 6, 'hit');
  return 'hit';
}

/** Temel stratejiyle oynayan oyuncunun geri dönüşü: dönen / yatırılan */
export function simulateBlackjack(rounds: number, random: Random): { rtp: number; perInitialBet: number } {
  let staked = 0, returned = 0;
  const bet = 100;
  for (let i = 0; i < rounds; i++) {
    let s = dealBlackjack(drawShoe(random), bet);
    while (!s.done) s = bjAct(s, basicStrategy(s));
    staked += bjStaked(s);
    returned += bjPayout(s);
  }
  return { rtp: returned / staked, perInitialBet: (returned - staked) / (rounds * bet) };
}
