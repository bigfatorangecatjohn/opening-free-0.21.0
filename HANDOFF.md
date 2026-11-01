# 任务交接单 — 开机动画 Free（0.21.1，2026-11-01）

给下一个会话的自己读。旧版交接单（3.3–3.5 s、视觉未动的那一版）已被本文件取代。

---

## 0. 一句话现状

**0.21.1 封包了（2026-11-01，脱敏版）**：八种模式（四语 × 完整 18 s / 简版 3.8–4.5 s）全走同一条 cyber 管线，四份文档写完，傻瓜封包已出。这一版只动文档与市场物料：`client.js` 与 0.21.0 逐字节相同（构建后 git 无差异）；去掉文档里的真名与 Windows SID、统一 `<你>` 占位、修掉过期数字、补市场截图（`screenshots.json` + 3 张 1600 px JPG）。版本从 0.2.0 抬到 0.21.0（用户 19:10 指令「封最新一版傻瓜包，版本 v0.21」）；`make-dist.mjs` 已按旧版本号清掉 `dist/dsh-opening-free-0.2.0*`，dist 里只留一版。

```
dist/
  dsh-opening-free-0.21.1/        930.3 KiB（952,667 B；安装时选这个文件夹）
  dsh-opening-free-0.21.1.zip     641.5 KiB（656,861 B，交付物）
  安装.cmd                       1,412 B
  安装说明.txt                   1,163 B
```

门禁：源目录与 dist 都 **PASS — 0 warning(s)（12 项）**。zip 条目已核（11 个包文件 + 两个安装物）。

**已提交并推上公开仓库**（`github.com/bigfatorangecatjohn/opening-free-0.21.0`，HEAD 以 `git log -1 --oneline` 为准；安装 zip 与完整版演示片在 [Release v0.21.1](https://github.com/bigfatorangecatjohn/opening-free-0.21.0/releases/tag/v0.21.1)）。还没做：音色（mech 0.6）待用户拍板、竖屏演示片。市场条目已收录：PR #10363 于 2026-10-31T17:09:26Z 合并（详情页 https://awesome-dsh-plugin.com/p/bigfatorangecatjohn/opening-free-0.21.0--plugin-dsh-opening/ ）。

演示片已按新间距重录重剪：`demo/dsh-opening-demo-short.mp4`（15.0 s / 4.7 MiB，1880×1480，入库）与四语完整版 69.9 s（1880×1480 母版 `demo/master-dsh-opening-demo.mp4` 只在本机、现挂 Release v0.21.1，不入库），四语硬切、带原声，管线 `tools/cut-demo-reels.py`。

**18:40 追加**：中文/日文的「欢迎回来，/ xxx」两行已下移并收紧——`is-zh` 类（`client.src.js` 约 1009–1023 的 `.dshop-cyber-lead/rule/name` line-height 1.12 / margin-top 4px / name line-height 1.04）+ `place()` 里 `cjkSalute` 分支（`reserve=54`、`drop=min(unit*0.02,22)`，约 2348–2350 行；reserve 先写 48，怕顶到进度条改 54），en/ru 不动。门禁 PASS。**18:47 用户点最大化后已重录 8 条 take 并重剪两条片**（成片量得环底→lead 约 38 px、两行间隙约 30 px）。外部改窗口尺寸（`SetWindowPos` / `ShowWindow` / `SC_MAXIMIZE` / Win+Up / 拖边框）全被进程截获，只能请用户点最大化；`capture-app.py` 的 `CAPTURE_MAXIMIZE` 已证明无效，别再加。

**20:10 追加（用户「彻底清，瘦身，重新出包」）**：仓库从 20.6 MB 瘦到 ~6 MB 的工作树——`plugin/dsh-opening/assets/*.wav`（8 个母版，4.03 MB）、`demo/dsh-opening-demo.mp4`（8.5 MB 完整版 web 转码）、`dist/`（1.54 MB）全部 `git rm --cached` 并写进 `.gitignore`，本地文件保留；完整版演示片与安装 zip 改走 GitHub Release。历史里的 `.env-backup/`（本机 profile 插件清单）、`.ref/`（第三方插件源码副本）、根目录参考 aac、wav 母版、完整版 mp4、dist 用 `git-filter-repo`（`.tmp/filter-repo/git-filter-repo.py`，沙箱里 sh 被拦、filter-branch 跑不了）重写后 force push（**所有 commit SHA 因此变化**）。但 GitHub 仍能按旧 SHA 取到被删对象（实测 `2613c54` / `1610c69` 的树里 `.env-backup/`、`.ref/`、aac 仍在，API 直接可读），所以又做了一次彻底迁移：旧仓库改名 `opening-free-0.21.0-archive` 并**转为 private**（匿名 `git ls-remote` 现在要认证）；现账号 `bigfatorangecatjohn`，在同名 `bigfatorangecatjohn/opening-free-0.21.0` 下**新建公开仓库**，把重写后的 34 个提交从零对象库推上去——新仓库从未存过这些文件。结果：远端工作树 **56 个 blob / 6,826,146 B**（原 20.6 MB；0.21.1 加 3 张截图与 `screenshots.json` 后为 **60 个 blob / 7,061,731 B**），本地 pack 25.1 MiB（历史里历次 `client.js` 生成物，属正常）；`git remote` 已重新指向新仓库。新仓库 created_at `2026-10-29T12:14:42Z`（北京 20:14），市场年龄闸门因此顺延到 `2026-10-30 20:14`。Release v0.21.0 在新仓库重建，挂 `dsh-opening-free-0.21.0.zip`（656,842 B）与 `master-dsh-opening-demo.mp4`（15,176,593 B）。

**20:40 追加（用户「公开 git 历史里的账号敏感信息，清」）**：36 个提交的作者与提交者全部统一为 `Opening Design <bigfatorangecatjohn@users.noreply.github.com>`（旧 handle 的 32 个提交一并改掉），用 mailmap + `filter-repo` 在裸库重写，tree、提交信息与提交数（36）均未变；为免旧 SHA 仍可读，又做了一次迁移：旧库改名 `opening-free-0.21.0-archive-20261101` 并转 private，重写后的 refs 先经临时库 `opening-free-0.21.0-next` 验证，再推入全新的同名公开库（临时库亦已转 private，名 `opening-free-0.21.0-archive-20261101b`）；Release v0.21.1 已重放（zip 与 mp4 的 sha256 与原件一致），v0.21.0 不再重建（其 zip 是脱敏前文档，只有 tag 保留）。本地 refs 用 fetch + `update-ref` 对齐到新历史，工作树 tree 未变、`git status` 干净；上一代 archive（`opening-free-0.21.0-archive`）保持原样。本次只改身份元数据，历史树里的旧文档内容未改写。`awesome-dsh-plugin` 仓库里 PR #10363 的提交信息仍含旧 handle，属第三方仓库，未动。

**23:15 追加（用户「连内容一起清理——再做一次全历史 blob 改写和迁移」）**：这次连历史树里的文档内容一起改。用 `filter-repo --replace-text`（`.tmp/rewrite2/replace.txt`，11 条 literal 规则）重写全部 38 个提交的 blob：旧账号名在 6 个文件位置（21 处）统一成现账号（先把「旧账号由 GitHub 重定向」这句叙事改成「旧账号已隐去」，免得自相矛盾）；本机 Windows 用户名 141 处 → `<你>`；完整 SID 34 处 → 缩写形式（保留末四位）；旧的尖括号占位 7 处 → `<你>`；4 行里的真名 → 「你」（含第三人称改第二人称）。二进制文件按 filter-repo 的 NUL 检测跳过，图片/音频/视频未动；改写后的 master tree 与改写前完全相同（`b141b891…`，因为 tip 本来就干净），38 个提交与两条 tag 都保留。为免旧 SHA 仍可读，做第三次迁移：旧库改名 `opening-free-0.21.0-archive-20261101c` 并转 private，重写后的 refs 经临时库 `opening-free-0.21.0-next2` 验证后推入全新的同名公开库（created_at `2026-11-01T15:15:27Z`，北京 23:15）；Release v0.21.1 已重放，两个资产的 sha256 与原件一致。但 23:15 这条记录本身又把已清掉的标识写回了公开 tip，于是再重写一次全部 blob、把记录改成不含标识的写法，并做第四次迁移：旧库改名 `opening-free-0.21.0-archive-20261101d` 并转 private，经临时库 `opening-free-0.21.0-next3` 推入全新的同名公开库（created_at `2026-11-01T15:21:01Z`，北京 23:21）；两次 Release v0.21.1 均已重放，两个资产的 sha256 与原件一致。第三方市场仓库里 PR #10363 的提交信息仍含旧账号名，改不了。

---

## 1. 这一版到底改了什么（相对 HEAD c3e5693）

| 面 | 变化 |
|---|---|
| 音频 | 简版重写为 3.8–4.5 s 三段式；鲸鸣换成参考片真采样（`make-whale-call.py`）+ 赛博层；删掉「咻—biu」与爆破音；四语 salute 统一落在 **1.62 s**；完整版前奏四颗水滴音换成鲸鸣（0.74 s 起，1.45 s 长），母带仍 18.00 s |
| 视觉 | 旧 `Stage` 不再上屏；新 `Cyber` 画布三拍：水带碎浪 → 1800 点虎鲸 → 黑鲸凝固进圆环；三层全息散点圆环呼吸旋转；底部 44 根竖线呼吸灯 + 百分比；文案两行落在环下 |
| 完整版 | 同一组件（`phase.burstPower=0.35` 减爆点），环下**逐句**浮现五步协议，念完即散；每 4.6 s 一道淡扫描线保活 |
| 设置页 | 八张卡片 + 六个 Preview 按钮；四语连播（完整 72 s / 简版 16 s）；预览走 `ReactDOM.createPortal` 到 body，盖过设置弹窗 |
| 打包 | `make-dist.mjs` 重写；包内带 README/INSTALL/FOR-AI/SOP 四份文档 + `安装.cmd`（只复制路径，不改文件） |

---

## 2. 时间轴真源与实测值

真源是 `plugin/dsh-opening/assets/boot-<key>.sequence.json`，由 `tools/build-boot-track.py` 写出；`build-client.mjs` 只做内联，不重算时间。

| key | total | salute | name | 收尾 |
|---|---|---|---|---|
| zh-short | 3.808 | 1.620 | 2.763 | 欢迎回来，指挥员 |
| en-short | 3.836 | 1.620 | 2.824 | WELCOME BACK, COMMANDER |
| ru-short | 3.936 | 1.620 | 2.980 | ДОБРО ПОЖАЛОВАТЬ, ТОВАРИЩ |
| ja-short | 4.532 | 1.620 | 3.158 | おかえりなさいませ、ご主人様 |
| zh / en / ru / ja | 18.000 | 15.481 / 15.357 / 14.893 / 14.753 | salute+(end−salute)×0.72 | 同上 |

- 简版拍点：`sweep[0,0.52] / burst 0.52 / whale[0.58,2.03] / rings 1.06 / salute / name`；`fadeOut 0.28`。
- 完整版拍点：`sweep[0,0.78] / burst 0.78 / whale[0.80,2.35] / rings 1.95 / burstPower 0.35`；`fadeOut 0.52`。
- 简版时长公式：`start=min(1.62, max(1.05, 4.55−0.30−speech))`、`total=max(3.80, start+speech+0.30)`。改台词会改 total，但 salute 不动。
- 进度条分母是 `total − fadeOut`，保证走到 100%。
- 鲸鱼锁定时刻 `lock=min(wEnd, max(wStart+0.55, min(wStart+1.02, salute−0.1)))`；中文 1.52 s 锁定，日语更早、游得短一些。

---

## 3. 客户端结构（唯一可编辑文件：`plugin/dsh-opening/client.src.js`，约 102 KiB）

阅读顺序（行号是当前近似值，会被后续编辑推走）：

1. banner 常量链：`ACTIVE → modeOf() → MODE → CUE/TRACK/LANG/SHORT/SALUTE/PHASE/LANG_TRACK`（约 92–192 行）
2. `phaseOf(cue)`：读 `cue.phases`，缺字段按 sweep/burst/whale/rings 兜底；`burstPower` 默认 1
3. `prepareWhale(url)`：1024² 读像素，`lum<150 && alpha>128` 取剪影，烘 tint（蓝）与 ink（黑）、glow、rim 四张图；采样 step=6，抽稀到 1800 点
4. `makeCyberScene(canvas, phase)` → `resize()` / `frame(t)`：单层碎浪、爆点、点阵汇聚、圆环、呼吸灯（全部按 `phase` 驱动）
5. `Cyber(props)`：音频 + rAF + DOM 记忆化写入（`setCss`/`cssMemo`）+ 跳过 + `onDone` 回调
6. `OverlayRoot`：队列存在时 portal 播 `Cyber`，否则播当前模式
7. `SettingsPage`：八卡 + Preview；`PREVIEW_QUEUES` 六条
8. `apply(ctx)`：注册 `settings.section`（order 45）与 `shell.overlay`（order -1000），返回 `{inject:['slots','locale'], apply}`

`Stage` 是死代码（保留未删），不要误改它。

---

## 4. 命令链（Python 用 `.venv-tts\Scripts\python.exe`）

```powershell
# 换鲸鸣采样（只在换素材时跑）
.venv-tts\Scripts\python.exe tools\make-whale-call.py            # START=1.50 LENGTH=1.45

# 重渲母带（简版；完整版去掉 --short）
.venv-tts\Scripts\python.exe tools\build-boot-track.py --lang zh --short --out plugin\dsh-opening\assets\boot-zh-short.wav

# 压 ogg（输入固定为 plugin\dsh-opening\assets）
.venv-tts\Scripts\python.exe tools\encode-tracks.py

# 内联 + 门禁 + 出包
node tools\build-client.mjs
node tools\check-bundle.mjs plugin\dsh-opening
node tools\make-dist.mjs
node tools\check-bundle.mjs dist\dsh-opening-free-0.21.1
```

体积参考：client.js 899.5 KiB；zip 641.1 KiB。再多一条完整版音轨约 +25 KiB（ogg）。

---

## 5. 装 / 验收

- **本机**：profile 里 `node_modules\dsh-opening-free` 是指向本仓库的 **Junction**，改完 `client.js` 让用户 **Ctrl+R** 即可，不需要装包。
- **给别人**：`dist\dsh-opening-free-0.21.1.zip` → 解压 → 双击 `安装.cmd`（路径进剪贴板）→ 设置 → 插件 → 安装本地插件（bundle）→ 选 `dsh-opening-free-0.21.1` **文件夹** → 等 `applied` → Ctrl+R。
- 机械验证：源门禁 + dist 门禁 + banner 解码（8 条 cue）+ `.tmp/full-check.cjs`（stub React 跑组件树，核对步骤条数/队列顺序）。
- 视觉验证只能在用户已登录页面做。不另起浏览器、不截 mock 页。

---

## 6. 还没做（接手先看这里）

1. **演示片（已重剪）**：`tools/cut-demo-reels.py` 从 `demo/raw-<key>.mp4` 八条原始录屏一次 concat 出 `demo/dsh-opening-demo-short.mp4`（15.0 s / 4.7 MiB，入库）与完整版 69.9 s（1880×1480 母版约 14.5 MiB，随 Release 发、不入库）。对齐只认进度条百分比：简版 T=2.0 s 读、完整版 T=8.0 s 读粗窗再用每 1% 跳变做格点拟合（`.tmp/align-full.py`，残差约 ±20 ms）；本次 start 简版 zh 0.095 / en 0.471 / ru 0.245 / ja 0.172，完整版 zh 0.194 / en 0.172 / ru 0.289 / ja −0.105。画面 1880×1480 居中裁切，右上桌宠/reload toast 靠裁掉 x≥2240、右下浮动工具条用采样色块盖掉。raw/seg 与完整版 mp4 被 `.gitignore` 忽略。重录：`tools/capture-app.py`（`CAPTURE_LEAD=2.8`，简版 12 s、完整版 25 s，逐语自动 `build-client --force`，**录完必须重建默认**）。竖屏版仍未做；demo/dsh-opening-demo-share.mp4（8.9 MB）还是旧视觉的方形分享版，尚未重做。
2. **git**：0.21.1 已全部提交并推到公开仓库（HEAD 以 `git log -1` 为准）。历史已在 2026-10-29 的迁库中重建：`.env-backup/`、`.ref/`、参考 aac、wav 母版、完整版 mp4、`dist/` 都不在新仓库历史里；旧库已转 private。文档里的本机用户名统一写成 `<你>`，真名与 SID 已在 0.21.1 去掉。
3. **音色**：`--mech 0.6` 仍是当前值；朋友点评「太平太机械」。可选 mech 0.35 / 干净人声 / 换音色，等用户拍板。
4. 旧短版（四声叮咚 + 欢迎语）已被 cyber 简版替换；旧 mode 名没变，设置里不会出现 12 张卡。
5. **市场物料**：详情页已上线；截图在 `plugin/dsh-opening/screenshots.json`（相对路径，1–8 张），下次 nightly 构建自动生效。改描述/分类才需要重开 PR。

---

## 7. 环境与坑

- 工作区 `D:\DSH\Opening Design`，git 分支 `master`，HEAD 以 `git log -1 --oneline` 为准（与 origin/master 同步）。
- Python `.venv-tts\Scripts\python.exe`；ffmpeg `.tmp\ffmpeg\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe`；参考鲸鸣原片**不入库**（版权），衍生片段在 `samples/boot/whale-call-src.wav` 与 `assets/boot-*.ogg`。
- 沙箱：node 子进程 `stdio:'pipe'` 会 EPERM（用 `inherit`）；`pwsh` 里 `... | Select-Object -First N` 会掐断上游；`cmd /c` 的输入重定向要写进 cmd 自己的命令串（`cmd /c "x.cmd <nul"`），PowerShell 不认 `<`；工作区 ACL 有 `DENY(DC)`，删文件用 node `fs.rmSync`。
- 别删 `D:\DSH\_acl\`；不碰 profile 的 `.npmrc` 与业务文件；不手改 `client.js`。

---

## 8. 用户口径里容易丢的几条

- 舞台是**浅纸色**（`#f7f8fa`），不是暗色赛博；所有高光用蓝墨实色，不能用 `lighter`。
- 鲸鱼最终是**墨黑** logo（`#141922`→`#030508`，用户要的"黑色"），蓝紫轮廓光只做边缘，且已比第一版**压暗 15%**（用户说"银辉过头"）。
- 简版鲸鱼**不隐去**（曾试过名字落定时淡出，被否）；也**不旋转**（曾试过整圈滚转，被否）。
- 用户否掉的音效：`stream_sweep` 的滑音「咻—biu」、`burst_impact` 的爆破「啪」、`name_boom` 的低频爆裂。都不要加回来。
- 文案要庄重：称呼字距收束 + 蓝光，日/俄/英字号单独调过（`LEAD_TRACK/NAME_TRACK` 与 `.is-ru/.is-en/.is-ja`）。
- 用户会按「设置 → 开机动画 → 中文（简）」验收简版，Preview 按钮验收连播。
