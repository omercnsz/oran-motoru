import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatOdds } from '@/lib/format';

/** Oran düğmesi. odds null ise bahis kapalı. */
export function OddsButton({ label, odds, selected, onPress }: {
  label: string; odds: number | null; selected: boolean; onPress: () => void;
}) {
  const theme = useTheme();
  const disabled = odds === null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label} ${odds ? formatOdds(odds) : 'kapalı'}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: selected ? theme.accent : theme.backgroundSelected, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.accentText : theme.textSecondary }}>{label}</ThemedText>
      <ThemedText type="smallBold" style={{ color: selected ? theme.accentText : theme.text }}>
        {odds ? formatOdds(odds) : '–'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, minHeight: 48 },
});
