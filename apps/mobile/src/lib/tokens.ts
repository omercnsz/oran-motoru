// Jeton ve çarpan biçimi, kullanıcının dilinde. Jetonlar birim cinsinden tutulur (1 jeton = TOKEN birim).
import { TOKEN } from '@oran/games-math';

import { localization } from '@/i18n';

const cache = new Map<string, Intl.NumberFormat>();
function format(kind: 'tokens' | 'multiplier'): Intl.NumberFormat {
  const locale = localization().locale;
  const key = `${locale}|${kind}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, kind === 'tokens'
      ? { maximumFractionDigits: 2 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    cache.set(key, f);
  }
  return f;
}

/** "1.250" / "15,5" */
export const formatTokens = (units: number) => format('tokens').format(units / TOKEN);
/** "+134" / "−100" (kayıp kazanç gibi gösterilmez: her zaman net sonuç) */
export const formatNet = (units: number) => `${units > 0 ? '+' : units < 0 ? '−' : ''}${formatTokens(Math.abs(units))}`;
/** "2,34×" */
export const formatMultiplier = (m: number) => `${format('multiplier').format(m)}×`;

/** "%94,1" / "94.1%" */
export const formatPercent = (ratio: number) =>
  new Intl.NumberFormat(localization().locale, { style: 'percent', maximumFractionDigits: 1 }).format(ratio);
