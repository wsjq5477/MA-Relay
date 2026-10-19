# CT-01：Agent 连接能力与原关系拒绝恢复

交付日期：2026-10-19（北京时间）。关联 AB-F02/F07/F10/F11/F12/F13、M01/M02/M03/M06/M07/M08。工作从10月18日开始，原始证据目录保留 `2026-10-18`，JSON 时间为 UTC。本片是 alpha.28 后的未发布源码，未重建 EXE、未升级用户后台，完整 I06C/I07C 未准出。

## 1. 需求与完成范围

按[接入矩阵](../../agent-integration-matrix.md)的连接目标推进 CT-01；自动续接、多用户不作为当前目标。已完成此前中断的能力投影、界面限制和普通委派测试集成，并修复集成中发现的原关系拒绝不能恢复问题。原有未提交工作全部保留。

| 需求 | 当前行为 | 验证 |
| --- | --- | --- |
| 分清调用方和被调用方 | 六工具都可执行/接收普通委派；仅 Claude/OpenCode/Codex 声明调用 Bridge MCP | 注册表、snapshot、MCP `list_agents` 和生产委派链 |
| 能力未知不能当支持 | 八项能力为 true/false/null，静态注册是上限；远端字段只可收窄 | 未注册工具、缺字段、伪造 true、来源不匹配、显式禁止反例 |
| 界面与后台一致 | 直接执行、主节点、连线源/目标、协作勾选及保存/派发分别检查对应方向 | React SSR、Windows Edge 生产前端及后台反例 |
| 历史与原请求不被新门槛截获 | 旧关系展示保留；原请求先查询；unknown 只查原 ID | 原请求重开、已存在委派、丢回应、原拒绝恢复 |
| 能力拒绝不永久锁死草稿 | 持久保存本机确定的原关系拒绝；只凭匹配原 operationId 的结构化收据解除等待 | 重启/丢回应、外来收据、远端同码错误反例 |

## 2. 完整能力契约

节点 snapshot 和经典 MCP `list_agents` 可选投影 `connectionCapabilities` 与 `capabilitySource`，保留原身份、路由和工具方法。八项分别是 `execution`、`delegation`、`bridgeMcp`、`resume`、`cancellation`、`permissions`、`forms`、`verification`。true 是实现声明，false 是不支持，null 是未知；不是安装、账号、模型或远端实测证明。

| 工具 | 执行 / 接收普通委派 | 调用 Bridge MCP | 权限 / 表单 / 独立验证 | 驱动 |
| --- | --- | --- | --- | --- |
| Claude Code | true / true | true | true / false / true | native-cli |
| OpenCode | true / true | true | true / true / true | cli-http |
| Codex | true / true | true | false / false / false | native-cli |
| Hermes / Pi / DSH | true / true | false | false / false / false | native-cli |

六工具都声明原会话续接和取消实现，真实版本覆盖仍按各工具报告。`capabilitySource` 为 `{kind:'static-adapter', adapterId, driver}` 或 `{kind:'unknown'}`；不得放入工厂、执行路径、模型、账号或认证配置。来源不匹配、显式未知或能力缺失不能借静态 true 扩权。老快照没有新字段时，仅对内置已知适配器保留既有执行/被委派兼容、原三工具保留 MCP 调用兼容，缺失控制能力在前端显示未知；未知工具不按名称猜测。

保存新关系时，主节点需可执行且能调用 MCP，子节点需能接收委派。新协作任务在写入执行意图前核验调用方；经典 delegate 的子任务仍为 `collaboration:false`，Hermes/Pi/DSH 无需注入 MCP 即可接收普通任务。新门槛不会重写旧关系，也不会阻止原请求/原委派收据查询。原生小队成员准入继续独立执行既有 `teamCollaboration` 规则。

界面上新三工具可以开始直接会话、成为连线目标；不能成为主节点/连线源。历史不支持调用 MCP 的主节点仍展示，关闭协作后可直接会话。显式未知执行能力/未知适配器不可发送；健康或在线不替代能力判断。

## 3. 本机拒绝、丢回应与恢复

[注册表](../../../desktop/electron/builtin-adapters.cjs)用本进程 WeakSet 标记本机确定的派发前能力拒绝。公开错误码 `COLLABORATION_CAPABILITY` 本身不是证明；来自 JSON/RPC 的同码异常不能据此结算未执行。

[图操作台账](../../../desktop/electron/graph-operations.cjs)先保存原关系意图，再调用关系保存。仅 `saveCollaboration` 的本机标记错误可持久为 rejected，后续 `collaborationOperation` 按原 ID 返回原拒绝。其他操作类型、裸远端同码、not_found、缺少或外来 operationId 收据保持 unknown；保存/查询两条路径都校验收据 ID。

[界面恢复](../../../desktop/src/graph-state.ts)只在结构化原收据匹配 `operationId`、`state:'rejected'` 和该拒绝码时清除 `relationPending`，保持原 base 与草稿供修正。丢回应、刷新和后台重开都只查询原 ID，不再次保存，不把拒绝改成任务成功或取消，不把该码加入任意裸错误放行表。

无新 RPC、无数据库迁移、无 SDK/ACP 接入；节点身份、原生认证/模型配置、Session 绑定和未知占位规则保持。实现入口：[后台网络](../../../desktop/electron/agent-network.cjs)、[Coordinator](../../../desktop/electron/coordinator-service.cjs)、[界面能力](../../../desktop/src/connection-capabilities.ts)、[协作选择](../../../desktop/src/CollaborationChoice.tsx)。

## 4. 实际验证与原始证据

环境：WSL Ubuntu / Node22.23.1；Windows Node / Edge155.0.4283.45，冻结生产前端。全工程计数含父/子测试，定向属于全量子集，不能跨模块相加。本轮真实模型调用0；CLI 执行均为受控协议夹具。

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 定向能力/原拒绝/界面/普通委派 | 32/32，无跳过 | [TAP](../../../artifacts/connection-capabilities/2026-10-18/targeted-final.tap) |
| 桌面完整串行回归 | 503/503，无跳过 | [TAP](../../../artifacts/connection-capabilities/2026-10-18/desktop-final.tap) |
| 核心工程 | 45/45，无跳过 | [日志](../../../artifacts/connection-capabilities/2026-10-18/core.log) |
| lint、根类型、桌面类型与生产构建 | 通过；保留既有大于500KB chunk提示 | [lint](../../../artifacts/connection-capabilities/2026-10-18/lint.log)、[类型](../../../artifacts/connection-capabilities/2026-10-18/types.log)、[前端](../../../artifacts/connection-capabilities/2026-10-18/frontend.log) |
| Windows Edge 能力与恢复 | 5组/5图通过，页面错误0 | [报告](../../../artifacts/connection-capabilities/2026-10-18/ui/2026-10-18T20-00-45-872Z/ui.json)、[关系图](../../../artifacts/connection-capabilities/2026-10-18/ui/2026-10-18T20-00-45-872Z/02-directional-graph.png)、[历史主节点](../../../artifacts/connection-capabilities/2026-10-18/ui/2026-10-18T20-00-45-872Z/05-historical-leader.png) |
| 文档及差异检查 | check-docs通过，161份Markdown/14对模块资料/3232条本地链接；git diff --check通过 | [文档报告](../../../artifacts/connection-capabilities/2026-10-18/docs.log)、[交付汇总](../../../artifacts/connection-capabilities/2026-10-18/verification-summary.json) |

普通委派用[生产链测试](../../../desktop/tests/native-delegation.test.cjs)经过 Coordinator → Claude 受控父进程 → stdio MCP/broker → AgentNetwork → MachineHost → NativeCliHost → 三种协议子进程。每种工具覆盖成功、取消、取消/自然完成竞争；原 ID 去重/改输入冲突、父作用域/机器归属、pending、丢提交回应后的 unknown、完整观察器重开查询和不重放均通过。取消收据与实际任务终态分别断言。[专门日志](../../../artifacts/connection-capabilities/2026-10-18/native-delegation.tap)及[受控执行摘要](../../../artifacts/connection-capabilities/2026-10-18/delegation-attempts.json)不是真实工具或账号推理证据。

Windows 浏览器使用9个合成节点、3台合成机器、真实生产 renderer；只允许1次模拟关系保存并故意丢回应，原 ID 恢复查询3次，真实后台调用0、模型0、禁止操作0。刷新仅查询后解除 pending，草稿和原关系保留；历史 Hermes 主节点仅打开直接需求表单，没有提交需求。[脚本](../../../desktop/tests/windows-connection-capabilities.cjs)。截图已逐图检查方向限制和历史表单。

失败记录保留：图台账修复前反例见[graph-before](../../../artifacts/connection-capabilities/2026-10-18/graph-before.tap)，修复后见[graph-after](../../../artifacts/connection-capabilities/2026-10-18/graph-after.tap)。首轮定向31/32因假 Conversation 缺 updatedAt，首轮全量502/503因崩溃夹具缺 adapter 被正确拒绝；分别修复夹具，未放宽产品身份/准入或 SIGKILL 断言。[首次定向](../../../artifacts/connection-capabilities/2026-10-18/targeted-missing-conversation-time.tap)、[首次全量](../../../artifacts/connection-capabilities/2026-10-18/desktop.tap)。浏览器首次失败是快照缺 directory、文本选择器歧义和历史页面偏好，原日志与失败图保留在同证据目录。进程/套接字测试使用正常本机执行权限，未通过削弱测试绕过隔离环境限制。

## 5. 发布、限制与下一步

[源码观察清单](../../../artifacts/connection-capabilities/2026-10-18/source-manifest.json)覆盖329个源码/测试/素材/工程文件，排除文档、生成目录和私有状态；[最终核对](../../../artifacts/connection-capabilities/2026-10-18/source-verification.json)记录交付前是否变化。[汇总](../../../artifacts/connection-capabilities/2026-10-18/verification-summary.json)保存各层结果。

本次 GitHub API 元数据核对仍为预发布 alpha.28，目标源码 `3df2534ee862afd91c6f0c21e81982099d856789`，EXE129884570字节，API digest `6d85f667c2e1009e26cd83f00afb09ad540b27787e71c5a2784af0e64c4602ef`；本轮未重新下载二进制，不冒充新的完整下载/包核验。[元数据记录](../../../artifacts/connection-capabilities/2026-10-18/release-state.json)。旧 ui.2/poll.4 候选不包含 CT-01。

CT-01 源码与所列受控验收完成，CT-02继续待验：当前 WSL 常规发现未检出 Hermes/Pi/DSH，未证明全磁盘无安装；没有替用户安装、登录或更改原生凭据。[发现记录](../../../artifacts/connection-capabilities/2026-10-18/native-cli-installation.json)。下一步在已安装并配置的原生环境中逐项验证真实执行/受委派/回答/取消与恢复，再冻结新 EXE 并独立验证 SSH。可选 ACP、公共 MD 与显式上下文仍按矩阵作为后续目标；不以受控链替代这些真实证据。
