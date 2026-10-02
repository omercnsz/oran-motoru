// Mines: 5×5 alan, 1–24 mayın. Mayınların yeri tur başında güvenli rastgele sayıyla çekilip kaydedilir; oyuncunun hangi
// kareyi seçtiği sonucu değiştirmez. Her adımda sıradaki karenin güvenli olma ihtimali ve çarpanı açıkça yazar.
// Tur bitince bütün alan (mayınlar ve açılmamış güvenli kareler) gösterilir; net sonuç her zaman gösterilir.
import { MINES, minesMultiplier, minesSurvival, TOKEN } from '@oran/games-math';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { RefillCard } from '@/components/refill-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { canRefill, cashOutMines, closeInterruptedRounds, revealMinesTile, startMinesRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useTheme } from '@/hooks/use-theme';
import { localization, useT } from '@/i18n';
import { formatMultiplier, formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const BETS = [10, 50, 100, 500];
const GAP = Spacing.two;
// Satır satır: kesirli genişlikte (Android) 5. kare alt satıra kaymasın
const ROWS = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r * 5 + c));

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; id: string; bet: number; count: number; revealed: number[] }
  | { kind: 'ended'; bet: number; count: number; revealed: number[]; mines: number[]; payout: number; hit: number | null };

export default function MinesScreen() {
  const { t } = useT();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { balance } = useGames();
  const reality = useRealityCheck('mines');
  const [bet, setBet] = useState(BETS[2]);
  const [count, setCount] = useState(3);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    closeInterruptedRounds();
    return () => closeInterruptedRounds();
  }, []);

  const running = phase.kind === 'running';
  useEffect(() => {
    if (!running) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [running]);

  function start() {
    setProblem(null);
    const units = bet * TOKEN;
    if (units > balance) return setProblem(t('crash.noBalance'));
    const now = new Date();
    reality.begin(now);
    const { id } = startMinesRound(units, count, now);
    setPhase({ kind: 'running', id, bet: units, count, revealed: [] });
  }

  function reveal(tile: number) {
    if (phase.kind !== 'running') return;
    const r = revealMinesTile(phase.id, tile);
    // Tur başka yerden kapandıysa (ör. ekran yeniden yüklendi) ekran takılı kalmasın
    if (!r) return setPhase({ kind: 'idle' });
    const revealed = [...phase.revealed, tile];
    if (r.finished) {
      setPhase({ kind: 'ended', bet: phase.bet, count: phase.count, revealed, ...r.finished, hit: r.mine ? tile : null });
      reality.check();
    } else setPhase({ ...phase, revealed });
  }

  function cashOut() {
    if (phase.kind !== 'running') return;
    const r = cashOutMines(phase.id);
    if (!r) return setPhase({ kind: 'idle' });
    setPhase({ kind: 'ended', bet: phase.bet, count: phase.count, revealed: phase.revealed, ...r, hit: null });
    reality.check();
  }

  const shownCount = phase.kind === 'idle' ? count : phase.count;
  const safe = phase.kind === 'idle' ? 0 : phase.revealed.length - (phase.kind === 'ended' && phase.hit !== null ? 1 : 0);
  const current = safe > 0 ? minesMultiplier(shownCount, safe) : 1;
  // Sıradaki kare: kalan kareler arasında güvenli olma ihtimali
  const left = MINES.tiles - safe;
  const nextChance = (left - shownCount) / left;
  const hasNext = safe < MINES.tiles - shownCount;
  const tile = (width - 2 * Spacing.three - 4 * GAP) / 5;

  let status: { text: string; color: string } | null = null;
  if (phase.kind === 'ended') {
    const net = phase.payout - phase.bet;
    if (phase.hit !== null) status = { text: t('mines.hit', { net: formatNet(net) }), color: theme.danger };
    else if (safe === 0) status = { text: t('mines.refunded'), color: theme.textSecondary };
    else status = {
      text: `${t('crash.cashedOut', { multiplier: formatMultiplier(current) })} · ${formatNet(net)}`,
      color: net > 0 ? theme.success : net < 0 ? theme.danger : theme.textSecondary,
    };
  }

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ gestureEnabled: !running, headerBackVisible: !running }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">{t('games.balance', { amount: formatTokens(balance) })}</ThemedText>

        <View style={styles.grid}>
          {ROWS.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((i) => <Tile key={i} size={tile} index={i} phase={phase} onPress={() => reveal(i)} />)}
            </View>
          ))}
        </View>

        <View style={styles.status}>
          {status ? <ThemedText type="smallBold" style={{ color: status.color }}>{status.text}</ThemedText> : (
            <ThemedText style={[styles.multiplier, { color: safe > 0 ? theme.success : theme.textSecondary }]}>
              {formatMultiplier(current)}
            </ThemedText>
          )}
          {phase.kind !== 'ended' && hasNext ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('mines.next', { chance: formatPercent(nextChance), multiplier: formatMultiplier(minesMultiplier(shownCount, safe + 1)) })}
            </ThemedText>
          ) : null}
          {phase.kind === 'idle' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('mines.allSafe', { chance: formatChance(minesSurvival(shownCount, MINES.tiles - shownCount)) })}
            </ThemedText>
          ) : null}
        </View>

        {canRefill(balance) && !running ? <RefillCard /> : null}

        <ThemedText type="small" themeColor="textSecondary">{t('mines.honesty')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('games.houseEdge', { edge: formatPercent(MINES.houseEdge), rtp: Math.round((1 - MINES.houseEdge) * 100) })}
        </ThemedText>
      </ScrollView>

      <ThemedView type="backgroundElement" style={styles.footer}>
        <View style={styles.row}>
          <ThemedText type="smallBold" style={styles.flex}>{t('mines.count')}</ThemedText>
          <Stepper value={count} min={MINES.minMines} max={MINES.maxMines} disabled={running} onChange={setCount} />
        </View>
        <View style={styles.row}>
          {BETS.map((b) => (
            <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: bet === b }} disabled={running}
              onPress={() => setBet(b)}
              style={[styles.chip, { borderColor: bet === b ? theme.accent : theme.backgroundSelected, backgroundColor: theme.background, opacity: running ? 0.5 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: bet === b ? theme.accent : theme.text }}>{formatTokens(b * TOKEN)}</ThemedText>
            </Pressable>
          ))}
        </View>
        {problem ? <ThemedText type="small" style={{ color: theme.danger }}>{problem}</ThemedText> : null}
        {phase.kind === 'running' ? (
          <Pressable accessibilityRole="button" onPress={cashOut}
            style={({ pressed }) => [styles.button, { backgroundColor: safe > 0 ? theme.success : theme.textSecondary, opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              {safe > 0
                ? t('crash.cashout', { amount: formatNet(Math.round(phase.bet * current) - phase.bet) })
                : t('mines.cancel')}
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={start}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="smallBold" style={styles.buttonText}>{t('crash.start', { amount: formatTokens(bet * TOKEN) })}</ThemedText>
          </Pressable>
        )}
      </ThemedView>
    </ThemedView>
  );
}

/** Küçük ihtimaller "1 / 5.200.300" biçiminde: yüzde olarak 0 görünmesin */
const formatChance = (p: number) =>
  p >= 0.01 ? formatPercent(p) : `1 / ${new Intl.NumberFormat(localization().locale).format(Math.round(1 / p))}`;

function Tile({ size, index, phase, onPress }: { size: number; index: number; phase: Phase; onPress: () => void }) {
  const theme = useTheme();
  const revealed = phase.kind !== 'idle' && phase.revealed.includes(index);
  const ended = phase.kind === 'ended';
  const mine = ended && phase.mines.includes(index);
  const hit = ended && phase.hit === index;
  // Tur bitince açılmamış kareler de soluk gösterilir: alan tamamen ortaya çıkar
  const faded = ended && !revealed;
  const background = hit ? theme.danger : revealed ? theme.backgroundElement : theme.backgroundSelected;
  return (
    <Pressable accessibilityRole="button" disabled={phase.kind !== 'running' || revealed} onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: background, opacity: pressed ? 0.6 : 1 }]}>
      {revealed || ended ? (
        <Animated.View entering={ZoomIn.duration(160)} style={{ opacity: faded ? 0.35 : 1 }}>
          {mine ? <Mine size={size * 0.46} color={hit ? '#ffffff' : theme.danger} /> : <Gem size={size * 0.34} color={theme.success} />}
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

function Gem({ size, color }: { size: number; color: string }) {
  return <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size * 0.18, transform: [{ rotate: '45deg' }] }} />;
}

function Mine({ size, color }: { size: number; color: string }) {
  const spike = { position: 'absolute', backgroundColor: color, borderRadius: 2 } as const;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[spike, { width: size, height: size * 0.12 }]} />
      <View style={[spike, { width: size * 0.12, height: size }]} />
      <View style={[spike, { width: size, height: size * 0.12, transform: [{ rotate: '45deg' }] }]} />
      <View style={[spike, { width: size, height: size * 0.12, transform: [{ rotate: '-45deg' }] }]} />
      <View style={{ width: size * 0.66, height: size * 0.66, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

function Stepper({ value, min, max, disabled, onChange }: {
  value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void;
}) {
  const theme = useTheme();
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  const button = (d: number, label: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || value + d < min || value + d > max}
      onPress={() => step(d)} hitSlop={6}
      style={({ pressed }) => [styles.step, { backgroundColor: theme.background, opacity: disabled || value + d < min || value + d > max ? 0.4 : pressed ? 0.6 : 1 }]}>
      <ThemedText type="subtitle" style={styles.stepText}>{label}</ThemedText>
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {button(-1, '−')}
      <ThemedText type="subtitle" style={styles.stepValue}>{value}</ThemedText>
      {button(1, '+')}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.four },
  grid: { gap: GAP },
  gridRow: { flexDirection: 'row', gap: GAP },
  tile: { flex: 1, aspectRatio: 1, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  status: { minHeight: 72, gap: Spacing.one, alignItems: 'center' },
  multiplier: { fontSize: 32, lineHeight: 40, fontWeight: 800, fontVariant: ['tabular-nums'] },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: { flex: 1, borderWidth: 2, borderRadius: Spacing.four, paddingVertical: Spacing.one, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  step: { width: 40, height: 36, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, lineHeight: 26 },
  stepValue: { minWidth: 36, textAlign: 'center', fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 17 },
});
