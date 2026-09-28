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
└── worker        Cloudflare Worker: canlı skorlar → GET /live
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
| Canlı skor | ESPN, telefondan doğrudan | `packages/live-sources` | Canlı ekrandayken 30 sn |
| Canlı skor (yedek) | API-Football | `apps/worker` → Cloudflare | Dakikada bire kadar |
| Kupon sonuçları | ESPN (maç biter bitmez) + football-data.co.uk (kesin) | Telefonda | Ekran açıldıkça |
| Canlı oranlar | — | Telefonda, `odds-engine` ile | Anlık |

GitHub Pages çıktısı: `index.json`, `schedule.json`, `odds/<lig>.json`, `ratings/<lig>.json`, `results/<lig>.json` (biçimler `packages/contracts` içinde).

## GitHub kurulumu

1. Repoyu GitHub'a gönderin.
2. **Settings → Pages → Source: GitHub Actions** seçin.
3. **Actions → Oranları güncelle → Run workflow** ile ilk yayını başlatın.

`ci.yml` her push'ta kontrolleri çalıştırır, `update.yml` saatte bir veriyi günceller.

## Canlı skor servisi (Cloudflare Worker)

Sorgu sıklığı otomatik ayarlanır: canlı maç varsa `LIVE_INTERVAL_SEC`, yoksa `IDLE_INTERVAL_SEC`. Günlük istek limiti (`DAILY_LIMIT`) aşılmaz; kalan istekler güne yayılır. Ücretsiz pakette (günde 100 istek) bu yaklaşık 15 dakikada bir güncelleme demektir.

- `GET /live`: canlı maçlar (lig, dakika, skor, kırmızı kartlar, eşleşmiş takım adları)
- `GET /health`: son sorgu, günlük kullanım, son hata

Kurulum (`apps/worker` içinde):

```bash
npx wrangler login
npx wrangler kv namespace create LIVE      # çıkan id'yi wrangler.jsonc'deki BURAYA_KV_ID yerine yazın
npx wrangler secret put API_FOOTBALL_KEY
npm run deploy
```

`wrangler.jsonc` içindeki `DATA_BASE_URL` değerini GitHub Pages adresinizle değiştirin.
