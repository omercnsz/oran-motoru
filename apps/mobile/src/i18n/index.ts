// Yerelleştirme: dil, para birimi, oran biçimi ve bunlara göre biçimlendirme.
// Varsayılanlar cihazdan gelir; kullanıcı Ayarlar'dan değiştirebilir (telefonda saklanır).
import {
  defaultOddsFormat, formatMoney, formatOdds, minorDigits, oneUnit, type OddsFormat,
} from '@oran/betting';
import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';
import { I18n, type TranslateOptions } from 'i18n-js';
import { I18nManager } from 'react-native';
import { create } from 'zustand';

import ar from './locales/ar';
import en from './locales/en';
import es from './locales/es';
import pt from './locales/pt';
import ru from './locales/ru';
import tr from './locales/tr';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'ru', name: 'Русский' },
] as const;

/** Ayarlar'da gösterilen para birimleri (cihazınki listede yoksa o da eklenir) */
export const CURRENCIES = [
  'TRY', 'USD', 'EUR', 'GBP', 'BRL', 'ARS', 'MXN', 'COP', 'CLP', 'RUB', 'SAR', 'AED', 'EGP', 'MAD',
  'JPY', 'CNY', 'KRW', 'INR', 'IDR', 'AUD', 'CAD', 'CHF', 'PLN', 'RSD', 'ZAR', 'NGN',
];

const i18n = new I18n({ en, tr, es, pt, ar, ru });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

type Choice<T extends string> = 'auto' | T;
export interface Preferences {
  language: Choice<string>;
  currency: Choice<string>;
  oddsFormat: Choice<OddsFormat>;
}

const STORAGE_KEY = 'preferences';
function loadPreferences(): Preferences {
  const fallback: Preferences = { language: 'auto', currency: 'auto', oddsFormat: 'auto' };
  try {
    return { ...fallback, ...JSON.parse(Storage.getItemSync(STORAGE_KEY) ?? '{}') };
  } catch {
    return fallback;
  }
}

const device = () => getLocales()[0];
const supported = (code: string | null | undefined) => LANGUAGES.find((l) => l.code === code)?.code;

/** "Otomatik" seçildiğinde kullanılacak değerler (cihazdan) */
export function deviceDefaults() {
  const d = device();
  return {
    language: supported(d?.languageCode) ?? 'en',
    currency: d?.currencyCode ?? 'USD',
    oddsFormat: defaultOddsFormat(d?.regionCode),
  };
}

export interface Localization {
  prefs: Preferences;
  /** Arayüz dili (en, tr, …) */
  language: string;
  /** Intl biçimlendirmesi için tam yerel etiket (ör. pt-BR, en-GB) */
  locale: string;
  currency: string;
  oddsFormat: OddsFormat;
  decimalSeparator: string;
  regionCode: string | null;
  isRtl: boolean;
  /** Yazı yönü değişti; uygulama yeniden başlatılmalı */
  needsRestart: boolean;
}

function resolve(prefs: Preferences): Localization {
  const d = device();
  const auto = deviceDefaults();
  const language = prefs.language === 'auto' ? auto.language : prefs.language;
  const locale = d?.languageCode === language && d.languageTag ? d.languageTag : language;
  const isRtl = LANGUAGES.some((l) => l.code === language && 'rtl' in l && l.rtl);
  return {
    prefs,
    language,
    locale,
    currency: prefs.currency === 'auto' ? auto.currency : prefs.currency,
    oddsFormat: prefs.oddsFormat === 'auto' ? auto.oddsFormat : prefs.oddsFormat,
    decimalSeparator: d?.decimalSeparator ?? '.',
    regionCode: d?.regionCode ?? null,
    isRtl,
    needsRestart: I18nManager.isRTL !== isRtl,
  };
}

function apply(l: Localization) {
  i18n.locale = l.language;
  if (I18nManager.isRTL !== l.isRtl) {
    I18nManager.allowRTL(l.isRtl);
    I18nManager.forceRTL(l.isRtl);
  }
}

const initial = resolve(loadPreferences());
apply(initial);

export const useLocalization = create<Localization & { setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void }>((set) => ({
  ...initial,
  setPreference: (key, value) => set((s) => {
    const prefs = { ...s.prefs, [key]: value };
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(prefs));
    const next = resolve(prefs);
    apply(next);
    return next;
  }),
}));

/** Bileşen dışı kod için anlık değerler (tarih biçimlendirme vb.) */
export const localization = () => useLocalization.getState();

/**
 * Çeviri ve biçimlendirme. Dil değişince bu hook'u kullanan ekranlar yeniden çizilir.
 * t('slip.errors.minStake', { min: '₺1,00' })
 */
export function useT() {
  const l = useLocalization();
  return {
    ...l,
    t: (key: string, options?: TranslateOptions) => i18n.t(key, { ...options, locale: l.language }),
    money: (minor: number) => formatMoney(minor, l.currency, l.locale),
    odds: (decimal: number) => formatOdds(decimal, l.oddsFormat),
    minStake: oneUnit(l.currency),
    /** Tutar alanı için örnek: "150,50" ya da "1500" */
    amountExample: minorDigits(l.currency) > 0 ? `150${l.decimalSeparator}50` : '1500',
  };
}

export const t = (key: string, options?: TranslateOptions) => i18n.t(key, { ...options, locale: localization().language });

// ---------------------------------------------------------------------------
// Ülkeye göre yardım hatları. YAYINDAN ÖNCE HER BİRİ DOĞRULANMALI.
// Emin olunmayan ülkelerde uluslararası kaynağa yönlendirilir.
// ---------------------------------------------------------------------------
const HELPLINES: Record<string, { name: string; contact: string }> = {
  TR: { name: 'Yeşilay Danışmanlık Hattı', contact: '115' },
  GB: { name: 'National Gambling Helpline', contact: '0808 8020 133' },
  US: { name: '1-800-GAMBLER', contact: '1-800-426-2537' },
  AU: { name: 'Gambling Help Online', contact: '1800 858 858' },
  DE: { name: 'BZgA Glücksspielsucht-Beratung', contact: '0800 1 37 27 00' },
};
const FALLBACK_HELPLINE = { name: 'Gamblers Anonymous', contact: 'gamblersanonymous.org' };

export const helplineFor = (regionCode: string | null) => (regionCode && HELPLINES[regionCode]) || FALLBACK_HELPLINE;
