# MCP 与连接授权

Bridge 提供 MCP 工具，让原生 Agent 在授权范围内发现目标、委派任务、查询结果和读取公共工作材料。MCP 连接方向是 Agent → Bridge。

## 两种使用入口

| 入口 | 使用方式 | 范围 |
| --- | --- | --- |
| Bridge 托管的协作会话 | 为会话注入受限的 Bridge 工具通路 | 由当前协作关系与会话授权决定 |
| 原生 Agent 独立运行 | 在其 MCP 配置中添加 Bridge 连接 | 由独立连接身份和授予的权限决定 |

当前 Bridge 能直接管理原生 MCP 配置的入口：Claude Code、Codex、OpenCode（1.x/2.x 两代布局）、DSH Web 与 DSH CLI（需要你指定 profile，见下）。这些入口在“配置”里可以添加、移除、生成独立配置、撤销连接授权，并按原生产品支持的入口探测列表。

OpenDesk CLI（0.3.8）目前**不能由 Bridge 添加**：它的插件清单和工具列表里都没有 MCP 管理入口，启动时还会重写自己的 `setting.json`，把不认识的 app 配置段丢掉。所以对 CLI 只能“生成独立配置片段”，不会写入原生配置。

OpenDesk Windows Desktop 需要**写入前先从托盘完全退出**，在 Bridge 原节点的配置弹窗刷新核对退出完成，再添加 MCP，最后手动打开 OpenDesk。节点已断开也可以添加，但进程仍运行、无法核验、退出写回未稳定或缺少系统 Node.js 时会拒绝；Bridge 不会退出或重启它。配置写入只证明文件事实，原生加载、连接和工具无法由 Bridge 核验，“重新探测原生列表”保持禁用。请在 OpenDesk 的“MCP 管理 → 已安装 MCP”核对 AgentBridge 的 STDIO 条目、连接和工具，再自行发起真实授权调用核对结果。

如果列表里那条 AgentBridge 是排查问题时人工写入的临时条目，它不带真实授权；Bridge 会保留未登记的同名条目并提示冲突。先在 OpenDesk 核实并移除该诊断条目，再由 Bridge 添加正式连接，完全重开 OpenDesk 后核对。

DSH Web 的情况最好：在一次隔离的 profile 里真实启动 DSH Web 后，它主动读取了 Bridge 写入的那条配置、完成握手并列出了 Bridge 的 7 个工具。不过这仍不等于你的真实 profile 已经生效，请在自己的 DSH 界面确认。

DSH CLI 的配置目录由你启动 `dsh` 时选择的 profile 决定，所以需要你告诉 Bridge 是哪一个：在 DSH CLI 节点的配置弹窗里填写“DSH 原生 profile”（或命令行加 `--profile`）。不填时 Bridge 只生成配置片段，不会写入任何 profile。填错 profile 不会报错，只会写到一个不会被加载的目录，请与启动 dsh 时使用的名称保持一致。

alpha.48本地候选支持DSH Desktop原生MCP配置：Bridge读取Desktop已保存的数据目录/Profile选择，绑定当前Profile，只修改其中的AgentBridge条目。切换原生数据目录或Profile后，先在Bridge移除原接入，再为当前Profile添加；移除不会改另一份Profile。找不到或无法核对原生选择时会保留配置并提示，不猜目录。当前公开0.6.0-alpha.51.recovery.2已包含Desktop原生配置管理。Hermes/Pi在alpha.50本地候选中支持原生MCP管理并提供EXE；当前公开0.6.0-alpha.51.recovery.2已包含Hermes/Pi原生管理。配置后分别在原生执行/reload-mcp、/reload核对。

注意：Bridge 写入配置、原生 Agent 加载配置、建立连接、工具可用、连接授权有效是**五件不同的事**，界面会逐项显示，不会合并成一个“已连接”。

## 配置原生 MCP 连接

在“机器与 Agent”找到所属机器与原生工具，点击“开始会话”右侧的“配置”，在该 Agent 的 MCP 接入区建立连接、核对授权，再执行添加或导出配置。弹窗固定当前机器和 Agent，无需重复选择目标。配置应出现在该原生 Agent 自己的 MCP 列表中；按原生工具要求重新载入连接，OpenCode 服务也需重新读取配置，DSH Web 由 DSH 自己应用配置补丁。

MCP 接入区逐项显示：配置是否存在、原生是否加载、连接是否建立、工具目录是否可用、连接授权是否有效、条目是否由 Bridge 写入。任一项为“未知”就是没有取得该证据，不能当成通过。

不想打开 Bridge 窗口时，也可以在终端使用 `agentbridge mcp status|export|install|remove|revoke|probe --node 节点ID` 管理同一批连接，它连接同一个 profile 的后台；后台未运行时可直接启动后台，不打开窗口、不启动模型。管理 DSH CLI 时再加 `--profile 名称`，例如：

```text
agentbridge mcp install --node <DSH节点ID> --profile <启动 dsh 时使用的 profile>
agentbridge mcp status  --node <DSH节点ID> --profile <同上>
```

不指定 `--profile` 时 `install`/`remove` 会被拒绝（提示需要 profile），`export` 仍可生成片段。profile 名称只能是小写字母、数字和连字符。

当前 Linux 桌面可以在本机管理这些配置；WSL 本机暂不支持，SSH 远端需要远端后台也升级到包含此功能的版本。

写入配置会保留无关设置；已有同名或归属不明的条目需要先核对，避免覆盖其他连接。导出配置只是准备了连接信息，不代表原生 Agent 已经调用成功。

## 权限与撤销

连接身份用于约束可见资源和工具，关系用于约束获准的调用目标。机器可达、保存关系和具备工具权限分别判断，不能凭其中一项推断全部可用。

移除连接时先撤销 Bridge 授权，再删除属于该连接的配置。也可以单独“撤销连接授权”：授权立即失效、新的调用会被拒绝，但原生配置条目不删除；两者会分别显示。若原生配置清理失败，界面会显示“已撤销授权，原生配置待清理”，不会把授权恢复。

只删除原生 Agent 里的那条配置，只说明该份配置不再被加载，不等于全局撤权。你在原生 Agent 里删除或修改条目后，Bridge 只刷新识别、不会自动补回，也不会按名称猜测归属。

不要把连接凭据写入聊天、公共材料或共享文档。

## MCP 与执行适配的区别

一个外部 Agent 能调用 Bridge MCP，不表示 Bridge 已能启动、续聊或取消这个 Agent。后者需要独立的原生 CLI、API 或其他执行适配。

例如主 Agent 可以通过 MCP 委派 DSH，Bridge 随后通过 DSH 的 CLI 或 HTTP 执行；这不会把 DSH 变成 MCP 调用方。见[接入方式比较](integration-methods.md)与[DSH 章节](agents/dsh.md)。

## 不打开窗口的首次接入

先运行 `agentbridge mcp nodes --json` 获取实际节点ID，再用一次稳定的操作ID接入：

```sh
agentbridge mcp attach --node <节点ID> --operation-id <本次接入操作ID>
agentbridge mcp operation --node <同一节点ID> --operation-id <同一操作ID>
agentbridge mcp export --node <节点ID>
```

`attach` 需要接入操作ID；回应未知时只查询同一个 `operation`，不要换ID或重复接入。操作收据确认接入后，再执行 `install` 或 `export`。命令与桌面共用 `agentbridge-desktop` profile，也支持 `AGENTBRIDGE_DESKTOP_PROFILE` 或显式 `--profile-dir`；Windows与WSL进程使用各自的本地profile。

探测会标明时间。连接和工具观测有效期60秒；配置文件或DSH profile改变后旧观测立即失效，需重新探测。服务端能列工具，只证明服务端可启动，不证明原生Agent已连接、拥有主角色或完成真实委派。

## 同机其他节点有待核对操作

`alpha.51.recovery.2` 公开预发布将节点管理保护落实到原节点、同一安装或共享目录。独立的健康节点仍可接入；被阻塞的按钮会说明原操作待核对，可从设置的“未确认操作”按原ID查询。机器管理、协作关系、来源缺失或旧后台未提供作用域时仍保持保护。独立节点接入成功不会清除其他节点的 unknown，也不证明其原任务完成。该修复已随0.6.0-alpha.51.recovery.2公开。
