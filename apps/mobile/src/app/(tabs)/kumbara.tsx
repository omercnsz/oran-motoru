import { summarize, type Summary } from '@oran/betting';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCoupons, useSettlement } from '@/hooks/use-coupons';
import { useTheme } from '@/hooks/use-theme';
import { helplineFor, useT } from '@/i18n';

export default function KumbaraScreen() {
  useSettlement();
  const { t, money, currency, locale, regionCode } = useT();
  const { coupons: all, savings } = useCoupons();
  // Raporlar sadece seçili para birimindeki kuponları toplar (farklı birimler toplanamaz)
  const coupons = all.filter((c) => c.currency === currency);
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const month = monthFmt.format(new Date());
  const thisMonth = summarize(coupons.filter((c) => monthFmt.format(new Date(c.createdAt)) === month));
  const total = summarize(coupons);
  const helpline = helplineFor(regionCode);

  return (
    <Screen title={t('savings.title')} subtitle={t('savings.subtitle')}>
      <ThemedView type="backgroundElement" style={styles.hero}>
        <ThemedText type="small" themeColor="textSecondary">{t('savings.inBank')}</ThemedText>
        <ThemedText style={styles.big}>{money(savings)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{t('savings.notToBookie')}</ThemedText>
      </ThemedView>

      <Report title={month} summary={thisMonth} />
      <Report title={t('savings.allTime')} summary={total} />

      {all.length > coupons.length ? <ThemedText type="small" themeColor="textSecondary">{t('savings.otherCurrencies')}</ThemedText> : null}
      {total.lost + total.won > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('savings.houseEdge')}{total.net < 0 ? ` ${t('savings.houseEdgeYours')}` : ''}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">{t('savings.help', helpline)}</ThemedText>
    </Screen>
  );
}

function Report({ title, summary: s }: { title: string; summary: Summary }) {
  const theme = useTheme();
  const { t, money } = useT();
  const settled = s.won + s.lost;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <Row label={t('savings.coupons')} value={t('savings.couponsValue', { count: s.coupons, open: s.open })} />
      <Row label={t('savings.staked')} value={money(s.staked)} />
      {settled > 0 ? (
        <>
          <Row label={t('savings.wonLost')} value={`${s.won} / ${s.lost}`} />
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>{t('savings.ifReal')}</ThemedText>
            <ThemedText type="smallBold" style={{ color: s.net < 0 ? theme.danger : theme.success }}>
              {s.net > 0 ? '+' : ''}{money(s.net)}
            </ThemedText>
          </View>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">{t('savings.noSettled')}</ThemedText>
      )}
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>{label}</ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.one },
  big: { fontSize: 36, lineHeight: 44, fontWeight: 700 },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  label: { flexShrink: 1 },
});
