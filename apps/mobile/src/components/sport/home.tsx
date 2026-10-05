// Maçlar ana sayfasının parçaları: canlı skor şeridi, öne çıkan maçlar karuseli, arama sonuçları, olasılık çubuğu.
import type { ScheduledMatch, UpcomingMatch } from '@oran/contracts';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInRight, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { AText } from '@/components/arena/kit';
import { OddsButton } from '@/components/odds-button';
import { SectionHead } from '@/components/sport/bits';
import { TeamBadge, teamAbbr, teamColors } from '@/components/sport/team-badge';
import { Arena, FontFamily, glow } from '@/constants/arena';
import { useOddsMany } from '@/data/api';
import { activeMatches, useLive } from '@/data/live';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { clockLabel, dayKey, formatShort, formatTime } from '@/lib/format';
import { fold, type LeagueInfo } from '@/lib/leagues';
import { toSelection } from '@/lib/selection';
import { isSelected, useSlip } from '@/state/slip';

const ONE_X_TWO = ['1', 'X', '2'] as const;

/** Maçta açık bahis sayısı ("+N bahis") */
export const betsCount = (m: UpcomingMatch) =>
  Object.values(m.markets).reduce((n, outcomes) => n + Object.values(outcomes).filter(Boolean).length, 0);

/** 1X2 oranlarından olasılıklar (kâr payı çıkarılmış) */
export function probabilities(m: UpcomingMatch): [number, number, number] | null {
  const o = m.markets['1X2'];
  if (!o?.['1'] || !o.X || !o['2']) return null;
  const inv = [1 / o['1'], 1 / o.X, 1 / o['2']];
  const sum = inv[0] + inv[1] + inv[2];
  return [inv[0] / sum, inv[1] / sum, inv[2] / sum];
}

/** Ev sahibi / beraberlik / deplasman olasılık çubuğu, takım renklerinde */
export function ProbabilityBar({ match, labels = true }: { match: UpcomingMatch; labels?: boolean }) {
  const p = probabilities(match);
  if (!p) return null;
  const home = teamColors(match.home, match.homeStyle).fill;
  const away = teamColors(match.away, match.awayStyle).fill;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <View style={styles.prob} accessibilityLabel={`${match.home} ${pct(p[0])}, X ${pct(p[1])}, ${match.away} ${pct(p[2])}`}>
      <View style={styles.probBar}>
        <View style={{ flex: p[0], backgroundColor: home }} />
        <View style={{ flex: p[1], backgroundColor: '#5D6B8A' }} />
        <View style={{ flex: p[2], backgroundColor: away }} />
      </View>
      {labels ? (
        <View style={styles.probLabels}>
          <Text style={styles.probText}>{pct(p[0])}</Text>
          <Text style={styles.probText}>{pct(p[1])}</Text>
          <Text style={styles.probText}>{pct(p[2])}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Şu an oynanan maçlar: dakika ve skorla kayan şerit */
export function LiveTicker({ now }: { now: number }) {
  const { t } = useT();
  const live = useLive(now);
  const rows = (live.data?.rows ?? []).filter((r) => r.event.state === 'in');
  if (rows.length === 0) return null;
  return (
    <View style={styles.block}>
      <SectionHead title={t('matches.liveNow')} color="#FF8FA3" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.tickerRow}>
        {rows.map(({ match: m, event: e }, i) => (
          <Animated.View key={m.espnId} entering={FadeInRight.delay(i * 40)}>
            <Pressable accessibilityRole="link" onPress={() => { haptic.select(); router.push({ pathname: '/canli/[espnId]', params: { espnId: m.espnId } }); }}
              style={({ pressed }) => [styles.tick, { opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.tickHead}>
                <LiveDot />
                <Text style={styles.tickClock}>{clockLabel(e)}</Text>
              </View>
              {(['home', 'away'] as const).map((side) => (
                <View key={side} style={styles.tickTeam}>
                  <TeamBadge name={m[side]} style={e[`${side}Style`] ?? m[`${side}Style`]} size={20} />
                  <Text style={styles.tickName} numberOfLines={1}>{teamAbbr(m[side], e[`${side}Style`] ?? m[`${side}Style`])}</Text>
                  <Text style={styles.tickScore}>{e.score[side]}</Text>
                </View>
              ))}
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

function LiveDot() {
  const v = useSharedValue(1);
  useEffect(() => { v.value = withRepeat(withSequence(withTiming(0.25, { duration: 650 }), withTiming(1, { duration: 650 })), -1); }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * Öne çıkan maçlar: favori liglerin önümüzdeki 48 saatteki maçları (yoksa 7 gün), favori sırasına ve saate göre,
 * her ligden en fazla iki.
 * Büyük kartlar yana kayar; takım renklerinde zemin, olasılık çubuğu ve 1X2 oranları.
 */
export function FeaturedCarousel({ favorites, infos, now }: { favorites: string[]; infos: Record<string, LeagueInfo>; now: number }) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const leagues = useMemo(() => favorites.slice(0, 8), [favorites]);
  const queries = useOddsMany(leagues);
  const dataKey = queries.map((q) => q.dataUpdatedAt).join(',');
  const featured = useMemo(() => {
    const all: { league: string; rank: number; match: UpcomingMatch }[] = [];
    queries.forEach((q, rank) => {
      for (const m of q.data?.matches ?? []) all.push({ league: leagues[rank], rank, match: m });
    });
    const pick = (hours: number) => all
      .filter(({ match }) => { const k = Date.parse(match.kickoff); return k > now && k <= now + hours * 3_600_000; })
      .sort((a, b) => a.rank - b.rank || a.match.kickoff.localeCompare(b.match.kickoff));
    // Her ligden en fazla iki maç: karusel tek bir lige kalmasın
    const varied = (list: typeof all) => {
      const per = new Map<string, number>();
      return list.filter(({ league }) => { const n = per.get(league) ?? 0; per.set(league, n + 1); return n < 2; });
    };
    const soon = varied(pick(48));
    return (soon.length >= 3 ? soon : varied(pick(24 * 7))).slice(0, 8);
    // dataKey: sorgular yenilenince yeniden hesapla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, leagues, now]);
  if (featured.length === 0) return null;
  const cardWidth = Math.min(340, width * 0.84);
  return (
    <View style={styles.block}>
      <SectionHead title={t('matches.featured')} color={Arena.gold} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.featuredRow}
        snapToInterval={cardWidth + 12} decelerationRate="fast">
        {featured.map(({ league, match }, i) => (
          <Animated.View key={match.id} entering={FadeInRight.delay(i * 60).duration(320)}>
            <FeaturedCard league={league} info={infos[league]} match={match} width={cardWidth} now={now} />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

function FeaturedCard({ league, info, match, width, now }: { league: string; info?: LeagueInfo; match: UpcomingMatch; width: number; now: number }) {
  const { t } = useT();
  const slip = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const home = teamColors(match.home, match.homeStyle).fill;
  const away = teamColors(match.away, match.awayStyle).fill;
  const day = dayKey(match.kickoff);
  const when = day === dayKey(new Date(now).toISOString()) ? t('leagues.today', { time: formatTime(match.kickoff) })
    : day === dayKey(new Date(now + 86_400_000).toISOString()) ? t('leagues.tomorrow', { time: formatTime(match.kickoff) })
      : formatShort(match.kickoff);
  return (
    <Pressable accessibilityRole="link" onPress={() => { haptic.select(); router.push({ pathname: '/mac/[id]', params: { id: match.id, league } }); }}
      style={({ pressed }) => [styles.card, { width, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        experimental_backgroundImage: `linear-gradient(120deg, ${home}66 0%, ${home}14 38%, ${away}14 62%, ${away}66 100%)`,
      }]} />
      <View style={styles.cardTop}>
        <Text style={styles.cardLeague} numberOfLines={1}>{info ? `${info.flag} ${info.name}` : league}</Text>
        <View style={styles.whenPill}><Text style={styles.when}>{when}</Text></View>
      </View>
      <View style={styles.versus}>
        <View style={styles.side}>
          <TeamBadge name={match.home} style={match.homeStyle} size={52} />
          <AText style={styles.cardTeam} numberOfLines={2}>{match.home}</AText>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.side}>
          <TeamBadge name={match.away} style={match.awayStyle} size={52} />
          <AText style={styles.cardTeam} numberOfLines={2}>{match.away}</AText>
        </View>
      </View>
      <ProbabilityBar match={match} />
      <View style={styles.oddsRow}>
        {ONE_X_TWO.map((key) => (
          <OddsButton key={key} label={key} odds={match.markets['1X2']?.[key] ?? null}
            selected={isSelected(slip, match.id, '1X2', key)}
            onPress={() => { const s = toSelection(league, match, '1X2', key); if (s) toggle(s); }} />
        ))}
      </View>
      <Text style={styles.count}>{t('matches.betsCount', { count: betsCount(match) })} ›</Text>
    </Pressable>
  );
}

/** Arama: takım adı ya da lig. Ligler seçilince o lig açılır; maçlar maç ekranını (oynanıyorsa canlı ekranı) açar. */
export function SearchResults({ query, schedule, infos, now, onLeague }: {
  query: string; schedule: ScheduledMatch[]; infos: Record<string, LeagueInfo>; now: number; onLeague: (code: string) => void;
}) {
  const { t } = useT();
  const q = fold(query.trim());
  const leagues = Object.values(infos).filter((l) => l.search.includes(q)).slice(0, 6);
  const live = new Set(activeMatches({ updatedAt: '', matches: schedule }, now).map((m) => m.espnId));
  const matches = schedule
    .filter((m) => (Date.parse(m.kickoff) > now || live.has(m.espnId)) && (fold(m.home).includes(q) || fold(m.away).includes(q)))
    .slice(0, 30);
  if (leagues.length === 0 && matches.length === 0) return <AText dim>{t('matches.noResults')}</AText>;
  return (
    <View style={styles.block}>
      {leagues.map((l) => (
        <Pressable key={l.code} onPress={() => { haptic.select(); onLeague(l.code); }} style={({ pressed }) => [styles.result, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={styles.flag}>{l.flag}</Text>
          <View style={styles.flex}>
            <AText style={styles.resultTitle}>{l.name}</AText>
            <AText dim style={styles.resultSub}>{l.country}</AText>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      ))}
      {matches.map((m) => {
        const isLive = live.has(m.espnId) && Date.parse(m.kickoff) <= now;
        return (
          <Pressable key={m.id} onPress={() => {
            haptic.select();
            if (isLive) router.push({ pathname: '/canli/[espnId]', params: { espnId: m.espnId } });
            else router.push({ pathname: '/mac/[id]', params: { id: m.id, league: m.league } });
          }} style={({ pressed }) => [styles.result, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={styles.pair}>
              <TeamBadge name={m.home} style={m.homeStyle} size={26} />
              <View style={styles.pairBack}><TeamBadge name={m.away} style={m.awayStyle} size={26} /></View>
            </View>
            <View style={styles.flex}>
              <AText style={styles.resultTitle} numberOfLines={1}>{m.home} – {m.away}</AText>
              <AText dim style={styles.resultSub} numberOfLines={1}>
                {infos[m.league] ? `${infos[m.league].flag} ${infos[m.league].name}` : m.league} · {formatShort(m.kickoff)}
              </AText>
            </View>
            {isLive ? <LiveDot /> : <Text style={styles.chev}>›</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: 10 },
  bleed: { marginHorizontal: -16 },
  tickerRow: { gap: 8, paddingHorizontal: 16 },
  tick: {
    width: 128, padding: 10, gap: 6, borderRadius: 16, backgroundColor: 'rgba(255,77,109,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,77,109,0.35)',
  },
  tickHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tickClock: { color: '#FF8FA3', fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },
  tickTeam: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tickName: { flex: 1, color: Arena.text, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 13 },
  tickScore: { color: Arena.text, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Arena.danger, boxShadow: glow(Arena.danger, 8, 0.9) },
  featuredRow: { gap: 12, paddingHorizontal: 16, paddingVertical: 2 },
  card: {
    borderRadius: 24, padding: 14, gap: 12, overflow: 'hidden', backgroundColor: '#0E1530',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', boxShadow: '0px 10px 24px rgba(0,0,0,0.45)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLeague: { flex: 1, color: Arena.textDim, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 12 },
  whenPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.35)' },
  when: { color: Arena.cyan, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 12 },
  versus: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, alignItems: 'center', gap: 6 },
  cardTeam: { fontWeight: '800', fontSize: 14, textAlign: 'center', lineHeight: 18 },
  vs: { color: Arena.textFaint, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 16, marginHorizontal: 4 },
  prob: { gap: 4 },
  probBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 },
  probLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  probText: { color: Arena.textDim, fontFamily: FontFamily.ui, fontWeight: '700', fontSize: 11, fontVariant: ['tabular-nums'] },
  oddsRow: { flexDirection: 'row', gap: 8 },
  count: { color: Arena.textDim, fontFamily: FontFamily.ui, fontWeight: '700', fontSize: 12, textAlign: 'right', marginTop: -2 },
  result: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16,
    backgroundColor: Arena.glass, borderWidth: 1, borderColor: Arena.glassBorder,
  },
  resultTitle: { fontWeight: '700', fontSize: 15 },
  resultSub: { fontSize: 12 },
  flag: { fontSize: 22 },
  chev: { color: Arena.textDim, fontSize: 20, fontWeight: '700' },
  pair: { width: 40, height: 34 },
  pairBack: { position: 'absolute', left: 14, top: 8 },
});
