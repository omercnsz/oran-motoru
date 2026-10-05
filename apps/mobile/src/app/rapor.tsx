// Genel rapor: spor kuponları ve casino oyunları bir arada. "Gerçek parayla oynasaydın" sonucu, birikim grafiği,
// oyun başına geri dönüş oranı (gerçekleşen ve teorik), oyunlarda geçen süre ve jetonun kaç kez bittiği.
import { localDay, tokensToMoney, type Period, type Report } from '@oran/betting';
import { BLACKJACK, CRASH, MINES, PLINKO_RISKS, PLINKO_ROWS, plinkoRtp, ROULETTE, slotMath } from '@oran/games-math';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ReportSummary, useSignedMoney } from '@/components/report-summary';
import { ResultChart } from '@/components/result-chart';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/card';
import { FontFamily } from '@/constants/arena';
import { Spacing } from '@/constants/theme';
import { tokenValueMinor, useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { helplineFor, useT } from '@/i18n';
import { formatPercent, formatTokens } from '@/lib/tokens';
import { useReportSettings } from '@/state/report';

const PERIODS: Period[] = ['month', 'lastMonth', 'all'];
// Mines: çarpan aşağı yuvarlandığı için en fazla %97; Plinko: tabloların en düşüğü (hepsi %96,8–97,0); blackjack: temel stratejiyle
const THEORY: Record<string, number> = {
  crash: 1 - CRASH.houseEdge, roulette: 1 - ROULETTE.houseEdge, slot: slotMath().rtp, mines: 1 - MINES.houseEdge,
  plinko: Math.min(...PLINKO_ROWS.flatMap((r) => PLINKO_RISKS.map((k) => plinkoRtp(r, k)))),
  blackjack: BLACKJACK.basicStrategyRtp,
};
const GAME_TITLE: Record<string, string> = {
  crash: 'games.crash', roulette: 'games.roulette', slot: 'games.slot', mines: 'games.mines', plinko: 'games.plinko', blackjack: 'games.blackjack',
};

export function useDuration() {
  const { t } = useT();
  return (ms: number) => {
    const minutes = Math.max(1, Math.round(ms / 60_000));
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return h > 0 ? t('report.hours', { h, m }) : t('report.minutes', { m });
  };
}

export default function RaporScreen() {
  const { t, money, regionCode } = useT();
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>('month');
  const report = useReport(period);
  const signed = useSignedMoney();
  const empty = report.sports.coupons === 0 && report.gamesRounds === 0;
  const color = (v: number) => (v < 0 ? theme.danger : v > 0 ? theme.success : theme.textSecondary);

  return (
    <Screen title={t('report.title')} compact>
      <View style={[styles.chips, { backgroundColor: theme.backgroundSelected }]}>
        {PERIODS.map((p) => (
          <Pressable key={p} accessibilityRole="tab" accessibilityState={{ selected: period === p }} onPress={() => setPeriod(p)}
            style={[styles.chip, period === p && { backgroundColor: theme.backgroundElement, boxShadow: '0px 2px 6px rgba(15,23,42,0.12)' }]}>
            <ThemedText type="smallBold" style={{ color: period === p ? theme.text : theme.textSecondary }}>{t(`report.${p}`)}</ThemedText>
          </Pressable>
        ))}
      </View>

      {empty ? <ThemedText themeColor="textSecondary">{t('report.empty')}</ThemedText> : (
        <>
          <ReportSummary report={report} />

          <Card>
            <ThemedText type="smallBold">{t('report.chart')}</ThemedText>
            <ResultChart series={report.series} start={report.from ? localDay(report.from.toISOString()) : undefined} format={signed} />
            <ThemedText type="small" themeColor="textSecondary">{t('report.chartNote')}</ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold">{t('report.sports')}</ThemedText>
            <Row label={t('savings.coupons')} value={t('savings.couponsValue', { count: report.sports.coupons, open: report.sports.open })} />
            <Row label={t('savings.staked')} value={money(report.sports.staked)} />
            {report.sports.won + report.sports.lost > 0 ? (
              <>
                <Row label={t('savings.wonLost')} value={`${report.sports.won} / ${report.sports.lost}`} />
                <Row label={t('savings.ifReal')} value={signed(report.sportsMoney)} color={color(report.sportsMoney)} />
              </>
            ) : <ThemedText type="small" themeColor="textSecondary">{t('savings.noSettled')}</ThemedText>}
            {report.otherCurrencyCoupons > 0 ? <ThemedText type="small" themeColor="textSecondary">{t('savings.otherCurrencies')}</ThemedText> : null}
          </Card>

          <GamesCard report={report} />
        </>
      )}

      <ThemedText type="small" themeColor="textSecondary">{t('savings.houseEdge')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('savings.help', helplineFor(regionCode))}</ThemedText>
    </Screen>
  );
}

function GamesCard({ report }: { report: Report }) {
  const { t, currency } = useT();
  const theme = useTheme();
  const duration = useDuration();
  const signed = useSignedMoney();
  const tokenValue = useReportSettings((s) => s.tokenValue);
  const value = tokenValueMinor(tokenValue, currency);
  if (report.gamesRounds === 0 && report.refills === 0) return null;
  return (
    <Card>
      <ThemedText type="smallBold">{t('report.games')}</ThemedText>
      {report.games.map((g) => (
        <View key={g.game} style={styles.game}>
          <View style={styles.row}>
            <ThemedText type="small" style={styles.label}>{t(GAME_TITLE[g.game] ?? g.game)}</ThemedText>
            <ThemedText type="smallBold" style={{ fontFamily: FontFamily.display, color: g.net < 0 ? theme.danger : g.net > 0 ? theme.success : theme.text }}>
              {`${g.net > 0 ? '+' : g.net < 0 ? '−' : ''}${formatTokens(Math.abs(g.net))}`}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('report.gameLine', { rounds: g.rounds, money: signed(tokensToMoney(g.net, value)) })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('games.reportRtp', { actual: formatPercent(g.rtp ?? 0), theory: formatPercent(THEORY[g.game] ?? 0) })}
          </ThemedText>
        </View>
      ))}
      {report.sessions > 0 ? (
        <>
          <Row label={t('report.time')} value={duration(report.playMs)} />
          <Row label={t('report.sessions')} value={`${report.sessions} · ${report.activeDays}`} />
        </>
      ) : null}
      {report.refills > 0 ? <Row label={t('report.refills')} value={String(report.refills)} /> : null}
    </Card>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>{label}</ThemedText>
      <ThemedText type="smallBold" style={color ? { color } : undefined}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', padding: 4, borderRadius: 14 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  label: { flexShrink: 1 },
  game: { gap: 2 },
});
