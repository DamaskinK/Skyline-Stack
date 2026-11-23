// Tiny static server for development and for checking the build. Sends no-cache headers so edits show on reload.
// Files under js/ may be .ts: a request for x.js with only x.ts on disk (or a .ts request) is compiled on the fly by esbuild
// (types stripped, one file per request, no bundling), so the browser keeps loading plain ES modules and the import map.
// Usage: node scripts/serve.mjs [dir=.] [port=8000]
import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || '.'), port = Number(process.argv[3] || 8000);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream', '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400, { 'Content-Type': 'text/plain' }).end('bad request'); return; }
  let file = normalize(join(root, url));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  if (/\.js$/.test(file)) { try { statSync(file); } catch { const ts = file.slice(0, -3) + '.ts'; try { statSync(ts); file = ts; } catch { /* 404 below */ } } }
  try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); statSync(file); }
  catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
  if (file.endsWith('.ts')) {
    try {
      const out = transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'esm', target: 'es2022', sourcemap: 'inline', sourcefile: url });
      res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }).end(out.code);
    } catch (e) { res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(e.message || e)); }
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log(`Port ${port} is already in use: the game is probably already served at http://localhost:${port}`); process.exit(0); }
  throw e;
}).listen(port, () => console.log(`serving ${root} at http://localhost:${port}`));
