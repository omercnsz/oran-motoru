// Oyun sesleri: kısa efektler, döngüler (crash motoru, dönen makara) ve oyunlarda arka plan müziği.
// Sesler scripts/sounds.mts ile kodla üretilir. Telefon sessizdeyse çalmaz; başka uygulamanın müziğini durdurmaz.
// Sık çalan efektler (tık, çivi, para) birden fazla oynatıcıyla üst üste binebilir.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';

import { useFeedback } from '@/state/feedback';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  chip: require('../../assets/sounds/chip.wav'),
  deal: require('../../assets/sounds/deal.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  peg1: require('../../assets/sounds/peg1.wav'),
  peg2: require('../../assets/sounds/peg2.wav'),
  peg3: require('../../assets/sounds/peg3.wav'),
  reel: require('../../assets/sounds/reel.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  coins: require('../../assets/sounds/coins.wav'),
  cashout: require('../../assets/sounds/cashout.wav'),
  winSmall: require('../../assets/sounds/winSmall.wav'),
  winBig: require('../../assets/sounds/winBig.wav'),
  winMega: require('../../assets/sounds/winMega.wav'),
  lose: require('../../assets/sounds/lose.wav'),
  boom: require('../../assets/sounds/boom.wav'),
  land: require('../../assets/sounds/land.wav'),
  gem1: require('../../assets/sounds/gem1.wav'),
  gem2: require('../../assets/sounds/gem2.wav'),
  gem3: require('../../assets/sounds/gem3.wav'),
  gem4: require('../../assets/sounds/gem4.wav'),
  gem5: require('../../assets/sounds/gem5.wav'),
  gem6: require('../../assets/sounds/gem6.wav'),
  gem7: require('../../assets/sounds/gem7.wav'),
  gem8: require('../../assets/sounds/gem8.wav'),
} as const;
const LOOPS = {
  engine: require('../../assets/sounds/engine.wav'),
  spinloop: require('../../assets/sounds/spinloop.wav'),
} as const;
const MUSIC = require('../../assets/sounds/music.m4a');

export type Sfx = keyof typeof SOURCES;
const POLYPHONY: Partial<Record<Sfx, number>> = { tick: 4, coin: 4, chip: 2, tap: 2, deal: 3, flip: 2, reel: 3, peg1: 2, peg2: 2, peg3: 2 };
const MUSIC_VOLUME = 0.32;

let configured = false;
function configure() {
  if (configured) return;
  configured = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
}

// Her oynatıcının durumu JS'te tutulur: her çalışta yerel tarafa soru sormak (currentTime, playbackRate)
// ana iş parçacığını meşgul ediyordu. Ek oynatıcılar ilk ihtiyaçta oluşturulur.
interface Voice { player: AudioPlayer; rate: number; volume: number; played: boolean }
const pools = new Map<Sfx, { voices: Voice[]; next: number; last: number }>();
function voice(name: Sfx) {
  configure();
  return { player: createAudioPlayer(SOURCES[name]), rate: 1, volume: 1, played: false };
}
function pool(name: Sfx) {
  let p = pools.get(name);
  if (!p) {
    p = { voices: [voice(name)], next: 0, last: 0 };
    pools.set(name, p);
  }
  return p;
}

/** Aynı ses bundan daha sık çalınmaz (çiviler, tıklar üst üste binince hem kulağa hem işlemciye yük) */
const MIN_GAP_MS = 35;

/** Ekran açılınca kullanılacak sesleri önceden yükler (ilk çalışta gecikme olmasın) */
export function preload(names: Sfx[]) {
  for (const n of names) pool(n);
}

/** Efekt çalar. rate: perde ve hız (1 normal) */
export function sfx(name: Sfx, { volume = 1, rate = 1 }: { volume?: number; rate?: number } = {}) {
  if (!useFeedback.getState().sound) return;
  try {
    const p = pool(name);
    const now = Date.now();
    if (now - p.last < MIN_GAP_MS) return;
    p.last = now;
    if (p.next >= p.voices.length) p.voices.push(voice(name));
    const v = p.voices[p.next];
    p.next = (p.next + 1) % (POLYPHONY[name] ?? 1);
    if (v.volume !== volume) {
      v.volume = volume;
      v.player.volume = volume;
    }
    if (v.rate !== rate) {
      v.rate = rate;
      v.player.shouldCorrectPitch = false;
      v.player.setPlaybackRate(rate);
    }
    if (v.played) void v.player.seekTo(0);
    v.played = true;
    v.player.play();
  } catch {
    // Ses çalınamazsa oyun etkilenmez
  }
}

/** Döngü (ör. crash motoru): hızı ve sesi sonradan değiştirilebilir */
export function loop(name: keyof typeof LOOPS, volume = 1) {
  let player: AudioPlayer | null = null;
  if (useFeedback.getState().sound) {
    try {
      configure();
      player = createAudioPlayer(LOOPS[name]);
      player.loop = true;
      player.volume = volume;
      player.shouldCorrectPitch = false;
      player.play();
    } catch {
      player = null;
    }
  }
  return {
    setRate(rate: number) {
      try { player?.setPlaybackRate(rate); } catch { /* yok say */ }
    },
    stop() {
      try { player?.pause(); player?.remove(); } catch { /* yok say */ }
      player = null;
    },
  };
}

// Müzik: oyun ekranlarından herhangi biri açıkken çalar. Ekranlar arasında geçerken kesilmesin diye sayaçla tutulur.
let music: AudioPlayer | null = null;
let musicUsers = 0;
let fade: ReturnType<typeof setInterval> | null = null;

function fadeTo(target: number, ms: number, done?: () => void) {
  if (fade) clearInterval(fade);
  const p = music;
  if (!p) return done?.();
  const start = p.volume, steps = Math.max(1, Math.round(ms / 40));
  let k = 0;
  fade = setInterval(() => {
    k++;
    try { p.volume = start + ((target - start) * k) / steps; } catch { /* yok say */ }
    if (k >= steps) {
      if (fade) clearInterval(fade);
      fade = null;
      done?.();
    }
  }, 40);
}

function syncMusic() {
  const want = musicUsers > 0 && useFeedback.getState().music && AppState.currentState === 'active';
  try {
    if (want) {
      if (!music) {
        configure();
        music = createAudioPlayer(MUSIC);
        music.loop = true;
        music.volume = 0;
      }
      music.play();
      fadeTo(MUSIC_VOLUME, 800);
    } else if (music) {
      fadeTo(0, 400, () => music?.pause());
    }
  } catch {
    // Müzik çalınamazsa oyun etkilenmez
  }
}

export function musicAcquire() {
  musicUsers++;
  syncMusic();
}

export function musicRelease() {
  musicUsers = Math.max(0, musicUsers - 1);
  // Bir oyun ekranından ötekine geçerken müzik kesilmesin
  setTimeout(syncMusic, 250);
}

useFeedback.subscribe(syncMusic);
AppState.addEventListener('change', syncMusic);
