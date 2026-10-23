# Pi 原生 MCP 配置、禁用与目标绑定

日期：2026-10-23（Asia/Shanghai）。本地候选alpha.50与Hermes一同完成本地交付，承接alpha.49；公开仍alpha.46。当前原生组件与EXE均已实际验证，完整准出仍按总台账；[最终包与联合交付](hermes-mcp-config.md)。[完整目标台账](completion-audit.md)。关联AB-F02/F07/F08/F11/F12/F13与M01/M03/M05/M06/M07/M08/M09/M10/M11。

## 需求与原生依据

MCP02要求所有已接入入口按同一标准管理配置、在原生列表可见并按原身份调用。此前Pi只有标准片段导出，且MCP客户端能力为未知；不能继续将旧版本印象当作当前产品能力。

已只读核对官方Pi仓库及未修改npm原包`@earendil-works/pi-coding-agent@1.4.0`：

- [配置路径源码](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/config.ts)：用户目录缺省`~/.pi/agent`，`PI_CODING_AGENT_DIR`可覆盖并展开`~/`。
- [原生配置加载器](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/extensions/mcp/config.ts)：用户`mcp.json`的`mcpServers`，严格JSON（允许开头BOM）；可信项目`.pi/mcp.json`可覆盖全局条目；禁用为`enabled:false`。
- [原生MCP CLI](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/extensions/mcp/cli.ts)提供`pi mcp list --json`，输出明确的name/scope/override/enabled/state/tools；连接状态不能只按输出包含名字判断。

原包仅安装在临时目录，禁用安装脚本，没有写日常Pi安装/配置或请求模型。npm完整性和各文件SHA见[upstream-provenance.json](../../../artifacts/pi-mcp/2026-10-23/upstream-provenance.json)。实际原包与客户端能力声明分层：读取源码不能充作原生进程、列表或工具调用成功。

## 实现与正常/失败行为

| 内容 | 当前源码行为 |
| --- | --- |
| 原生配置 | [Pi目标解析](../../../desktop/electron/pi-mcp-config.cjs)定位用户目录；[McpConfig](../../../desktop/electron/mcp-config.cjs)只改`mcpServers.agentbridge`。严格JSON、拒绝重复键与歧义结构，保留其他条目/全局设置；不写项目覆盖 |
| 原生目标绑定 | 原登记可选`nativeTarget:{kind:'pi-agent-dir',agentDir}`。重启只恢复私有端点，不补装原生删除；环境切换后状态显示原路径/当前路径，新增写入拒绝`MCP_NATIVE_TARGET_CHANGED`，清理固定原目标。先移除后新建接入才轮换身份并采用新目录；选择准备竞态回滚授权 |
| 版本准入 | 只有安装操作核对目标机器Pi发现结果，拒绝不可调用原安装；当前准入为1.4及以上的1.x正式版，其他版本`NATIVE_VERSION`且不写原生文件。导出/撤权/原目标清理保持可用，不因此迁移原Task/Session。当前只读依据固定1.4.0；准入范围不代表其他1.x版本已原生实测 |
| 禁用与归属 | Pi仅额外布尔`enabled`字段不改变已登记条目的其他内容时仍属于Bridge；`enabled:false`显示`facts.config:'disabled'`、`installed:false`，安装按钮禁用、后台同样拒绝`MCP_NATIVE_DISABLED`。导出/重启不启用原生条目。其他字段修改仍冲突，移除先撤权、保留改动文件为`revoked_config_pending` |
| 路径保护 | 绝对目录或`~/`，不猜测相对工作目录；原路径父目录变成链接/非目录时拒绝写删，撤权仍有效。Windows目录联接与macOS现场尚未实测 |
| 探测 | 使用现有命令解析器启动Pi npm JS/Windows shim，对`pi mcp list --json`按精确名字、用户scope及无项目覆盖核对；只在state为connected时报告连接。禁用/缺失不会报已加载，未知JSON/项目覆盖保留未知；细节仅输出安全摘要，不保存原生transport命令/凭据 |
| 调用方与界面 | [静态能力](../../../desktop/electron/builtin-adapters.cjs)声明Pi独立MCP客户端与原生配置已适配；托管scope/小队仍false，旧后台false/unknown仍收窄。复用原Agent行MCP卡、目录变化与禁用事实，不新增模型/供应商表单；Pi变更后提示原生`/reload` |

没有新RPC、SSH帧、模型层、Task状态或关系迁移。新字段是既有可选`nativeTarget`的适配器分支；原独立连接授权、已撤权客户端拒绝、unknown沿原ID查询不重放不变。主角色允许独立MCP调用，不等于托管会话或真实父模型已验。

## 当前验收

证据目录：[pi-mcp/2026-10-23](../../../artifacts/pi-mcp/2026-10-23/)。

| 层级 | 实际结果 |
| --- | --- |
| 配置专用受控回归 | 10/10，无子进程/socket/模型：其他条目保留、幂等、禁用/外改、先撤权后清理、删除重开、目录变更/竞态、严格JSON/BOM/重复键、未知版本、链接目录/文件、原生列表JSON状态反例；[config-only.tap](../../../artifacts/pi-mcp/2026-10-23/config-only.tap) |
| 能力与关系受控 | 11/11，Pi加入独立调用方/原生配置，托管维度仍false、旧能力收窄与原请求保护；[capabilities.tap](../../../artifacts/pi-mcp/2026-10-23/capabilities.tap) |
| 生产前端SSR | 配置弹窗9/9、事实卡7/7（含Pi禁用时安装按钮禁用且移除可用）；[configuration-ui.tap](../../../artifacts/pi-mcp/2026-10-23/configuration-ui.tap)、[facts-ui.tap](../../../artifacts/pi-mcp/2026-10-23/facts-ui.tap)。总计37项为定向范围，不能作为新全量结果 |
| 工程 | 类型/lint、根与桌面生产构建已通过；[typecheck.log](../../../artifacts/pi-mcp/2026-10-23/typecheck.log)、[lint.log](../../../artifacts/pi-mcp/2026-10-23/lint.log)、[CJS lint](../../../artifacts/pi-mcp/2026-10-23/cjs-lint.log)、[build.log](../../../artifacts/pi-mcp/2026-10-23/build.log)。最后一次产品修改后[build-final.log](../../../artifacts/pi-mcp/2026-10-23/build-final.log)及CJS lint通过 |
| 原生版本/列表/客户端 | 正常审批服务恢复后，原Pi1.4.0版本/列表及真实MCP客户端通过5组；最终Windows包Bridge资源在Linux复验5组，[native-package.json](../../../artifacts/pi-mcp/2026-10-23/native-package.json)；Windows原生组件5组，[windows-native.json](../../../artifacts/pi-mcp/2026-10-23/windows-native.json)，模型0、受控父进程 |
| 完整工程与交付 | Pi/Hermes合并后桌面794/794、核心68/68；Windows生产前端5组/普通EXE4组及alpha.50最终包、下载副本核验通过，[联合交付](hermes-mcp-config.md)。这些共享计数不跨模块相加，不证明真实自主父模型或独立SSH |

用户站6/6、构建18页/19 HTML、内部页与证据导出均0，完整资料检查通过；[docs-test.log](../../../artifacts/pi-mcp/2026-10-23/docs-test.log)、[docs-build.log](../../../artifacts/pi-mcp/2026-10-23/docs-build.log)、[docs-check.log](../../../artifacts/pi-mcp/2026-10-23/docs-check.log)。这些检查不替代原生运行或EXE。

## 原生验收及原始阻塞

[pi-native-mcp.cjs](../../../desktop/tests/pi-native-mcp.cjs)现已执行：原生配置加载器、`pi mcp list --json`与原McpServerConnection/SDK，生产MachineHost/broker、隔离用户目录。实际7工具、原scope与伪造参数拒绝、禁用不启用、外部删除/原接入重开不补装、缓存撤权/轮换、原生列表清理均通过。OAuth存储显式定位临时Pi用户目录；STDIO不读取或使用OAuth。原始npm文件与Windows副本SHA见[windows-native-fingerprint.json](../../../artifacts/pi-mcp/2026-10-23/windows-native-fingerprint.json)。

第一次原生验收通过前两组后，脚本误要求成功结果显式`isError:false`，标准结果允许省略该字段；改为必须非错误且正文精确等于期望结果后通过。保留[native-first.json](../../../artifacts/pi-mcp/2026-10-23/native-first.json)。未改变产品协议或降低成功内容要求。

之前审批服务曾因额度限制未执行原生版本/列表命令，[approval-block.json](../../../artifacts/pi-mcp/2026-10-23/approval-block.json)保留历史；本轮正常审批接受后才执行，[approval-recovery.json](../../../artifacts/pi-mcp/2026-10-23/approval-recovery.json)。没有绕过审批，也没有把未执行记录改写为通过。

完整目标保持进行中；原生父模型自主委派、Hermes/Pi真实执行/取消、托管scope、独立SSH及完整I06C/I07C/MCP02/CT-07/08仍未准出。最新本地alpha.50已交付，公开alpha.46及日常后台不变。
