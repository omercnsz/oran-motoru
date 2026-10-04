// Maçlar tarafında ortak küçük parçalar: bölüm başlığı, canlı rozeti, maç durumu.
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Arena, FontFamily, glow } from '@/constants/arena';

/** Büyük harfli bölüm başlığı ve yanında ince çizgi */
export function SectionHead({ title, color = Arena.textDim }: { title: string; color?: string }) {
  return (
    <View style={styles.head}>
      <Text style={[styles.headText, { color }]}>{title}</Text>
      <View style={styles.line} />
    </View>
  );
}

/** Yanıp sönen kırmızı nokta ve yazı (ör. dakika) */
export function LivePill({ label }: { label: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(0.25, { duration: 650 }), withTiming(1, { duration: 650 })), -1);
  }, [pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.live}>
      <Animated.View style={[styles.dot, dot]} />
      <Text style={styles.liveText}>{label}</Text>
    </View>
  );
}

/** Saat ya da durum rozeti (maç öncesi, bitti) */
export function TimePill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <View style={[styles.time, muted && styles.timeMuted]}>
      <Text style={[styles.timeText, muted && { color: Arena.textDim }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  headText: { fontFamily: FontFamily.display, fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  line: { flex: 1, height: 1, backgroundColor: Arena.glassBorder },
  live: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(255,77,109,0.14)', borderWidth: 1, borderColor: 'rgba(255,77,109,0.5)',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Arena.danger, boxShadow: glow(Arena.danger, 8, 0.9) },
  liveText: { color: '#FF8FA3', fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  time: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(61,217,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(61,217,255,0.35)',
  },
  timeMuted: { backgroundColor: Arena.glass, borderColor: Arena.glassBorder },
  timeText: { color: Arena.cyan, fontFamily: FontFamily.ui, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
});
