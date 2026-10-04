# Oran

Kumar bağımlılığında zarar azaltma uygulaması: gerçek maçlara ve casino oyunlarına **sanal parayla** oynanır, yatırılmayan gerçek para kumbarada birikir. Veriler kullanıcının telefonunda kalır.

## Yapı

```
packages/
├── odds-engine   Oran motoru: takım güçleri, Poisson + Dixon-Coles, marketler, kasa payı, sonuçlandırma
├── leagues       Turnuvaların tek listesi (63 turnuva: ligler, kupalar, kıta kupaları), kıtaları, ilk favoriler
├── teams         Farklı kaynaklardaki takım adlarını eşleştirme (geriye dönük testte kullanılır)
├── betting       Gölge kupon kuralları: doğrulama, sonuçlandırma, kumbara raporu
├── games-math    Casino oyunlarının matematiği (gerçek casinolarla aynı kasa avantajı) ve RTP simülasyonları
├── live-sources  ESPN skor tablosu: canlı skor, kırmızı kart, biten maç sonuçları
└── contracts     Sunucu ile uygulama arasındaki JSON biçimleri (tipler)
apps/
├── mobile        Expo (React Native) uygulaması
├── pipeline      GitHub Actions: maç verisi → takım güçleri ve oranlar → GitHub Pages
└── worker        Cloudflare Worker: ESPN'in önünde kenar önbelleği → GET /espn/<lig>/<tarih>
```

Kod TypeScript. Paketler derleme adımı olmadan çalışır: Node tip silme ile, Worker ve Metro kendi derleyicileriyle. Bu yüzden sadece silinebilir TypeScript sözdizimi kullanılır (enum ve namespace yok) ve göreli importlar `.ts` uzantısıyla yazılır.

## Komutlar

Node 22.18 veya üstü gerekir. Kök klasörde:

```bash
npm install
npm run check                            # tip kontrolü + lint + tüm testler
npm run mobile                           # Expo geliştirme sunucusu
npm run demo -- Galatasaray Fenerbahce   # bir maçın maç öncesi ve canlı oranları
npm run backtest                         # global model, lig bazlı model ve bahis piyasasını geçmiş maçlarda karşılaştırır
npm run build:data                       # apps/pipeline/public/ altına JSON üretir
npm run serve -w @oran/pipeline          # bu JSON'ları 8090 portunda sunar (uygulama geliştirmede buradan okur)
```

Uygulama veriyi `apps/mobile/.env` içindeki `EXPO_PUBLIC_DATA_BASE_URL` adresinden (GitHub Pages: https://omercnsz.github.io/oran-motoru) okur. Yerel veri sunucusuyla denemek için `.env.local` dosyasında bu değeri değiştirin. Kullanıcının kuponları ve kumbarası telefondaki SQLite veritabanında durur (`apps/mobile/src/db`); şema değişince `npx drizzle-kit generate` ile yeni göç dosyası üretilir.

## Veri akışı

| Veri | Kaynak | Nerede üretilir | Sıklık |
|---|---|---|---|
| Son 400 günün sonuçları → tek global takım güç modeli | ESPN (açık, anahtarsız) | `apps/pipeline` → GitHub Pages | saatte bir |
| Önümüzdeki 14 günün maçları + maç öncesi oranlar | ESPN + oran motoru | `apps/pipeline` → GitHub Pages | saatte bir |
| Canlı skor | ESPN, Cloudflare önbelleği üzerinden (ulaşılamazsa doğrudan) | `apps/worker`, `packages/live-sources` | Canlı ekrandayken 30 sn |
| Kupon sonuçları | ESPN (maç biter bitmez) + sonuç dosyaları | Telefonda | Ekran açıldıkça |
| Canlı oranlar | — | Telefonda, `odds-engine` ile | Anlık |

GitHub Pages çıktısı: `index.json`, `schedule.json`, `odds/<lig>.json`, `ratings/<lig>.json`, `results/<lig>.json` (biçimler `packages/contracts` içinde). `site/` klasöründeki sabit sayfalar da aynı siteye kopyalanır: gizlilik politikası https://omercnsz.github.io/oran-motoru/privacy.html (mağaza sayfalarında bu adres verilir).

## GitHub kurulumu

1. Repoyu GitHub'a gönderin.
2. **Settings → Pages → Source: GitHub Actions** seçin.
3. **Actions → Oranları güncelle → Run workflow** ile ilk yayını başlatın.

`ci.yml` her push'ta kontrolleri çalıştırır, `update.yml` saatte bir veriyi günceller.

## ESPN önbelleği (Cloudflare Worker)

Yayında: https://oran-canli.oran-worker.workers.dev

Telefonlar ESPN'e doğrudan değil Worker'a sorar: `GET /espn/<lig>/<YYYYMMDD | YYYYMM>`. Her Cloudflare noktası ESPN'e en fazla şu sıklıkla gider: dün/bugün/yarın 20 sn, ileri tarihler 5 dk, geçmiş 1 saat. Kullanıcı sayısı artsa da ESPN'e giden istek sayısı neredeyse sabit kalır. Sadece tanımlı liglere ve geçerli tarihlere yanıt verir. Yanıt, `packages/live-sources` ile işlenmiş `EspnEventsResponse` biçimindedir.

Uygulama adresi `apps/mobile/.env` içindeki `EXPO_PUBLIC_LIVE_URL` değerinden okur; Worker'a ulaşılamazsa ESPN'e doğrudan bağlanır.

Yayına alma (`apps/worker` içinde): `npx wrangler login` (bir kez), sonra `npm run deploy`. Canlı istek günlüğü: `npx wrangler tail oran-canli`.

## Diller ve yerelleştirme

27 dil: en, tr, es, pt, ar, ru, de, fr, it, nl, pl, ro, el, sr, hr, bs, sq, bg, mk, sl, zh, ja, ko, id, vi, th, hi (`apps/mobile/src/i18n/locales`).

- İngilizce ana dildir (`en.ts`). Diğer diller `Messages` tipine uymak zorunda: eksik ya da fazla anahtar derleme hatası verir. `apps/mobile/test/i18n.test.ts` her dilde yer tutucuların (`%{...}`) İngilizceyle aynı olduğunu denetler.
- **İngilizce ve Türkçe dışındaki çeviriler makine desteklidir; yayından önce ana dili konuşan biri kontrol etmeli.**
- Varsayılanlar cihazdan gelir, kullanıcı Ayarlar'dan değiştirir: dil, para birimi (her para birimi kendi kuruş basamağıyla), oran biçimi (ondalık / İngiliz kesirli / Amerikan), saat dilimi, ilk açılan lig, yardım hattı.
- Uygulamanın dilleri `app.json`'daki `expo-localization` eklentisinde (`supportedLocales`) listelenir (test, çeviri dosyalarıyla aynı olduğunu denetler). Telefonun dili Arapçaysa sağdan sola düzen ilk açılışta gelir; dil uygulama içinden değişince düzen, uygulama yeniden açıldığında değişir. Expo Go bunu uygulamaz, kendi derlemede çalışır.
- Yardım hatları `apps/mobile/src/i18n/index.ts` içindedir; yayından önce her numara doğrulanmalı.
- Lig seçicideki ülke ve kıta adları Unicode CLDR verisinden üretilir (`apps/mobile/src/i18n/regions.ts`); telefondaki JavaScript motoru bu veriyi içermez. Yeni bir ülkenin ligi ya da yeni bir dil eklenince `npm run regions -w @oran/mobile` çalıştırılır.

## Oyunlar (jetonla)

Kurallar: jeton satılmaz ve paraya çevrilmez; bitince ödüllü reklamla dolar (reklam yoksa yine dolar, kullanıcı cezalandırılmaz). Oyunların matematiği gerçek casinolarla aynıdır; aksi hâlde rapor yalan söyler ve sanal oyunda kazanan kullanıcı gerçek siteye dönebilir.

- **Crash** (`packages/games-math/src/crash.ts`): kasa avantajı %3 (geri dönüş %97). Patlama noktası tur başında işletim sisteminin güvenli rastgele sayısıyla belirlenir ve kaydedilir; oyuncu ne yaparsa yapsın beklenen getiri %97'dir (testler 10 milyon turla doğrular: `npm test -w @oran/games-math`). 1,00×'te çekilemez (anında patlamadan kaçmayı önler).
- **Rulet** (`packages/games-math/src/roulette.ts`): tek sıfırlı Avrupa ruleti, gerçek çark dizilimi. Her bahis n sayıyı kapsar ve kazanınca 36/n katı döner; bu yüzden her bahsin beklenen getirisi tam olarak 36/37 ≈ %97,30 (test 37 sonucun hepsini sayarak kesin doğrular, simülasyonlar 10 milyon dönüşle). Kazanan sayı dönüş başlamadan güvenli rastgele sayıyla belirlenip bahislerle birlikte kaydedilir; çark sadece onu gösterir. Her dönüşten sonra net sonuç yazar (bir bahis tutsa da toplamda kayıp olabilir) ve masa temizlenir: "aynı bahsi tekrarla" ya da "ikiye katla" yok.
- **Slot "Stadyum"** (`packages/games-math/src/slot.ts`): 5 makara × 3 sıra, 10 sabit çizgi, joker (kupa), altın top (3+ top: 10 bedava dönüş, kazançlar ×2) ve penaltı bonusu (1., 3. ve 5. makarada düdük; üç köşeden birini seç). Geri dönüş oranı ödeme tablosu ve şeritlerden **kesin olarak %95,03** hesaplanır (`slotMath`); 5 milyon turluk simülasyon bunu doğrular. Bedava dönüş yaklaşık 105, penaltı 498 dönüşte bir.
  - Dürüstlük: makaralar gerçek şeritlerdir, ekranda görünen şeridin kendisidir ("sanal makara" ile yapay kıl payı kaçırma yok); makaralar içerikten bağımsız aynı ritimle durur; penaltıda seçilmeyen köşelerin ödülleri de gösterilir; açılışta kazandırmayan nötr bir pencere gösterilir; "otomatik oyna" yok.
  - Turun tamamı (ana dönüş, bedava dönüşler, penaltı köşeleri) dönüş başında çekilip `game_rounds.detail` alanına kaydedilir; sonuç bundan yeniden hesaplanabilir.
  - Semboller özgün vektör çizimlerdir (marka ya da kulüp işareti yok). `npm run slot-symbols -w @oran/mobile` SVG ve PNG dosyalarını `apps/mobile/assets/slot` klasörüne üretir; `onizleme.png` hepsini bir arada gösterir.
- **Mines** (`packages/games-math/src/mines.ts`): 5×5 alan, 1–24 mayın. k güvenli kare açma olasılığı C(25−m, k) / C(25, k); çarpan (1 − %3) / bu olasılık, iki ondalığa aşağı yuvarlanmış. Böylece hangi anda çekilirse çekilsin beklenen getiri en fazla %97'dir (testler her mayın sayısı ve adım için kesin hesaplar, simülasyon doğrular). Mayınların yeri tur başında çekilip kaydedilir; seçilen kare sonucu değiştirmez. Ekranda her adımda sıradaki karenin güvenli olma ihtimali ve bütün güvenli kareleri açma ihtimali yazar; tur bitince bütün alan gösterilir. Hiç kare açmadan vazgeçilirse bahis iade edilir.
- **Plinko** (`packages/games-math/src/plinko.ts`): 8, 12 ya da 16 sıra, düşük ya da yüksek risk. Cep olasılığı binom (C(n, k) / 2ⁿ); altı tablonun her biri kesin olarak %96,9–97,0 geri döner. Topun yolu bırakılmadan önce çekilip kaydedilir, animasyon o yolu izler. Tek seferde tek top (seri atış yok). Ekranda atışların yüzde kaçında bahisten azının döndüğü (%55–85) ve her cebin olasılığı yazar; 1×'in altındaki cepler kırmızıdır.
- **Blackjack** (`packages/games-math/src/blackjack.ts`): 6 deste, her elden önce karılır; krupiye 17'de durur (yumuşak 17 dahil), açık kartı as ya da 10'luksa önce blackjack'e bakar. Blackjack 3:2, diğer kazançlar 1:1; ilk iki kartta ikiye katlama, çift bir kez bölünebilir (bölünen aslara birer kart), sigorta yok. Temel stratejiyle geri dönüş %99,6 (ilk bahse göre kasa avantajı %0,43; 100 milyon ellik simülasyon, testler 1 milyon elle doğrular). Deste el başında çekilip hamlelerle birlikte kaydedilir; `replayBlackjack` eli yeniden oynatır. Ekranda her hamlede temel stratejinin önerisi yazar.
- **Genel rapor** (`packages/betting/src/report.ts`, ekran `apps/mobile/src/app/rapor.tsx`): bu ay / geçen ay / tüm zamanlar için spor kuponları ve oyunlar bir arada. "Gerçek parayla oynasaydın" sonucu (oyunlarda jetonun para karşılığı Ayarlar'dan seçilir: 0,10 / 1 / 10 para birimi, varsayılan 1; raporda hep yazar), gün gün birikim grafiği, oyun başına gerçekleşen ve teorik geri dönüş oranı, oyunlarda geçen tahmini süre (aralarında 10 dakikadan az olan turlar bir oturum), aktif gün sayısı ve jetonun kaç kez bittiği. Kumbara sekmesi bu ayın özetini gösterir.
- Jetonlar yüzde birlik birimlerle tutulur (1 jeton = 100 birim); bahis tam jeton olduğu için ödemede yuvarlama gerekmez. Bakiye = 1.000 başlangıç jetonu + `token_events` toplamı; turlar `game_rounds` tablosunda.
- Her turda net sonuç (+/−) yazar; "hepsini bas" ve "otomatik oyna" yok; son turların yanında "her tur bağımsızdır" yazar. Sonuçlar kayıtlıdır, kıl payı efekti yok.
- Görünüm ve ses ("arena", `apps/mobile/src/components/arena`): oyunlar telefon açık modda olsa da koyu temada; neon yeşil, altın, cam paneller, kumarhane fişleri. Yazı tipleri Inter ve Unbounded (SIL OFL, `apps/mobile/assets/fonts`, derlemeye gömülü). Ödeme olan her tur kutlanır (ses, titreşim, para fıskiyesi; ödeme bahsin 2,5 ve 10 katını geçince büyük ve dev kutlama, afiş sadece bahisten fazlası dönünce). Bu, ürün sahibinin bilinçli tercihidir: bahisten azı dönen tur da kısa bir kutlama alır, ama net sonuç satırı ve rapor her zaman gerçek rakamı gösterir.
- Sesler kodla sentezlenir (`npm run sounds -w @oran/mobile` → `apps/mobile/assets/sounds`): efektler, kazanç fanfarları, crash motoru döngüsü ve oyunlarda çalan 32 saniyelik müzik. Telefon sessizdeyse çalmaz, başka uygulamanın müziğini durdurmaz. Ayarlar'da ses efektleri, müzik ve titreşim ayrı ayrı kapatılabilir.
- Gerçeklik uyarısı (`apps/mobile/src/hooks/use-reality-check.ts`, bütün oyunlarda ortak): oyun ekranında 15 dakikada bir (tur bitince) süre, tur sayısı ve net sonuç gösterilir. Oyunlar sekmesinde oyuncunun gerçekleşen geri dönüş oranı teorik değerle yan yana yazar.

## Bildirimler

- Kupondaki bir maç başlamadan 15 dakika önce hatırlatma gelir. Bildirimi telefon kendisi kurar (yerel bildirim, `apps/mobile/src/notifications.ts`); sunucu ve ücretli Apple hesabı gerekmez. Sadece kullanıcının kendi kuponları için; yeni bahse çağıran bildirim yok.
- İzin ilk kupon kaydedilince bir kez sorulur; Ayarlar'dan kapatılıp açılabilir.
- iOS: `expo-notifications` sunucudan bildirim (push) yetkisini her zaman ekler, bu yetkiyle uygulama ücretsiz Apple kimliğiyle kurulamaz. `apps/mobile/plugins/without-push-entitlement.js` onu siler; sunucudan bildirim eklenince bu eklenti kaldırılmalı.
- Android 14 ve üstünde tam zamanlı alarm izni varsayılan olarak kapalı; hatırlatma birkaç dakika gecikebilir. Başlıkta maçın saati yazdığı için gecikse de doğru kalır.

## Reklamlar (Google AdMob)

Kurallar (`apps/mobile/src/ads.ts`):
- Afiş sadece özet ekranlarında (Kuponlar, Kumbara). Maç, oran ve kupon ekranlarında, yani bahis kararı anında reklam yok.
- Sadece kişiselleştirilmemiş reklam istenir; iOS'ta izleme izni (ATT) sorulmaz. Bahis eğilimli kullanıcıların profillenmesini istemiyoruz.
- Uygulama, kullanıcının gerçek parayı kaybetmesinden asla kazanç sağlamaz: kumar, kripto ve kredi reklamları engellenir, uygulama içi satın alma yoktur.
- Ödüllü reklam, oyunlar (Faz 3) gelince jeton için kullanılacak.

Şu an Google'ın **test** kimlikleri kullanılıyor (örnek reklam, gelir yok). AdMob hesabı açılınca:
1. AdMob'da Android ve iOS uygulamalarını ekleyin; uygulama kimliklerini `apps/mobile/app.json` içindeki `react-native-google-mobile-ads` eklentisine yazın (`androidAppId`, `iosAppId`).
2. Birer afiş reklam birimi açın; kimliklerini `apps/mobile/.env` dosyasına `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` ve `EXPO_PUBLIC_ADMOB_BANNER_IOS` olarak ekleyin. Geliştirme derlemesinde her zaman test reklamı gösterilir.
3. **Engelleme denetimleri → Hassas kategoriler**: kumar ve bahis, kripto para ve kredi/borç kategorilerini engelleyin. Gizlilik politikası bunu taahhüt ediyor.
4. **Privacy & messaging**: AB/İngiltere için GDPR izin mesajını oluşturun. Uygulama izin formunu kendisi gösterir; Ayarlar'da "Reklam gizlilik tercihleri" bu ülkelerde görünür.
5. `app-ads.txt`: mağazada yazan geliştirici sitesinin kök adresinde olmalı (ör. `omercnsz.github.io/app-ads.txt`, bunun için ayrı bir `omercnsz.github.io` deposu gerekir).

## İkon ve açılış ekranı

Tasarım: futbol topu desenli bir madeni para kumbaranın yarığına düşüyor. Ölçüler ve renkler tek yerde, `apps/mobile/scripts/icons.mts` içinde. `npm run icons -w @oran/mobile` (macOS) şunları üretir: SVG kaynakları (`assets/brand`), iOS 26 ikonu (`assets/oran.icon`, Icon Composer biçimi), Android ve genel PNG'ler (`assets/images`). PNG'ler macOS'un kendi SVG işleyicisiyle çizilir, ek araç gerekmez. İkon değişince uygulamanın yerel derlemesi yeniden alınır.

## Uygulamanın kendi derlemesi (EAS)

Expo projesi: https://expo.dev/accounts/eco1453/projects/oran · paket kimliği `com.omercnsz.oran` (mağazaya ilk yüklemeden sonra değiştirilemez).

| Profil | Ne için |
|---|---|
| `development` | Geliştirme derlemesi, iOS simülatörü |
| `development-device` | Geliştirme derlemesi, gerçek cihaz (EAS ile iPhone için ücretli Apple geliştirici hesabı gerekir) |
| `preview` | Test için dağıtım; Android'de doğrudan kurulabilen APK |
| `production` | Mağaza sürümü |

```bash
cd apps/mobile
npx expo run:ios                                            # simülatör için bu bilgisayarda derle (ücretsiz)
npx expo run:ios --device                                   # kabloyla bağlı iPhone'a; ücretsiz Apple kimliğiyle olur, kurulum 7 gün geçerli
npx expo run:android                                        # emülatöre ya da USB ile bağlı Android telefona (ücretsiz)
npx eas-cli@latest build --profile preview --platform android   # bulutta Android APK
```

`ios/` ve `android/` klasörleri derleme sırasında `app.json`'dan üretilir; elle düzenlenmez ve git'e girmez.
