// Plinko: top çivilerden geçip bir cebe düşer; cep çarpanı belirler. Topun yolu bırakılmadan önce güvenli rastgele
// sayılarla çekilip kaydedilir, animasyon o yolu izler. Tek seferde tek top: seri atış ve otomatik oyna yok.
// Ortadaki cepler 1×'in altında öder; atışların çoğunda bahsin bir kısmı kaybedilir ve ekranda bu açıkça yazar.
import { PLINKO_RISKS, PLINKO_ROWS, PLINKO_TABLES, plinkoProbability, plinkoRtp, TOKEN, type PlinkoRisk, type PlinkoRows } from '@oran/games-math';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PlinkoBoard, type PlinkoHandle } from '@/components/plinko-board';
import { RefillCard } from '@/components/refill-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { canRefill, closeInterruptedRounds, finishPlinkoRound, startPlinkoRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { useTheme } from '@/hooks/use-theme';
import { localization, useT } from '@/i18n';
import { formatMultiplier, formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const BETS = [10, 50, 100, 500];

/** Bahsinden azının döndüğü atışların oranı */
const lossChance = (rows: PlinkoRows, risk: PlinkoRisk) =>
  PLINKO_TABLES[rows][risk].reduce((s, m, k) => (m < 1 ? s + plinkoProbability(rows, k) : s), 0);

export default function PlinkoScreen() {
  const { t } = useT();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { balance, recent: { plinko: recent } } = useGames();
  const reality = useRealityCheck('plinko');
  const [rows, setRows] = useState<PlinkoRows>(12);
  const [risk, setRisk] = useState<PlinkoRisk>('low');
  const [bet, setBet] = useState(BETS[1]);
  const [dropping, setDropping] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const [result, setResult] = useState<{ bet: number; payout: number } | null>(null);
  const [odds, setOdds] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const board = useRef<PlinkoHandle>(null);

  useEffect(() => {
    closeInterruptedRounds();
    return () => closeInterruptedRounds();
  }, []);

  useEffect(() => {
    if (!dropping) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [dropping]);

  function drop() {
    setProblem(null);
    const units = bet * TOKEN;
    if (units > balance) return setProblem(t('crash.noBalance'));
    const now = new Date();
    reality.begin(now);
    const { id, path, slot } = startPlinkoRound(units, rows, risk, now);
    setLanded(null);
    setResult(null);
    setDropping(true);
    board.current?.drop(path, () => {
      const r = finishPlinkoRound(id);
      setLanded(slot);
      setResult({ bet: units, payout: r?.payout ?? 0 });
      setDropping(false);
      reality.check();
    });
  }

  function choose(next: { rows?: PlinkoRows; risk?: PlinkoRisk }) {
    if (next.rows) setRows(next.rows);
    if (next.risk) setRisk(next.risk);
    setLanded(null);
    setResult(null);
  }

  const net = result ? result.payout - result.bet : 0;
  const rtp = plinkoRtp(rows, risk);
  const table = PLINKO_TABLES[rows][risk];
  const probability = new Intl.NumberFormat(localization().locale, { style: 'percent', maximumSignificantDigits: 2 });

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ gestureEnabled: !dropping, headerBackVisible: !dropping }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">{t('games.balance', { amount: formatTokens(balance) })}</ThemedText>

        <PlinkoBoard ref={board} width={width - 2 * Spacing.three} rows={rows} risk={risk} landed={landed} />

        <View style={styles.status}>
          {result ? (
            <>
              <ThemedText style={[styles.multiplier, { color: net > 0 ? theme.success : net < 0 ? theme.danger : theme.textSecondary }]}>
                {formatMultiplier(result.payout / result.bet)}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: net > 0 ? theme.success : net < 0 ? theme.danger : theme.textSecondary }}>
                {t('slot.result', { amount: formatTokens(result.payout), net: formatNet(net) })}
              </ThemedText>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">{t('plinko.lossChance', { chance: formatPercent(lossChance(rows, risk)) })}</ThemedText>
          )}
        </View>

        {recent.length > 0 ? (
          <View style={styles.history}>
            <ThemedText type="small" themeColor="textSecondary">{t('plinko.history')}</ThemedText>
            <View style={styles.wrap}>
              {recent.map((m, i) => (
                <ThemedView key={i} type="backgroundElement" style={styles.past}>
                  <ThemedText type="small" style={{ color: m >= 1 ? theme.success : theme.danger }}>{formatMultiplier(m)}</ThemedText>
                </ThemedView>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: odds }} onPress={() => setOdds(!odds)} hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>{t('plinko.odds')}</ThemedText>
        </Pressable>
        {odds ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            {table.slice(0, rows / 2 + 1).map((m, k) => (
              <View key={k} style={styles.oddsRow}>
                <ThemedText type="smallBold" style={[styles.flex, { color: m >= 1 ? theme.success : theme.danger }]}>{formatMultiplier(m)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {probability.format(plinkoProbability(rows, k) * (k === rows / 2 ? 1 : 2))}
                </ThemedText>
              </View>
            ))}
          </ThemedView>
        ) : null}

        {canRefill(balance) && !dropping ? <RefillCard /> : null}

        <ThemedText type="small" themeColor="textSecondary">{t('plinko.honesty')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('games.houseEdge', { edge: formatPercent(1 - rtp), rtp: Math.round(rtp * 100) })}
        </ThemedText>
      </ScrollView>

      <ThemedView type="backgroundElement" style={styles.footer}>
        <View style={styles.row}>
          {PLINKO_ROWS.map((r) => (
            <Chip key={r} label={t('plinko.rows', { count: r })} selected={rows === r} disabled={dropping} onPress={() => choose({ rows: r })} />
          ))}
        </View>
        <View style={styles.row}>
          {PLINKO_RISKS.map((k) => (
            <Chip key={k} label={t(`plinko.${k}`)} selected={risk === k} disabled={dropping} onPress={() => choose({ risk: k })} />
          ))}
        </View>
        <View style={styles.row}>
          {BETS.map((b) => (
            <Chip key={b} label={formatTokens(b * TOKEN)} selected={bet === b} disabled={dropping} onPress={() => setBet(b)} />
          ))}
        </View>
        {problem ? <ThemedText type="small" style={{ color: theme.danger }}>{problem}</ThemedText> : null}
        <Pressable accessibilityRole="button" onPress={drop} disabled={dropping}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed || dropping ? 0.6 : 1 }]}>
          <ThemedText type="smallBold" style={styles.buttonText}>{t('plinko.drop', { amount: formatTokens(bet * TOKEN) })}</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
      style={[styles.chip, { borderColor: selected ? theme.accent : theme.backgroundSelected, backgroundColor: theme.background, opacity: disabled ? 0.5 : 1 }]}>
      <ThemedText type="smallBold" numberOfLines={1} style={{ color: selected ? theme.accent : theme.text }}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.four },
  status: { minHeight: 64, gap: Spacing.one, alignItems: 'center', justifyContent: 'center' },
  multiplier: { fontSize: 32, lineHeight: 40, fontWeight: 800, fontVariant: ['tabular-nums'] },
  history: { gap: Spacing.one },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  past: { borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  oddsRow: { flexDirection: 'row', alignItems: 'center' },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  chip: { flex: 1, borderWidth: 2, borderRadius: Spacing.four, paddingVertical: Spacing.one, paddingHorizontal: Spacing.one, alignItems: 'center' },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 17 },
});
