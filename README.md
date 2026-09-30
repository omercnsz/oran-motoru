# Oran

Kumar bağımlılığında zarar azaltma uygulaması: gerçek maçlara ve casino oyunlarına **sanal parayla** oynanır, yatırılmayan gerçek para kumbarada birikir. Veriler kullanıcının telefonunda kalır.

## Yapı

```
packages/
├── odds-engine   Oran motoru: takım güçleri, Poisson + Dixon-Coles, marketler, kasa payı, sonuçlandırma
├── teams         Farklı kaynaklardaki takım adlarını eşleştirme
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
npm run backtest                         # oran motorunu geçmiş maçlarda piyasayla karşılaştırır
npm run build:data                       # apps/pipeline/public/ altına JSON üretir
npm run serve -w @oran/pipeline          # bu JSON'ları 8090 portunda sunar (uygulama geliştirmede buradan okur)
```

Uygulama veriyi `apps/mobile/.env` içindeki `EXPO_PUBLIC_DATA_BASE_URL` adresinden (GitHub Pages: https://omercnsz.github.io/oran-motoru) okur. Yerel veri sunucusuyla denemek için `.env.local` dosyasında bu değeri değiştirin. Kullanıcının kuponları ve kumbarası telefondaki SQLite veritabanında durur (`apps/mobile/src/db`); şema değişince `npx drizzle-kit generate` ile yeni göç dosyası üretilir.

## Veri akışı

| Veri | Kaynak | Nerede üretilir | Sıklık |
|---|---|---|---|
| Geçmiş sonuçlar → takım güçleri | football-data.co.uk | `apps/pipeline` → GitHub Pages | saatte bir |
| Önümüzdeki 14 günün maçları + maç öncesi oranlar | ESPN (açık, anahtarsız) + oran motoru | `apps/pipeline` → GitHub Pages | saatte bir |
| Canlı skor | ESPN, Cloudflare önbelleği üzerinden (ulaşılamazsa doğrudan) | `apps/worker`, `packages/live-sources` | Canlı ekrandayken 30 sn |
| Kupon sonuçları | ESPN (maç biter bitmez) + football-data.co.uk (kesin) | Telefonda | Ekran açıldıkça |
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
