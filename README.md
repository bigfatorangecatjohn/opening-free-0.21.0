# Opening Design

给 DeepSeek Harness 桌面版做的一套**开机动画**：页面第一次绘制时，整帧铺开一段序列，播完自己退场，不留 DOM。

一道蓝色数据流像水一样扫过，浪头炸开，鲸鸣里游来一头由光点聚成的虎鲸，凝固成黑色 DeepSeek 鲸鱼，全息圆环旋转呼吸，最后浮出「欢迎回来，指挥员」。底下一条蓝色呼吸灯竖线走到 100%。

- 包名 `dsh-opening-free`　版本 `0.21.0`
- 形态：DSH 客户端插件（bundle），挂在 `shell.overlay` 整帧浮层，click-through
- 八种模式：四种语言 × 完整版 18 s / 简版 3.8–4.5 s
- 全部资源（八条音轨 + 鲸鱼图 + 时间轴）内联在 `client.js`，运行时零请求

## 现在长什么样

**简版三拍**（中 / 英 / 俄 / 日各一条，四条的称呼都落在同一拍 `1.62 s`）：

1. **0 – 0.52 s 数据流**：一道蓝色水带从左扫过屏幕，单层碎浪（约 620 颗浪体粒子 + 230 颗浪脊 + 44 颗飞溅），浪头带卷唇与光晕。
2. **0.52 s 炸开 → 0.58 – 2.03 s 鲸鱼**：一声很轻的低频垫音（没有冲击爆点），冲击环 + 火花散开；鲸鸣里约 1800 颗光点从爆点汇聚成虎鲸轮廓，游到中心后凝固成**黑色** DeepSeek 鲸鱼，常驻在圆环里。
3. **1.06 s 圆环 → 1.62 s 问候**：三层全息散点圆环（96 / 72 / 120 点）逐点浮现、旋转、按 0.32 Hz 呼吸；底部 44 根竖线呼吸灯 + 百分比数字从 0% 走到 100%；「欢迎回来，」与「指挥员」两行先后落在**圆环下方**（中文/日文行距收紧，正中/英/俄仍更松），称呼带蓝光与字距收束。

**完整版 18 s**：同样的开场（鲸鸣 0.74 s 先过场，mark 在它的尾音里浮现），中间五步访问协议逐条浮现在圆环下方，念完一句再换下一句；收尾是同一句问候。底下垫一层 Am–F–C–G 电音床，人声出现时自动压低。完整版每 4.6 s 有一道很淡的扫描线保活。

## 八种模式

| 模式 | 时长 | 内容 |
|---|---|---|
| 中文 / English / Русский / 日本語 | 各 18.00 s | 五步访问协议 + 收尾 |
| 中文（简） | 3.81 s | 数据流 → 鲸鱼 → 圆环 → 欢迎回来，指挥员 |
| English (Short) | 3.84 s | … → WELCOME BACK, COMMANDER |
| Русский (Кратко) | 3.94 s | … → ДОБРО ПОЖАЛОВАТЬ, ТОВАРИЩ |
| 日本語（簡） | 4.53 s | … → おかえりなさいませ、ご主人様 |

四条简版的节拍相同，台词长的语言整段更长（日语最长），而不是把节拍压快。

## 设置页

「设置 → 开机动画」是插件自己的面板：

- **八张卡片**选开机语言/时长，存在 `localStorage` 的 `dsh-opening:lang`，**下次刷新页面生效**。
- **Preview**：六个按钮在这里直接连播，不改已保存的语言。四语完整版约 72 s、四语简版约 16 s，另加四条简版单条。预览挂在 `<body>` 的 portal 上（盖过宿主的设置弹窗），点一下或按任意键跳下一版。
- 播放期间点鼠标/按任意键 = 跳过本次；系统开了「减少动态效果」= 不播。

## 目录

```
plugin/dsh-opening/     运行包（装进 profile 的就是它）
  client.src.js         唯一可编辑的客户端源码（约 102 KiB）
  client.js             生成物：八条音轨 + 鲸鱼 + 时间轴全部内联（约 900 KiB）
  assets/               wav 母版 + ogg + *.sequence.json（时间轴真源）
  index.js              宿主半，故意为空
  locale/{zh,en}.json   插件列表里的标题/描述
  cordis.patch.yml      宿主行，id=dsh-opening-free
  icon.svg              图标
tools/                  音频/客户端/检查/出包脚本
docs/                   环境、语音、手册与 SOP
samples/                TTS 样音与每轮母版
demo/                   演示片：四语简版 15.0 s / 四语完整版 69.9 s（带原声，已入库）
dist/                   分发包：文件夹 + 傻瓜 zip
```

## 从源码到包

Python 用工作区的 `.venv-tts\Scripts\python.exe`；ffmpeg 在 `.tmp\ffmpeg\ffmpeg-9.0.2-essentials_build\bin`。

```powershell
# 1. 只在换鲸鸣采样时需要
.venv-tts\Scripts\python.exe tools\make-whale-call.py

# 2. 重渲一条音轨（完整版去掉 --short；--out 指向 assets）
.venv-tts\Scripts\python.exe tools\build-boot-track.py --lang zh --short --out plugin\dsh-opening\assets\boot-zh-short.wav

# 3. 压成 ogg，并回拷母版到 samples\boot
.venv-tts\Scripts\python.exe tools\encode-tracks.py

# 4. 把八条音轨 + 鲸鱼 + 时间轴内联进 client.js
node tools\build-client.mjs

# 5. 装前门禁
node tools\check-bundle.mjs plugin\dsh-opening

# 6. 出分发包（文件夹 + 安装.cmd + 安装说明.txt + zip）
node tools\make-dist.mjs
```

数据流：`assets/boot-*.wav` + `*.sequence.json` → `build-client.mjs` 读 `ogg` 与 `sequence.json` → 生成 `client.js` 头部的 `__DSH_OPENING_SET__`（八条 cue）。**时间轴的真源是 `sequence.json`，不是手写常量**。

演示片：`tools\capture-app.py` 逐语录屏（`CAPTURE_LEAD=2.8`，简版 12 s / 完整版 25 s；录前自动 `build-client.mjs --force <key>`，**录完必须重建默认**；窗口要先由用户点最大化——外部 `SetWindowPos`/`ShowWindow` 会被进程拦掉），再 `tools\cut-demo-reels.py both` 对齐、居中裁切、mux 原声，产出 `demo\dsh-opening-demo-short.mp4`（15.0 s / 4.7 MiB）与 `demo\dsh-opening-demo.mp4`（69.9 s；1880×1480 母版约 14.5 MiB，留在本机 `demo\master-dsh-opening-demo.mp4`，不进库；入库的是 1600×1260 / 8.1 MiB 的 web 转码）。对齐只认一个锚点：画面底部百分比（简版读 T=2.0 s、完整版读 T=8.0 s，再取整段；`start = 帧时间 − 百分比 × span`，残差约 ±20 ms）。

## 验证

1. `node tools\check-bundle.mjs plugin\dsh-opening` → `PASS — 0 warning(s)`（12 项）。
2. 出包后对 dist 再跑一次门禁：`node tools\check-bundle.mjs dist\dsh-opening-free-0.21.0`。
3. 视觉验证**只能**在用户自己已登录的 DSH 页面上做：`C:\Users\<你>\.dsh\profiles\desktop\node_modules\dsh-opening-free` 是指向本仓库的 Junction，改完 `client.js` 按 Ctrl+R 即生效。按技能红线：不另起浏览器、不截 mock 页、不写渲染器补偿。
4. 队列/时间轴这类看不见的逻辑，用 `.tmp\full-check.cjs` 一类的桩 DOM 脚本跑构建产物（stub React + vm）核对。

## 装 / 卸

- **本机开发**：profile 里是 Junction，直接 Ctrl+R。
- **发给别人**：`dist\dsh-opening-free-0.21.0.zip`。解压后双击 `安装.cmd`（它把文件夹路径放进剪贴板），然后 设置 → 插件 → 安装本地插件（bundle）→ 选中 `dsh-opening-free-0.21.0` 文件夹 → 等 `applied` → Ctrl+R。细节见 `docs/42-install.md`。
- **卸载**：设置 → 插件 → `dsh-opening-free` → 卸载，刷新恢复原样。

## 已知限制

1. 只在开机/刷新时播，不是每次切页面都播。
2. 浏览器自动播放策略可能拦掉声音（动画照常）；点一下页面再刷新通常就好。
3. 音轨是 Ogg Vorbis q0.5，换 WAV 会让包从约 1 MB 涨到约 4.7 MB。
4. 日语音色是成人女声抬音高模拟的轻快声线，不是真正的儿童音色。
5. 鲸鱼 logo 是 DeepSeek 官方标识，这里是同人致敬，与深度求索官方无关，不要商用。
6. 俄语 TTS 用 Silero v5（CC BY-NC-SA），**非商用**；要商用必须换掉那条音色。

## 文档

| 文件 | 给谁 | 内容 |
|---|---|---|
| [docs/40-manual-human.md](docs/40-manual-human.md) | 人 | 用户手册（随包发，即包里的 README.md） |
| [docs/41-manual-ai.md](docs/41-manual-ai.md) | AI | 结构、真源、边界（随包发，即 FOR-AI.md） |
| [docs/42-install.md](docs/42-install.md) | 人 | 三步安装 + 排错（随包发，即 INSTALL.md） |
| [docs/43-sop.md](docs/43-sop.md) | AI | 装机 / 验证 / 改版 / 出包四条 SOP（随包发，即 SOP.md） |
| [docs/10-environment.md](docs/10-environment.md) | AI | 环境事实与安装通道修复 |
| [docs/30-voice.md](docs/30-voice.md) | AI | 语音选型与模型落地记录 |
| [HANDOFF.md](HANDOFF.md) | AI | 本次交接单：现状、未完成项、命令 |

## 许可

代码本工程原创，按仓库根的 [LICENSE](LICENSE)（MIT）自由使用。音色：Kokoro-82M（Apache-2.0，中/英/日）、Silero v5（CC BY-NC-SA，俄）。鲸鸣采样取自用户提供的参考片音轨，仅作同人自用。视觉参考红警 3 / 命令与征服 3 的 E.V.A 终端气质与流浪地球 2 的粒子线条。
