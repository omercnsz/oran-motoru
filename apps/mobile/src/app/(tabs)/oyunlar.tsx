// Oyunlar: sadece jetonla. Jeton satılmaz, paraya çevrilmez; bitince ödüllü reklamla dolar.
// Her oyunun yanında oyuncunun kendi sonucu ve oyunun gerçek geri dönüş oranı yazar.
import { CRASH } from '@oran/games-math';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { RefillCard } from '@/components/refill-card';
import { ComingSoon, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { canRefill } from '@/db/games';
import { useGames } from '@/hooks/use-games';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { formatPercent, formatTokens } from '@/lib/tokens';

export default function OyunlarScreen() {
  const { t } = useT();
  const theme = useTheme();
  const { balance, crash } = useGames();
  return (
    <Screen title={t('games.title')} subtitle={t('games.subtitle')}>
      <ThemedText type="smallBold">{t('games.balance', { amount: formatTokens(balance) })}</ThemedText>
      {canRefill(balance) ? <RefillCard /> : null}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle" style={styles.gameTitle}>{t('games.crash')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{t('games.crashDesc')}</ThemedText>
        <ThemedText type="smallBold">{t('games.report')}</ThemedText>
        {crash.rounds === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">{t('games.reportEmpty')}</ThemedText>
        ) : (
          <>
            <ThemedText type="small">
              {t('games.reportLine', { rounds: crash.rounds, staked: formatTokens(crash.staked), returned: formatTokens(crash.returned) })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('games.reportRtp', { actual: formatPercent(crash.rtp ?? 0), theory: formatPercent(1 - CRASH.houseEdge) })}
            </ThemedText>
          </>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.push('/crash')}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: theme.accentText }}>{t('games.play')}</ThemedText>
        </Pressable>
      </ThemedView>

      <ComingSoon phase={4} items={[t('games.roulette')]} />
      <ComingSoon phase={5} items={[t('games.slot')]} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  gameTitle: { fontSize: 24, lineHeight: 30 },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.one },
});
