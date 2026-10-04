// Plinko tahtası: üstte 3, altta n+2 çivi; cepler alttaki çivilerin arasında. Top, tur başında çekilip kaydedilen yolu
// birebir izler (her sırada sağa ya da sola). Bahsin altında ödeyen cepler soğuk, üstünde ödeyenler sıcak renkte.
import { PLINKO_TABLES, type PlinkoRisk, type PlinkoRows } from '@oran/games-math';
import { BlurMask, Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import { Arena, FontFamily, glow } from '@/constants/arena';
import { localization } from '@/i18n';

/** Bir sıradan ötekine düşüş süresi */
export const SEG_MS = 150;

export interface PlinkoHandle {
  /** Topu verilen yoldan bırakır; her sırada onPeg, cebe düşünce onLanded çağrılır */
  drop(path: boolean[], onLanded: () => void, onPeg?: (row: number) => void): void;
}

function geometry(width: number, rows: number) {
  const s = width / (rows + 2);
  const rowGap = s * 0.92;
  const top = rowGap * 1.1;
  return {
    s, rowGap, top, cx: width / 2,
    height: top + (rows - 1) * rowGap + rowGap * 0.9,
    pegR: Math.max(2.5, s * 0.1),
    ballR: Math.max(5, s * 0.27),
  };
}

/** Cep rengi: kayıp cepler soğuk, kazanç büyüdükçe sıcak */
export const bucketColor = (m: number) =>
  m < 1 ? '#3F5A8C' : m < 2 ? Arena.gold : m < 5 ? '#FF9F43' : m < 20 ? '#FF5E57' : '#FF2E88';

export const PlinkoBoard = memo(forwardRef<PlinkoHandle, { width: number; rows: PlinkoRows; risk: PlinkoRisk; landed: number | null }>(
  function PlinkoBoard({ width, rows, risk, landed }, ref) {
    const g = useMemo(() => geometry(width, rows), [width, rows]);
    const progress = useSharedValue(0);
    const visible = useSharedValue(0);
    const path = useSharedValue<number[]>([]);
    const bounce = useSharedValue(0);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    // Sıra sayısı değişince eski top gizlenir
    useEffect(() => { visible.value = 0; }, [rows, visible]);
    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    useImperativeHandle(ref, () => ({
      drop(p, onLanded, onPeg) {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        path.value = p.map(Number);
        progress.value = 0;
        visible.value = 1;
        const duration = (p.length + 1) * SEG_MS;
        progress.value = withTiming(p.length + 1, { duration, easing: Easing.linear });
        for (let r = 0; r < p.length; r++) timers.current.push(setTimeout(() => onPeg?.(r), (r + 1) * SEG_MS));
        timers.current.push(setTimeout(() => {
          bounce.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 6, stiffness: 220 }));
          onLanded();
        }, duration + 40));
      },
    }), [path, progress, visible, bounce]);

    const pegs = useMemo(() => {
      const b = Skia.PathBuilder.Make();
      for (let r = 0; r < rows; r++) {
        for (let j = 0; j < r + 3; j++) b.addCircle(g.cx + (j - (r + 2) / 2) * g.s, g.top + r * g.rowGap, g.pegR);
      }
      return b.detach();
    }, [g, rows]);

    // Topun yeri: j. nokta j. sıradaki çiviye çarptığı yer (−1 başlangıç, n cep). Her parça bir sıradan ötekine.
    const ball = useDerivedValue(() => {
      const p = path.value;
      const n = p.length;
      const point = (j: number) => {
        if (j < 0) return { x: g.cx, y: g.ballR + 2 };
        let rights = 0;
        for (let i = 0; i < j; i++) rights += p[i];
        const x = g.cx + (rights - j / 2) * g.s;
        const y = j < n ? g.top + j * g.rowGap - g.pegR - g.ballR : g.height - g.ballR - 2;
        return { x, y };
      };
      const seg = Math.min(Math.floor(progress.value), n);
      const u = Math.min(1, progress.value - seg);
      const a = point(seg - 1), b = point(seg);
      const hop = seg > 0 ? g.rowGap * 0.3 * 4 * u * (1 - u) : 0;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u * u - hop };
    }, [g]);
    const bx = useDerivedValue(() => ball.value.x);
    const by = useDerivedValue(() => ball.value.y);
    const glowOpacity = useDerivedValue(() => visible.value * 0.55);

    const table = PLINKO_TABLES[rows][risk];
    const format = new Intl.NumberFormat(localization().locale, { maximumFractionDigits: 2 });
    const fontSize = Math.min(12, Math.max(7, g.s * 0.33));
    const landedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 6 * bounce.value }] }));
    return (
      <View>
        <Canvas style={{ width, height: g.height }}>
          <Path path={pegs} color={Arena.cyan} opacity={0.35}>
            <BlurMask blur={3} style="normal" />
          </Path>
          <Path path={pegs} color="#E6F2FF" />
          <Group opacity={visible}>
            <Circle cx={bx} cy={by} r={g.ballR * 2.2} color={Arena.gold} opacity={glowOpacity}>
              <BlurMask blur={8} style="normal" />
            </Circle>
            <Circle cx={bx} cy={by} r={g.ballR} color={Arena.gold} />
            <Circle cx={bx} cy={by} r={g.ballR * 0.45} color="#FFF4C7" />
          </Group>
        </Canvas>
        <View style={[styles.buckets, { paddingHorizontal: g.s / 2 }]}>
          {table.map((m, k) => {
            const color = bucketColor(m);
            const hit = landed === k;
            return (
              <Animated.View key={k} style={[styles.bucket, hit && landedStyle, {
                backgroundColor: hit ? color : `${color}33`, borderColor: color,
                boxShadow: hit ? glow(color, 14, 0.9) : undefined,
              }]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
                  style={[styles.bucketText, { fontSize, lineHeight: fontSize * 1.3, color: hit ? (m < 1 ? '#ffffff' : '#0A0A12') : m < 1 ? '#AFC3EA' : color }]}>
                  {format.format(m)}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    );
  },
));

const styles = StyleSheet.create({
  buckets: { flexDirection: 'row' },
  bucket: { flex: 1, marginHorizontal: 1, borderRadius: 5, paddingVertical: 4, alignItems: 'center', borderWidth: 1 },
  bucketText: { fontFamily: FontFamily.ui, fontWeight: '800' },
});
