// Blackjack: 6 deste, her elde yeniden karılır; krupiye 17'de durur (yumuşak 17 dahil), blackjack 3:2.
// Kartlar el başında güvenli rastgele sayıyla çekilip kaydedilir; hamleler de kaydedilir. Ekranda her hamlede temel
// stratejinin önerisi yazar: en iyi oyunla bile uzun vadede kasa kazanır. Sigorta yok, "otomatik oyna" yok.
import {
  basicStrategy, BLACKJACK, bjActions, bjExtraBet, bjHandOutcome, bjHandPayout, handTotal, TOKEN,
  type BjAction, type BjState, type Card,
} from '@oran/games-math';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, SlideInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { celebrate, Effects, nextWinId, tierOf, WinBanner, type EffectsHandle, type Tier } from '@/components/arena/effects';
import { AText, ArenaBackground, Balance, ChipRow, Glass, NeonButton, useArena, useShake } from '@/components/arena/kit';
import { CARD_WIDTH, PlayingCard } from '@/components/playing-card';
import { RefillCard } from '@/components/refill-card';
import { Arena, FontFamily, glow } from '@/constants/arena';
import { blackjackAction, canRefill, closeInterruptedRounds, startBlackjackRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { localization, useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { sfx } from '@/lib/sound';
import { formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const BETS = [10, 50, 100, 500];
/** Krupiyenin kartları el bitince birer birer açılır */
const REVEAL_MS = 600;
/** İlk dağıtımda kartlar arası */
const DEAL_MS = 160;

interface Round { id: string; state: BjState; payout: number | null }

export default function BlackjackScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { balance } = useGames();
  const reality = useRealityCheck('blackjack');
  useArena(['deal', 'flip', 'chip', 'lose', 'winSmall', 'winBig', 'winMega', 'coin']);
  const [bet, setBet] = useState(BETS[2]);
  const [round, setRound] = useState<Round | null>(null);
  const [shown, setShown] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [win, setWin] = useState<{ tier: Tier; payout: number; bet: number; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fx = useRef<EffectsHandle>(null);
  const { style: shakeStyle, shake } = useShake();

  useEffect(() => {
    closeInterruptedRounds();
    return () => {
      if (timer.current) clearInterval(timer.current);
      closeInterruptedRounds();
    };
  }, []);

  const playing = !!round && !round.state.done;
  const dealer = round?.state.dealer ?? [];
  const revealing = !!round && round.state.done && shown < dealer.length;
  const busy = playing || revealing;
  useEffect(() => {
    if (!busy) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [busy]);

  /** El bitince sonuç: kazanç kutlanır, beraberlik ve kayıp sakin */
  function conclude(next: Round) {
    const staked = next.state.hands.reduce((s, h) => s + h.bet, 0);
    const payout = next.payout ?? 0;
    const tier = tierOf(staked, payout);
    if (payout > staked && tier) {
      celebrate(fx.current, tier, { x: width / 2, y: 330 }, shake);
      setWin({ tier, payout, bet: staked, id: nextWinId() });
    } else if (payout > 0) {
      sfx('chip');
      haptic.light();
    } else {
      sfx('lose');
      haptic.error();
    }
    reality.check();
  }

  /** El bitti: krupiyenin kapalı kartı ve çektikleri sırayla açılır, sonra sonuç */
  function reveal(next: Round, delay = 0) {
    if (timer.current) clearInterval(timer.current);
    setTimeout(() => {
      let n = 2;
      setShown(n);
      sfx('flip');
      timer.current = setInterval(() => {
        if (n >= next.state.dealer.length) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          conclude(next);
          return;
        }
        n++;
        setShown(n);
        sfx('deal');
      }, REVEAL_MS);
    }, delay);
  }

  function deal() {
    setProblem(null);
    setWin(null);
    const units = bet * TOKEN;
    if (units > balance) return setProblem(t('crash.noBalance'));
    const now = new Date();
    reality.begin(now);
    const next = startBlackjackRound(units, now);
    setRound(next);
    setShown(1);
    haptic.medium();
    for (let k = 0; k < 4; k++) setTimeout(() => sfx('deal', { rate: 0.95 + k * 0.03 }), k * DEAL_MS);
    if (next.state.done) reveal(next, 4 * DEAL_MS + 200);
  }

  function act(action: BjAction) {
    if (!round) return;
    const r = blackjackAction(round.id, action);
    // El başka yerden kapandıysa (ör. ekran yeniden yüklendi) ekran takılı kalmasın
    if (!r) return setRound(null);
    const next = { id: round.id, ...r };
    setRound(next);
    if (action === 'hit' || action === 'double') sfx('deal');
    if (action === 'split') { sfx('deal'); setTimeout(() => sfx('deal'), DEAL_MS); }
    if (action === 'double') sfx('chip');
    if (r.state.done) reveal(next, action === 'stand' ? 0 : 350);
  }

  const state = round?.state;
  const allowed = state ? bjActions(state).filter((a) => bjExtraBet(state, a) <= balance) : [];
  const hint = playing && state ? basicStrategy(state, allowed) : null;
  const finished = !!round && round.state.done && !revealing && shown >= dealer.length;
  const net = finished && state ? (round.payout ?? 0) - state.hands.reduce((s, h) => s + h.bet, 0) : 0;
  const tableWidth = width - 32 - 28;
  const rtp = BLACKJACK.basicStrategyRtp;
  const netColor = net > 0 ? Arena.gold : net < 0 ? Arena.danger : Arena.textDim;

  return (
    <ArenaBackground>
      <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
      <Animated.View style={[styles.fill, shakeStyle]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Balance units={balance} />

          <View style={styles.table}>
            <View pointerEvents="none" style={styles.arc} />
            <HandRow
              label={t('blackjack.dealer')}
              total={dealerTotal(dealer, shown)}
              cards={dealer.slice(0, Math.max(shown, Math.min(2, dealer.length)))}
              hiddenFrom={shown < 2 ? 1 : null}
              roundId={round?.id}
              width={tableWidth}
              prefix="d"
              dealDelay={(i) => (i < 2 ? DEAL_MS + i * 2 * DEAL_MS : 0)}
            />
            <View style={styles.divider} />
            {state ? state.hands.map((h, i) => {
              const outcome = finished ? bjHandOutcome(state, i) : null;
              const handNet = finished ? bjHandPayout(state, i) - h.bet : 0;
              const active = playing && state.hands.length > 1 && state.active === i;
              return (
                <View key={i} style={[styles.hand, active && styles.activeHand]}>
                  <HandRow
                    label={state.hands.length > 1 ? t('blackjack.hand', { n: i + 1 }) : t('blackjack.you')}
                    total={playerTotal(h.cards, h.done || state.done)}
                    extra={formatTokens(h.bet)}
                    cards={h.cards}
                    hiddenFrom={null}
                    roundId={round?.id}
                    width={tableWidth}
                    prefix={`p${i}`}
                    dealDelay={(k) => (state.hands.length === 1 && k < 2 ? k * 2 * DEAL_MS : 0)}
                  />
                  {outcome ? (
                    <Animated.View entering={ZoomIn.springify()} style={[styles.badge, {
                      backgroundColor: outcomeColor(outcome), boxShadow: glow(outcomeColor(outcome), 14, 0.6),
                    }]}>
                      <AText style={styles.badgeText}>{`${t(`blackjack.${outcome}`)} · ${formatNet(handNet)}`}</AText>
                    </Animated.View>
                  ) : null}
                </View>
              );
            }) : (
              <AText style={styles.idle}>{t('blackjack.rules')}</AText>
            )}
          </View>

          <View style={styles.status}>
            {finished ? (
              <Animated.View entering={FadeIn}>
                <AText display style={[styles.net, { color: netColor, textShadowColor: netColor }]}>{t('blackjack.net', { net: formatNet(net) })}</AText>
              </Animated.View>
            ) : null}
            {hint ? (
              <View style={styles.hint}>
                <AText style={styles.hintText}>{t('blackjack.hint', { move: t(`blackjack.${hint}`) })}</AText>
              </View>
            ) : null}
          </View>

          {canRefill(balance) && !busy ? <RefillCard /> : null}

          {round ? <AText dim style={styles.small}>{t('blackjack.rules')}</AText> : null}
          <AText dim style={styles.small}>{t('blackjack.honesty')}</AText>
          <AText dim style={styles.small}>
            {t('blackjack.edge', {
              rtp: new Intl.NumberFormat(localization().locale, { maximumFractionDigits: 1 }).format(rtp * 100),
              edge: formatPercent(1 - rtp),
            })}
          </AText>
        </ScrollView>

        <Glass strong style={[styles.footer, { marginBottom: Math.max(12, insets.bottom) }]}>
          {playing ? (
            <View style={styles.actions}>
              {(['hit', 'stand', 'double', 'split'] as const).map((a) => {
                const enabled = allowed.includes(a);
                if (!enabled && (a === 'double' || a === 'split') && !bjActions(state!).includes(a)) return null;
                return (
                  <NeonButton key={a} style={styles.action} disabled={!enabled} onPress={() => act(a)}
                    tone={a === 'hit' ? 'neon' : a === 'double' ? 'gold' : 'glass'} pulse={hint === a} sound={null}
                    label={t(`blackjack.${a}`)} />
                );
              })}
            </View>
          ) : (
            <>
              <ChipRow values={BETS} value={bet} disabled={revealing} onChange={setBet} />
              {problem ? <AText style={styles.problem}>{problem}</AText> : null}
              <NeonButton onPress={deal} disabled={revealing} label={t('blackjack.deal', { amount: formatTokens(bet * TOKEN) })} />
            </>
          )}
        </Glass>
      </Animated.View>
      <Effects ref={fx} />
      <WinBanner win={win} onDone={() => setWin(null)} />
    </ArenaBackground>
  );
}

/** Krupiye: kapalı kart açılana kadar sadece açık kartın değeri */
function dealerTotal(cards: Card[], shown: number) {
  if (cards.length === 0) return '';
  return String(handTotal(cards.slice(0, Math.max(1, shown))).total);
}

/** Yumuşak el oynanırken iki değer: "7 / 17" */
function playerTotal(cards: Card[], done: boolean) {
  const { total, soft } = handTotal(cards);
  return soft && !done && total < 21 ? `${total - 10} / ${total}` : String(total);
}

function outcomeColor(o: string) {
  return o === 'blackjack' ? Arena.gold : o === 'win' ? Arena.neonDeep : o === 'push' ? '#5D6B8A' : Arena.dangerDeep;
}

function HandRow({ label, total, extra, cards, hiddenFrom, roundId, width, prefix, dealDelay }: {
  label: string; total: string; extra?: string; cards: Card[]; hiddenFrom: number | null;
  roundId?: string; width: number; prefix: string; dealDelay: (index: number) => number;
}) {
  // Kartlar sığmazsa üst üste biner
  const gap = 8;
  const step = cards.length > 1 ? Math.min(CARD_WIDTH + gap, (width - CARD_WIDTH) / (cards.length - 1)) : 0;
  return (
    <View style={styles.handRow}>
      <View style={styles.handHead}>
        <AText style={styles.handLabel}>{label}</AText>
        {total ? (
          <View style={styles.totalPill}>
            <AText display style={styles.totalText}>{total}</AText>
          </View>
        ) : null}
        <View style={styles.fill} />
        {extra ? <AText style={styles.handBet}>{extra}</AText> : null}
      </View>
      <View style={styles.cards}>
        {cards.map((c, i) => {
          const hidden = hiddenFrom !== null && i >= hiddenFrom;
          return (
            <Animated.View key={`${roundId}-${prefix}-${i}-${hidden ? 'h' : 'o'}`}
              entering={hidden || i >= 2 || !roundId ? SlideInRight.duration(260) : SlideInRight.delay(dealDelay(i)).duration(280)}
              style={{ marginLeft: i === 0 ? 0 : step - CARD_WIDTH }}>
              <PlayingCard card={c} hidden={hidden} />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  table: {
    borderRadius: 28, padding: 14, gap: 14, minHeight: 330, borderWidth: 2, borderColor: '#C99A3C', overflow: 'hidden',
    experimental_backgroundImage: 'radial-gradient(circle at 50% 35%, #1D7A55 0%, #0F4632 60%, #082A1E 100%)',
    boxShadow: `${glow(Arena.gold, 24, 0.25)}, inset 0px 0px 30px rgba(0,0,0,0.55)`,
  },
  arc: {
    position: 'absolute', left: -60, right: -60, top: 150, height: 300, borderRadius: 400, borderWidth: 1.5,
    borderColor: 'rgba(231,196,107,0.28)',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  hand: { gap: 10, borderRadius: 14, padding: 6, margin: -6 },
  activeHand: { backgroundColor: 'rgba(255,255,255,0.10)', boxShadow: glow(Arena.neon, 12, 0.3) },
  handRow: { gap: 10 },
  handHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handLabel: { fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  totalPill: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  totalText: { fontSize: 13 },
  handBet: { color: '#FFE08A', fontWeight: '800', fontSize: 14 },
  cards: { flexDirection: 'row', minHeight: 82 },
  idle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  status: { minHeight: 64, gap: 8, alignItems: 'center', justifyContent: 'center' },
  net: { fontSize: 26, lineHeight: 34, paddingHorizontal: 16, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } },
  hint: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(61,217,255,0.4)', backgroundColor: 'rgba(61,217,255,0.08)', paddingHorizontal: 12, paddingVertical: 5 },
  hintText: { color: Arena.cyan, fontWeight: '700', fontSize: 13 },
  small: { fontSize: 13, lineHeight: 18 },
  footer: { marginHorizontal: 8, padding: 12, gap: 10, borderRadius: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { flexBasis: '46%', flexGrow: 1 },
  problem: { color: Arena.danger, fontSize: 13, fontWeight: '600', fontFamily: FontFamily.ui },
});
