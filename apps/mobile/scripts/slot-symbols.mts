// Slot sembolleri ("Stadyum" teması): vektör çizimler → assets/slot/*.svg ve uygulamanın kullandığı PNG'ler (@1x/2x/3x).
// Tasarım dili: koyu makara zemininde parlak, kalın koyu konturlu, hafif gradyanlı düz çizimler. Marka/kulüp işareti yok.
// Sarı ve kırmızı kart renk körlüğünde de ayırt edilsin diye farklı yöne eğik ve farklı işaretli.
// Her sembolün arkasında değerine göre renkli ışık halesi var; makara dönerken kullanılan dikey hareket bulanıklığı
// uygulanmış kopyalar (*-blur.png) Core Image ile üretilir.
// Çalıştırma (apps/mobile içinde, macOS): npm run slot-symbols
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INK = '#16202E'; // kontur
const W = 6; // kontur kalınlığı

const svg = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs>${defs}</defs>${body}</svg>\n`;
const lin = (id: string, stops: [number, string][], x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rad = (id: string, stops: [number, string][], cx = 0.38, cy = 0.32) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="0.75">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const GOLD: [number, string][] = [[0, '#FFF1B8'], [0.35, '#FFD24D'], [0.75, '#E09A1A'], [1, '#B8740A']];
const star = (cx: number, cy: number, r: number, inner = 0.45) =>
  `M${Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join('L')}Z`;
const pentagon = (cx: number, cy: number, r: number, rot = -90) =>
  `M${Array.from({ length: 5 }, (_, i) => {
    const a = ((rot + i * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join('L')}Z`;

export const SYMBOLS: Record<string, string> = {
  // Joker: mor rozet üzerinde altın kupa (bedava dönüş topundan ayırt edilsin)
  wild: svg(lin('g', GOLD, 1, 0.3) + rad('badge', [[0, '#9B6BFF'], [0.7, '#5B2BC9'], [1, '#3A1890']], 0.5, 0.35),
    `<circle cx="128" cy="128" r="120" fill="url(#badge)" stroke="${INK}" stroke-width="${W}"/>
     <circle cx="128" cy="128" r="106" fill="none" stroke="#FFD24D" stroke-width="4" stroke-dasharray="6 10" opacity="0.8"/>
     <path d="M76 66 C34 64 30 126 88 134" fill="none" stroke="${INK}" stroke-width="${W + 16}" stroke-linecap="round"/>
     <path d="M180 66 C222 64 226 126 168 134" fill="none" stroke="${INK}" stroke-width="${W + 16}" stroke-linecap="round"/>
     <path d="M76 66 C34 64 30 126 88 134" fill="none" stroke="url(#g)" stroke-width="16" stroke-linecap="round"/>
     <path d="M180 66 C222 64 226 126 168 134" fill="none" stroke="url(#g)" stroke-width="16" stroke-linecap="round"/>
     <path d="M62 44 H194 V92 C194 140 164 166 128 166 C92 166 62 140 62 92 Z" fill="url(#g)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <path d="M80 56 H96 V96 C96 120 104 136 116 146 C92 140 80 120 80 96 Z" fill="#FFF6D0" opacity="0.7"/>
     <path d="${star(128, 100, 30)}" fill="#FFFFFF" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
     <path d="M114 164 H142 L148 192 H108 Z" fill="url(#g)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <path d="M80 192 H176 L186 222 H70 Z" fill="url(#g)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <rect x="96" y="200" width="64" height="12" rx="3" fill="#8A5A08"/>`),

  // Bedava dönüş: altın top, ışınlarla
  scatter: svg(rad('g', GOLD, 0.36, 0.3) + rad('glow', [[0, 'rgba(255,230,140,0.8)'], [1, 'rgba(255,200,60,0)']], 0.5, 0.5),
    `<circle cx="128" cy="128" r="124" fill="url(#glow)"/>
     ${Array.from({ length: 12 }, (_, i) => {
       const a = (i * 30 * Math.PI) / 180, b = a + 0.12, c = a - 0.12;
       const p = (r: number, t: number) => `${(128 + r * Math.cos(t)).toFixed(1)} ${(128 + r * Math.sin(t)).toFixed(1)}`;
       return `<path d="M${p(92, c)}L${p(124, a)}L${p(92, b)}Z" fill="#FFE27A"/>`;
     }).join('')}
     <circle cx="128" cy="128" r="84" fill="url(#g)" stroke="${INK}" stroke-width="${W}"/>
     <path d="${pentagon(128, 128, 30)}" fill="#7A4A00"/>
     ${[0, 1, 2, 3, 4].map((i) => {
       const a = ((-90 + i * 72) * Math.PI) / 180;
       const x1 = 128 + 30 * Math.cos(a), y1 = 128 + 30 * Math.sin(a), x2 = 128 + 62 * Math.cos(a), y2 = 128 + 62 * Math.sin(a);
       return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#7A4A00" stroke-width="7" stroke-linecap="round"/>
         <path d="${pentagon(128 + 80 * Math.cos(a), 128 + 80 * Math.sin(a), 20, -90 + i * 72 + 180)}" fill="#7A4A00"/>`;
     }).join('')}
     <circle cx="128" cy="128" r="84" fill="none" stroke="${INK}" stroke-width="${W}"/>
     <ellipse cx="100" cy="92" rx="22" ry="12" fill="#FFFBE8" opacity="0.75" transform="rotate(-30 100 92)"/>`),

  // Penaltı bonusu: gümüş düdük, kırmızı ip
  bonus: svg(lin('g', [[0, '#FFFFFF'], [0.45, '#D6DEE6'], [1, '#8C98A6']]) ,
    `<path d="M150 78 C150 40 196 30 214 52 C230 72 214 98 190 96" fill="none" stroke="#C81D32" stroke-width="10" stroke-linecap="round"/>
     <path d="M30 104 H128 V150 H44 C36 150 30 144 30 136 Z" fill="url(#g)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <circle cx="150" cy="150" r="64" fill="url(#g)" stroke="${INK}" stroke-width="${W}"/>
     <path d="M96 110 H126 V126 H96 Z" fill="${INK}"/>
     <circle cx="150" cy="150" r="30" fill="#AEB8C4" stroke="${INK}" stroke-width="4"/>
     <circle cx="150" cy="150" r="10" fill="${INK}"/>
     <circle cx="168" cy="86" r="14" fill="url(#g)" stroke="${INK}" stroke-width="5"/>
     <ellipse cx="120" cy="114" rx="40" ry="6" fill="#FFFFFF" opacity="0.8"/>`),

  // Krampon (yan görünüş)
  boot: svg(lin('g', [[0, '#FF5A6E'], [1, '#B3122A']]) + lin('s', [[0, '#3A4556'], [1, '#121821']]),
    `<path d="M40 148 C38 104 50 74 70 62 L112 56 C122 86 146 102 178 108 L212 116 C236 122 246 142 240 162 L236 172 H50 C44 172 40 164 40 148 Z"
       fill="url(#g)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <path d="M58 92 C96 132 150 146 230 146" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
     <path d="M118 74 L132 66 M128 86 L144 78 M140 96 L156 90" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
     <path d="M44 170 H238 C238 178 232 186 222 186 H58 C50 186 44 180 44 170 Z" fill="url(#s)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     ${[72, 104, 168, 206].map((x) => `<path d="M${x - 8} 186 H${x + 8} L${x + 5} 204 H${x - 5} Z" fill="#C9D1D9" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`).join('')}
     <path d="M70 64 C64 78 62 96 66 112" fill="none" stroke="#FFB3BD" stroke-width="6" stroke-linecap="round" opacity="0.8"/>`),

  // Kaleci eldiveni
  gloves: svg(lin('g', [[0, '#B6F36A'], [1, '#4CA324']]),
    `<path d="M96 120 L96 58 C96 46 120 46 120 58 L120 112 L124 40 C124 28 148 28 148 40 L148 112 L154 48 C154 36 178 36 178 48 L176 118 L184 74 C186 62 208 64 206 78 L198 150
        C196 190 172 206 140 206 L120 206 C90 206 72 186 70 160 L62 124 C58 108 76 100 84 114 Z"
       fill="url(#g)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <path d="M80 160 C110 176 160 176 194 158" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>
     <rect x="84" y="196" width="104" height="38" rx="10" fill="#1B2A49" stroke="${INK}" stroke-width="${W}"/>
     <rect x="100" y="208" width="72" height="12" rx="6" fill="#FFFFFF"/>
     <path d="M104 64 V104 M132 46 V100 M162 54 V104" stroke="#E8FFD0" stroke-width="6" stroke-linecap="round" opacity="0.7"/>`),

  // Forma, 10 numara
  jersey: svg(lin('g', [[0, '#3D7BFF'], [1, '#1846B8']]),
    `<path d="M84 40 L106 32 C114 50 142 50 150 32 L172 40 L226 74 L202 120 L180 108 V220 H76 V108 L54 120 L30 74 Z"
       fill="url(#g)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <path d="M106 32 C114 50 142 50 150 32 L140 30 C134 42 122 42 116 30 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
     <path d="M30 74 L54 120 M226 74 L202 120" stroke="#FFFFFF" stroke-width="10"/>
     <path d="M30 74 L54 120 L76 108 M226 74 L202 120 L180 108" fill="none" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <text x="128" y="182" text-anchor="middle" font-family="Helvetica Neue, Arial" font-weight="900" font-size="78" fill="#FFFFFF" stroke="${INK}" stroke-width="4">10</text>`),

  // Korner bayrağı
  flag: svg(lin('f', [[0, '#FF6B3D'], [1, '#D7263D']], 1, 0),
    `<ellipse cx="128" cy="214" rx="104" ry="26" fill="#2FA05A" stroke="${INK}" stroke-width="${W}"/>
     <path d="M40 222 A88 22 0 0 1 128 200" fill="none" stroke="#FFFFFF" stroke-width="6"/>
     <rect x="94" y="34" width="14" height="182" rx="6" fill="#F4F6F8" stroke="${INK}" stroke-width="${W}"/>
     <path d="M108 40 C140 28 168 52 216 40 L206 86 L216 128 C168 140 140 116 108 128 Z" fill="url(#f)" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
     <path d="M108 84 C140 72 170 96 208 86" fill="none" stroke="#FFD23F" stroke-width="12"/>
     <circle cx="101" cy="30" r="10" fill="#FFD23F" stroke="${INK}" stroke-width="5"/>`),

  // Kronometre
  watch: svg(lin('g', [[0, '#FFFFFF'], [1, '#C9D1D9']]) + lin('r', [[0, '#5B6B80'], [1, '#2A3442']]),
    `<rect x="112" y="18" width="32" height="26" rx="6" fill="url(#r)" stroke="${INK}" stroke-width="${W}"/>
     <rect x="186" y="58" width="22" height="20" rx="5" fill="url(#r)" stroke="${INK}" stroke-width="5" transform="rotate(40 197 68)"/>
     <circle cx="128" cy="140" r="92" fill="url(#r)" stroke="${INK}" stroke-width="${W}"/>
     <circle cx="128" cy="140" r="74" fill="url(#g)" stroke="${INK}" stroke-width="4"/>
     ${Array.from({ length: 12 }, (_, i) => {
       const a = (i * 30 * Math.PI) / 180, l = i % 3 === 0 ? 16 : 9;
       return `<line x1="${(128 + 66 * Math.sin(a)).toFixed(1)}" y1="${(140 - 66 * Math.cos(a)).toFixed(1)}" x2="${(128 + (66 - l) * Math.sin(a)).toFixed(1)}" y2="${(140 - (66 - l) * Math.cos(a)).toFixed(1)}" stroke="${INK}" stroke-width="${i % 3 === 0 ? 6 : 4}" stroke-linecap="round"/>`;
     }).join('')}
     <path d="M128 140 L128 84" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
     <path d="M128 140 L170 118" stroke="#D7263D" stroke-width="7" stroke-linecap="round"/>
     <circle cx="128" cy="140" r="9" fill="#D7263D" stroke="${INK}" stroke-width="4"/>`),

  // Sarı kart: sola eğik, ünlem işaretli
  yellow: svg(lin('g', [[0, '#FFF27A'], [1, '#F2B705']], 1, 1),
    `<g transform="rotate(-14 128 128)">
       <rect x="70" y="34" width="116" height="168" rx="14" fill="url(#g)" stroke="${INK}" stroke-width="${W}"/>
       <path d="M86 50 H118 L94 120 H86 Z" fill="#FFFBD1" opacity="0.7"/>
       <rect x="119" y="78" width="18" height="66" rx="9" fill="${INK}" opacity="0.85"/>
       <circle cx="128" cy="166" r="10" fill="${INK}" opacity="0.85"/>
     </g>`),

  // Kırmızı kart: sağa eğik, çarpı işaretli
  red: svg(lin('g', [[0, '#FF6B7A'], [1, '#C1121F']], 1, 1),
    `<g transform="rotate(14 128 128)">
       <rect x="70" y="34" width="116" height="168" rx="14" fill="url(#g)" stroke="${INK}" stroke-width="${W}"/>
       <path d="M86 50 H118 L94 120 H86 Z" fill="#FFD6DB" opacity="0.6"/>
       <path d="M104 94 L152 142 M152 94 L104 142" stroke="${INK}" stroke-width="16" stroke-linecap="round" opacity="0.85"/>
     </g>`),

  // Taraftar atkısı: çapraz, şeritli, saçaklı
  scarf: svg('',
    `<g transform="rotate(-35 128 128)">
       ${Array.from({ length: 7 }, (_, i) => `<rect x="${30 + i * 28}" y="92" width="28" height="72" fill="${i % 2 ? '#FFFFFF' : '#0E7C55'}"/>`).join('')}
       <rect x="30" y="92" width="196" height="72" rx="8" fill="none" stroke="${INK}" stroke-width="${W}"/>
       ${[0, 1].map((e) => Array.from({ length: 6 }, (_, i) => {
         const x = e ? 226 : 30, y = 100 + i * 11.2;
         return `<line x1="${x}" y1="${y}" x2="${x + (e ? 18 : -18)}" y2="${y}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
       }).join('')).join('')}
     </g>`),
};

/** Hale renkleri: değerli semboller sıcak ve parlak, düşükler soluk */
const HALO: Record<string, [string, number]> = {
  wild: ['#B26BFF', 0.75], bonus: ['#3DD9FF', 0.6], boot: ['#FF5E57', 0.55], gloves: ['#7CFF6B', 0.5],
  jersey: ['#4C8DFF', 0.5], flag: ['#FF9F43', 0.45], watch: ['#C9D6EA', 0.4], yellow: ['#FFE066', 0.35],
  red: ['#FF6B7A', 0.35], scarf: ['#2BFFA8', 0.3],
};
const withHalo = (name: string, content: string) => {
  const halo = HALO[name];
  if (!halo) return content;
  const [color, alpha] = halo;
  const def = `<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${color}" stop-opacity="${alpha}"/><stop offset="0.55" stop-color="${color}" stop-opacity="${alpha * 0.45}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  return content.replace('<defs>', `<defs>${def}`).replace('</defs>', '</defs><circle cx="128" cy="128" r="128" fill="url(#halo)"/>');
};

const root = new URL('../', import.meta.url);
const path = (p: string) => fileURLToPath(new URL(p, root));
mkdirSync(path('assets/slot'), { recursive: true });
const renders: string[] = [];
for (const [name, content] of Object.entries(SYMBOLS)) {
  writeFileSync(path(`assets/slot/${name}.svg`), withHalo(name, content));
  for (const [suffix, size] of [['', 64], ['@2x', 128], ['@3x', 192]] as const) {
    renders.push(path(`assets/slot/${name}.svg`), path(`assets/slot/${name}${suffix}.png`), String(size));
  }
}
execFileSync('swift', [path('scripts/render-svg.swift'), ...renders], { stdio: 'ignore' });
// Hareket bulanıklığı: piksel boyutuna göre yarıçap
const blurs: string[] = [];
for (const name of Object.keys(SYMBOLS)) {
  for (const [suffix, radius] of [['', 3], ['@2x', 7], ['@3x', 10]] as const) {
    blurs.push(path(`assets/slot/${name}${suffix}.png`), path(`assets/slot/${name}-blur${suffix}.png`), String(radius));
  }
}
execFileSync('swift', [path('scripts/motion-blur.swift'), ...blurs], { stdio: 'ignore' });
console.log(`${Object.keys(SYMBOLS).length} sembol → assets/slot`);
