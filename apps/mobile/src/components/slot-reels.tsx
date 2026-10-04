// Slot makaraları (Skia: tek tuval, sadece görünen semboller çizilir). Dönerken gerçek şerit kayar (ekranda görünen,
// şeridin kendisidir) ve makaralar içerikten bağımsız, sabit sürelerle soldan sağa durur: iki top gelince son makarayı
// yavaşlatıp heyecan yaratma yok. Hızlı kayan kısımda sembollerin hareket bulanıklığı uygulanmış kopyaları çizilir;
// duran pencere hep keskin. Kazanan çizgiler parlayan çizgilerle çizilir, kazanan semboller nabız gibi atar.
import { LINES, REELS, SLOT, type SlotSymbol } from '@oran/games-math';
import {
  BlurMask, Canvas, ClipOp, createPicture, Path, Picture, Skia, useImage, type SkImage,
} from '@shopify/react-native-skia';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export const SYMBOL_IMAGES: Record<SlotSymbol, number> = {
  wild: require('@/assets/slot/wild.png'),
  scatter: require('@/assets/slot/scatter.png'),
  bonus: require('@/assets/slot/bonus.png'),
  boot: require('@/assets/slot/boot.png'),
  gloves: require('@/assets/slot/gloves.png'),
  jersey: require('@/assets/slot/jersey.png'),
  flag: require('@/assets/slot/flag.png'),
  watch: require('@/assets/slot/watch.png'),
  yellow: require('@/assets/slot/yellow.png'),
  red: require('@/assets/slot/red.png'),
  scarf: require('@/assets/slot/scarf.png'),
};

const BLUR_IMAGES: Record<SlotSymbol, number> = {
  wild: require('@/assets/slot/wild-blur.png'),
  scatter: require('@/assets/slot/scatter-blur.png'),
  bonus: require('@/assets/slot/bonus-blur.png'),
  boot: require('@/assets/slot/boot-blur.png'),
  gloves: require('@/assets/slot/gloves-blur.png'),
  jersey: require('@/assets/slot/jersey-blur.png'),
  flag: require('@/assets/slot/flag-blur.png'),
  watch: require('@/assets/slot/watch-blur.png'),
  yellow: require('@/assets/slot/yellow-blur.png'),
  red: require('@/assets/slot/red-blur.png'),
  scarf: require('@/assets/slot/scarf-blur.png'),
};

const SYMBOLS = Object.keys(SYMBOL_IMAGES) as SlotSymbol[];
const INDEX = Object.fromEntries(SYMBOLS.map((s, i) => [s, i])) as Record<SlotSymbol, number>;

/** Kazanan çizgi renkleri (çizgi numarasına göre) */
export const LINE_COLORS = ['#FFC83D', '#2BFFA8', '#3DD9FF', '#FF5E9C', '#B26BFF', '#FF9F43', '#7CFF6B', '#FF5E57', '#4C8DFF', '#FFE066'];

/** Makaranın dönüş süresi: ilk makara, sonra her biri bu kadar sonra (içerikten bağımsız) */
const FIRST_STOP_MS = 900;
const STOP_GAP_MS = 260;
/** Durmaya yakın gösterilen bu kadar hücre keskin (yavaşlarken okunur) */
const SHARP_TAIL = 4;
export const spinDuration = (fast: boolean) => (fast ? 0.6 : 1) * (FIRST_STOP_MS + STOP_GAP_MS * (SLOT.reels - 1));

export interface ReelsHandle {
  /** Makaraları yeni durma noktalarına çevirir; her makara durunca onReelStop, hepsi bitince onDone */
  spin: (stops: number[], fast: boolean, onDone: () => void, onReelStop?: (reel: number) => void) => void;
}

/** Şeritte from'dan to'ya aşağı doğru kayarken görünen hücreler (üstten alta): to, to+1, … from+2 ve bir tam tur */
function path(strip: readonly SlotSymbol[], from: number, to: number): number[] {
  const n = strip.length;
  const distance = ((from - to + n) % n) + n; // en az bir tam tur
  return Array.from({ length: distance + SLOT.rows }, (_, j) => INDEX[strip[(to + j) % n]]);
}
const windowAt = (strip: readonly SlotSymbol[], stop: number) => [0, 1, 2].map((r) => INDEX[strip[(stop + r) % strip.length]]);

/** Sembol resimleri Skia'ya yüklenir (keskin ve bulanık); sıra SYMBOLS ile aynı */
function useSymbolImages() {
  const sharp = [
    useImage(SYMBOL_IMAGES.wild), useImage(SYMBOL_IMAGES.scatter), useImage(SYMBOL_IMAGES.bonus), useImage(SYMBOL_IMAGES.boot),
    useImage(SYMBOL_IMAGES.gloves), useImage(SYMBOL_IMAGES.jersey), useImage(SYMBOL_IMAGES.flag), useImage(SYMBOL_IMAGES.watch),
    useImage(SYMBOL_IMAGES.yellow), useImage(SYMBOL_IMAGES.red), useImage(SYMBOL_IMAGES.scarf),
  ];
  const blur = [
    useImage(BLUR_IMAGES.wild), useImage(BLUR_IMAGES.scatter), useImage(BLUR_IMAGES.bonus), useImage(BLUR_IMAGES.boot),
    useImage(BLUR_IMAGES.gloves), useImage(BLUR_IMAGES.jersey), useImage(BLUR_IMAGES.flag), useImage(BLUR_IMAGES.watch),
    useImage(BLUR_IMAGES.yellow), useImage(BLUR_IMAGES.red), useImage(BLUR_IMAGES.scarf),
  ];
  const ready = sharp.every(Boolean) && blur.every(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (ready ? { sharp: sharp as SkImage[], blur: blur as SkImage[] } : null), [ready]);
}

export const SlotReels = memo(forwardRef<ReelsHandle, {
  width: number; initialStops: number[]; highlight: ReadonlySet<string>;
  /** Kazanan çizgilerin numaraları (0'dan) */
  lines?: readonly number[];
}>(function SlotReels({ width, initialStops, highlight, lines = [] }, ref) {
  const cell = Math.floor((width - 2 * PAD - 4 * GAP) / SLOT.reels);
  // Sıralar biraz uzun: makine ekranı daha dolu görünsün (semboller kare kalır)
  const rowH = Math.round(cell * ROW_RATIO);
  const height = rowH * SLOT.rows;
  const innerWidth = cell * SLOT.reels + GAP * (SLOT.reels - 1);
  const [stops, setStops] = useState(initialStops);
  const images = useSymbolImages();
  const strips = useSharedValue<number[][]>(REELS.map((strip, i) => windowAt(strip, initialStops[i])));
  const hl = useSharedValue<boolean[]>(new Array(15).fill(false));
  const o0 = useSharedValue(0), o1 = useSharedValue(0), o2 = useSharedValue(0), o3 = useSharedValue(0), o4 = useSharedValue(0);
  const offsets = useMemo(() => [o0, o1, o2, o3, o4], [o0, o1, o2, o3, o4]);
  const pulse = useSharedValue(0);

  // Kazanan semboller ve çizgiler nabız gibi atar
  useEffect(() => {
    hl.value = Array.from({ length: 15 }, (_, k) => highlight.has(`${Math.floor(k / 3)}:${k % 3}`));
    pulse.value = highlight.size > 0
      ? withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 })), -1)
      : withTiming(0, { duration: 150 });
  }, [highlight, hl, pulse]);

  // Dönüş bitince her makarada sadece görünen 3 hücre kalır
  const settle = useCallback((next: number[], onDone: () => void) => {
    strips.set(REELS.map((strip, i) => windowAt(strip, next[i])));
    onDone();
  }, [strips]);

  useImperativeHandle(ref, () => ({
    spin: (next, fast, onDone, onReelStop) => {
      const k = fast ? 0.6 : 1;
      const paths = REELS.map((strip, i) => path(strip, stops[i], next[i]));
      strips.value = paths;
      setStops(next);
      paths.forEach((p, i) => {
        const last = i === SLOT.reels - 1;
        offsets[i].value = -(p.length - SLOT.rows) * rowH;
        offsets[i].value = withTiming(0, {
          duration: k * (FIRST_STOP_MS + STOP_GAP_MS * i),
          easing: Easing.out(Easing.back(0.6)),
        }, (finished) => {
          if (finished && onReelStop) scheduleOnRN(onReelStop, i);
          if (finished && last) scheduleOnRN(settle, next, onDone);
        });
      });
    },
  }), [stops, rowH, offsets, settle, strips]);

  const picture = useDerivedValue(() => {
    const imgs = images;
    const list = strips.value;
    const wins = hl.value;
    const beat = pulse.value;
    const offs = [o0.value, o1.value, o2.value, o3.value, o4.value];
    return createPicture((canvas) => {
      if (!imgs) return;
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      const dim = Skia.Paint();
      dim.setAlphaf(0.4);
      const glowPaint = Skia.Paint();
      glowPaint.setColor(Skia.Color('rgba(255,210,77,0.18)'));
      const ring = Skia.Paint();
      ring.setColor(Skia.Color('rgba(255,210,77,0.9)'));
      ring.setStyle(1);
      ring.setStrokeWidth(2);
      const anyWin = wins.some(Boolean);
      for (let r = 0; r < SLOT.reels; r++) {
        const x0 = r * (cell + GAP);
        const strip = list[r];
        const settled = strip.length === SLOT.rows;
        const off = offs[r];
        canvas.save();
        canvas.clipRect(Skia.XYWHRect(x0, 0, cell, height), ClipOp.Intersect, true);
        const first = Math.max(0, Math.floor(-off / rowH) - 1);
        const last = Math.min(strip.length - 1, Math.ceil((height - off) / rowH));
        for (let j = first; j <= last; j++) {
          const y = off + j * rowH;
          // Şeridin üstteki son hücreleri (durma penceresi) ve ilk görünen pencere keskin; aradaki hızlı kısım bulanık
          const blurred = !settled && j >= SHARP_TAIL && j < strip.length - SLOT.rows;
          const img = blurred ? imgs.blur[strip[j]] : imgs.sharp[strip[j]];
          const win = settled && wins[r * 3 + j];
          const size = cell * (win ? 0.92 * (1 + 0.08 * beat) : 0.9);
          if (win) {
            const box = Skia.RRectXY(Skia.XYWHRect(x0 + 2, y + 2, cell - 4, rowH - 4), 10, 10);
            canvas.drawRRect(box, glowPaint);
            ring.setAlphaf(0.5 + 0.5 * beat);
            canvas.drawRRect(box, ring);
          }
          canvas.drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()),
            Skia.XYWHRect(x0 + (cell - size) / 2, y + (rowH - size) / 2, size, size), settled && anyWin && !win ? dim : paint);
        }
        canvas.restore();
      }
    });
  }, [images, cell, rowH, height]);

  return (
    <View style={[styles.frame, { padding: PAD }]}>
      <View style={[styles.window, { height }]}>
        {REELS.map((_, i) => <View key={i} style={[styles.reel, { width: cell, height }]} />)}
        <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, { width: innerWidth, height }]}>
          <Picture picture={picture} />
        </Canvas>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.vignette]} />
        {lines.length > 0 ? <Paylines lines={lines} cell={cell} rowH={rowH} pulse={pulse} /> : null}
      </View>
    </View>
  );
}));

/** Kazanan çizgiler: hücre merkezlerinden geçen parlayan kırık çizgiler */
function Paylines({ lines, cell, rowH, pulse }: { lines: readonly number[]; cell: number; rowH: number; pulse: SharedValue<number> }) {
  const width = cell * SLOT.reels + GAP * (SLOT.reels - 1);
  const height = rowH * SLOT.rows;
  const paths = useMemo(() => lines.map((l) => {
    const p = Skia.PathBuilder.Make();
    LINES[l].forEach((row, reel) => {
      const x = reel * (cell + GAP) + cell / 2, y = row * rowH + rowH / 2;
      if (reel === 0) p.moveTo(x - cell * 0.42, y).lineTo(x, y);
      else p.lineTo(x, y);
      if (reel === SLOT.reels - 1) p.lineTo(x + cell * 0.42, y);
    });
    return { line: l, path: p.detach() };
  }), [lines, cell, rowH]);
  const opacity = useDerivedValue(() => 0.55 + 0.45 * pulse.value);
  return (
    <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
      {paths.map(({ line, path: p }) => (
        <Path key={`g${line}`} path={p} color={LINE_COLORS[line]} style="stroke" strokeWidth={9} strokeJoin="round" strokeCap="round" opacity={opacity}>
          <BlurMask blur={6} style="normal" />
        </Path>
      ))}
      {paths.map(({ line, path: p }) => (
        <Path key={`l${line}`} path={p} color={LINE_COLORS[line]} style="stroke" strokeWidth={3.5} strokeJoin="round" strokeCap="round" opacity={opacity} />
      ))}
    </Canvas>
  );
}

const GAP = 4;
const PAD = 6;
const ROW_RATIO = 1.2;
const styles = StyleSheet.create({
  frame: {
    borderRadius: 22, borderWidth: 3, borderColor: '#F5C451',
    experimental_backgroundImage: 'linear-gradient(180deg, #3A2A0A 0%, #1A1206 50%, #3A2A0A 100%)',
    boxShadow: '0px 0px 30px rgba(255,200,61,0.45), inset 0px 0px 10px rgba(255,220,120,0.5)',
  },
  window: { flexDirection: 'row', gap: GAP, borderRadius: 14, overflow: 'hidden', backgroundColor: '#070D20' },
  reel: {
    borderRadius: 10,
    experimental_backgroundImage: 'linear-gradient(180deg, #0B1530 0%, #1B2E62 50%, #0B1530 100%)',
  },
  vignette: {
    experimental_backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.6) 100%)',
  },
});
