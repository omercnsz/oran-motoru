// Slot ("Stadyum"): 5 makara, 10 çizgi, bedava dönüşler (×2) ve penaltı bonusu. Geri dönüş oranı %95,03.
// Turun tamamı (ana dönüş, bedava dönüşler, penaltı köşeleri) dönüş başında güvenli rastgele sayılarla çekilip kaydedilir.
// Makaralar hep aynı ritimle durur (yapay kıl payı yok), penaltıda seçilmeyen köşelerin ödülleri de gösterilir,
// "otomatik oyna" yok. Her dönüşün sonunda net sonuç yazar.
import {
  LINES, neutralStops, PAYTABLE, PENALTY_PRIZES, resolveSlotRound, SCATTER_PAY, slotMath, SLOT, TOKEN,
  type SlotDraw, type SlotRound, type SpinResult, type SlotSymbol,
} from '@oran/games-math';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { celebrate, Effects, nextWinId, tierOf, WinBanner, type EffectsHandle, type Tier } from '@/components/arena/effects';
import { AText, ArenaBackground, Balance, ChipRow, Glass, GlassButton, NeonButton, useArena, useShake } from '@/components/arena/kit';
import { RefillCard } from '@/components/refill-card';
import { SlotReels, SYMBOL_IMAGES, type ReelsHandle } from '@/components/slot-reels';
import { Arena, FontFamily, glow } from '@/constants/arena';
import { canRefill, closeInterruptedRounds, finishSlotRound, startSlotRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { loop, sfx } from '@/lib/sound';
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
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { balance } = useGames();
  const reality = useRealityCheck('slot');
  useArena(['whoosh', 'reel', 'coin', 'lose', 'winSmall', 'winBig', 'winMega', 'cashout']);
  const [bet, setBet] = useState(BETS[0]);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [round, setRound] = useState<{ id: string; draw: SlotDraw; data: SlotRound; bet: number } | null>(null);
  const [shown, setShown] = useState<SpinResult | null>(null);
  const [freeWon, setFreeWon] = useState(0);
  const [result, setResult] = useState<{ bet: number; payout: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [paytable, setPaytable] = useState(false);
  const [win, setWin] = useState<{ tier: Tier; payout: number; bet: number; id: number } | null>(null);
  const reels = useRef<ReelsHandle>(null);
  const scroll = useRef<ScrollView>(null);
  const spinSound = useRef<ReturnType<typeof loop> | null>(null);
  const fx = useRef<EffectsHandle>(null);
  const { style: shakeStyle, shake } = useShake();
  const initialStops = useMemo(() => neutralStops(), []);
  const highlight = useMemo(() => (shown && phase.kind !== 'spinning' ? winningCells(shown) : new Set<string>()), [shown, phase.kind]);
  const reelsWidth = width - 32;

  useEffect(() => {
    closeInterruptedRounds();
    return () => {
      spinSound.current?.stop();
      closeInterruptedRounds();
    };
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

  function rollReels(stops: number[], fast: boolean, onDone: () => void) {
    spinSound.current?.stop();
    spinSound.current = loop('spinloop', 0.45);
    reels.current?.spin(stops, fast, () => {
      spinSound.current?.stop();
      spinSound.current = null;
      onDone();
    }, (i) => {
      sfx('reel', { volume: 0.8, rate: 0.95 + i * 0.04 });
      haptic.light();
    });
  }

  function finish(r: NonNullable<typeof round>, pick: number | null) {
    const res = finishSlotRound(r.id, pick);
    const payout = res?.payout ?? 0;
    setResult({ bet: r.bet, payout });
    setPhase({ kind: 'done' });
    const tier = tierOf(r.bet, payout);
    if (tier) {
      celebrate(fx.current, tier, { x: width / 2, y: 260 }, shake);
      // Afiş sadece bahisten fazlası dönünce; azı dönünce kısa kutlama
      if (payout > r.bet) setWin({ tier, payout, bet: r.bet, id: nextWinId() });
    } else {
      sfx('lose');
    }
    reality.check();
  }

  /** Ana dönüşten (ve penaltıdan) sonra: bedava dönüş varsa onlara geçer, yoksa turu kapatır */
  function afterBase(r: NonNullable<typeof round>, pick: number | null) {
    if (r.data.free.length > 0) {
      setPhase({ kind: 'freeIntro' });
      sfx('winBig');
      haptic.success();
      fx.current?.confetti(width / 2, 220, 60);
    } else finish(r, pick);
  }

  function spin() {
    setProblem(null);
    setWin(null);
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
    sfx('whoosh');
    haptic.medium();
    rollReels(draw.stops, false, () => {
      setShown(r.data.base);
      if (r.data.base.win > 0) sfx('coin');
      if (r.data.prizes) {
        setPhase({ kind: 'penalty', prizes: r.data.prizes });
        sfx('winSmall');
        haptic.success();
      } else afterBase(r, null);
    });
  }

  function shoot(pick: number) {
    if (!round || phase.kind !== 'penalty') return;
    sfx('whoosh');
    haptic.heavy();
    setPhase({ kind: 'penaltyResult', prizes: phase.prizes, pick });
    setTimeout(() => { sfx('cashout'); fx.current?.coins(width / 2, 420, 18, 0.8); }, 250);
  }

  function playFree(index: number, total: number) {
    if (!round) return;
    setPhase({ kind: 'free', index });
    setShown(null);
    rollReels(round.draw.freeStops[index], true, () => {
      const spinResult = round.data.free[index];
      setShown(spinResult);
      const amount = spinResult.win * SLOT.freeSpinMultiplier * (round.bet / SLOT.lines);
      if (amount > 0) sfx('coin');
      const sum = total + amount;
      setFreeWon(sum);
      if (index + 1 < round.data.free.length) setTimeout(() => playFree(index + 1, sum), 700);
      else finish(round, null);
    });
  }

  const lineBet = (bet * TOKEN) / SLOT.lines;
  const baseWin = shown && round ? shown.win * (round.bet / SLOT.lines) * (phase.kind === 'free' ? SLOT.freeSpinMultiplier : 1) : 0;
  const net = result ? result.payout - result.bet : null;
  const resultColor = net === null ? Arena.text : net > 0 ? Arena.neon : net < 0 ? Arena.danger : Arena.textDim;

  return (
    <ArenaBackground>
      <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
      <Animated.View style={[styles.fill, shakeStyle]}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <Balance units={balance} />
            <View style={styles.flex} />
            <GlassButton label={t('slot.paytable')} disabled={busy} onPress={() => setPaytable(true)} />
          </View>

          {phase.kind === 'free' ? (
            <Animated.View entering={ZoomIn} style={styles.freeBadge}>
              <AText display style={styles.freeText}>{t('slot.freeSpin', { n: phase.index + 1, total: SLOT.freeSpins })}</AText>
            </Animated.View>
          ) : null}

          <SlotReels ref={reels} width={reelsWidth} initialStops={initialStops} highlight={highlight} />

          <View style={styles.status}>
            {shown && shown.win > 0 && phase.kind !== 'done' && phase.kind !== 'spinning' ? (
              <AText style={styles.spinWin}>{t('slot.spinWin', { amount: formatTokens(baseWin) })}</AText>
            ) : null}
            {freeWon > 0 || phase.kind === 'free' ? (
              <AText style={styles.freeTotal}>{t('slot.freeSpinsTotal', { amount: formatTokens(freeWon) })}</AText>
            ) : null}
            {result ? (
              <AText style={[styles.result, { color: resultColor }]}>
                {result.payout > 0
                  ? t('slot.result', { amount: formatTokens(result.payout), net: formatNet(net!) })
                  : t('slot.noWin', { net: formatNet(net!) })}
              </AText>
            ) : null}
          </View>

          {phase.kind === 'penalty' || phase.kind === 'penaltyResult' ? (
            <Animated.View entering={FadeIn}>
              <Glass strong style={styles.card}>
                <AText display style={styles.cardTitle}>{t('slot.penaltyTitle')}</AText>
                <AText dim style={styles.cardText}>
                  {phase.kind === 'penalty'
                    ? t('slot.penaltyPick', { prizes: PENALTY_PRIZES.join(', ') })
                    : t('slot.penaltyWon', { amount: formatTokens(phase.prizes[phase.pick] * (round?.bet ?? 0)) })}
                </AText>
                <View style={styles.goal}>
                  {[0, 1, 2].map((corner) => {
                    const revealed = phase.kind === 'penaltyResult';
                    const chosen = revealed && phase.pick === corner;
                    return (
                      <Pressable key={corner} disabled={revealed} onPress={() => shoot(corner)} accessibilityLabel={['◀', '▲', '▶'][corner]}
                        style={({ pressed }) => [styles.corner, {
                          borderColor: chosen ? Arena.gold : Arena.glassBorder,
                          boxShadow: chosen ? glow(Arena.gold, 18, 0.7) : undefined,
                          opacity: pressed ? 0.7 : revealed && !chosen ? 0.55 : 1,
                        }]}>
                        <AText display style={[styles.cornerText, chosen && { color: Arena.gold }]}>
                          {revealed ? `${phase.prizes[corner]}×` : ['◀', '▲', '▶'][corner]}
                        </AText>
                      </Pressable>
                    );
                  })}
                </View>
                {phase.kind === 'penaltyResult' ? (
                  <NeonButton label={t('slot.continue')} onPress={() => round && afterBase(round, phase.pick)} />
                ) : null}
              </Glass>
            </Animated.View>
          ) : null}

          {phase.kind === 'freeIntro' ? (
            <Animated.View entering={ZoomIn.springify()}>
              <Glass strong style={[styles.card, { borderColor: Arena.gold, boxShadow: glow(Arena.gold, 28, 0.45) }]}>
                <AText display style={[styles.cardTitle, { color: Arena.gold }]}>{t('slot.freeSpinsWon', { count: SLOT.freeSpins })}</AText>
                <NeonButton tone="gold" pulse label={t('slot.freeSpinsStart')} onPress={() => playFree(0, 0)} />
              </Glass>
            </Animated.View>
          ) : null}

          {canRefill(balance) && !busy ? <RefillCard /> : null}

          <AText dim style={styles.small}>
            {t('games.houseEdge', { edge: formatPercent(1 - RTP), rtp: Math.round(RTP * 100) })}
          </AText>
        </ScrollView>

        <Glass strong style={[styles.footer, { marginBottom: Math.max(12, insets.bottom) }]}>
          <AText dim style={styles.lineBet}>{t('slot.lineBet', { amount: formatTokens(lineBet) })}</AText>
          <ChipRow values={BETS} value={bet} disabled={busy} onChange={setBet} />
          {problem ? <AText style={styles.problem}>{problem}</AText> : null}
          <NeonButton onPress={spin} disabled={busy} label={t('slot.spin', { amount: formatTokens(bet * TOKEN) })} />
        </Glass>
      </Animated.View>
      <Effects ref={fx} />
      <WinBanner win={win} onDone={() => setWin(null)} />

      <Paytable visible={paytable} lineBet={lineBet} bet={bet * TOKEN} onClose={() => setPaytable(false)} />
    </ArenaBackground>
  );
}

function Paytable({ visible, lineBet, bet, onClose }: { visible: boolean; lineBet: number; bet: number; onClose: () => void }) {
  const { t } = useT();
  const name = (s: SlotSymbol) => t(`slot.symbols.${s}`);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ArenaBackground>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <AText display style={[styles.flex, styles.cardTitle]}>{t('slot.paytable')}</AText>
            <GlassButton label={t('slot.close')} onPress={onClose} />
          </View>
          <AText dim style={styles.small}>{t('slot.paytableIntro', { lineBet: formatTokens(lineBet) })}</AText>
          {LINE_SYMBOLS.map((s) => (
            <Glass key={s} style={styles.payRow}>
              <Image source={SYMBOL_IMAGES[s]} style={styles.payIcon} />
              <AText style={styles.flex}>{name(s)}</AText>
              {PAYTABLE[s].map((m, i) => (
                <View key={i} style={styles.payCell}>
                  <AText dim style={styles.payCount}>{i + 3}×</AText>
                  <AText style={styles.payValue}>{formatTokens(m * lineBet)}</AText>
                </View>
              ))}
            </Glass>
          ))}
          <Glass style={styles.payRow}>
            <Image source={SYMBOL_IMAGES.scatter} style={styles.payIcon} />
            <AText style={[styles.flex, styles.small]}>
              {t('slot.scatterRule', {
                p3: formatTokens(SCATTER_PAY[3] * bet), p4: formatTokens(SCATTER_PAY[4] * bet), p5: formatTokens(SCATTER_PAY[5] * bet),
                count: SLOT.freeSpins,
              })}
            </AText>
          </Glass>
          <Glass style={styles.payRow}>
            <Image source={SYMBOL_IMAGES.bonus} style={styles.payIcon} />
            <AText style={[styles.flex, styles.small]}>
              {t('slot.bonusRule', { prizes: PENALTY_PRIZES.map((p) => formatTokens(p * bet)).join(', ') })}
            </AText>
          </Glass>
          <AText dim style={styles.small}>{t('slot.lines', { count: SLOT.lines })}</AText>
          <AText dim style={styles.small}>{t('slot.honesty')}</AText>
          <AText dim style={styles.small}>
            {t('games.houseEdge', { edge: formatPercent(1 - RTP), rtp: Math.round(RTP * 100) })}
          </AText>
        </ScrollView>
      </ArenaBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freeBadge: {
    alignSelf: 'center', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: Arena.gold,
    backgroundColor: 'rgba(255,200,61,0.12)', boxShadow: glow(Arena.gold, 16, 0.4),
  },
  freeText: { color: Arena.gold, fontSize: 14 },
  status: { minHeight: 56, gap: 4, alignItems: 'center', justifyContent: 'center' },
  spinWin: { color: Arena.gold, fontWeight: '800', fontSize: 16 },
  freeTotal: { color: Arena.textDim, fontWeight: '700' },
  result: { fontFamily: FontFamily.display, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  card: { padding: 16, gap: 14 },
  cardTitle: { fontSize: 22, lineHeight: 30, textAlign: 'center' },
  cardText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  goal: { flexDirection: 'row', gap: 10 },
  corner: {
    flex: 1, height: 76, borderWidth: 2, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cornerText: { fontSize: 20 },
  small: { fontSize: 13, lineHeight: 18 },
  footer: { marginHorizontal: 8, padding: 12, gap: 10, borderRadius: 24 },
  lineBet: { fontSize: 13, textAlign: 'center' },
  problem: { color: Arena.danger, fontSize: 13, fontWeight: '600' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 14 },
  payIcon: { width: 40, height: 40 },
  payCell: { alignItems: 'center', minWidth: 46 },
  payCount: { fontSize: 11 },
  payValue: { fontSize: 13, fontWeight: '800' },
});
