// Sade bölümlerin kartı: açık modda beyaz ve yumuşak gölgeli, koyu modda ince kenarlı.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export function Card({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  return (
    <View style={[styles.card, {
      backgroundColor: theme.backgroundElement,
      borderColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.04)',
      boxShadow: dark ? undefined : '0px 6px 20px rgba(15,23,42,0.07), 0px 1px 2px rgba(15,23,42,0.05)',
    }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, gap: 10, borderWidth: 1 },
});
