// Geliştirme için: public/ klasörünü GitHub Pages gibi sunar (uygulama yerelde buradan okur).
// Kullanım: npm run build:data && npm run serve -w @oran/pipeline
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'public');
const PORT = Number(process.env.PORT ?? 8090);

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  res.setHeader('access-control-allow-origin', '*');
  // Uygulamanın web sürümü COEP başlığı kullanıyor; kaynaklar arası okumaya izin ver
  res.setHeader('cross-origin-resource-policy', 'cross-origin');
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('bulunamadı');
  }
  console.log(`${res.statusCode} ${path}`);
}).listen(PORT, () => console.log(`Veri sunucusu: http://localhost:${PORT} → ${ROOT}`));
