import { MARKETS } from '@oran/odds-engine';

const TZ = 'Europe/Istanbul';
const dayFmt = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const shortFmt = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "Cuma, 9 Ekim" (Türkiye saatiyle) */
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));
/** "20:00" */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
/** "9 Eki 20:00" */
export const formatShort = (iso: string) => shortFmt.format(new Date(iso));
/** Gün gruplaması için anahtar (Türkiye takvimine göre) */
export const dayKey = (iso: string) => formatDay(iso);

export const formatOdds = (odds: number) => odds.toFixed(2);

/** "Maç Sonucu: 1", "2.5 Alt/Üst: Üst" */
export function describeBet(marketKey: string, outcomeKey: string): { market: string; outcome: string } {
  const market = MARKETS.find((m) => m.key === marketKey);
  const outcome = market?.outcomes.find((o) => o.key === outcomeKey);
  return { market: market?.name ?? marketKey, outcome: outcome?.label ?? outcomeKey };
}
