// Builds the store-upload zip WITHOUT leaving dist/ unloadable.
//
// The store rejects a manifest that carries `key`, so it has to be stripped
// from the zip. It used to be stripped from dist/manifest.json in place and
// left that way — which silently changed the extension's ID the next time the
// unpacked dist/ was loaded, because Chrome derives the ID from `key` and
// falls back to a path hash without it. A different ID means a different
// chrome.identity.getRedirectURL(), so Google and LinkedIn sign-in both died
// with redirect_uri_mismatch until someone rebuilt.
//
// So: strip, zip, put the key back.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const MANIFEST = 'dist/manifest.json';
const version = process.env.npm_package_version;
if (!version) {
  console.error('npm_package_version is unset — run this via `npm run package`.');
  process.exit(1);
}
const zipName = `profileai-extension-v${version}.zip`;

const original = readFileSync(MANIFEST, 'utf8');
const manifest = JSON.parse(original);
const { key, ...withoutKey } = manifest;

try {
  writeFileSync(MANIFEST, JSON.stringify(withoutKey, null, 2));
  rmSync(zipName, { force: true }); // zip appends to an existing archive otherwise
  execFileSync('zip', ['-r', '-q', `../${zipName}`, '.', '-x', '*.DS_Store'], {
    cwd: 'dist',
    stdio: 'inherit',
  });
} finally {
  // Always restore, even if zipping failed — a half-packaged dist/ that loads
  // under the wrong ID is worse than no zip at all.
  writeFileSync(MANIFEST, original);
}

console.log(`Packaged ${zipName}${key ? ' (key stripped from the zip, restored in dist/)' : ''}`);
