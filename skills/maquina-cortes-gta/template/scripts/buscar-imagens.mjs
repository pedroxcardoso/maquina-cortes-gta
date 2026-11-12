#!/usr/bin/env node
// Busca imagens no Google (API oficial Custom Search) e baixa para uma pasta.
// Precisa de duas variáveis de ambiente suas (gratuito até 100 buscas por dia):
//   GOOGLE_API_KEY  chave da API (console.cloud.google.com > "Custom Search API")
//   GOOGLE_CSE_ID   id do mecanismo de pesquisa programável com "Pesquisar na web inteira" e "Pesquisa de imagens" ligados
// Uso: node scripts/buscar-imagens.mjs "GTA 6 mapa" <pasta_destino> [quantidade] [prefixo]
// Imprime os caminhos baixados (um por linha). Nunca imprime a chave.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const EXT = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'};

export async function searchImages(query, dest, n = 1, prefix = 'img') {
  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) throw new Error('Defina GOOGLE_API_KEY e GOOGLE_CSE_ID para buscar imagens no Google.');
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.search = new URLSearchParams({key, cx, q: query, searchType: 'image', num: String(Math.min(10, n * 3)), imgSize: 'large', safe: 'active'}).toString();
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Google respondeu HTTP ${r.status} (confira a chave, o id e a cota)`);
  const items = (await r.json()).items || [];
  fs.mkdirSync(dest, {recursive: true});
  const out = [];
  for (const it of items) {
    if (out.length >= n) break;
    try {
      const img = await fetch(it.link, {redirect: 'follow', signal: AbortSignal.timeout(15000), headers: {'User-Agent': 'Mozilla/5.0'}});
      const type = (img.headers.get('content-type') || '').split(';')[0].trim();
      if (!img.ok || !EXT[type]) continue;
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 20_000 || buf.length > 8_000_000) continue; // descarta ícones e arquivos enormes
      const file = path.join(dest, `${prefix}-${out.length + 1}${EXT[type]}`);
      fs.writeFileSync(file, buf);
      out.push(file);
    } catch {
      /* tenta a próxima */
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [query, dest, n, prefix] = process.argv.slice(2);
  if (!query || !dest) {
    console.error('Uso: node scripts/buscar-imagens.mjs "GTA 6 mapa" <pasta_destino> [quantidade] [prefixo]');
    process.exit(1);
  }
  searchImages(query, dest, Number(n || 1), prefix || 'img')
    .then((files) => {
      files.forEach((f) => console.log(f));
      process.exit(files.length ? 0 : 2);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
