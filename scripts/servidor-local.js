// Servidor de teste local que imita o Vercel (páginas em public/ e rotas em api/).
// Usa um banco em memória: nada é gravado de verdade.
// Uso: ADMIN_EMAIL=voce@email.com ADMIN_SENHA_HASH=... npm run local
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.CT_BANCO_MEMORIA = process.env.CT_BANCO_MEMORIA || '1';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const porta = Number(process.env.PORT || 3000);
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const nome = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    const arq = path.join(raiz, 'api', nome + '.js');
    if (!fs.existsSync(arq)) { res.writeHead(404); return res.end('{}'); }
    let bruto = '';
    for await (const c of req) bruto += c;
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = bruto && /json/.test(req.headers['content-type'] || '') ? JSON.parse(bruto) : bruto; } catch (_) { req.body = bruto; }
    res.status = (s) => { res.statusCode = s; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    const mod = await import(pathToFileURL(arq).href);
    return mod.default(req, res);
  }
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!path.extname(p)) p += '.html';
  const arq = path.join(raiz, 'public', path.normalize(p));
  if (!arq.startsWith(path.join(raiz, 'public')) || !fs.existsSync(arq)) { res.writeHead(404); return res.end('Página não encontrada'); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
}).listen(porta, () => console.log('CT NORD local em http://localhost:' + porta));
