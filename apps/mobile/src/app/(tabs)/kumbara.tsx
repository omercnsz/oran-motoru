import { StyleSheet } from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { ReportSummary } from '@/components/report-summary';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCoupons, useSettlement } from '@/hooks/use-coupons';
import { useReport } from '@/hooks/use-report';
import { helplineFor, useT } from '@/i18n';

export default function KumbaraScreen() {
  useSettlement();
  const { t, money, regionCode } = useT();
  const { savings } = useCoupons();
  // Bu ayın genel sonucu (spor + oyunlar); ayrıntılar rapor ekranında
  const month = useReport('month');

  return (
    <Screen title={t('savings.title')} subtitle={t('savings.subtitle')}>
      <ThemedView type="backgroundElement" style={styles.hero}>
        <ThemedText type="small" themeColor="textSecondary">{t('savings.inBank')}</ThemedText>
        <ThemedText style={styles.big}>{money(savings)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{t('savings.notToBookie')}</ThemedText>
      </ThemedView>

      <ThemedText type="smallBold">{t('report.month')}</ThemedText>
      <ReportSummary report={month} link />

      <ThemedText type="small" themeColor="textSecondary">{t('savings.houseEdge')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('savings.help', helplineFor(regionCode))}</ThemedText>
      <AdBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.one },
  big: { fontSize: 36, lineHeight: 44, fontWeight: 700 },
});
