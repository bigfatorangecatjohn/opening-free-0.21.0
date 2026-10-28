# Opening Design

给 DeepSeek Harness（桌面版）做一套**开机动画**：DSH 启动、第一次绘制时，整帧盖上一层序列，播完自己退场，不留痕。

本仓库同时是"制造这台机器的车间"：环境怎么配、插件怎么装、哪条路走不通，都记在这里。

## 现状

| 项 | 状态 |
| --- | --- |
| 环境勘察 | 完成，见 [`docs/10-environment.md`](docs/10-environment.md) |
| 工作区 ACL 故障 | 已修复并复核（沙箱可写） |
| 挂载位 | 已定为 `shell.overlay`（整帧、click-through、additive seat） |
| 插件骨架 | 已就位，通过装前门禁 |
| 安装 | **已装进 desktop profile**（`@local/dsh-opening` 0.1.0，宿主行 `application: applied`，`shell.overlay` 里已挂载） |
| 开机序列本体 | **占位版**（一缕发丝线 + 一个词 + 1.8 秒），等美术方向 |

## 目录

```
plugin\dsh-opening\     DSH bundle（装进 profile 的那个包）
  package.json          manifest：dsh.bundle.patch + dsh.client
  cordis.patch.yml      宿主行，id=dsh-opening
  index.js              宿主半：空 apply（这里不需要宿主能力）
  client.js             客户端半：SEQ 参数表 + shell.overlay 注册
  locale\{zh,en}.json   插件列表里的标题/描述
  icon.svg              原创图标
tools\check-bundle.mjs  装前门禁（无需依赖，纯 node）
docs\                   需求与环境记录
```

## 怎么迭代

美术方向只改 `plugin\dsh-opening\client.js` 顶部的 `SEQ` 表：`fadeInMs` / `holdMs` / `fadeOutMs` / `rulePx` / `word` / `palette`。挂载代码在它下面，是管道，不是画布。

每次改完：

```powershell
node tools\check-bundle.mjs plugin\dsh-opening
```

全部 ✓ 再继续。要换一段完全不同的动画，替换 `Stage` 的返回树即可，约束只有三条：只用 slot 给的空间、所有资源在 `apply`/React 生命周期里登记并清理、文案走 locale。

## 安装 / 停用 / 卸载

安装（**只能**走 plugin_manager，不要手写 profile 的文件）：

```
plugin_manager  action=install_bundle   target=D:\DSH\Opening Design\plugin\dsh-opening
```

停用（保留安装，关掉效果）：

```
plugin_manager  action=set_plugin   target=@local/dsh-opening   enabled=false
```

装完怎么算真的装上了：宿主行 `application: applied`（`cordis_inspect_query` 的 Config），浏览器里 `shell.overlay` 的 occupants 出现 `dsh-opening`（Slots），刷新页面能看到序列。视觉验证只能在你这台已登录的页面上做——按技能红线，不另起浏览器、不做 mock 截图。

## 已知坑

- 这个工作区的 ACL 曾经缺 `WRITE_OWNER`，沙箱连目录都建不了；修复记录与回滚脚本在 `D:\DSH\_acl\`。
- profile 的 pnpm install 历史上被一个 GitHub tarball 依赖卡死过（HEAD 超时无限重试）；该依赖已改成 `file:` 本地实体。
- 装包还要过两道 profile 级闸门，见 [`docs/10-environment.md`](docs/10-environment.md) §安装通道修复：`.modules.yaml` 里陈旧的 `virtualStoreDir`（`ERR_PNPM_UNEXPECTED_VIRTUAL_STORE`），以及 24 小时冷静期（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`）。
- `D:\Program Files\DeepSeek Harness\resources\app.asar` 里的文件，`glob`/`rg`/`pwsh` 都读不到，只有 `read` 工具能读。
