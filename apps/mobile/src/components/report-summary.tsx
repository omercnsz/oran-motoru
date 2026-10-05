// Dönem özeti kartı: "gerçek parayla oynasaydın" sonucu, spor ve oyun kırılımı, jeton varsayımı.
// Rapor ekranında ve Kumbara sekmesinde kullanılır.
import { formatMoney, type Report } from '@oran/betting';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { FontFamily } from '@/constants/arena';
import { tokenValueMinor } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useReportSettings } from '@/state/report';

/** "+12,50 ₺" / "−30,00 ₺" */
export function useSignedMoney() {
  const { money } = useT();
  return (minor: number) => `${minor > 0 ? '+' : minor < 0 ? '−' : ''}${money(Math.abs(minor))}`;
}

/** Dönemin özeti: gerçek parayla sonuç, spor ve oyun kırılımı, jeton varsayımı (Kumbara sekmesinde de kullanılır) */
export function ReportSummary({ report, link }: { report: Report; link?: boolean }) {
  const { t, currency, locale } = useT();
  const theme = useTheme();
  const signed = useSignedMoney();
  const tokenValue = useReportSettings((s) => s.tokenValue);
  const tone = (v: number) => (v < 0 ? theme.danger : v > 0 ? theme.success : theme.text);
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">{t('savings.ifReal')}</ThemedText>
      <ThemedText style={[styles.big, { color: tone(report.ifReal) }]}>{signed(report.ifReal)}</ThemedText>
      <View style={[styles.split, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" style={styles.splitText}>{t('report.breakdown', { sports: signed(report.sportsMoney), games: signed(report.gamesMoney) })}</ThemedText>
      </View>
      {report.gamesRounds > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('report.tokenNote', { value: formatMoney(tokenValueMinor(tokenValue, currency), currency, locale) })}
        </ThemedText>
      ) : null}
      {link ? (
        <Link href="/rapor" asChild>
          <Pressable accessibilityRole="link" hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>{t('report.open')}</ThemedText>
          </Pressable>
        </Link>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  big: { fontFamily: FontFamily.display, fontSize: 34, lineHeight: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  split: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  splitText: { fontWeight: '600' },
});
