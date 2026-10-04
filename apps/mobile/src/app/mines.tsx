// Mines: 5×5 alan, 1–24 mayın. Mayınların yeri tur başında güvenli rastgele sayıyla çekilip kaydedilir; oyuncunun hangi
// kareyi seçtiği sonucu değiştirmez. Her adımda sıradaki karenin güvenli olma ihtimali ve çarpanı açıkça yazar.
// Tur bitince bütün alan (mayınlar ve açılmamış güvenli kareler) gösterilir; net sonuç her zaman yazar.
import { MINES, minesMultiplier, minesSurvival, TOKEN } from '@oran/games-math';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { celebrate, Effects, nextWinId, tierOf, useFlash, WinBanner, type EffectsHandle, type Tier } from '@/components/arena/effects';
import { AText, ArenaBackground, Balance, ChipRow, Glass, GlassButton, NeonButton, useArena, useShake } from '@/components/arena/kit';
import { RefillCard } from '@/components/refill-card';
import { Arena, FontFamily, glow } from '@/constants/arena';
import { canRefill, cashOutMines, closeInterruptedRounds, revealMinesTile, startMinesRound } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { localization, useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { sfx, type Sfx } from '@/lib/sound';
import { formatMultiplier, formatNet, formatPercent, formatTokens } from '@/lib/tokens';

const BETS = [10, 50, 100, 500];
const GAP = 8;
// Satır satır: kesirli genişlikte (Android) 5. kare alt satıra kaymasın
const ROWS = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r * 5 + c));

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; id: string; bet: number; count: number; revealed: number[] }
  | { kind: 'ended'; bet: number; count: number; revealed: number[]; mines: number[]; payout: number; hit: number | null };

export default function MinesScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { balance } = useGames();
  const reality = useRealityCheck('mines');
  useArena(['gem1', 'gem2', 'gem3', 'gem4', 'gem5', 'gem6', 'gem7', 'gem8', 'boom', 'cashout', 'winSmall', 'winBig', 'winMega', 'coin']);
  const [bet, setBet] = useState(BETS[2]);
  const [count, setCount] = useState(3);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [problem, setProblem] = useState<string | null>(null);
  const [win, setWin] = useState<{ tier: Tier; payout: number; bet: number; id: number } | null>(null);
  const fx = useRef<EffectsHandle>(null);
  const root = useRef<View>(null);
  const grid = useRef<View>(null);
  const { style: shakeStyle, shake } = useShake();
  const { style: flashStyle, flash } = useFlash();

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

  const tile = (width - 32 - 4 * GAP) / 5;
  /** Karenin efekt katmanındaki merkezi */
  function atTile(index: number, cb: (p: { x: number; y: number }) => void) {
    const x = (index % 5) * (tile + GAP) + tile / 2, y = Math.floor(index / 5) * (tile + GAP) + tile / 2;
    grid.current?.measureInWindow((gx, gy) => root.current?.measureInWindow((rx, ry) => cb({ x: gx - rx + x, y: gy - ry + y })));
  }

  function start() {
    setProblem(null);
    setWin(null);
    const units = bet * TOKEN;
    if (units > balance) return setProblem(t('crash.noBalance'));
    const now = new Date();
    reality.begin(now);
    const { id } = startMinesRound(units, count, now);
    setPhase({ kind: 'running', id, bet: units, count, revealed: [] });
    haptic.medium();
  }

  function settle(next: Extract<Phase, { kind: 'ended' }>) {
    setPhase(next);
    if (next.hit !== null) {
      sfx('boom');
      haptic.error();
      setTimeout(haptic.heavy, 90);
      shake(1);
      flash(0.3);
      atTile(next.hit, (p) => fx.current?.explode(p.x, p.y));
    } else if (next.payout > 0) {
      const tier = tierOf(next.bet, next.payout);
      sfx('cashout');
      if (tier && next.revealed.length > 0) {
        celebrate(fx.current, tier, { x: width / 2, y: 240 }, shake);
        setWin({ tier, payout: next.payout, bet: next.bet, id: nextWinId() });
      }
    }
    reality.check();
  }

  function reveal(index: number) {
    if (phase.kind !== 'running') return;
    const r = revealMinesTile(phase.id, index);
    // Tur başka yerden kapandıysa (ör. ekran yeniden yüklendi) ekran takılı kalmasın
    if (!r) return setPhase({ kind: 'idle' });
    const revealed = [...phase.revealed, index];
    if (!r.mine) {
      sfx(`gem${Math.min(8, r.safe)}` as Sfx);
      haptic.light();
      atTile(index, (p) => fx.current?.sparks(p.x, p.y, 14, [Arena.neon, Arena.cyan, '#ffffff']));
    }
    if (r.finished) settle({ kind: 'ended', bet: phase.bet, count: phase.count, revealed, ...r.finished, hit: r.mine ? index : null });
    else setPhase({ ...phase, revealed });
  }

  function cashOut() {
    if (phase.kind !== 'running') return;
    const r = cashOutMines(phase.id);
    if (!r) return setPhase({ kind: 'idle' });
    settle({ kind: 'ended', bet: phase.bet, count: phase.count, revealed: phase.revealed, ...r, hit: null });
  }

  const shownCount = phase.kind === 'idle' ? count : phase.count;
  const safe = phase.kind === 'idle' ? 0 : phase.revealed.length - (phase.kind === 'ended' && phase.hit !== null ? 1 : 0);
  const current = safe > 0 ? minesMultiplier(shownCount, safe) : 1;
  // Sıradaki kare: kalan kareler arasında güvenli olma ihtimali
  const left = MINES.tiles - safe;
  const nextChance = (left - shownCount) / left;
  const hasNext = safe < MINES.tiles - shownCount;

  let status: { text: string; color: string } | null = null;
  if (phase.kind === 'ended') {
    const net = phase.payout - phase.bet;
    if (phase.hit !== null) status = { text: t('mines.hit', { net: formatNet(net) }), color: Arena.danger };
    else if (safe === 0) status = { text: t('mines.refunded'), color: Arena.textDim };
    else status = {
      text: `${t('crash.cashedOut', { multiplier: formatMultiplier(current) })} · ${formatNet(net)}`,
      color: net > 0 ? Arena.gold : net < 0 ? Arena.danger : Arena.textDim,
    };
  }
  const multiplierColor = safe === 0 ? Arena.textDim : current >= 5 ? Arena.gold : Arena.neon;

  return (
    <ArenaBackground>
      <Stack.Screen options={{ gestureEnabled: !running, headerBackVisible: !running }} />
      <View ref={root} collapsable={false} style={styles.fill}>
        <Animated.View style={[styles.fill, shakeStyle]}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.topRow}>
              <Balance units={balance} />
              <AText display style={[styles.multiplier, { color: multiplierColor, textShadowColor: multiplierColor }]}>
                {formatMultiplier(current)}
              </AText>
            </View>

            <View style={styles.head}>
              {status ? <AText style={[styles.status, { color: status.color }]}>{status.text}</AText> : null}
              {phase.kind !== 'ended' && hasNext ? (
                <AText dim style={styles.small}>
                  {t('mines.next', { chance: formatPercent(nextChance), multiplier: formatMultiplier(minesMultiplier(shownCount, safe + 1)) })}
                </AText>
              ) : null}
            </View>

            <View ref={grid} collapsable={false} style={styles.grid}>
              {ROWS.map((row, r) => (
                <View key={r} style={styles.gridRow}>
                  {row.map((i) => <Tile key={i} size={tile} index={i} phase={phase} onPress={() => reveal(i)} />)}
                </View>
              ))}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
            </View>

            {canRefill(balance) && !running ? <RefillCard /> : null}

            <AText dim style={styles.small}>
              {t('mines.allSafe', { chance: formatChance(minesSurvival(shownCount, MINES.tiles - shownCount)) })}
            </AText>
            <AText dim style={styles.small}>{t('mines.honesty')}</AText>
            <AText dim style={styles.small}>
              {t('games.houseEdge', { edge: formatPercent(MINES.houseEdge), rtp: Math.round((1 - MINES.houseEdge) * 100) })}
            </AText>
          </ScrollView>

          <Glass strong style={[styles.footer, { marginBottom: Math.max(12, insets.bottom) }]}>
            <View style={styles.row}>
              <AText style={styles.label}>{t('mines.count')}</AText>
              <GlassButton label="−" disabled={running || count <= MINES.minMines} onPress={() => setCount(count - 1)} />
              <AText display style={styles.count}>{count}</AText>
              <GlassButton label="+" disabled={running || count >= MINES.maxMines} onPress={() => setCount(count + 1)} />
            </View>
            <ChipRow values={BETS} value={bet} disabled={running} onChange={setBet} />
            {problem ? <AText style={styles.problem}>{problem}</AText> : null}
            {phase.kind === 'running' ? (
              safe > 0 ? (
                <NeonButton tone="gold" pulse sound={null} onPress={cashOut}
                  label={t('crash.cashout', { amount: formatNet(Math.round(phase.bet * current) - phase.bet) })} />
              ) : (
                <NeonButton tone="glass" onPress={cashOut} label={t('mines.cancel')} />
              )
            ) : (
              <NeonButton onPress={start} label={t('crash.start', { amount: formatTokens(bet * TOKEN) })} />
            )}
          </Glass>
        </Animated.View>
        <Effects ref={fx} />
        <WinBanner win={win} onDone={() => setWin(null)} />
      </View>
    </ArenaBackground>
  );
}

/** Küçük ihtimaller "1 / 5.200.300" biçiminde: yüzde olarak 0 görünmesin */
const formatChance = (p: number) =>
  p >= 0.01 ? formatPercent(p) : `1 / ${new Intl.NumberFormat(localization().locale).format(Math.round(1 / p))}`;

function Tile({ size, index, phase, onPress }: { size: number; index: number; phase: Phase; onPress: () => void }) {
  const revealed = phase.kind !== 'idle' && phase.revealed.includes(index);
  const ended = phase.kind === 'ended';
  const mine = ended && phase.mines.includes(index);
  const hit = ended && phase.hit === index;
  // Tur bitince açılmamış kareler de soluk gösterilir: alan tamamen ortaya çıkar
  const faded = ended && !revealed;
  const active = phase.kind === 'running' && !revealed;
  return (
    <Pressable accessibilityRole="button" disabled={!active} onPress={onPress}
      style={({ pressed }) => [styles.tile, {
        experimental_backgroundImage: hit
          ? `linear-gradient(135deg, ${Arena.danger} 0%, ${Arena.dangerDeep} 100%)`
          : revealed
            ? 'linear-gradient(135deg, rgba(43,255,168,0.16) 0%, rgba(61,217,255,0.08) 100%)'
            : active
              ? 'linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)'
              : 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
        borderColor: hit ? Arena.danger : revealed ? 'rgba(43,255,168,0.5)' : Arena.glassBorder,
        boxShadow: hit ? glow(Arena.danger, 22, 0.8) : revealed ? glow(Arena.neon, 14, 0.35) : undefined,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      }]}>
      {revealed || ended ? (
        <Animated.View entering={ZoomIn.springify().damping(12)} style={{ opacity: faded ? 0.35 : 1 }}>
          {mine ? <Mine size={size * 0.5} light={hit} /> : <Gem size={size * 0.42} />}
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

function Gem({ size }: { size: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.16, transform: [{ rotate: '45deg' }],
      experimental_backgroundImage: `linear-gradient(135deg, #B8FFE4 0%, ${Arena.neon} 45%, ${Arena.cyan} 100%)`,
      boxShadow: glow(Arena.neon, 14, 0.8), alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.08, backgroundColor: 'rgba(255,255,255,0.55)' }} />
    </View>
  );
}

function Mine({ size, light }: { size: number; light: boolean }) {
  const color = light ? '#ffffff' : Arena.danger;
  const spike = { position: 'absolute', backgroundColor: color, borderRadius: 2 } as const;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[spike, { width: size, height: size * 0.13 }]} />
      <View style={[spike, { width: size * 0.13, height: size }]} />
      <View style={[spike, { width: size, height: size * 0.13, transform: [{ rotate: '45deg' }] }]} />
      <View style={[spike, { width: size, height: size * 0.13, transform: [{ rotate: '-45deg' }] }]} />
      <View style={{
        width: size * 0.68, height: size * 0.68, borderRadius: size, backgroundColor: light ? '#1A0A10' : '#2A0E18',
        borderWidth: 2, borderColor: color, boxShadow: glow(Arena.danger, 12, 0.7),
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  head: { alignItems: 'center', gap: 2, minHeight: 22, justifyContent: 'center' },
  multiplier: {
    fontSize: 32, lineHeight: 42, paddingHorizontal: 14, paddingVertical: 2, marginRight: -14, fontVariant: ['tabular-nums'],
    textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 },
  },
  status: { fontFamily: FontFamily.display, fontWeight: '700', fontSize: 17, textAlign: 'center' },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  grid: { gap: GAP },
  gridRow: { flexDirection: 'row', gap: GAP },
  tile: { flex: 1, aspectRatio: 1, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flash: { backgroundColor: Arena.danger, borderRadius: 14 },
  footer: { marginHorizontal: 8, padding: 12, gap: 10, borderRadius: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontWeight: '700' },
  count: { minWidth: 40, textAlign: 'center', fontSize: 20, fontVariant: ['tabular-nums'] },
  problem: { color: Arena.danger, fontSize: 13, fontWeight: '600' },
});
