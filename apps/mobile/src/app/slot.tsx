// Slot ("Stadyum"): 5 makara, 10 çizgi, bedava dönüşler (×2) ve penaltı bonusu. Geri dönüş oranı %95,03.
// Turun tamamı (ana dönüş, bedava dönüşler, penaltı köşeleri) dönüş başında güvenli rastgele sayılarla çekilip kaydedilir.
// Aldatmaca yok: bahisten az kazanç kutlanmaz (net − gösterilir), makaralar hep aynı ritimle durur, penaltıda seçilmeyen
// köşelerdeki ödüller de gösterilir, "otomatik oyna" yok.
import {
  LINES, neutralStops, PAYTABLE, PENALTY_PRIZES, resolveSlotRound, SCATTER_PAY, slotMath, SLOT, TOKEN,
  type SlotDraw, type SlotRound, type SpinResult, type SlotSymbol,
} from '@oran/games-math';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { RefillCard } from '@/components/refill-card';
import { SlotReels, SYMBOL_IMAGES, type ReelsHandle } from '@/components/slot-reels';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { canRefill, closeInterruptedRounds, finishSlotRound, startSlotRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const BETS = [10, 20, 50, 100];
const RTP = slotMath().rtp;
const LINE_SYMBOLS = Object.keys(PAYTABLE) as (keyof typeof PAYTABLE)[];

type Phase =
  | { kind: 'idle' }
  | { kind: 'spinning' }
  | { kind: 'penalty'; prizes: number[] }
  | { kind: 'penaltyResult'; prizes: number[]; pick: number }
  | { kind: 'freeIntro' }
  | { kind: 'free'; index: number }
  | { kind: 'done' };

/** Kazanan çizgilerin hücreleri: "makara:sıra" */
function winningCells(spin: SpinResult): Set<string> {
  const cells = new Set<string>();
  for (const w of spin.lineWins) for (let reel = 0; reel < w.count; reel++) cells.add(`${reel}:${LINES[w.line][reel]}`);
  if (spin.freeSpins) spin.grid.forEach((col, reel) => col.forEach((s, row) => { if (s === 'scatter') cells.add(`${reel}:${row}`); }));
  if (spin.bonus) spin.grid.forEach((col, reel) => col.forEach((s, row) => { if (s === 'bonus') cells.add(`${reel}:${row}`); }));
  return cells;
}

export default function SlotScreen() {
  const { t } = useT();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { balance } = useGames();
  const reality = useRealityCheck('slot');
  const [bet, setBet] = useState(BETS[0]);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [round, setRound] = useState<{ id: string; draw: SlotDraw; data: SlotRound; bet: number } | null>(null);
  const [shown, setShown] = useState<SpinResult | null>(null);
  const [freeWon, setFreeWon] = useState(0);
  const [result, setResult] = useState<{ bet: number; payout: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [paytable, setPaytable] = useState(false);
  const reels = useRef<ReelsHandle>(null);
  const scroll = useRef<ScrollView>(null);
  const initialStops = useMemo(() => neutralStops(), []);
  const highlight = useMemo(() => (shown && phase.kind !== 'spinning' ? winningCells(shown) : new Set<string>()), [shown, phase.kind]);

  useEffect(() => {
    closeInterruptedRounds();
    return () => closeInterruptedRounds();
  }, []);

  const busy = phase.kind !== 'idle' && phase.kind !== 'done';
  // Penaltı ve bedava dönüş kartları alt panelin altında kalmasın
  const card = phase.kind === 'penalty' || phase.kind === 'penaltyResult' || phase.kind === 'freeIntro';
  useEffect(() => {
    if (card) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [card, phase.kind]);
  useEffect(() => {
    if (!busy) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [busy]);

  function finish(r: NonNullable<typeof round>, pick: number | null) {
    const res = finishSlotRound(r.id, pick);
    setResult({ bet: r.bet, payout: res?.payout ?? 0 });
    setPhase({ kind: 'done' });
    reality.check();
  }

  /** Ana dönüşten (ve penaltıdan) sonra: bedava dönüş varsa onlara geçer, yoksa turu kapatır */
  function afterBase(r: NonNullable<typeof round>, pick: number | null) {
    if (r.data.free.length > 0) setPhase({ kind: 'freeIntro' });
    else finish(r, pick);
  }

  function spin() {
    setProblem(null);
    const units = bet * TOKEN;
    if (units > balance) return setProblem(t('crash.noBalance'));
    const now = new Date();
    reality.begin(now);
    const { id, draw } = startSlotRound(units, now);
    const r = { id, draw, data: resolveSlotRound(draw), bet: units };
    setRound(r);
    setResult(null);
    setFreeWon(0);
    setShown(null);
    setPhase({ kind: 'spinning' });
    reels.current?.spin(draw.stops, false, () => {
      setShown(r.data.base);
      if (r.data.prizes) setPhase({ kind: 'penalty', prizes: r.data.prizes });
      else afterBase(r, null);
    });
  }

  function shoot(pick: number) {
    if (!round || phase.kind !== 'penalty') return;
    setPhase({ kind: 'penaltyResult', prizes: phase.prizes, pick });
  }

  function playFree(index: number, total: number) {
    if (!round) return;
    setPhase({ kind: 'free', index });
    setShown(null);
    reels.current?.spin(round.draw.freeStops[index], true, () => {
      const spinResult = round.data.free[index];
      setShown(spinResult);
      const sum = total + spinResult.win * SLOT.freeSpinMultiplier * (round.bet / SLOT.lines);
      setFreeWon(sum);
      if (index + 1 < round.data.free.length) setTimeout(() => playFree(index + 1, sum), 700);
      else finish(round, null);
    });
  }

  const lineBet = (bet * TOKEN) / SLOT.lines;
  const baseWin = shown && round ? shown.win * (round.bet / SLOT.lines) * (phase.kind === 'free' ? SLOT.freeSpinMultiplier : 1) : 0;
  const net = result ? result.payout - result.bet : null;
  const resultColor = net === null ? theme.text : net > 0 ? theme.success : net < 0 ? theme.danger : theme.textSecondary;

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <ThemedText type="smallBold" style={styles.flex}>{t('games.balance', { amount: formatTokens(balance) })}</ThemedText>
          <Pressable onPress={() => setPaytable(true)} hitSlop={8} disabled={busy}>
            <ThemedText type="smallBold" style={{ color: theme.accent, opacity: busy ? 0.4 : 1 }}>{t('slot.paytable')}</ThemedText>
          </Pressable>
        </View>

        <SlotReels ref={reels} width={width - 2 * Spacing.three} initialStops={initialStops} highlight={highlight} />

        <View style={styles.status}>
          {phase.kind === 'free' ? (
            <ThemedText type="smallBold">{t('slot.freeSpin', { n: phase.index + 1, total: SLOT.freeSpins })}</ThemedText>
          ) : null}
          {shown && shown.win > 0 && phase.kind !== 'done' && phase.kind !== 'spinning' ? (
            <ThemedText type="small" themeColor="textSecondary">{t('slot.spinWin', { amount: formatTokens(baseWin) })}</ThemedText>
          ) : null}
          {freeWon > 0 || phase.kind === 'free' ? (
            <ThemedText type="small" themeColor="textSecondary">{t('slot.freeSpinsTotal', { amount: formatTokens(freeWon) })}</ThemedText>
          ) : null}
          {result ? (
            <ThemedText type="smallBold" style={{ color: resultColor }}>
              {result.payout > 0
                ? t('slot.result', { amount: formatTokens(result.payout), net: formatNet(net!) })
                : t('slot.noWin', { net: formatNet(net!) })}
            </ThemedText>
          ) : null}
        </View>

        {phase.kind === 'penalty' || phase.kind === 'penaltyResult' ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle" style={styles.cardTitle}>{t('slot.penaltyTitle')}</ThemedText>
            <ThemedText type="small">
              {phase.kind === 'penalty'
                ? t('slot.penaltyPick', { prizes: PENALTY_PRIZES.join(', ') })
                : t('slot.penaltyWon', { amount: formatTokens(phase.prizes[phase.pick] * (round?.bet ?? 0)) })}
            </ThemedText>
            <View style={styles.goal}>
              {[0, 1, 2].map((corner) => {
                const revealed = phase.kind === 'penaltyResult';
                const chosen = revealed && phase.pick === corner;
                return (
                  <Pressable key={corner} disabled={revealed} onPress={() => shoot(corner)}
                    accessibilityLabel={['◀', '▲', '▶'][corner]}
                    style={[styles.corner, { borderColor: chosen ? theme.success : theme.backgroundSelected, backgroundColor: theme.background }]}>
                    <ThemedText type="subtitle" style={chosen ? { color: theme.success } : undefined}>
                      {revealed ? `${phase.prizes[corner]}×` : ['◀', '▲', '▶'][corner]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {phase.kind === 'penaltyResult' ? (
              <Pressable onPress={() => round && afterBase(round, phase.pick)} style={[styles.button, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={styles.buttonText}>{t('slot.continue')}</ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>
        ) : null}

        {phase.kind === 'freeIntro' ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle" style={styles.cardTitle}>{t('slot.freeSpinsWon', { count: SLOT.freeSpins })}</ThemedText>
            <Pressable onPress={() => playFree(0, 0)} style={[styles.button, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={styles.buttonText}>{t('slot.freeSpinsStart')}</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {canRefill(balance) && !busy ? <RefillCard /> : null}

        <ThemedText type="small" themeColor="textSecondary">
          {t('games.houseEdge', { edge: formatPercent(1 - RTP), rtp: Math.round(RTP * 100) })}
        </ThemedText>
      </ScrollView>

      <ThemedView type="backgroundElement" style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">{t('slot.lineBet', { amount: formatTokens(lineBet) })}</ThemedText>
        <View style={styles.footerRow}>
          {BETS.map((b) => (
            <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: bet === b }} disabled={busy}
              onPress={() => setBet(b)}
              style={[styles.chip, { borderColor: bet === b ? theme.accent : theme.backgroundSelected, backgroundColor: theme.background }]}>
              <ThemedText type="smallBold" style={{ color: bet === b ? theme.accent : theme.text }}>{formatTokens(b * TOKEN)}</ThemedText>
            </Pressable>
          ))}
        </View>
        {problem ? <ThemedText type="small" style={{ color: theme.danger }}>{problem}</ThemedText> : null}
        <Pressable accessibilityRole="button" onPress={spin} disabled={busy}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed || busy ? 0.6 : 1 }]}>
          <ThemedText type="smallBold" style={styles.buttonText}>{t('slot.spin', { amount: formatTokens(bet * TOKEN) })}</ThemedText>
        </Pressable>
      </ThemedView>

      <Paytable visible={paytable} lineBet={lineBet} bet={bet * TOKEN} onClose={() => setPaytable(false)} />
    </ThemedView>
  );
}

function Paytable({ visible, lineBet, bet, onClose }: { visible: boolean; lineBet: number; bet: number; onClose: () => void }) {
  const { t } = useT();
  const theme = useTheme();
  const name = (s: SlotSymbol) => t(`slot.symbols.${s}`);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <ThemedText type="subtitle" style={styles.flex}>{t('slot.paytable')}</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>{t('slot.close')}</ThemedText>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">{t('slot.paytableIntro', { lineBet: formatTokens(lineBet) })}</ThemedText>
          {LINE_SYMBOLS.map((s) => (
            <ThemedView key={s} type="backgroundElement" style={styles.payRow}>
              <Image source={SYMBOL_IMAGES[s]} style={styles.payIcon} />
              <ThemedText type="small" style={styles.flex}>{name(s)}</ThemedText>
              {PAYTABLE[s].map((m, i) => (
                <View key={i} style={styles.payCell}>
                  <ThemedText type="small" themeColor="textSecondary">{i + 3}×</ThemedText>
                  <ThemedText type="smallBold">{formatTokens(m * lineBet)}</ThemedText>
                </View>
              ))}
            </ThemedView>
          ))}
          <ThemedView type="backgroundElement" style={styles.payRow}>
            <Image source={SYMBOL_IMAGES.scatter} style={styles.payIcon} />
            <ThemedText type="small" style={styles.flex}>
              {t('slot.scatterRule', {
                p3: formatTokens(SCATTER_PAY[3] * bet), p4: formatTokens(SCATTER_PAY[4] * bet), p5: formatTokens(SCATTER_PAY[5] * bet),
                count: SLOT.freeSpins,
              })}
            </ThemedText>
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.payRow}>
            <Image source={SYMBOL_IMAGES.bonus} style={styles.payIcon} />
            <ThemedText type="small" style={styles.flex}>
              {t('slot.bonusRule', { prizes: PENALTY_PRIZES.map((p) => formatTokens(p * bet)).join(', ') })}
            </ThemedText>
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">{t('slot.lines', { count: SLOT.lines })}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('slot.honesty')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('games.houseEdge', { edge: formatPercent(1 - RTP), rtp: Math.round(RTP * 100) })}
          </ThemedText>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.four },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  status: { minHeight: 60, gap: Spacing.one, alignItems: 'center' },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  cardTitle: { fontSize: 24, lineHeight: 30 },
  goal: { flexDirection: 'row', gap: Spacing.two },
  corner: { flex: 1, height: 72, borderWidth: 2, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.two },
  footerRow: { flexDirection: 'row', gap: Spacing.two },
  chip: { flex: 1, borderWidth: 2, borderRadius: Spacing.four, paddingVertical: Spacing.one, alignItems: 'center' },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 17 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Spacing.two, padding: Spacing.two },
  payIcon: { width: 40, height: 40 },
  payCell: { alignItems: 'center', minWidth: 48 },
});
