// Oran düğmesi (kullanıcının seçtiği biçimde: 2.50, 3/2, +150). odds null ise bahis kapalı.
// Koyu stadyum temasında: cam düğme; seçilince neon dolgu ve parıltı, fiş sesi ve titreşim.
import { Pressable, StyleSheet, Text } from 'react-native';

import { Arena, FontFamily, glow } from '@/constants/arena';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { sfx } from '@/lib/sound';

export function OddsButton({ label, odds, selected, onPress }: {
  label: string; odds: number | null; selected: boolean; onPress: () => void;
}) {
  const { odds: fmt } = useT();
  const disabled = odds === null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label} ${odds ? fmt(odds) : '–'}`}
      disabled={disabled}
      onPress={() => {
        sfx(selected ? 'tap' : 'chip', { volume: 0.7 });
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        selected ? styles.selected : null,
        { opacity: disabled ? 0.35 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, selected && { color: Arena.onNeon }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.odds, selected && { color: Arena.onNeon }]}>{odds ? fmt(odds) : '–'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 4, borderRadius: 12, minHeight: 52,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  selected: {
    borderColor: Arena.neon, boxShadow: glow(Arena.neon, 14, 0.45),
    experimental_backgroundImage: `linear-gradient(135deg, ${Arena.neon} 0%, ${Arena.neonDeep} 100%)`,
  },
  label: { color: Arena.textDim, fontFamily: FontFamily.ui, fontWeight: '700', fontSize: 12 },
  odds: { color: Arena.text, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 16, fontVariant: ['tabular-nums'], marginTop: 1 },
});
