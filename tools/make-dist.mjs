// Assemble the folder that gets handed to other people.
//
// The distributable is the plugin minus everything only the source repo needs:
// no `client.src.js`, no WAV masters, no manifests — the client half already
// carries the compressed tracks, the cue table and the whale inline.
//
//     node tools/make-dist.mjs
//
// Then zip dist/dsh-opening-free-0.1.0.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const pkgDir = join(repo, 'plugin', 'dsh-opening');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const outDir = join(repo, 'dist', pkg.name + '-' + pkg.version);

const RUNTIME = ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg'];
const DOCS = [
  ['docs/40-manual-human.md', 'README.md'],
  ['docs/42-install.md', 'INSTALL.md'],
  ['docs/41-manual-ai.md', 'FOR-AI.md'],
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const name of RUNTIME) {
  const from = join(pkgDir, name);
  if (!existsSync(from)) {
    console.error('missing runtime file: ' + from);
    process.exit(1);
  }
  cpSync(from, join(outDir, name));
}
cpSync(join(pkgDir, 'locale'), join(outDir, 'locale'), { recursive: true });

for (const [from, to] of DOCS) {
  const source = join(repo, from);
  if (!existsSync(source)) {
    console.error('missing doc: ' + source);
    process.exit(1);
  }
  cpSync(source, join(outDir, to));
}

// The shipped manifest describes only what ships.
const shipped = {
  ...pkg,
  files: [...RUNTIME, 'locale/*.json', 'README.md', 'INSTALL.md', 'FOR-AI.md'],
};
writeFileSync(join(outDir, 'package.json'), JSON.stringify(shipped, null, 2) + '\n', 'utf8');

const kib = (value) => (value / 1024).toFixed(1) + ' KiB';
function total(dir) {
  return readdirSync(dir).reduce((sum, name) => {
    const path = join(dir, name);
    return sum + (statSync(path).isDirectory() ? total(path) : statSync(path).size);
  }, 0);
}

console.log('package ' + pkg.name + '@' + pkg.version);
for (const name of readdirSync(outDir).sort()) {
  const path = join(outDir, name);
  const size = statSync(path).isDirectory() ? total(path) : statSync(path).size;
  console.log('  ' + name.padEnd(18) + kib(size));
}
console.log('total   ' + kib(total(outDir)));
console.log('wrote   ' + outDir);
