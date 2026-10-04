// Maç detayı: üstte takımlar ve başlama saati, altında bütün pazarlar (maç sonucu, alt/üst, karşılıklı gol…).
import { MARKETS } from '@oran/odds-engine';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AText, ArenaBackground, Glass } from '@/components/arena/kit';
import { OddsButton } from '@/components/odds-button';
import { SlipBar } from '@/components/slip-bar';
import { MatchHero } from '@/components/sport/match-hero';
import { Arena, FontFamily } from '@/constants/arena';
import { useLeagueIndex, useOdds } from '@/data/api';
import { useT } from '@/i18n';
import { formatDay, formatTime, marketName, outcomeLabel } from '@/lib/format';
import { leagueInfo } from '@/lib/leagues';
import { toSelection } from '@/lib/selection';
import { isSelected, useSlip } from '@/state/slip';

export default function MacScreen() {
  const { id, league } = useLocalSearchParams<{ id: string; league: string }>();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const odds = useOdds(league);
  const index = useLeagueIndex();
  const match = odds.data?.matches.find((m) => m.id === id);
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const info = index.data?.leagues.find((l) => l.code === league);
  const leagueLabel = info ? (({ flag, name }) => `${flag} ${name}`)(leagueInfo(info, language)) : undefined;

  if (!match) {
    return (
      <ArenaBackground style={styles.center}>
        {odds.isPending ? <ActivityIndicator color={Arena.neon} /> : <AText>{t('matches.notFound')}</AText>}
      </ArenaBackground>
    );
  }

  return (
    <ArenaBackground>
      <Stack.Screen options={{ title: `${match.home} – ${match.away}` }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <MatchHero league={leagueLabel} home={match.home} away={match.away} homeStyle={match.homeStyle} awayStyle={match.awayStyle}
          center={formatTime(match.kickoff)} below={<AText dim style={styles.day}>{formatDay(match.kickoff)}</AText>} />
        {MARKETS.filter((mk) => match.markets[mk.key] && Object.values(match.markets[mk.key]).some(Boolean)).map((mk, i) => (
          <Animated.View key={mk.key} entering={FadeInDown.delay(i * 40).duration(240)}>
            <Glass style={styles.card}>
              <AText style={styles.market}>{marketName(mk.key)}</AText>
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
            </Glass>
          </Animated.View>
        ))}
      </ScrollView>
      <SlipBar aboveTabs={false} />
    </ArenaBackground>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  day: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  card: { padding: 14, gap: 10 },
  market: { color: Arena.textDim, fontFamily: FontFamily.display, fontWeight: '700', fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, flexBasis: '28%', flexDirection: 'row' },
  cellSmall: { flexBasis: '18%', flexGrow: 1, flexDirection: 'row' },
});
