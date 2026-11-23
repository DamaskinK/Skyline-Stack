// Builds the game into dist/: one bundled script, the stylesheet, the page and the asset folders (ADR 0001).
// Usage: npm install && npm run build, then npm run preview (static server on dist/).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

// "three" and "three/addons/..." resolve to the vendored copies, as the import map does in development.
const vendorThree = {
  name: 'vendor-three',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: resolve('vendor/three.module.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: resolve('vendor/addons', a.path.slice('three/addons/'.length)) }));
  },
};

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/css', { recursive: true });
const res = await build({
  entryPoints: ['js/main.ts'], resolveExtensions: ['.ts', '.js', '.mjs', '.json'], bundle: true, format: 'esm', minify: true, target: 'es2020', outfile: 'dist/game.js',
  plugins: [vendorThree], legalComments: 'none', write: true, metafile: true,
});
cpSync('css/style.css', 'dist/css/style.css');
cpSync('assets', 'dist/assets', { recursive: true });
cpSync('vendor/draco', 'dist/vendor/draco', { recursive: true });   // Draco decoder for GLB models
cpSync('CREDITS.md', 'dist/CREDITS.md');
const html = readFileSync('index.html', 'utf8')
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
  .replace('<script type="module" src="js/main.js"></script>', '<script type="module" src="game.js"></script>');
writeFileSync('dist/index.html', html);
const kb = Object.values(res.metafile.outputs).reduce((s, o) => s + o.bytes, 0) / 1024;
console.log(`built dist/ (${kb.toFixed(0)} KB of JS)`);
