// Slot makaraları. Dönerken gerçek şerit kayar (ekranda görünen, şeridin kendisidir) ve makaralar içerikten
// bağımsız, sabit sürelerle soldan sağa durur: iki top gelince son makarayı yavaşlatıp heyecan yaratma yok.
import { REELS, SLOT, type SlotSymbol } from '@oran/games-math';
import { Image } from 'expo-image';
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
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

/** Makaranın dönüş süresi: ilk makara, sonra her biri bu kadar sonra (içerikten bağımsız) */
const FIRST_STOP_MS = 900;
const STOP_GAP_MS = 260;
export const spinDuration = (fast: boolean) => (fast ? 0.6 : 1) * (FIRST_STOP_MS + STOP_GAP_MS * (SLOT.reels - 1));

export interface ReelsHandle {
  /** Makaraları yeni durma noktalarına çevirir; her makara durunca onReelStop, hepsi bitince onDone */
  spin: (stops: number[], fast: boolean, onDone: () => void, onReelStop?: (reel: number) => void) => void;
}

interface ReelState { cells: SlotSymbol[]; key: number }

/** Şeritte from'dan to'ya aşağı doğru kayarken görünen hücreler (üstten alta): to, to+1, … from+2 ve bir tam tur */
function path(strip: readonly SlotSymbol[], from: number, to: number): SlotSymbol[] {
  const n = strip.length;
  const distance = ((from - to + n) % n) + n; // en az bir tam tur
  return Array.from({ length: distance + SLOT.rows }, (_, j) => strip[(to + j) % n]);
}

export const SlotReels = memo(forwardRef<ReelsHandle, {
  width: number; initialStops: number[]; highlight: ReadonlySet<string>;
}>(function SlotReels({ width, initialStops, highlight }, ref) {
  const cell = Math.floor((width - 4 * GAP) / SLOT.reels);
  const [stops, setStops] = useState(initialStops);
  const [reels, setReels] = useState<ReelState[]>(() =>
    REELS.map((strip, i) => ({ cells: [0, 1, 2].map((r) => strip[(initialStops[i] + r) % strip.length]), key: 0 })));
  const o0 = useSharedValue(0), o1 = useSharedValue(0), o2 = useSharedValue(0), o3 = useSharedValue(0), o4 = useSharedValue(0);
  const offsets = useMemo(() => [o0, o1, o2, o3, o4], [o0, o1, o2, o3, o4]);

  // Dönüş bitince her makarada sadece görünen 3 hücre kalsın (yüzlerce resmi bellekte tutmayalım)
  const settle = useCallback((next: number[], onDone: () => void) => {
    setReels(REELS.map((strip, i) => ({ cells: [0, 1, 2].map((r) => strip[(next[i] + r) % strip.length]), key: 0 })));
    onDone();
  }, []);

  useImperativeHandle(ref, () => ({
    spin: (next, fast, onDone, onReelStop) => {
      const k = fast ? 0.6 : 1;
      setReels(REELS.map((strip, i) => ({ cells: path(strip, stops[i], next[i]), key: Date.now() + i })));
      setStops(next);
      REELS.forEach((strip, i) => {
        const rows = path(strip, stops[i], next[i]).length - SLOT.rows;
        offsets[i].value = -rows * cell;
        const last = i === SLOT.reels - 1;
        offsets[i].value = withTiming(0, {
          duration: k * (FIRST_STOP_MS + STOP_GAP_MS * i),
          easing: Easing.out(Easing.back(0.6)),
        }, (finished) => {
          if (finished && onReelStop) scheduleOnRN(onReelStop, i);
          if (finished && last) scheduleOnRN(settle, next, onDone);
        });
      });
    },
  }), [stops, cell, offsets, settle]);

  return (
    <View style={[styles.frame, { height: cell * SLOT.rows + 2 * GAP }]}>
      {reels.map((reel, i) => (
        <View key={i} style={[styles.reel, { width: cell, height: cell * SLOT.rows }]}>
          <ReelStrip reel={reel} cell={cell} offset={offsets[i]} index={i} highlight={highlight} />
        </View>
      ))}
    </View>
  );
}));

function ReelStrip({ reel, cell, offset, index, highlight }: {
  reel: ReelState; cell: number; offset: SharedValue<number>; index: number; highlight: ReadonlySet<string>;
}) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const settled = reel.cells.length === SLOT.rows;
  return (
    <Animated.View style={style}>
      {reel.cells.map((symbol, row) => (
        <View key={`${reel.key}-${row}`} style={[styles.cell, { width: cell, height: cell },
          settled && highlight.has(`${index}:${row}`) && styles.win]}>
          <Image source={SYMBOL_IMAGES[symbol]} style={{ width: cell * 0.86, height: cell * 0.86 }} contentFit="contain" />
        </View>
      ))}
    </Animated.View>
  );
}

const GAP = 4;
const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row', gap: GAP, padding: GAP, borderRadius: 18, backgroundColor: '#0A1226',
    borderWidth: 3, borderColor: '#E8B93C', overflow: 'hidden',
    boxShadow: '0px 0px 28px rgba(255,200,61,0.45), inset 0px 0px 18px rgba(0,0,0,0.7)',
  },
  reel: {
    overflow: 'hidden', borderRadius: 10, backgroundColor: '#15234A',
    experimental_backgroundImage: 'linear-gradient(180deg, #0C1530 0%, #1B2D5C 50%, #0C1530 100%)',
  },
  cell: { alignItems: 'center', justifyContent: 'center' },
  win: {
    backgroundColor: 'rgba(255, 210, 77, 0.22)', borderRadius: 10, borderWidth: 2, borderColor: '#FFD24D',
    boxShadow: '0px 0px 14px rgba(255,200,61,0.8)',
  },
});
