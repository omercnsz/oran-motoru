// Sunucu tarafının (GitHub Pages, Cloudflare Worker) ürettiği ve mobil uygulamanın okuduğu
// JSON dosyalarının biçimi. İki taraf da bu tipleri kullanır; biçim değişirse derleme hata verir.
import type { Ratings, Score } from '@oran/odds-engine';

/** index.json */
export interface IndexFile {
  updatedAt: string;
  leagues: { code: string; name: string; kind: 'league' | 'cup' | 'continental'; region: string; teams: number; upcoming: number; results: number }[];
}

/** ratings/<lig>.json */
export interface RatingsFile extends Ratings {
  league: string;
  updatedAt: string;
}

/** odds/<lig>.json */
export interface OddsFile {
  league: string;
  updatedAt: string;
  matches: UpcomingMatch[];
}

/** Takımın ESPN kısaltması ve renkleri (altıgen, # olmadan): arma rozeti için. Yoksa uygulama addan üretir. */
export interface TeamStyle { abbr?: string; color?: string; alt?: string }

export interface UpcomingMatch {
  id: string;
  /** ESPN maç kimliği (canlı skor ve hızlı sonuç için) */
  espnId: string;
  /** İngiltere takvim tarihi, YYYY-MM-DD (sonuç dosyalarıyla eşleştirme anahtarı) */
  date: string;
  /** Başlama zamanı, ISO UTC */
  kickoff: string;
  home: string;
  away: string;
  homeStyle?: TeamStyle;
  awayStyle?: TeamStyle;
  xg: Score;
  /** market → sonuç → oran (null = kapalı). Örn. markets['1X2']['1'] */
  markets: Record<string, Record<string, number | null>>;
}

/** schedule.json: tüm liglerin son 2 gün + önümüzdeki 14 günün maçları (canlı ekran ve sonuçlandırma için) */
export interface ScheduleFile {
  updatedAt: string;
  matches: ScheduledMatch[];
}

export interface ScheduledMatch {
  league: string;
  /** UpcomingMatch.id ile aynı */
  id: string;
  espnId: string;
  /** Bizim veri setimizdeki adlar */
  home: string;
  away: string;
  homeStyle?: TeamStyle;
  awayStyle?: TeamStyle;
  /** İngiltere takvim tarihi (sonuç eşleştirme anahtarı) */
  date: string;
  kickoff: string;
}

/** results/<lig>.json */
export interface ResultsFile {
  league: string;
  updatedAt: string;
  results: { date: string; home: string; away: string; score: Score }[];
}

