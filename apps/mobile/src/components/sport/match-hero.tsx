// Maç detayı ve canlı maç ekranlarının üst bölümü: büyük takım rozetleri, ortada saat ya da skor.
import type { TeamStyle } from '@oran/contracts';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AText, Glass } from '@/components/arena/kit';
import { TeamBadge } from '@/components/sport/team-badge';
import { Arena, FontFamily } from '@/constants/arena';

export function MatchHero({ league, home, away, homeStyle, awayStyle, center, below }: {
  league?: string; home: string; away: string; homeStyle?: TeamStyle; awayStyle?: TeamStyle;
  /** Ortadaki büyük yazı: saat ya da skor */
  center: ReactNode;
  /** Ortadaki küçük satır: gün, dakika… */
  below?: ReactNode;
}) {
  return (
    <Glass strong style={styles.hero}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow]} />
      {league ? <AText dim style={styles.league} numberOfLines={1}>{league}</AText> : null}
      <View style={styles.row}>
        <View style={styles.side}>
          <TeamBadge name={home} style={homeStyle} size={58} />
          <AText style={styles.team} numberOfLines={2}>{home}</AText>
        </View>
        <View style={styles.center}>
          {typeof center === 'string' ? <AText display style={styles.big}>{center}</AText> : center}
          {below}
        </View>
        <View style={styles.side}>
          <TeamBadge name={away} style={awayStyle} size={58} />
          <AText style={styles.team} numberOfLines={2}>{away}</AText>
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 16, gap: 12, overflow: 'hidden' },
  glow: { experimental_backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(43,255,168,0.16) 0%, rgba(43,255,168,0) 65%)' },
  league: { textAlign: 'center', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { flex: 1, alignItems: 'center', gap: 8 },
  team: { fontWeight: '800', fontSize: 14, textAlign: 'center', lineHeight: 18 },
  center: { alignItems: 'center', gap: 6, minWidth: 92 },
  big: { fontSize: 30, lineHeight: 38, color: Arena.text, fontFamily: FontFamily.display, fontVariant: ['tabular-nums'] },
});
