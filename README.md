# Oran

Kumar bağımlılığında zarar azaltma uygulaması: gerçek maçlara ve casino oyunlarına **sanal parayla** oynanır, yatırılmayan gerçek para kumbarada birikir. Veriler kullanıcının telefonunda kalır.

## Yapı

```
packages/
├── odds-engine   Oran motoru: takım güçleri, Poisson + Dixon-Coles, marketler, kasa payı, sonuçlandırma
├── leagues       Turnuvaların tek listesi (63 turnuva: ligler, kupalar, kıta kupaları)
├── teams         Farklı kaynaklardaki takım adlarını eşleştirme (geriye dönük testte kullanılır)
├── betting       Gölge kupon kuralları: doğrulama, sonuçlandırma, kumbara raporu
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

GitHub Pages çıktısı: `index.json`, `schedule.json`, `odds/<lig>.json`, `ratings/<lig>.json`, `results/<lig>.json` (biçimler `packages/contracts` içinde).

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
- Arapça için sağdan sola düzen `app.json`'daki `expo-localization` eklentisiyle açılır; Expo Go bunu uygulamaz, kendi derlemede (EAS) çalışır.
- Yardım hatları `apps/mobile/src/i18n/index.ts` içindedir; yayından önce her numara doğrulanmalı.

## Uygulamanın kendi derlemesi (EAS)

Expo projesi: https://expo.dev/accounts/eco1453/projects/oran · paket kimliği `com.omercnsz.oran` (mağazaya ilk yüklemeden sonra değiştirilemez).

| Profil | Ne için |
|---|---|
| `development` | Geliştirme derlemesi, iOS simülatörü |
| `development-device` | Geliştirme derlemesi, gerçek cihaz (Apple geliştirici hesabı gerekir) |
| `preview` | Test için dağıtım; Android'de doğrudan kurulabilen APK |
| `production` | Mağaza sürümü |

```bash
cd apps/mobile
npx expo run:ios                                            # simülatör için bu bilgisayarda derle
npx eas-cli@latest build --profile preview --platform android   # bulutta Android APK
```

`ios/` ve `android/` klasörleri derleme sırasında `app.json`'dan üretilir; elle düzenlenmez ve git'e girmez.
