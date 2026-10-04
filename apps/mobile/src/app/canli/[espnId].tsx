// Canlı maç: skor, dakika, kırmızı kartlar ve maç sürerken hesaplanan canlı oranlar.
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AText, ArenaBackground, Glass } from '@/components/arena/kit';
import { liveMarkets } from '@/components/live-list';
import { OddsButton } from '@/components/odds-button';
import { SlipBar } from '@/components/slip-bar';
import { LivePill, TimePill } from '@/components/sport/bits';
import { MatchHero } from '@/components/sport/match-hero';
import { Arena, FontFamily } from '@/constants/arena';
import { useLive } from '@/data/live';
import { useRatings } from '@/data/ratings';
import { useNow } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { clockLabel, marketName, outcomeLabel } from '@/lib/format';
import { toLiveSelection } from '@/lib/selection';
import { isSelected, useSlip } from '@/state/slip';

export default function CanliScreen() {
  const { espnId } = useLocalSearchParams<{ espnId: string }>();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);
  const live = useLive(now);
  const row = live.data?.rows.find((r) => r.match.espnId === espnId);
  const ratings = useRatings(row ? [row.match.league] : []);
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);

  if (!row) {
    // Şu an canlı penceresinde maç yoksa canlı sorgusu hiç çalışmaz (hep "bekliyor" görünür); bu yüzden ona bakılmaz
    const loading = live.schedule.isPending || (live.matches.length > 0 && live.isPending);
    return (
      <ArenaBackground style={styles.center}>
        {loading ? <ActivityIndicator color={Arena.neon} /> : <AText>{t('live.notInList')}</AText>}
      </ArenaBackground>
    );
  }
  const { match: m, event: e } = row;
  const markets = liveMarkets(row, ratings.get(m.league));
  const score = `${e.score.home} – ${e.score.away}`;

  return (
    <ArenaBackground>
      <Stack.Screen options={{ title: `${m.home} – ${m.away}` }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <MatchHero home={m.home} away={m.away} homeStyle={e.homeStyle ?? m.homeStyle} awayStyle={e.awayStyle ?? m.awayStyle}
          center={e.state === 'pre' ? '–' : score}
          below={e.state === 'in' ? <LivePill label={clockLabel(e)} />
            : <TimePill muted label={e.state === 'post' ? t('live.finishedScore', { score }) : t('live.notStarted')} />} />
        {e.redCards.home + e.redCards.away > 0 ? (
          <AText dim style={styles.small}>
            {t('live.redCards', { home: m.home, homeCount: e.redCards.home, away: m.away, awayCount: e.redCards.away })}
          </AText>
        ) : null}
        {!markets ? (
          <Glass style={styles.card}>
            <AText dim>{t(e.state === 'in' ? 'live.computing' : 'live.onlyInPlay')}</AText>
          </Glass>
        ) : null}
        {markets?.filter((mk) => mk.outcomes.some((o) => o.odds)).map((mk) => (
          <Glass key={mk.key} style={styles.card}>
            <AText style={styles.market}>{marketName(mk.key)}</AText>
            <View style={styles.grid}>
              {mk.outcomes.map((o) => (
                <View key={o.key} style={mk.outcomes.length > 4 ? styles.cellSmall : styles.cell}>
                  <OddsButton
                    label={outcomeLabel(mk.key, o.key)}
                    odds={o.odds}
                    selected={isSelected(slip, m.id, mk.key, o.key, true)}
                    onPress={() => { const s = toLiveSelection(row, mk.key, o.key, o.odds); if (s) toggle(s); }}
                  />
                </View>
              ))}
            </View>
          </Glass>
        ))}
      </ScrollView>
      <SlipBar aboveTabs={false} />
    </ArenaBackground>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  small: { fontSize: 13, lineHeight: 18 },
  card: { padding: 14, gap: 10 },
  market: { color: Arena.textDim, fontFamily: FontFamily.display, fontWeight: '700', fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, flexBasis: '28%', flexDirection: 'row' },
  cellSmall: { flexBasis: '18%', flexGrow: 1, flexDirection: 'row' },
});
