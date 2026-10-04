// Kupon: seçimler, tutar, toplam oran ve olası kazanç. Kuponu yapınca tutar kumbaraya gider (gerçek bahis yok).
import { parseAmount, potentialReturn, totalOdds, validateSlip, type SlipProblem } from '@oran/betting';
import { espnDateOf, preMatchProblem, type EspnEvent } from '@oran/live-sources';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AText, ArenaBackground, Glass, GlassButton, NeonButton } from '@/components/arena/kit';
import { Arena, FontFamily } from '@/constants/arena';
import { fetchEspnEvents } from '@/data/live';
import { createCoupon } from '@/db/coupons';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { describeBet, formatShort } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { askPermission, syncReminders } from '@/notifications';
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
  const { t, money, odds, currency, decimalSeparator, minStake, amountExample } = useT();
  const insets = useSafeAreaInsets();
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
    if (p) {
      haptic.error();
      return setProblem(p);
    }
    sfx('cashout');
    haptic.success();
    // İlk kuponda bildirim izni sorulur; maç başlamadan 15 dk önce hatırlatma kurulur
    void askPermission().finally(syncReminders);
    clear();
    router.dismissTo('/kuponlar');
  }

  return (
    <ArenaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <AText dim style={styles.subtitle}>{t('slip.subtitle')}</AText>
        {selections.length === 0 ? <Glass style={styles.card}><AText dim>{t('slip.empty')}</AText></Glass> : null}

        {selections.map((s, i) => {
          const bet = describeBet(s.marketKey, s.outcomeKey);
          return (
            <Animated.View key={s.matchId} entering={FadeInDown.delay(i * 40)} exiting={FadeOut.duration(150)}>
              <Glass style={styles.row}>
                <View style={[styles.accent, s.live && { backgroundColor: Arena.danger }]} />
                <View style={styles.rowText}>
                  <AText style={styles.match} numberOfLines={1}>{s.home} – {s.away}</AText>
                  <AText dim style={styles.bet} numberOfLines={2}>
                    {s.live ? `${t('slip.live')} · ` : ''}{bet.market}: <Text style={styles.outcome}>{bet.outcome}</Text>{s.live ? '' : ` · ${formatShort(s.kickoff)}`}
                  </AText>
                </View>
                <View style={styles.oddsPill}><AText style={styles.odds}>{odds(s.odds)}</AText></View>
                <Pressable accessibilityLabel={t('slip.remove')} hitSlop={12} onPress={() => { haptic.light(); remove(s.matchId); }} style={styles.remove}>
                  <AText style={styles.removeText}>✕</AText>
                </Pressable>
              </Glass>
            </Animated.View>
          );
        })}

        {selections.length > 0 ? (
          <>
            <Glass strong style={styles.card}>
              <AText style={styles.label}>{t('slip.stake')}</AText>
              <View style={styles.inputRow}>
                <TextInput
                  value={text}
                  onChangeText={(v) => { setText(v); setProblem(null); }}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`${t('slip.stake')} (${currency})`}
                  style={styles.input}
                />
                <AText dim style={styles.currency}>{currency}</AText>
              </View>
              <View style={styles.quick}>
                {QUICK.map((q) => (
                  <GlassButton key={q} style={styles.flex} label={money(q * minStake)} selected={stake === q * minStake}
                    onPress={() => { setText(String(q)); setProblem(null); }} />
                ))}
              </View>
              <View style={styles.divider} />
              <View style={styles.summary}>
                <AText dim>{t('slip.totalOdds')}</AText>
                <AText display style={styles.total}>{odds(totalOdds(selections))}</AText>
              </View>
              <View style={styles.summary}>
                <AText dim>{t('slip.potential')}</AText>
                <AText display style={[styles.total, { color: Arena.gold }]}>
                  {stake && stake >= minStake ? money(potentialReturn(selections, stake)) : '–'}
                </AText>
              </View>
            </Glass>

            {problem ? <AText style={styles.problem}>{problemText(problem)}</AText> : null}

            {busy ? <ActivityIndicator color={Arena.neon} /> : (
              <NeonButton onPress={() => void submit()} sound={null} label={t('slip.create', { amount: stake ? money(stake) : '–' })} />
            )}
          </>
        ) : null}
      </ScrollView>
    </ArenaBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  accent: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: Arena.neon },
  rowText: { flex: 1, gap: 2 },
  match: { fontWeight: '800', fontSize: 14 },
  bet: { fontSize: 13, lineHeight: 18 },
  outcome: { color: Arena.neon, fontWeight: '800' },
  oddsPill: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(43,255,168,0.12)', borderWidth: 1, borderColor: 'rgba(43,255,168,0.4)' },
  odds: { color: Arena.neon, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Arena.glass },
  removeText: { color: Arena.textDim, fontWeight: '800', fontSize: 13 },
  label: { fontWeight: '800', fontSize: 14 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Arena.glassBorder, borderRadius: 14, paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  input: { flex: 1, fontSize: 26, fontFamily: FontFamily.display, fontWeight: '700', paddingVertical: 10, color: Arena.text, textAlign: 'left' },
  currency: { fontWeight: '800' },
  quick: { flexDirection: 'row', gap: 8 },
  divider: { height: 1, backgroundColor: Arena.glassBorder },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 18, fontVariant: ['tabular-nums'] },
  problem: { color: Arena.danger, fontSize: 13, fontWeight: '600' },
});
