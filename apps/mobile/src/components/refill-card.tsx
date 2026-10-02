// Jeton bitince: kısa bir ödüllü reklamla jeton yüklenir. Jeton satılmaz. Reklam yoksa kullanıcı cezalandırılmaz.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { showRewarded } from '@/ads';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { REFILL_TOKENS, refillTokens } from '@/db/games';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { formatTokens } from '@/lib/tokens';

export function RefillCard() {
  const { t } = useT();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function watch() {
    setBusy(true);
    setNote(null);
    const result = await showRewarded();
    if (result === 'closed') setNote(t('games.refillClosed'));
    else {
      refillTokens();
      if (result === 'unavailable') setNote(t('games.refillNoAd'));
    }
    setBusy(false);
  }

  const amount = formatTokens(REFILL_TOKENS);
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small">{t('games.refill', { amount })}</ThemedText>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void watch()}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed || busy ? 0.7 : 1 }]}>
        {busy ? <ActivityIndicator color={theme.accentText} /> : (
          <ThemedText type="smallBold" style={{ color: theme.accentText }}>{t('games.refillButton', { amount })}</ThemedText>
        )}
      </Pressable>
      {note ? <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
});
