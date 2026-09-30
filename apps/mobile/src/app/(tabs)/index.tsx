import type { UpcomingMatch } from '@oran/contracts';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorCard } from '@/components/error-card';
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
import { leagueInfo } from '@/lib/leagues';
import { toSelection } from '@/lib/selection';
import { useLeagues } from '@/state/leagues';
import { isSelected, useSlip } from '@/state/slip';

const ONE_X_TWO = [['1', '1'], ['X', 'X'], ['2', '2']] as const;
/** "Yakında maçı olan turnuvalar" kartında en fazla bu kadar öneri */
const MAX_SUGGESTIONS = 8;

export default function MaclarScreen() {
  const { t, language } = useT();
  const index = useLeagueIndex();
  const favorites = useLeagues((s) => s.favorites);
  const current = useLeagues((s) => s.current);
  const pick = useLeagues((s) => s.pick);
  const [mode, setMode] = useState<'pre' | 'live'>('pre');
  const leagueNames = useMemo(() => Object.fromEntries((index.data?.leagues ?? []).map((l) => [l.code, l.name])), [index.data]);
  // Düğme etiketleri: bayrak + ad
  const labels = useMemo(() => Object.fromEntries((index.data?.leagues ?? []).map((l) => {
    const info = leagueInfo(l, language);
    return [l.code, `${info.flag} ${info.name}`];
  })), [index.data, language]);
  // Son seçilen turnuva; hiç seçilmediyse maçı olan ilk favori, o da yoksa maçı olan ilk turnuva
  const league = useMemo(() => {
    const all = index.data?.leagues ?? [];
    if (current && all.some((l) => l.code === current)) return current;
    const playing = new Set(all.filter((l) => l.upcoming > 0).map((l) => l.code));
    return favorites.find((c) => playing.has(c)) ?? [...playing][0];
  }, [index.data, current, favorites]);
  // Üst çubuk: favoriler; seçili turnuva favori değilse en başta
  const quick = useMemo(() => {
    const known = new Set((index.data?.leagues ?? []).map((l) => l.code));
    const favs = favorites.filter((c) => known.has(c));
    return league && !favs.includes(league) ? [league, ...favs] : favs;
  }, [index.data, favorites, league]);
  const odds = useOdds(league);
  // Seçili lig düğmesi ekran dışındaysa görünür yere kaydırılır (görünüyorsa çubuk yerinde kalır)
  const chipsRef = useRef<ScrollView>(null);
  const chipLayout = useRef(new Map<string, { x: number; width: number }>());
  const chipsView = useRef({ width: 0, offset: 0 });
  const reveal = useCallback((code: string | undefined, animated: boolean) => {
    const chip = code ? chipLayout.current.get(code) : undefined;
    const { width, offset } = chipsView.current;
    if (!chip || width === 0) return;
    if (chip.x >= offset && chip.x + chip.width <= offset + width) return;
    chipsRef.current?.scrollTo({ x: Math.max(0, chip.x - Spacing.three), animated });
  }, []);
  useEffect(() => reveal(league, true), [reveal, league, quick]);
  const now = useNow();
  const schedule = useSchedule();
  // Önümüzdeki 36 saatte maçı olan ligler (maç sayısıyla), en yakın maça göre sıralı
  const soonLeagues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of schedule.data?.matches ?? []) {
      const t = Date.parse(m.kickoff);
      if (t > now && t <= now + 36 * 3_600_000) counts.set(m.league, (counts.get(m.league) ?? 0) + 1);
    }
    return counts;
  }, [schedule.data, now]);
  // Öneriler: önce favoriler
  const suggestions = useMemo(() => {
    const codes = [...soonLeagues.keys()].filter((c) => c !== league);
    return [...codes.filter((c) => favorites.includes(c)), ...codes.filter((c) => !favorites.includes(c))].slice(0, MAX_SUGGESTIONS);
  }, [soonLeagues, favorites, league]);

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

  const openPicker = () => router.push({ pathname: '/ligler', params: league ? { selected: league } : {} });

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
        <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}
          scrollEventThrottle={32}
          onScroll={(e) => { chipsView.current.offset = e.nativeEvent.contentOffset.x; }}
          onLayout={(e) => { chipsView.current.width = e.nativeEvent.layout.width; reveal(league, false); }}>
          {index.data ? <AllLeaguesChip label={t('leagues.all')} onPress={openPicker} /> : null}
          {quick.map((code) => (
            <View key={code} onLayout={(e) => {
              chipLayout.current.set(code, { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width });
              if (code === league) reveal(code, false);
            }}>
              <Chip label={labels[code] ?? code} active={code === league} onPress={() => pick(code)} />
            </View>
          ))}
        </ScrollView>

        {odds.isPending && league ? <ActivityIndicator /> : null}

        {league && odds.data && !soonLeagues.has(league) ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              {days.length > 0
                ? t('matches.notSoon', { league: leagueNames[league] ?? league, date: formatDay(days[0][1][0].kickoff) })
                : t('matches.none14')}
            </ThemedText>
            {suggestions.length > 0 ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">{t('matches.soonLeagues')}</ThemedText>
                <View style={styles.soon}>
                  {suggestions.map((c) => (
                    <Chip key={c} label={`${labels[c] ?? c} (${soonLeagues.get(c)}) ›`} active={false} onCard onPress={() => pick(c)} />
                  ))}
                  <AllLeaguesChip label={t('leagues.all')} onPress={openPicker} />
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

/** Lig seçiciyi açar */
function AllLeaguesChip({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, styles.allChip, { borderColor: theme.accent }]}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>{label} ›</ThemedText>
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  segment: { flexDirection: 'row', gap: Spacing.two },
  soon: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chips: { gap: Spacing.two, paddingVertical: Spacing.one },
  chip: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  allChip: { borderWidth: 1.5 },
  day: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  teams: { flex: 1 },
  oddsRow: { flexDirection: 'row', gap: Spacing.two },
  settings: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
