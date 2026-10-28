# 环境记录（2026-10-28 实测）

所有条目都是在本机跑出来的，不是从文档抄的。改动环境前先读这一份。

## 机器与工具链

| 项 | 值 |
| --- | --- |
| 工作区 | `D:\DSH\Opening Design`（文件策略 workspace-write） |
| Node | v24.20.0 |
| pnpm | 11.23.0 |
| git | 2.52.0.windows.1 |
| DSH 运行形态 | 桌面版 `DeepSeek Harness`，进程 PID 3256 / 43512 |
| Web GUI | `http://127.0.0.1:59819` |
| checkout（asar） | `D:\Program Files\DeepSeek Harness\resources\app.asar\dsh` |
| profile | `desktop` → `C:\Users\<你>\.dsh\profiles\desktop` |
| DSH_HOME | `C:\Users\<你>\.dsh` |
| 全局 dsh CLI | 0.1.2-rc.1，`C:\Users\<你>\AppData\Roaming\npm\dsh.ps1`；`dsh plugin` 必须带 `--profile desktop` |

## 工作区 ACL（已修复）

沙箱第一次写入直接失败：`SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\DSH\Opening Design)`。

用 `diagnose-windows-sandbox-acl` 技能判定为 PRECONDITION（`writeDac=true`、`writeOwner=false`），已为当前用户 SID `S-1-5-21-…-1001` 补 FullControl 并复核通过。

- 报告：`D:\DSH\_acl\acl-report-1d19c8dd75974358bb3594b2c48cf50a.jsonl`
- 回滚：`D:\DSH\_acl\acl-backup-474265a6c9944406904b271c5727a09d.json.ps1`

## 沙箱行为（会让命令"莫名其妙"失败的三件事）

1. **管道提前关闭**：`命令 2>&1 | Select-Object -First N` 拿够 N 行就掐断上游，带副作用的命令只做一半。
2. **子进程管道 EPERM**：node 子进程用默认 `stdio: 'pipe'` 捕获输出会 `EPERM`；`stdio: 'inherit'` 正常。这不算网络或权限故障。
3. **asar 不可索引**：asar 内的路径 `glob`/`rg`/`pwsh`/`node` 全部 IO error，只有 `read` 工具能读。

## 安装面

- 装插件唯一通道：`plugin_manager action=install_bundle target=<绝对包目录>`。它需要 danger-full-access 或逐次批准。
- 历史上的卡死：`.plugin-manager\logs\operation-iLtzos\pnpm.log`（2026-10-25 20:50）里 pnpm 反复 `HEAD https://github.com/a5899/dsh-omnissiah/archive/refs/heads/main.tar.gz` → `UND_ERR_HEADERS_TIMEOUT`，install 永不结束。**该依赖现已改为 `file:../desktop/_vendor/dsh-plugin-omnissiah`**，理论上卡死已消除，但装包时仍要看耗时。
- 兼容性闸门 `evaluatePluginCompatibility` 会按 `engines.dsh` 与 `@deepseek-ai/dsh-*` peerDependencies 决定整行是否加载。自建 bundle 一律不声明这两样，门禁脚本会挡。
- 日志里既有的 `Plugin X is incompatible with dsh 0.2.1-rc.3` 告警（agency-agents / archive-manager / openwrite）是既存状态，与本次无关。

## 挂载位（实测）

`shell.overlay`：list 槽、scope=root、`replaceRisk: none`、`slotInject: ""`、`ownerProps: []`。文档原文：整帧浮层、在所有列之上、在各列滚动容器之外，**图层本身 click-through，条目自己 opt 回 pointer events**；用新 id 即与既有条目并列（当前 15 条：`dsh-market-toast`、`shortcuts`、`mnemon`、`agent-teams-activity` 等）。

## 参考实现（本机已装、可直接读）

- `node_modules\dshmarket` — `dsh.client.inject` 三件套、`shell.overlay` 注册写法的权威样例，自带完整构建产物。
- `node_modules\@linxin666\dsh-pet` — 体量适中的客户端插件。

两者的 `locale/*.json` 格式：`{"meta":{"title":"…","description":"…"}}`。
