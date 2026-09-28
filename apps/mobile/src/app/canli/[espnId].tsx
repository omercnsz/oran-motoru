import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { liveMarkets } from '@/components/live-list';
import { OddsButton } from '@/components/odds-button';
import { Screen } from '@/components/screen';
import { SlipBar } from '@/components/slip-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLive } from '@/data/live';
import { useRatings } from '@/data/ratings';
import { useNow } from '@/hooks/use-now';
import { toLiveSelection } from '@/lib/selection';
import { isSelected, useSlip } from '@/state/slip';

export default function CanliScreen() {
  const { espnId } = useLocalSearchParams<{ espnId: string }>();
  const now = useNow(30_000);
  const live = useLive(now);
  const row = live.data?.rows.find((r) => r.match.espnId === espnId);
  const ratings = useRatings(row ? [row.match.league] : []);
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);

  if (!row) {
    return <View style={styles.center}>{live.isPending ? <ActivityIndicator /> : <ThemedText>Maç canlı listede değil</ThemedText>}</View>;
  }
  const { match: m, event: e } = row;
  const markets = liveMarkets(row, ratings.get(m.league));
  const status = e.state === 'in' ? `${e.clock} · ${e.score.home}-${e.score.away}` : e.state === 'post' ? `Bitti · ${e.score.home}-${e.score.away}` : 'Başlamadı';

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ title: `${m.home} – ${m.away}` }} />
      <Screen title={`${m.home} ${e.state === 'pre' ? '–' : `${e.score.home}-${e.score.away}`} ${m.away}`} subtitle={status} compact>
        {e.redCards.home + e.redCards.away > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">Kırmızı kart: {m.home} {e.redCards.home}, {m.away} {e.redCards.away}</ThemedText>
        ) : null}
        {!markets ? (
          <ThemedText themeColor="textSecondary">{e.state === 'in' ? 'Canlı oranlar hesaplanıyor…' : 'Canlı bahis sadece maç oynanırken açık.'}</ThemedText>
        ) : null}
        {markets?.filter((mk) => mk.outcomes.some((o) => o.odds)).map((mk) => (
          <ThemedView key={mk.key} type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{mk.name}</ThemedText>
            <View style={styles.grid}>
              {mk.outcomes.map((o) => (
                <View key={o.key} style={mk.outcomes.length > 4 ? styles.cellSmall : styles.cell}>
                  <OddsButton
                    label={o.label}
                    odds={o.odds}
                    selected={isSelected(slip, m.id, mk.key, o.key, true)}
                    onPress={() => { const s = toLiveSelection(row, mk.key, o.key, o.odds); if (s) toggle(s); }}
                  />
                </View>
              ))}
            </View>
          </ThemedView>
        ))}
      </Screen>
      <SlipBar aboveTabs={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { flexGrow: 1, flexBasis: '28%', flexDirection: 'row' },
  cellSmall: { flexBasis: '18%', flexGrow: 1, flexDirection: 'row' },
});
