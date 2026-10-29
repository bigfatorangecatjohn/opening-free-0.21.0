# 开机动画 Free — SOP（给 AI 的操作手册）

四条主流程：**改视觉**、**改音频**、**装机**、**出包**。每条都写了命令与完成判据。
先读 `AGENTS.md`（工作区规则）与 `HANDOFF.md`（本次交接），再动手。

---

## 0. 环境（一次记住，不要重新勘察）

| 项 | 值 |
|---|---|
| 工作区 | `D:\DSH\Opening Design`（git 分支 `master`） |
| 运行包 | `plugin/dsh-opening`（profile 里以 Junction 指过来） |
| profile | `C:\Users\<你>\.dsh\profiles\desktop` |
| Junction | `<profile>\node_modules\dsh-opening-free` → `D:\DSH\Opening Design\plugin\dsh-opening` |
| Python | `.venv-tts\Scripts\python.exe`（不要用系统 python） |
| ffmpeg | `.tmp\ffmpeg\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe` |
| 参考鲸鸣 | 本机工作区根目录的 `【4K】你听过鲸歌吗？ P2 无bgm版本_544631700.aac`（版权归原片，**不入库**；仓库里只有衍生片段 `samples/boot/whale-call-src.wav` 与 `assets/boot-*.ogg`，换采样才需要原片） |
| 装前门禁 | `node tools\check-bundle.mjs <bundle-dir>`，必须 `PASS — 0 warning(s)` |

硬规则：只改 `client.src.js` 再构建；不手改 `client.js`；不新增运行时依赖；不碰 profile 的 `.npmrc` 与业务文件；视觉验证只在用户已登录的页面上做。

---

## 1. 改视觉（画布、排版、动效）

1. 改 `plugin/dsh-opening/client.src.js`。
   - 画布逻辑在 `makeCyberScene(canvas, phase)`：`resize()` 与 `frame(t)`。
   - 文案/进度/设置页在 `Cyber` 与 `SettingsPage`。
   - 颜色常量在 `PALETTE`；浅纸底上不要用 `lighter` 合成（白底叠光看不见），用蓝墨实色。
2. 语法自检：`node --check plugin\dsh-opening\client.src.js`
3. 构建：`node tools\build-client.mjs` → 应打印 8 条 `-> inlined` 与 `client <n> KiB`。
4. 门禁：`node tools\check-bundle.mjs plugin\dsh-opening` → `PASS`。
5. 让用户 **Ctrl+R** 刷新页面验收（Junction 直接生效，不需要装包）。

**完成判据**：门禁 PASS；banner 里 8 条 cue 的 `total/phases/salute` 与预期一致；用户在真页面确认。

> 时间轴不要写死在组件里：读 `CUE.phases`（`phaseOf` 已兜底）与 `CUE.total/fadeOut`。新增视觉节拍时优先由 `phases` 驱动。
>
> 改问候排版后抽一帧量间隙：「环底 → 欢迎回来」中文/日文目标约 38 px、两行字形间隙约 30 px（1880×1480 成片）；en/ru 更松，是设计差异不是 bug。位置由 `place()` 的 `cjkSalute` 分支（`reserve 54` / `drop min(unit*0.02,22)`）与 `.is-zh/.is-ja` CSS 共同决定。

---

## 2. 改音频

### 2.1 换鲸鸣采样

```powershell
.venv-tts\Scripts\python.exe tools\make-whale-call.py
```

- 常量在脚本顶部：`START = 1.50`、`LENGTH = 1.45`（从 aac 的 1.50–2.95 s 切）；带通 110–3000 Hz，峰值归一到 0.9。
- 输出 `samples/boot/whale-call-src.wav`，`build-boot-track.py` 的 `whale_call()` 会读它。

### 2.2 改台词 / 语速 / 机械感

- 台词：`tools/make-samples.py` 的 `LINES`（每语 6 句：5 步 + 收尾；收尾用逗号拆成 lead/name 两段）。
- 语速：`build-boot-track.py` 的 `speed` 字典或 `--speed-<lang>`。
- 机械感：`--mech`（当前 `0.6`，越低越像自然人声）。
- 简版时长：`SHORT_MIN_TOTAL=3.80`、`SHORT_MAX_TOTAL=4.55`、`SHORT_SALUTE_AT=1.62`、`SHORT_TAIL_S=0.30`——**四条语言的 salute 必须同拍**，改之前想清楚。

### 2.3 重渲一条母带

```powershell
# 简版
.venv-tts\Scripts\python.exe tools\build-boot-track.py --lang zh --short --out plugin\dsh-opening\assets\boot-zh-short.wav
# 完整版
.venv-tts\Scripts\python.exe tools\build-boot-track.py --lang zh --mech 0.6 --out plugin\dsh-opening\assets\boot-zh.wav
```

脚本会同时写 `boot-<key>.sequence.json`（时间轴真源）。**必须检查**打印：

- 简版 `total` 应在 3.80–4.55，`salute` 应为 1.62；
- 完整版 `total` 应为 `18.00`，否则说明台词超长、间隔被压到 0.35 下限；
- 若打印 `over budget, tightening the lead`，说明该语言台词太长，简版正在牺牲鲸鱼入画时间。

### 2.4 压缩 + 回拷 + 构建

```powershell
.venv-tts\Scripts\python.exe tools\encode-tracks.py
Copy-Item plugin\dsh-opening\assets\boot-*.wav,plugin\dsh-opening\assets\boot-*.sequence.json samples\boot\ -Force
node tools\build-client.mjs
node tools\check-bundle.mjs plugin\dsh-opening
```

**完成判据**：ogg 体积合理（完整版 80–100 KiB、简版 20–30 KiB）；banner 里对应 key 的 `total` 与 `sequence.json` 一致；门禁 PASS。

---

## 3. 改时间轴 / 文案

- 步骤与收尾文案：`tools/build-boot-track.py` 的 `DISPLAY_STEPS`、`DISPLAY_SALUTE`，改完重渲母带（§2.3）。
- 简版 phases 由 `build_short()` 写入：`sweep[0,0.52] / burst 0.52 / whale[0.58,2.03] / rings 1.06 / salute / name`。
- 完整版 phases 写在 `main()` 的 manifest 段：`sweep[0,0.78] / burst 0.78 / whale[0.80,2.35] / rings 1.95 / burstPower 0.35`。
- **不要手改 `client.js`**；要改 `sequence.json` 也先想清楚它是否该由生成器写。

**判据**：`client.js` 第 2 行 banner 解出的 cue 与 `sequence.json` 一致；视觉节拍没有错位。

---

## 4. 加一种新语言

六处必须同时改，漏一处就静默失败：

1. `tools/make-samples.py` 的 `LINES`（6 句 + slug + voice）
2. `tools/build-boot-track.py` 的 `TOP_HZ`、`DISPLAY_STEPS`、`DISPLAY_SALUTE`、`speed`、`main()` 的 `--lang choices`
3. `plugin/dsh-opening/client.src.js` 的 `LANGS`、`BADGE`、`PROTOCOL`、`CAPTION`、`CHOICES`、`LANG_TRACK`
4. `tools/build-client.mjs` 的 `BASE_LANGS` / `ALL_KEYS`
5. `plugin/dsh-opening/assets` 下新增 `boot-<lang>.wav/.ogg/.sequence.json` 与 `-short` 三件套
6. `docs/40`、`docs/41`、`README.md` 的模式表

**判据**：`build-client.mjs` 打印 `8 + 2` 条 inlined；门禁 PASS；新语言的 salute 落在 1.62（简版）。

---

## 5. 装机

### 5.1 本机开发（Junction，已是现状）

1. 确认 Junction 还在：
   ```powershell
   Get-Item "C:\Users\<你>\.dsh\profiles\desktop\node_modules\dsh-opening-free" | Select-Object LinkType,Target
   ```
2. 改完 `client.js` 让用户 **Ctrl+R**。

### 5.2 分发给别人

1. `node tools\make-dist.mjs`（§7）。
2. 把 zip 传到 GitHub Release（`gh release upload v<版本> dist\dsh-opening-free-0.21.0.zip`），把 Release 链接给对方——`dist/` 已被 `.gitignore` 排除，不要提交；对方解压、双击 `安装.cmd`、按 §5.3 操作。
3. 不想用 `安装.cmd` 也可以直接读 `安装说明.txt`。

### 5.3 宿主侧安装（人操作）

设置 → 插件 → 安装本地插件（bundle）→ 选中 `dsh-opening-free-0.21.0` **文件夹** → 等 `applied` → Ctrl+R。

**判据**：宿主行 `application: applied`；`shell.overlay` 的 occupants 出现 `dsh-opening-free`（order -1000）；刷新后序列播完不留 DOM。

> 有 `plugin_manager` 工具时可用 `action=install_bundle, target=<包目录绝对路径>` 代替手动点击；没有就按上面走 GUI。

---

## 6. 验证

1. **源目录门禁**：`node tools\check-bundle.mjs plugin/dsh-opening` → PASS 12 项。
2. **dist 门禁**：`node tools\check-bundle.mjs dist/dsh-opening-free-0.21.0` → PASS。
3. **时间轴**：解 banner：
   ```powershell
   node -e "const fs=require('fs');const line=fs.readFileSync('plugin/dsh-opening/client.js','utf8').split('\n')[1];const set=JSON.parse(line.match(/__DSH_OPENING_SET__ = (\[.*\]);/)[1]);for(const e of set)console.log(e.key, e.cue.total, e.cue.salute&&e.cue.salute.at, e.cue.phases&&e.cue.phases.name);"
   ```
4. **队列/组件**：`.tmp/full-check.cjs`（stub React + vm 加载 `client.js`，执行组件函数并 walk 树）核对步骤条数、salute/name、四版队列顺序。
5. **真机**：只能让用户在已登录页面 Ctrl+R 看。不另起浏览器、不截 mock 页。

---

## 7. 出包（傻瓜封包）

```powershell
node tools\make-dist.mjs
```

产出：

```
dist/
  dsh-opening-free-0.21.0/          安装时选这个文件夹
    package.json  cordis.patch.yml  index.js  client.js  icon.svg
    locale/  README.md  INSTALL.md  FOR-AI.md  SOP.md
  安装.cmd                         双击：复制路径 + 打印步骤（不改文件）
  安装说明.txt                     同样的说明，纯文本
  dsh-opening-free-0.21.0.zip       上面三者打包，交给别人
```

zip 走 GitHub Release，不进仓库（`dist/` 已 gitignore）。Release 同时挂四语完整版演示片（`demo\master-dsh-opening-demo.mp4`，1880×1480，约 14.5 MiB）。

**判据**：

1. `node tools\check-bundle.mjs dist/dsh-opening-free-0.21.0` → PASS。
2. zip 体积约 1 MiB（`client.js` 约 900 KiB 占大头）。
3. 解压到一个干净目录，双击 `安装.cmd`，确认它能找到文件夹并把路径写进剪贴板。
4. 把 zip 里的 `dsh-opening-free-0.21.0` 当成全新包走一遍 §5.3（可选，最稳）。

---

## 8. 排错表

| 症状 | 真因 | 处理 |
|---|---|---|
| `✗ runtime file not covered by files` | 新文件没进 `files` | 补 `package.json.files`（dist 由 make-dist 自动补） |
| `✗ patch never mentions <name>` | patch 里包名没带引号 | 写 `name: 'dsh-opening-free'` |
| 装了但画面没变 | 浏览器还跑旧模块 | 让用户刷新；HMR 不替换已注册客户端模块 |
| 预览被设置弹窗盖住 | `shell.overlay` 在宿主弹窗下面 | 预览必须走 `ReactDOM.createPortal` 到 body（现状已如此） |
| 时间轴错位 / 鲸鱼钉住 | `sequence.json` 缺 `phases` | 简版必须带 `phases`，`build-client` 会硬报错 |
| `spawnSync ... EPERM` | 沙箱不允许子进程开管道 | 子进程用 `stdio: 'inherit'` |
| 删除 dist/文件失败 | 工作区 ACL 有 `DENY(DC)` | 用 node `fs.rmSync` 先试；仍失败就报告用户，不要换路径绕过 |
| 沙箱 `pwsh` 管道提前截断 | `... | Select-Object -First N` 会掐上游 | 先跑完再筛 |
| 播放没声音 | 浏览器自动播放策略 | 已 catch 成静音继续；让用户点一下页面再刷新 |
| 录屏报 `could not raise the DSH window` | 前台被别的窗口抢走 | 把 DSH 切到前台重跑；**不要**往屏幕注入鼠标点击 |
| 成片画面撑不满 / 被裁掉边 | 录屏时窗口没最大化 | 只能请用户点最大化；外部 `ShowWindow`/`SetWindowPos` 被进程拦掉 |

---

## 9. 禁止

- 手改 `client.js`、`dist/` 里的生成物。
- 在 profile 跑 pnpm、改 `.npmrc`、改 profile 业务文件（安装通道故障例外，且先备份）。
- 往运行时加第三方依赖。
- 用另起的浏览器/mock 页面"验证"视觉效果。
- 把 `samples/`、`demo/`、`.tmp/` 打进 bundle。

---

## 10. 附：演示片（录屏 + 重剪）

两条交付片：`demo/dsh-opening-demo-short.mp4`（四语简版连播，15.0 s / 4.7 MiB）与 `demo/dsh-opening-demo.mp4`（四语完整版连播，69.9 s / 14.5 MiB），均 1880×1480、AAC 192k、带原声。

1. **窗口**：先请用户把 DSH 点最大化。外部 `SetWindowPos` / `ShowWindow` / `WM_SYSCOMMAND SC_MAXIMIZE` / Win+Up / 拖边框全部被进程拦掉（`capture-app.py` 的 `CAPTURE_MAXIMIZE` 已证明无效，别重试）；目标 client ≈ 2560×1528。
2. **录**：`$env:CAPTURE_LEAD='2.8'; $env:CAPTURE_SECONDS='12'; .venv-tts\Scripts\python.exe tools\capture-app.py zh-short en-short ru-short ja-short`；完整版把 `CAPTURE_SECONDS` 改 `25`、键换成 `zh en ru ja`。脚本会自动 `build-client --force <key>`，**录完必须 `node tools\build-client.mjs` 重建默认**。
3. **对齐**：只认画面底部百分比。抽一帧读值（简版 T=2.0 s、完整版 T=8.0 s），`start = 帧时间 − 百分比/100 × span`（`span = total − fadeOut`）；完整版再用每 1% 跳变的时刻做格点拟合（`.tmp/align-full.py`，残差约 ±20 ms）。不要用淡出帧、挂载帧或鲸鱼位置当锚点，都会偏 0.1–0.3 s。
4. **剪**：把 8 个 `start` 填进 `tools/cut-demo-reels.py` 的 `REELS`（带日期注释），跑 `.venv-tts\Scripts\python.exe tools\cut-demo-reels.py both`。滤镜链：drawbox 盖右下浮动工具条 → `crop=1880:1480:340:46`（右缘 2240，避开右上 toast 与桌宠）→ fps 30 → 一次 concat 编码。
5. **验收**：`ffprobe` 看时长/帧数；抽 t=2.0 帧读百分比（简版应显示 057%）；抽问候帧量「环底 → 欢迎回来」间隙（1880×1480 上 zh/ja 约 38 px）。
