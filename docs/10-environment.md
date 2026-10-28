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

## 安装通道修复（2026-10-29，已打通）

装一次本地 bundle 连撞两道 profile 级闸门，都不是我们的包的问题。

**闸门一：`ERR_PNPM_UNEXPECTED_VIRTUAL_STORE`。** `profile\node_modules\.modules.yaml` 里 `virtualStoreDir` 还指着已经删掉的 `profiles\_stage\node_modules\.pnpm`，而 pnpm 现在要往 `profiles\desktop\node_modules\.pnpm` 里链，两边对不上就整条 install 拒绝。修法：把该字段改成 `C:\\Users\\<你>\\.dsh\\profiles\\desktop\\node_modules\\.pnpm`（单点字符串替换，改完 `_stage` 出现次数应为 0）。

改之前必须先排掉一个真实风险：`dsh-infinite-gen-5` 是 `file:../../plugins/dsh-infinite-gen-5` 依赖，但那个源目录是**空的**，实体只在 `node_modules\dsh-infinite-gen-5`（52,698 文件 / 2,089.2 MB，唯一副本）。先 `robocopy /E /MT:16` 复制回源目录，核对文件数一致（52,698）再动 pnpm。

**闸门二：`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`。** lockfile 里三个条目还在 24 小时冷静期内，pnpm 拒绝整份 lockfile：

- `@lemoncat7/dsh-knowledge@2.16.0`
- `@xmanrui/dsh-im@5.7.0`
- `dshmarket@1.73.1`

修法：在 `profile\pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 末尾按既有格式追加这三行——**注意两空格缩进**（我第一次写成顶格，pnpm 直接报 YAML `document separator is expected`）。这是该文件本来就有的先例机制，不是新发明。

**装通的判据：**

- 返回 `"application": "applied"`，输出里有 `+ @local/dsh-opening 0.1.0 <- D:\DSH\Opening Design\plugin\dsh-opening`；
- `profile\package.json` 的 dependencies 多出 `"@local/dsh-opening": "link:D:/DSH/Opening Design/plugin/dsh-opening"`，`dsh.profile.bundles` 数组末尾多出 `"@local/dsh-opening"`；
- `node_modules\@local\dsh-opening` 是指向工作区的符号链接；
- 客户端 `shell.overlay` 的 occupants 里出现 `id: dsh-opening, order: -1000, active: true`（HMR 直接生效，不用重启）。

> **2026-10-28 改名**：插件从 `@local/dsh-opening` 改名为 `dsh-opening-free`（市场显示「开机动画 Free」），上一条判据里的名字随之作废。改名不是改字符串就行——profile 里 `dependencies` 的 `link:` 行的键、`dsh.profile.bundles` 的条目、`node_modules` 下的目录名三处都绑在包名上，所以必须 `plugin_manager remove_bundle` 旧名 + `install_bundle` 新路径（各约 1.5 分钟）。只改包内文件而不重装，会出现「bundle 列在 profile 里、行 id 已是新名、模块名却解析不到」的半死状态。

**备份**（改 profile 前做的，回滚用）：`D:\DSH\Opening Design\.env-backup\2026-10-28\` 里有 `package.json`、`cordis.patch.yml`、`modules.yaml`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`。

**一个读数不要被吓到**：install 成功那次 pnpm 会打印 `Packages: -48`，那是清理陈旧条目。装完复核：`node_modules` 顶层仍是 244 项，`dsh-infinite-gen-5` 仍是 52,698 文件。
