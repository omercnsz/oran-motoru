// Maçlar: koyu stadyum teması. Üstte maç öncesi / canlı seçimi ve lig çubuğu; maçlar gün gün, takım rozetleri ve
// 1X2 oranlarıyla. Seçilen lig yoksa yakında maçı olan ligler önerilir.
import type { UpcomingMatch } from '@oran/contracts';
import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AText, ArenaBackground, Glass } from '@/components/arena/kit';
import { ErrorCard } from '@/components/error-card';
import { LiveList } from '@/components/live-list';
import { OddsButton } from '@/components/odds-button';
import { SlipBar } from '@/components/slip-bar';
import { betsCount, FeaturedCarousel, LiveTicker, ProbabilityBar, SearchResults } from '@/components/sport/home';
import { TeamBadge } from '@/components/sport/team-badge';
import { Arena, FontFamily, glow } from '@/constants/arena';
import { BottomTabInset } from '@/constants/theme';
import { useLeagueIndex, useOdds } from '@/data/api';
import { useSchedule } from '@/data/live';
import { useNow } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
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
  const [query, setQuery] = useState('');
  // Kontrolsüz alan: hızlı yazarken harf kaybolmasın (ekran yeniden çizilirken yazılanı ezmez)
  const searchRef = useRef<TextInput>(null);
  const searching = query.trim().length >= 2;
  const leagueNames = useMemo(() => Object.fromEntries((index.data?.leagues ?? []).map((l) => [l.code, l.name])), [index.data]);
  const infos = useMemo(() => Object.fromEntries((index.data?.leagues ?? []).map((l) => [l.code, leagueInfo(l, language)])), [index.data, language]);
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
    chipsRef.current?.scrollTo({ x: Math.max(0, chip.x - 16), animated });
  }, []);
  useEffect(() => reveal(league, true), [reveal, league, quick]);
  const now = useNow();
  const schedule = useSchedule();
  // Önümüzdeki 36 saatte maçı olan ligler (maç sayısıyla), en yakın maça göre sıralı
  const soonLeagues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of schedule.data?.matches ?? []) {
      const k = Date.parse(m.kickoff);
      if (k > now && k <= now + 36 * 3_600_000) counts.set(m.league, (counts.get(m.league) ?? 0) + 1);
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
  const chipLabel = (code: string) => (infos[code] ? `${infos[code].flag} ${infos[code].name}` : code);

  return (
    <ArenaBackground>
      <SafeAreaView edges={['top']} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.fill}>
              <AText display style={styles.title}>{t('matches.title')}</AText>
              <AText dim style={styles.subtitle}>{t('matches.subtitle')}</AText>
            </View>
            <SettingsButton />
          </View>

          <View style={styles.searchBox}>
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search' }} size={18} tintColor={Arena.textDim}
              fallback={<Text style={styles.searchIcon}>⌕</Text>} />
            <TextInput ref={searchRef} defaultValue="" onChangeText={setQuery} placeholder={t('matches.search')} placeholderTextColor={Arena.textFaint}
              style={styles.searchInput} autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing" />
          </View>

          {searching ? (
            <SearchResults query={query} schedule={schedule.data?.matches ?? []} infos={infos} now={now}
              onLeague={(code) => { searchRef.current?.clear(); searchRef.current?.blur(); setQuery(''); setMode('pre'); pick(code); }} />
          ) : <Segmented mode={mode} onChange={setMode} />}

          {index.isPending ? <ActivityIndicator color={Arena.neon} /> : null}
          {index.error ? <ErrorCard message={index.error.message} /> : null}

          {!searching && mode === 'live' ? <LiveList now={now} leagueNames={leagueNames} /> : null}

          {!searching && mode === 'pre' ? <>
            <LiveTicker now={now} />
            <FeaturedCarousel favorites={favorites} infos={infos} now={now} />

            <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}
              style={styles.chipsScroll} scrollEventThrottle={32}
              onScroll={(e) => { chipsView.current.offset = e.nativeEvent.contentOffset.x; }}
              onLayout={(e) => { chipsView.current.width = e.nativeEvent.layout.width; reveal(league, false); }}>
              {index.data ? <AllLeaguesChip label={t('leagues.all')} onPress={openPicker} /> : null}
              {quick.map((code) => (
                <View key={code} onLayout={(e) => {
                  chipLayout.current.set(code, { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width });
                  if (code === league) reveal(code, false);
                }}>
                  <LeagueChip label={chipLabel(code)} active={code === league} onPress={() => pick(code)} />
                </View>
              ))}
            </ScrollView>

            {odds.isPending && league ? <ActivityIndicator color={Arena.neon} /> : null}

            {league && odds.data && !soonLeagues.has(league) ? (
              <Glass style={styles.card}>
                <AText style={styles.notSoon}>
                  {days.length > 0
                    ? t('matches.notSoon', { league: leagueNames[league] ?? league, date: formatDay(days[0][1][0].kickoff) })
                    : t('matches.none14')}
                </AText>
                {suggestions.length > 0 ? (
                  <>
                    <AText dim style={styles.small}>{t('matches.soonLeagues')}</AText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.soonScroll} contentContainerStyle={styles.soon}>
                      {suggestions.map((c) => (
                        <LeagueChip key={c} label={`${chipLabel(c)} · ${soonLeagues.get(c)}`} active={false} onPress={() => pick(c)} />
                      ))}
                      <AllLeaguesChip label={t('leagues.all')} onPress={openPicker} />
                    </ScrollView>
                  </>
                ) : null}
              </Glass>
            ) : null}

            {days.map(([day, matches], d) => (
              <View key={day} style={styles.day}>
                <View style={styles.dayHead}>
                  <AText style={styles.dayText}>{day}</AText>
                  <View style={styles.dayLine} />
                </View>
                {matches.map((m, i) => (
                  <Animated.View key={m.id} entering={d === 0 && i < 6 ? FadeInDown.delay(i * 50).duration(260) : undefined}>
                    <MatchCard league={league!} match={m} />
                  </Animated.View>
                ))}
              </View>
            ))}
          </> : null}
        </ScrollView>
      </SafeAreaView>
      <SlipBar />
    </ArenaBackground>
  );
}

function MatchCard({ league, match }: { league: string; match: UpcomingMatch }) {
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const { t } = useT();
  return (
    <Glass style={styles.card}>
      <Link href={{ pathname: '/mac/[id]', params: { id: match.id, league } }} asChild>
        <Pressable accessibilityRole="link" style={styles.matchTop}>
          <View style={styles.teams}>
            <View style={styles.teamRow}>
              <TeamBadge name={match.home} style={match.homeStyle} />
              <AText style={styles.team} numberOfLines={1}>{match.home}</AText>
            </View>
            <View style={styles.teamRow}>
              <TeamBadge name={match.away} style={match.awayStyle} />
              <AText style={styles.team} numberOfLines={1}>{match.away}</AText>
            </View>
          </View>
          <View style={styles.side}>
            <View style={styles.timePill}>
              <AText style={styles.time}>{formatTime(match.kickoff)}</AText>
            </View>
            <AText style={styles.more}>{t('matches.betsCount', { count: betsCount(match) })} ›</AText>
          </View>
        </Pressable>
      </Link>
      <ProbabilityBar match={match} labels={false} />
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
    </Glass>
  );
}

/** Maç öncesi / canlı seçimi; canlı tarafında yanıp sönen kırmızı nokta */
function Segmented({ mode, onChange }: { mode: 'pre' | 'live'; onChange: (m: 'pre' | 'live') => void }) {
  const { t } = useT();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const item = (m: 'pre' | 'live', label: string) => {
    const active = mode === m;
    return (
      <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: active }}
        onPress={() => { if (!active) { haptic.select(); onChange(m); } }}
        style={[styles.segment, active && styles.segmentActive]}>
        {m === 'live' ? <Animated.View style={[styles.liveDot, dot]} /> : null}
        <Text style={[styles.segmentText, active && { color: Arena.onNeon }]}>{label}</Text>
      </Pressable>
    );
  };
  return <View style={styles.segmented}>{item('pre', t('matches.preMatch'))}{item('live', t('matches.live'))}</View>;
}

function LeagueChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }}
      onPress={() => { haptic.select(); onPress(); }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.chipText, active && { color: Arena.neon }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Lig seçiciyi açar */
function AllLeaguesChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => { haptic.select(); onPress(); }}
      style={({ pressed }) => [styles.chip, styles.allChip, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.chipText, { color: Arena.cyan }]}>{label} ›</Text>
    </Pressable>
  );
}

function SettingsButton() {
  const { t } = useT();
  return (
    <Link href="/ayarlar" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={t('settings.title')} hitSlop={12} style={styles.settings}>
        <SymbolView name={{ ios: 'gearshape.fill', android: 'settings' }} size={20} tintColor={Arena.text}
          fallback={<Text style={styles.gear}>⚙︎</Text>} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: BottomTabInset + 110 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  title: { fontSize: 32, lineHeight: 42 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  settings: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Arena.glassStrong, borderWidth: 1, borderColor: Arena.glassBorder,
  },
  gear: { color: Arena.text, fontSize: 20 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 16, minHeight: 46,
    backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: Arena.glassBorder,
  },
  searchIcon: { color: Arena.textDim, fontSize: 18 },
  searchInput: { flex: 1, color: Arena.text, fontFamily: FontFamily.ui, fontSize: 16, paddingVertical: 10, textAlign: 'left' },
  segmented: {
    flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: Arena.glassBorder,
  },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12 },
  segmentActive: {
    experimental_backgroundImage: `linear-gradient(135deg, ${Arena.neon} 0%, ${Arena.neonDeep} 100%)`, boxShadow: glow(Arena.neon, 14, 0.35),
  },
  segmentText: { color: Arena.textDim, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 15 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Arena.danger, boxShadow: glow(Arena.danger, 8, 0.9) },
  chipsScroll: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: Arena.glass, borderWidth: 1, borderColor: Arena.glassBorder,
  },
  chipActive: { borderColor: Arena.neon, backgroundColor: 'rgba(43,255,168,0.10)', boxShadow: glow(Arena.neon, 12, 0.35) },
  allChip: { borderColor: 'rgba(61,217,255,0.5)', borderStyle: 'dashed' },
  chipText: { color: Arena.text, fontFamily: FontFamily.ui, fontWeight: '700', fontSize: 14 },
  card: { padding: 14, gap: 12 },
  notSoon: { fontWeight: '700', fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  soonScroll: { marginHorizontal: -14 },
  soon: { gap: 8, paddingHorizontal: 14 },
  day: { gap: 10 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  dayText: { color: Arena.textDim, fontFamily: FontFamily.display, fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  dayLine: { flex: 1, height: 1, backgroundColor: Arena.glassBorder },
  matchTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teams: { flex: 1, gap: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  team: { flex: 1, fontWeight: '700', fontSize: 15 },
  side: { alignItems: 'flex-end', gap: 8 },
  timePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(61,217,255,0.12)', borderWidth: 1, borderColor: 'rgba(61,217,255,0.35)' },
  time: { color: Arena.cyan, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  more: { color: Arena.textDim, fontSize: 12, fontWeight: '600' },
  oddsRow: { flexDirection: 'row', gap: 8 },
});
