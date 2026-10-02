// Kümülatif sonuç grafiği: dönemin başında 0'dan başlar, her gün o günün sonucu eklenir. Sıfır çizgisi kesikli.
import { Canvas, DashPathEffect, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate } from '@/lib/format';

const HEIGHT = 140;
const PAD = 8;

export function ResultChart({ series, start, format }: {
  series: { day: string; total: number }[];
  /** Dönemin ilk günü (YYYY-MM-DD); grafik o gün 0'dan başlar. Yoksa ilk veri günü. */
  start?: string;
  /** Eksen etiketi için tutar biçimi */
  format: (minor: number) => string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const points = useMemo(() => [{ day: '', total: 0 }, ...series], [series]);
  const min = Math.min(0, ...points.map((p) => p.total));
  const max = Math.max(0, ...points.map((p) => p.total));
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / Math.max(1, points.length - 1)) * (width - 2 * PAD);
  const y = (v: number) => PAD + ((max - v) / span) * (HEIGHT - 2 * PAD);
  const last = points.at(-1)!.total;
  const color = last < 0 ? theme.danger : last > 0 ? theme.success : theme.textSecondary;

  const { line, area } = useMemo(() => {
    const l = Skia.PathBuilder.Make();
    const a = Skia.PathBuilder.Make().moveTo(x(0), y(0));
    points.forEach((p, i) => {
      if (i === 0) l.moveTo(x(i), y(p.total));
      else l.lineTo(x(i), y(p.total));
      a.lineTo(x(i), y(p.total));
    });
    a.lineTo(x(points.length - 1), y(0)).close();
    return { line: l.detach(), area: a.detach() };
    // x ve y genişliğe ve uç değerlere bağlı
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, width, min, max]);

  return (
    <View style={styles.wrap}>
      <View style={styles.axis}>
        <ThemedText type="small" themeColor="textSecondary">{format(max)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{format(min)}</ThemedText>
      </View>
      <View style={styles.plot} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Canvas style={{ width, height: HEIGHT }}>
            <Path path={area} color={color} opacity={0.12} />
            <Line p1={vec(PAD, y(0))} p2={vec(width - PAD, y(0))} color={theme.textSecondary} strokeWidth={1}>
              <DashPathEffect intervals={[4, 4]} />
            </Line>
            <Path path={line} color={color} style="stroke" strokeWidth={3} strokeJoin="round" strokeCap="round" />
          </Canvas>
        ) : null}
        {series.length > 0 ? (
          <View style={styles.dates}>
            <ThemedText type="small" themeColor="textSecondary">{formatShortDate(start ?? series[0].day)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{formatShortDate(series.at(-1)!.day)}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6 },
  axis: { height: HEIGHT, justifyContent: 'space-between', paddingVertical: 0 },
  plot: { flex: 1 },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
});
