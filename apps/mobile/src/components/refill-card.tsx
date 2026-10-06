// Jeton bitince: kısa bir ödüllü reklamla jeton yüklenir. Jeton satılmaz. Reklam yoksa kullanıcı cezalandırılmaz.
// Reklamsız sürümde jeton tek dokunuşla yüklenir.
// Oyun ekranlarında ve Oyunlar sekmesinde görünür (arena teması).
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ADS_ENABLED, showRewarded } from '@/ads';
import { AText, Coin, Glass, NeonButton } from '@/components/arena/kit';
import { Arena, glow } from '@/constants/arena';
import { REFILL_TOKENS, refillTokens } from '@/db/games';
import { useT } from '@/i18n';
import { sfx } from '@/lib/sound';
import { formatTokens } from '@/lib/tokens';

export function RefillCard() {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function watch() {
    setBusy(true);
    setNote(null);
    const result = ADS_ENABLED ? await showRewarded() : 'earned';
    if (result === 'closed') setNote(t('games.refillClosed'));
    else {
      refillTokens();
      sfx('coins');
      if (result === 'unavailable') setNote(t('games.refillNoAd'));
    }
    setBusy(false);
  }

  const amount = formatTokens(REFILL_TOKENS);
  return (
    <Glass strong style={styles.card}>
      <View style={styles.row}>
        <Coin size={34} />
        <AText style={styles.text}>{t(ADS_ENABLED ? 'games.refill' : 'games.refillFree', { amount })}</AText>
      </View>
      {busy ? <ActivityIndicator color={Arena.gold} /> : (
        <NeonButton tone="gold" sound={null} onPress={() => void watch()} label={t(ADS_ENABLED ? 'games.refillButton' : 'games.refillFreeButton', { amount })} />
      )}
      {note ? <AText dim style={styles.note}>{note}</AText> : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 12, borderColor: 'rgba(255,200,61,0.45)', boxShadow: glow(Arena.gold, 18, 0.25) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18 },
});
