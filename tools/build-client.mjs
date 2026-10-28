// Inline the boot track into the generated client bundle.
//
// Why: the client half has to play its own soundtrack. Asking the host for an
// HTTP route works only when the host actually exposes `webServer`, and the
// route turned out to be unreachable in this build, so the audio is carried in
// the bundle instead — the same move the reference splash plugin made.
//
// Edit `client.src.js`; run `node tools/build-client.mjs`; commit both.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, '..', 'plugin', 'dsh-opening');
const sourceFile = join(packageDir, 'client.src.js');
const trackFile = join(packageDir, 'assets', 'boot.wav');
const outputFile = join(packageDir, 'client.js');

const source = readFileSync(sourceFile, 'utf8');
const audio = readFileSync(trackFile);
const uri = 'data:audio/wav;base64,' + audio.toString('base64');

const banner = [
  '/* GENERATED FILE — edit client.src.js and run `node tools/build-client.mjs`. */',
  'window.__DSH_OPENING_TRACK__ = ' + JSON.stringify(uri) + ';',
  '',
].join('\n');

if (source.indexOf('window.__DSH_OPENING_TRACK__') < 0) {
  console.error('client.src.js never reads window.__DSH_OPENING_TRACK__; the inline track would be ignored.');
  process.exit(1);
}

writeFileSync(outputFile, banner + source, 'utf8');

const kib = (value) => (value / 1024).toFixed(1) + ' KiB';
console.log('track   ' + kib(audio.length) + ' -> ' + kib(uri.length) + ' as a data URI');
console.log('client  ' + kib(source.length) + ' -> ' + kib(banner.length + source.length));
console.log('wrote   ' + outputFile);
