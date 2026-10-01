// expo-notifications iOS'ta sunucudan bildirim (push) yetkisini her zaman ekler. Uygulama şimdilik sadece telefonun
// kendi kurduğu (yerel) bildirimleri kullanıyor; bu yetki varken uygulama ücretsiz Apple kimliğiyle iPhone'a kurulamıyor.
// Sunucudan bildirim eklenince (ücretli Apple geliştirici hesabı gerekir) bu eklenti app.json'dan kaldırılmalı.
// Not: eklentilerin değişiklikleri ters sırayla uygulanır; bu yüzden app.json'da expo-notifications'tan ÖNCE durmalı.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
