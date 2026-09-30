// Uygulama ikonu ve açılış ekranı görsellerini üretir. Tasarım: futbol topu desenli bir madeni para,
// kumbaranın yarığına düşüyor ("bahis parası kumbaraya"). Tek kaynak bu dosyadaki ölçüler ve renkler.
// Çıktılar: assets/brand/*.svg, assets/oran.icon (iOS 26 Icon Composer), assets/images/*.png
// PNG'ler macOS'un kendi SVG işleyicisiyle çizilir (scripts/render-svg.swift); ek araç gerekmez.
// Çalıştırma (apps/mobile içinde, macOS): npm run icons
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COLORS = {
  top: '#12966A', // arka plan geçişinin üstü
  bottom: '#0A5C3F', // altı
  base: '#0E7C55', // tek renk gereken yerler (Android arka planı, açılış ekranı, iOS otomatik geçiş)
  coin: '#FFFFFF',
  marks: '#0B6644', // topun beşgeni ve dikişleri
  slot: '#04311F', // kumbaranın yarığı
};

// 1024 birimlik tuval
const COIN = { cx: 512, cy: 500, r: 270, cutY: 738 }; // para, yarığın ortasında kesilir
const SLOT = { x: 222, y: 714, w: 580, h: 48 };
// Top deseni: ortada beşgen, köşelerinden çıkan dikişlerin ucunda kenarda kesilen beş beşgen
const BALL = { r: 86, outer: 86, stroke: 20 };

const f = (n: number) => Number(n.toFixed(2));
type Point = [number, number];
const pathOf = (pts: Point[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;

/** Paranın görünen kısmı (üstü yuvarlak, altı düz) çokgen olarak: beşgenleri kırpmak için */
function coinPolygon(cutY = COIN.cutY): Point[] {
  const dy = cutY - COIN.cy;
  const start = Math.atan2(dy, -Math.sqrt(COIN.r ** 2 - dy ** 2));
  const end = Math.atan2(dy, Math.sqrt(COIN.r ** 2 - dy ** 2)) + 2 * Math.PI;
  return Array.from({ length: 181 }, (_, i) => {
    const a = start + ((end - start) * i) / 180;
    return [COIN.cx + COIN.r * Math.cos(a), COIN.cy + COIN.r * Math.sin(a)];
  });
}

/** Sutherland–Hodgman: dışbükey bir çokgenle kırpma */
function clip(subject: Point[], clipper: Point[]): Point[] {
  const area = clipper.reduce((s, [x1, y1], i) => { const [x2, y2] = clipper[(i + 1) % clipper.length]; return s + x1 * y2 - x2 * y1; }, 0);
  const inside = ([px, py]: Point, [ax, ay]: Point, [bx, by]: Point) => Math.sign(area) * ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) >= 0;
  const cross = ([px, py]: Point, [qx, qy]: Point, [ax, ay]: Point, [bx, by]: Point): Point => {
    const d = (px - qx) * (ay - by) - (py - qy) * (ax - bx);
    const t = ((px - ax) * (ay - by) - (py - ay) * (ax - bx)) / d;
    return [px + t * (qx - px), py + t * (qy - py)];
  };
  let out = subject;
  for (let i = 0; i < clipper.length && out.length > 0; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length];
    const input = out;
    out = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length];
      if (inside(q, a, b)) { if (!inside(p, a, b)) out.push(cross(p, q, a, b)); out.push(q); }
      else if (inside(p, a, b)) out.push(cross(p, q, a, b));
    });
  }
  return out;
}

const pentagon = (cx: number, cy: number, r: number, rotation: number): Point[] =>
  Array.from({ length: 5 }, (_, i) => { const a = rotation + (2 * Math.PI * i) / 5; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

const UP = -Math.PI / 2;
const directions = Array.from({ length: 5 }, (_, i) => { const a = UP + (2 * Math.PI * i) / 5; return { a, cos: Math.cos(a), sin: Math.sin(a) }; });

/** Topun beşgenleri: ortadaki ve paranın kenarında kesilen beş tane (bir köşeleri ortaya bakar) */
function patches(coinShape: Point[]): Point[][] {
  const outer = directions.map(({ a, cos, sin }) =>
    clip(pentagon(COIN.cx + COIN.r * cos, COIN.cy + COIN.r * sin, BALL.outer, a + Math.PI), coinShape));
  return [pentagon(COIN.cx, COIN.cy, BALL.r, UP), ...outer.filter((p) => p.length > 2)];
}

function ball(marks: string): string {
  const lines: string[] = [];
  for (const { cos, sin } of directions) {
    const from = BALL.r, to = COIN.r - BALL.outer;
    lines.push(`<line x1="${f(COIN.cx + from * cos)}" y1="${f(COIN.cy + from * sin)}" x2="${f(COIN.cx + to * cos)}" y2="${f(COIN.cy + to * sin)}"/>`);
  }
  return `<path d="${patches(coinPolygon()).map(pathOf).join('')}" fill="${marks}"/><g stroke="${marks}" stroke-width="${BALL.stroke}" stroke-linecap="round">${lines.join('')}</g>`;
}

const slotRect = (fill: string) =>
  `<rect x="${SLOT.x}" y="${SLOT.y}" width="${SLOT.w}" height="${SLOT.h}" rx="${SLOT.h / 2}" fill="${fill}"/>`;
const coin = (marks = COLORS.marks) => `<path d="${pathOf(coinPolygon())}" fill="${COLORS.coin}"/>${ball(marks)}`;
// Yarık önde: para içine giriyormuş gibi görünür
const symbol = () => coin() + slotRect(COLORS.slot);
const background = () =>
  `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.top}"/><stop offset="1" stop-color="${COLORS.bottom}"/></linearGradient></defs>` +
  '<rect width="1024" height="1024" fill="url(#bg)"/>';
/** Android uyarlanabilir ikonda içerik ortadaki güvenli daireye sığmalı */
const scaled = (s: number, body: string) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">${body}</g>`;
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>\n`;

function monochrome(): string {
  const shape = coinPolygon(SLOT.y - 18);
  return `<path d="${[shape, ...patches(shape)].map(pathOf).join('')}" fill="#000" fill-rule="evenodd"/>${slotRect('#000')}`;
}

const root = new URL('../', import.meta.url);
const path = (p: string) => fileURLToPath(new URL(p, root));

const brand: Record<string, string> = {
  'icon.svg': svg(background() + symbol()),
  'symbol.svg': svg(symbol()),
  'android-foreground.svg': svg(scaled(0.8, symbol())),
  'android-background.svg': svg(background()),
  // Android'in tek renkli (temalı) ikonu: sadece şekil. Beşgenler parada boşluk; para ile yarık arasında boşluk
  'android-monochrome.svg': svg(scaled(0.8, monochrome())),
};
mkdirSync(path('assets/brand'), { recursive: true });
for (const [name, content] of Object.entries(brand)) writeFileSync(path(`assets/brand/${name}`), content);

// iOS 26 ikonu (Icon Composer biçimi): renk geçişli zemin + iki cam katman (listede ilk olan önde: yarık)
const rgb = (hex: string) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5)).join(',');
rmSync(path('assets/oran.icon'), { recursive: true, force: true });
mkdirSync(path('assets/oran.icon/Assets'), { recursive: true });
writeFileSync(path('assets/oran.icon/Assets/coin.svg'), svg(coin()));
writeFileSync(path('assets/oran.icon/Assets/slot.svg'), svg(slotRect(COLORS.slot)));
writeFileSync(path('assets/oran.icon/icon.json'), `${JSON.stringify({
  fill: { 'automatic-gradient': `extended-srgb:${rgb(COLORS.base)},1.00000` },
  groups: [{
    layers: [
      { 'image-name': 'slot.svg', name: 'slot' },
      { 'image-name': 'coin.svg', name: 'coin' },
    ],
    shadow: { kind: 'neutral', opacity: 0.5 },
    // Saydamlık kapalı: açıkken koyu yarık cam altında soluk kalıyor
    translucency: { enabled: false, value: 0.5 },
  }],
  'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
}, null, 2)}\n`);

// PNG'ler: [kaynak, hedef, piksel]
const renders: [string, string, number][] = [
  ['assets/brand/icon.svg', 'assets/images/icon.png', 1024],
  ['assets/brand/icon.svg', 'assets/images/favicon.png', 48],
  ['assets/brand/symbol.svg', 'assets/images/splash-icon.png', 1024],
  ['assets/brand/android-foreground.svg', 'assets/images/android-icon-foreground.png', 1024],
  ['assets/brand/android-background.svg', 'assets/images/android-icon-background.png', 1024],
  ['assets/brand/android-monochrome.svg', 'assets/images/android-icon-monochrome.png', 1024],
];
execFileSync('swift', [path('scripts/render-svg.swift'), ...renders.flatMap(([src, out, size]) => [path(src), path(out), String(size)])], { stdio: 'inherit' });
console.log(`Arka plan rengi (app.json'daki açılış ekranı ve Android ikonu için): ${COLORS.base}`);
