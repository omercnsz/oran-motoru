// Oyunlar sekmesindeki küçük oyun görselleri (kod ile çizilir, resim dosyası yok).
import { BlurMask, Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { View } from 'react-native';

import { PlayingCard } from '@/components/playing-card';
import { RouletteWheel } from '@/components/roulette-wheel';
import { SYMBOL_IMAGES } from '@/components/slot-reels';
import { Arena, glow } from '@/constants/arena';

export type GameKey = 'crash' | 'roulette' | 'slot' | 'mines' | 'plinko' | 'blackjack';

/** Her oyunun vurgu rengi */
export const GAME_COLORS: Record<GameKey, string> = {
  crash: Arena.cyan, roulette: Arena.gold, slot: Arena.violet, mines: Arena.neon, plinko: '#FF5E9C', blackjack: '#2EDB8A',
};

export function GameArt({ game, size = 84 }: { game: GameKey; size?: number }) {
  if (game === 'crash') return <CrashArt size={size} />;
  if (game === 'roulette') return <RouletteWheel size={size} />;
  if (game === 'slot') return <Image source={SYMBOL_IMAGES.wild} style={{ width: size * 0.9, height: size * 0.9 }} contentFit="contain" />;
  if (game === 'mines') return <MinesArt size={size} />;
  if (game === 'plinko') return <PlinkoArt size={size} />;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 4, top: 8, transform: [{ rotate: '-12deg' }, { scale: 0.78 }] }}>
        <PlayingCard card={0} />
      </View>
      <View style={{ position: 'absolute', left: 26, top: 4, transform: [{ rotate: '10deg' }, { scale: 0.78 }] }}>
        <PlayingCard card={25} />
      </View>
    </View>
  );
}

function CrashArt({ size }: { size: number }) {
  const curve = useMemo(() => {
    const p = Skia.PathBuilder.Make().moveTo(8, size - 10);
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      p.lineTo(8 + t * (size - 22), size - 10 - (Math.exp(t * 2.4) - 1) / (Math.exp(2.4) - 1) * (size - 26));
    }
    return p.detach();
  }, [size]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={curve} color={Arena.cyan} style="stroke" strokeWidth={9} opacity={0.4} strokeCap="round">
        <BlurMask blur={6} style="normal" />
      </Path>
      <Path path={curve} color={Arena.cyan} style="stroke" strokeWidth={3.5} strokeCap="round" strokeJoin="round" />
      <Circle cx={size - 14} cy={16} r={9} color={Arena.cyan} opacity={0.6}>
        <BlurMask blur={6} style="normal" />
      </Circle>
      <Circle cx={size - 14} cy={16} r={4.5} color="#ffffff" />
    </Canvas>
  );
}

function PlinkoArt({ size }: { size: number }) {
  const pegs = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    const rows = 5, s = size / (rows + 2.2);
    for (let r = 0; r < rows; r++) for (let j = 0; j < r + 2; j++) p.addCircle(size / 2 + (j - (r + 1) / 2) * s, 18 + r * s * 0.95, 2.4);
    return p.detach();
  }, [size]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={pegs} color="#E6F2FF" />
      <Circle cx={size / 2 + 6} cy={size * 0.5} r={11} color={Arena.gold} opacity={0.55}>
        <BlurMask blur={6} style="normal" />
      </Circle>
      <Circle cx={size / 2 + 6} cy={size * 0.5} r={5.5} color={Arena.gold} />
    </Canvas>
  );
}

function MinesArt({ size }: { size: number }) {
  const gem = (s: number, x: number, y: number, key: number) => (
    <View key={key} style={{
      position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: s * 0.16, transform: [{ rotate: '45deg' }],
      experimental_backgroundImage: `linear-gradient(135deg, #B8FFE4 0%, ${Arena.neon} 45%, ${Arena.cyan} 100%)`,
      boxShadow: glow(Arena.neon, 12, 0.7),
    }} />
  );
  return (
    <View style={{ width: size, height: size }}>
      {[gem(size * 0.36, size * 0.32, size * 0.12, 0), gem(size * 0.24, size * 0.1, size * 0.52, 1), gem(size * 0.28, size * 0.58, size * 0.5, 2)]}
    </View>
  );
}
