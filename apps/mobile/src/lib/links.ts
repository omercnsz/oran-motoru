// Mağaza sayfaları ve web sayfaları (Ayarlar → Hakkında)
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

const PLAY_ID = 'com.app.stashodds';
const APPLE_ID = '6819806611';

export const PRIVACY_URL = 'https://omercnsz.github.io/oran-motoru/privacy.html';
export const SUPPORT_URL = 'https://omercnsz.github.io/oran-motoru/support.html';

/** Paylaşılan bağlantı: telefonun kendi mağazası */
export const STORE_URL = Platform.OS === 'ios'
  ? `https://apps.apple.com/app/id${APPLE_ID}`
  : `https://play.google.com/store/apps/details?id=${PLAY_ID}`;

/**
 * Mağazadaki değerlendirme sayfasını açar. Sadece kullanıcı isteyince: mağazaların kendi puan penceresi
 * düğmeyle açılmamalı (gösterilip gösterilmeyeceğini mağaza seçer), kazanç anında da sorulmaz.
 */
export async function openStoreReview() {
  if (Platform.OS === 'ios') {
    await Linking.openURL(`https://apps.apple.com/app/id${APPLE_ID}?action=write-review`);
    return;
  }
  try {
    await Linking.openURL(`market://details?id=${PLAY_ID}`);
  } catch {
    await Linking.openURL(STORE_URL);
  }
}

/**
 * Sayfayı uygulama içi tarayıcıda açar. O kilitliyse telefonun tarayıcısında açar: iOS'ta başka bir pencere
 * (ör. paylaşma) kapanırken açılamayan tarayıcı oturumu kapanmadan kalıyor ve sonraki denemeler "locked" dönüyor.
 */
export async function openPage(url: string) {
  try {
    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type !== WebBrowser.WebBrowserResultType.LOCKED) return;
  } catch {
    // Aşağıda telefonun tarayıcısıyla açılır
  }
  await Linking.openURL(url);
}
