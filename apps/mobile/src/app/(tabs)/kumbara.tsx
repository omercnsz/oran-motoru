// Kumbara: bahse gitmeyen para. Üstte biriken tutar, altında bu ayın "gerçek parayla oynasaydın" özeti.
// Sade ve güven veren görünüm (telefonun açık/koyu ayarını izler).
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AdBanner } from '@/components/ad-banner';
import { ReportSummary } from '@/components/report-summary';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { FontFamily } from '@/constants/arena';
import { useCountUp } from '@/components/arena/kit';
import { useCoupons, useSettlement } from '@/hooks/use-coupons';
import { useReport } from '@/hooks/use-report';
import { helplineFor, useT } from '@/i18n';

export default function KumbaraScreen() {
  useSettlement();
  const { t, money, regionCode } = useT();
  const { savings } = useCoupons();
  const shown = useCountUp(savings, 900);
  // Bu ayın genel sonucu (spor + oyunlar); ayrıntılar rapor ekranında
  const month = useReport('month');

  return (
    <Screen title={t('savings.title')} subtitle={t('savings.subtitle')}>
      <Animated.View entering={FadeInDown.duration(350)} style={styles.hero}>
        {/* Arka planda yumuşak daireler: derinlik */}
        <View pointerEvents="none" style={[styles.circle, styles.circleA]} />
        <View pointerEvents="none" style={[styles.circle, styles.circleB]} />
        <ThemedText style={styles.heroLabel}>{t('savings.inBank')}</ThemedText>
        <ThemedText style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{money(shown)}</ThemedText>
        <ThemedText style={styles.heroNote}>{t('savings.notToBookie')}</ThemedText>
      </Animated.View>

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>{t('report.month')}</ThemedText>
      <Animated.View entering={FadeInDown.delay(80).duration(350)}>
        <ReportSummary report={month} link />
      </Animated.View>

      <ThemedText type="small" themeColor="textSecondary">{t('savings.houseEdge')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('savings.help', helplineFor(regionCode))}</ThemedText>
      <AdBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 26, padding: 24, gap: 6, overflow: 'hidden',
    experimental_backgroundImage: 'linear-gradient(135deg, #14A06E 0%, #0E7C55 45%, #075238 100%)',
    boxShadow: '0px 12px 28px rgba(14,124,85,0.35)',
  },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  circleA: { width: 220, height: 220, right: -70, top: -90 },
  circleB: { width: 140, height: 140, right: 40, bottom: -80 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 14 },
  amount: { color: '#ffffff', fontFamily: FontFamily.display, fontWeight: '800', fontSize: 42, lineHeight: 52, fontVariant: ['tabular-nums'] },
  heroNote: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  section: { letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
});
