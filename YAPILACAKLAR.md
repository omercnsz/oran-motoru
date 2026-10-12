# Yapılacaklar

Bekleyen işler ve fikirler. Biten madde silinir; kararlar ve ayrıntılar ilgili README bölümüne taşınır.

## Yayın

- [ ] **Google Play üretim başvurusu** (en erken ~21 Ekim 2026): 12+ test kullanıcısıyla 14 günlük kapalı test bitince Kontrol paneli → Üretime başvur. Başvuru cevaplarını önceden hazırla (testçiler nasıl bulundu, gelen geri bildirimler, yapılan değişiklikler: 1.0.2'deki kasma düzeltmesi).
- [ ] **App Store**: Apple sanal kumar içeren uygulamaları bireysel hesaptan kabul etmiyor (2.3.6, 8 Ekim 2026). App Review'a istisna/dönüşüm sorusu soruldu, cevap bekleniyor.
  - [ ] Şirket kur (Türkiye Ltd., Karadağ DOO ya da Estonya OÜ; vergi durumuna göre mali müşavirle karar), D-U-N-S al, Apple'dan bireysel hesabın kurumsala dönüştürülmesini iste. Şirket adı "Life Track System" olursa satıcı adı da bu olur.
  - [ ] Kurumsal hesap onaylanınca 1.0.1 (build 3) ya da güncel sürümü yeniden incelemeye gönder.
- [ ] İsteğe bağlı: R8/ProGuard eşleme (mapping) dosyasını Play'e yükle (çökme raporları okunaklı olsun).

## Özellikler

- [ ] **E-spor** (sanal parayla e-spor maçları, futboldaki gibi kupon ve kumbara)
  - Önce CS2 ve Dota 2. Veri: **GRID Open Access** (gelir öncesi girişimlere ücretsiz, başvuruyla: https://grid.gg/open-access/).
  - Sonra LoL ve Valorant: Riot API (ücretsiz, onaylı; kumar/bahis amaçlı kullanım kurallarını kontrol et).
  - Ücretli seçenekler gelir olunca: PandaScore (ücretsiz planda sadece fikstür; sonuçlar oyun başına ~400 €/ay, bazı planlar bahis uygulamalarına kapalı), Liquipedia (ücretsiz erişim sadece ticari olmayan projelere).
  - Model: maç geçmişinden Elo/Bradley–Terry takım gücü; beraberliksiz pazarlar: maç kazananı, harita handikapı, toplam harita (Bo1/Bo3/Bo5). Geriye dönük testle doğrula.
  - Uygulama: ana sayfada Futbol / E-spor seçimi; sonuçlandırma için sonuç verisi şart.
- [ ] Kazı kazan (casino oyunu)
- [ ] Kripto gölge alım-satım modülü
- [ ] Maç istatistikleri, oran hareket okları, daha fazla pazar
- [ ] Android sekme çubuğu açık temalı Kumbara ekranına uysun

## Reklam (sonraki sürüm)

- [ ] AdMob'u aç: gerçek reklam kimlikleri (.env), app.json'daki AD_ID engelini kaldır, Play'de reklam ve reklam kimliği beyanlarını güncelle.
- [ ] AdMob panelinde **kumar, kripto ve kredi reklam kategorilerini engelle**: Google Play'de kumar reklamı gösteren uygulama sanal kumar içeremez.
- [ ] Reklam gelirine geçince Apple'da AB tacir (DSA) beyanını "tacir" olarak güncelle; gizlilik politikasını ve veri güvenliği formunu reklam SDK'sına göre güncelle.
