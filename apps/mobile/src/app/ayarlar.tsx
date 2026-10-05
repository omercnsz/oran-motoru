import { formatMoney, formatOdds, minorDigits, type OddsFormat } from '@oran/betting';
import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CURRENCIES, deviceDefaults, LANGUAGES, useT, type Preferences } from '@/i18n';
import { showAdPrivacyOptions, useAds } from '@/ads';
import { tokenValueMinor } from '@/hooks/use-report';
import { syncReminders, useReminders } from '@/notifications';
import { useFeedback } from '@/state/feedback';
import { TOKEN_VALUES, useReportSettings } from '@/state/report';

const ODDS_FORMATS: OddsFormat[] = ['decimal', 'fractional', 'american'];

export default function AyarlarScreen() {
  const { t, prefs, setPreference, currency, locale, needsRestart } = useT();
  const { tokenValue, setTokenValue } = useReportSettings();
  // Kuruşu olmayan para biriminde (¥, ₩) 0,10 seçeneği gösterilmez
  const tokenValues = TOKEN_VALUES.filter((v) => v >= 1 || minorDigits(currency) > 0);
  // "Otomatik" seçeneği cihazın varsayılanını gösterir (o an seçili olanı değil)
  const auto = deviceDefaults();
  const deviceCurrency = auto.currency;
  const currencies = CURRENCIES.includes(deviceCurrency) ? CURRENCIES : [deviceCurrency, ...CURRENCIES];
  const languageName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
  const oddsLabel = (f: OddsFormat) => `${t(`settings.${f}`)} (${formatOdds(2.5, f)})`;

  return (
    <Screen title={t('settings.title')} compact>
      <NotificationsSection />
      <FeedbackSection />
      <AdPrivacyRow />

      <Section title={t('settings.language')}>
        <Option label={t('settings.automatic', { value: languageName(auto.language) })} selected={prefs.language === 'auto'} onPress={() => setPreference('language', 'auto')} />
        {LANGUAGES.map((l) => (
          <Option key={l.code} label={l.name} selected={prefs.language === l.code} onPress={() => setPreference('language', l.code)} />
        ))}
      </Section>
      {needsRestart ? <Notice text={t('settings.restartForRtl')} /> : null}

      <Section title={t('settings.oddsFormat')}>
        <Option label={t('settings.automatic', { value: t(`settings.${auto.oddsFormat}`) })} selected={prefs.oddsFormat === 'auto'} onPress={() => setPreference('oddsFormat', 'auto')} />
        {ODDS_FORMATS.map((f) => (
          <Option key={f} label={oddsLabel(f)} selected={prefs.oddsFormat === f} onPress={() => setPreference('oddsFormat', f)} />
        ))}
      </Section>

      <Section title={t('settings.currency')}>
        <Option label={t('settings.automatic', { value: deviceCurrency })} selected={prefs.currency === 'auto'} onPress={() => setPreference('currency', 'auto')} />
        {currencies.map((c) => (
          <Option key={c} label={c} selected={prefs.currency === c} onPress={() => setPreference('currency', c as Preferences['currency'])} />
        ))}
      </Section>
      <Section title={t('report.tokenValue')}>
        {tokenValues.map((v) => (
          <Option key={v} label={t('report.tokenOption', { value: formatMoney(tokenValueMinor(v, currency), currency, locale) })}
            selected={tokenValue === v} onPress={() => setTokenValue(v)} />
        ))}
      </Section>

      <ThemedText type="small" themeColor="textSecondary">{currency} · {t('settings.translationNote')}</ThemedText>
    </Screen>
  );
}

function NotificationsSection() {
  const { t } = useT();
  const theme = useTheme();
  const { kickoff, permission, setKickoff } = useReminders();
  // İzin durumu telefon ayarlarında değişmiş olabilir
  useEffect(() => { void syncReminders(); }, []);
  return (
    <Section title={t('notifications.title')}>
      <View style={styles.option}>
        <ThemedText style={styles.optionLabel}>{t('notifications.kickoff')}</ThemedText>
        <Switch value={kickoff} onValueChange={(on) => void setKickoff(on)} trackColor={{ true: theme.accent }}
          accessibilityLabel={t('notifications.kickoff')} />
      </View>
      {kickoff && permission === 'denied' ? (
        <View style={styles.denied}>
          <ThemedText type="small" style={{ color: theme.danger }}>{t('notifications.denied')}</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>{t('notifications.openSettings')}</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </Section>
  );
}

/** Oyunlarda ses efektleri, müzik ve titreşim */
function FeedbackSection() {
  const { t } = useT();
  const theme = useTheme();
  const prefs = useFeedback();
  const rows = [['sound', prefs.sound], ['music', prefs.music], ['haptics', prefs.haptics]] as const;
  return (
    <Section title={t('settings.feedback')}>
      {rows.map(([key, value]) => (
        <View key={key} style={styles.option}>
          <ThemedText style={styles.optionLabel}>{t(`settings.${key}`)}</ThemedText>
          <Switch value={value} onValueChange={(on) => prefs.set({ [key]: on })} trackColor={{ true: theme.accent }}
            accessibilityLabel={t(`settings.${key}`)} />
        </View>
      ))}
    </Section>
  );
}

/** Sadece reklam izni gereken ülkelerde (AB, İngiltere…) görünür */
function AdPrivacyRow() {
  const { t } = useT();
  const theme = useTheme();
  const visible = useAds((s) => s.privacyOptions);
  if (!visible) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => void showAdPrivacyOptions()}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>{t('ads.privacy')}</ThemedText>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>{title}</ThemedText>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
      style={({ pressed }) => [styles.option, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText style={styles.optionLabel}>{label}</ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>{selected ? '✓' : ''}</ThemedText>
    </Pressable>
  );
}

function Notice({ text }: { text: string }) {
  const theme = useTheme();
  return <ThemedText type="small" style={{ color: theme.danger }}>{text}</ThemedText>;
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 12 },
  card: { paddingVertical: 4, paddingHorizontal: Spacing.three, gap: 0 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: Spacing.two },
  optionLabel: { flex: 1 },
  denied: { gap: Spacing.one, paddingBottom: Spacing.three },
});
