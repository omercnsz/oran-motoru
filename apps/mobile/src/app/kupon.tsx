import { MIN_STAKE, parseTL, potentialReturn, formatTL, totalOdds, validateSlip } from '@oran/betting';
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
import { describeBet, formatOdds, formatShort } from '@/lib/format';
import { staleLiveSelection, useSlip, type SlipSelection } from '@/state/slip';

const QUICK = [50, 100, 250, 500];

/** Maç öncesi seçimlerin ESPN'deki anlık durumu; ESPN'e ulaşılamazsa boş liste (saat kontrolü yine geçerli). */
async function currentEvents(selections: SlipSelection[]): Promise<EspnEvent[]> {
  const pre = selections.filter((s) => !s.live && s.espnId);
  if (pre.length === 0) return [];
  const pairs = new Map(pre.map((s) => [`${s.league}|${espnDateOf(s.kickoff)}`, { league: s.league, espnDate: espnDateOf(s.kickoff) }]));
  try {
    return await fetchEspnEvents([...pairs.values()]);
  } catch {
    return [];
  }
}

/** Kuponu doğrular ve kaydeder; sorun varsa açıklamasını döner. */
async function placeCoupon(selections: SlipSelection[], stake: number | null): Promise<string | null> {
  if (stake === null) return 'Geçerli bir tutar yaz (ör. 150 ya da 150,50)';
  const problem = validateSlip(selections, stake, new Date());
  if (problem) return problem;
  const events = await currentEvents(selections);
  const now = new Date();
  const stale = staleLiveSelection(selections, now.getTime());
  if (stale) return `${stale.home} – ${stale.away} canlı oranı 1 dakikadan eski; maçı kupondan çıkarıp yeniden seç`;
  const started = preMatchProblem(selections, events, now) ?? validateSlip(selections, stake, now);
  if (started) return started;
  createCoupon(selections, stake, now);
  return null;
}

export default function KuponScreen() {
  const theme = useTheme();
  const { selections, remove, clear } = useSlip();
  const [text, setText] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stake = parseTL(text);

  async function submit() {
    setBusy(true);
    const problem = await placeCoupon(selections, stake);
    setBusy(false);
    if (problem) return setError(problem);
    clear();
    router.dismissTo('/kuponlar');
  }

  return (
    <Screen title="Kuponun" subtitle="Bu parayı gerçekte yatırmıyorsun. Tutar kumbarana eklenir." compact>
      {selections.length === 0 ? <ThemedText themeColor="textSecondary">Kupon boş. Maçlardan oran seç.</ThemedText> : null}

      {selections.map((s) => {
        const bet = describeBet(s.marketKey, s.outcomeKey);
        return (
          <ThemedView key={s.matchId} type="backgroundElement" style={styles.row}>
            <View style={styles.rowText}>
              <ThemedText type="smallBold">{s.home} – {s.away}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {s.live ? 'Canlı · ' : ''}{bet.market}: {bet.outcome}{s.live ? '' : ` · ${formatShort(s.kickoff)}`}
              </ThemedText>
            </View>
            <ThemedText type="smallBold">{formatOdds(s.odds)}</ThemedText>
            <Pressable accessibilityLabel="Kupondan çıkar" hitSlop={12} onPress={() => remove(s.matchId)}>
              <ThemedText type="smallBold" themeColor="textSecondary">✕</ThemedText>
            </Pressable>
          </ThemedView>
        );
      })}

      {selections.length > 0 ? (
        <>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Tutar</ThemedText>
            <View style={[styles.inputRow, { borderColor: theme.backgroundSelected }]}>
              <TextInput
                value={text}
                onChangeText={(t) => { setText(t); setError(null); }}
                keyboardType="decimal-pad"
                accessibilityLabel="Tutar (TL)"
                style={[styles.input, { color: theme.text }]}
              />
              <ThemedText themeColor="textSecondary">TL</ThemedText>
            </View>
            <View style={styles.quick}>
              {QUICK.map((q) => (
                <Pressable key={q} onPress={() => { setText(String(q)); setError(null); }}
                  style={[styles.quickBtn, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small">{q} TL</ThemedText>
                </Pressable>
              ))}
            </View>
            <View style={styles.summary}>
              <ThemedText type="small" themeColor="textSecondary">Toplam oran</ThemedText>
              <ThemedText type="smallBold">{formatOdds(totalOdds(selections))}</ThemedText>
            </View>
            <View style={styles.summary}>
              <ThemedText type="small" themeColor="textSecondary">Olası kazanç</ThemedText>
              <ThemedText type="smallBold">{stake && stake >= MIN_STAKE ? formatTL(potentialReturn(selections, stake)) : '–'}</ThemedText>
            </View>
          </ThemedView>

          {error ? <ThemedText type="small" style={{ color: theme.danger }}>{error}</ThemedText> : null}

          <Pressable accessibilityRole="button" accessibilityState={{ busy }} disabled={busy} onPress={submit}
            style={({ pressed }) => [styles.submit, { backgroundColor: theme.accent, opacity: pressed || busy ? 0.7 : 1 }]}>
            {busy ? <ActivityIndicator color={theme.accentText} /> : (
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                Kuponu oluştur{stake ? ` · ${formatTL(stake)} kumbaraya` : ''}
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
