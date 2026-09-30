// Lig seçici: arama, favoriler ve kıtalara göre tüm turnuvalar. Seçilen turnuva Maçlar ekranında açılır.
import { CONTINENTS, isInRegion } from '@oran/leagues';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ErrorCard } from '@/components/error-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLeagueIndex } from '@/data/api';
import { useSchedule } from '@/data/live';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { dayKey, formatShort, formatTime } from '@/lib/format';
import { continentName, fold, leagueInfo, type LeagueInfo } from '@/lib/leagues';
import { useLeagues } from '@/state/leagues';

interface Section { key: string; title: string; rows: LeagueInfo[] }

export default function LiglerScreen() {
  const { t, language, regionCode } = useT();
  const theme = useTheme();
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
    pick(code);
    router.back();
  };

  return (
    <ThemedView style={styles.fill}>
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('leagues.search')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {index.isPending ? <ActivityIndicator /> : null}
        {index.error ? <ErrorCard message={index.error.message} /> : null}
        {query.trim() && sections[0].rows.length === 0 ? (
          <ThemedText themeColor="textSecondary">{t('leagues.noResults')}</ThemedText>
        ) : null}
        {index.data ? sections.map((s) => (s.rows.length === 0 && s.key !== 'favorites' ? null : (
          <View key={s.key} style={styles.section}>
            {s.title ? <ThemedText type="smallBold" themeColor="textSecondary">{s.title}</ThemedText> : null}
            {s.rows.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">{t('leagues.favoritesHint')}</ThemedText>
            ) : (
              <ThemedView type="backgroundElement" style={styles.card}>
                {s.rows.map((l, i) => (
                  <LeagueRow key={l.code} league={l} first={i === 0} selected={l.code === selected}
                    favorite={favorites.includes(l.code)} next={nextLabel(l.code)} hasMatches={next.has(l.code) || !schedule.data}
                    onPress={() => choose(l.code)} />
                ))}
              </ThemedView>
            )}
          </View>
        ))) : null}
      </ScrollView>
    </ThemedView>
  );
}

function LeagueRow({ league, first, selected, favorite, next, hasMatches, onPress }: {
  league: LeagueInfo; first: boolean; selected: boolean; favorite: boolean; next: string; hasMatches: boolean; onPress: () => void;
}) {
  const { t } = useT();
  const theme = useTheme();
  const toggleFavorite = useLeagues((s) => s.toggleFavorite);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText style={styles.flag}>{league.flag}</ThemedText>
      <View style={styles.rowText}>
        <ThemedText type={selected ? 'smallBold' : 'small'} style={selected ? { color: theme.accent } : undefined}
          themeColor={hasMatches ? 'text' : 'textSecondary'}>{league.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{league.country}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">{next}</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={t(favorite ? 'leagues.removeFavorite' : 'leagues.addFavorite')}
        accessibilityState={{ selected: favorite }} hitSlop={12} onPress={() => toggleFavorite(league.code)} style={styles.star}>
        <ThemedText style={[styles.starText, { color: favorite ? theme.accent : theme.textSecondary }]}>{favorite ? '★' : '☆'}</ThemedText>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchBar: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  search: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16, minHeight: 44, textAlign: 'left' },
  content: { padding: Spacing.three, paddingTop: Spacing.one, gap: Spacing.four, paddingBottom: Spacing.six * 2 },
  section: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 56, paddingVertical: Spacing.two },
  flag: { fontSize: 22, lineHeight: 28 },
  rowText: { flex: 1 },
  star: { paddingHorizontal: Spacing.one },
  starText: { fontSize: 22, lineHeight: 28 },
});
