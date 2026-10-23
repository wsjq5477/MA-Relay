# OpenDesk 适配验证

## #19/#20 修复验证

EXE与校验文件已公开，匿名完整下载HTTP200、130190265字节及SHA-256一致；[发布核验](../../../iterations/I08/alpha52-release.md)。

2026-10-23，alpha.52公开版；M06-F05。定向生命周期、中央资源与原请求回归131/131，远端/断开身份契约9/9，Windows生产前端12组通过、pageErrors=0；实际Windows进程检测识别日常OpenDesk运行并在隔离文件拒写，模型0。共享计数不跨模块累加；桌面共享全量841/841、核心68/68，类型/lint通过；普通无调试Windows EXE8组通过；包54后台/84Core/1702Linux与冻结源码一致，模型0。原失败、命令、原始证据及未测项见[本轮记录](../../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

## 连接身份与节点管理验证

| 场景 ID | 场景与实际结果 |
| --- | --- |
| T-M06-OD-200 | 生产Coordinator受控路由+生产前端两入口：独立B一次接入、A的原ID/参数/时间/错误保留；实际原生网关和模型本轮未调用。 通过；2026-10-23，WSL Node22.23.1/Windows Node+Edge，模型0。 |

隔离修复基线桌面777/777，Windows生产前端受控10组通过；当前集成及普通EXE已随0.6.0-alpha.51.recovery.2公开，分层证据见发布记录。[原始证据、环境与未测项](../../../iterations/I08/connection-identity-node-scope.md)。

## 空默认字段管理兼容（2026-10-22，alpha.47本地候选）

T-M06-MCP02DEFAULT / M06-F02：已安装Desktop0.3.9原包schema真实补入 `headers:{}` 后，最终候选资源识别已登记归属、重复添加保持身份及原生字节；原生worker连接/7工具/正式只读调用、恢复、撤权/重装、带默认值移除和工具清空共7组通过。受控父进程、隔离原生目录、模型0；不是原生UI或自主父模型验收。WSL定向44/44、桌面760/760、核心68/68共享计数不叠加；未触碰日常配置。[修复前后与限制](../../../iterations/I08/opendesk-mcp-defaults.md)。下节alpha.46现场遗留的默认字段兼容缺口由本候选修复，公开alpha.46仍保留原行为。

## 日常原生父模型只读发现（2026-10-22，alpha.46）

修复旧诊断条目时，首次运行中改盘被退出时的旧内存配置覆盖；用户从托盘退出后，确认进程 0，离线备份替换并重新启动。实际 OpenDesk MCP 子进程使用正式端点，原生日志发现 7 工具；通过日常网关提交 1 条验收 Prompt，原生父模型实际调用 `mcpmgr-AgentBridge__list_agents` 1 次，原生持久工具记录为 `success`、返回 7 个获准节点。子任务 0，没有重放用户原查询。原生页面与父模型自主委派未验，新增事实不并入既有回归计数。启动会补入空 `headers`，Bridge 严格所有权比较的默认字段兼容仍保留。[修复、失败复报与原始证据](../../../iterations/I08/opendesk-mcp-diagnostic-repair.md)。

## 后续原生组件验收（2026-10-22，alpha.46）

已安装OpenDesk/DSH原生MCP组件协议分别5组/6组通过；两条生产协作链各完成1个真实Claude子任务，并分别只读重开原任务/Session/结果，无重放。原生父模型自主决策与日常原生页面未验；产品运行代码与EXE未变，不把新增验收与原全量计数叠加。[脚本、初次失败、准确层级和未测项](../../../iterations/I08/mcp-native-acceptance.md)。

2026-10-22 / alpha.46：共享桌面758/758通过，含Node导出与恢复保持、生成条目实际stdio初始化/7工具/按身份调用及撤权后拒绝。该证据是Bridge端点验证，不代替用户原生Desktop正式调用或模型委派。[本轮包与Windows记录](../../../iterations/I08/mcp-open-recovery.md)。

2026-10-22 / alpha.43：OpenDesk CLI/Desktop前端执行门禁修复；生产注册表遍历回归8/8，桌面全套722/722，生产界面10组与包源码核验通过，新增Prompt0。Windows实际包内窗口4组、普通无调试便携EXE4组均通过。首次失败和未测边界见[本轮专项](../../../iterations/I08/opendesk-ui-admission.md)。

当前现场日期2026-10-22，构建/受控基线2026-10-21，关联M06-F05。当前方案使用未修改的原生CLI HTTP与桌面网关接口；上一轮alpha.41的专用协议测试不算此方案验收。[本轮记录与原始证据](../../../iterations/I08/opendesk-existing-interfaces.md)。模型、Windows原实例和受控夹具分开计数。

| 用例 | 场景与实际结果 | 证据 |
| --- | --- | --- |
| T-M06-OD-01 | 已有HTTP/WebSocket实际传输、后台进程、原Session/同连接续聊、Bridge同ID去重及改输入冲突通过；原生执行为受控夹具 | `desktop/tests/opendesk.test.cjs` |
| T-M06-OD-02 | 丢HTTP回应即使历史completed也保持unknown；Desktop断线后旧会话不可续聊；只读核对不启动替代连接、不重发；取消ACK不冒充终态 | 同上 |
| T-M06-OD-03 | MCP数组保留、冲突/移除，独立MCP委派与托管scope提前拒绝 | `opendesk.test.cjs`、`connection-capabilities.test.cjs` |
| T-M06-OD-04 | 已有网关身份核对，异机身份和非原生目录在输入前拒绝；已知npm入口启动器保持原安装 | `opendesk.test.cjs` |
| T-M06-OD-05 | 原机器/节点的行配置与原生目录/断线说明；完整生产界面运行结果见专项 | `agent-configuration-ui.test.cjs`、`ui-opendesk-configuration.cjs` |
| T-M06-OD-06 | 已安装未修改CLI 0.3.8由生产worker启动；HTTP认证/缺失凭据拒绝/空列表只读/缺失会话只读/创建读取空会话五组通过，Prompt和模型0 | [真实CLI探测](../../../../artifacts/opendesk-existing/2026-10-21/native-cli-probe.json) |

## 原生 MCP 可见性真实修复（2026-10-22，alpha.45）

在**用户真实 OpenDesk Desktop 0.3.9** 上修复“原生 MCP 列表看不到 AgentBridge”。诊断顺序与结果：

1. 确认原生读取位置与格式：`%APPDATA%\opendesk\setting.json` 的 `applications.mcpmgr.servers`，原生 `parseServersFromConfig(){return this.config?.servers||[]}`，启动时自动连接 `enabled` 项。对照实验：最小自写 MCP 服务（node）可连接并 `discovered 1 tools` → 位置/格式正确，问题在 Bridge 侧。
2. 首次实测：`Initialized with 1 server configs` → `Connecting to "AgentBridge"` → `Connected ... listing tools...` → **`命令未找到`**。
3. 根因一（Bridge 真 bug）：stdio 服务不响应 2026-07-28 协议的 `server/discover`（返回 JSON-RPC 错误），严格客户端判定连接失败。已修复并补受控 2 例（`desktop/tests/mcp-client-protocol.test.cjs`）。
4. 根因二（启动器）：OpenDesk 无法启动 Bridge 的 Electron 运行时（`命令未找到`；整目录复制到 D 盘 → `MCP error -32000: Connection closed`），系统 `node.exe` 可启动同一 `mcp-client.cjs`。已改为 OpenDesk 条目**优先真实 Node 启动器**、状态报告 `launcher`、Electron 回退时界面提示；受控 1 例（`mcp-integration.test.cjs` launcher 偏好）。
5. 最终真实结果（模型0，用户真实配置）：写入稳定条目并**完全重启 OpenDesk** 后，原生日志 `[mcpmgr] Connected to "AgentBridge", discovered 7 tools`；“MCP 管理 → 已安装 MCP”可见 AgentBridge/STDIO/已连接/7 工具。证据：`artifacts/mcp-open-integration/evidence/opendesk-native-mcp-verified.txt`（含失败与成功两阶段）。

**边界**：该条目是可见性**诊断条目**（descriptor token 非真实授权），**不能写成工具调用已通过**；真实授权需用 alpha.45 在 Bridge 对 OpenDesk Desktop 点“添加 Bridge MCP”（覆盖同一 `id=agentbridge`）后重启验证；工具实际调用/授权/结果归属未验；Desktop 原生删除/禁用/编辑未验。回归：桌面 **753/753**（含本项新增 3 例）、根测试直接运行 **66/66**（`npm test` 外壳曾超时）、根 typecheck/eslint src/build 与桌面 tsc 通过。alpha.45 候选 130177443 字节、SHA-256 `35674f6c…`、`verify-package --portable` passed、未签名、未公开、未在真实 Windows 启动（T16 待执行）。[§14](../../../iterations/I08/mcp-open-integration.md#14-opendesk-原生-mcp-可见性修复2026-10-22alpha45)

## OpenDesk CLI 无 MCP 管理面（2026-10-22 晚，第一优先级缺口，结论已升级）

独立MCP的既有用例（T-M06-OD-03）只证明 **Bridge 侧**的写入/保留/冲突/撤权行为。随后两组原生核对把结论从“未确认是否读取”升级为“**CLI 0.3.8 不存在可供 Bridge 写入并被原生读取的 MCP 管理面**”：

- `opendesk plugins list`：11 个 builtin 插件（`browserboost`/`clawhub`/`feishu`/`matrix`/`modelscope`/`opencodego`/`opendesk-account`/`skill0`/`skillhub`/`skillsmp`/`weixin`）中**没有任何 MCP 管理插件**；`matrix`/`modelscope` 只是内容注册表 source。
- `opendesk plugins tools`：`No plugin tools are available.`；插件运行时清单同样无 MCP 管理入口。

独立MCP的既有用例（T-M06-OD-03）只证明 **Bridge 侧**的写入/保留/冲突/撤权行为；本轮补充的原生核对显示 OpenDesk 0.3.8 并未读取该条目：

- `OPENDESK_CONFIG_DIRECTORY=<临时目录> opendesk tools list` 只列出 `filemgr`/`search`/`terminal`/`todomgr`/`devicemgr`/`memory`/`planning`，没有 `mcpmgr`/MCP 分区；没有原生 MCP 列表命令（`opendesk tools` 仅 list/info/call/help）。
- 按 Bridge 当前写法写入 `applications.mcpmgr.servers` 后启动 OpenDesk，启动完成时 `applications` 被重写为 `{}`，连 `applications.devicemgr` 与未知 app 段一并丢弃（该临时 profile 未安装对应 app）；真实 `~/.opendesk` 没有 `setting.json`，只有 `~/.opendesk/apps/<app>/...`。

**代码收敛（受控测试）**：CLI 的 `nativeMcpConfig` 由 true 改为 **false**（`opendesk-desktop` 保持 true）；`nativeSupport('opendesk')` 返回 `MCP_NATIVE_CONFIG_UNSUPPORTED` 并给出原因；`mcp.status` 为 `state:'unsupported'`，`mcp.install` 拒绝且不写原生配置，`mcp.export` 仍生成 `applications.mcpmgr.servers` 形状的标准片段；桌面 UI 对 CLI 显示“已有 MCP 客户端但 Bridge 暂不能管理原生配置”+ 生成独立配置，不显示“添加 Bridge MCP”；Desktop 仍可写入候选条目。受控结果：`mcp-integration` **22/22**（新增 CLI 不支持/可导出、Desktop 写入候选条目）、`connection-capabilities` 11/11、`mcp-local-machine` 2/2、opendesk+mcp-local 26/26、`tests/mcp-cli.test.ts` 9/9；定稿全量桌面 **750/750**、根 `npm test` **66/66**，根 typecheck/eslint/build 与桌面 tsc 通过。

两个入口的 MCP 调用方状态维持**未确认**（无原生读取/MCP 客户端真实证据，静态 `mcpClient:true` 不是现场证明）。证据：`opendesk-plugins-list.txt`、`opendesk-plugin-tools.txt`、`opendesk-plugins-status.txt`、`opendesk-tools-list.txt`；完整说明见[本轮§12.7](../../../iterations/I08/mcp-open-integration.md#127-opendesk-cli-038-无-mcp-管理面结论升级与代码收敛2026-10-22-晚补)。未验：Desktop 0.3.9 原生读取路径、Windows 原实例是否同样重写 `setting.json`、导出片段能否被 Desktop/后续 CLI 读取、真实 MCP 客户端会话。

2026-10-22在Windows已安装Desktop 0.3.9上通过原实例只读3组、真实Host/worker5组、普通EXE全链路5组；两条原生会话各两轮真实回复，宿主/窗口重开后上下文保留。[现场原始证据和限制](../../../iterations/I08/opendesk-desktop-live.md)。真实取消、原生MCP及被委派、CLI模型、独立SSH仍未测；不构建或要求定制OpenDesk。日常后台已在原任务成功后切换alpha.42，健康Desktop节点已发现但尚未接入，新增模型输入0。
