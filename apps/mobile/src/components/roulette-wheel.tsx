// Avrupa rulet çarkı (Skia). Çark saat yönünde, top ters yönde döner; ikisi aynı anda durur ve top kazanan cebe, en üste
// düşer. Sonuç dönüş başlamadan belli; animasyon sadece onu gösterir, "kıl payı" etkisi için yavaşlatma ya da sapma yok.
import { WHEEL_ORDER, colorOf } from '@oran/games-math';
import {
  BlurMask, Canvas, Circle, Group, matchFont, Path, RadialGradient, Skia, SweepGradient, Text, vec,
} from '@shopify/react-native-skia';
import { forwardRef, memo, useImperativeHandle, useMemo } from 'react';
import { Platform } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

export const POCKET_COLORS = { green: '#0FA35A', red: '#D62F45', black: '#171A22' } as const;
const SECTOR = 360 / WHEEL_ORDER.length;
/** Çarkın dönüş süresi; tur sonucu bu süre sonunda gösterilir */
export const SPIN_MS = 4_800;

export interface WheelHandle { spinTo: (number: number) => void }

// memo: masaya her fiş konduğunda çark yeniden çizilmesin (37 dilim + 37 yazı)
export const RouletteWheel = memo(forwardRef<WheelHandle, { size: number }>(function RouletteWheel({ size }, ref) {
  const rotation = useSharedValue(0); // derece, saat yönünde
  const ballAngle = useSharedValue(0); // derece, ekranda; 0 = tepe
  const c = size / 2;
  const rim = c - 4;
  const outer = rim * 0.86; // cep halkasının dışı
  const inner = rim * 0.62; // cep halkasının içi
  const track = rim * 0.93; // topun döndüğü yol
  const pocketR = rim * 0.7; // topun düştüğü yer: numaranın altında, cebin içinde
  const ballR = useSharedValue(pocketR);
  const ballSize = Math.max(5, rim * 0.045);
  const font = useMemo(() => matchFont({
    fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
    fontSize: Math.max(9, Math.round(size / 25)),
    fontWeight: 'bold',
  }), [size]);

  useImperativeHandle(ref, () => ({
    spinTo: (number: number) => {
      const index = WHEEL_ORDER.indexOf(number as (typeof WHEEL_ORDER)[number]);
      const current = rotation.value;
      // Cep i, çark R kadar dönünce i·SECTOR + R açısında: tepeye (0°) gelmesi için R ≡ −i·SECTOR
      const offset = (((-index * SECTOR - current) % 360) + 360) % 360;
      rotation.value = withTiming(current + 5 * 360 + offset, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) });
      // Top ters yönde 4 tur atıp tepede durur
      const b = ballAngle.value;
      ballAngle.value = withTiming(Math.floor(b / 360) * 360 - 4 * 360, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) });
      ballR.value = withSequence(
        withTiming(track, { duration: 250 }),
        withTiming(track, { duration: SPIN_MS * 0.66 - 250 }),
        withTiming(pocketR, { duration: SPIN_MS * 0.34, easing: Easing.bounce }),
      );
    },
  }), [rotation, ballAngle, ballR, track, pocketR]);

  const sectors = useMemo(() => WHEEL_ORDER.map((n, i) => {
    const start = -90 + i * SECTOR - SECTOR / 2;
    const path = Skia.PathBuilder.Make()
      .arcToOval(Skia.XYWHRect(c - outer, c - outer, 2 * outer, 2 * outer), start, SECTOR, true)
      .arcToOval(Skia.XYWHRect(c - inner, c - inner, 2 * inner, 2 * inner), start + SECTOR, -SECTOR, false)
      .close()
      .detach();
    const label = String(n);
    return {
      n, label, path, color: POCKET_COLORS[colorOf(n)], angle: (i * SECTOR * Math.PI) / 180,
      x: -font.measureText(label).width / 2, y: -outer + font.getSize() + 3,
    };
  }), [c, outer, inner, font]);

  // Cepler arası altın çizgiler
  const frets = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    for (let i = 0; i < WHEEL_ORDER.length; i++) {
      const a = ((-90 + i * SECTOR - SECTOR / 2) * Math.PI) / 180;
      p.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner).lineTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer);
    }
    return p.detach();
  }, [c, inner, outer]);

  // Ortadaki göbeğin dört kolu
  const turret = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    const l = inner * 0.78, w = rim * 0.025;
    for (const a of [0, Math.PI / 2]) {
      const cos = Math.cos(a), sin = Math.sin(a);
      p.addPoly([
        vec(c - cos * l - sin * w, c - sin * l + cos * w), vec(c + cos * l - sin * w, c + sin * l + cos * w),
        vec(c + cos * l + sin * w, c + sin * l - cos * w), vec(c - cos * l + sin * w, c - sin * l - cos * w),
      ], true);
    }
    return p.detach();
  }, [c, inner, rim]);

  const transform = useDerivedValue(() => [{ rotate: (rotation.value * Math.PI) / 180 }]);
  const bx = useDerivedValue(() => c + ballR.value * Math.sin((ballAngle.value * Math.PI) / 180));
  const by = useDerivedValue(() => c - ballR.value * Math.cos((ballAngle.value * Math.PI) / 180));
  const hx = useDerivedValue(() => bx.value - ballSize * 0.32);
  const hy = useDerivedValue(() => by.value - ballSize * 0.32);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Dış altın kenar ve topun yolu */}
      <Circle cx={c} cy={c} r={rim}>
        <SweepGradient c={vec(c, c)} colors={['#F7D57A', '#9C6B1E', '#FFE7A3', '#8A5A12', '#F7D57A']} />
      </Circle>
      <Circle cx={c} cy={c} r={rim * 0.965}>
        <RadialGradient c={vec(c, c)} r={rim} colors={['#2A1A0E', '#140C06']} />
      </Circle>
      <Circle cx={c} cy={c} r={outer + 2} color="#C99A3C" />
      <Group origin={{ x: c, y: c }} transform={transform}>
        {sectors.map((s) => <Path key={s.n} path={s.path} color={s.color} />)}
        <Path path={frets} color="#E7C46B" style="stroke" strokeWidth={1.4} />
        {sectors.map((s) => (
          <Group key={`t${s.n}`} transform={[{ translateX: c }, { translateY: c }, { rotate: s.angle }]}>
            <Text x={s.x} y={s.y} text={s.label} font={font} color="#ffffff" />
          </Group>
        ))}
        <Circle cx={c} cy={c} r={inner} color="#C99A3C" />
        <Circle cx={c} cy={c} r={inner - 2.5}>
          <RadialGradient c={vec(c - inner * 0.3, c - inner * 0.3)} r={inner * 1.4} colors={['#6B4524', '#2B1A0C']} />
        </Circle>
        <Path path={turret} color="#E7C46B" />
        <Circle cx={c} cy={c} r={rim * 0.07}>
          <RadialGradient c={vec(c - rim * 0.02, c - rim * 0.02)} r={rim * 0.08} colors={['#FFF1C1', '#C99A3C']} />
        </Circle>
      </Group>
      {/* Top: gölgesi ve parlak yüzü */}
      <Circle cx={bx} cy={by} r={ballSize * 1.5} color="#000000" opacity={0.35}>
        <BlurMask blur={4} style="normal" />
      </Circle>
      <Circle cx={bx} cy={by} r={ballSize} color="#DDE3EE" />
      <Circle cx={hx} cy={hy} r={ballSize * 0.45} color="#ffffff" />
    </Canvas>
  );
}));
