// Generate frontend/public/og-image.png from og-image.svg.
// Run: node scripts/generate-og-image.mjs
// Requires `sharp` (dev dep). Re-run whenever the SVG changes.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svgPath = join(publicDir, 'og-image.svg');
const pngPath = join(publicDir, 'og-image.png');

const svg = await readFile(svgPath);
const png = await sharp(svg, { density: 192 })
  .resize(1200, 630, { fit: 'cover' })
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(pngPath, png);
console.log(`Wrote ${pngPath} (${png.length} bytes)`);
