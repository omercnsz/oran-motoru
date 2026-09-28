import { formatTL, potentialReturn, type SelectionStatus } from '@oran/betting';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { StoredCoupon } from '@/db/coupons';
import { useCoupons, useSettlement } from '@/hooks/use-coupons';
import { useTheme } from '@/hooks/use-theme';
import { describeBet, formatOdds, formatShort } from '@/lib/format';

const COUPON_LABEL = { open: 'Açık', won: 'Kazandı', lost: 'Kaybetti' } as const;
const SELECTION_MARK: Record<SelectionStatus, string> = { open: '•', won: '✓', lost: '✕', void: '↺' };

export default function KuponlarScreen() {
  useSettlement();
  const { coupons } = useCoupons();
  return (
    <Screen title="Kuponlar" subtitle="Gölge kuponların: gerçek maçlar, sanal para.">
      {coupons.length === 0 ? (
        <ThemedText themeColor="textSecondary">Henüz kupon yok. Maçlar sekmesinden oran seçerek başla.</ThemedText>
      ) : null}
      {coupons.map((c) => <CouponCard key={c.id} coupon={c} />)}
    </Screen>
  );
}

function CouponCard({ coupon: c }: { coupon: StoredCoupon }) {
  const theme = useTheme();
  const color = c.status === 'won' ? theme.success : c.status === 'lost' ? theme.danger : theme.textSecondary;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color }}>{COUPON_LABEL[c.status]}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{formatShort(c.createdAt)}</ThemedText>
      </View>
      {c.selections.map((s) => {
        const bet = describeBet(s.marketKey, s.outcomeKey);
        const markColor = s.status === 'won' ? theme.success : s.status === 'lost' ? theme.danger : theme.textSecondary;
        return (
          <View key={s.matchId} style={styles.selection}>
            <ThemedText type="smallBold" style={[styles.mark, { color: markColor }]}>{SELECTION_MARK[s.status]}</ThemedText>
            <View style={styles.selectionText}>
              <ThemedText type="small">
                {s.home} – {s.away}{s.finalScore ? `  ${s.finalScore.home}-${s.finalScore.away}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{s.live ? 'Canlı · ' : ''}{bet.market}: {bet.outcome}</ThemedText>
            </View>
            <ThemedText type="small">{formatOdds(s.odds)}</ThemedText>
          </View>
        );
      })}
      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">Tutar {formatTL(c.stake)} · Oran {formatOdds(c.totalOdds)}</ThemedText>
        <ThemedText type="smallBold" style={{ color }}>
          {c.status === 'open' ? `Olası ${formatTL(potentialReturn(c.selections, c.stake))}` : formatTL(c.payout ?? 0)}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  selection: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mark: { width: 16, textAlign: 'center' },
  selectionText: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.one },
});
