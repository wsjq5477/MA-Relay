# I07-MCP01：独立 Bridge MCP 文件与 Agent 配置增删

2026-10-19后续状态：本页当时的未发布增量已与公开alpha.30–32修复整合，并进入未公开的integrated.3本地候选。原日期/环境/计数和当时未测保持，下文“尚未整合/未打包”属于该片历史时点；当前包与验证见[整合交付](integrated-source.md)。

日期：2026-10-19。状态：alpha.29（冻结23d256e）之后的未发布源码；本次没有构建或发布新EXE。关联 AB-F02/F12/F13、M01/M02/M05/M06/M07/M08/M10。工作区原有CT-04公共材料增量保留，本专项不替代其验收，也不宣告完整I06C/I07C准出。

## 需求与用户流程

用户希望在日常自行打开的Agent中看到Bridge MCP，并能添加和移除接入。原实现仅在Bridge启动协作任务时传入配置，外部普通会话没有可登记的长期入口。本次新增“设置 → Agent MCP 接入”：选择机器上的Agent，查看原生配置路径与状态，添加Bridge MCP、生成独立文件或移除。只管理Bridge自己的 `agentbridge` 条目，不管理第三方服务器。

支持Claude Code、Codex、OpenCode 2。安装绑定所选节点和所在机器的用户环境；Windows/WSL/SSH不混写配置。断开节点仍能查询/移除，添加或导出需已接入；移除整台机器后需恢复机器才能访问其文件。旧后台不支持新方法时显示真实错误，不把未安装/未知当作成功。Hermes/Pi/DSH未声明兼容配置，不因存在stdio标准而开放。

添加后重新打开原生Agent会话，在原生MCP列表查看 `agentbridge`。OpenCode常驻服务异步加载配置，列表可能延后；必要时重启其原生后台。移除先撤销授权，再删除原生条目；即使旧会话仍缓存列表，也不能继续调用。停止接入不自动取消已派发任务，原历史和查询入口保留在Bridge。

## 配置文件与兼容格式

每个独立接入导出三份仅含启动命令、参数和运行时环境的文件：

| 文件 | 内容/用途 |
| --- | --- |
| `agentbridge.mcp.json` | 通用 `mcpServers.agentbridge` JSON；可手动合入兼容stdio的客户端 |
| `agentbridge.codex.toml` | `[mcp_servers.agentbridge]` TOML；合入Codex配置 |
| `agentbridge.opencode.jsonc` | OpenCode 2的 `mcp.servers.agentbridge`，本地command数组、environment、codemode=false |

“通用”指stdio服务和JSON条目可复用，不表示各厂家读取同一配置文件。导出文件位于目标机器的Bridge `mcp-connections/<connectionId>/`，不包含授权Token。其参数引用本机受保护的endpoint描述文件，不可直接复制到另一台机器。仅导出不会修改Agent原生设置；导出本身授权该接入，移除可撤销。

默认原生位置：Claude为 `~/.claude.json`（设置CLAUDE_CONFIG_DIR时为该目录下 `.claude.json`）；Codex为 `~/.codex/config.toml`，尊重CODEX_HOME；OpenCode 2为XDG配置目录的 `opencode/opencode.jsonc`，尊重OPENCODE_CONFIG_DIR，已有json则编辑已有文件。双文件同名条目、V1布局、歧义/损坏配置拒绝。项目/策略/客户端的更高优先级设置仍可能覆盖用户配置。

格式依据：[Codex官方MCP配置](https://developers.openai.com/codex/mcp)、[Claude官方MCP配置](https://code.claude.com/docs/en/mcp)、[OpenCode 2 MCP配置](https://opencode.ai/v2/docs/mcp-servers)、[OpenCode 2配置目录](https://opencode.ai/v2/docs/config)。本机真实CLI验证见下节，不用网页代替实测。

## 运行与授权

```mermaid
flowchart LR
  U[设置页选择节点] --> F[目标机器生成独立MCP文件]
  F --> C[合入Agent用户配置]
  C --> A[自行打开的原生Agent]
  A --> S[stdio MCP子进程]
  S --> B[本机回环broker]
  B --> R[校验独立接入仍有效]
  R --> N[中央校验节点和已保存连接关系]
  N --> D[原请求去重后委派或读取原任务]
```

`McpIntegration`持久登记独立connectionId、nodeId、adapter、enabled及自身管理的非密配置条目。后台恢复时重写原endpoint的动态地址；客户端每次调用重读描述。broker仍只监听127.0.0.1，Token留在原私有文件；工具参数不能指定/伪造调用者。远端经现有认证RPC回传中央，并校验来源机器。

独立MCP接入不要求先创建一个Bridge原生主Task。其委派归属独立connectionId，parentTaskId为null，parentConversationId是明确标记的MCP连接范围，不伪造原生Session或执行成功。只允许当前主节点向已保存成员委派；普通子任务依旧collaboration=false。稳定requestId派生规则、unknown不重放、任务/控制归属、取消收据不等于终态均保留。同一长期接入的多个原生会话共享该接入范围；没有声称按外部原生Session自动隔离。

删除先持久撤权，即使原生条目已被修改而不能删除，旧Token也失效。恢复endpoint失败也不能阻止用户移除原接入。重新添加生成新connectionId，旧副本不能恢复访问。撤权不会清除原委派台账。Bridge自己启动的协作任务继续用原任务scope覆盖同名MCP，以保留原父任务终态和小队权限；长期外部入口不替代这些限制。TeamSpace既有按成员/工作接入方式保持。

## 写入与失败规则

JSON/JSONC用jsonc-parser修改指定路径，保留其他条目和注释；Codex用smol-toml校验整体，追加自身标记块，只移除原样归属的块。修改前后核对条目，保留无关模型/供应商/工具配置。已有外部同名条目、用户修改、块内新增无关数据、损坏/重复配置、符号链接均不覆盖。临时文件替换前再次比较原文件；并发变化返回冲突。自身操作按机器串行，状态查询可恢复丢失的配置回应；不会发起或重试模型任务。

daemon增加四个配置方法，安装/导出/移除与上下文准备共用维护准入计数；维护期间拒绝配置写入。旧daemon需升级后才支持；没有升级任何用户服务器。

代码入口：[配置格式与保护](../../../desktop/electron/mcp-config.cjs)、[持久接入与导出](../../../desktop/electron/mcp-integration.cjs)、[机器宿主](../../../desktop/electron/machine-host.cjs)、[来源/委派路由](../../../desktop/electron/agent-network.cjs)、[设置页](../../../desktop/src/McpSettings.tsx)。解析依赖在根生产依赖声明，既有Coordinator/Linux包收集机制会收录；本片未产出EXE或Linux发布包，不能据此声称包内校验通过。

## 实际验证与原始证据

| 层级 | 环境/场景 | 实际结果 |
| --- | --- | --- |
| 受控工程 | WSL Node22.23.1；三格式保留/冲突/撤权/重启/并发、外部委派去重和机器来源、daemon维护 | 537/537通过，见[最终桌面日志](../../../artifacts/mcp-integration/2026-10-19/desktop-tests.log)；专项是全量子集，不跨模块相加 |
| 核心工程 | 原执行、控制、恢复及OpenCode契约 | 45/45通过，见[核心日志](../../../artifacts/mcp-integration/2026-10-19/core-tests.log)；[构建](../../../artifacts/mcp-integration/2026-10-19/build.log)、[lint](../../../artifacts/mcp-integration/2026-10-19/lint.log) |
| 真实原生、无推理 | Claude2.1.303、Codex0.162.1、OpenCode2.0.24；隔离用户配置增删和原生MCP列表 | 三种均添加可见、删除后消失；Claude/OpenCode完成真实stdio连接，Codex本次仅列表。模型调用0。[报告](../../../artifacts/mcp-integration/2026-10-19/native-list.json) |
| Windows生产前端、受控机器 | Windows Node、Edge155；设置页→生产Coordinator路由→隔离真实配置文件 | 四组流程通过、页面错误0、模型0：添加/导出路径、冲突保留且撤权、重新添加、正常移除。[报告](../../../artifacts/mcp-integration/2026-10-19/ui/report.json)、[已添加界面](../../../artifacts/mcp-integration/2026-10-19/ui/installed.png)、[移除界面](../../../artifacts/mcp-integration/2026-10-19/ui/removed.png) |

复现脚本：[受控配置与broker](../../../desktop/tests/mcp-integration.test.cjs)、[网络路由测试](../../../desktop/tests/agent-network.test.cjs)、[daemon协议测试](../../../desktop/tests/machine-daemon.test.cjs)、[真实原生列表](../../../desktop/tests/linux-mcp-list-native.cjs)、[Windows界面](../../../desktop/tests/windows-mcp-settings-ui.cjs)。运行真实列表脚本使用当前用户PATH中的原工具，只在临时用户目录工作，不复制登录数据、不调用模型；OpenCode用独立测试端口/常驻服务，结束只停止该测试服务。Windows脚本使用生产dist，原生机器受控，无真实原生Agent执行。

首次失败保留：[受限执行器](../../../artifacts/mcp-integration/2026-10-19/restricted-initial.log)、[TOML块换行测试](../../../artifacts/mcp-integration/2026-10-19/integration-tests-initial.log)、[节点来源准备测试](../../../artifacts/mcp-integration/2026-10-19/network-tests-initial.log)、[原生列表首次观察](../../../artifacts/mcp-integration/2026-10-19/native-list-initial.json)。修正TOML块换行和节点来源准备；受限进程/回环测试换正常本机运行。OpenCode最初误连固定端口旧服务，改隔离服务并等待异步装载/删除，未修改原生二进制或用户服务。

未测：新EXE、安装后的真实Windows原生Agent、独立SSH服务器、六种适配器全部MCP兼容、原生模型通过独立接入发起真实委派、外部原生Session粒度隔离。既有真实六方向委派不算本片重测。公开alpha.29和完整I06C/I07C边界不变。
