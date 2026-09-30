import { formatMoney, potentialReturn, type SelectionStatus } from '@oran/betting';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { StoredCoupon } from '@/db/coupons';
import { useCoupons, useSettlement } from '@/hooks/use-coupons';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { describeBet, formatShort } from '@/lib/format';

const SELECTION_MARK: Record<SelectionStatus, string> = { open: '•', won: '✓', lost: '✕', void: '↺' };

export default function KuponlarScreen() {
  useSettlement();
  const { t } = useT();
  const { coupons } = useCoupons();
  return (
    <Screen title={t('coupons.title')} subtitle={t('coupons.subtitle')}>
      {coupons.length === 0 ? <ThemedText themeColor="textSecondary">{t('coupons.none')}</ThemedText> : null}
      {coupons.map((c) => <CouponCard key={c.id} coupon={c} />)}
    </Screen>
  );
}

function CouponCard({ coupon: c }: { coupon: StoredCoupon }) {
  const theme = useTheme();
  const { t, odds, locale } = useT();
  // Her kupon kendi para biriminde gösterilir (kullanıcı sonradan para birimini değiştirmiş olabilir)
  const money = (minor: number) => formatMoney(minor, c.currency, locale);
  const color = c.status === 'won' ? theme.success : c.status === 'lost' ? theme.danger : theme.textSecondary;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color }}>{t(`coupons.${c.status}`)}</ThemedText>
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
              <ThemedText type="small" themeColor="textSecondary">{s.live ? `${t('slip.live')} · ` : ''}{bet.market}: {bet.outcome}</ThemedText>
            </View>
            <ThemedText type="small">{odds(s.odds)}</ThemedText>
          </View>
        );
      })}
      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">{t('coupons.stakeOdds', { stake: money(c.stake), odds: odds(c.totalOdds) })}</ThemedText>
        <ThemedText type="smallBold" style={{ color }}>
          {c.status === 'open' ? t('coupons.potential', { amount: money(potentialReturn(c.selections, c.stake)) }) : money(c.payout ?? 0)}
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
