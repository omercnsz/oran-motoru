// Crash: çarpan yükselir, oyuncu patlamadan önce çekmeye çalışır. Sonuç tur başında güvenli rastgele sayıyla belirlenir
// ve kaydedilir; oyuncunun ne yaptığına göre değişmez. Her turda net sonuç gösterilir, kayıp kazanç gibi kutlanmaz.
// "Hepsini bas" düğmesi yok; 15 dakikada bir gerçeklik uyarısı çıkar.
import { CRASH, msToReach, multiplierAt, TOKEN } from '@oran/games-math';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { RefillCard } from '@/components/refill-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { canRefill, closeInterruptedRounds, finishCrashRound, MIN_BET, startCrashRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { formatMultiplier, formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const QUICK_BETS = [10, 50, 100, 500];
const CANVAS_HEIGHT = 220;
const K = CRASH.growthPerSecond;

function buildCurve(ms: number, width: number, closed: boolean) {
  'worklet';
  const path = Skia.PathBuilder.Make();
  const pad = 12;
  const bottom = CANVAS_HEIGHT - pad;
  const xMax = Math.max(8000, ms * 1.15);
  const yMax = Math.max(2, Math.exp((K * ms) / 1000) * 1.15);
  const steps = 48;
  let x = pad;
  for (let i = 0; i <= steps; i++) {
    const tt = (ms * i) / steps;
    x = pad + (tt / xMax) * (width - 2 * pad);
    const y = bottom - ((Math.exp((K * tt) / 1000) - 1) / (yMax - 1)) * (CANVAS_HEIGHT - 2 * pad);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  if (closed) path.lineTo(x, bottom).lineTo(pad, bottom).close();
  return path.detach();
}

interface Running { id: string; outcome: number; target: number | null; bet: number; startedAt: number }
type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; bet: number }
  | { kind: 'ended'; outcome: number; bet: number; cashout: number | null; payout: number };

export default function CrashScreen() {
  const { t, decimalSeparator } = useT();
  const theme = useTheme();
  const { balance, recent: { crash: recent } } = useGames();
  const reality = useRealityCheck('crash');
  const [betText, setBetText] = useState('100');
  const [targetText, setTargetText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [multiplier, setMultiplier] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const running = useRef<Running | null>(null);
  const frame = useRef<number | null>(null);
  const elapsed = useSharedValue(0);

  // Uygulama tur sırasında kapandıysa o tur kurala göre kapanır; ekrandan çıkınca da aynısı
  useEffect(() => {
    closeInterruptedRounds();
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (running.current) closeInterruptedRounds();
    };
  }, []);

  // Tur sırasında Android geri tuşu turu bozmasın
  const isRunning = phase.kind === 'running';
  useEffect(() => {
    if (!isRunning) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [isRunning]);

  function end(cashout: number | null) {
    const r = running.current;
    if (!r) return;
    running.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const result = finishCrashRound(r.id, cashout);
    const won = !!result?.won;
    const shown = won && cashout !== null ? cashout : r.outcome;
    elapsed.value = msToReach(shown);
    setMultiplier(shown);
    setPhase({ kind: 'ended', outcome: r.outcome, bet: r.bet, cashout: won ? cashout : null, payout: result?.payout ?? 0 });
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
    frame.current = requestAnimationFrame(tick);
  }

  function start() {
    setProblem(null);
    const tokens = Number(betText.replace(/\D/g, ''));
    const bet = tokens * TOKEN;
    if (!tokens || bet < MIN_BET) return setProblem(t('crash.minBet', { min: formatTokens(MIN_BET) }));
    if (bet > balance) return setProblem(t('crash.noBalance'));
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
    const { id, outcome } = startCrashRound(bet, target, now);
    running.current = { id, outcome, target, bet, startedAt: performance.now() };
    elapsed.value = 0;
    setMultiplier(1);
    setPhase({ kind: 'running', bet });
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

  // Eğri: x = zaman, y = çarpan; eksenler büyüdükçe ölçek genişler. fill: eğrinin altı (yarı saydam)
  const curve = useDerivedValue(() => buildCurve(elapsed.value, width, false), [width]);
  const fill = useDerivedValue(() => buildCurve(elapsed.value, width, true), [width]);

  const crashed = phase.kind === 'ended' && phase.cashout === null;

  const cashed = phase.kind === 'ended' && phase.cashout !== null;
  const color = crashed ? theme.danger : cashed ? theme.success : theme.accent;
  const runningBet = phase.kind === 'running' ? phase.bet : 0;
  const status = phase.kind === 'ended'
    ? `${crashed ? t('crash.crashed', { multiplier: formatMultiplier(phase.outcome) }) : t('crash.cashedOut', { multiplier: formatMultiplier(phase.cashout!) })} · ${formatNet(phase.payout - phase.bet)}`
    : null;

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ gestureEnabled: !isRunning, headerBackVisible: !isRunning }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="smallBold">{t('games.balance', { amount: formatTokens(balance) })}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.board} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Canvas style={{ width, height: CANVAS_HEIGHT }}>
              <Path path={fill} color={color} opacity={0.12} />
              <Path path={curve} color={color} style="stroke" strokeWidth={4} strokeJoin="round" strokeCap="round" />
            </Canvas>
          ) : null}
          <View style={styles.overlay} pointerEvents="none">
            <ThemedText style={[styles.multiplier, { color }]}>{formatMultiplier(multiplier)}</ThemedText>
            {status ? <ThemedText type="smallBold" style={{ color }}>{status}</ThemedText> : null}
            {cashed ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('crash.roundEnd', { multiplier: formatMultiplier((phase as { outcome: number }).outcome) })}
              </ThemedText>
            ) : null}
          </View>
        </ThemedView>

        {recent.length > 0 ? (
          <View style={styles.history}>
            <ThemedText type="small" themeColor="textSecondary">{t('crash.history')}</ThemedText>
            <View style={styles.chips}>
              {recent.map((m, i) => (
                <ThemedView key={i} type="backgroundElement" style={styles.chip}>
                  <ThemedText type="small">{formatMultiplier(m)}</ThemedText>
                </ThemedView>
              ))}
            </View>
          </View>
        ) : null}

        {canRefill(balance) && !isRunning ? <RefillCard /> : null}

        <ThemedView type="backgroundElement" style={styles.controls}>
          <View style={styles.field}>
            <ThemedText type="smallBold" style={styles.label}>{t('crash.bet')}</ThemedText>
            <TextInput value={betText} onChangeText={(v) => { setBetText(v); setProblem(null); }} editable={!isRunning}
              keyboardType="number-pad" style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]} />
          </View>
          <View style={styles.chips}>
            {QUICK_BETS.map((b) => (
              <Pressable key={b} disabled={isRunning} onPress={() => { setBetText(String(b)); setProblem(null); }}
                style={[styles.quick, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{formatTokens(b * TOKEN)}</ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={styles.field}>
            <ThemedText type="smallBold" style={styles.label}>{t('crash.auto')}</ThemedText>
            <TextInput value={targetText} onChangeText={(v) => { setTargetText(v); setProblem(null); }} editable={!isRunning}
              placeholder={t('crash.autoOff')} placeholderTextColor={theme.textSecondary} keyboardType="decimal-pad"
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]} />
          </View>
          {problem ? <ThemedText type="small" style={{ color: theme.danger }}>{problem}</ThemedText> : null}

          {isRunning ? (
            <Pressable accessibilityRole="button" onPress={cashOut} disabled={multiplier < CRASH.minTarget}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.success, opacity: pressed || multiplier < CRASH.minTarget ? 0.6 : 1 }]}>
              <ThemedText type="smallBold" style={styles.buttonText}>
                {t('crash.cashout', { amount: formatNet(Math.round(runningBet * multiplier) - runningBet) })}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={start}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}>
              <ThemedText type="smallBold" style={styles.buttonText}>
                {t('crash.start', { amount: formatTokens(Number(betText.replace(/\D/g, '')) * TOKEN) })}
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary">
          {t('games.houseEdge', { edge: formatPercent(CRASH.houseEdge), rtp: Math.round((1 - CRASH.houseEdge) * 100) })}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six * 2 },
  board: { borderRadius: Spacing.three, height: CANVAS_HEIGHT, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, right: 0, left: 0, padding: Spacing.three, gap: Spacing.half },
  multiplier: { fontSize: 48, lineHeight: 56, fontWeight: 800, fontVariant: ['tabular-nums'] },
  history: { gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  controls: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { flex: 1 },
  input: { width: 120, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, fontSize: 18, fontWeight: 600, textAlign: 'right' },
  quick: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 17 },
});
