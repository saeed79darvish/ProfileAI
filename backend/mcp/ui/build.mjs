/**
 * Build the self-contained MCP App widget.
 *
 * Bundles cards.jsx (React) into a single IIFE and inlines it into
 * template.html, producing dist/cards.html — which is COMMITTED so the
 * backend serves it at runtime with no build step or dependency on esbuild.
 *
 * Run from the repo (esbuild + react resolve from frontend/node_modules):
 *   NODE_PATH="$(pwd)/frontend/node_modules" \
 *     node backend/mcp/ui/build.mjs
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [join(here, 'widget', 'cards.jsx')],
  bundle: true,
  format: 'iife',
  minify: true,
  jsx: 'automatic',
  target: ['es2019'],
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

const js = result.outputFiles[0].text;
const template = readFileSync(join(here, 'template.html'), 'utf8');
const html = template.replace('/*__BUNDLE__*/', () => js);

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'cards.html'), html, 'utf8');

console.log(`✓ built dist/cards.html (${(html.length / 1024).toFixed(1)} KB)`);
