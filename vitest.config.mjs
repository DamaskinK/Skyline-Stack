// Vitest: modules keep `.js` import specifiers while files move to `.ts` (S0003); map a missing .js to its .ts twin.
import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const jsToTs = {
  name: 'js-to-ts',
  enforce: 'pre',
  resolveId(id, importer) {
    if (!importer || !id.startsWith('.') || !id.endsWith('.js')) return null;
    const js = resolve(dirname(importer), id);
    const ts = js.slice(0, -3) + '.ts';
    return !existsSync(js) && existsSync(ts) ? ts : null;
  },
};

export default defineConfig({ plugins: [jsToTs], test: { include: ['tests/core/**/*.test.{js,ts}'] } });
