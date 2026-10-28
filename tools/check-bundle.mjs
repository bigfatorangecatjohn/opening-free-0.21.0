#!/usr/bin/env node
/**
 * Pre-install gate for a DSH bundle directory.
 *
 *   node tools/check-bundle.mjs plugin/dsh-opening
 *
 * Checks only what can be checked without the host: manifest shape, every
 * export target resolving on disk, `files` coverage, locale metadata, icon
 * budget, patch row identity, the Client module id, and JS syntax. Exit code 0
 * means "safe to hand to plugin_manager install_bundle"; 1 means at least one
 * hard failure (printed with a ✗), 2 means usage error.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';

const dirArg = process.argv[2];
if (!dirArg) {
  console.error('usage: node tools/check-bundle.mjs <bundle-dir>');
  process.exit(2);
}
const root = resolve(dirArg);
const fail = [];
const warn = [];
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => {
  fail.push(m);
  console.log(`✗ ${m}`);
};
const soft = (m) => {
  warn.push(m);
  console.log(`! ${m}`);
};

const pkgPath = join(root, 'package.json');
if (!existsSync(pkgPath)) {
  bad(`no package.json in ${root}`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
ok(`package.json parses (${pkg.name}@${pkg.version})`);

/* ---------- 1. compatibility gate: a local bundle must declare no host range ---------- */
if ('engines' in pkg && 'dsh' in pkg.engines) bad('package.json declares engines.dsh — evaluatePluginCompatibility may skip this bundle');
const peers = Object.keys(pkg.peerDependencies ?? {}).filter((n) => n.startsWith('@deepseek-ai/'));
if (peers.length) bad(`peerDependencies on host packages: ${peers.join(', ')} — same gate`);
if (!peers.length && !(pkg.engines && pkg.engines.dsh)) ok('no engines.dsh / host peerDependencies (gate-safe)');

/* ---------- 2. bundle patch + client manifest ---------- */
const patchRel = pkg.dsh?.bundle?.patch;
if (!patchRel) bad('dsh.bundle.patch missing — plugin_manager has nothing to insert');
else if (!existsSync(join(root, patchRel))) bad(`dsh.bundle.patch points at a missing file: ${patchRel}`);
else {
  const yml = readFileSync(join(root, patchRel), 'utf8');
  ok(`patch present: ${patchRel}`);
  if (!yml.includes(`'${pkg.name}'`) && !yml.includes(`"${pkg.name}"`)) bad(`patch never mentions ${pkg.name}`);
  if (!/^\s*-?\s*id:\s*\S+/m.test(yml)) bad('patch has no row id');
}

const clientRel = pkg.exports?.['./client'];
if (pkg.dsh?.client) {
  if (!clientRel) bad('dsh.client declared but exports["./client"] missing');
  else if (!existsSync(join(root, clientRel))) bad(`exports["./client"] points at a missing file: ${clientRel}`);
  else {
    const src = readFileSync(join(root, clientRel), 'utf8');
    const id = /__ModuleLoader__\.load\(\s*\{\s*id:\s*['"]([^'"]+)['"]/.exec(src);
    if (!id) bad('client module does not call __ModuleLoader__.load({ id, factory })');
    else if (id[1] !== pkg.name) bad(`Client module id "${id[1]}" !== package name "${pkg.name}"`);
    else ok(`Client module id matches package name (${pkg.name})`);
    if (!/inject:\s*\[/.test(src)) soft('no `inject` service list found in the Client module — confirm it needs none');
    if (/document\.body\s*\.\s*appendChild/.test(src)) bad('Client module appends to document.body');
  }
  if (pkg.dsh.client.platform !== 'web') soft(`dsh.client.platform is "${pkg.dsh.client.platform}", expected "web"`);
}

/* ---------- 3. export targets resolve ---------- */
for (const [key, target] of Object.entries(pkg.exports ?? {})) {
  if (typeof target !== 'string') continue;
  if (target.includes('*')) {
    const dir = target.slice(0, target.lastIndexOf('/'));
    const ext = extname(target);
    const hits = existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((f) => extname(f) === ext) : [];
    if (!hits.length) bad(`exports["${key}"] → ${target} matches no file`);
    else ok(`exports["${key}"] → ${hits.length} file(s)`);
  } else if (!existsSync(join(root, target))) bad(`exports["${key}"] → ${target} does not exist`);
}

/* ---------- 4. locale metadata ---------- */
const localeDir = join(root, 'locale');
if (!existsSync(localeDir)) bad('no locale/ directory — the plugin manager has no title or description');
else {
  const files = readdirSync(localeDir).filter((f) => f.endsWith('.json'));
  if (!files.length) bad('locale/ holds no *.json');
  for (const f of files) {
    const meta = JSON.parse(readFileSync(join(localeDir, f), 'utf8')).meta ?? {};
    if (!meta.title || !meta.description) bad(`locale/${f} lacks meta.title or meta.description`);
    else ok(`locale/${f}: ${meta.title}`);
  }
}

/* ---------- 5. icon ---------- */
const iconRel = pkg.exports?.['./icon'] ?? pkg.icon;
if (!iconRel) soft('no icon export — the plugin list will show a placeholder');
else {
  const iconPath = join(root, iconRel);
  if (!existsSync(iconPath)) bad(`icon missing on disk: ${iconRel}`);
  else {
    const size = statSync(iconPath).size;
    const allowed = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
    if (!allowed.includes(extname(iconPath).toLowerCase())) bad(`icon extension not allowed: ${iconRel}`);
    else if (size > 256 * 1024) bad(`icon is ${size} B, over the 256 KiB budget`);
    else ok(`icon ${iconRel} (${size} B)`);
  }
}

/* ---------- 6. files coverage: every runtime file must ship ---------- */
const runtime = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'tools') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else runtime.push(relative(root, abs).split('\\').join('/'));
  }
})(root);
const patterns = (pkg.files ?? []).map((p) => {
  const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
});
if (!patterns.length) bad('package.json has no `files` list — everything would be swept in');
for (const f of runtime) {
  // npm always ships package.json, with or without a `files` entry.
  if (f === 'package.json') continue;
  if (!patterns.some((re) => re.test(f))) bad(`runtime file not covered by \`files\`: ${f}`);
}
if (!fail.length) ok(`files list covers all ${runtime.length - 1} runtime file(s)`);

/* ---------- 7. JS syntax ---------- */
for (const f of runtime.filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))) {
  try {
    // stdio must be inherited: the sandbox denies piped stdio (spawnSync EPERM),
    // and a syntax error still reaches the console because node writes it itself.
    execFileSync(process.execPath, ['--check', join(root, f)], { stdio: 'inherit' });
    ok(`syntax ${f}`);
  } catch {
    bad(`syntax ${f} (see the parser output above)`);
  }
}

console.log('');
if (fail.length) {
  console.log(`FAILED — ${fail.length} hard problem(s), ${warn.length} warning(s). Do not install yet.`);
  process.exit(1);
}
console.log(`PASS — ${warn.length} warning(s). Safe to pass to plugin_manager install_bundle.`);
