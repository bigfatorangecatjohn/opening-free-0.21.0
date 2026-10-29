# 开机动画 Free — 给 AI 的 README

给接手这个包的 agent 读的**定向说明**：这个包由什么组成、真源在哪、哪些是生成物、什么不能碰。
逐步操作流程在 `SOP.md`（源仓库 `docs/43-sop.md`）；给人看的说明在 `README.md`（`docs/40-manual-human.md`）。

工程真源在 `D:\DSH\Opening Design`；本包由它产出，包里只有运行时的东西。下文路径默认相对仓库根。

---

## 0. 一句话

一个 DSH 客户端插件：往 `shell.overlay` 挂一层整帧画布，按内联音轨的时间轴画「数据流 → 鲸鱼 → 全息圆环 → 问候」；同时往 `settings.section` 挂一个设置页，管八种模式和四语连播预览。

- 包名 `dsh-opening-free`，版本 `0.21.0`
- 宿主半 `index.js`：**故意为空**（只导出 `name` 和空 `apply`）。音频内联在 `client.js`，不注册路由，因此不欠任何服务契约。
- 客户端半 `client.js`：生成物。头部第一条语句是 `window.__DSH_OPENING_SET__ = [...]`（八条 cue：音轨 data URI + 时间轴 + 文案），后面是 `__ModuleLoader__.load(...)`。

---

## 1. 真源与生成物

| 文件 | 性质 | 说明 |
|---|---|---|
| `plugin/dsh-opening/assets/boot-*.wav` | 母版 | 八条：四语完整版 18.00 s + 四语简版 3.81/3.84/3.94/4.53 s |
| `plugin/dsh-opening/assets/boot-*.sequence.json` | **时间轴真源** | cue/步骤/phases/salute 行的唯一来源；`build-client.mjs` 直接读它 |
| `plugin/dsh-opening/assets/boot-*.ogg` | 分发音频 | 由 `tools/encode-tracks.py` 从 wav 压出（q0.5），`build-client` 内联这个 |
| `plugin/dsh-opening/client.src.js` | **可编辑源码** | 组件、画布、设置页、预览队列；约 102 KiB |
| `plugin/dsh-opening/client.js` | 生成物 | `build-client.mjs` 产出，约 900 KiB；不要手改 |
| `tools/build-boot-track.py` | 音频生成器 | TTS + 鲸鸣采样 + 音效 + 混响 + 归一化，输出 wav 与 sequence.json |
| `tools/make-whale-call.py` | 采样切片 | 从参考片 aac 里切 1.50–2.95 s，带通 110–3000 Hz，写 `samples/boot/whale-call-src.wav` |
| `tools/encode-tracks.py` | 压缩 | 固定读 `plugin/dsh-opening/assets` 下八条 wav，写同名 ogg |
| `tools/build-client.mjs` | 内联 | 读八条 ogg + sequence.json + `assets/whale.png`，生成 `client.js` |
| `tools/check-bundle.mjs` | 门禁 | 12 项静态检查；`PASS — 0 warning(s)` 才算能装 |
| `tools/make-dist.mjs` | 出包 | 生成 dist 文件夹 + `安装.cmd` + `安装说明.txt` + zip |

**判断一个改动是否合法**：`client.src.js` 里手写的时间常量都可以被推翻，但必须与 `sequence.json` 对齐；如果两者冲突，以 `sequence.json` 为准，并让 `build-client` 把新值带进 `client.js`。

---

## 2. 客户端结构（读源码的顺序）

1. **头部 banner**：`__DSH_OPENING_SET__`（八条 entry）、`__DSH_OPENING_MARK__`（鲸鱼 data URI）、`__DSH_OPENING_FORCE_LANG__`（可选的强制语言，仅构建期）。
2. **模块常量**：`ACTIVE = pickSet()`（读 `localStorage['dsh-opening:lang']`，非法值回退 `zh`）→ `MODE = modeOf(ACTIVE)` → `CUE / TRACK / LANG / SHORT / SALUTE / PHASE / LEAD_TRACK / NAME_TRACK / SALUTE_LINES`。
3. **`phaseOf(cue)`**：读 `cue.phases`；缺字段时按 `sweep[0,0.55] / burst 0.55 / whale[0.6,1.55] / rings 1.02 / salute=cue.salute.at / name=salute+(total-salute)*0.6` 兜底。完整版另有 `phases.burstPower=0.35`（削弱炸点）。
4. **`modeOf(entry)`**：把一条 entry 打包成 Cyber 需要的全部参数（含 `leadTrack/nameTrack` 排版系数）。
5. **`makeCyberScene(canvas, phase)`**：唯一的画布渲染器。`resize()` 建浮尘；`frame(t)` 按秒画三段。粒子用小圆点批量绘制（计数排序分桶，`DOT_BUCKETS = 24`），**不是**每点一次 fill。
6. **`Cyber(props)`**：一个完整序列的 React 外壳。`props.mode` 缺省用 `MODE`；`onDone` 在淡出后回调（预览队列靠它推进）。`tick` 里用 `Audio.currentTime` 作时钟，没声音时退回 `performance.now()`。
7. **`OverlayRoot()`**：`PREVIEW.queue` 有值 → 通过 `ReactDOM.createPortal` 把 `Cyber` 挂到 `<body>`（盖过宿主设置弹窗），否则挂本次开机的 `Cyber`。
8. **`SettingsPage()`**：八张语言卡片 + 六个 Preview 按钮。`choose()` 只写 localStorage + setState，**下次刷新生效**。
9. **`apply(ctx)`**：注册 `settings.section`（order 45）与 `shell.overlay`（order -1000）；locale 词典也在这里登记。所有登记都在 `ctx.effect` / React cleanup 里可清理。

**旧的 `Stage`**（18 秒版最初的表盘式实现）还在文件里，但注册处已经统一走 `Cyber`；除非要回滚美术方向，不要删也不要改它。

---

## 3. 时间模型（简版）

不变量：**四条简版的称呼都落在 `1.62 s` 同一拍**。台词长的语言整段更长，而不是节拍变快。

- `build_short()`：`start = min(1.62, max(1.05, 4.55 - 0.30 - speech))`；`total = max(3.80, start + speech + 0.30)`。
- 实测：zh 3.808 / en 3.836 / ru 3.936 / ja 4.532；salute 全部 1.62；name 2.763 / 2.824 / 2.980 / 3.158。
- `phases = { sweep:[0,0.52], burst:0.52, whale:[0.58,2.03], rings:1.06, salute, name }`。
- `fadeOut = 0.28`（简版）/`0.52`（完整版）；进度条分母用 `total - fadeOut`，保证走到 100%。
- 视觉的鲸鱼锁定时刻：`lock = min(wEnd, max(wStart + 0.55, min(wStart + 1.02, salute - 0.1)))`——跟着 salute 走，所以中文能游 0.94 s，日语被台词挤短。
- 问候两行的位置在 `Cyber` 的 `place()` 里算：`under = vh*0.44 + ring + gap`，再被 `vh - reserve - blockH` 夹住；`cjkSalute`（zh/ja）分支把 `reserve` 从 62 收到 54、并加 `drop = min(unit*0.02, 22)`，配合 CSS 的 `.is-zh/.is-ja`（lead `line-height:1.12`、rule/name `margin-top:4px`、name `line-height:1.04`）把「欢迎回来，」压到环底下方约 38 px（1880×1480 成片量得）、两行字形间隙约 30 px。改圆环半径、单位或字号后要重新核这两个间隙。

完整版：`total = 18.00` 四语锁死，salute 15.481 / 15.357 / 14.893 / 14.753（end 均 16.70），五步文案在 `DISPLAY_STEPS`，`phases.burstPower = 0.35`。

---

## 4. 设计约束（改之前先读）

1. **只用 slot 给的空间**：根是 `shell.overlay` 里一个条目，`pointer-events: none`，跳过靠 window 上的捕获监听。唯一例外是预览：`ReactDOM.createPortal` 到 `<body>` 的 `.dshop-preview`，队列结束即卸载。
2. **不替换 app 根节点、不 append 第二个应用、不读别的插件的 DOM/CSS**。
3. **一切登记都要能清理**：rAF、定时器、resize、Audio、监听器、portal。
4. **文案走 locale**：设置页标题/描述在 `locale/*.json` 与 `DICT`；画面里的步骤和问候文案来自 `sequence.json` 的 cue，不写死。
5. **不新增第三方运行时依赖**：React 用 `require('react')`，portal 用 `require('react-dom')`（try/catch 兜底）。
6. **不碰 profile 的业务文件、不碰 `.npmrc`**；装包走宿主 UI 或 `plugin_manager`。

---

## 5. 验证边界

- 机械层：门禁 `check-bundle.mjs`（源目录与 dist 各跑一次）；需要看时间轴就解 `client.js` 第 2 行 banner，或跑 `.tmp/full-check.cjs`（stub React + vm 加载构建产物）。
- 视觉层：**只能在用户已登录的 DSH 页面上看**。不另起浏览器、不截 mock 页、不写渲染器"补偿"。
- 本机开发是 Junction：`C:\Users\<你>\.dsh\profiles\desktop\node_modules\dsh-opening-free` → 仓库 `plugin/dsh-opening`，改完 `client.js` 让用户 Ctrl+R 即生效。

---

## 6. 已知坑（详见 SOP 的排错表）

- `client.js` 别手改；下次构建会覆盖。
- 改 `files` 白名单漏掉新文件 → 门禁报 `runtime file not covered by files`。
- patch 里包名必须带引号（`name: 'dsh-opening-free'`）。
- 浏览器 HMR 不会替换已注册的客户端模块 → 必须刷新。
- 沙箱里 node 子进程用 `stdio: 'pipe'` 会 EPERM；用 `inherit`。
- 工作区 ACL 曾有 `DENY(DC)`，删文件可能失败；用 node `fs.rmSync` 试，失败再报告用户。
- 宿主 `shell.overlay` 在设置弹窗**下面**，所以预览必须走 portal。

---

## 7. 当前状态（0.21.0）

- 八条音频、八条 cue、简版三拍视觉、完整版五步、四语连播预览、竖线呼吸进度条：全部已落盘并通过门禁。
- 演示片：`tools/cut-demo-reels.py` 从八条原始录屏 concat 出 `demo/dsh-opening-demo-short.mp4`（15.0 s / 4.7 MiB，入库）与完整版 69.9 s（1880×1480 母版约 14.5 MiB，随 Release 发、不入库），1880×1480 居中裁切、mux 原声；对齐只认进度条百分比（简版 T=2.0 s 读、完整版 T=8.0 s 读粗窗 + 1% 跳变格点拟合，残差约 ±20 ms），不认淡出/挂载帧差。
- 未完成：`HANDOFF.md` 之外的提交整理、音色 `mech 0.6` 是否下调待用户拍板。
