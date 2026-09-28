import { formatTL, summarize, type Summary } from '@oran/betting';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCoupons, useSettlement } from '@/hooks/use-coupons';
import { useTheme } from '@/hooks/use-theme';

const monthFmt = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', month: 'long', year: 'numeric' });

export default function KumbaraScreen() {
  useSettlement();
  const theme = useTheme();
  const { coupons, savings } = useCoupons();
  const month = monthFmt.format(new Date());
  const thisMonth = summarize(coupons.filter((c) => monthFmt.format(new Date(c.createdAt)) === month));
  const all = summarize(coupons);

  return (
    <Screen title="Kumbara" subtitle="Bahse yatırmadığın her lira burada.">
      <ThemedView type="backgroundElement" style={styles.hero}>
        <ThemedText type="small" themeColor="textSecondary">Kumbarada</ThemedText>
        <ThemedText style={styles.big}>{formatTL(savings)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Bu para bir bahis sitesine gitmedi. Gerçekten ayırdıysan, senin.
        </ThemedText>
      </ThemedView>

      <Report title={month} summary={thisMonth} />
      <Report title="Başından beri" summary={all} />

      {all.lost + all.won > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Oranlar gerçek bahis sitelerindeki gibi kasa payı içerir: uzun vadede kasa kazanır.
          {all.net < 0 ? ' Bu rakamlar bunu senin kuponlarınla gösteriyor.' : ''}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor={'textSecondary'} style={{ color: theme.textSecondary }}>
        Yardım gerekirse: Yeşilay Danışmanlık Hattı 115 (ücretsiz)
      </ThemedText>
    </Screen>
  );
}

function Report({ title, summary: s }: { title: string; summary: Summary }) {
  const theme = useTheme();
  const settled = s.won + s.lost;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <Row label="Kupon" value={`${s.coupons} (${s.open} açık)`} />
      <Row label="Yatırılacak olan" value={formatTL(s.staked)} />
      {settled > 0 ? (
        <>
          <Row label="Kazanan / kaybeden" value={`${s.won} / ${s.lost}`} />
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">Gerçek parayla oynasaydın</ThemedText>
            <ThemedText type="smallBold" style={{ color: s.net < 0 ? theme.danger : theme.success }}>
              {s.net > 0 ? '+' : ''}{formatTL(s.net)}
            </ThemedText>
          </View>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">Sonuçlanan kupon olunca burada gerçek parayla ne olacağını göreceksin.</ThemedText>
      )}
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.one },
  big: { fontSize: 36, lineHeight: 44, fontWeight: 700 },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
