# 开机动画 Free — 说明书与 SOP（给 AI）

给接手这个包的 agent 读的。读完你应该能在三种处境里各走通一条路：**装机**、**验证**、**改一版**。

工程真源在 `D:\DSH\Opening Design`（本包由它产出）；包里只有运行时的东西。下面所有路径都相对那个目录，除非另行说明。

## 0. 包的结构（唯一真源）

| 文件 | 角色 |
|---|---|
| `package.json` | 包身份。`dsh.bundle.patch` 指 patch，`dsh.client` 指浏览器半入口，`files` 是运行时文件白名单 |
| `cordis.patch.yml` | 一行 `insert`，`id: dsh-opening-free`、`name: 'dsh-opening-free'`（**引号是硬要求**，见 §4） |
| `index.js` | 宿主半。注册一条 `/dsh-opening/asset/boot.wav` 路由，实测 404，**运行时并不依赖它**；没有 webServer 时只 warn 不抛 |
| `client.js` | **生成物**。头部三行 data URI：四条音轨 + 鲸鱼 PNG；正文是 `window.__ModuleLoader__.load(...)`。不要手改 |
| `client.src.js` | 客户端源码（37.4 KiB）。音轨/鲸鱼通过 `window.__DSH_OPENING_SET__` / `__DSH_OPENING_MARK__` 注入 |
| `assets/boot-{zh,en,ru,ja}.ogg` | 分发用的压缩音轨（各约 85 KiB），构建时被内联 |
| `assets/boot-*.wav` + `.sequence.json` | 未压缩母版与时间轴清单；`.sequence.json` 是 cue 的唯一来源 |
| `locale/{zh,en}.json` | 设置页标题与描述（`meta.title` / `meta.description`） |
| `icon.svg` | 插件市场图标（695 B） |

数据流：`.wav` + `.sequence.json` → `tools/build-boot-track.py` 产出 → `tools/encode-tracks.py` 压成 `.ogg` → `tools/build-client.mjs` 把 `.ogg` + 鲸鱼 + cue 内联进 `client.js`。

## 1. 装机 SOP（你要把包装进某台机器）

1. `plugin_manager` 用 `action=install_bundle`、`target=<包目录的绝对路径>`（**指向文件夹，不是 zip**）。
   - 完成判据：返回里 `application: "applied"`，并出现 `+ dsh-opening-free 0.1.0 <- <路径>`。
2. 复核 profile：`dsh.profile.bundles` 末尾有 `dsh-opening-free`，`dependencies` 里有 `"dsh-opening-free": "link:<路径>"`，`node_modules\dsh-opening-free` 存在。
   - 完成判据：三处同时成立。缺一处就是半死状态（行 id 已是新名、模块解析不到）。
3. 让用户**刷新页面**（Ctrl+R）。客户端模块只在页面重新加载时替换。
   - 完成判据：`cordis_inspect_query`（client / `Slots.listSubTree`，`{root: 'shell.overlay'}`）的 occupants 里出现 `id: "dsh-opening-free"`, `order: -1000`。

## 2. 验证 SOP（判断「到底跑没跑起来」）

按代价从低到高，跑你能跑的前两层，视觉只能交给用户：

1. **静态**：`node tools/check-bundle.mjs plugin/dsh-opening` 必须 `PASS — 0 warning(s)`（12 项）。
2. **槽位**：`shell.overlay` 有 occupant（§1 第 3 步）；`settings.section` 里有 `id: "dsh-opening-free"`。
3. **视觉**：告诉用户刷新并观察 18 秒序列 → 五步、收尾、淡出后不留 DOM。**不要**另起浏览器、不要造 mock 页、不要写渲染器"补偿"——这条在 `references\verification.md` 里是硬规则。

## 3. 改一版的 SOP（在源工程里）

**皮肤/排印/动画** →
1. 改 `plugin\dsh-opening\client.src.js`（唯一可编辑的客户端文件）
2. `node tools\build-client.mjs`
3. `node tools\check-bundle.mjs plugin\dsh-opening`
4. `git commit`
   - 完成判据：门禁 PASS，且 `client.js` 体积在 600–800 KiB（明显偏离说明音轨或图没被替换进来）。

**改音频（同一批台词重渲）** →
`tools\build-boot-track.py --lang <zh|en|ru|ja> --mech 0.6 --out plugin\dsh-opening\assets\boot-<lang>.wav` → `tools/encode-tracks.py` → §3 的第 2–4 步。
- 完成判据：脚本打印 `total : 18.00 s`（目标值 18.0，自动配平会在超长时把间隔压到 0.35 下限并超时——那时要缩句）。

**加一种语言** → 四处必须同时改，缺一处就静默失败：
1. `tools\make-samples.py` 的 `LINES`（朗读文本 + slug + voice）
2. `tools\build-boot-track.py` 的 `TOP_HZ`、`DISPLAY_STEPS`、`DISPLAY_SALUTE`、`choices`、`speed` 字典
3. `plugin\dsh-opening\client.src.js` 的 `LANGS`、`BADGE`、`PROTOCOL`、`CAPTION`、`CHOICES`
4. `tools\build-client.mjs` 的 langs 默认值与白名单
   - 完成判据：门禁 PASS 且 `build-client.mjs` 打印出四种语言各自 `-> inlined`。

## 4. 坑（都是真踩过的）

| 症状 | 真因 | 处理 |
|---|---|---|
| `✗ patch never mentions dsh-opening-free` | 门禁要求 patch 里包名带引号 | 写 `name: 'dsh-opening-free'` |
| `✗ runtime file not covered by files` | 新增文件（如 `*.ogg`、`client.src.js`、`assets/*.png`）没进 `files` | 补 `files` |
| 装了但画面没变 | 浏览器还跑着旧模块 | 让用户刷新；HMR 不替换已注册的客户端模块 |
| `ERR_PNPM_UNEXPECTED_VIRTUAL_STORE` | profile 的 `node_modules\.modules.yaml` 里 `virtualStoreDir` 指向已删目录 | 改成 `<profile>\node_modules\.pnpm`（先备份到 `.env-backup\<日期>\`） |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | 依赖里有发布不满 24h 的包 | 往 profile `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 追加，**两空格缩进** |
| `pyopenjtalk` 装不上（`cmake` 退出 1） | Windows + py3.12 只能源码编译 | 走 misaki 的 cutlet 分支（fugashi + unidic-lite），import 前给 `pyopenjtalk` 打空桩 |
| 沙箱里 `pip`/`ensurepip` 报 `PermissionError ... .whl` | 工作区继承 ACE `Everyone:(DENY)(DC)`，delete-on-close 被拒 | 提权 + `TEMP` 指向工作区外 + `--no-cache-dir` |
| `spawnSync ... EPERM` | 沙箱不允许子进程开管道 | 子进程用 `stdio: 'inherit'` |
| pwsh `Set-Content` 报 `Access to the path is denied` | 个别文件被沙箱单独封锁 | 改用 `write`/`edit` 工具写 |
| 视频/音频没声 | 自动播放策略拦了 `audio.play()` | 客户端已 `catch` 成静音继续；需要声音就再点一次 |

## 5. 不要碰

- profile 里的 `.npmrc`（安全策略直接拦）。
- `client.js`（生成物，改了会被下次构建覆盖）。
- 宿主的 app 根节点、`document.body`；本插件只往 `shell.overlay` 里加一个条目。
- 任何工作区之外的路径，除 profile 的安装通道故障（且先备份）。
