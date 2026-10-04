// Oyunlar: sadece jetonla. Jeton satılmaz, paraya çevrilmez; bitince ödüllü reklamla dolar.
// Her oyunun yanında oyunun gerçek geri dönüş oranı ve oyuncunun kendi sonucu yazar.
import { BLACKJACK, CRASH, MINES, PLINKO_ROWS, plinkoRtp, ROULETTE, slotMath } from '@oran/games-math';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GAME_COLORS, GameArt, type GameKey } from '@/components/arena/game-art';
import { AText, ArenaBackground, Balance, GlassButton, useArena } from '@/components/arena/kit';
import { RefillCard } from '@/components/refill-card';
import { Arena, FontFamily } from '@/constants/arena';
import { BottomTabInset } from '@/constants/theme';
import { canRefill, type GameReport } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { sfx } from '@/lib/sound';
import { formatNet, formatPercent } from '@/lib/tokens';

// Plinko ve slot: tabloların en düşük geri dönüşü
const RTP: Record<GameKey, number> = {
  crash: 1 - CRASH.houseEdge,
  roulette: 1 - ROULETTE.houseEdge,
  slot: slotMath().rtp,
  mines: 1 - MINES.houseEdge,
  plinko: Math.min(...PLINKO_ROWS.flatMap((r) => [plinkoRtp(r, 'low'), plinkoRtp(r, 'high')])),
  blackjack: BLACKJACK.basicStrategyRtp,
};
const GAMES: { key: GameKey; title: string; desc: string; href: Href }[] = [
  { key: 'crash', title: 'games.crash', desc: 'games.crashDesc', href: '/crash' },
  { key: 'roulette', title: 'games.roulette', desc: 'games.rouletteDesc', href: '/rulet' },
  { key: 'slot', title: 'games.slot', desc: 'games.slotDesc', href: '/slot' },
  { key: 'mines', title: 'games.mines', desc: 'games.minesDesc', href: '/mines' },
  { key: 'plinko', title: 'games.plinko', desc: 'games.plinkoDesc', href: '/plinko' },
  { key: 'blackjack', title: 'games.blackjack', desc: 'games.blackjackDesc', href: '/blackjack' },
];

export default function OyunlarScreen() {
  const { t } = useT();
  const games = useGames();
  useArena();
  return (
    <ArenaBackground>
      <SafeAreaView edges={['top']} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <AText display style={styles.title}>{t('games.title')}</AText>
          <AText dim style={styles.subtitle}>{t('games.subtitle')}</AText>
          <View style={styles.topRow}>
            <Balance units={games.balance} />
            <GlassButton label={t('report.open')} onPress={() => router.push('/rapor')} />
          </View>
          {canRefill(games.balance) ? <RefillCard /> : null}
          {GAMES.map((g, i) => (
            <Animated.View key={g.key} entering={FadeInDown.delay(i * 60).duration(300)}>
              <GameCard game={g.key} title={t(g.title)} description={t(g.desc)} report={games[g.key]} href={g.href} />
            </Animated.View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ArenaBackground>
  );
}

function GameCard({ game, title, description, report, href }: {
  game: GameKey; title: string; description: string; report: GameReport; href: Href;
}) {
  const { t } = useT();
  const color = GAME_COLORS[game];
  const net = report.returned - report.staked;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title}
      onPress={() => { sfx('tap'); haptic.light(); router.push(href); }}
      style={({ pressed }) => [styles.card, { borderColor: `${color}40`, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View style={[styles.art, {
        experimental_backgroundImage: `radial-gradient(circle at 50% 40%, ${color}40 0%, ${color}08 75%)`,
        borderColor: `${color}55`,
      }]}>
        <GameArt game={game} size={76} />
      </View>
      <View style={styles.info}>
        <AText display style={styles.gameTitle} numberOfLines={1}>{title}</AText>
        <AText dim style={styles.desc} numberOfLines={2}>{description}</AText>
        <View style={styles.pills}>
          <View style={[styles.pill, { borderColor: `${color}66` }]}>
            <AText style={[styles.pillText, { color }]}>{t('games.payback', { rtp: formatPercent(RTP[game]) })}</AText>
          </View>
          {report.rounds > 0 ? (
            <View style={styles.pill}>
              <AText style={[styles.pillText, { color: net > 0 ? Arena.gold : net < 0 ? Arena.danger : Arena.textDim }]}>
                {`${report.rounds} · ${formatNet(net)}`}
              </AText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: BottomTabInset + 48 },
  title: { fontSize: 32, lineHeight: 42, marginTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 },
  card: {
    flexDirection: 'row', gap: 14, padding: 12, borderRadius: 22, borderWidth: 1, alignItems: 'center',
    backgroundColor: Arena.glass,
  },
  art: { width: 92, height: 92, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  info: { flex: 1, gap: 4 },
  gameTitle: { fontSize: 18, lineHeight: 24 },
  desc: { fontSize: 13, lineHeight: 18 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: Arena.glassBorder, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 12, fontWeight: '800', fontFamily: FontFamily.ui, fontVariant: ['tabular-nums'] },
});
