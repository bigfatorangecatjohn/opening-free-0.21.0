# AGENTS.md — 本工作区的规则

给进入 `D:\DSH\Opening Design` 的 agent 读的。目标是给 DSH 桌面版做开机动画，交付物是一个 bundle，不是一个网页 demo。

## 边界

1. **先读 `README.md` 和 `docs/10-environment.md`**，再动手。环境事实以那两份为准，不要重新勘察一遍。
2. 皮肤/动画只改 `plugin/dsh-opening/client.js`；manifest、patch、locale、icon 除非确实要改，否则别碰。
3. 不新增第三方运行时依赖。React 从宿主的模块表拿（`require('react')`），不需要装、不需要打包、不需要 CDN。
4. 不动 profile（`C:\Users\<你>\.dsh\profiles\desktop`）里的任何文件，不在那里跑 pnpm。安装只走 `plugin_manager`。
5. 不改工作区之外的任何东西；需要写工作区外时先说明理由并取得同意。

## 装前门禁

```powershell
node tools\check-bundle.mjs plugin\dsh-opening
```

必须全绿。它检查：兼容性闸门（不得声明 `engines.dsh` 或 `@deepseek-ai/*` peerDependencies）、patch 行、Client 模块 id 与包名一致、exports 落盘、locale 元数据、图标体积、`files` 覆盖、JS 语法。

## 客户端半的硬约束

- 结构：`window.__ModuleLoader__.load({ id: '<包名>', factory(require) { ... return { inject, apply } } })`。
- `apply(ctx)` 里登记的一切（slot 注册、locale 词典、定时器、监听器）都必须能清理：`ctx.effect` / `ctx.on` / React 的 cleanup。
- 不替换 app 根节点，不给 `document.body` 追加第二个应用，不读别的插件的 DOM/CSS。
- 文案走 Client locale 服务；容器继承宿主主题（美术可以自带配色）。
- `shell.overlay` 图层本身是 click-through，条目要自己 `pointer-events` 才能接住点击；本动画故意保持 `none`，靠 window 上的监听实现"点一下跳过"。

## 验证

- 视觉验证只能在用户那台已登录的页面上做。**不要**另起浏览器、不要截 mock 页、不要写渲染器来"补偿"。
- 机械验证：门禁脚本 + `cordis_inspect_query`（宿主 Config 看行状态、客户端 Slots 看 `shell.overlay` 的 occupants）。
- 装完要能说清三件事：行 applied、槽位里有 `dsh-opening`、刷新后序列播完不留 DOM。

## 环境陷阱（踩过的）

- 沙箱内 `pwsh` 的 `命令 | Select-Object -First N` 会提前掐断上游管道，带副作用的命令会做一半。
- 沙箱内 node 子进程用 `stdio: 'pipe'` 捕获输出会 EPERM；要子进程跑完就 `stdio: 'inherit'`。
- asar 内的路径 `glob`/`rg`/`pwsh` 全读不到，`read` 工具可以。
- 工作区 ACL 里曾有 `WRITE_OWNER` 缺失导致沙箱建不了目录；修复用的提权脚本与回滚脚本在 `D:\DSH\_acl\`，别删。
