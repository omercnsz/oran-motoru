import { MARKETS } from '@oran/odds-engine';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OddsButton } from '@/components/odds-button';
import { Screen } from '@/components/screen';
import { SlipBar } from '@/components/slip-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useOdds } from '@/data/api';
import { useT } from '@/i18n';
import { formatDay, formatTime, marketName, outcomeLabel } from '@/lib/format';
import { toSelection } from '@/lib/selection';
import { isSelected, useSlip } from '@/state/slip';

export default function MacScreen() {
  const { id, league } = useLocalSearchParams<{ id: string; league: string }>();
  const { t } = useT();
  const odds = useOdds(league);
  const match = odds.data?.matches.find((m) => m.id === id);
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);

  if (!match) {
    return <View style={styles.center}>{odds.isPending ? <ActivityIndicator /> : <ThemedText>{t('matches.notFound')}</ThemedText>}</View>;
  }

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ title: `${match.home} – ${match.away}` }} />
      <Screen title={`${match.home} – ${match.away}`} subtitle={`${formatDay(match.kickoff)} · ${formatTime(match.kickoff)}`} compact>
        {MARKETS.filter((mk) => match.markets[mk.key] && Object.values(match.markets[mk.key]).some(Boolean)).map((mk) => (
          <ThemedView key={mk.key} type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{marketName(mk.key)}</ThemedText>
            <View style={styles.grid}>
              {mk.outcomes.map((o) => (
                <View key={o.key} style={mk.outcomes.length > 4 ? styles.cellSmall : styles.cell}>
                  <OddsButton
                    label={outcomeLabel(mk.key, o.key)}
                    odds={match.markets[mk.key][o.key] ?? null}
                    selected={isSelected(slip, match.id, mk.key, o.key)}
                    onPress={() => { const s = toSelection(league, match, mk.key, o.key); if (s) toggle(s); }}
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
