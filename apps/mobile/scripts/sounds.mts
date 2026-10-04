// Oyun sesleri: hepsi kodla sentezlenir (lisans ya da indirme gerekmez). Çıktı assets/sounds: efektler WAV (16 bit mono),
// müzik M4A (macOS afconvert ile AAC). Çalıştırma: `npm run sounds -w @oran/mobile`.
// Rastgelelik tohumlu: her çalıştırmada aynı dosyalar üretilir.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SR = 44100;
const OUT = join(import.meta.dirname, '..', 'assets', 'sounds');

type Buf = Float32Array;
const buf = (sec: number): Buf => new Float32Array(Math.ceil(sec * SR));

let seed = 12345;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const noise = () => rnd() * 2 - 1;

const NOTE = (name: string) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name)!;
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1] as 'C'] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
};

/** src'yi target'a `at` saniyesinden itibaren ekler */
function mix(target: Buf, src: Buf, at = 0, gain = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < target.length; i++) if (o + i >= 0) target[o + i] += src[i] * gain;
}

/** Örnek örnek üretim: f(t) */
function render(sec: number, f: (t: number, i: number) => number): Buf {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) b[i] = f(i / SR, i);
  return b;
}

// Biquad (RBJ). cutoff sabit ya da zamana bağlı (her 32 örnekte yeniden hesaplanır).
type FilterKind = 'lowpass' | 'highpass' | 'bandpass';
function filter(src: Buf, kind: FilterKind, cutoff: number | ((t: number) => number), q = 0.707): Buf {
  const out = new Float32Array(src.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const coeffs = (fc: number) => {
    const w = (2 * Math.PI * Math.min(fc, SR * 0.45)) / SR;
    const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    if (kind === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
    else if (kind === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    a1 = (-2 * cos) / a0; a2 = (1 - alpha) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
  };
  for (let i = 0; i < src.length; i++) {
    if (i % 32 === 0) coeffs(typeof cutoff === 'number' ? cutoff : cutoff(i / SR));
    const x = src[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Basit Schroeder yankısı (4 tarak + 2 tüm geçiren); wet oranında karıştırır, kuyruk için tail saniye ekler */
function reverb(src: Buf, wet = 0.25, tail = 1.2, room = 0.82): Buf {
  const out = new Float32Array(src.length + Math.ceil(tail * SR));
  const dry = new Float32Array(out.length);
  dry.set(src);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, b: new Float32Array(d), i: 0, lp: 0 }));
  const alls = [225, 556].map((d) => ({ d, b: new Float32Array(d), i: 0 }));
  for (let n = 0; n < out.length; n++) {
    const x = dry[n] * 0.25;
    let s = 0;
    for (const c of combs) {
      const y = c.b[c.i];
      c.lp = y * 0.75 + c.lp * 0.25;
      c.b[c.i] = x + c.lp * room;
      c.i = (c.i + 1) % c.d;
      s += y;
    }
    for (const a of alls) {
      const y = a.b[a.i];
      a.b[a.i] = s + y * 0.5;
      a.i = (a.i + 1) % a.d;
      s = y - s * 0.5;
    }
    out[n] = dry[n] * (1 - wet * 0.5) + s * wet;
  }
  return out;
}

const env = (t: number, attack: number, decay: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** Metalik çan/para: uyumsuz kısmi tonlar */
function bell(freq: number, dur: number, decay = 0.35, partials = [[1, 1, 1], [2.76, 0.45, 0.55], [5.4, 0.22, 0.3], [8.93, 0.1, 0.18]]): Buf {
  return render(dur, (t) => {
    let s = 0;
    for (const [ratio, amp, dk] of partials) s += amp * Math.sin(2 * Math.PI * freq * ratio * t) * env(t, 0.001, decay * dk);
    return s;
  });
}

/** Yumuşak çan (müzikal, kazanç arpejleri için): uyumlu kısmi tonlar */
const chime = (freq: number, dur = 0.8, decay = 0.35) =>
  bell(freq, dur, decay, [[1, 1, 1], [2, 0.35, 0.6], [3.01, 0.12, 0.4], [4.2, 0.05, 0.25]]);

/** Bakır nefesli benzeri: filtrelenmiş testere, yavaş atak */
function brass(freqs: number[], dur: number, gain = 1): Buf {
  const raw = render(dur, (t) => {
    let s = 0;
    for (const f of freqs) {
      for (const detune of [0.997, 1.003]) {
        const ph = (f * detune * t) % 1;
        s += 2 * ph - 1;
      }
    }
    const a = Math.min(1, t / 0.05), r = Math.min(1, (dur - t) / 0.25);
    return (s / (freqs.length * 2)) * a * Math.max(0, r) * gain;
  });
  return filter(raw, 'lowpass', (t) => 900 + 2600 * Math.exp(-t / 0.4), 0.9);
}

/** Kısa vuruş (kick / timpani): frekansı düşen sinüs */
function thump(f0: number, f1: number, dur: number, decay: number): Buf {
  let phase = 0;
  return render(dur, (t) => {
    const f = f1 + (f0 - f1) * Math.exp(-t / (decay * 0.4));
    phase += (2 * Math.PI * f) / SR;
    return Math.sin(phase) * env(t, 0.002, decay);
  });
}

const noiseBurst = (dur: number, decay: number, attack = 0.001) => render(dur, (t) => noise() * env(t, attack, decay));

function normalize(b: Buf, peak: number): Buf {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m;
  // Uçlarda tık olmasın
  const fade = Math.min(b.length, 64);
  for (let i = 0; i < fade; i++) b[b.length - 1 - i] *= i / fade;
  return b;
}

function wav(name: string, b: Buf) {
  const data = Buffer.alloc(b.length * 2);
  for (let i = 0; i < b.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, b[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  const path = join(OUT, `${name}.wav`);
  writeFileSync(path, Buffer.concat([h, data]));
  return path;
}

const sounds: Record<string, () => Buf> = {
  /** Düğme dokunuşu */
  tap: () => {
    const b = render(0.05, (t) => Math.sin(2 * Math.PI * 1900 * t) * env(t, 0.0005, 0.006));
    mix(b, filter(noiseBurst(0.02, 0.002), 'highpass', 4000), 0, 0.3);
    return normalize(b, 0.45);
  },
  /** Fiş (bahis seçimi): iki kısa plastik vuruş */
  chip: () => {
    const hit = () => {
      const h = render(0.07, (t) => [2900, 4150, 5600].reduce((s, f, k) => s + Math.sin(2 * Math.PI * f * t) * env(t, 0.0003, 0.012 / (k + 1)), 0));
      mix(h, filter(noiseBurst(0.03, 0.004), 'bandpass', 3500, 1.5), 0, 0.8);
      return h;
    };
    const b = buf(0.14);
    mix(b, hit(), 0, 1);
    mix(b, hit(), 0.05, 0.6);
    return normalize(b, 0.6);
  },
  /** Kart dağıtma: kayan kâğıt */
  deal: () => {
    const dur = 0.2;
    const n = render(dur, (t) => noise() * Math.sin((Math.PI * t) / dur) ** 0.8);
    return normalize(filter(n, 'bandpass', (t) => 1500 + 3500 * (t / dur), 1.1), 0.5);
  },
  /** Kart çevirme */
  flip: () => {
    const b = filter(noiseBurst(0.09, 0.012), 'highpass', 2200);
    mix(b, thump(260, 160, 0.09, 0.025), 0, 0.5);
    return normalize(b, 0.55);
  },
  /** Kısa tahta tık (rulet topu, çark, crash adımları) */
  tick: () => {
    const b = render(0.035, (t) => Math.sin(2 * Math.PI * 1250 * t) * env(t, 0.0003, 0.005));
    mix(b, filter(noiseBurst(0.01, 0.0015), 'bandpass', 3200, 2), 0, 0.5);
    return normalize(b, 0.4);
  },
  /** Plinko çivisi: üç perde, sırayla kullanılır */
  peg1: () => normalize(chime(1760, 0.12, 0.05), 0.35),
  peg2: () => normalize(chime(1976, 0.12, 0.05), 0.35),
  peg3: () => normalize(chime(2217, 0.12, 0.05), 0.35),
  /** Makara durması */
  reel: () => {
    const b = thump(150, 70, 0.18, 0.06);
    mix(b, filter(noiseBurst(0.03, 0.004), 'bandpass', 2000, 1), 0, 0.4);
    return normalize(b, 0.7);
  },
  /** Dönüş başlangıcı: süzülen hava */
  whoosh: () => {
    const dur = 0.6;
    const n = render(dur, (t) => noise() * Math.sin((Math.PI * t) / dur) ** 1.5);
    return normalize(filter(n, 'bandpass', (t) => 3200 * Math.exp(-t * 2.2) + 500, 1.4), 0.5);
  },
  /** Dönen makara / rulet topu döngüsü (1 sn, kesintisiz tekrar) */
  spinloop: () => {
    const period = 1 / 16;
    const one = render(1, (t) => {
      const local = t % period;
      return Math.sin(2 * Math.PI * 900 * local) * env(local, 0.0003, 0.004) * 0.8;
    });
    return normalize(one, 0.35);
  },
  /** Tek para */
  coin: () => normalize(reverb(bell(2637, 0.5, 0.35), 0.15, 0.3), 0.6),
  /** Para yağmuru */
  coins: () => {
    const b = buf(1.4);
    for (let k = 0; k < 16; k++) {
      const at = (k / 16) ** 1.6 * 1.0 + rnd() * 0.04;
      mix(b, bell(2300 + rnd() * 900, 0.4, 0.25), at, 0.4 + rnd() * 0.4);
    }
    return normalize(reverb(b, 0.2, 0.4), 0.7);
  },
  /** Çekme: "ka-ching" */
  cashout: () => {
    const b = buf(1.2);
    mix(b, filter(noiseBurst(0.04, 0.006), 'bandpass', 2500, 1), 0, 0.6);
    mix(b, thump(300, 180, 0.08, 0.02), 0, 0.4);
    for (const f of [2637, 3520, 4186]) mix(b, bell(f, 1.0, 0.6), 0.07, 0.5);
    for (let k = 0; k < 6; k++) mix(b, bell(2500 + rnd() * 1200, 0.4, 0.2), 0.15 + k * 0.06, 0.25);
    return normalize(reverb(b, 0.2, 0.5), 0.8);
  },
  /** Küçük kazanç: kısa çan arpeji */
  winSmall: () => {
    const b = buf(1.2);
    ['C6', 'E6', 'G6', 'C7'].forEach((n, k) => mix(b, chime(NOTE(n), 0.9, k === 3 ? 0.45 : 0.25), k * 0.085, k === 3 ? 0.9 : 0.7));
    mix(b, bell(2637, 0.4, 0.3), 0, 0.3);
    return normalize(reverb(b, 0.25, 0.6), 0.75);
  },
  /** Büyük kazanç: yükselen arpej, akor, bas vuruşu ve para yağmuru */
  winBig: () => {
    const b = buf(2.6);
    ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, k) => mix(b, chime(NOTE(n), 0.8, 0.3), k * 0.07, 0.6));
    mix(b, brass(['C4', 'E4', 'G4', 'C5'].map(NOTE), 1.6, 1), 0.5, 0.55);
    mix(b, thump(130, 55, 0.6, 0.25), 0.5, 0.8);
    for (let k = 0; k < 14; k++) mix(b, bell(2400 + rnd() * 1000, 0.4, 0.22), 0.55 + (k / 14) ** 1.4 * 1.3, 0.25 + rnd() * 0.2);
    return normalize(reverb(b, 0.28, 1.0), 0.85);
  },
  /** Dev kazanç: fanfar (C – F – G – C), timpani, parıltı ve para yağmuru */
  winMega: () => {
    const b = buf(4.2);
    const chords: [number, string[]][] = [[0, ['C4', 'E4', 'G4']], [0.42, ['F4', 'A4', 'C5']], [0.84, ['G4', 'B4', 'D5']], [1.26, ['C5', 'E5', 'G5', 'C6']]];
    chords.forEach(([at, notes], k) => {
      mix(b, brass(notes.map(NOTE), k === 3 ? 2.2 : 0.45, 1), at, k === 3 ? 0.7 : 0.6);
      mix(b, thump(110, 50, 0.7, 0.3), at, 0.7);
      mix(b, filter(noiseBurst(0.3, 0.08), 'lowpass', 900), at, 0.25);
    });
    const penta = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7'];
    for (let k = 0; k < 26; k++) mix(b, chime(NOTE(penta[Math.floor(rnd() * penta.length)]), 0.5, 0.15), 1.26 + rnd() * 2.2, 0.18 + rnd() * 0.15);
    for (let k = 0; k < 24; k++) mix(b, bell(2300 + rnd() * 1100, 0.4, 0.22), 1.3 + (k / 24) ** 1.3 * 2.2, 0.2 + rnd() * 0.2);
    return normalize(reverb(b, 0.3, 1.4), 0.9);
  },
  /** Kayıp: yumuşak, inen iki ton */
  lose: () => {
    let phase = 0;
    const b = render(0.5, (t) => {
      const f = t < 0.16 ? NOTE('G4') : NOTE('D4');
      phase += (2 * Math.PI * f) / SR;
      const tri = (2 / Math.PI) * Math.asin(Math.sin(phase));
      return tri * env(t < 0.16 ? t : t - 0.16, 0.004, t < 0.16 ? 0.08 : 0.16);
    });
    return normalize(filter(b, 'lowpass', 1800), 0.35);
  },
  /** Patlama (crash, mayın) */
  boom: () => {
    const b = filter(noiseBurst(1.2, 0.28, 0.002), 'lowpass', (t) => 150 + 5000 * Math.exp(-t / 0.12), 0.8);
    mix(b, thump(95, 38, 1.2, 0.35), 0, 1.1);
    mix(b, filter(noiseBurst(0.04, 0.006), 'highpass', 3000), 0, 0.5);
    return normalize(reverb(b, 0.18, 0.6), 0.95);
  },
  /** Plinko: top cebe düşer */
  land: () => {
    const b = thump(200, 95, 0.3, 0.07);
    mix(b, chime(NOTE('A5'), 0.4, 0.12), 0.01, 0.35);
    return normalize(b, 0.6);
  },
};

// Mücevher tınıları: sıra arttıkça yükselen pentatonik dizi (mines)
['E6', 'G6', 'A6', 'B6', 'D7', 'E7', 'G7', 'A7'].forEach((n, k) => {
  sounds[`gem${k + 1}`] = () => normalize(reverb(chime(NOTE(n), 0.6, 0.22), 0.25, 0.5), 0.6);
});

/** Crash motoru: 1 sn'lik kesintisiz döngü; uygulama hızını çarpanla artırır (perde de yükselir) */
function engineLoop(): Buf {
  // Tam sayı frekanslar 1 saniyede tam dönem tamamlar: döngü dikişsiz
  const one = render(1, (t) => {
    let s = 0;
    for (const [f, a] of [[82, 0.6], [123, 0.35], [164, 0.25], [247, 0.12]] as const) {
      const ph = (f * t) % 1;
      s += a * (2 * ph - 1);
    }
    return s * (0.85 + 0.15 * Math.sin(2 * Math.PI * 8 * t));
  });
  // Filtre durumu otursun diye üç tur süzülür, ortadaki alınır
  const three = new Float32Array(one.length * 3);
  three.set(one, 0); three.set(one, one.length); three.set(one, one.length * 2);
  const filtered = filter(three, 'lowpass', 900, 0.8).slice(one.length, one.length * 2);
  const peak = filtered.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  for (let i = 0; i < filtered.length; i++) filtered[i] *= 0.4 / peak;
  return filtered;
}

/** Arka plan müziği: 120 BPM lounge/house, 16 ölçü (32 sn), dikişsiz döngü */
function music(): Buf {
  const bpm = 120, beat = 60 / bpm, bar = beat * 4, bars = 16, len = bar * bars;
  const tail = 3;
  const b = buf(len + tail);
  const prog: string[][] = [
    ['A3', 'C4', 'E4', 'G4', 'B4'], ['F3', 'A3', 'C4', 'E4', 'G4'], ['C4', 'E4', 'G4', 'B4', 'D5'], ['G3', 'B3', 'D4', 'E4', 'A4'],
  ];
  const roots = ['A1', 'F1', 'C2', 'G1'];
  // Elektrikli piyano (FM): senkoplu akor vuruşları
  const ep = (f: number, dur: number) => render(dur, (t) => {
    const idx = 1.6 * Math.exp(-t / 0.25);
    return Math.sin(2 * Math.PI * f * t + idx * Math.sin(2 * Math.PI * f * t)) * env(t, 0.004, 0.45) * 0.5;
  });
  const epLayer = buf(len + tail);
  const padLayer = buf(len + tail);
  for (let k = 0; k < bars; k++) {
    const chord = prog[Math.floor(k / 2) % 4].map(NOTE);
    const start = k * bar;
    for (const at of [0.5, 1.5, 2.75, 3.5]) {
      for (const f of chord) mix(epLayer, ep(f, 0.9), start + at * beat, 0.16);
    }
    if (k % 2 === 0) {
      const pad = brass(chord.slice(0, 4), bar * 2, 0.4);
      mix(padLayer, filter(pad, 'lowpass', 1100), start, 0.35);
    }
    // Bas: sekizlikler, kök ve oktav
    const root = NOTE(roots[Math.floor(k / 2) % 4]);
    for (let e = 0; e < 8; e++) {
      const f = e % 4 === 3 ? root * 2 : root;
      let phase = 0;
      const note = render(beat * 0.45, (t) => {
        phase += (2 * Math.PI * f) / SR;
        return Math.tanh(1.6 * Math.sin(phase)) * env(t, 0.005, 0.12);
      });
      mix(b, filter(note, 'lowpass', 600), start + e * beat * 0.5, e % 2 === 0 ? 0.42 : 0.3);
    }
    // Davul: dörtlük kick, 2 ve 4'te el çırpma, araya açık hi-hat, onaltılık kapalı hi-hat
    for (let q = 0; q < 4; q++) {
      mix(b, thump(130, 48, 0.3, 0.12), start + q * beat, 0.55);
      mix(b, filter(noiseBurst(0.12, 0.05), 'highpass', 7000), start + (q + 0.5) * beat, 0.16);
      for (let s = 0; s < 4; s++) mix(b, filter(noiseBurst(0.03, 0.008), 'highpass', 9000), start + (q + s / 4) * beat, s % 2 ? 0.05 : 0.08);
      if (q % 2 === 1) mix(b, filter(noiseBurst(0.18, 0.05), 'bandpass', 1500, 0.8), start + q * beat, 0.22);
    }
  }
  mix(b, reverb(epLayer, 0.35, 0.1).slice(0, b.length), 0, 1);
  mix(b, reverb(padLayer, 0.3, 0.1).slice(0, b.length), 0, 1);
  // Kuyruğu başa ekle: döngüde yankı kesilmesin
  const out = b.slice(0, Math.round(len * SR));
  for (let i = Math.round(len * SR); i < b.length; i++) out[i - Math.round(len * SR)] += b[i];
  return normalize(out, 0.8);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) wav(name, make());
wav('engine', engineLoop());
const musicWav = wav('music', music());
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', musicWav, join(OUT, 'music.m4a')]);
rmSync(musicWav);
console.log(`${Object.keys(sounds).length + 2} ses: ${OUT}`);
