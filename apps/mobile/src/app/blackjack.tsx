// Blackjack: 6 deste, her elde yeniden karılır; krupiye 17'de durur (yumuşak 17 dahil), blackjack 3:2.
// Kartlar el başında güvenli rastgele sayıyla çekilip kaydedilir; hamleler de kaydedilir. Ekranda her hamlede temel
// stratejinin önerisi yazar: en iyi oyunla bile uzun vadede kasa kazanır. Sigorta yok, "otomatik oyna" yok.
import {
  basicStrategy, BLACKJACK, bjActions, bjExtraBet, bjHandOutcome, bjHandPayout, handTotal, TOKEN,
  type BjAction, type BjState, type Card,
} from '@oran/games-math';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CARD_WIDTH, PlayingCard } from '@/components/playing-card';
import { RefillCard } from '@/components/refill-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { blackjackAction, canRefill, closeInterruptedRounds, startBlackjackRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useTheme } from '@/hooks/use-theme';
import { localization, useT } from '@/i18n';
import { formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const BETS = [10, 50, 100, 500];
const FELT = '#17603A';
const ON_FELT = '#ffffff';
const ON_FELT_DIM = '#ffffffb3';
/** Krupiyenin kartları el bitince birer birer açılır */
const REVEAL_MS = 550;

interface Round { id: string; state: BjState; payout: number | null }

export default function BlackjackScreen() {
  const { t } = useT();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { balance } = useGames();
  const reality = useRealityCheck('blackjack');
  const [bet, setBet] = useState(BETS[2]);
  const [round, setRound] = useState<Round | null>(null);
  const [shown, setShown] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  /** El bitti: krupiyenin kapalı kartı ve çektikleri sırayla açılır, sonra sonuç */
  function reveal(next: Round) {
    if (timer.current) clearInterval(timer.current);
    let n = 2;
    setShown(n);
    timer.current = setInterval(() => {
      n++;
      setShown(n);
      if (n >= next.state.dealer.length && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
        reality.check();
      }
    }, REVEAL_MS);
  }

  function deal() {
    setProblem(null);
    const units = bet * TOKEN;
    if (units > balance) return setProblem(t('crash.noBalance'));
    const now = new Date();
    reality.begin(now);
    const next = startBlackjackRound(units, now);
    setRound(next);
    setShown(1);
    if (next.state.done) reveal(next);
  }

  function act(action: BjAction) {
    if (!round) return;
    const r = blackjackAction(round.id, action);
    // El başka yerden kapandıysa (ör. ekran yeniden yüklendi) ekran takılı kalmasın
    if (!r) return setRound(null);
    const next = { id: round.id, ...r };
    setRound(next);
    if (r.state.done) reveal(next);
  }

  const state = round?.state;
  const allowed = state ? bjActions(state).filter((a) => bjExtraBet(state, a) <= balance) : [];
  const hint = playing && state ? basicStrategy(state, allowed) : null;
  const finished = !!round && round.state.done && !revealing;
  const net = finished && state ? (round.payout ?? 0) - state.hands.reduce((s, h) => s + h.bet, 0) : 0;
  const tableWidth = width - 2 * Spacing.three - 2 * Spacing.three;
  const rtp = BLACKJACK.basicStrategyRtp;

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">{t('games.balance', { amount: formatTokens(balance) })}</ThemedText>

        <View style={styles.table}>
          <HandRow
            label={t('blackjack.dealer')}
            total={dealerTotal(dealer, shown)}
            cards={dealer.slice(0, Math.max(shown, Math.min(2, dealer.length)))}
            hiddenFrom={shown < 2 ? 1 : null}
            roundId={round?.id}
            width={tableWidth}
            prefix="d"
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
                />
                {outcome ? (
                  <Animated.View entering={FadeIn.duration(200)} style={[styles.badge, { backgroundColor: outcomeColor(outcome) }]}>
                    <ThemedText type="smallBold" style={styles.badgeText}>
                      {`${t(`blackjack.${outcome}`)} · ${formatNet(handNet)}`}
                    </ThemedText>
                  </Animated.View>
                ) : null}
              </View>
            );
          }) : (
            <ThemedText type="small" style={styles.idle}>{t('blackjack.rules')}</ThemedText>
          )}
        </View>

        <View style={styles.status}>
          {finished ? (
            <ThemedText type="subtitle" style={{ color: net > 0 ? theme.success : net < 0 ? theme.danger : theme.textSecondary }}>
              {t('blackjack.net', { net: formatNet(net) })}
            </ThemedText>
          ) : null}
          {hint ? <ThemedText type="small" themeColor="textSecondary">{t('blackjack.hint', { move: t(`blackjack.${hint}`) })}</ThemedText> : null}
        </View>

        {canRefill(balance) && !busy ? <RefillCard /> : null}

        {round ? <ThemedText type="small" themeColor="textSecondary">{t('blackjack.rules')}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">{t('blackjack.honesty')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('blackjack.edge', {
            rtp: new Intl.NumberFormat(localization().locale, { maximumFractionDigits: 1 }).format(rtp * 100),
            edge: formatPercent(1 - rtp),
          })}
        </ThemedText>
      </ScrollView>

      <ThemedView type="backgroundElement" style={styles.footer}>
        {playing ? (
          <View style={styles.row}>
            {(['hit', 'stand', 'double', 'split'] as const).map((a) => {
              const enabled = allowed.includes(a);
              if (!enabled && (a === 'double' || a === 'split') && !bjActions(state!).includes(a)) return null;
              return (
                <Pressable key={a} accessibilityRole="button" disabled={!enabled} onPress={() => act(a)}
                  style={({ pressed }) => [styles.action, {
                    backgroundColor: a === 'hit' || a === 'stand' ? theme.accent : theme.backgroundSelected,
                    opacity: !enabled ? 0.4 : pressed ? 0.7 : 1,
                  }]}>
                  <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit
                    style={{ color: a === 'hit' || a === 'stand' ? '#ffffff' : theme.text }}>
                    {t(`blackjack.${a}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <>
            <View style={styles.row}>
              {BETS.map((b) => (
                <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: bet === b }} disabled={revealing}
                  onPress={() => setBet(b)}
                  style={[styles.chip, { borderColor: bet === b ? theme.accent : theme.backgroundSelected, backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold" style={{ color: bet === b ? theme.accent : theme.text }}>{formatTokens(b * TOKEN)}</ThemedText>
                </Pressable>
              ))}
            </View>
            {problem ? <ThemedText type="small" style={{ color: theme.danger }}>{problem}</ThemedText> : null}
            <Pressable accessibilityRole="button" onPress={deal} disabled={revealing}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed || revealing ? 0.6 : 1 }]}>
              <ThemedText type="smallBold" style={styles.buttonText}>{t('blackjack.deal', { amount: formatTokens(bet * TOKEN) })}</ThemedText>
            </Pressable>
          </>
        )}
      </ThemedView>
    </ThemedView>
  );
}

/** Krupiye: kapalı kart açılana kadar sadece açık kartın değeri */
function dealerTotal(cards: Card[], shown: number) {
  if (cards.length === 0) return '';
  const visible = cards.slice(0, Math.max(1, shown));
  return String(handTotal(visible).total);
}

/** Yumuşak el oynanırken iki değer: "7 / 17" */
function playerTotal(cards: Card[], done: boolean) {
  const { total, soft } = handTotal(cards);
  return soft && !done && total < 21 ? `${total - 10} / ${total}` : String(total);
}

function outcomeColor(o: string) {
  return o === 'blackjack' || o === 'win' ? '#1A7F37' : o === 'push' ? '#6E7781' : '#CF222E';
}

function HandRow({ label, total, extra, cards, hiddenFrom, roundId, width, prefix }: {
  label: string; total: string; extra?: string; cards: Card[]; hiddenFrom: number | null;
  roundId?: string; width: number; prefix: string;
}) {
  // Kartlar sığmazsa üst üste biner
  const gap = 6;
  const step = cards.length > 1 ? Math.min(CARD_WIDTH + gap, (width - CARD_WIDTH) / (cards.length - 1)) : 0;
  return (
    <View style={styles.handRow}>
      <View style={styles.handHead}>
        <ThemedText type="smallBold" style={styles.onFelt}>{total ? `${label} · ${total}` : label}</ThemedText>
        {extra ? <ThemedText type="small" style={styles.onFeltDim}>{extra}</ThemedText> : null}
      </View>
      <View style={styles.cards}>
        {cards.map((c, i) => {
          const hidden = hiddenFrom !== null && i >= hiddenFrom;
          return (
            <Animated.View key={`${roundId}-${prefix}-${i}-${hidden ? 'h' : 'o'}`}
              entering={hidden ? FadeInDown.duration(220) : FadeIn.duration(220)}
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
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.four },
  table: { backgroundColor: FELT, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three, minHeight: 300 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ffffff40' },
  hand: { gap: Spacing.two, borderRadius: Spacing.two, padding: Spacing.one, margin: -Spacing.one },
  activeHand: { backgroundColor: '#ffffff1f' },
  handRow: { gap: Spacing.two },
  handHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cards: { flexDirection: 'row', minHeight: 82 },
  onFelt: { color: ON_FELT },
  onFeltDim: { color: ON_FELT_DIM },
  idle: { color: ON_FELT_DIM },
  badge: { alignSelf: 'flex-start', borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  badgeText: { color: '#ffffff' },
  status: { minHeight: 56, gap: Spacing.one, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  chip: { flex: 1, borderWidth: 2, borderRadius: Spacing.four, paddingVertical: Spacing.one, alignItems: 'center' },
  action: { flex: 1, borderRadius: Spacing.three, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.one },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 17 },
});
