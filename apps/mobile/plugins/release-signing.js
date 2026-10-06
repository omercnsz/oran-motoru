// Android yayın imzası: Play'e yüklenecek paket (AAB) bu bilgisayardaki yükleme anahtarıyla imzalanır.
// Anahtar ve şifreleri depoda DEĞİL, kullanıcının ~/.gradle/gradle.properties dosyasında durur:
//   STASHODDS_UPLOAD_STORE_FILE=/tam/yol/stashodds-upload.jks
//   STASHODDS_UPLOAD_STORE_PASSWORD=...
//   STASHODDS_UPLOAD_KEY_ALIAS=upload
//   STASHODDS_UPLOAD_KEY_PASSWORD=...
// Bu değerler yoksa yayın derlemesi hata verir (yanlışlıkla hata ayıklama anahtarıyla imzalanmış paket yüklenmesin).
// Google Play son imzayı kendi anahtarıyla atar (Play App Signing); yükleme anahtarı kaybolursa Play Console'dan sıfırlatılır.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (project.hasProperty('STASHODDS_UPLOAD_STORE_FILE')) {
                storeFile file(STASHODDS_UPLOAD_STORE_FILE)
                storePassword STASHODDS_UPLOAD_STORE_PASSWORD
                keyAlias STASHODDS_UPLOAD_KEY_ALIAS
                keyPassword STASHODDS_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (gradle.includes('STASHODDS_UPLOAD_STORE_FILE')) return config;
    // signingConfigs { debug { ... } } bloğunun sonuna release ekle
    gradle = gradle.replace(/(signingConfigs \{\s*debug \{[\s\S]*?\n {8}\})/, `$1${RELEASE_CONFIG}`);
    // release derlemesi hata ayıklama anahtarıyla değil, yükleme anahtarıyla imzalansın
    gradle = gradle.replace(
      /(release \{\s*\/\/ Caution![^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('STASHODDS_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    // Anahtar yoksa Play paketi (bundleRelease) hiç üretilmesin; deneme APK'sı (assembleRelease) hata ayıklama anahtarıyla imzalanır
    gradle += `
tasks.matching { it.name == 'bundleRelease' }.configureEach {
    doFirst {
        if (!project.hasProperty('STASHODDS_UPLOAD_STORE_FILE')) {
            throw new GradleException('Yükleme anahtarı tanımlı değil: ~/.gradle/gradle.properties içine STASHODDS_UPLOAD_* değerlerini ekleyin')
        }
    }
}
`;
    if (!gradle.includes('signingConfigs.release')) throw new Error('release-signing: build.gradle beklenen biçimde değil');
    config.modResults.contents = gradle;
    return config;
  });
};
