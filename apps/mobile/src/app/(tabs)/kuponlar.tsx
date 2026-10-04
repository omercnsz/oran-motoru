// Kuponlarım (koyu stadyum teması): açık, kazanan ve kaybeden kuponlar; her seçimin durumu ve maç sonucu.
import { formatMoney, potentialReturn, type SelectionStatus } from '@oran/betting';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { AText, ArenaBackground, Glass } from '@/components/arena/kit';
import { Arena, FontFamily, glow } from '@/constants/arena';
import { BottomTabInset } from '@/constants/theme';
import type { StoredCoupon } from '@/db/coupons';
import { useCoupons, useSettlement } from '@/hooks/use-coupons';
import { useT } from '@/i18n';
import { describeBet, formatShort } from '@/lib/format';

/** Reklam afişi bu kadar kupondan sonra (en son kuponlar her zaman üstte, reklamsız) */
const AD_AFTER = 2;

const SELECTION_MARK: Record<SelectionStatus, string> = { open: '•', won: '✓', lost: '✕', void: '↺' };
const STATUS_COLOR = { open: Arena.cyan, won: Arena.gold, lost: Arena.danger } as const;
const MARK_COLOR: Record<SelectionStatus, string> = { open: Arena.textDim, won: Arena.neon, lost: Arena.danger, void: Arena.textDim };

export default function KuponlarScreen() {
  useSettlement();
  const { t } = useT();
  const { coupons } = useCoupons();
  return (
    <ArenaBackground>
      <SafeAreaView edges={['top']} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <AText display style={styles.title}>{t('coupons.title')}</AText>
          <AText dim style={styles.subtitle}>{t('coupons.subtitle')}</AText>
          {coupons.length === 0 ? <Glass style={styles.card}><AText dim>{t('coupons.none')}</AText></Glass> : null}
          {coupons.slice(0, AD_AFTER).map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 50)}><CouponCard coupon={c} /></Animated.View>
          ))}
          <AdBanner />
          {coupons.slice(AD_AFTER).map((c) => <CouponCard key={c.id} coupon={c} />)}
        </ScrollView>
      </SafeAreaView>
    </ArenaBackground>
  );
}

function CouponCard({ coupon: c }: { coupon: StoredCoupon }) {
  const { t, odds, locale } = useT();
  // Her kupon kendi para biriminde gösterilir (kullanıcı sonradan para birimini değiştirmiş olabilir)
  const money = (minor: number) => formatMoney(minor, c.currency, locale);
  const color = STATUS_COLOR[c.status];
  return (
    <Glass style={[styles.card, { borderColor: `${color}40` }, c.status === 'won' && { boxShadow: glow(Arena.gold, 18, 0.25) }]}>
      <View style={styles.header}>
        <View style={[styles.status, { borderColor: `${color}88`, backgroundColor: `${color}1A` }]}>
          <AText style={[styles.statusText, { color }]}>{t(`coupons.${c.status}`)}</AText>
        </View>
        <AText dim style={styles.date}>{formatShort(c.createdAt)}</AText>
      </View>
      {c.selections.map((s) => {
        const bet = describeBet(s.marketKey, s.outcomeKey);
        return (
          <View key={s.matchId} style={styles.selection}>
            <View style={[styles.mark, { borderColor: MARK_COLOR[s.status] }]}>
              <AText style={[styles.markText, { color: MARK_COLOR[s.status] }]}>{SELECTION_MARK[s.status]}</AText>
            </View>
            <View style={styles.selectionText}>
              <AText style={styles.match} numberOfLines={1}>
                {s.home} – {s.away}{s.finalScore ? `  ${s.finalScore.home}-${s.finalScore.away}` : ''}
              </AText>
              <AText dim style={styles.bet} numberOfLines={1}>{s.live ? `${t('slip.live')} · ` : ''}{bet.market}: {bet.outcome}</AText>
            </View>
            <AText style={styles.odds}>{odds(s.odds)}</AText>
          </View>
        );
      })}
      <View style={styles.divider} />
      <View style={styles.footer}>
        <AText dim style={styles.stake}>{t('coupons.stakeOdds', { stake: money(c.stake), odds: odds(c.totalOdds) })}</AText>
        <AText display style={[styles.payout, { color }]}>
          {c.status === 'open' ? t('coupons.potential', { amount: money(potentialReturn(c.selections, c.stake)) }) : money(c.payout ?? 0)}
        </AText>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: BottomTabInset + 48 },
  title: { fontSize: 32, lineHeight: 42, marginTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  card: { padding: 14, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontFamily: FontFamily.display, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  date: { fontSize: 12, fontWeight: '600' },
  selection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  markText: { fontWeight: '900', fontSize: 12 },
  selectionText: { flex: 1 },
  match: { fontWeight: '700', fontSize: 14 },
  bet: { fontSize: 12, lineHeight: 17 },
  odds: { fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: Arena.glassBorder },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  stake: { fontSize: 13 },
  payout: { fontSize: 15, fontVariant: ['tabular-nums'] },
});
