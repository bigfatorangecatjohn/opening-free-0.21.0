// Assemble the generated client half.
//
// Why the audio travels inside the bundle: the client half has to play its own
// soundtrack, and asking the host for an HTTP route turned out to be
// unreachable in this build, so the track, its timeline and the mark are all
// inlined here — the same move the reference splash plugin made.
//
// The track is one language per build:
//
//     node tools/build-client.mjs               # Chinese track (default)
//     node tools/build-client.mjs --lang en     # English track
//     node tools/build-client.mjs --lang ru     # Russian track
//
// Edit `client.src.js`; run this; commit both.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, '..', 'plugin', 'dsh-opening');
const assetsDir = join(packageDir, 'assets');
const sourceFile = join(packageDir, 'client.src.js');
const markFile = join(assetsDir, 'whale.png');
const outputFile = join(packageDir, 'client.js');

const argv = process.argv.slice(2);
const langFlag = argv.indexOf('--lang');
const lang = langFlag >= 0 ? argv[langFlag + 1] : 'zh';
if (!['zh', 'en', 'ru'].includes(lang)) {
  console.error('unknown --lang ' + lang + ' (expected zh, en or ru)');
  process.exit(1);
}

const trackFile = join(assetsDir, 'boot-' + lang + '.wav');
const cueFile = join(assetsDir, 'boot-' + lang + '.sequence.json');
for (const file of [sourceFile, trackFile, cueFile, markFile]) {
  if (!existsSync(file)) {
    console.error('missing input: ' + file);
    process.exit(1);
  }
}

const source = readFileSync(sourceFile, 'utf8');
const audio = readFileSync(trackFile);
const mark = readFileSync(markFile);
const manifest = JSON.parse(readFileSync(cueFile, 'utf8'));

// The client wants one shape, whatever the build script wrote.
const steps = manifest.cues
  .filter((cue) => cue.name.startsWith('step'))
  .map((cue) => ({ at: cue.at, end: cue.end, zh: cue.zh, en: cue.en }));
const salute = manifest.cues.find((cue) => cue.name === 'salute');
if (steps.length !== 5 || !salute) {
  console.error('manifest needs five step cues and one salute cue');
  process.exit(1);
}

const cue = {
  lang: manifest.lang,
  total: manifest.total,
  leadIn: manifest.leadIn,
  fadeOut: 0.52,
  steps,
  salute: { lang: salute.lang, at: salute.at, end: salute.end, text: salute.text },
};

const banner = [
  '/* GENERATED FILE — edit client.src.js and run `node tools/build-client.mjs`. */',
  'window.__DSH_OPENING_TRACK__ = ' + JSON.stringify('data:audio/wav;base64,' + audio.toString('base64')) + ';',
  'window.__DSH_OPENING_CUE__ = ' + JSON.stringify(cue) + ';',
  'window.__DSH_OPENING_MARK__ = ' + JSON.stringify('data:image/png;base64,' + mark.toString('base64')) + ';',
  '',
].join('\n');

for (const key of ['window.__DSH_OPENING_TRACK__', 'window.__DSH_OPENING_CUE__', 'window.__DSH_OPENING_MARK__']) {
  if (source.indexOf(key) < 0) {
    console.error('client.src.js never reads ' + key + '; the inline payload would be ignored.');
    process.exit(1);
  }
}

writeFileSync(outputFile, banner + source, 'utf8');

const kib = (value) => (value / 1024).toFixed(1) + ' KiB';
const total = banner.length + source.length;
console.log('lang    ' + lang + '  (' + manifest.total + ' s, mech ' + manifest.mech + ')');
console.log('track   ' + kib(audio.length) + ' -> inlined');
console.log('mark    ' + kib(mark.length) + ' -> inlined');
console.log('client  ' + kib(source.length) + ' -> ' + kib(total));
console.log('wrote   ' + outputFile);
