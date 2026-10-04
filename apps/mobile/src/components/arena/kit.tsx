// Arena (oyunlar) bileşenleri: arka plan, cam panel, neon düğme, fiş seçici, jeton göstergesi, sayan rakam, sarsıntı.
import { TOKEN } from '@oran/games-math';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import { Arena, CHIP_COLORS, FontFamily, glow } from '@/constants/arena';
import { haptic } from '@/lib/haptics';
import { musicAcquire, musicRelease, preload, sfx, type Sfx } from '@/lib/sound';
import { formatTokens } from '@/lib/tokens';

/** Oyun ekranı açıkken müzik çalar ve verilen sesler önceden yüklenir */
export function useArena(sounds: Sfx[] = []) {
  useFocusEffect(useCallback(() => {
    musicAcquire();
    return () => musicRelease();
  }, []));
  useEffect(() => preload(['tap', 'chip', ...sounds]), []); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Arena gezinme çubuğu: koyu, beyaz yazı, başlık display yazı tipiyle */
export const arenaHeader = {
  headerStyle: { backgroundColor: Arena.bgTop },
  headerTintColor: Arena.text,
  headerTitleStyle: { fontFamily: FontFamily.display, fontWeight: '700' as const, fontSize: 17 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: Arena.bg },
};

/** Tam ekran arka plan: lacivert degrade ve iki yumuşak ışık lekesi (stadyum ışığı) */
export function ArenaBackground({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.fill, styles.bg, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowA]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowB]} />
      {children}
    </View>
  );
}

export function Glass({ children, style, strong }: { children?: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean }) {
  return <View style={[styles.glass, strong && { backgroundColor: Arena.glassStrong }, style]}>{children}</View>;
}

/** Arena metni: varsayılan Inter, display: Unbounded */
export function AText({ children, style, display, dim, numberOfLines }: {
  children?: ReactNode; style?: StyleProp<TextStyle>; display?: boolean; dim?: boolean; numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles.text, display && styles.display, dim && { color: Arena.textDim }, style]}>
      {children}
    </Text>
  );
}

type Tone = 'neon' | 'gold' | 'danger' | 'glass';
const TONES: Record<Tone, { bg: string; text: string; glow?: string }> = {
  neon: { bg: `linear-gradient(135deg, ${Arena.neon} 0%, ${Arena.neonDeep} 100%)`, text: Arena.onNeon, glow: Arena.neon },
  gold: { bg: `linear-gradient(135deg, ${Arena.gold} 0%, ${Arena.goldDeep} 100%)`, text: Arena.onGold, glow: Arena.gold },
  danger: { bg: `linear-gradient(135deg, ${Arena.danger} 0%, ${Arena.dangerDeep} 100%)`, text: '#ffffff', glow: Arena.danger },
  glass: { bg: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)', text: Arena.text },
};

/** Büyük oyun düğmesi: degrade dolgu, neon parıltı, basınca küçülür; pulse: dikkat çeker (ör. çek) */
export function NeonButton({ label, sub, onPress, tone = 'neon', disabled, pulse, style, sound = 'tap' }: {
  label: string; sub?: string; onPress: () => void; tone?: Tone; disabled?: boolean; pulse?: boolean;
  style?: StyleProp<ViewStyle>; sound?: Sfx | null;
}) {
  const scale = useSharedValue(1);
  const beat = useSharedValue(1);
  useEffect(() => {
    beat.value = pulse ? withRepeat(withSequence(withTiming(1.035, { duration: 420 }), withTiming(1, { duration: 420 })), -1) : withTiming(1);
  }, [pulse, beat]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value * beat.value }] }));
  const t = TONES[tone];
  return (
    <Animated.View style={[animated, style]}>
      <Pressable accessibilityRole="button" disabled={disabled}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 15, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
        onPress={() => {
          if (sound) sfx(sound);
          haptic.light();
          onPress();
        }}
        style={[styles.button, { experimental_backgroundImage: t.bg, boxShadow: t.glow && !disabled ? glow(t.glow, 24, 0.5) : undefined, opacity: disabled ? 0.45 : 1 }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.buttonLabel, { color: t.text }]}>{label}</Text>
        {sub ? <Text numberOfLines={1} style={[styles.buttonSub, { color: t.text }]}>{sub}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

/** Küçük cam düğme (−, +, ½, 2×, seçenekler) */
export function GlassButton({ label, onPress, selected, disabled, style }: {
  label: string; onPress: () => void; selected?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
      onPress={() => { sfx('tap', { volume: 0.7 }); haptic.select(); onPress(); }}
      style={({ pressed }) => [styles.small, selected && styles.smallSelected, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }, style]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.smallLabel, selected && { color: Arena.neon }]}>{label}</Text>
    </Pressable>
  );
}

/** Kumarhane fişi: değerine göre renk, kenarda beyaz şeritler */
export function Chip({ value, size = 54, selected, onPress, disabled }: {
  value: number; size?: number; selected?: boolean; onPress?: () => void; disabled?: boolean;
}) {
  const c = CHIP_COLORS[value] ?? CHIP_COLORS[100];
  const lift = useSharedValue(selected ? 1 : 0);
  useEffect(() => { lift.value = withSpring(selected ? 1 : 0, { damping: 14, stiffness: 260 }); }, [selected, lift]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * lift.value }, { scale: 1 + 0.06 * lift.value }] }));
  return (
    <Animated.View style={animated}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled}
        onPress={() => { sfx('chip'); haptic.select(); onPress?.(); }}
        style={[styles.chip, {
          width: size, height: size, borderRadius: size / 2, backgroundColor: c.face, borderColor: c.edge,
          boxShadow: selected ? glow(c.face === '#1C1C24' ? Arena.gold : c.face, 18, 0.8) : '0px 4px 8px rgba(0,0,0,0.45)',
          opacity: disabled ? 0.5 : 1,
        }]}>
        {/* Kenar şeritleri */}
        {[0, 45, 90, 135].map((deg) => (
          <View key={deg} pointerEvents="none" style={[styles.stripe, { width: size - 6, transform: [{ rotate: `${deg}deg` }] }]}>
            <View style={[styles.stripeMark, { backgroundColor: '#ffffffdd' }]} />
            <View style={[styles.stripeMark, { backgroundColor: '#ffffffdd' }]} />
          </View>
        ))}
        <View style={[styles.chipInner, { width: size * 0.66, height: size * 0.66, borderRadius: size, backgroundColor: c.face, borderColor: '#ffffff66' }]}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}
            style={[styles.chipText, { color: c.text, fontSize: size * (String(value).length > 2 ? 0.19 : 0.24), maxWidth: size * 0.56 }]}>
            {formatTokens(value * TOKEN)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ChipRow({ values, value, onChange, disabled }: { values: number[]; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <View style={styles.chipRow}>
      {values.map((v) => <Chip key={v} value={v} selected={value === v} disabled={disabled} onPress={() => onChange(v)} />)}
    </View>
  );
}

/** Masadaki bahis işareti: küçük fiş, rengi tutara göre */
export function ChipMark({ units, size = 22 }: { units: number; size?: number }) {
  const tokens = units / TOKEN;
  const c = CHIP_COLORS[tokens >= 500 ? 500 : tokens >= 100 ? 100 : tokens >= 50 ? 50 : 10];
  return (
    <View style={{
      minWidth: size, height: size, borderRadius: size / 2, paddingHorizontal: 4, backgroundColor: c.face, borderWidth: 2,
      borderColor: c.edge === '#C9A227' ? c.edge : '#ffffffcc', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0px 2px 4px rgba(0,0,0,0.5)',
    }}>
      <Text numberOfLines={1} style={{ color: c.text, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: size * 0.42 }}>{formatTokens(units)}</Text>
    </View>
  );
}

/** Sayan rakam: değer değişince eskisinden yenisine akar */
export function useCountUp(target: number, ms = 650) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = Date.now(), a = from.current;
    if (a === target) return;
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - (1 - k) ** 3;
      const v = Math.round(a + (target - a) * eased);
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/** Jeton göstergesi: altın para ve sayan bakiye */
export function Balance({ units }: { units: number }) {
  const shown = useCountUp(units);
  return (
    <View style={styles.balance}>
      <Coin size={20} />
      <Text style={styles.balanceText}>{formatTokens(shown)}</Text>
    </View>
  );
}

export function Coin({ size = 20 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
      experimental_backgroundImage: `linear-gradient(135deg, #FFE38A 0%, ${Arena.gold} 45%, ${Arena.goldDeep} 100%)`,
      boxShadow: glow(Arena.gold, 10, 0.5),
    }}>
      <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, borderWidth: 1.5, borderColor: '#FFF3C4AA' }} />
    </View>
  );
}

/** Ekran sarsıntısı: büyük kazanç ya da patlama */
export function useShake() {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = (power = 1) => {
    const d = 9 * power;
    x.set(withSequence(
      withTiming(d, { duration: 45 }), withTiming(-d, { duration: 70 }), withTiming(d * 0.6, { duration: 60 }),
      withTiming(-d * 0.4, { duration: 55 }), withTiming(0, { duration: 50 }),
    ));
  };
  return { style, shake };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bg: { backgroundColor: Arena.bg, experimental_backgroundImage: `linear-gradient(180deg, ${Arena.bgTop} 0%, ${Arena.bg} 45%, ${Arena.bgBottom} 100%)` },
  glowA: { experimental_backgroundImage: 'radial-gradient(circle at 15% 8%, rgba(43,255,168,0.13) 0%, rgba(43,255,168,0) 45%)' },
  glowB: { experimental_backgroundImage: 'radial-gradient(circle at 90% 35%, rgba(61,217,255,0.10) 0%, rgba(61,217,255,0) 40%)' },
  glass: { backgroundColor: Arena.glass, borderColor: Arena.glassBorder, borderWidth: 1, borderRadius: 22 },
  text: { color: Arena.text, fontFamily: FontFamily.ui, fontSize: 15, fontWeight: '500' },
  display: { fontFamily: FontFamily.display, fontWeight: '700' },
  button: { minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 8 },
  buttonLabel: { fontFamily: FontFamily.display, fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },
  buttonSub: { fontFamily: FontFamily.ui, fontWeight: '700', fontSize: 13, opacity: 0.8, marginTop: 1 },
  small: {
    minWidth: 44, height: 40, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Arena.glassStrong, borderWidth: 1, borderColor: Arena.glassBorder,
  },
  smallSelected: { borderColor: Arena.neon, backgroundColor: 'rgba(43,255,168,0.12)', boxShadow: glow(Arena.neon, 12, 0.35) },
  smallLabel: { color: Arena.text, fontFamily: FontFamily.ui, fontWeight: '700', fontSize: 15 },
  chipRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 6 },
  chip: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  stripe: { position: 'absolute', height: 5, flexDirection: 'row', justifyContent: 'space-between' },
  stripeMark: { width: 6, height: 5, borderRadius: 1 },
  chipInner: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FontFamily.display, fontWeight: '800' },
  balance: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: Arena.glassStrong, borderColor: Arena.glassBorder, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingLeft: 7, paddingRight: 14,
  },
  balanceText: { color: Arena.text, fontFamily: FontFamily.display, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] },
});
