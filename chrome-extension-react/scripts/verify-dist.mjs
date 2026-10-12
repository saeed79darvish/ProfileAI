/**
 * Post-build checks that fail the build rather than the user's browser.
 *
 * The one that matters: `dist/content.js` must be a self-contained classic
 * script. MV3 content scripts have no module loader, so a single `import` at
 * the top throws `Cannot use import statement outside a module` before the
 * first statement runs — the content script dies on every page, and the
 * extension looks merely broken rather than broken for a reason. That happened
 * the moment the content script and the background worker shared a module:
 * Rollup hoisted the shared code into `assets/` and emitted an import.
 *
 * It is cheap to check and expensive to discover in the wild, so it is checked
 * on every build.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

const failures = [];

function check(name, fn) {
  try {
    const problem = fn();
    if (problem) failures.push(`${name}: ${problem}`);
  } catch (err) {
    failures.push(`${name}: threw ${err.message}`);
  }
}

check('content.js exists', () =>
  existsSync(resolve(dist, 'content.js')) ? null : 'missing — did the content build run?'
);

check('content.js is a self-contained classic script', () => {
  const file = resolve(dist, 'content.js');
  if (!existsSync(file)) return null; // already reported
  const src = readFileSync(file, 'utf8');
  // Static import/export at the top level of the bundle. Matching on the
  // bundle's own first-line shape rather than parsing: the IIFE build emits
  // `(function(){...})()` and nothing else at top level.
  const topLevelImport = /(^|\n)\s*import[\s{*'"]/.test(src);
  const topLevelExport = /(^|\n)\s*export[\s{*]/.test(src);
  if (topLevelImport) return 'contains a top-level `import` — it will throw on every page';
  if (topLevelExport) return 'contains a top-level `export` — it will throw on every page';
  if (!src.trimStart().startsWith('(function(')) {
    return 'does not look like an IIFE bundle — check vite.content.config.ts';
  }
  return null;
});

check('the job scraper is inlined into both bundles', () => {
  // A marker only the shared scraper contains. If it is missing from either
  // bundle, that side is no longer running the shared code.
  const marker = 'decorated-job-posting__details';
  const missing = ['content.js', 'background.js'].filter((name) => {
    const file = resolve(dist, name);
    return !existsSync(file) || !readFileSync(file, 'utf8').includes(marker);
  });
  return missing.length ? `scraper missing from ${missing.join(', ')}` : null;
});

check('manifest entry points all exist', () => {
  const manifestPath = resolve(dist, 'manifest.json');
  if (!existsSync(manifestPath)) return 'dist/manifest.json missing';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const expected = [manifest.background?.service_worker].filter(Boolean);
  for (const entry of manifest.content_scripts || []) {
    expected.push(...(entry.js || []), ...(entry.css || []));
  }
  const missing = expected.filter((rel) => !existsSync(resolve(dist, rel)));
  return missing.length ? `referenced but not built: ${missing.join(', ')}` : null;
});

if (failures.length) {
  console.error('\n✗ dist verification failed:\n' + failures.map((f) => `  - ${f}`).join('\n') + '\n');
  process.exit(1);
}
console.log('✓ dist verified: content.js self-contained, scraper inlined in both bundles');
