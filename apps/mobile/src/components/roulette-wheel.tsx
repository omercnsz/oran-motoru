// Avrupa rulet çarkı (Skia). Çark dönüp kazanan cebi üstteki işaretin altına getirir. Sonuç dönüş başlamadan belli;
// animasyon sadece onu gösterir, "kıl payı" etkisi için yavaşlatma ya da sapma yok.
import { WHEEL_ORDER, colorOf } from '@oran/games-math';
import { Canvas, Circle, Group, matchFont, Path, Skia, Text } from '@shopify/react-native-skia';
import { forwardRef, memo, useImperativeHandle, useMemo } from 'react';
import { Platform } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

export const POCKET_COLORS = { green: '#1B7F3B', red: '#C62828', black: '#1F1F1F' } as const;
const SECTOR = 360 / WHEEL_ORDER.length;
/** Çarkın dönüş süresi; tur sonucu bu süre sonunda gösterilir */
export const SPIN_MS = 4_500;

export interface WheelHandle { spinTo: (number: number) => void }

// memo: masaya her jeton konduğunda çark yeniden çizilmesin (37 dilim + 37 yazı)
export const RouletteWheel = memo(forwardRef<WheelHandle, { size: number }>(function RouletteWheel({ size }, ref) {
  const rotation = useSharedValue(0); // derece, saat yönünde
  const c = size / 2;
  const r = c - 6;
  const font = useMemo(() => matchFont({
    fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
    fontSize: Math.max(9, Math.round(size / 26)),
    fontWeight: 'bold',
  }), [size]);

  useImperativeHandle(ref, () => ({
    spinTo: (number: number) => {
      const index = WHEEL_ORDER.indexOf(number as (typeof WHEEL_ORDER)[number]);
      const current = rotation.value;
      // Cep i, çark R kadar dönünce i·SECTOR + R açısında: tepeye (0°) gelmesi için R ≡ −i·SECTOR
      const offset = (((-index * SECTOR - current) % 360) + 360) % 360;
      rotation.value = withTiming(current + 5 * 360 + offset, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) });
    },
  }), [rotation]);

  const sectors = useMemo(() => WHEEL_ORDER.map((n, i) => {
    const path = Skia.PathBuilder.Make()
      .moveTo(c, c)
      .arcToOval(Skia.XYWHRect(c - r, c - r, 2 * r, 2 * r), -90 + i * SECTOR - SECTOR / 2, SECTOR, false)
      .close()
      .detach();
    const label = String(n);
    return {
      n, label, path, color: POCKET_COLORS[colorOf(n)], angle: (i * SECTOR * Math.PI) / 180,
      x: -font.measureText(label).width / 2, y: -r + font.getSize() + 4,
    };
  }), [c, r, font]);

  const transform = useDerivedValue(() => [{ rotate: (rotation.value * Math.PI) / 180 }]);

  const pointer = useMemo(() => Skia.PathBuilder.Make().moveTo(c - 9, 0).lineTo(c + 9, 0).lineTo(c, 16).close().detach(), [c]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group origin={{ x: c, y: c }} transform={transform}>
        <Circle cx={c} cy={c} r={r + 3} color="#8A6D3B" />
        {sectors.map((s) => <Path key={s.n} path={s.path} color={s.color} />)}
        {sectors.map((s) => (
          <Group key={`t${s.n}`} transform={[{ translateX: c }, { translateY: c }, { rotate: s.angle }]}>
            <Text x={s.x} y={s.y} text={s.label} font={font} color="#ffffff" />
          </Group>
        ))}
        <Circle cx={c} cy={c} r={r * 0.62} color="#5C4326" />
        <Circle cx={c} cy={c} r={r * 0.18} color="#C9A45C" />
      </Group>
      <Path path={pointer} color="#F2C14E" />
    </Canvas>
  );
}));
