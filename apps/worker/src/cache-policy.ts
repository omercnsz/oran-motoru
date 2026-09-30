// ESPN önbelleğinin kuralları (Cloudflare'e bağlı değil, tek başına test edilebilir).
import { ESPN_SLUGS } from '@oran/live-sources';

const DAY_MS = 86_400_000;

/** İstek bizim liglerimizden biri ve geçerli bir tarih mi? (açık bir ESPN aracısı olmayalım) */
export function parseEspnPath(pathname: string): { league: string; dates: string } | null {
  const m = pathname.match(/^\/espn\/([A-Z0-9]{1,6})\/(\d{6}|\d{8})$/);
  if (!m || !ESPN_SLUGS[m[1]]) return null;
  return { league: m[1], dates: m[2] };
}

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');

/**
 * Önbellek süresi (saniye). ESPN günleri ABD Doğu saatine göre böldüğü için "bugün"ün bir gün
 * öncesi ve sonrası da canlı sayılır.
 */
export function cacheTtl(dates: string, now: Date): number {
  const t = now.getTime();
  if (dates.length === 6) return 600; // aylık fikstür
  if (dates >= ymd(t - DAY_MS) && dates <= ymd(t + DAY_MS)) return 20; // canlı maç olabilir
  return dates < ymd(t) ? 3600 : 300; // geçmiş: sonuç kesin; ileri tarih: fikstür nadiren değişir
}
