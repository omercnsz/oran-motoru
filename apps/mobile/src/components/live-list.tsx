// Canlı maçlar listesi (koyu stadyum teması): oynanan maçlarda dakika, skor, kırmızı kart ve canlı 1X2 oranları.
import type { RatingsFile } from '@oran/contracts';
import { priceMatch } from '@oran/odds-engine';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AText, Glass } from '@/components/arena/kit';
import { OddsButton } from '@/components/odds-button';
import { LivePill, SectionHead, TimePill } from '@/components/sport/bits';
import { TeamBadge } from '@/components/sport/team-badge';
import { Arena, FontFamily } from '@/constants/arena';
import { useLive, type LiveRow } from '@/data/live';
import { useRatings } from '@/data/ratings';
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

  if (live.schedule.isPending || (live.matches.length > 0 && live.isPending)) return <ActivityIndicator color={Arena.neon} />;
  if (live.matches.length === 0) {
    const next = live.schedule.data?.matches.find((m) => Date.parse(m.kickoff) > now);
    return (
      <Glass style={styles.empty}>
        <AText style={styles.emptyText}>{t('live.noneNow')}</AText>
        {next ? (
          <AText dim style={styles.small}>
            {t('live.next', { home: next.home, away: next.away, time: formatTime(next.kickoff), league: leagueNames[next.league] ?? next.league })}
          </AText>
        ) : null}
      </Glass>
    );
  }
  if (live.error) return <AText dim>{t('live.error', { message: live.error.message })}</AText>;

  const rows = live.data?.rows ?? [];
  const groups: [string, LiveRow[], string][] = [
    [t('live.inPlay'), rows.filter((r) => r.event.state === 'in'), '#FF8FA3'],
    [t('live.soon'), rows.filter((r) => r.event.state === 'pre'), Arena.textDim],
    [t('live.finished'), rows.filter((r) => r.event.state === 'post'), Arena.textDim],
  ];
  return (
    <>
      {groups.filter(([, g]) => g.length).map(([title, g, color]) => (
        <View key={title} style={styles.group}>
          <SectionHead title={title} color={color} />
          {g.map((r) => (
            <LiveCard key={r.match.espnId} row={r} ratings={ratings.get(r.match.league)} leagueName={leagueNames[r.match.league] ?? r.match.league} />
          ))}
        </View>
      ))}
      {live.data ? (
        <AText dim style={styles.small}>
          {t(live.data.source === 'cache' ? 'live.sourceCache' : 'live.sourceDirect')} · {t('live.updated', { time: formatTime(new Date(live.data.fetchedAt).toISOString()) })}
        </AText>
      ) : null}
    </>
  );
}

function LiveCard({ row, ratings, leagueName }: { row: LiveRow; ratings: RatingsFile | undefined; leagueName: string }) {
  const { t } = useT();
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const { match: m, event: e } = row;
  const markets = liveMarkets(row, ratings);
  const oneXTwo = markets?.find((mk) => mk.key === '1X2');
  const playing = e.state === 'in';

  return (
    <Glass style={[styles.card, playing && styles.cardLive]}>
      <Link href={{ pathname: '/canli/[espnId]', params: { espnId: m.espnId } }} asChild>
        <Pressable accessibilityRole="link" style={styles.body}>
          <View style={styles.meta}>
            {playing ? <LivePill label={clockLabel(e)} /> : <TimePill label={e.state === 'pre' ? formatTime(m.kickoff) : clockLabel(e)} muted={e.state === 'post'} />}
            <AText dim style={styles.league} numberOfLines={1}>{leagueName}</AText>
            {oneXTwo ? <AText style={styles.more}>{t('live.allLiveBets')}</AText> : null}
          </View>
          {(['home', 'away'] as const).map((side) => (
            <View key={side} style={styles.teamRow}>
              <TeamBadge name={m[side]} style={e[`${side}Style`] ?? m[`${side}Style`]} />
              <AText style={styles.team} numberOfLines={1}>{m[side]}</AText>
              {e.redCards[side] > 0 ? (
                <View style={styles.reds}>
                  {Array.from({ length: e.redCards[side] }, (_, k) => <View key={k} style={styles.redCard} />)}
                </View>
              ) : null}
              <AText display style={[styles.score, !playing && { color: Arena.textDim }]}>{e.state === 'pre' ? '' : e.score[side]}</AText>
            </View>
          ))}
        </Pressable>
      </Link>
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
    </Glass>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  empty: { padding: 16, gap: 6 },
  emptyText: { fontWeight: '700', fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  card: { padding: 14, gap: 12 },
  cardLive: { borderColor: 'rgba(255,77,109,0.35)' },
  body: { gap: 9 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  league: { flex: 1, fontSize: 12, fontWeight: '600' },
  more: { color: Arena.textDim, fontSize: 12, fontWeight: '600' },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  team: { flex: 1, fontWeight: '700', fontSize: 15 },
  reds: { flexDirection: 'row', gap: 3 },
  redCard: { width: 9, height: 12, borderRadius: 2, backgroundColor: Arena.danger },
  score: { minWidth: 26, textAlign: 'right', fontSize: 20, fontFamily: FontFamily.display, fontVariant: ['tabular-nums'] },
  oddsRow: { flexDirection: 'row', gap: 8 },
});
