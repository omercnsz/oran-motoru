// Efektler: altın para fıskiyesi, konfeti, patlama kıvılcımları (Skia, tek resimde çizilir) ve kazanç afişi.
// Kutlama gücü ödemenin bahse oranına göre artar: küçük, büyük, dev kazanç.
import { Canvas, createPicture, Picture, Skia } from '@shopify/react-native-skia';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeOut, useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence,
  withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { Arena, FontFamily, glow } from '@/constants/arena';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { sfx } from '@/lib/sound';
import { formatMultiplier, formatTokens } from '@/lib/tokens';

// kind: 0 para, 1 konfeti, 2 kıvılcım
interface Particle {
  x: number; y: number; vx: number; vy: number; r: number; life: number; kind: 0 | 1 | 2;
  color: string; spin: number; drag: number; gravity: number; birth: number;
}

export interface EffectsHandle {
  coins(x: number, y: number, count: number, power?: number): void;
  rain(count: number): void;
  confetti(x: number, y: number, count: number): void;
  sparks(x: number, y: number, count: number, colors?: string[]): void;
  explode(x: number, y: number): void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const CONFETTI = [Arena.neon, Arena.gold, Arena.cyan, Arena.violet, Arena.danger, '#ffffff'];
const MAX = 260;

/** Ekranın tamamını kaplayan efekt katmanı; dokunuşları engellemez */
export const Effects = forwardRef<EffectsHandle>(function Effects(_, ref) {
  const { width, height } = useWindowDimensions();
  const specs = useSharedValue<Particle[]>([]);
  const clock = useSharedValue(0);
  const pending = useSharedValue(false);
  const activeUntil = useSharedValue(0);

  useFrameCallback((info) => {
    const now = info.timestamp / 1000;
    if (pending.value) {
      pending.value = false;
      let until = activeUntil.value;
      specs.value = specs.value.map((p) => {
        if (p.birth >= 0) return p;
        until = Math.max(until, now + p.life);
        return { ...p, birth: now };
      });
      activeUntil.value = until;
    }
    if (now <= activeUntil.value + 0.1) clock.value = now;
  });

  const add = (list: Particle[]) => {
    scheduleOnUI((incoming: Particle[]) => {
      'worklet';
      const now = clock.value;
      const alive = specs.value.filter((p) => p.birth < 0 || now - p.birth < p.life);
      specs.value = [...alive, ...incoming].slice(-MAX);
      pending.value = true;
    }, list);
  };

  useImperativeHandle(ref, () => ({
    coins(x, y, count, power = 1) {
      add(Array.from({ length: count }, () => ({
        x, y, vx: rand(-260, 260) * power, vy: -rand(420, 900) * power, r: rand(8, 13), life: rand(1.6, 2.3), kind: 0 as const,
        color: Arena.gold, spin: rand(5, 13), drag: 0.5, gravity: 1500, birth: -1,
      })));
    },
    rain(count) {
      add(Array.from({ length: count }, () => ({
        x: rand(0, width), y: -rand(20, height * 0.5), vx: rand(-40, 40), vy: rand(250, 450), r: rand(9, 14), life: rand(2.6, 3.6),
        kind: 0 as const, color: Arena.gold, spin: rand(4, 11), drag: 0, gravity: 700, birth: -1,
      })));
    },
    confetti(x, y, count) {
      add(Array.from({ length: count }, () => ({
        x, y, vx: rand(-650, 650), vy: -rand(450, 1050), r: rand(4, 7), life: rand(1.8, 2.6), kind: 1 as const,
        color: pick(CONFETTI), spin: rand(4, 16), drag: 1.3, gravity: 900, birth: -1,
      })));
    },
    sparks(x, y, count, colors = [Arena.neon, Arena.gold, '#ffffff']) {
      add(Array.from({ length: count }, () => {
        const a = rand(0, Math.PI * 2), s = rand(120, 420);
        return {
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(1.8, 3.6), life: rand(0.5, 0.95), kind: 2 as const,
          color: pick(colors), spin: 0, drag: 3, gravity: 220, birth: -1,
        };
      }));
    },
    explode(x, y) {
      add(Array.from({ length: 90 }, () => {
        const a = rand(0, Math.PI * 2), s = rand(150, 820);
        return {
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(2, 5), life: rand(0.55, 1.2), kind: 2 as const,
          color: pick(['#FFE08A', '#FF9F43', '#FF5E3A', Arena.danger]), spin: 0, drag: 2.6, gravity: 380, birth: -1,
        };
      }));
    },
  }));

  const picture = useDerivedValue(() => {
    const now = clock.value;
    const list = specs.value;
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      for (const p of list) {
        if (p.birth < 0) continue;
        const age = now - p.birth;
        if (age < 0 || age > p.life) continue;
        const f = p.drag > 0 ? (1 - Math.exp(-p.drag * age)) / p.drag : age;
        const x = p.x + p.vx * f;
        const y = p.y + p.vy * f + 0.5 * p.gravity * age * age;
        const fadeStart = p.life * 0.7;
        const alpha = age < fadeStart ? 1 : Math.max(0, 1 - (age - fadeStart) / (p.life - fadeStart));
        if (p.kind === 0) {
          const sx = 0.15 + 0.85 * Math.abs(Math.cos(p.spin * age));
          canvas.save();
          canvas.translate(x, y);
          canvas.scale(sx, 1);
          paint.setColor(Skia.Color('#B87510')); paint.setAlphaf(alpha); canvas.drawCircle(0, 0, p.r, paint);
          paint.setColor(Skia.Color('#FFC83D')); paint.setAlphaf(alpha); canvas.drawCircle(0, 0, p.r * 0.84, paint);
          paint.setColor(Skia.Color('#FFE58A')); paint.setAlphaf(alpha); canvas.drawCircle(0, 0, p.r * 0.5, paint);
          paint.setColor(Skia.Color('#ffffff')); paint.setAlphaf(alpha * 0.75); canvas.drawCircle(-p.r * 0.32, -p.r * 0.36, p.r * 0.18, paint);
          canvas.restore();
        } else if (p.kind === 1) {
          canvas.save();
          canvas.translate(x, y);
          canvas.rotate(p.spin * age * 57.3, 0, 0);
          paint.setColor(Skia.Color(p.color)); paint.setAlphaf(alpha);
          canvas.drawRect(Skia.XYWHRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9 * Math.abs(Math.cos(p.spin * age * 0.7)) + 0.6), paint);
          canvas.restore();
        } else {
          paint.setColor(Skia.Color(p.color));
          paint.setAlphaf(alpha * 0.3); canvas.drawCircle(x, y, p.r * 2.6, paint);
          paint.setAlphaf(alpha); canvas.drawCircle(x, y, p.r, paint);
        }
      }
    });
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
});

export type Tier = 'small' | 'big' | 'mega';

/** Kutlama gücü: ödeme / bahis */
export const tierOf = (bet: number, payout: number): Tier | null =>
  payout <= 0 ? null : payout >= bet * 10 ? 'mega' : payout >= bet * 2.5 ? 'big' : 'small';

/** Ödeme olunca: ses, titreşim, parçacıklar ve sarsıntı (güce göre) */
export function celebrate(fx: EffectsHandle | null, tier: Tier, at: { x: number; y: number }, shake?: (power: number) => void) {
  if (tier === 'mega') {
    sfx('winMega');
    haptic.success();
    setTimeout(haptic.heavy, 420);
    setTimeout(haptic.heavy, 840);
    fx?.coins(at.x, at.y, 60, 1.25);
    fx?.confetti(at.x, at.y, 70);
    setTimeout(() => fx?.rain(70), 500);
    shake?.(1.4);
  } else if (tier === 'big') {
    sfx('winBig');
    haptic.success();
    setTimeout(haptic.medium, 500);
    fx?.coins(at.x, at.y, 34, 1.05);
    fx?.confetti(at.x, at.y, 36);
    shake?.(0.8);
  } else {
    sfx('winSmall');
    haptic.light();
    fx?.coins(at.x, at.y, 12, 0.7);
    fx?.sparks(at.x, at.y, 26);
  }
}

/** Kazanç afişi: güce göre başlık, çarpan ve sayan ödeme. Dokununca ya da süre dolunca kapanır. */
export function WinBanner({ win, onDone }: { win: { tier: Tier; payout: number; bet: number; id: number } | null; onDone: () => void }) {
  const { t } = useT();
  const [shown, setShown] = useState(0);
  const scale = useSharedValue(0.4);
  const shine = useSharedValue(0);

  useEffect(() => {
    if (!win) return;
    scale.value = 0.4;
    scale.value = withSpring(1, { damping: 9, stiffness: 160 });
    shine.value = withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 600 })), -1);
    const ms = win.tier === 'mega' ? 1800 : win.tier === 'big' ? 1100 : 600;
    const start = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / ms);
      setShown(Math.round(win.payout * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const close = setTimeout(onDone, win.tier === 'mega' ? 4200 : win.tier === 'big' ? 2800 : 1500);
    return () => { cancelAnimationFrame(raf); clearTimeout(close); };
  }, [win]); // eslint-disable-line react-hooks/exhaustive-deps

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * shine.value }));
  if (!win) return null;
  const big = win.tier !== 'small';
  const title = t(`celebrate.${win.tier}`);
  return (
    <Animated.View exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="box-none">
      <Pressable onPress={onDone} style={[StyleSheet.absoluteFill, big && styles.dim]} />
      <Animated.View pointerEvents="none" style={[styles.banner, big ? styles.bannerBig : styles.bannerSmall, pop]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.bannerGlow, glowStyle]} />
        <Text style={[styles.title, big && styles.titleBig]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        <Text style={[styles.amount, big && styles.amountBig]} numberOfLines={1} adjustsFontSizeToFit>{`+${formatTokens(shown)}`}</Text>
        <Text style={styles.multi}>{formatMultiplier(win.payout / win.bet)}</Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Patlama/kayıp anında ekranın kısa kırmızı parlaması */
export function useFlash() {
  const o = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  const flash = (strength = 0.35) => { o.set(withSequence(withTiming(strength, { duration: 60 }), withDelay(60, withTiming(0, { duration: 450 })))); };
  return { style, flash };
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  dim: { backgroundColor: 'rgba(3,6,14,0.45)' },
  banner: {
    alignItems: 'center', paddingHorizontal: 28, paddingVertical: 18, borderRadius: 26, borderWidth: 1.5,
    borderColor: 'rgba(255,200,61,0.7)', backgroundColor: 'rgba(12,16,32,0.97)', minWidth: 220, maxWidth: '86%',
  },
  bannerSmall: { boxShadow: glow(Arena.gold, 26, 0.45) },
  bannerBig: { paddingVertical: 26, boxShadow: glow(Arena.gold, 46, 0.7) },
  bannerGlow: { borderRadius: 26, experimental_backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255,200,61,0.28) 0%, rgba(255,200,61,0) 70%)' },
  title: { color: Arena.gold, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 18, letterSpacing: 1.5 },
  titleBig: { fontSize: 28, textShadowColor: Arena.goldDeep, textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } },
  amount: { color: '#ffffff', fontFamily: FontFamily.display, fontWeight: '800', fontSize: 34, marginTop: 4, fontVariant: ['tabular-nums'] },
  amountBig: { fontSize: 48, textShadowColor: Arena.gold, textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } },
  multi: { color: Arena.textDim, fontFamily: FontFamily.ui, fontWeight: '700', fontSize: 15, marginTop: 2 },
});
