// Dönem özeti kartı: "gerçek parayla oynasaydın" sonucu, spor ve oyun kırılımı, jeton varsayımı.
// Rapor ekranında ve Kumbara sekmesinde kullanılır.
import { formatMoney, type Report } from '@oran/betting';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
  const color = report.ifReal < 0 ? theme.danger : report.ifReal > 0 ? theme.success : theme.text;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">{t('savings.ifReal')}</ThemedText>
      <ThemedText style={[styles.big, { color }]}>{signed(report.ifReal)}</ThemedText>
      <ThemedText type="small">{t('report.breakdown', { sports: signed(report.sportsMoney), games: signed(report.gamesMoney) })}</ThemedText>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  big: { fontSize: 36, lineHeight: 44, fontWeight: 700 },
});
