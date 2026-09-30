// Tarih ve bahis adları: kullanıcının dilinde ve cihazın saat diliminde.
import { MARKETS } from '@oran/odds-engine';

import { localization, t } from '@/i18n';

const cache = new Map<string, Intl.DateTimeFormat>();
function dateFormat(kind: 'day' | 'time' | 'short'): Intl.DateTimeFormat {
  const locale = localization().locale;
  const key = `${locale}|${kind}`;
  let f = cache.get(key);
  if (!f) {
    const options: Intl.DateTimeFormatOptions = kind === 'day' ? { weekday: 'long', day: 'numeric', month: 'long' }
      : kind === 'time' ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    f = new Intl.DateTimeFormat(locale, options); // saat dilimi belirtilmez: cihazınki kullanılır
    cache.set(key, f);
  }
  return f;
}

/** "Cuma, 9 Ekim" / "Friday, October 9" */
export const formatDay = (iso: string) => dateFormat('day').format(new Date(iso));
/** "20:00" / "8:00 PM" */
export const formatTime = (iso: string) => dateFormat('time').format(new Date(iso));
/** "9 Eki 20:00" */
export const formatShort = (iso: string) => dateFormat('short').format(new Date(iso));
/** Gün gruplaması için anahtar (cihazın takvimine göre) */
export const dayKey = (iso: string) => formatDay(iso);

/** Market adı: "Maç Sonucu", "2.5 Over/Under", "Handicap (0:1)" */
export function marketName(key: string): string {
  if (key.startsWith('OU')) return t('markets.OU', { line: key.slice(2) });
  if (key.startsWith('HC')) {
    const hc = Number(key.slice(2));
    return t('markets.HC', { hc: hc > 0 ? `${hc}:0` : `0:${-hc}` });
  }
  return t(`markets.${key}`, { defaultValue: MARKETS.find((m) => m.key === key)?.name ?? key });
}

const OUTCOME_KEYS: Record<string, string> = { U: 'under', O: 'over', Y: 'yes', N: 'no', other: 'other' };

/** Sonuç etiketi: 1, X, 2, 1-X ve skorlar olduğu gibi; Alt/Üst, Var/Yok, Diğer çevrilir */
export function outcomeLabel(marketKey: string, outcomeKey: string): string {
  const word = OUTCOME_KEYS[outcomeKey];
  if (word && (marketKey.startsWith('OU') || marketKey === 'BTTS' || outcomeKey === 'other')) return t(`outcomes.${word}`);
  return MARKETS.find((m) => m.key === marketKey)?.outcomes.find((o) => o.key === outcomeKey)?.label ?? outcomeKey;
}

export function describeBet(marketKey: string, outcomeKey: string): { market: string; outcome: string } {
  return { market: marketName(marketKey), outcome: outcomeLabel(marketKey, outcomeKey) };
}

/** Canlı maçın süresi: "67'", devre arası "İY/HT", bitince "MS/FT" (kullanıcının dilinde) */
export function clockLabel(e: { state: 'pre' | 'in' | 'post'; status: string; clock: string }): string {
  if (e.status === 'STATUS_HALFTIME') return t('live.halfTime');
  if (e.state === 'post') return t('live.fullTime');
  return e.clock;
}
