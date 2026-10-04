// Crash: çarpan yükselir, oyuncu patlamadan önce çekmeye çalışır. Sonuç tur başında güvenli rastgele sayıyla belirlenir
// ve kaydedilir; oyuncunun ne yaptığına göre değişmez. Her turda net sonuç yazar. 15 dakikada bir gerçeklik uyarısı çıkar.
// Görünüm: arena teması, neon eğri, motor sesi (çarpanla perdesi yükselir), patlama ve kazanç kutlaması.
import { CRASH, msToReach, multiplierAt, TOKEN } from '@oran/games-math';
import { BlurMask, Canvas, Circle, Group, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { celebrate, Effects, nextWinId, tierOf, useFlash, WinBanner, type EffectsHandle, type Tier } from '@/components/arena/effects';
import { AText, ArenaBackground, Balance, ChipRow, Glass, GlassButton, NeonButton, useArena, useShake } from '@/components/arena/kit';
import { RefillCard } from '@/components/refill-card';
import { Arena, FontFamily } from '@/constants/arena';
import { canRefill, closeInterruptedRounds, finishCrashRound, MIN_BET, startCrashRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { loop, sfx } from '@/lib/sound';
import { formatMultiplier, formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const CHIPS = [10, 50, 100, 500];
const BOARD_HEIGHT = 270;
const PAD = 14;
const K = CRASH.growthPerSecond;

function scales(ms: number) {
  'worklet';
  return { xMax: Math.max(8000, ms * 1.15), yMax: Math.max(2, Math.exp((K * ms) / 1000) * 1.2) };
}

/** Eğri üzerindeki nokta (tahta koordinatı) */
function pointAt(tt: number, ms: number, width: number) {
  'worklet';
  const { xMax, yMax } = scales(ms);
  const bottom = BOARD_HEIGHT - PAD;
  return {
    x: PAD + (tt / xMax) * (width - 2 * PAD),
    y: bottom - ((Math.exp((K * tt) / 1000) - 1) / (yMax - 1)) * (BOARD_HEIGHT - 2 * PAD - 40),
  };
}

function buildCurve(ms: number, width: number, closed: boolean) {
  'worklet';
  const path = Skia.PathBuilder.Make();
  const steps = 56;
  let last = { x: PAD, y: BOARD_HEIGHT - PAD };
  for (let i = 0; i <= steps; i++) {
    const p = pointAt((ms * i) / steps, ms, width);
    if (i === 0) path.moveTo(p.x, p.y);
    else path.lineTo(p.x, p.y);
    last = p;
  }
  if (closed) path.lineTo(last.x, BOARD_HEIGHT - PAD).lineTo(PAD, BOARD_HEIGHT - PAD).close();
  return path.detach();
}

/** Çarpan büyüdükçe renk: camgöbeği → neon yeşil → altın → mor */
const colorFor = (m: number) => (m < 1.5 ? Arena.cyan : m < 3 ? Arena.neon : m < 10 ? Arena.gold : Arena.violet);

interface Running { id: string; outcome: number; target: number | null; bet: number; startedAt: number; step: number }
type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; bet: number }
  | { kind: 'ended'; outcome: number; bet: number; cashout: number | null; payout: number };

export default function CrashScreen() {
  const { t, decimalSeparator } = useT();
  const { balance, recent: { crash: recent } } = useGames();
  const reality = useRealityCheck('crash');
  useArena(['whoosh', 'tick', 'boom', 'cashout', 'winSmall', 'winBig', 'winMega', 'coin']);
  const [bet, setBet] = useState(100);
  const [targetText, setTargetText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [multiplier, setMultiplier] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [win, setWin] = useState<{ tier: Tier; payout: number; bet: number; id: number } | null>(null);
  const running = useRef<Running | null>(null);
  const frame = useRef<number | null>(null);
  const engine = useRef<ReturnType<typeof loop> | null>(null);
  const fx = useRef<EffectsHandle>(null);
  const root = useRef<View>(null);
  const board = useRef<View>(null);
  const elapsed = useSharedValue(0);
  const { style: shakeStyle, shake } = useShake();
  const { style: flashStyle, flash } = useFlash();

  useEffect(() => {
    closeInterruptedRounds();
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      engine.current?.stop();
      if (running.current) closeInterruptedRounds();
    };
  }, []);

  const isRunning = phase.kind === 'running';
  useEffect(() => {
    if (!isRunning) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [isRunning]);

  /** Tahtadaki bir noktanın efekt katmanındaki yeri */
  function atBoard(x: number, y: number, cb: (p: { x: number; y: number }) => void) {
    board.current?.measureInWindow((bx, by) => root.current?.measureInWindow((rx, ry) => cb({ x: bx - rx + x, y: by - ry + y })));
  }

  function end(cashout: number | null) {
    const r = running.current;
    if (!r) return;
    running.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    engine.current?.stop();
    engine.current = null;
    const result = finishCrashRound(r.id, cashout);
    const won = !!result?.won;
    const shown = won && cashout !== null ? cashout : r.outcome;
    const ms = msToReach(shown);
    elapsed.value = ms;
    setMultiplier(shown);
    const payout = result?.payout ?? 0;
    setPhase({ kind: 'ended', outcome: r.outcome, bet: r.bet, cashout: won ? cashout : null, payout });
    const head = pointAt(ms, ms, width);
    if (won) {
      sfx('cashout');
      const tier = tierOf(r.bet, payout);
      if (tier) {
        atBoard(width / 2, BOARD_HEIGHT * 0.4, (p) => celebrate(fx.current, tier, p, shake));
        setWin({ tier, payout, bet: r.bet, id: nextWinId() });
      }
    } else {
      sfx('boom');
      haptic.error();
      setTimeout(haptic.heavy, 90);
      shake(1);
      flash(0.32);
      atBoard(head.x, head.y, (p) => fx.current?.explode(p.x, p.y));
    }
    reality.check();
  }

  function tick() {
    const r = running.current;
    if (!r) return;
    const ms = performance.now() - r.startedAt;
    const m = multiplierAt(ms);
    // Önce otomatik hedef: hedef patlama noktasına eşitse de kazanır
    if (r.target !== null && r.target <= r.outcome && m >= r.target) return end(r.target);
    if (m > r.outcome) return end(null);
    elapsed.value = ms;
    setMultiplier(m);
    engine.current?.setRate(1 + Math.min(1.5, Math.log(m) * 0.6));
    // Her tam çarpanda (2×, 3×, …) tık ve titreşim
    const step = Math.floor(m);
    if (step > r.step) {
      r.step = step;
      sfx('tick', { rate: Math.min(2, 0.9 + step * 0.08) });
      haptic.select();
    }
    frame.current = requestAnimationFrame(tick);
  }

  function start() {
    setProblem(null);
    setWin(null);
    const units = bet * TOKEN;
    if (!bet || units < MIN_BET) return setProblem(t('crash.minBet', { min: formatTokens(MIN_BET) }));
    if (units > balance) return setProblem(t('crash.noBalance'));
    let target: number | null = null;
    if (targetText.trim()) {
      target = Math.round(Number(targetText.trim().replace(decimalSeparator, '.').replace(',', '.')) * 100) / 100;
      if (!(target >= CRASH.minTarget && target <= CRASH.maxTarget)) {
        return setProblem(t('crash.badTarget', { min: formatMultiplier(CRASH.minTarget), max: formatMultiplier(CRASH.maxTarget) }));
      }
    }
    // Oturum ilk turdan önce başlar: ilk tur da gerçeklik uyarısındaki sayıma girsin
    const now = new Date();
    reality.begin(now);
    const { id, outcome } = startCrashRound(units, target, now);
    running.current = { id, outcome, target, bet: units, startedAt: performance.now(), step: 1 };
    elapsed.value = 0;
    setMultiplier(1);
    setPhase({ kind: 'running', bet: units });
    sfx('whoosh');
    haptic.medium();
    engine.current = loop('engine', 0.45);
    frame.current = requestAnimationFrame(tick);
  }

  function cashOut() {
    const r = running.current;
    if (!r) return;
    const m = multiplierAt(performance.now() - r.startedAt);
    if (m > r.outcome) return end(null);
    if (m < CRASH.minTarget) return;
    end(m);
  }

  const crashed = phase.kind === 'ended' && phase.cashout === null;
  const cashed = phase.kind === 'ended' && phase.cashout !== null;
  const color = crashed ? Arena.danger : cashed ? Arena.gold : colorFor(multiplier);

  const curve = useDerivedValue(() => buildCurve(elapsed.value, width, false), [width]);
  const fill = useDerivedValue(() => buildCurve(elapsed.value, width, true), [width]);
  const headX = useDerivedValue(() => pointAt(elapsed.value, elapsed.value, width).x, [width]);
  const headY = useDerivedValue(() => pointAt(elapsed.value, elapsed.value, width).y, [width]);
  const grid = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    for (let y = PAD; y <= BOARD_HEIGHT - PAD; y += 36) p.moveTo(PAD, y).lineTo(width - PAD, y);
    for (let x = PAD; x <= width - PAD; x += 48) p.moveTo(x, PAD).lineTo(x, BOARD_HEIGHT - PAD);
    return p.detach();
  }, [width]);

  const runningBet = phase.kind === 'running' ? phase.bet : 0;
  const status = phase.kind === 'ended'
    ? crashed
      ? `${t('crash.crashed', { multiplier: formatMultiplier(phase.outcome) })} · ${formatNet(phase.payout - phase.bet)}`
      : `${t('crash.cashedOut', { multiplier: formatMultiplier(phase.cashout!) })} · ${formatNet(phase.payout - phase.bet)}`
    : null;

  return (
    <ArenaBackground>
      <Stack.Screen options={{ gestureEnabled: !isRunning, headerBackVisible: !isRunning }} />
      <View ref={root} style={styles.fill} collapsable={false}>
        <Animated.View style={[styles.fill, shakeStyle]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.topRow}>
              <Balance units={balance} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.history} style={styles.historyScroll}>
                {recent.map((m, i) => (
                  <View key={i} style={[styles.pill, { borderColor: `${colorFor(m)}55`, backgroundColor: `${colorFor(m)}14` }]}>
                    <AText style={[styles.pillText, { color: colorFor(m) }]}>{formatMultiplier(m)}</AText>
                  </View>
                ))}
              </ScrollView>
            </View>

            <Glass style={styles.board}>
              <View ref={board} collapsable={false} style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {width > 0 ? (
                  <Canvas style={{ width, height: BOARD_HEIGHT }}>
                    <Path path={grid} color="rgba(255,255,255,0.05)" style="stroke" strokeWidth={1} />
                    <Path path={fill}>
                      <LinearGradient start={vec(0, 0)} end={vec(0, BOARD_HEIGHT)} colors={[`${color}55`, `${color}00`]} />
                    </Path>
                    <Path path={curve} color={color} style="stroke" strokeWidth={12} opacity={0.35} strokeCap="round" strokeJoin="round">
                      <BlurMask blur={9} style="normal" />
                    </Path>
                    <Path path={curve} color={color} style="stroke" strokeWidth={4} strokeJoin="round" strokeCap="round" />
                    {phase.kind !== 'idle' && !crashed ? (
                      <Group>
                        <Circle cx={headX} cy={headY} r={16} color={color} opacity={0.5}>
                          <BlurMask blur={10} style="normal" />
                        </Circle>
                        <Circle cx={headX} cy={headY} r={6} color="#ffffff" />
                      </Group>
                    ) : null}
                  </Canvas>
                ) : null}
              </View>
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
              <View style={styles.overlay} pointerEvents="none">
                <AText display style={[styles.multiplier, { color, textShadowColor: color }]}>{formatMultiplier(multiplier)}</AText>
                {status ? <AText style={[styles.status, { color }]}>{status}</AText> : null}
                {cashed ? (
                  <AText dim style={styles.small}>{t('crash.roundEnd', { multiplier: formatMultiplier((phase as { outcome: number }).outcome) })}</AText>
                ) : null}
              </View>
            </Glass>

            {canRefill(balance) && !isRunning ? <RefillCard /> : null}

            <Glass style={styles.controls}>
              <View style={styles.row}>
                <AText dim style={styles.label}>{t('crash.bet')}</AText>
                <GlassButton label="½" disabled={isRunning} onPress={() => setBet(Math.max(MIN_BET / TOKEN, Math.floor(bet / 2)))} />
                <TextInput value={String(bet)} editable={!isRunning} keyboardType="number-pad"
                  onChangeText={(v) => { setBet(Number(v.replace(/\D/g, '')) || 0); setProblem(null); }}
                  style={styles.input} />
                <GlassButton label="2×" disabled={isRunning} onPress={() => setBet(bet * 2)} />
              </View>
              <ChipRow values={CHIPS} value={bet} disabled={isRunning} onChange={(v) => { setBet(v); setProblem(null); }} />
              <View style={styles.row}>
                <AText dim style={styles.label}>{t('crash.auto')}</AText>
                <TextInput value={targetText} onChangeText={(v) => { setTargetText(v); setProblem(null); }} editable={!isRunning}
                  placeholder={t('crash.autoOff')} placeholderTextColor={Arena.textFaint} keyboardType="decimal-pad" style={styles.input} />
              </View>
              {problem ? <AText style={styles.problem}>{problem}</AText> : null}
              {isRunning ? (
                <NeonButton tone="gold" pulse sound={null} disabled={multiplier < CRASH.minTarget} onPress={cashOut}
                  label={t('crash.cashout', { amount: formatNet(Math.round(runningBet * multiplier) - runningBet) })} />
              ) : (
                <NeonButton tone="neon" onPress={start} label={t('crash.start', { amount: formatTokens(bet * TOKEN) })} />
              )}
            </Glass>

            <AText dim style={styles.small}>
              {t('games.houseEdge', { edge: formatPercent(CRASH.houseEdge), rtp: Math.round((1 - CRASH.houseEdge) * 100) })}
            </AText>
          </ScrollView>
        </Animated.View>
        <Effects ref={fx} />
        <WinBanner win={win} onDone={() => setWin(null)} />
      </View>
    </ArenaBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyScroll: { flex: 1 },
  history: { gap: 6, paddingRight: 4 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  board: { height: BOARD_HEIGHT, overflow: 'hidden' },
  flash: { backgroundColor: Arena.danger, borderRadius: 22 },
  overlay: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', gap: 4 },
  // Parıltı yazının sınırında kesilmesin diye iç boşluk
  multiplier: { fontSize: 56, lineHeight: 66, paddingHorizontal: 30, paddingVertical: 12, fontVariant: ['tabular-nums'], textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } },
  status: { fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 15 },
  small: { fontSize: 13, lineHeight: 18 },
  controls: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontSize: 14, fontWeight: '600' },
  input: {
    minWidth: 92, height: 40, borderRadius: 12, paddingHorizontal: 12, color: Arena.text, fontFamily: FontFamily.display,
    fontWeight: '700', fontSize: 16, textAlign: 'right', backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: Arena.glassBorder,
  },
  problem: { color: Arena.danger, fontSize: 13, fontWeight: '600' },
});
