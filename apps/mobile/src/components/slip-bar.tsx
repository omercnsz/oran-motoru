import { totalOdds } from '@oran/betting';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSlip } from '@/state/slip';

/** Kuponda seçim varsa ekranın altında görünen çubuk */
export function SlipBar({ aboveTabs = true }: { aboveTabs?: boolean }) {
  const selections = useSlip((s) => s.selections);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t, odds } = useT();
  if (selections.length === 0) return null;
  // iOS'ta sekme çubuğu içeriğin üstünde yüzer, altında pay gerekir; Android'de içerik sekme çubuğunun üstünde biter.
  const tabOffset = aboveTabs && Platform.OS === 'ios' ? insets.bottom + BottomTabInset : 0;
  const bottom = (aboveTabs ? tabOffset : insets.bottom) + Spacing.three;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/kupon')}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: theme.accent, bottom, opacity: pressed ? 0.85 : 1 },
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.accentText }}>
        {t('slip.bar', { count: selections.length })}
      </ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.accentText }}>
        {t('slip.barOdds', { odds: odds(totalOdds(selections)) })}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: Spacing.three, right: Spacing.three,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Spacing.four,
  },
});
