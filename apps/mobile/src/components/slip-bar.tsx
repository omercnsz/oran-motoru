import { totalOdds } from '@oran/betting';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatOdds } from '@/lib/format';
import { useSlip } from '@/state/slip';

/** Kuponda seçim varsa ekranın altında görünen çubuk */
export function SlipBar({ aboveTabs = true }: { aboveTabs?: boolean }) {
  const selections = useSlip((s) => s.selections);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (selections.length === 0) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/kupon')}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: theme.accent, bottom: insets.bottom + (aboveTabs ? BottomTabInset : 0) + Spacing.three, opacity: pressed ? 0.85 : 1 },
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.accentText }}>
        Kupon · {selections.length} maç
      </ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.accentText }}>
        Oran {formatOdds(totalOdds(selections))}
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
