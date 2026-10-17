# AgentBridge Windows

当前GitHub预发布 **alpha.26**：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.26/AgentBridge-0.6.0-alpha.26-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.26/SHA256SUMS.txt)。修复原Linux alpha.24无法连接及后续维护受阻；Windows停止旧后台后重开新版，沿原机器重连，再按需维护升级。冻结源码与边界见[专项](../doc/iterations/I06/ssh-alpha24-upgrade.md)。下方alpha.25段落保留原发布时点。

当前 GitHub 预发布 **0.6.0-alpha.25**：修复Windows查询原请求被未完成上下文误导到NOT_CONFIGURED的问题；[程序、实际证据与限制](../doc/iterations/I06/windows-context-recovery.md)。旧后台仍在运行时，在“设置 → 后台运行 → 停止后台并退出”，再打开新EXE并查询原请求；保留原节点、请求和历史。本次修复无须升级SSH后台。

## GitHub Windows 下载

最新修复和下载以 alpha.26 为准；alpha.24 停止协调的历史实测保留于[当片交付与验证](../doc/iterations/I07/native-stop.md)。

GitHub 最新 Windows 预发布为 [0.6.0-alpha.25](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.25)，可直接[下载 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.25/AgentBridge-0.6.0-alpha.25-Windows-x64.exe)及[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.25/SHA256SUMS.txt)。稳定历史版本仍为 0.5.0；完整 I07C/I06C 和正式 0.6.0 尚未准出。Windows 用户下载附件双击即可运行，无需自行编译、安装 WSL 或 Node.js。[发布与升级](../doc/iterations/I06/windows-context-recovery.md)。

旧后台仍运行时，在新窗口“设置 → 后台运行 → 停止后台并退出”后重新打开；不删除机器、节点或历史。SSH机器另需升级原远端后台后重新连接和扫描。

按“机器 → Agent 节点 → 会话 / 任务”管理 Claude Code、OpenCode、Codex。节点不绑定项目、模型或供应商；用户指定主 Agent 与可连接的子 Agent，主 Agent 可以真实发现、委派和读取子结果。

当前源码与预发布为 **0.6.0-alpha.23 / I07C首批**：在“小队协作”登记成员职责与限制、组队并使用公共文档、群消息和任务板；“持续协作”由用户授权自动成员与预算，本批真实验证Claude主角色原会话续接。完整 I07C/I06C 仍未准出，[实际证据与限制](../doc/iterations/I07/automation.md)。本文旧版操作说明保留在下方；新版使用节点上的“接入”“设为主 Agent”“开始会话”，端点连线后保存授权。完整资料见 [文档入口](../doc/README.md)和[整体交付状态](../doc/project-plan.md)。

## 运行与使用

1. 关闭旧版窗口，双击 `desktop/release/AgentBridge-0.5.0-Windows-x64.exe`。便携版也已复制到本次 Windows 产物目录。第一次打开需要解包；无需开两个终端。
2. “机器与 Agent”自动显示本机和各 WSL 环境及工具。WSL 标明物理宿主；空机器也显示。
3. 按空格勾选发现的工具，点击“接入所选 Agent”。不要求项目、模型、供应商，不在扫描时调用模型。
4. “协作关系”选择主 Agent 与允许连接的子 Agent，保存。
5. “会话”中新建会话，选择主节点并启用已配置协作，输入需求发送。需要操作已有文件时展开可选执行目录；留空使用独立目录。
6. “任务看板”和“最近委派”查看父子执行，进入过程处理原生权限请求或取消。完成后可继续同一个原生会话。

可用示例：将 Windows Claude Code 设为主节点、WSL OpenCode 设为子节点，发送“请发现子 Agent，委派给 OpenCode 只读分析目标目录，再读取实际结果并总结”。给子节点明确目标目录；它不会自动操作主节点的文件系统。

工具登录和配置由原生 CLI 管理。OpenCode 继承原生配置及 CLI 记住的最近模型，已实际验证本机 DeepSeek-V4.1-Flash。新会话重新读取偏好，续聊保持原 Session。界面没有模型或供应商设置。

Windows 目录使用原生 C:\、D:\ 路径；WSL 使用 Linux 路径或转换后的 /mnt/<盘符>。跨发行版目录拒绝。共享目录的运行、等待和未知任务继续互斥，来源离线保留占位。其他机器的已确认可用节点不因单个来源未确认而全部阻塞。

关闭窗口不取消原生任务，重开读取原任务与收据，不自动重发 Prompt。普通会话默认隐藏连接验证，勾选“显示连接验证记录”可查看旧记录。旧模型覆盖会话保留原绑定，不能在新节点规则下静默换配置续聊。

## 构建与测试

从仓库根目录运行：

```bash
npm ci
npm ci --prefix desktop
npm run desktop:build
npm run desktop:pack
npm run desktop:dist
npm test
npm test --prefix desktop
npm run lint
npm run typecheck
```

可执行文件在 `desktop/release`。窗口代码在 `desktop/src`；机器、节点、MCP 与原生后台在 `desktop/electron`；OpenCode 宿主、控制器和 Driver 在根 `src`。

偏好、机器目录、节点关系和未确认操作保存在 Electron userData；Windows 原生任务在其中 `windows` 目录。WSL 数据默认位于 `~/.local/state/agentbridge`；每个新会话上下文单独保留原生任务和引用。迁移前备份机器目录，保留原实例与任务 ID。`AGENTBRIDGE_DESKTOP_PROFILE` 用于隔离自动测试，`runtime.json` 用于普通启动诊断。

便携后台保存持久 Electron/Node 运行资源，避免窗口临时解包目录清理使原任务失效。原请求不明时自动只读核对，有证据才解除保护；真实未知执行继续占用来源节点。

## 实际边界

- 已真实验证 Windows Claude ↔ WSL OpenCode、Windows Claude ↔ WSL Codex，两个方向均有子原生回复与父结果证据。
- Windows Codex 0.145.0 的原生配置模型被账号拒绝，不能声明真实回复可用；WSL Codex 0.161.0 回复和主从协作通过，原生续聊接口仍返回 `list_turns is not supported yet`。不自动切换模型或另建会话冒充续聊。
- Windows 和 WSL 是同一物理宿主的执行环境；远程物理电脑接入属于 I06。
- 保留原生权限控制；Codex 执行接口尚不支持桌面代答原生表单。Claude 原生问题表单仍有既有适配边界。
- 程序未商业签名；自动升级、托盘、成本统计、全量历史分页未纳入本次。

[I05 节点模块](../doc/iterations/I05/node-design.md)、[协作模块](../doc/iterations/I05/collaboration-design.md)、[验收报告](../doc/iterations/I05/acceptance.md)。I04B–I04G 的旧交付与修复记录保留在对应迭代目录。

## 最新发现修复候选

[AgentBridge-0.6.0-alpha.3-Windows-x64.exe](release/AgentBridge-0.6.0-alpha.3-Windows-x64.exe)修复 Codex 将内部临时 Agent 列表误作 Bridge 节点列表的问题。桌面 89/89、真实 Codex → Claude 自然语言协作、包资源比对和普通 EXE 启动/关闭/重开通过；[交付与覆盖限制](../doc/iterations/I06/codex-discovery-fix.md)。旧后台仍在时，打开新 EXE，从新窗口“设置 → 后台运行 → 停止后台并退出”停止它，再次打开新 EXE；普通关闭窗口会保留旧后台。已有模型/账号/权限配置继续由原生工具继承。

## alpha.5 SSH 兼容复用历史候选

使用 [AgentBridge-0.6.0-alpha.5-Windows-x64.exe](release/AgentBridge-0.6.0-alpha.5-Windows-x64.exe)可以核验并复用可信 alpha.2/alpha.3/alpha.4 远端后台，并清除成功重连后缓存的旧错误。打开新 EXE，从新窗口“设置 → 后台运行 → 停止后台并退出”停止现有旧后台，再次打开新 EXE 并重新连接原机器；不需删除远端状态、重新安装或重新添加机器。复用保留旧 daemon 原生适配代码，未实现自动升级。[交付与实际测试](../doc/iterations/I06/ssh-error-recovery.md)。


## 当前 alpha.9 节点图与管理候选

使用 [AgentBridge-0.6.0-alpha.9-Windows-x64.exe](release/AgentBridge-0.6.0-alpha.9-Windows-x64.exe)。旧后台仍运行时，从新窗口“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；已有节点、关系、会话和历史保留。可信 alpha.2–alpha.8 SSH 后台可以复用，客户端不自动升级原远端。

在节点图中接入工具并设主，从主节点右侧端点拖至子节点左侧端点，点击“保存授权”后生效。端点回车开始键盘连线、方向键切换目标、回车连接、Esc 取消；删除连线也先改草稿再保存。移动机器组/节点、缩放和平移自动保存独立布局。保存回应未知时只查询原操作；另一窗口更新时保留草稿并重新校验。点击节点“开始会话”选择目标，账号、模型与权限继续继承原生工具。

两条独立 SSH 原生链、普通无 debug EXE 的关闭/重开、最终包资源与图交互证据分别见 [6B 报告](../doc/iterations/I06/graph-implementation.md)。I06C 的完整故障、连接维护和升级回滚未完成，此包是开发候选。

主 Agent 有皇冠及强调色，只显示右侧输出端点；普通/子节点只显示左侧输入，授权箭头绕过卡片。按住鼠标中键在空白、节点、按钮、端点或机器组上拖动可平移全图，滚轮缩放；松开后保存视口，布局未确认时只查询原保存。改变位置不改变授权，授权仍须显式保存。

先正常关闭旧窗口，再打开新 EXE，避免单实例规则只是把旧窗口置前。alpha.8 即使仍连接 alpha.5 旧后台，也允许本机布局拖动；界面会提示尚未同步，授权编辑需支持图接口的后台。左键拖 Agent 卡片或机器标题/背景，中键平移全图；点击“自动整理”把主 Agent 所在机器组排在左侧。现有手动位置不会随轮询重排。[原因与验证](../doc/iterations/I06/graph-drag-fix.md)。

当前 alpha.9 保留“机器与 Agent”单一图页面，包含协作授权和最近委派。每个机器组提供“添加 Agent”，卡片提供“接入”“断开”“移除”；后两者有明确确认，保留安装/配置与历史，忙碌/等待/unknown/离线需先核对。移除项可在原机器按同一身份重新添加，权限需重新配置。[行为、程序与证据](../doc/iterations/I06/node-management.md)。

## alpha.10 机器连接管理

2026-10-13 / alpha.10：机器 SSH 连接编辑、确认断开/移除、原身份恢复、已观察历史持久化/阅读及事件游标缺口分页补偿已实现；桌面 136/136、真实本机 TCP SSH/生产 daemon 隔离恢复和 Windows 界面分别通过。完整 I06C、升级回滚和正式 0.6.0 未准出。

在“机器与 Agent”页下方对应 SSH 机器操作区，使用“编辑连接”“断开”“重新连接”“移除机器”；移除有范围确认，恢复在“设置 → 已移除机器”。已接入机器绑定原 SSH 用户；另一用户请新增机器。关闭连接详情不再断开已有机器。移除保留远端安装、原任务、会话和布局，清除保存的 SSH 凭据并撤销当前相关协作授权；恢复后需重新连接且不自动授权。历史快照明确标记，不能继续/控制或用于确认原 pending。

程序：[AgentBridge-0.6.0-alpha.10-Windows-x64.exe](release/AgentBridge-0.6.0-alpha.10-Windows-x64.exe)。先关闭旧窗口，如仍连旧后台，用设置中的“停止后台并退出”后重新打开新版；不要删除原数据或未知 ID。可信 alpha.2–alpha.9 仅复用，不自动升级远端。完整接口、实测和未完成范围见 [6C 首批](../doc/iterations/I06/machine-management.md)。

## alpha.12 后台维护候选

当前源码候选为 0.6.0-alpha.16。在机器图 SSH 机器的“后台维护”中确认升级、回滚、停止或卸载；显示实际与目标版本。忙/unknown 时不能切换，回应未知只能查询原操作。停止保留安装/历史；卸载只删已验证的 Bridge 安装文件，原生 CLI、项目、账号及历史状态保留。旧后台安全停止要求支持 pidfd 的内核，当前独立服务器实测和完整准出状态见 [I06C 收尾](../doc/iterations/I06/final-delivery.md)。普通关闭窗口继续保留中央后台；用新程序更新中央时通过设置的“停止后台并退出”再打开新程序，不直接覆盖旧运行资源。

## alpha.18 Windows 运行缓存修复

已生成本地 Windows x64 修复候选。运行旧程序的“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；无需删除缓存或编辑 pending.json。共享缓存清单自引用已兼容，只有原意图能证明未派发的 Windows OpenCode 旧提交才记明确拒绝，其他未知记录继续原 ID 查询并显示原因。程序、测试与未测范围见 [专项交付](../doc/iterations/I06/runtime-recovery.md)。
