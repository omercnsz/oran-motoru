// Oyunlar: sadece jetonla. Jeton satılmaz, paraya çevrilmez; bitince ödüllü reklamla dolar.
// Her oyunun yanında oyuncunun kendi sonucu ve oyunun gerçek geri dönüş oranı yazar.
import { BLACKJACK, CRASH, MINES, PLINKO_ROWS, plinkoRtp, ROULETTE, slotMath } from '@oran/games-math';
import { Link, router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { RefillCard } from '@/components/refill-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { canRefill, type GameReport } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { formatPercent, formatTokens } from '@/lib/tokens';

const SLOT_EDGE = 1 - slotMath().rtp;
// Plinko: tabloların en yüksek kasa avantajı (hepsi %3,0–3,2)
const PLINKO_EDGE = 1 - Math.min(...PLINKO_ROWS.flatMap((r) => [plinkoRtp(r, 'low'), plinkoRtp(r, 'high')]));

export default function OyunlarScreen() {
  const { t } = useT();
  const theme = useTheme();
  const { balance, crash, roulette, slot, mines, plinko, blackjack } = useGames();
  return (
    <Screen title={t('games.title')} subtitle={t('games.subtitle')}>
      <ThemedText type="smallBold">{t('games.balance', { amount: formatTokens(balance) })}</ThemedText>
      <Link href="/rapor" asChild>
        <Pressable accessibilityRole="link" hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>{t('report.open')}</ThemedText>
        </Pressable>
      </Link>
      {canRefill(balance) ? <RefillCard /> : null}
      <GameCard title={t('games.crash')} description={t('games.crashDesc')} report={crash} houseEdge={CRASH.houseEdge} href="/crash" />
      <GameCard title={t('games.roulette')} description={t('games.rouletteDesc')} report={roulette} houseEdge={ROULETTE.houseEdge} href="/rulet" />
      <GameCard title={t('games.slot')} description={t('games.slotDesc')} report={slot} houseEdge={SLOT_EDGE} href="/slot" />
      <GameCard title={t('games.mines')} description={t('games.minesDesc')} report={mines} houseEdge={MINES.houseEdge} href="/mines" />
      <GameCard title={t('games.plinko')} description={t('games.plinkoDesc')} report={plinko} houseEdge={PLINKO_EDGE} href="/plinko" />
      <GameCard title={t('games.blackjack')} description={t('games.blackjackDesc')} report={blackjack} houseEdge={1 - BLACKJACK.basicStrategyRtp} href="/blackjack" />
    </Screen>
  );
}

function GameCard({ title, description, report, houseEdge, href }: {
  title: string; description: string; report: GameReport; houseEdge: number; href: Href;
}) {
  const { t } = useT();
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="subtitle" style={styles.gameTitle}>{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>
      <ThemedText type="smallBold">{t('games.report')}</ThemedText>
      {report.rounds === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">{t('games.reportEmpty')}</ThemedText>
      ) : (
        <>
          <ThemedText type="small">
            {t('games.reportLine', { rounds: report.rounds, staked: formatTokens(report.staked), returned: formatTokens(report.returned) })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('games.reportRtp', { actual: formatPercent(report.rtp ?? 0), theory: formatPercent(1 - houseEdge) })}
          </ThemedText>
        </>
      )}
      <Pressable accessibilityRole="button" onPress={() => router.push(href)}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: theme.accentText }}>{t('games.play')}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  gameTitle: { fontSize: 24, lineHeight: 30 },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.one },
});
