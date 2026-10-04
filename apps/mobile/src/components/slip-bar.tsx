import { totalOdds } from '@oran/betting';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Arena, FontFamily, glow } from '@/constants/arena';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useSlip } from '@/state/slip';

/** Kuponda seçim varsa ekranın altında görünen çubuk: seçim sayısı, toplam oran */
export function SlipBar({ aboveTabs = true }: { aboveTabs?: boolean }) {
  const selections = useSlip((s) => s.selections);
  const insets = useSafeAreaInsets();
  const { t, odds } = useT();
  if (selections.length === 0) return null;
  // iOS'ta sekme çubuğu içeriğin üstünde yüzer, altında pay gerekir; Android'de içerik sekme çubuğunun üstünde biter.
  const tabOffset = aboveTabs && Platform.OS === 'ios' ? insets.bottom + BottomTabInset : 0;
  const bottom = (aboveTabs ? tabOffset : insets.bottom) + Spacing.three;
  return (
    <Animated.View entering={ZoomIn.springify()} style={[styles.wrap, { bottom }]}>
      <Pressable accessibilityRole="button" onPress={() => { haptic.light(); router.push('/kupon'); }}
        style={({ pressed }) => [styles.bar, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        <View style={styles.count}>
          <Text style={styles.countText}>{selections.length}</Text>
        </View>
        <Text style={styles.label} numberOfLines={1}>{t('slip.bar', { count: selections.length })}</Text>
        <Text style={styles.odds}>{t('slip.barOdds', { odds: odds(totalOdds(selections)) })}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20,
    experimental_backgroundImage: `linear-gradient(135deg, ${Arena.neon} 0%, ${Arena.neonDeep} 100%)`,
    boxShadow: `${glow(Arena.neon, 22, 0.45)}, 0px 8px 20px rgba(0,0,0,0.5)`,
  },
  count: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: Arena.onNeon, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { color: Arena.neon, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 14 },
  label: { flex: 1, color: Arena.onNeon, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 15 },
  odds: { color: Arena.onNeon, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] },
});
