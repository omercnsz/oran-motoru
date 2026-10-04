// Oyunlar bölümünün ("arena") görünümü: telefon açık modda olsa da hep koyu. Gece stadyumu: lacivert zemin, neon yeşil
// vurgu (marka yeşilinin parlak hâli), altın kazanç rengi, cam paneller.
export const Arena = {
  bg: '#060A16',
  bgTop: '#0B1430',
  bgBottom: '#050812',
  glass: 'rgba(255,255,255,0.055)',
  glassStrong: 'rgba(255,255,255,0.09)',
  glassBorder: 'rgba(255,255,255,0.10)',
  text: '#EEF3FF',
  textDim: '#93A3C4',
  textFaint: '#5D6B8A',
  neon: '#2BFFA8',
  neonDeep: '#10C47F',
  cyan: '#3DD9FF',
  gold: '#FFC83D',
  goldDeep: '#FF9A1F',
  danger: '#FF4D6D',
  dangerDeep: '#C9184A',
  violet: '#B26BFF',
  onNeon: '#03140D',
  onGold: '#2A1600',
} as const;

export const FontFamily = {
  /** Başlıklar ve büyük rakamlar */
  display: 'Unbounded',
  /** Metin */
  ui: 'Inter',
} as const;

/** Neon parıltı (boxShadow) */
export const glow = (color: string, radius = 22, alpha = 0.55) => {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `0px 0px ${radius}px ${color}${a}`;
};

/** Oyun fişleri: değerine göre renk */
export const CHIP_COLORS: Record<number, { face: string; edge: string; text: string }> = {
  10: { face: '#2D6CDF', edge: '#1B3F86', text: '#FFFFFF' },
  50: { face: '#E2364F', edge: '#8E1A2C', text: '#FFFFFF' },
  100: { face: '#13A86A', edge: '#0A5E3B', text: '#FFFFFF' },
  500: { face: '#1C1C24', edge: '#C9A227', text: '#FFD45C' },
};
