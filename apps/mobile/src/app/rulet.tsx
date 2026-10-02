// Avrupa ruleti: tek sıfır, kasa avantajı %2,7. Kazanan sayı dönüş başlamadan güvenli rastgele sayıyla belirlenip
// kaydedilir; çark sadece onu gösterir. Her dönüşte net sonuç gösterilir (bir bahis tutsa da toplamda kayıp olabilir).
// "Aynı bahsi tekrarla" ve "ikiye katla" düğmeleri yok: her dönüşten sonra masa temizlenir.
import { colorOf, coverage, ROULETTE, TOKEN, type RouletteBet } from '@oran/games-math';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { RefillCard } from '@/components/refill-card';
import { POCKET_COLORS, RouletteWheel, SPIN_MS, type WheelHandle } from '@/components/roulette-wheel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { canRefill, closeInterruptedRounds, finishRouletteRound, startRouletteRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const CHIPS = [10, 50, 100, 500];
const ROWS = Array.from({ length: 12 }, (_, r) => [3 * r + 1, 3 * r + 2, 3 * r + 3]);

type Phase =
  | { kind: 'betting' }
  | { kind: 'spinning' }
  | { kind: 'result'; outcome: number; staked: number; returned: number; net: number };

export default function RuletScreen() {
  const { t } = useT();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { balance, recent: { roulette: recent } } = useGames();
  const reality = useRealityCheck('roulette');
  const [chip, setChip] = useState(CHIPS[1]);
  const [bets, setBets] = useState<RouletteBet[]>([]); // sırayla; geri almak için
  const [phase, setPhase] = useState<Phase>({ kind: 'betting' });
  const [problem, setProblem] = useState<string | null>(null);
  const wheel = useRef<WheelHandle>(null);
  const scroll = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundId = useRef<string | null>(null);

  // Uygulama dönüş sırasında kapandıysa dönüş kayıtlı sonuçla kapanır; ekrandan çıkınca da aynısı
  useEffect(() => {
    closeInterruptedRounds();
    return () => {
      if (timer.current) clearTimeout(timer.current);
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
    if (total + amount > balance) return setProblem(t('crash.noBalance'));
    setProblem(null);
    if (phase.kind === 'result') setPhase({ kind: 'betting' });
    setBets((b) => [...b, { key, amount }]);
  }

  function spin() {
    if (total === 0) return setProblem(t('roulette.noBets'));
    if (total > balance) return setProblem(t('crash.noBalance'));
    setProblem(null);
    const merged = [...amounts].map(([key, amount]) => ({ key, amount }));
    const now = new Date();
    reality.begin(now);
    const { id, outcome } = startRouletteRound(merged, now);
    roundId.current = id;
    setPhase({ kind: 'spinning' });
    scroll.current?.scrollTo({ y: 0, animated: true });
    wheel.current?.spinTo(outcome);
    timer.current = setTimeout(() => {
      timer.current = null;
      roundId.current = null;
      const result = finishRouletteRound(id);
      setBets([]);
      setPhase(result ? { kind: 'result', outcome, ...result } : { kind: 'betting' });
      reality.check();
    }, SPIN_MS + 300);
  }

  const wheelSize = Math.min(260, width - 2 * Spacing.three);
  const resultColor = phase.kind === 'result'
    ? phase.net > 0 ? theme.success : phase.net < 0 ? theme.danger : theme.textSecondary
    : theme.text;

  const cell = (key: string, label: string, color?: string, flex = 1) => (
    <BetCell key={key} label={label} color={color} flex={flex} amount={amounts.get(key)} hit={hits.has(key)}
      disabled={spinning} onPress={() => place(key)} />
  );

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ gestureEnabled: !spinning, headerBackVisible: !spinning }} />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">{t('games.balance', { amount: formatTokens(balance) })}</ThemedText>

        <View style={styles.wheelArea}>
          <RouletteWheel ref={wheel} size={wheelSize} />
          {phase.kind === 'result' ? (
            <View style={styles.result}>
              <View style={[styles.ball, { backgroundColor: POCKET_COLORS[colorOf(phase.outcome)] }]}>
                <ThemedText style={styles.ballText}>{phase.outcome}</ThemedText>
              </View>
              <ThemedText type="smallBold" style={{ color: resultColor }}>
                {t('roulette.net', { staked: formatTokens(phase.staked), returned: formatTokens(phase.returned), net: formatNet(phase.net) })}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {recent.length > 0 ? (
          <View style={styles.history}>
            <ThemedText type="small" themeColor="textSecondary">{t('roulette.history')}</ThemedText>
            <View style={styles.historyRow}>
              {recent.map((n, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: POCKET_COLORS[colorOf(n)] }]}>
                  <ThemedText style={styles.dotText}>{n}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {canRefill(balance) && !spinning ? <RefillCard /> : null}

        <View style={styles.board}>
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
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {t('games.houseEdge', { edge: formatPercent(ROULETTE.houseEdge), rtp: Math.round((1 - ROULETTE.houseEdge) * 100) })}
        </ThemedText>
      </ScrollView>

      <ThemedView type="backgroundElement" style={styles.footer}>
        <View style={styles.footerRow}>
          {CHIPS.map((c) => (
            <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: chip === c }}
              accessibilityLabel={`${t('roulette.chip')} ${formatTokens(c * TOKEN)}`} onPress={() => setChip(c)}
              style={[styles.chip, { borderColor: chip === c ? theme.accent : theme.backgroundSelected, backgroundColor: theme.background }]}>
              <ThemedText type="smallBold" style={{ color: chip === c ? theme.accent : theme.text }}>{formatTokens(c * TOKEN)}</ThemedText>
            </Pressable>
          ))}
        </View>
        <View style={styles.footerRow}>
          <ThemedText type="small" style={styles.total}>{t('roulette.total', { amount: formatTokens(total) })}</ThemedText>
          <Pressable disabled={spinning || bets.length === 0} onPress={() => setBets((b) => b.slice(0, -1))} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent, opacity: spinning || bets.length === 0 ? 0.4 : 1 }}>{t('roulette.undo')}</ThemedText>
          </Pressable>
          <Pressable disabled={spinning || bets.length === 0} onPress={() => setBets([])} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent, opacity: spinning || bets.length === 0 ? 0.4 : 1 }}>{t('roulette.clear')}</ThemedText>
          </Pressable>
        </View>
        {problem ? <ThemedText type="small" style={{ color: theme.danger }}>{problem}</ThemedText> : null}
        <Pressable accessibilityRole="button" onPress={spin} disabled={spinning}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed || spinning ? 0.6 : 1 }]}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            {total > 0 ? t('roulette.spin', { amount: formatTokens(total) }) : t('roulette.tapHint')}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
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
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={amount ? `${label}, ${formatTokens(amount)}` : label}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.cell, {
        flex,
        backgroundColor: color ?? theme.backgroundElement,
        borderColor: hit ? '#F2C14E' : 'transparent',
        opacity: pressed ? 0.7 : 1,
      }]}>
      <ThemedText type="smallBold" style={{ color: color ? '#ffffff' : theme.text }}>{label}</ThemedText>
      {amount ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.badgeText}>{formatTokens(amount)}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.four },
  wheelArea: { alignItems: 'center', gap: Spacing.two },
  result: { alignItems: 'center', gap: Spacing.two },
  ball: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ballText: { color: '#ffffff', fontSize: 24, lineHeight: 30, fontWeight: 800 },
  history: { gap: Spacing.one },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#ffffff', fontSize: 12, lineHeight: 16, fontWeight: 700 },
  board: { gap: 3 },
  row: { flexDirection: 'row', gap: 3 },
  cell: { minHeight: 36, borderRadius: Spacing.one, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 4, top: 4, borderRadius: 9, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' },
  badgeText: { color: '#ffffff', fontSize: 11, lineHeight: 16, fontWeight: 700 },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.two },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  chip: { flex: 1, borderWidth: 2, borderRadius: Spacing.four, paddingVertical: Spacing.one, alignItems: 'center' },
  total: { flex: 1 },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 17 },
});
