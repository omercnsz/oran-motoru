// Lig seçici: arama, favoriler ve kıtalara göre tüm turnuvalar. Seçilen turnuva Maçlar ekranında açılır.
import { CONTINENTS, isInRegion } from '@oran/leagues';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AText, ArenaBackground, Glass } from '@/components/arena/kit';
import { ErrorCard } from '@/components/error-card';
import { SectionHead } from '@/components/sport/bits';
import { Arena, FontFamily } from '@/constants/arena';
import { useLeagueIndex } from '@/data/api';
import { useSchedule } from '@/data/live';
import { useNow } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { dayKey, formatShort, formatTime } from '@/lib/format';
import { continentName, fold, leagueInfo, type LeagueInfo } from '@/lib/leagues';
import { useLeagues } from '@/state/leagues';

interface Section { key: string; title: string; rows: LeagueInfo[] }

export default function LiglerScreen() {
  const { t, language, regionCode } = useT();
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const index = useLeagueIndex();
  const schedule = useSchedule();
  const now = useNow();
  const favorites = useLeagues((s) => s.favorites);
  const pick = useLeagues((s) => s.pick);
  const [query, setQuery] = useState('');

  const leagues = useMemo(() => (index.data?.leagues ?? []).map((l) => leagueInfo(l, language)), [index.data, language]);

  // Her turnuvanın sıradaki maçının başlama zamanı
  const next = useMemo(() => {
    const first = new Map<string, number>();
    for (const m of schedule.data?.matches ?? []) {
      const k = Date.parse(m.kickoff);
      if (k > now && k < (first.get(m.league) ?? Infinity)) first.set(m.league, k);
    }
    return first;
  }, [schedule.data, now]);

  const sections = useMemo((): Section[] => {
    const q = fold(query.trim());
    if (q) return [{ key: 'results', title: '', rows: leagues.filter((l) => l.search.includes(q)) }];
    const byCode = new Map(leagues.map((l) => [l.code, l]));
    // Kullanıcının ülkesinin turnuvaları kendi kıtasında en üstte
    const homeFirst = (rows: LeagueInfo[]) => {
      const home = rows.filter((l) => regionCode && isInRegion(l, regionCode));
      return [...home, ...rows.filter((l) => !home.includes(l))];
    };
    return [
      { key: 'favorites', title: t('leagues.favorites'), rows: favorites.flatMap((c) => byCode.get(c) ?? []) },
      { key: 'international', title: t('leagues.international'), rows: leagues.filter((l) => l.continent === 'international') },
      ...CONTINENTS.map((c) => ({ key: c, title: continentName(c, language), rows: homeFirst(leagues.filter((l) => l.continent === c)) })),
    ];
  }, [query, leagues, favorites, regionCode, language, t]);

  const nextLabel = (code: string) => {
    const k = next.get(code);
    if (k === undefined) return schedule.data ? t('leagues.noMatches') : '';
    const iso = new Date(k).toISOString();
    const day = dayKey(iso);
    if (day === dayKey(new Date(now).toISOString())) return t('leagues.today', { time: formatTime(iso) });
    if (day === dayKey(new Date(now + 86_400_000).toISOString())) return t('leagues.tomorrow', { time: formatTime(iso) });
    return formatShort(iso);
  };

  const choose = (code: string) => {
    haptic.select();
    pick(code);
    router.back();
  };

  return (
    <ArenaBackground>
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('leagues.search')}
          placeholderTextColor={Arena.textFaint}
          style={styles.search}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {index.isPending ? <ActivityIndicator color={Arena.neon} /> : null}
        {index.error ? <ErrorCard message={index.error.message} /> : null}
        {query.trim() && sections[0].rows.length === 0 ? (
          <AText dim>{t('leagues.noResults')}</AText>
        ) : null}
        {index.data ? sections.map((s) => (s.rows.length === 0 && s.key !== 'favorites' ? null : (
          <View key={s.key} style={styles.section}>
            {s.title ? <SectionHead title={s.title} color={s.key === 'favorites' ? Arena.gold : Arena.textDim} /> : null}
            {s.rows.length === 0 ? (
              <AText dim style={styles.small}>{t('leagues.favoritesHint')}</AText>
            ) : (
              <Glass style={styles.card}>
                {s.rows.map((l, i) => (
                  <LeagueRow key={l.code} league={l} first={i === 0} selected={l.code === selected}
                    favorite={favorites.includes(l.code)} next={nextLabel(l.code)} hasMatches={next.has(l.code) || !schedule.data}
                    onPress={() => choose(l.code)} />
                ))}
              </Glass>
            )}
          </View>
        ))) : null}
      </ScrollView>
    </ArenaBackground>
  );
}

function LeagueRow({ league, first, selected, favorite, next, hasMatches, onPress }: {
  league: LeagueInfo; first: boolean; selected: boolean; favorite: boolean; next: string; hasMatches: boolean; onPress: () => void;
}) {
  const { t } = useT();
  const toggleFavorite = useLeagues((s) => s.toggleFavorite);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowBorder, selected && styles.rowSelected, { opacity: pressed ? 0.6 : 1 }]}>
      <AText style={styles.flag}>{league.flag}</AText>
      <View style={styles.rowText}>
        <AText style={[styles.name, selected && { color: Arena.neon }, !hasMatches && { color: Arena.textDim }]} numberOfLines={1}>{league.name}</AText>
        <AText dim style={styles.country} numberOfLines={1}>{league.country}</AText>
      </View>
      <AText style={[styles.next, hasMatches && next ? { color: Arena.cyan } : { color: Arena.textFaint }]}>{next}</AText>
      <Pressable accessibilityRole="button" accessibilityLabel={t(favorite ? 'leagues.removeFavorite' : 'leagues.addFavorite')}
        accessibilityState={{ selected: favorite }} hitSlop={12} onPress={() => { haptic.light(); toggleFavorite(league.code); }} style={styles.star}>
        <AText style={[styles.starText, { color: favorite ? Arena.gold : Arena.textFaint }]}>{favorite ? '★' : '☆'}</AText>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  search: {
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, minHeight: 46, textAlign: 'left',
    backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: Arena.glassBorder, color: Arena.text, fontFamily: FontFamily.ui,
  },
  content: { padding: 16, paddingTop: 4, gap: 18, paddingBottom: 128 },
  section: { gap: 10 },
  small: { fontSize: 13, lineHeight: 18 },
  card: { paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58, paddingVertical: 8 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Arena.glassBorder },
  rowSelected: { backgroundColor: 'rgba(43,255,168,0.08)', marginHorizontal: -12, paddingHorizontal: 12 },
  flag: { fontSize: 22, lineHeight: 28 },
  rowText: { flex: 1 },
  name: { fontWeight: '700', fontSize: 15 },
  country: { fontSize: 12 },
  next: { fontSize: 12, fontWeight: '700' },
  star: { paddingHorizontal: 4 },
  starText: { fontSize: 22, lineHeight: 28 },
});
