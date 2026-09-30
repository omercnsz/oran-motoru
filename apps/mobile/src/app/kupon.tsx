import { parseAmount, potentialReturn, totalOdds, validateSlip, type SlipProblem } from '@oran/betting';
import { espnDateOf, preMatchProblem, type EspnEvent } from '@oran/live-sources';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchEspnEvents } from '@/data/live';
import { createCoupon } from '@/db/coupons';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { describeBet, formatShort } from '@/lib/format';
import { staleLiveSelection, useSlip, type SlipSelection } from '@/state/slip';

/** Hızlı tutar düğmeleri (tam birim: 50 TL, 50 €, 50 ¥…) */
const QUICK = [50, 100, 250, 500];

type Problem = SlipProblem | { code: 'postponed' | 'staleLive'; match: string } | { code: 'invalidAmount' };

/** Maç öncesi seçimlerin ESPN'deki anlık durumu; ESPN'e ulaşılamazsa boş liste (saat kontrolü yine geçerli). */
async function currentEvents(selections: SlipSelection[]): Promise<EspnEvent[]> {
  const pre = selections.filter((s) => !s.live && s.espnId);
  if (pre.length === 0) return [];
  const pairs = new Map(pre.map((s) => [`${s.league}|${espnDateOf(s.kickoff)}`, { league: s.league, espnDate: espnDateOf(s.kickoff) }]));
  try {
    return (await fetchEspnEvents([...pairs.values()])).events;
  } catch {
    return [];
  }
}

/** Kuponu doğrular ve kaydeder; sorun varsa kodunu döner. */
async function placeCoupon(selections: SlipSelection[], stake: number | null, currency: string, minStake: number): Promise<Problem | null> {
  if (stake === null) return { code: 'invalidAmount' };
  const problem = validateSlip(selections, stake, new Date(), minStake);
  if (problem) return problem;
  const events = await currentEvents(selections);
  const now = new Date();
  const stale = staleLiveSelection(selections, now.getTime());
  if (stale) return { code: 'staleLive', match: `${stale.home} – ${stale.away}` };
  const started = preMatchProblem(selections, events, now) ?? validateSlip(selections, stake, now, minStake);
  if (started) return started;
  createCoupon(selections, stake, currency, now);
  return null;
}

export default function KuponScreen() {
  const theme = useTheme();
  const { t, money, odds, currency, decimalSeparator, minStake, amountExample } = useT();
  const { selections, remove, clear } = useSlip();
  const [text, setText] = useState('100');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const stake = parseAmount(text, currency, decimalSeparator);

  function problemText(p: Problem): string {
    switch (p.code) {
      case 'invalidAmount': return t('slip.errors.invalidAmount', { example: amountExample });
      case 'tooMany': return t('slip.errors.tooMany', { max: p.max });
      case 'minStake': return t('slip.errors.minStake', { min: money(p.min) });
      case 'closed': case 'started': case 'postponed': case 'staleLive': return t(`slip.errors.${p.code}`, { match: p.match });
      default: return t(`slip.errors.${p.code}`);
    }
  }

  async function submit() {
    setBusy(true);
    const p = await placeCoupon(selections, stake, currency, minStake);
    setBusy(false);
    if (p) return setProblem(p);
    clear();
    router.dismissTo('/kuponlar');
  }

  return (
    <Screen title={t('slip.title')} subtitle={t('slip.subtitle')} compact>
      {selections.length === 0 ? <ThemedText themeColor="textSecondary">{t('slip.empty')}</ThemedText> : null}

      {selections.map((s) => {
        const bet = describeBet(s.marketKey, s.outcomeKey);
        return (
          <ThemedView key={s.matchId} type="backgroundElement" style={styles.row}>
            <View style={styles.rowText}>
              <ThemedText type="smallBold">{s.home} – {s.away}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {s.live ? `${t('slip.live')} · ` : ''}{bet.market}: {bet.outcome}{s.live ? '' : ` · ${formatShort(s.kickoff)}`}
              </ThemedText>
            </View>
            <ThemedText type="smallBold">{odds(s.odds)}</ThemedText>
            <Pressable accessibilityLabel={t('slip.remove')} hitSlop={12} onPress={() => remove(s.matchId)}>
              <ThemedText type="smallBold" themeColor="textSecondary">✕</ThemedText>
            </Pressable>
          </ThemedView>
        );
      })}

      {selections.length > 0 ? (
        <>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{t('slip.stake')}</ThemedText>
            <View style={[styles.inputRow, { borderColor: theme.backgroundSelected }]}>
              <TextInput
                value={text}
                onChangeText={(v) => { setText(v); setProblem(null); }}
                keyboardType="decimal-pad"
                accessibilityLabel={`${t('slip.stake')} (${currency})`}
                style={[styles.input, { color: theme.text }]}
              />
              <ThemedText themeColor="textSecondary">{currency}</ThemedText>
            </View>
            <View style={styles.quick}>
              {QUICK.map((q) => (
                <Pressable key={q} onPress={() => { setText(String(q)); setProblem(null); }}
                  style={[styles.quickBtn, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small">{money(q * minStake)}</ThemedText>
                </Pressable>
              ))}
            </View>
            <View style={styles.summary}>
              <ThemedText type="small" themeColor="textSecondary">{t('slip.totalOdds')}</ThemedText>
              <ThemedText type="smallBold">{odds(totalOdds(selections))}</ThemedText>
            </View>
            <View style={styles.summary}>
              <ThemedText type="small" themeColor="textSecondary">{t('slip.potential')}</ThemedText>
              <ThemedText type="smallBold">{stake && stake >= minStake ? money(potentialReturn(selections, stake)) : '–'}</ThemedText>
            </View>
          </ThemedView>

          {problem ? <ThemedText type="small" style={{ color: theme.danger }}>{problemText(problem)}</ThemedText> : null}

          <Pressable accessibilityRole="button" accessibilityState={{ busy }} disabled={busy} onPress={submit}
            style={({ pressed }) => [styles.submit, { backgroundColor: theme.accent, opacity: pressed || busy ? 0.7 : 1 }]}>
            {busy ? <ActivityIndicator color={theme.accentText} /> : (
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                {t('slip.create', { amount: stake ? money(stake) : '–' })}
              </ThemedText>
            )}
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Spacing.three, padding: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three },
  input: { flex: 1, fontSize: 24, fontWeight: '600', paddingVertical: Spacing.two },
  quick: { flexDirection: 'row', gap: Spacing.two },
  quickBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  submit: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.three },
});
