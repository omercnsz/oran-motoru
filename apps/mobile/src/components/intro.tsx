// İlk açılış tanıtımı: uygulamanın ne yaptığını üç kısa sayfada anlatır. Atlanabilir; Ayarlar'dan yeniden açılır.
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AText, ArenaBackground, NeonButton } from '@/components/arena/kit';
import { Arena, glow } from '@/constants/arena';
import { useT } from '@/i18n';
import { useIntro } from '@/state/intro';

const PAGES: { icon: SymbolViewProps['name']; fallback: string; color: string; title: string; body: string }[] = [
  { icon: { ios: 'sportscourt.fill', android: 'sports_soccer' }, fallback: '⚽', color: Arena.neon, title: 'intro.title1', body: 'intro.body1' },
  { icon: { ios: 'banknote.fill', android: 'savings' }, fallback: '💰', color: Arena.gold, title: 'intro.title2', body: 'intro.body2' },
  { icon: { ios: 'dice.fill', android: 'casino' }, fallback: '🎲', color: Arena.cyan, title: 'intro.title3', body: 'intro.body3' },
];

export function Intro() {
  const { t } = useT();
  const { visible, done } = useIntro();
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const p = PAGES[page];

  const finish = () => {
    done();
    setPage(0);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={finish}>
      <SafeAreaProvider>
        <ArenaBackground>
          <SafeAreaView style={styles.safe}>
            <View style={styles.top}>
              {last ? null : (
                <Pressable accessibilityRole="button" onPress={finish} hitSlop={12}>
                  <AText dim style={styles.skip}>{t('intro.skip')}</AText>
                </Pressable>
              )}
            </View>

            {/* Küçük ekranda ya da uzun dillerde metin sığmazsa kaydırılır */}
            <Animated.View key={page} entering={FadeIn.duration(350)} style={styles.fill}>
              <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
                <View style={[styles.badge, { borderColor: `${p.color}55`, boxShadow: glow(p.color, 40, 0.35) }]}>
                  <SymbolView name={p.icon} size={56} tintColor={p.color} fallback={<Text style={styles.emoji}>{p.fallback}</Text>} />
                </View>
                <AText display style={styles.title}>{t(p.title)}</AText>
                <AText dim style={styles.body}>{t(p.body)}</AText>
              </ScrollView>
            </Animated.View>

            <View style={styles.bottom}>
              <View style={styles.dots}>
                {PAGES.map((_, i) => (
                  <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
                ))}
              </View>
              <NeonButton label={t(last ? 'intro.start' : 'intro.next')} onPress={() => (last ? finish() : setPage(page + 1))} />
              <AText dim style={styles.adult}>{t('intro.adult')}</AText>
            </View>
          </SafeAreaView>
        </ArenaBackground>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  top: { height: 44, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  skip: { fontSize: 15, fontWeight: '600' },
  // Üstten hizalı: metin uzunluğu değişince simge sayfadan sayfaya kaymasın
  page: { alignItems: 'center', paddingTop: 56, paddingBottom: 16, gap: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  badge: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Arena.glass, marginBottom: 12,
  },
  emoji: { fontSize: 52 },
  title: { fontSize: 26, lineHeight: 34, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  bottom: { gap: 16, paddingBottom: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Arena.glassBorder },
  dotActive: { width: 22, backgroundColor: Arena.neon },
  adult: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
