/**
 * Bundles the TypeScript modules under test into plain ESM so `node --test`
 * can import them, and does it twice — once plain, once minified.
 *
 * The minified copy is not redundant. `scrapeJobFromDocument` is handed to
 * `chrome.scripting.executeScript({ func })`, which serializes it with
 * `toString()` and evaluates the text in the page, where nothing from this
 * bundle exists. So any helper a minifier hoists OUT of the function body
 * becomes a free identifier that is resolvable in the extension and a
 * ReferenceError in the page — a failure that cannot be reproduced by calling
 * the function normally, only by round-tripping it through a string.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
export const OUT_DIR = resolve(root, '.test-build');

const ENTRIES = [
  { entry: 'src/jobScrape.ts', name: 'jobScrape' },
  { entry: 'src/sidepanel/downloadPayload.ts', name: 'downloadPayload' },
  { entry: 'src/jobMatch/localJobMatch.ts', name: 'localJobMatch' },
];

let built = false;

export async function buildFixtures() {
  if (built) return OUT_DIR;
  mkdirSync(OUT_DIR, { recursive: true });
  for (const { entry, name } of ENTRIES) {
    for (const minify of [false, true]) {
      await build({
        entryPoints: [resolve(root, entry)],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2020',
        minify,
        outfile: resolve(OUT_DIR, `${name}${minify ? '.min' : ''}.mjs`),
        logLevel: 'silent',
      });
    }
  }
  built = true;
  return OUT_DIR;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildFixtures();
  console.log('test fixtures built in', OUT_DIR);
}
