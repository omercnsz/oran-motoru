import type { RatingsFile } from '@oran/contracts';
import { priceMatch } from '@oran/odds-engine';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { OddsButton } from '@/components/odds-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLive, type LiveRow } from '@/data/live';
import { useRatings } from '@/data/ratings';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { clockLabel, formatTime, outcomeLabel } from '@/lib/format';
import { toLiveSelection } from '@/lib/selection';
import { isSelected, useSlip } from '@/state/slip';

/** Oynanan maç için canlı oranlar (maç öncesi, bitmiş ya da devre arasında değilse) */
export function liveMarkets(row: LiveRow, ratings: RatingsFile | undefined) {
  if (!ratings || row.event.state !== 'in') return null;
  return priceMatch(ratings, row.match.home, row.match.away, {
    minute: row.event.minute, score: row.event.score, redCards: row.event.redCards,
  }).markets;
}

export function LiveList({ now, leagueNames }: { now: number; leagueNames: Record<string, string> }) {
  const { t } = useT();
  const live = useLive(now);
  const ratings = useRatings([...new Set(live.matches.map((m) => m.league))]);

  if (live.schedule.isPending || (live.matches.length > 0 && live.isPending)) return <ActivityIndicator />;
  if (live.matches.length === 0) {
    const next = live.schedule.data?.matches.find((m) => Date.parse(m.kickoff) > now);
    return (
      <ThemedText themeColor="textSecondary">
        {t('live.noneNow')}{next ? ` ${t('live.next', { home: next.home, away: next.away, time: formatTime(next.kickoff), league: leagueNames[next.league] ?? next.league })}` : ''}
      </ThemedText>
    );
  }
  if (live.error) return <ThemedText themeColor="textSecondary">{t('live.error', { message: live.error.message })}</ThemedText>;

  const rows = live.data?.rows ?? [];
  const groups: [string, LiveRow[]][] = [
    [t('live.inPlay'), rows.filter((r) => r.event.state === 'in')],
    [t('live.soon'), rows.filter((r) => r.event.state === 'pre')],
    [t('live.finished'), rows.filter((r) => r.event.state === 'post')],
  ];
  return (
    <>
      {groups.filter(([, g]) => g.length).map(([title, g]) => (
        <View key={title} style={styles.group}>
          <ThemedText type="smallBold" themeColor="textSecondary">{title}</ThemedText>
          {g.map((r) => (
            <LiveCard key={r.match.espnId} row={r} ratings={ratings.get(r.match.league)} leagueName={leagueNames[r.match.league] ?? r.match.league} />
          ))}
        </View>
      ))}
      {live.data ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t(live.data.source === 'cache' ? 'live.sourceCache' : 'live.sourceDirect')} · {t('live.updated', { time: formatTime(new Date(live.data.fetchedAt).toISOString()) })}
        </ThemedText>
      ) : null}
    </>
  );
}

function LiveCard({ row, ratings, leagueName }: { row: LiveRow; ratings: RatingsFile | undefined; leagueName: string }) {
  const theme = useTheme();
  const { t } = useT();
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const { match: m, event: e } = row;
  const markets = liveMarkets(row, ratings);
  const oneXTwo = markets?.find((mk) => mk.key === '1X2');
  const red = (n: number) => (n > 0 ? ` ${'▮'.repeat(n)}` : '');

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Link href={{ pathname: '/canli/[espnId]', params: { espnId: m.espnId } }} asChild>
        <Pressable accessibilityRole="link" style={styles.header}>
          <ThemedText type="smallBold" style={{ color: e.state === 'in' ? theme.danger : theme.textSecondary, minWidth: 44 }}>
            {e.state === 'pre' ? formatTime(m.kickoff) : clockLabel(e)}
          </ThemedText>
          <View style={styles.teams}>
            <View style={styles.teamRow}>
              <ThemedText type="small">{m.home}<ThemedText type="small" style={{ color: theme.danger }}>{red(e.redCards.home)}</ThemedText></ThemedText>
              <ThemedText type="smallBold">{e.state === 'pre' ? '' : e.score.home}</ThemedText>
            </View>
            <View style={styles.teamRow}>
              <ThemedText type="small">{m.away}<ThemedText type="small" style={{ color: theme.danger }}>{red(e.redCards.away)}</ThemedText></ThemedText>
              <ThemedText type="smallBold">{e.state === 'pre' ? '' : e.score.away}</ThemedText>
            </View>
          </View>
        </Pressable>
      </Link>
      <ThemedText type="small" themeColor="textSecondary">{leagueName}{oneXTwo ? ` · ${t('live.allLiveBets')}` : ''}</ThemedText>
      {oneXTwo ? (
        <View style={styles.oddsRow}>
          {oneXTwo.outcomes.map((o) => (
            <OddsButton
              key={o.key}
              label={outcomeLabel('1X2', o.key)}
              odds={o.odds}
              selected={isSelected(slip, m.id, '1X2', o.key, true)}
              onPress={() => { const s = toLiveSelection(row, '1X2', o.key, o.odds); if (s) toggle(s); }}
            />
          ))}
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  teams: { flex: 1, gap: Spacing.half },
  teamRow: { flexDirection: 'row', justifyContent: 'space-between' },
  oddsRow: { flexDirection: 'row', gap: Spacing.two },
});
