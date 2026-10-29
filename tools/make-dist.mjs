// Assemble the folder that gets handed to other people, plus the fool-proof zip.
//
// The distributable is the plugin minus everything only the source repo needs:
// no client.src.js, no WAV masters, no manifests — the client half already
// carries the compressed tracks, the cue table and the whale inline.
//
//     node tools/make-dist.mjs
//
// Writes:
//   dist/dsh-opening-free-<version>/         the bundle folder (select this in DSH)
//   dist/安装.cmd                            a console helper: copies the path, lists the clicks
//   dist/安装说明.txt                        the same, readable without running anything
//   dist/dsh-opening-free-<version>.zip      folder + the two files above, ready to hand off
//
// The zip is built with Windows' Compress-Archive; on other platforms the
// folder is still produced and the zip step is skipped with a warning.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const distDir = join(repo, 'dist');
const pkgDir = join(repo, 'plugin', 'dsh-opening');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const folderName = pkg.name + '-' + pkg.version;
const outDir = join(distDir, folderName);
const zipPath = join(distDir, folderName + '.zip');
const installerPath = join(distDir, '安装.cmd');
const installTxtPath = join(distDir, '安装说明.txt');

const RUNTIME = ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg'];
const DOCS = [
  ['docs/40-manual-human.md', 'README.md'],
  ['docs/42-install.md', 'INSTALL.md'],
  ['docs/41-manual-ai.md', 'FOR-AI.md'],
  ['docs/43-sop.md', 'SOP.md'],
];

/* Keep dist/ holding exactly one version: drop older folders and zips. */
mkdirSync(distDir, { recursive: true });
for (const name of readdirSync(distDir)) {
  const stale = name.startsWith(pkg.name + '-') && name !== folderName && name !== folderName + '.zip';
  if (!stale) continue;
  try {
    rmSync(join(distDir, name), { recursive: true, force: true });
    console.log('removed old ' + name);
  } catch (error) {
    console.log('! could not remove old ' + name + ' (' + error.code + ') — delete it by hand');
  }
}

rmSync(outDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
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
  files: [...RUNTIME, 'locale/*.json', ...DOCS.map(([, to]) => to)],
};
writeFileSync(join(outDir, 'package.json'), JSON.stringify(shipped, null, 2) + '\n', 'utf8');

/* ---------- the fool-proof layer: two files next to the folder ---------- */

const cmd = [
  '@echo off',
  'chcp 65001 >nul',
  'title DSH 开机动画 · 安装向导',
  'setlocal',
  'set "DEST=%~dp0' + folderName + '"',
  'if not exist "%DEST%\\package.json" (',
  '  echo.',
  '  echo   [X] 没有找到 ' + folderName + ' 文件夹。',
  '  echo       请先把整个压缩包解压，再双击运行本文件。',
  '  echo.',
  '  pause',
  '  exit /b 1',
  ')',
  'echo.',
  'echo   ==================================================',
  'echo     DeepSeek Harness 开机动画 · 安装向导',
  'echo   ==================================================',
  'echo.',
  'echo   这个窗口只做两件事：把插件文件夹的路径放进剪贴板，',
  'echo   再把要点的位置写清楚。它不改动你电脑上的任何文件。',
  'echo.',
  'echo   插件文件夹：',
  'echo   %DEST%',
  'echo.',
  'echo   安装：',
  'echo     1. 打开 DSH 桌面版，点左下角「设置」→「插件」',
  'echo     2. 点「安装本地插件（bundle）」',
  'echo     3. 在文件选择窗口里按 Ctrl+L，粘贴路径（Ctrl+V），回车',
  'echo     4. 选中 ' + folderName + ' 文件夹，确认',
  'echo     5. 等它显示 applied，回到页面按 Ctrl+R 刷新',
  'echo.',
  'echo   路径已经复制到剪贴板，第 3 步直接粘贴即可。',
  '(echo|set /p="%DEST%")| clip',
  'echo.',
  'echo   装好之后：设置 →「开机动画」→ 选语言，或点四语连播试听。',
  'echo   不想要了：设置 → 插件 → dsh-opening-free → 卸载。',
  'echo.',
  'pause',
  '',
].join('\r\n');
writeFileSync(installerPath, cmd, 'utf8');

const txt = [
  'DSH 开机动画 · 安装说明',
  '',
  '插件文件夹：' + folderName,
  '',
  '安装（三步）：',
  '  1. 打开 DSH 桌面版，点左下角「设置」→「插件」。',
  '  2. 点「安装本地插件（bundle）」，选中 ' + folderName + ' 这个文件夹（是整个文件夹，不是 zip）。',
  '  3. 等它显示 applied，回到页面按 Ctrl+R 刷新。',
  '',
  '刷新后应当看到开机序列：一道蓝色数据流扫过，鲸鱼从光点里游出来，',
  '全息圆环旋转呼吸，最后浮出「欢迎回来，指挥员」。',
  '',
  '换语言 / 试听：设置 →「开机动画」。四张完整版 + 四张简版卡片；',
  '下面的 Preview 可以在这里直接连播四语（完整版约 72 秒，简版约 16 秒），',
  '点一下或按任意键跳到下一版。选卡片只改下次开机的语言，刷新后生效。',
  '',
  '跳过本次：序列播放时点一下鼠标或按任意键。',
  '不播放：系统开启「减少动态效果」时自动跳过。',
  '卸载：设置 → 插件 → dsh-opening-free → 卸载，刷新页面即恢复原样。',
  '',
  '更详细的排错见文件夹里的 INSTALL.md；给 AI 的操作手册是 SOP.md。',
  '',
].join('\r\n');
writeFileSync(installTxtPath, '\ufeff' + txt, 'utf8');

/* ---------- zip ---------- */
if (process.platform === 'win32') {
  const quote = (value) => "'" + String(value).replace(/'/g, "''") + "'";
  const script =
    'Compress-Archive -LiteralPath ' +
    [outDir, installerPath, installTxtPath].map(quote).join(',') +
    ' -DestinationPath ' + quote(zipPath) + ' -Force';
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    stdio: 'inherit',
  });
  console.log('zip     ' + (statSync(zipPath).size / 1024).toFixed(1) + ' KiB  ' + zipPath);
} else {
  console.log('! not Windows: zip step skipped (the folder is ready; zip it yourself)');
}

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
