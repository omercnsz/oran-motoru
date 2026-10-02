// Reklamlar (Google AdMob). Kurallar:
// - Afiş sadece özet ekranlarında (Kuponlar, Kumbara); maç, oran ve kupon ekranlarında, yani bahis kararı anında asla.
// - Kişiselleştirilmemiş reklam: bahis eğilimli kullanıcıların profillenip hedeflenmesini istemiyoruz.
// - Kumar, kripto ve kredi reklamları AdMob konsolundan engellenir (kodla yapılamaz).
// - Ödüllü reklam sadece oyun jetonu bitince (jeton satılmaz).
// AdMob hesabı açılana kadar Google'ın test kimlikleri kullanılır: gösterilen reklamlar örnektir, gelir yoktur.
import mobileAds, {
  AdEventType, AdsConsent, AdsConsentPrivacyOptionsRequirementStatus, MaxAdContentRating, RewardedAd, RewardedAdEventType, TestIds,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import { create } from 'zustand';

/** Gerçek reklam birimi .env'den (EXPO_PUBLIC_ADMOB_BANNER_IOS / _ANDROID); yoksa ya da geliştirmedeyse test birimi */
const realBanner = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS,
  android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
});
export const BANNER_ID = !__DEV__ && realBanner ? realBanner : TestIds.ADAPTIVE_BANNER;

const realRewarded = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
});
const REWARDED_ID = !__DEV__ && realRewarded ? realRewarded : TestIds.REWARDED;

/** Reklam isteğinin ortak ayarları */
export const AD_REQUEST = { requestNonPersonalizedAdsOnly: true };

interface AdsState {
  /** Reklam istenebilir (izin alındı ya da gerekmiyor, SDK hazır) */
  ready: boolean;
  /** AB/İngiltere: kullanıcı reklam izin tercihini Ayarlar'dan değiştirebilmeli */
  privacyOptions: boolean;
}

export const useAds = create<AdsState>(() => ({ ready: false, privacyOptions: false }));

let started = false;

/** Uygulama açılınca bir kez: gerekirse izin formu, sonra reklam SDK'sı */
export async function startAds(): Promise<void> {
  if (started) return;
  started = true;
  try {
    // İzin formu AdMob konsolunda "Privacy & messaging" ayarlanınca, sadece gereken ülkelerde gösterilir
    await AdsConsent.gatherConsent();
  } catch (err) {
    console.warn('Reklam izni bilgisi alınamadı:', (err as Error).message);
  }
  const info = await AdsConsent.getConsentInfo().catch(() => null);
  useAds.setState({ privacyOptions: info?.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED });
  // Geliştirmede izin akışı (AdMob hesabı olmadan) çalışmaz; test reklamları yine de gösterilir
  if (!info?.canRequestAds && !__DEV__) return;
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.PG,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
  });
  await mobileAds().initialize();
  useAds.setState({ ready: true });
}

/** Reklam izin tercihini değiştirme formu (Ayarlar) */
export async function showAdPrivacyOptions(): Promise<void> {
  await AdsConsent.showPrivacyOptionsForm();
}

/** Bu sürede yüklenemeyen ödüllü reklam "yok" sayılır */
const REWARDED_TIMEOUT_MS = 15_000;

/**
 * Ödüllü reklam gösterir. earned: sonuna kadar izlendi; closed: erken kapatıldı;
 * unavailable: reklam yok (izin, bağlantı ya da stok). Reklam yoksa kullanıcı cezalandırılmaz (çağıran jeton verir).
 */
export function showRewarded(): Promise<'earned' | 'closed' | 'unavailable'> {
  if (!useAds.getState().ready) return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(REWARDED_ID, AD_REQUEST);
    let earned = false;
    const done = (result: 'earned' | 'closed' | 'unavailable') => {
      clearTimeout(timer);
      unsubscribe.forEach((u) => u());
      resolve(result);
    };
    const timer = setTimeout(() => done('unavailable'), REWARDED_TIMEOUT_MS);
    const unsubscribe = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(timer);
        ad.show().catch(() => done('unavailable'));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
      ad.addAdEventListener(AdEventType.CLOSED, () => done(earned ? 'earned' : 'closed')),
      ad.addAdEventListener(AdEventType.ERROR, () => done('unavailable')),
    ];
    ad.load();
  });
}
