// Plinko: top çivilerden geçip bir cebe düşer; cep çarpanı belirler. Topun yolu bırakılmadan önce güvenli rastgele
// sayılarla çekilip kaydedilir, animasyon o yolu izler. Tek seferde tek top: seri atış ve otomatik oyna yok.
// Ortadaki cepler 1×'in altında öder; atışların çoğunda bahsin bir kısmı kaybedilir ve ekranda bu açıkça yazar.
import { PLINKO_RISKS, PLINKO_ROWS, PLINKO_TABLES, plinkoProbability, plinkoRtp, TOKEN, type PlinkoRisk, type PlinkoRows } from '@oran/games-math';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { celebrate, Effects, nextWinId, tierOf, WinBanner, type EffectsHandle, type Tier } from '@/components/arena/effects';
import { AText, ArenaBackground, Balance, ChipRow, Glass, GlassButton, NeonButton, useArena, useShake } from '@/components/arena/kit';
import { bucketColor, PlinkoBoard, type PlinkoHandle } from '@/components/plinko-board';
import { RefillCard } from '@/components/refill-card';
import { Arena, FontFamily } from '@/constants/arena';
import { canRefill, closeInterruptedRounds, finishPlinkoRound, startPlinkoRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { localization, useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { sfx } from '@/lib/sound';
import { formatMultiplier, formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const BETS = [10, 50, 100, 500];
const PEGS = ['peg1', 'peg2', 'peg3'] as const;

/** Bahsinden azının döndüğü atışların oranı */
const lossChance = (rows: PlinkoRows, risk: PlinkoRisk) =>
  PLINKO_TABLES[rows][risk].reduce((s, m, k) => (m < 1 ? s + plinkoProbability(rows, k) : s), 0);

export default function PlinkoScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { balance, recent: { plinko: recent } } = useGames();
  const reality = useRealityCheck('plinko');
  useArena(['peg1', 'peg2', 'peg3', 'land', 'coin', 'winSmall', 'winBig', 'winMega']);
  const [rows, setRows] = useState<PlinkoRows>(12);
  const [risk, setRisk] = useState<PlinkoRisk>('low');
  const [bet, setBet] = useState(BETS[1]);
  const [dropping, setDropping] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const [result, setResult] = useState<{ bet: number; payout: number } | null>(null);
  const [odds, setOdds] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [win, setWin] = useState<{ tier: Tier; payout: number; bet: number; id: number } | null>(null);
  const board = useRef<PlinkoHandle>(null);
  const boardBox = useRef<View>(null);
  const root = useRef<View>(null);
  const fx = useRef<EffectsHandle>(null);
  const { style: shakeStyle, shake } = useShake();

  useEffect(() => {
    closeInterruptedRounds();
    return () => closeInterruptedRounds();
  }, []);

  useEffect(() => {
    if (!dropping) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [dropping]);

  const boardWidth = width - 32;

  function drop() {
    setProblem(null);
    setWin(null);
    const units = bet * TOKEN;
    if (units > balance) return setProblem(t('crash.noBalance'));
    const now = new Date();
    reality.begin(now);
    const { id, path, slot } = startPlinkoRound(units, rows, risk, now);
    setLanded(null);
    setResult(null);
    setDropping(true);
    haptic.light();
    board.current?.drop(path, () => {
      const r = finishPlinkoRound(id);
      const payout = r?.payout ?? 0;
      setLanded(slot);
      setResult({ bet: units, payout });
      setDropping(false);
      sfx('land');
      haptic.medium();
      // Cebin efekt katmanındaki yeri
      const s = boardWidth / (rows + 2);
      const x = s / 2 + (slot + 0.5) * s;
      boardBox.current?.measureInWindow((bx, by, _w, bh) => root.current?.measureInWindow((rx, ry) => {
        const at = { x: bx - rx + x, y: by - ry + bh - 14 };
        const tier = tierOf(units, payout);
        if (payout > units && tier) {
          celebrate(fx.current, tier, at, shake);
          setWin({ tier, payout, bet: units, id: nextWinId() });
        } else if (payout > 0) {
          sfx('coin', { volume: 0.6 });
          fx.current?.sparks(at.x, at.y, 16, [bucketColor(payout / units), '#ffffff']);
        }
      }));
      reality.check();
    }, (row) => {
      sfx(PEGS[row % 3], { volume: 0.55, rate: 0.9 + row * 0.02 });
      if (row % 2 === 0) haptic.select();
    });
  }

  function choose(next: { rows?: PlinkoRows; risk?: PlinkoRisk }) {
    if (next.rows) setRows(next.rows);
    if (next.risk) setRisk(next.risk);
    setLanded(null);
    setResult(null);
  }

  const net = result ? result.payout - result.bet : 0;
  const netColor = net > 0 ? Arena.gold : net < 0 ? Arena.danger : Arena.textDim;
  const rtp = plinkoRtp(rows, risk);
  const table = PLINKO_TABLES[rows][risk];
  const probability = new Intl.NumberFormat(localization().locale, { style: 'percent', maximumSignificantDigits: 2 });

  return (
    <ArenaBackground>
      <Stack.Screen options={{ gestureEnabled: !dropping, headerBackVisible: !dropping }} />
      <View ref={root} collapsable={false} style={styles.fill}>
        <Animated.View style={[styles.fill, shakeStyle]}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.topRow}>
              <Balance units={balance} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.history} style={styles.historyScroll}>
                {recent.map((m, i) => (
                  <View key={i} style={[styles.pill, { borderColor: `${bucketColor(m)}88`, backgroundColor: `${bucketColor(m)}22` }]}>
                    <AText style={[styles.pillText, { color: m < 1 ? '#AFC3EA' : bucketColor(m) }]}>{formatMultiplier(m)}</AText>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View ref={boardBox} collapsable={false}>
              <PlinkoBoard ref={board} width={boardWidth} rows={rows} risk={risk} landed={landed} />
            </View>

            <View style={styles.status}>
              {result ? (
                <Animated.View entering={ZoomIn.springify()} style={styles.center}>
                  <AText display style={[styles.multiplier, { color: netColor, textShadowColor: netColor }]}>
                    {formatMultiplier(result.payout / result.bet)}
                  </AText>
                  <AText style={[styles.result, { color: netColor }]}>
                    {t('slot.result', { amount: formatTokens(result.payout), net: formatNet(net) })}
                  </AText>
                </Animated.View>
              ) : (
                <AText dim style={styles.small}>{t('plinko.lossChance', { chance: formatPercent(lossChance(rows, risk)) })}</AText>
              )}
            </View>

            <Pressable accessibilityRole="button" accessibilityState={{ expanded: odds }} onPress={() => setOdds(!odds)} hitSlop={8}>
              <AText style={styles.link}>{t('plinko.odds')}</AText>
            </Pressable>
            {odds ? (
              <Animated.View entering={FadeIn}>
                <Glass style={styles.card}>
                  {table.slice(0, rows / 2 + 1).map((m, k) => (
                    <View key={k} style={styles.oddsRow}>
                      <AText style={[styles.flex, styles.oddsValue, { color: m < 1 ? '#AFC3EA' : bucketColor(m) }]}>{formatMultiplier(m)}</AText>
                      <AText dim style={styles.small}>{probability.format(plinkoProbability(rows, k) * (k === rows / 2 ? 1 : 2))}</AText>
                    </View>
                  ))}
                </Glass>
              </Animated.View>
            ) : null}

            {canRefill(balance) && !dropping ? <RefillCard /> : null}

            <AText dim style={styles.small}>{t('plinko.honesty')}</AText>
            <AText dim style={styles.small}>{t('games.houseEdge', { edge: formatPercent(1 - rtp), rtp: Math.round(rtp * 100) })}</AText>
          </ScrollView>

          <Glass strong style={[styles.footer, { marginBottom: Math.max(12, insets.bottom) }]}>
            <View style={styles.row}>
              {PLINKO_ROWS.map((r) => (
                <GlassButton key={r} style={styles.flex} label={t('plinko.rows', { count: r })} selected={rows === r} disabled={dropping}
                  onPress={() => choose({ rows: r })} />
              ))}
              {PLINKO_RISKS.map((k) => (
                <GlassButton key={k} style={styles.flex} label={t(`plinko.${k}`)} selected={risk === k} disabled={dropping}
                  onPress={() => choose({ risk: k })} />
              ))}
            </View>
            <ChipRow values={BETS} value={bet} disabled={dropping} onChange={setBet} />
            {problem ? <AText style={styles.problem}>{problem}</AText> : null}
            <NeonButton onPress={drop} disabled={dropping} label={t('plinko.drop', { amount: formatTokens(bet * TOKEN) })} />
          </Glass>
        </Animated.View>
        <Effects ref={fx} />
        <WinBanner win={win} onDone={() => setWin(null)} />
      </View>
    </ArenaBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyScroll: { flex: 1 },
  history: { gap: 6 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  status: { minHeight: 76, alignItems: 'center', justifyContent: 'center' },
  multiplier: {
    fontSize: 34, lineHeight: 44, paddingHorizontal: 20, fontVariant: ['tabular-nums'], textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
  },
  result: { fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 15 },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  link: { color: Arena.cyan, fontWeight: '700', fontSize: 14 },
  card: { padding: 14, gap: 6 },
  oddsRow: { flexDirection: 'row', alignItems: 'center' },
  oddsValue: { fontWeight: '800' },
  footer: { marginHorizontal: 8, padding: 12, gap: 10, borderRadius: 24 },
  row: { flexDirection: 'row', gap: 8 },
  problem: { color: Arena.danger, fontSize: 13, fontWeight: '600' },
});
