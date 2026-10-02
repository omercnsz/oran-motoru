// react-native-google-mobile-ads 17.1 ve 17.2'nin Android derlemesi Expo projelerinde çöküyor: kütüphane app.json'da
// kendi kök anahtarını bulamayınca değişkeni yanlış adla tanımlıyor (googleAdsJson), sonra googleMobileAdsJson'a
// korumasız erişiyor. Değişkeni kök build.gradle'da önceden "yok" (false) olarak tanımlamak yeterli; reklam ayarları
// zaten kütüphanenin Expo eklentisiyle (AndroidManifest) veriliyor. Kütüphane düzeltilince bu eklenti kaldırılabilir.
const { withProjectBuildGradle } = require('expo/config-plugins');

const LINE = 'ext.googleMobileAdsJson = false // plugins/google-mobile-ads-gradle-fix.js';

module.exports = function withGoogleMobileAdsGradleFix(config) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(LINE)) config.modResults.contents += `\n${LINE}\n`;
    return config;
  });
};
