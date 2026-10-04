// Slot makinesinin parçaları: ampullü tabela, LED göstergeler, büyük çevir düğmesi ve penaltı mini oyunu.
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';

import { useCountUp } from '@/components/arena/kit';
import { Arena, FontFamily, glow } from '@/constants/arena';
import { haptic } from '@/lib/haptics';
import { sfx } from '@/lib/sound';

export type MarqueeMode = 'idle' | 'spin' | 'win' | 'free';

const BULBS = 16;

/** Tabela: büyük başlık ve kenarlarında kayan ampuller (dönüşte hızlanır, kazançta yanıp söner) */
export function Marquee({ title, sub, mode }: { title: string; sub?: string; mode: MarqueeMode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const duration = mode === 'spin' ? 700 : mode === 'win' ? 260 : 2400;
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1);
  }, [mode, t]);
  const color = mode === 'free' ? Arena.violet : Arena.gold;
  return (
    <View style={[styles.marquee, { borderColor: color, boxShadow: glow(color, 26, 0.5) }]}>
      <BulbRow t={t} mode={mode} color={color} />
      <View style={styles.marqueeBody}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.title, { color, textShadowColor: color }]}>{title}</Text>
        {sub ? <Text numberOfLines={1} style={styles.sub}>{sub}</Text> : null}
      </View>
      <BulbRow t={t} mode={mode} color={color} reverse />
    </View>
  );
}

function BulbRow({ t, mode, color, reverse }: { t: SharedValue<number>; mode: MarqueeMode; color: string; reverse?: boolean }) {
  return (
    <View style={styles.bulbs}>
      {Array.from({ length: BULBS }, (_, i) => <Bulb key={i} i={reverse ? BULBS - 1 - i : i} t={t} mode={mode} color={color} />)}
    </View>
  );
}

function Bulb({ i, t, mode, color }: { i: number; t: SharedValue<number>; mode: MarqueeMode; color: string }) {
  const style = useAnimatedStyle(() => {
    let on: number;
    if (mode === 'win') on = t.value < 0.5 ? 1 : 0.25;
    else {
      // Üçlü ışık kayar
      const head = t.value * BULBS;
      const d = (((head - i) % BULBS) + BULBS) % BULBS;
      on = d < 3 ? 1 - d * 0.25 : 0.22;
    }
    return { opacity: on };
  });
  return <Animated.View style={[styles.bulb, { backgroundColor: color, boxShadow: glow(color, 6, 0.9) }, style]} />;
}

/** LED gösterge: küçük etiket ve sayan değer */
export function Led({ label, value, color = Arena.gold, format, style }: {
  label: string; value: number; color?: string; format: (v: number) => string; style?: StyleProp<ViewStyle>;
}) {
  const shown = useCountUp(value, 500);
  return (
    <View style={[styles.led, style]}>
      <Text style={styles.ledLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.ledValue, { color, textShadowColor: color }]} numberOfLines={1} adjustsFontSizeToFit>{format(shown)}</Text>
    </View>
  );
}

/** Büyük yuvarlak çevir düğmesi: dönerken içindeki oklar döner */
export function SpinButton({ label, onPress, disabled, spinning }: { label: string; onPress: () => void; disabled: boolean; spinning: boolean }) {
  const rot = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    if (spinning) rot.value = withRepeat(withTiming(rot.value + 360, { duration: 650, easing: Easing.linear }), -1);
    else rot.value = withSpring(Math.round(rot.value / 360) * 360);
  }, [spinning, rot]);
  const arrows = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const icon = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    const c = 40, r = 26;
    for (const start of [-80, 100]) {
      const a0 = (start * Math.PI) / 180, a1 = ((start + 140) * Math.PI) / 180;
      p.moveTo(c + r * Math.cos(a0), c + r * Math.sin(a0));
      for (let k = 1; k <= 16; k++) {
        const a = a0 + ((a1 - a0) * k) / 16;
        p.lineTo(c + r * Math.cos(a), c + r * Math.sin(a));
      }
      // Ok ucu
      const tip = { x: c + r * Math.cos(a1), y: c + r * Math.sin(a1) };
      const dir = a1 + Math.PI / 2;
      p.moveTo(tip.x + 9 * Math.cos(dir - 0.6), tip.y + 9 * Math.sin(dir - 0.6)).lineTo(tip.x, tip.y)
        .lineTo(tip.x + 9 * Math.cos(dir + 2.2), tip.y + 9 * Math.sin(dir + 2.2));
    }
    return p.detach();
  }, []);
  return (
    <Animated.View style={scale}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
        onPressIn={() => press.set(withSpring(0.92, { damping: 14, stiffness: 400 }))}
        onPressOut={() => press.set(withSpring(1, { damping: 10, stiffness: 300 }))}
        onPress={() => { haptic.medium(); onPress(); }}
        style={[styles.spin, { opacity: disabled && !spinning ? 0.5 : 1 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, arrows]}>
          <Canvas style={{ width: 80, height: 80 }}>
            <Path path={icon} color="#03140D" style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" opacity={0.85} />
          </Canvas>
        </Animated.View>
        <Text style={styles.spinText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Yuvarlak küçük düğme (−, +, i) */
export function RoundButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      onPress={() => { sfx('tap', { volume: 0.7 }); haptic.select(); onPress(); }}
      style={({ pressed }) => [styles.round, { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}>
      <Text style={styles.roundText}>{label}</Text>
    </Pressable>
  );
}

const CORNERS = [{ x: 0.2, y: 0.4 }, { x: 0.5, y: 0.26 }, { x: 0.8, y: 0.4 }];

/**
 * Penaltı mini oyunu: kale, file, kaleci. Köşe seçilince top o köşeye gider, kaleci başka köşeye atlar
 * ve üç köşedeki ödül birden gösterilir (seçilmeyenler de).
 */
export function PenaltyGame({ prizes, pick, bet, format, title, hint, goal, onShoot }: {
  prizes: number[]; pick: number | null; bet: number; format: (units: number) => string;
  title: string; hint: string; goal: string; onShoot: (corner: number) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ball = useSharedValue(0);
  const keeper = useSharedValue(0);
  // Kaleci seçilmeyen köşelerden birine atlar (sonuç zaten belli: seçilen köşedeki ödül kazanılır)
  const [dive] = useState(() => Math.random());
  useEffect(() => {
    if (pick === null) return;
    ball.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) });
    keeper.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [pick, ball, keeper]);

  // Kaleci hep bir yana atlar: orta seçildiyse rastgele bir yana, yan seçildiyse öbür yana
  const other = pick === null ? 1 : pick === 1 ? (dive < 0.5 ? 0 : 2) : pick === 0 ? 2 : 0;
  const target = pick === null ? CORNERS[1] : CORNERS[pick];
  const keeperTo = CORNERS[other];
  const ballStyle = useAnimatedStyle(() => {
    // Top ödül yazısının üstünde, filede durur
    const x = 0.5 + (target.x - 0.5) * ball.value, y = 0.9 + (target.y - 0.2 - 0.9) * ball.value;
    return {
      left: x * size.w - 13, top: y * size.h - 13,
      transform: [{ scale: 1 - 0.4 * ball.value }, { rotate: `${ball.value * 540}deg` }],
    };
  });
  const keeperStyle = useAnimatedStyle(() => {
    const dx = (keeperTo.x - 0.5) * size.w * 0.8 * keeper.value;
    const angle = (keeperTo.x < 0.5 ? -1 : keeperTo.x > 0.5 ? 1 : 0) * 70 * keeper.value;
    return { transform: [{ translateX: dx }, { translateY: -12 * keeper.value }, { rotate: `${angle}deg` }] };
  });
  const net = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    const left = size.w * 0.08, right = size.w * 0.92, top = size.h * 0.12, bottom = size.h * 0.62;
    for (let x = left; x <= right; x += 14) p.moveTo(x, top).lineTo(x, bottom);
    for (let y = top; y <= bottom; y += 14) p.moveTo(left, y).lineTo(right, y);
    return p.detach();
  }, [size]);

  return (
    <View style={styles.penalty}>
      <Text style={styles.penaltyTitle}>{title}</Text>
      <Text style={styles.penaltyHint}>{hint}</Text>
      <View style={styles.pitch} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {size.w > 0 ? (
          <>
            <Canvas style={StyleSheet.absoluteFill}>
              <Path path={net} color="rgba(255,255,255,0.18)" style="stroke" strokeWidth={1} />
            </Canvas>
            <View style={[styles.goalFrame, { left: size.w * 0.08 - 4, width: size.w * 0.84 + 8, top: size.h * 0.12 - 4, height: size.h * 0.5 + 4 }]} />
            <Animated.View style={[styles.keeper, { left: size.w / 2 - 18, top: size.h * 0.4 }, keeperStyle]}>
              <View style={styles.keeperHead} />
              <View style={styles.keeperBody} />
              <View style={[styles.keeperArm, { left: -14, transform: [{ rotate: '-35deg' }] }]} />
              <View style={[styles.keeperArm, { right: -14, transform: [{ rotate: '35deg' }] }]} />
            </Animated.View>
            {CORNERS.map((c, k) => {
              const chosen = pick === k;
              return (
                <Pressable key={k} disabled={pick !== null} onPress={() => { haptic.heavy(); sfx('whoosh'); onShoot(k); }}
                  accessibilityRole="button" accessibilityLabel={['◀', '▲', '▶'][k]}
                  style={[styles.target, { left: c.x * size.w - 34, top: c.y * size.h - 24 },
                    chosen && { borderColor: Arena.gold, backgroundColor: 'rgba(255,200,61,0.25)', boxShadow: glow(Arena.gold, 18, 0.9) },
                    pick !== null && !chosen && { opacity: 0.55 }]}>
                  {pick === null ? <Pulse /> : (
                    <Animated.Text entering={ZoomIn.delay(chosen ? 450 : 650)} style={[styles.prize, chosen && { color: Arena.gold }]}>
                      {format(prizes[k] * bet)}
                    </Animated.Text>
                  )}
                </Pressable>
              );
            })}
            <Animated.View pointerEvents="none" style={[styles.ball, ballStyle]}>
              <Canvas style={{ width: 26, height: 26 }}>
                <Path path={ballPath} color="#ffffff" />
                <Path path={ballSpots} color="#1A1A1A" />
              </Canvas>
            </Animated.View>
            {pick !== null ? (
              <Animated.Text entering={ZoomIn.delay(520).springify()} style={styles.goal}>{goal}</Animated.Text>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const ballPath = Skia.PathBuilder.Make().addCircle(13, 13, 12).detach();
const ballSpots = (() => {
  const p = Skia.PathBuilder.Make();
  const pent = (cx: number, cy: number, r: number) => {
    for (let i = 0; i < 5; i++) {
      const a = (-90 + i * 72) * (Math.PI / 180);
      if (i === 0) p.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      else p.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    p.close();
  };
  pent(13, 13, 4.5);
  pent(5, 9, 2.6);
  pent(21, 9, 2.6);
  pent(8, 21, 2.6);
  pent(18, 21, 2.6);
  return p.detach();
})();

function Pulse() {
  const v = useSharedValue(0);
  useEffect(() => { v.value = withRepeat(withSequence(withTiming(1, { duration: 550 }), withTiming(0, { duration: 550 })), -1); }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * v.value, transform: [{ scale: 0.9 + 0.15 * v.value }] }));
  return <Animated.Text style={[styles.question, style]}>?</Animated.Text>;
}

/** Bedava dönüş kazanıldı kartı */
export function FreeSpinsCard({ title, multiplier, button, onStart }: { title: string; multiplier: string; button: string; onStart: () => void }) {
  return (
    <Animated.View entering={ZoomIn.springify()} style={styles.free}>
      <Animated.View entering={FadeIn.delay(200)} style={styles.freeBadge}>
        <Text style={styles.freeBadgeText}>{multiplier}</Text>
      </Animated.View>
      <Text style={styles.freeTitle}>{title}</Text>
      <Pressable onPress={() => { haptic.medium(); onStart(); }} style={({ pressed }) => [styles.freeButton, { opacity: pressed ? 0.8 : 1 }]}>
        <Text style={styles.freeButtonText}>{button}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  marquee: {
    borderRadius: 20, borderWidth: 2.5, paddingVertical: 6, paddingHorizontal: 10, gap: 4,
    experimental_backgroundImage: 'linear-gradient(180deg, #2A1650 0%, #120A2A 100%)',
  },
  marqueeBody: { alignItems: 'center', marginVertical: -6 },
  title: {
    fontFamily: FontFamily.display, fontWeight: '800', fontSize: 30, lineHeight: 38, letterSpacing: 3, paddingHorizontal: 28, paddingVertical: 8,
    textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 },
  },
  sub: { color: '#E9D8FF', fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  bulbs: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  bulb: { width: 7, height: 7, borderRadius: 4 },
  led: {
    flex: 1, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center',
    backgroundColor: '#05070F', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0px 2px 8px rgba(0,0,0,0.8)',
  },
  ledLabel: { color: Arena.textFaint, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  ledValue: {
    fontFamily: FontFamily.display, fontWeight: '700', fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'],
    textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 }, paddingHorizontal: 14, paddingVertical: 4, marginVertical: -4,
  },
  spin: {
    width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#B8FFE0',
    experimental_backgroundImage: `radial-gradient(circle at 35% 30%, #9CFFD6 0%, ${Arena.neon} 35%, ${Arena.neonDeep} 100%)`,
    boxShadow: `${glow(Arena.neon, 26, 0.6)}, 0px 6px 14px rgba(0,0,0,0.6)`,
  },
  spinText: { color: Arena.onNeon, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  round: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Arena.glassStrong, borderWidth: 1, borderColor: Arena.glassBorder,
  },
  roundText: { color: Arena.text, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 18 },
  penalty: {
    borderRadius: 24, padding: 14, gap: 6, borderWidth: 2, borderColor: Arena.gold, backgroundColor: 'rgba(10,14,30,0.97)',
    boxShadow: glow(Arena.gold, 30, 0.5),
  },
  penaltyTitle: { color: Arena.gold, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 22, textAlign: 'center' },
  penaltyHint: { color: Arena.textDim, fontFamily: FontFamily.ui, fontWeight: '600', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  pitch: {
    height: 230, borderRadius: 16, overflow: 'hidden', marginTop: 6,
    experimental_backgroundImage: 'linear-gradient(180deg, #0B1D3A 0%, #0B1D3A 55%, #1C7A45 56%, #12542F 100%)',
  },
  goalFrame: { position: 'absolute', borderWidth: 5, borderBottomWidth: 0, borderColor: '#F2F5FA', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  keeper: { position: 'absolute', width: 36, height: 58, alignItems: 'center' },
  keeperHead: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#F2C9A0' },
  keeperBody: { width: 28, height: 38, borderRadius: 8, marginTop: 2, backgroundColor: '#FF9F1C', borderWidth: 2, borderColor: '#1A1A1A' },
  keeperArm: { position: 'absolute', top: 18, width: 22, height: 8, borderRadius: 4, backgroundColor: '#FF9F1C' },
  target: {
    position: 'absolute', width: 68, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(61,217,255,0.8)', backgroundColor: 'rgba(61,217,255,0.12)',
  },
  question: { color: Arena.cyan, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 22 },
  prize: { color: Arena.text, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] },
  ball: { position: 'absolute', width: 26, height: 26 },
  goal: {
    position: 'absolute', bottom: 8, alignSelf: 'center', color: Arena.gold, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 30,
    textShadowColor: Arena.goldDeep, textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 }, paddingHorizontal: 24, paddingVertical: 10,
  },
  free: {
    alignItems: 'center', gap: 14, padding: 22, borderRadius: 26, borderWidth: 2, borderColor: Arena.gold,
    backgroundColor: 'rgba(18,10,42,0.97)', boxShadow: glow(Arena.violet, 40, 0.6),
  },
  freeBadge: {
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: Arena.violet, boxShadow: glow(Arena.violet, 16, 0.8),
  },
  freeBadgeText: { color: '#ffffff', fontFamily: FontFamily.display, fontWeight: '800', fontSize: 16 },
  freeTitle: {
    color: Arena.gold, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 26, lineHeight: 34, textAlign: 'center',
    textShadowColor: Arena.goldDeep, textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 }, paddingHorizontal: 10,
  },
  freeButton: {
    alignSelf: 'stretch', borderRadius: 18, paddingVertical: 16, alignItems: 'center',
    experimental_backgroundImage: `linear-gradient(135deg, ${Arena.gold} 0%, ${Arena.goldDeep} 100%)`, boxShadow: glow(Arena.gold, 20, 0.6),
  },
  freeButtonText: { color: Arena.onGold, fontFamily: FontFamily.display, fontWeight: '800', fontSize: 17 },
});

