# AgentBridge Windows

2026-10-20 **0.6.0-alpha.34已预发布**：当前整合源码和新Tag已推送，标签冻结`1af4dab`，EXE与SHA-256附件已上传并通过匿名完整下载核验。包含OpenCode1.x/2.x、独立MCP、CT-04/CT-05及既有alpha.30–33修复；Windows旧后台门禁、包/普通EXE与未测边界分别见[交付记录](../doc/iterations/I07/alpha34-release.md)。完整I06C/I07C仍未准出。

2026-10-20发布前准备记录 **0.6.0-alpha.34**：用户授权提交当前完整源码并发布Windows EXE，含OpenCode1.x/2.x、独立MCP、CT-04/CT-05与既有alpha.30–33整合，补alpha.33精确daemon清单。固定源码构建、普通EXE及公开完整下载结果完成后在[本轮交付](../doc/iterations/I07/alpha34-release.md)登记；当时仍在发布准备阶段，旧包/标签范围不变。

当前GitHub预发布 **0.6.0-alpha.33**：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.33/AgentBridge-0.6.0-alpha.33-Windows-x64.exe) · [校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.33/SHA256SUMS.txt)。完整公开下载已核验。先停止旧中央并退出后重开；远端升级仍需在原机器空闲时确认，不自动重发原维护。 [交付、校验与升级边界](../doc/iterations/I07/maintenance-persistence.md)。

当前本地候选为0.6.0-alpha.32.integrated.3：已整合公开alpha.30–32及本工作区MCP/CT-04，公开仍alpha.32。包来源、验证、原EXE摘要与未测边界见[整合交付](../doc/iterations/I07/integrated-source.md)；不能把本地候选叫作已发布版本。

## 历史alpha.32下载与升级

[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.32/AgentBridge-0.6.0-alpha.32-Windows-x64.exe) · [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.32/SHA256SUMS.txt)。公开完整下载已核验：129955724字节，SHA-256 `87adda262cde786ba602971c4d03c5b25a6a0da9ac00e3cdfaba1e7fc5a14440`。

修复issues #8/#9：OpenCode仅2.x，旧1.x配置恢复直接报版本要求；本机unknown不再禁用另一空闲SSH的维护。先在设置显式停止旧中央并退出，再开新EXE；原OpenCode升级2.x后重扫接入。SSH服务器需在原机器空闲时查看维护预览并确认升级，EXE不会自动替换远端。原unknown继续查询原ID，不重发。

核心51/51、桌面543/543、Windows纯CJS95+9、生产前端4+10组、普通无调试EXE5组通过，均为受控合成、模型0。用户profile、真实原生OpenCode与独立SSH升级未实测；[冻结源码/完整证据与限制](../doc/iterations/I07/version-management-recovery.md)。下面内容仅保留各历史版本范围。

## 历史alpha.30下载与历史详情恢复

[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.30/AgentBridge-0.6.0-alpha.30-Windows-x64.exe) · [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.30/SHA256SUMS.txt)。停止旧后台并退出后重开新EXE；SSH原daemon还需空闲时从后台维护确认升级alpha.30，再查询原会话。实际backend有原对象则读取原轮次，旧Agent失配则只读；仅历史或缺失只影响详情，不再锁住其他新建会话。顶层同步故障和unknown保护继续生效。

工程/Windows生产前端/普通EXE与公开完整下载核验见[alpha.30交付](../doc/iterations/I07/history-detail-recovery.md)。保留原ID/Session/历史，不自动重发；用户现场未复测。下面alpha.29及更早说明保留当次冻结范围。

历史GitHub预发布 **0.6.0-alpha.28**：修复issue #5，保留alpha.27的Codex/本地持久化恢复等既有修复。

[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.28/AgentBridge-0.6.0-alpha.28-Windows-x64.exe) · [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.28/SHA256SUMS.txt) · [预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.28)。下载附件双击即可运行，无需自行编译或安装Node/WSL；原生Agent工具仍需自行安装登录。

先在“设置 → 后台运行 → 停止后台并退出”，再打开新EXE，到“未确认操作 → 查询原请求”。只在原认证daemon持久拒绝和原意图严格匹配时结算；裸NOT_CONFIGURED继续unknown，不重发原需求、保留ID/参数/时间/历史。支持既有收据接口的可信远端无需为此升级；更旧版本缺接口或字段时保守保留unknown。

桌面317/317、核心45/45、Windows合成契约93/93、受控TCP SSH丢响应/daemon重启及普通EXE6组通过，模型0。未复测用户故障profile/独立服务器或真实模型。稳定历史0.5.0；完整I06C/I07C及正式0.6.0未准出。[完整交付与证据](../doc/iterations/I06/daemon-rejection-recovery.md)。

## 运行与使用（历史0.5.0操作说明）

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
