// Takım arması yerine rozet: takımın kendi renklerinde daire ve kısaltması. Kulüp logoları kullanılmaz (marka hakkı).
// ESPN rengi yoksa ya da çok koyuysa: ikinci renk, o da yoksa adından üretilen bir renk.
import type { TeamStyle } from '@oran/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/constants/arena';

const luminance = (hex: string) => {
  const n = parseInt(hex, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

/** Addan kararlı bir renk (HSL → altıgen) */
function hashColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360, s = 0.62, l = 0.46;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `${f(0)}${f(8)}${f(4)}`;
}

/** Kısaltma: ESPN'inki, yoksa addan (çok kelimeliyse baş harfler, değilse ilk üç harf) */
export function teamAbbr(name: string, style?: TeamStyle) {
  if (style?.abbr) return style.abbr.slice(0, 4).toUpperCase();
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
  return (words[0] ?? name).slice(0, 3).toUpperCase();
}

/** Rozet renkleri: dolgu, kenar ve yazı */
export function teamColors(name: string, style?: TeamStyle) {
  const usable = (c?: string) => (c && luminance(c) > 0.012 && luminance(c) < 0.9 ? c : undefined);
  const fill = usable(style?.color) ?? usable(style?.alt) ?? hashColor(name);
  const ring = style?.alt && style.alt !== fill ? style.alt : 'ffffff';
  return { fill: `#${fill}`, ring: `#${ring}`, text: luminance(fill) > 0.45 ? '#0A0F1E' : '#ffffff' };
}

export function TeamBadge({ name, style, size = 30 }: { name: string; style?: TeamStyle; size?: number }) {
  const c = teamColors(name, style);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.badge, {
      width: size, height: size, borderRadius: size / 2, borderColor: `${c.ring}cc`,
      experimental_backgroundImage: `linear-gradient(145deg, ${c.fill} 0%, ${c.fill} 55%, rgba(0,0,0,0.35) 140%)`,
      backgroundColor: c.fill,
    }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
        style={[styles.text, { color: c.text, fontSize: size * 0.3, maxWidth: size * 0.82 }]}>
        {teamAbbr(name, style)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 2px 6px rgba(0,0,0,0.45)' },
  text: { fontFamily: FontFamily.display, fontWeight: '800', letterSpacing: -0.3 },
});
