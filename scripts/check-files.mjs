// Run before every push:  node scripts/check-files.mjs
// Lists files from MANIFEST.txt that are missing on your computer, so nothing is forgotten when copying a new version.
import { existsSync, readFileSync } from 'node:fs';

const list = readFileSync(new URL('../MANIFEST.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const missing = list.filter((p) => !existsSync(new URL(`../${p}`, import.meta.url)));
if (missing.length) {
  console.error(`\nMISSING ${missing.length} file(s). Copy them from the zip, keeping the same folder:\n`);
  for (const p of missing) console.error('  - ' + p);
  process.exit(1);
}
console.log(`OK: all ${list.length} files from MANIFEST.txt are present.`);
