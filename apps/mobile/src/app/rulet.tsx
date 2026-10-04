// Avrupa ruleti: tek sıfır, kasa avantajı %2,7. Kazanan sayı dönüş başlamadan güvenli rastgele sayıyla belirlenip
// kaydedilir; çark ve top sadece onu gösterir. Her dönüşte net sonuç yazar (bir bahis tutsa da toplamda kayıp olabilir).
// "Aynı bahsi tekrarla" ve "ikiye katla" yok: her dönüşten sonra masa temizlenir.
import { colorOf, coverage, ROULETTE, TOKEN, type RouletteBet } from '@oran/games-math';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { celebrate, Effects, nextWinId, tierOf, WinBanner, type EffectsHandle, type Tier } from '@/components/arena/effects';
import { AText, ArenaBackground, Balance, ChipMark, ChipRow, Glass, GlassButton, NeonButton, useArena, useShake } from '@/components/arena/kit';
import { RefillCard } from '@/components/refill-card';
import { POCKET_COLORS, RouletteWheel, SPIN_MS, type WheelHandle } from '@/components/roulette-wheel';
import { Arena, FontFamily, glow } from '@/constants/arena';
import { canRefill, closeInterruptedRounds, finishRouletteRound, startRouletteRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { loop, sfx } from '@/lib/sound';
import { formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const CHIPS = [10, 50, 100, 500];
const ROWS = Array.from({ length: 12 }, (_, r) => [3 * r + 1, 3 * r + 2, 3 * r + 3]);

type Phase =
  | { kind: 'betting' }
  | { kind: 'spinning' }
  | { kind: 'result'; outcome: number; staked: number; returned: number; net: number };

export default function RuletScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { balance, recent: { roulette: recent } } = useGames();
  const reality = useRealityCheck('roulette');
  useArena(['whoosh', 'tick', 'lose', 'winSmall', 'winBig', 'winMega', 'coin']);
  const [chip, setChip] = useState(CHIPS[1]);
  const [bets, setBets] = useState<RouletteBet[]>([]); // sırayla; geri almak için
  const [phase, setPhase] = useState<Phase>({ kind: 'betting' });
  const [problem, setProblem] = useState<string | null>(null);
  const [win, setWin] = useState<{ tier: Tier; payout: number; bet: number; id: number } | null>(null);
  const wheel = useRef<WheelHandle>(null);
  const scroll = useRef<ScrollView>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const roundId = useRef<string | null>(null);
  const spinSound = useRef<ReturnType<typeof loop> | null>(null);
  const fx = useRef<EffectsHandle>(null);
  const { style: shakeStyle, shake } = useShake();

  // Uygulama dönüş sırasında kapandıysa dönüş kayıtlı sonuçla kapanır; ekrandan çıkınca da aynısı
  useEffect(() => {
    closeInterruptedRounds();
    return () => {
      timers.current.forEach(clearTimeout);
      spinSound.current?.stop();
      if (roundId.current) closeInterruptedRounds();
    };
  }, []);

  const spinning = phase.kind === 'spinning';
  useEffect(() => {
    if (!spinning) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [spinning]);

  const amounts = new Map<string, number>();
  for (const b of bets) amounts.set(b.key, (amounts.get(b.key) ?? 0) + b.amount);
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const hits = phase.kind === 'result' ? new Set(allKeysCovering(phase.outcome)) : new Set<string>();

  function place(key: string) {
    if (spinning) return;
    const amount = chip * TOKEN;
    if (total + amount > balance) {
      haptic.error();
      return setProblem(t('crash.noBalance'));
    }
    sfx('chip');
    haptic.select();
    setProblem(null);
    if (phase.kind === 'result') setPhase({ kind: 'betting' });
    setBets((b) => [...b, { key, amount }]);
  }

  function spin() {
    if (total === 0) return setProblem(t('roulette.noBets'));
    if (total > balance) return setProblem(t('crash.noBalance'));
    setProblem(null);
    setWin(null);
    const merged = [...amounts].map(([key, amount]) => ({ key, amount }));
    const now = new Date();
    reality.begin(now);
    const { id, outcome } = startRouletteRound(merged, now);
    roundId.current = id;
    setPhase({ kind: 'spinning' });
    scroll.current?.scrollTo({ y: 0, animated: true });
    wheel.current?.spinTo(outcome);
    sfx('whoosh');
    haptic.medium();
    // Top döner: tıkırtı yavaşlayarak azalır, sonunda cebe zıplar
    const rolling = loop('spinloop', 0.55);
    spinSound.current = rolling;
    const later = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
    for (let k = 1; k <= 8; k++) later((SPIN_MS * 0.66 * k) / 8, () => rolling.setRate(Math.max(0.35, 1 - k * 0.08)));
    later(SPIN_MS * 0.66, () => { rolling.stop(); spinSound.current = null; });
    [0.7, 0.8, 0.88, 0.94].forEach((f, k) => later(SPIN_MS * f, () => { sfx('tick', { volume: 1 - k * 0.15 }); haptic.light(); }));
    later(SPIN_MS + 300, () => {
      timers.current = [];
      roundId.current = null;
      const result = finishRouletteRound(id);
      setBets([]);
      setPhase(result ? { kind: 'result', outcome, ...result } : { kind: 'betting' });
      if (result && result.returned > 0) {
        const tier = tierOf(result.staked, result.returned);
        if (tier) {
          celebrate(fx.current, tier, { x: width / 2, y: 200 }, shake);
          // Afiş sadece bahisten fazlası dönünce; azı dönünce kısa kutlama
          if (result.returned > result.staked) setWin({ tier, payout: result.returned, bet: result.staked, id: nextWinId() });
        }
      } else if (result) {
        sfx('lose');
        haptic.error();
      }
      reality.check();
    });
  }

  const wheelSize = Math.min(290, width - 64);
  const netColor = phase.kind === 'result' ? (phase.net > 0 ? Arena.neon : phase.net < 0 ? Arena.danger : Arena.textDim) : Arena.text;

  const cell = (key: string, label: string, color?: string, flex = 1) => (
    <BetCell key={key} label={label} color={color} flex={flex} amount={amounts.get(key)} hit={hits.has(key)}
      disabled={spinning} onPress={() => place(key)} />
  );

  return (
    <ArenaBackground>
      <Stack.Screen options={{ gestureEnabled: !spinning, headerBackVisible: !spinning }} />
      <Animated.View style={[styles.fill, shakeStyle]}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <Balance units={balance} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.history} style={styles.historyScroll}>
              {recent.map((n, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: POCKET_COLORS[colorOf(n)] }]}>
                  <AText style={styles.dotText}>{n}</AText>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.wheelArea}>
            <View style={[styles.wheelGlow, { width: wheelSize, height: wheelSize, borderRadius: wheelSize / 2 }]}>
              <RouletteWheel ref={wheel} size={wheelSize} />
            </View>
            <View style={styles.result}>
              {phase.kind === 'result' ? (
                <>
                  <Animated.View entering={ZoomIn.springify()} style={[styles.ball, {
                    backgroundColor: POCKET_COLORS[colorOf(phase.outcome)], boxShadow: glow(phase.net > 0 ? Arena.gold : '#ffffff', 18, 0.45),
                  }]}>
                    <AText display style={styles.ballText}>{phase.outcome}</AText>
                  </Animated.View>
                  <AText style={[styles.net, { color: netColor }]}>
                    {t('roulette.net', { staked: formatTokens(phase.staked), returned: formatTokens(phase.returned), net: formatNet(phase.net) })}
                  </AText>
                </>
              ) : null}
            </View>
          </View>

          {canRefill(balance) && !spinning ? <RefillCard /> : null}

          <Glass style={styles.table}>
            <View style={styles.row}>{cell('n:0', '0', POCKET_COLORS.green)}</View>
            {ROWS.map((row) => (
              <View key={row[0]} style={styles.row}>
                {row.map((n) => cell(`n:${n}`, String(n), POCKET_COLORS[colorOf(n)]))}
              </View>
            ))}
            <View style={styles.row}>{[1, 2, 3].map((c) => cell(`column:${c}`, '2:1'))}</View>
            <View style={styles.row}>{[1, 2, 3].map((d) => cell(`dozen:${d}`, `${12 * d - 11}–${12 * d}`))}</View>
            <View style={styles.row}>
              {cell('low', '1–18')}
              {cell('even', t('roulette.even'))}
              {cell('red', t('roulette.red'), POCKET_COLORS.red)}
            </View>
            <View style={styles.row}>
              {cell('black', t('roulette.black'), POCKET_COLORS.black)}
              {cell('odd', t('roulette.odd'))}
              {cell('high', '19–36')}
            </View>
          </Glass>

          <AText dim style={styles.small}>
            {t('games.houseEdge', { edge: formatPercent(ROULETTE.houseEdge), rtp: Math.round((1 - ROULETTE.houseEdge) * 100) })}
          </AText>
        </ScrollView>

        <Glass strong style={[styles.footer, { marginBottom: Math.max(12, insets.bottom) }]}>
          <ChipRow values={CHIPS} value={chip} onChange={setChip} />
          <View style={styles.footerRow}>
            <AText style={styles.total}>{t('roulette.total', { amount: formatTokens(total) })}</AText>
            <GlassButton label={t('roulette.undo')} disabled={spinning || bets.length === 0} onPress={() => setBets((b) => b.slice(0, -1))} />
            <GlassButton label={t('roulette.clear')} disabled={spinning || bets.length === 0} onPress={() => setBets([])} />
          </View>
          {problem ? <AText style={styles.problem}>{problem}</AText> : null}
          <NeonButton onPress={spin} disabled={spinning}
            label={total > 0 ? t('roulette.spin', { amount: formatTokens(total) }) : t('roulette.tapHint')} />
        </Glass>
      </Animated.View>
      <Effects ref={fx} />
      <WinBanner win={win} onDone={() => setWin(null)} />
    </ArenaBackground>
  );
}

/** Kazanan sayının tuttuğu bütün bahis alanları (sonuçtan sonra masada vurgulanır) */
function allKeysCovering(n: number): string[] {
  const keys = ['red', 'black', 'odd', 'even', 'low', 'high', 'dozen:1', 'dozen:2', 'dozen:3', 'column:1', 'column:2', 'column:3'];
  return [`n:${n}`, ...keys.filter((k) => coverage(k).includes(n))];
}

function BetCell({ label, color, flex, amount, hit, disabled, onPress }: {
  label: string; color?: string; flex: number; amount?: number; hit: boolean; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={amount ? `${label}, ${formatTokens(amount)}` : label}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.cell, {
        flex,
        backgroundColor: color ?? 'rgba(255,255,255,0.06)',
        borderColor: hit ? Arena.gold : 'rgba(255,255,255,0.08)',
        boxShadow: hit ? glow(Arena.gold, 12, 0.7) : undefined,
        opacity: pressed ? 0.7 : 1,
      }]}>
      <AText style={styles.cellText}>{label}</AText>
      {amount ? (
        <Animated.View entering={ZoomIn.duration(160)} style={styles.mark}>
          <ChipMark units={amount} />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyScroll: { flex: 1 },
  history: { gap: 5, alignItems: 'center' },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  dotText: { fontSize: 11, fontWeight: '800' },
  wheelArea: { alignItems: 'center', gap: 12 },
  wheelGlow: { boxShadow: `${glow(Arena.gold, 40, 0.25)}, 0px 18px 40px rgba(0,0,0,0.6)` },
  result: { alignItems: 'center', gap: 8, minHeight: 92 },
  ball: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffffaa' },
  ballText: { fontSize: 24, lineHeight: 30 },
  net: { fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  table: { padding: 8, gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  cell: { minHeight: 40, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontWeight: '800', fontSize: 14 },
  mark: { position: 'absolute', right: 3, top: 3 },
  small: { fontSize: 13, lineHeight: 18 },
  footer: { marginHorizontal: 8, marginBottom: 12, padding: 12, gap: 10, borderRadius: 24 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  total: { flex: 1, fontWeight: '700' },
  problem: { color: Arena.danger, fontSize: 13, fontWeight: '600' },
});
