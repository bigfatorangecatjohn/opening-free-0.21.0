// Assemble the generated client half.
//
// Why the audio travels inside the bundle: the client half has to play its own
// soundtrack, and asking the host for an HTTP route turned out to be
// unreachable in this build, so the tracks, their timelines and the mark are
// all inlined here — the same move the reference splash plugin made.
//
// All three language tracks ship together; the client plays one per page load,
// cycling zh -> en -> ru, so every version can be seen without a rebuild.
//
//     node tools/build-client.mjs            # bundle zh, en and ru (default)
//     node tools/build-client.mjs --langs zh # bundle one language only
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
const langFlag = argv.indexOf('--langs');
const BASE_LANGS = ['zh', 'en', 'ru', 'ja'];
const ALL_KEYS = BASE_LANGS.concat(BASE_LANGS.map((lang) => lang + '-short'));
const langs = (langFlag >= 0 ? argv[langFlag + 1] : ALL_KEYS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
// Demo takes need one language to win over the stored preference; the flag
// writes that choice into the generated header and nothing else changes.
const forceFlag = argv.indexOf('--force');
const forced = forceFlag >= 0 ? String(argv[forceFlag + 1] || '').trim() : '';
if (forced && !ALL_KEYS.includes(forced)) {
  console.error('unknown --force language ' + forced);
  process.exit(1);
}

for (const lang of langs) {
  if (!ALL_KEYS.includes(lang)) {
    console.error('unknown key ' + lang + ' (expected one of ' + ALL_KEYS.join(', ') + ')');
    process.exit(1);
  }
}

const source = readFileSync(sourceFile, 'utf8');
const mark = readFileSync(markFile);
if (!existsSync(markFile)) {
  console.error('missing input: ' + markFile);
  process.exit(1);
}

/** One {lang, track, cue} entry per requested language. */
function buildEntry(key) {
  const short = key.endsWith('-short');
  const lang = short ? key.slice(0, -6) : key;
  const suffix = short ? '-short' : '';
  // Prefer the compressed master: the same 18 s track is ~85 KB as Vorbis
  // against ~844 KB as WAV, and this audio is inlined into the client.
  const candidates = [
    { file: join(assetsDir, 'boot-' + lang + suffix + '.ogg'), mime: 'audio/ogg' },
    { file: join(assetsDir, 'boot-' + lang + suffix + '.wav'), mime: 'audio/wav' },
  ];
  const cueFile = join(assetsDir, 'boot-' + lang + suffix + '.sequence.json');
  const picked = candidates.find((candidate) => existsSync(candidate.file));
  if (!picked) {
    console.error('missing input: ' + candidates.map((candidate) => candidate.file).join(' or '));
    process.exit(1);
  }
  if (!existsSync(cueFile)) {
    console.error('missing input: ' + cueFile);
    process.exit(1);
  }
  const audio = readFileSync(picked.file);
  const manifest = JSON.parse(readFileSync(cueFile, 'utf8'));
  const steps = manifest.cues
    .filter((cue) => cue.name.startsWith('step'))
    .map((cue) => ({ at: cue.at, end: cue.end, text: cue.text }));
  const salute = manifest.cues.find((cue) => cue.name === 'salute');
  if (steps.length !== (short ? 0 : 5) || !salute) {
    console.error(key + ': manifest needs ' + (short ? 'no step cues' : 'five step cues') + ' and one salute cue');
    process.exit(1);
  }
  if (steps.some((step) => !step.text || !step.text.zh)) {
    console.error(lang + ': step cues need the multi-lingual `text` map');
    process.exit(1);
  }
  return {
    key,
    audio,
    entry: {
      key,
      lang,
      track: 'data:' + picked.mime + ';base64,' + audio.toString('base64'),
      cue: {
        lang: manifest.lang,
        short,
        total: manifest.total,
        leadIn: manifest.leadIn,
        fadeOut: 0.52,
        mark: manifest.mark,
        steps,
        salute: { lang: salute.lang, at: salute.at, end: salute.end, text: salute.text, lines: salute.lines || null },
      },
    },
  };
}

const built = langs.map(buildEntry);

const banner = [
  '/* GENERATED FILE — edit client.src.js and run `node tools/build-client.mjs`. */',
  'window.__DSH_OPENING_SET__ = ' + JSON.stringify(built.map((item) => item.entry)) + ';',
  'window.__DSH_OPENING_MARK__ = ' + JSON.stringify('data:image/png;base64,' + mark.toString('base64')) + ';',
  forced ? 'window.__DSH_OPENING_FORCE_LANG__ = ' + JSON.stringify(forced) + ';' : '',
  '',
]
  .filter((line, index, all) => !(line === '' && index === all.length - 2 && !forced))
  .join('\n');

const keys = ['window.__DSH_OPENING_SET__', 'window.__DSH_OPENING_MARK__'];
if (forced) keys.push('window.__DSH_OPENING_FORCE_LANG__');
for (const key of keys) {
  if (source.indexOf(key) < 0) {
    console.error('client.src.js never reads ' + key + '; the inline payload would be ignored.');
    process.exit(1);
  }
}

writeFileSync(outputFile, banner + source, 'utf8');

const kib = (value) => (value / 1024).toFixed(1) + ' KiB';
const totalBytes = Buffer.byteLength(banner + source, 'utf8');
console.log('modes   ' + built.map((item) => item.key).join(', ') + (forced ? '  (forced ' + forced + ')' : ''));
for (const item of built) {
  console.log('track   ' + item.key.padEnd(10) + '  ' + kib(item.audio.length) + ' -> inlined');
}
console.log('mark    ' + kib(mark.length) + ' -> inlined');
console.log('client  ' + kib(totalBytes) + ' (source ' + kib(Buffer.byteLength(source, 'utf8')) + ')');
console.log('wrote   ' + outputFile);
