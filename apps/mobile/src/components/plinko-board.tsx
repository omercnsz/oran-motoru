// Plinko tahtası: üstte 3, altta n+2 çivi; cepler alttaki çivilerin arasında. Top, tur başında çekilip kaydedilen yolu
// birebir izler (her sırada sağa ya da sola). Cepler kayıpsa (1×'in altı) kırmızı, değilse yeşil yazılır.
import { PLINKO_TABLES, type PlinkoRisk, type PlinkoRows } from '@oran/games-math';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { localization } from '@/i18n';

/** Bir sıradan ötekine düşüş süresi */
const SEG_MS = 150;

export interface PlinkoHandle {
  /** Topu verilen yoldan bırakır; cebe düşünce onLanded çağrılır */
  drop(path: boolean[], onLanded: () => void): void;
}

function geometry(width: number, rows: number) {
  const s = width / (rows + 2);
  const rowGap = s * 0.92;
  const top = rowGap * 1.1;
  return {
    s, rowGap, top, cx: width / 2,
    height: top + (rows - 1) * rowGap + rowGap * 0.9,
    pegR: Math.max(2.5, s * 0.11),
    ballR: Math.max(5, s * 0.28),
  };
}

const bucketFormat = () => new Intl.NumberFormat(localization().locale, { maximumFractionDigits: 2 });

export const PlinkoBoard = memo(forwardRef<PlinkoHandle, { width: number; rows: PlinkoRows; risk: PlinkoRisk; landed: number | null }>(
  function PlinkoBoard({ width, rows, risk, landed }, ref) {
    const theme = useTheme();
    const g = useMemo(() => geometry(width, rows), [width, rows]);
    const progress = useSharedValue(0);
    const visible = useSharedValue(0);
    const path = useSharedValue<number[]>([]);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sıra sayısı değişince eski top gizlenir
    useEffect(() => { visible.value = 0; }, [rows, visible]);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    useImperativeHandle(ref, () => ({
      drop(p, onLanded) {
        path.value = p.map(Number);
        progress.value = 0;
        visible.value = 1;
        const duration = (p.length + 1) * SEG_MS;
        progress.value = withTiming(p.length + 1, { duration, easing: Easing.linear });
        timer.current = setTimeout(onLanded, duration + 60);
      },
    }), [path, progress, visible]);

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

    const table = PLINKO_TABLES[rows][risk];
    const format = bucketFormat();
    const fontSize = Math.min(12, Math.max(7, g.s * 0.34));
    return (
      <View>
        <Canvas style={{ width, height: g.height }}>
          <Path path={pegs} color={theme.textSecondary} />
          <Circle cx={bx} cy={by} r={g.ballR} color={theme.accent} opacity={visible} />
        </Canvas>
        <View style={[styles.buckets, { paddingHorizontal: g.s / 2 }]}>
          {table.map((m, k) => {
            const color = m >= 1 ? theme.success : theme.danger;
            const hit = landed === k;
            return (
              <View key={k} style={[styles.bucket, { backgroundColor: hit ? color : theme.backgroundSelected }]}>
                <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
                  style={{ fontSize, lineHeight: fontSize * 1.3, fontWeight: 700, color: hit ? '#ffffff' : color }}>
                  {format.format(m)}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
    );
  },
));

const styles = StyleSheet.create({
  buckets: { flexDirection: 'row' },
  bucket: { flex: 1, marginHorizontal: 1, borderRadius: 4, paddingVertical: 4, alignItems: 'center' },
});
