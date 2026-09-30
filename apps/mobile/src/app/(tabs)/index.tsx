import type { UpcomingMatch } from '@oran/contracts';
import { homeCompetition } from '@oran/leagues';
import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LiveList } from '@/components/live-list';
import { OddsButton } from '@/components/odds-button';
import { Screen } from '@/components/screen';
import { SlipBar } from '@/components/slip-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLeagueIndex, useOdds } from '@/data/api';
import { useSchedule } from '@/data/live';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { dayKey, formatDay, formatTime } from '@/lib/format';
import { toSelection } from '@/lib/selection';
import { isSelected, useSlip } from '@/state/slip';

const ONE_X_TWO = [['1', '1'], ['X', 'X'], ['2', '2']] as const;

export default function MaclarScreen() {
  const { t, regionCode } = useT();
  const index = useLeagueIndex();
  const leagues = useMemo(() => (index.data?.leagues ?? []).filter((l) => l.upcoming > 0), [index.data]);
  const [picked, setPicked] = useState<string>();
  const [mode, setMode] = useState<'pre' | 'live'>('pre');
  const leagueNames = useMemo(() => Object.fromEntries((index.data?.leagues ?? []).map((l) => [l.code, l.name])), [index.data]);
  // İlk açılışta kullanıcının ülkesinin ligi; maçı yoksa ilk turnuva
  const home = homeCompetition(regionCode)?.code;
  const league = picked ?? (leagues.find((l) => l.code === home) ?? leagues[0])?.code;
  const odds = useOdds(league);
  // Seçili lig düğmesi, uzun lig listesinde ekran dışında kalmasın
  const chipsRef = useRef<ScrollView>(null);
  const chipX = useRef(new Map<string, number>());
  useEffect(() => {
    const x = league ? chipX.current.get(league) : undefined;
    if (x !== undefined) chipsRef.current?.scrollTo({ x: Math.max(0, x - Spacing.three), animated: true });
  }, [league, leagues]);
  const now = useNow();
  const schedule = useSchedule();
  // Önümüzdeki 36 saatte maçı olan ligler (maç sayısıyla), en yakın maça göre sıralı
  const soonLeagues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of schedule.data?.matches ?? []) {
      const t = Date.parse(m.kickoff);
      if (t > now && t <= now + 36 * 3_600_000) counts.set(m.league, (counts.get(m.league) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [schedule.data, now]);

  // Cihazın saat dilimine göre günlere ayır; başlamış maçlar listelenmez
  const days = useMemo(() => {
    const groups = new Map<string, UpcomingMatch[]>();
    for (const m of odds.data?.matches ?? []) {
      if (Date.parse(m.kickoff) <= now) continue;
      const k = dayKey(m.kickoff);
      groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    return [...groups.entries()];
  }, [odds.data, now]);

  return (
    <View style={styles.fill}>
      <Screen title={t('matches.title')} subtitle={t('matches.subtitle')} accessory={<SettingsButton />}>
        <View style={styles.segment}>
          <Chip label={t('matches.preMatch')} active={mode === 'pre'} onPress={() => setMode('pre')} />
          <Chip label={t('matches.live')} active={mode === 'live'} onPress={() => setMode('live')} />
        </View>

        {index.isPending ? <ActivityIndicator /> : null}
        {index.error ? <ErrorCard message={index.error.message} /> : null}

        {mode === 'live' ? <LiveList now={now} leagueNames={leagueNames} /> : null}

        {mode === 'pre' ? <>
        <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {leagues.map((l) => (
            <View key={l.code} onLayout={(e) => {
              chipX.current.set(l.code, e.nativeEvent.layout.x);
              if (l.code === league) chipsRef.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - Spacing.three), animated: false });
            }}>
              <Chip label={l.name} active={l.code === league} onPress={() => setPicked(l.code)} />
            </View>
          ))}
        </ScrollView>

        {odds.isPending && league ? <ActivityIndicator /> : null}
        {odds.data && days.length === 0 ? (
          <ThemedText themeColor="textSecondary">{t('matches.none14')}</ThemedText>
        ) : null}

        {league && days.length > 0 && !soonLeagues.some(([l]) => l === league) ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              {t('matches.notSoon', { league: leagueNames[league] ?? league, date: formatDay(days[0][1][0].kickoff) })}
            </ThemedText>
            {soonLeagues.length > 0 ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">{t('matches.soonLeagues')}</ThemedText>
                <View style={styles.soon}>
                  {soonLeagues.map(([l, n]) => (
                    <Chip key={l} label={`${leagueNames[l] ?? l} (${n}) ›`} active={false} onCard onPress={() => setPicked(l)} />
                  ))}
                </View>
              </>
            ) : null}
          </ThemedView>
        ) : null}

        {days.map(([day, matches]) => (
          <View key={day} style={styles.day}>
            <ThemedText type="smallBold" themeColor="textSecondary">{day}</ThemedText>
            {matches.map((m) => <MatchRow key={m.id} league={league!} match={m} />)}
          </View>
        ))}
        </> : null}
      </Screen>
      <SlipBar />
    </View>
  );
}

function MatchRow({ league, match }: { league: string; match: UpcomingMatch }) {
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const { t } = useT();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Link href={{ pathname: '/mac/[id]', params: { id: match.id, league } }} asChild>
        <Pressable accessibilityRole="link" style={styles.matchHeader}>
          <ThemedText type="small" themeColor="textSecondary">{formatTime(match.kickoff)}</ThemedText>
          <ThemedText type="smallBold" style={styles.teams}>{match.home} – {match.away}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('matches.allBets')}</ThemedText>
        </Pressable>
      </Link>
      <View style={styles.oddsRow}>
        {ONE_X_TWO.map(([key, label]) => (
          <OddsButton
            key={key}
            label={label}
            odds={match.markets['1X2']?.[key] ?? null}
            selected={isSelected(slip, match.id, '1X2', key)}
            onPress={() => { const s = toSelection(league, match, '1X2', key); if (s) toggle(s); }}
          />
        ))}
      </View>
    </ThemedView>
  );
}

/** onCard: kart içinde (kartla aynı renkte kaybolmasın) */
function Chip({ label, active, onCard, onPress }: { label: string; active: boolean; onCard?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.text : onCard ? theme.backgroundSelected : theme.backgroundElement }]}>
      <ThemedText type="small" style={{ color: active ? theme.background : theme.text }}>{label}</ThemedText>
    </Pressable>
  );
}

function SettingsButton() {
  const { t } = useT();
  const theme = useTheme();
  return (
    <Link href="/ayarlar" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={t('settings.title')} hitSlop={12}
        // Link asChild içindeki bileşene stil dizisi verilemez
        style={StyleSheet.flatten([styles.settings, { backgroundColor: theme.backgroundElement }])}>
        <ThemedText type="smallBold">⚙︎</ThemedText>
      </Pressable>
    </Link>
  );
}

export function ErrorCard({ message }: { message: string }) {
  const { t } = useT();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{t('common.dataError')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{message}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  segment: { flexDirection: 'row', gap: Spacing.two },
  soon: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chips: { gap: Spacing.two, paddingVertical: Spacing.one },
  chip: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  day: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  teams: { flex: 1 },
  oddsRow: { flexDirection: 'row', gap: Spacing.two },
  settings: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
