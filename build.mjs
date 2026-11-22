// Bundles the game into one self-contained HTML file: dist/tower-bloxx-3d.html (works with a double-click, no server).
// Also writes dist/artifact.html, the same page without <html>/<body> wrappers, for publishing as a claude.ai artifact.
// Usage: npm install && npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const res = await build({
  entryPoints: ['js/main.js'], bundle: true, format: 'esm', minify: true, write: false, target: 'es2020',
  alias: { three: './vendor/three.module.js' }, legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('css/style.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const body = html.slice(html.indexOf('<!--BODY-->') + 11, html.indexOf('<!--/BODY-->')).trim();
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap">';

mkdirSync('dist', { recursive: true });
writeFileSync('dist/tower-bloxx-3d.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Tower Bloxx 3D</title>
${fonts}
<style>${css}</style>
</head>
<body>
${body}
<script type="module">${js}</script>
</body>
</html>
`);
writeFileSync('dist/artifact.html', `<title>Tower Bloxx 3D</title>
${fonts}
<style>${css}</style>
${body}
<script type="module">${js}</script>
`);
console.log(`built dist/tower-bloxx-3d.html (${(js.length / 1024).toFixed(0)} KB of JS)`);
