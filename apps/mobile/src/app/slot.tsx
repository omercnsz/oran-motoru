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
import { BackHandler, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { celebrate, Effects, nextWinId, tierOf, WinBanner, type EffectsHandle, type Tier } from '@/components/arena/effects';
import { AText, ArenaBackground, Glass, GlassButton, NeonButton, useArena, useShake } from '@/components/arena/kit';
import { RefillCard } from '@/components/refill-card';
import { FreeSpinsCard, Led, Marquee, PenaltyGame, RoundButton, SpinButton, type MarqueeMode } from '@/components/slot/machine';
import { SlotReels, SYMBOL_IMAGES, type ReelsHandle } from '@/components/slot-reels';
import { Arena, FontFamily } from '@/constants/arena';
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
  const [betIndex, setBetIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [round, setRound] = useState<{ id: string; draw: SlotDraw; data: SlotRound; bet: number } | null>(null);
  const [shown, setShown] = useState<SpinResult | null>(null);
  const [freeWon, setFreeWon] = useState(0);
  const [result, setResult] = useState<{ bet: number; payout: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [paytable, setPaytable] = useState(false);
  const [win, setWin] = useState<{ tier: Tier; payout: number; bet: number; id: number } | null>(null);
  const reels = useRef<ReelsHandle>(null);
  const spinSound = useRef<ReturnType<typeof loop> | null>(null);
  const fx = useRef<EffectsHandle>(null);
  const { style: shakeStyle, shake } = useShake();
  const initialStops = useMemo(() => neutralStops(), []);
  const bet = BETS[betIndex];
  const settledSpin = shown && phase.kind !== 'spinning' ? shown : null;
  const highlight = useMemo(() => (settledSpin ? winningCells(settledSpin) : new Set<string>()), [settledSpin]);
  const winLines = useMemo(() => settledSpin?.lineWins.map((w) => w.line) ?? [], [settledSpin]);

  useEffect(() => {
    closeInterruptedRounds();
    return () => {
      spinSound.current?.stop();
      closeInterruptedRounds();
    };
  }, []);

  const busy = phase.kind !== 'idle' && phase.kind !== 'done';
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
      fx.current?.confetti(width / 2, 260, 70);
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
    rollReels(draw.stops, false, () => {
      setShown(r.data.base);
      if (r.data.base.win > 0) sfx('coin');
      if (r.data.prizes) {
        setTimeout(() => {
          setPhase({ kind: 'penalty', prizes: r.data.prizes! });
          sfx('winSmall');
          haptic.success();
        }, 700);
      } else afterBase(r, null);
    });
  }

  function shoot(pick: number) {
    if (!round || phase.kind !== 'penalty') return;
    setPhase({ kind: 'penaltyResult', prizes: phase.prizes, pick });
    setTimeout(() => {
      sfx('cashout');
      haptic.success();
      fx.current?.coins(width / 2, 300, 22, 0.9);
    }, 520);
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
      if (index + 1 < round.data.free.length) setTimeout(() => playFree(index + 1, sum), 800);
      else finish(round, null);
    });
  }

  const lineBet = (bet * TOKEN) / SLOT.lines;
  const spinWin = shown && round ? shown.win * (round.bet / SLOT.lines) * (phase.kind === 'free' ? SLOT.freeSpinMultiplier : 1) : 0;
  const winValue = result ? result.payout : phase.kind === 'free' || freeWon > 0 ? freeWon : spinWin;
  const net = result ? result.payout - result.bet : null;
  const netColor = net === null ? Arena.textDim : net > 0 ? Arena.gold : net < 0 ? Arena.danger : Arena.textDim;
  const freeMode = phase.kind === 'free' || phase.kind === 'freeIntro';
  const marquee: MarqueeMode = phase.kind === 'spinning' ? 'spin' : freeMode ? 'free' : result && result.payout > 0 ? 'win' : 'idle';
  const showPenalty = phase.kind === 'penalty' || phase.kind === 'penaltyResult';

  return (
    <ArenaBackground>
      <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
      {freeMode ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.freeTint]} /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.lights]} />
      <Animated.View style={[styles.fill, shakeStyle]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Marquee mode={marquee} title={t('slot.machine')}
            sub={phase.kind === 'free' ? `${t('slot.freeSpin', { n: phase.index + 1, total: SLOT.freeSpins })}` : undefined} />

          <SlotReels ref={reels} width={width - 32} initialStops={initialStops} highlight={highlight} lines={winLines} />

          <View style={styles.status}>
            {result ? (
              <Animated.Text entering={FadeIn} style={[styles.result, { color: netColor }]}>
                {result.payout > 0
                  ? t('slot.result', { amount: formatTokens(result.payout), net: formatNet(net!) })
                  : t('slot.noWin', { net: formatNet(net!) })}
              </Animated.Text>
            ) : (
              <AText dim style={styles.small}>{t('slot.lineBet', { amount: formatTokens(lineBet) })}</AText>
            )}
          </View>

          {canRefill(balance) && !busy ? <RefillCard /> : null}

          <AText dim style={styles.small}>
            {t('games.houseEdge', { edge: formatPercent(1 - RTP), rtp: Math.round(RTP * 100) })}
          </AText>
        </ScrollView>

        <Glass strong style={[styles.panel, { marginBottom: Math.max(12, insets.bottom) }]}>
          <View style={styles.leds}>
            <Led label={t('slot.balanceLabel')} value={balance} color={Arena.text} format={formatTokens} />
            <Led label={t('slot.winLabel')} value={winValue} color={Arena.gold} format={formatTokens} />
          </View>
          {problem ? <AText style={styles.problem}>{problem}</AText> : null}
          <View style={styles.controls}>
            <RoundButton label="i" disabled={busy} onPress={() => setPaytable(true)} />
            <View style={styles.betBox}>
              <RoundButton label="−" disabled={busy || betIndex === 0} onPress={() => setBetIndex(betIndex - 1)} />
              <View style={styles.betValue}>
                <AText dim style={styles.betLabel}>{t('slot.betLabel')}</AText>
                <AText display style={styles.betText}>{formatTokens(bet * TOKEN)}</AText>
              </View>
              <RoundButton label="+" disabled={busy || betIndex === BETS.length - 1} onPress={() => setBetIndex(betIndex + 1)} />
            </View>
            <SpinButton label={t('slot.spinShort')} onPress={spin} disabled={busy} spinning={phase.kind === 'spinning' || phase.kind === 'free'} />
          </View>
        </Glass>
      </Animated.View>

      {showPenalty || phase.kind === 'freeIntro' ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.overlay]}>
          {showPenalty && round ? (
            <View style={styles.overlayInner}>
              <PenaltyGame prizes={phase.prizes} pick={phase.kind === 'penaltyResult' ? phase.pick : null} bet={round.bet}
                format={formatTokens} title={t('slot.penaltyTitle')} goal={t('slot.goal')}
                hint={phase.kind === 'penalty'
                  ? t('slot.penaltyPick', { prizes: PENALTY_PRIZES.join(', ') })
                  : t('slot.penaltyWon', { amount: formatTokens(phase.prizes[phase.pick] * round.bet) })}
                onShoot={shoot} />
              {phase.kind === 'penaltyResult' ? (
                <Animated.View entering={FadeIn.delay(900)}>
                  <NeonButton tone="gold" label={t('slot.continue')} onPress={() => afterBase(round, phase.pick)} />
                </Animated.View>
              ) : null}
            </View>
          ) : null}
          {phase.kind === 'freeIntro' ? (
            <View style={styles.overlayInner}>
              <FreeSpinsCard title={t('slot.freeSpinsWon', { count: SLOT.freeSpins })} multiplier={`×${SLOT.freeSpinMultiplier}`}
                button={t('slot.freeSpinsStart')} onStart={() => playFree(0, 0)} />
            </View>
          ) : null}
        </Animated.View>
      ) : null}

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
            <AText display style={[styles.fill, styles.payTitle]}>{t('slot.paytable')}</AText>
            <GlassButton label={t('slot.close')} onPress={onClose} />
          </View>
          <AText dim style={styles.small}>{t('slot.paytableIntro', { lineBet: formatTokens(lineBet) })}</AText>
          {LINE_SYMBOLS.map((s) => (
            <Glass key={s} style={styles.payRow}>
              <Image source={SYMBOL_IMAGES[s]} style={styles.payIcon} />
              <AText style={styles.fill}>{name(s)}</AText>
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
            <AText style={[styles.fill, styles.small]}>
              {t('slot.scatterRule', {
                p3: formatTokens(SCATTER_PAY[3] * bet), p4: formatTokens(SCATTER_PAY[4] * bet), p5: formatTokens(SCATTER_PAY[5] * bet),
                count: SLOT.freeSpins,
              })}
            </AText>
          </Glass>
          <Glass style={styles.payRow}>
            <Image source={SYMBOL_IMAGES.bonus} style={styles.payIcon} />
            <AText style={[styles.fill, styles.small]}>
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
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  freeTint: { experimental_backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(178,107,255,0.30) 0%, rgba(178,107,255,0) 70%)' },
  lights: {
    experimental_backgroundImage:
      'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 35%), radial-gradient(circle at 100% 0%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 35%)',
  },
  status: { minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  result: { fontFamily: FontFamily.display, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  small: { fontSize: 13, lineHeight: 18 },
  panel: { marginHorizontal: 8, padding: 12, gap: 12, borderRadius: 26 },
  leds: { flexDirection: 'row', gap: 8 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  betBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  betValue: { alignItems: 'center', minWidth: 64 },
  betLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  betText: { fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
  problem: { color: Arena.danger, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  overlay: { backgroundColor: 'rgba(3,6,14,0.72)', justifyContent: 'center', padding: 16 },
  overlayInner: { gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payTitle: { fontSize: 22, lineHeight: 30 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 14 },
  payIcon: { width: 40, height: 40 },
  payCell: { alignItems: 'center', minWidth: 46 },
  payCount: { fontSize: 11 },
  payValue: { fontSize: 13, fontWeight: '800' },
});
