# I08-MCP02：OpenDesk与DSH原生MCP组件及真实子任务验收

日期：2026-10-22。Bridge候选alpha.46，承接[恢复与交付](mcp-open-recovery.md)。本轮仅增加验收脚本、原始报告和文档，没有修改产品运行代码，没有构建新EXE。原alpha.46文件与SHA-256保持；公开版本仍alpha.36。未修改/构建OpenDesk或DSH，OpenDesk源码仓库核对仍干净；未修改日常原生配置、重启日常程序、升级SSH或公开推送。

## 验收层级与范围

本次使用**已安装、未修改的原生MCP客户端组件**，由受控父进程加载，配置与Bridge网络均隔离。组件真实执行MCP连接和工具调用；主角色、授权、派发、原任务结果由生产Coordinator/AgentNetwork/MachineHost/broker处理，子任务由真实Claude模型执行。

这与“Bridge自己启动stdio后读工具目录”不同，也与“OpenDesk/DSH完整原生会话由主模型自主选择并调用MCP”不同。后者、原生页面人工增删/禁用与完整MCP02仍未准出。报告显式记录`nativeParentModel:false`，不将受控父进程当作原生主模型成功。

| 验收组 | 版本与环境 | 实际结果 |
| --- | --- | --- |
| OpenDesk原生客户端 | 已安装Desktop0.3.9原包mcpmgr类及SDK，原生Electron作Node、Windows隔离目录 | **5组通过，模型0**：读取Bridge写入配置→连接/7工具/正式授权list_agents；删原生配置不等于撤权；Bridge主机重启不补装且原客户端继续可用；撤权/重装身份轮换；移除后原生重载不再列出工具。见[原始报告](../../../artifacts/mcp-native-acceptance/2026-10-22/opendesk.json) |
| DSH原生客户端 | 已安装`dsh-mcp-client`/ToolRuntime 0.1.3-alpha.1、Cordis，WSL Node22.23.1；隔离web/acp配置 | **6组通过，模型0**：每个配置7个原生命名空间工具、正式调用；生产Bridge拒绝伪造身份参数；外部删除/重启不补装、缓存连接仍可调用直到明确撤权、卸载后原生工具消失。见[原始报告](../../../artifacts/mcp-native-acceptance/2026-10-22/dsh.json)。acp在这里是隔离配置名称，不是一次真实ACP会话 |
| DSH独立主角色→真实子模型 | DSH原生MCP组件、生产协作链、WSL Claude2.1.306 | **3组通过，新增1个模型任务**：主角色只发现获准Claude；真实委派成功并读回`13×17`结果；关系撤销后新委派被拒绝，仍能读取原结果，台账恰好1项。见[原始报告](../../../artifacts/mcp-native-acceptance/2026-10-22/dsh-delegation.json) |
| OpenDesk独立主角色→真实子模型 | Desktop0.3.9原生MCP组件、alpha.46打包后台、Windows Claude2.1.296 | **3组通过，新增1个模型任务**：同上，真实Windows子任务成功；原外部连接归属、父任务空值、MCP范围与任务计数均核对。见[原始报告](../../../artifacts/mcp-native-acceptance/2026-10-22/opendesk-delegation.json) |
| 独立观察器重开 | 两条模型链分别关闭再打开生产观察器 | **各1组通过，新增模型0**：按原requestId核对原taskId、原生Session绑定与结果；请求总数仍为1。[DSH](../../../artifacts/mcp-native-acceptance/2026-10-22/dsh-delegation-reopen.json)、[OpenDesk](../../../artifacts/mcp-native-acceptance/2026-10-22/opendesk-delegation-reopen.json) |

本轮共新增**两个真实Claude子任务，均succeeded**；协议检查和观察器重开没有新增模型回合。用户原任务未取消或重发，未批准权限。以上不同层级分别计数，不与先前758/758桌面回归相加。

## 原生包与脚本

OpenDesk客户端直接从已安装app.asar加载，未提取修改或重新打包。被加载原chunk的SHA-256为`90d63a4e127aa7411b96f2ab9465a4eb3b4c6c32a9d509227a77fa2e996a18c2`。受控父进程只选择原生WorkerPlatform/应用类，设置隔离路径，再调用其原有配置加载、工具发现、工具调用与销毁方法。

- [Windows原生客户端协议验收](../../../desktop/tests/windows-opendesk-native-mcp.cjs)
- [Windows原生客户端委派真实子任务](../../../desktop/tests/windows-opendesk-mcp-delegation.cjs)
- [DSH原生客户端协议验收](../../../scripts/mcp-native-dsh.mjs)
- [DSH原生客户端委派真实子任务](../../../scripts/mcp-native-dsh-delegation.mjs)

真实委派脚本在发送前把稳定请求ID、派生ID及阶段写入私有临时计划；已准备的意图只能查询，不能换ID重发。计划保留在OS临时目录，原始身份/请求/配置不复制进公开报告。完成后的重复执行为只读重开核对。报告不包含账号、Token、原生配置或原生会话ID。

## 首次失败与修正

本轮没有发现需要修改产品运行代码的缺陷。失败均为新增验收宿主或断言与真实组件契约不符，保留证据：

- OpenDesk旧版worker需要`workerData.paths.opendeskDirectory`；初版未提供。第二次根据真实worker入口更正minified导出映射，使用实际WorkerPlatform。最终使用未修改的原组件通过。[路径失败](../../../artifacts/mcp-native-acceptance/2026-10-22/opendesk-before.json)、[映射失败](../../../artifacts/mcp-native-acceptance/2026-10-22/opendesk-before-platform.json)。
- DSH客户端不会代替Bridge拒绝额外身份参数；初版只读回调缺生产`assertListArgs`校验，补入现有生产校验后确认拒绝。这里没有修改DSH客户端或放宽Bridge权限。[初版](../../../artifacts/mcp-native-acceptance/2026-10-22/dsh-before.json)、[参数断言](../../../artifacts/mcp-native-acceptance/2026-10-22/dsh-before-args.json)。
- DSH将MCP错误包成`Error: {...}`文本，原断言按纯JSON解析失败；改为核对原生`isError`及`MCP_REVOKED`，不是把错误当成功。[错误格式失败](../../../artifacts/mcp-native-acceptance/2026-10-22/dsh-before-result-format.json)。

新增脚本lint通过。产品运行代码和包未变，不重复完整模型或全量工程回归；本轮文档检查、站点测试和构建结果在证据目录另存。

## 用例准出与剩余项

| 原用例 | 本轮补齐 | 仍未测/限制 |
| --- | --- | --- |
| MCP02-T01/T05/T07/T15 | OpenDesk/DSH原生客户端组件正式授权、工具调用、删除/缓存/撤权/重装 | 日常原生UI与真实原生主模型会话未验 |
| MCP02-T03/T08 | 组件配置删除后状态、重开不补装、工具移除 | 原生页面点击删除/禁用/编辑及升级不补装未逐项验 |
| MCP02-T10/T13 | 生产关系服务接受独立调用方为主；实际native MCP只发现获准目标，伪造参数/无授权委派拒绝 | 本轮没有操作日常生产页面保存角色；旧前端/后台需要单独切换 |
| MCP02-T11 | 两种原生组件均真实委派Claude子任务并读回结果，撤销关系后新委派拒绝 | 原生父模型自主发现、选择工具和发起委派仍未验，T11全量不准出 |
| MCP02-T14 | 两个原任务/原生Session重开可读，恰好各1项请求，不重放 | 运行中改MCP、取消、权限及未知回应故障注入未测 |
| MCP02-T09/T12/T17 | 组件Web/CLI隔离配置、Windows/WSL两个实际来源 | 独立SSH、DSH Desktop配置、Hermes/Pi原生MCP、托管scope/小队未补齐 |

OpenDesk CLI0.3.8仍无可核对的原生MCP管理入口；本轮没有凭Desktop组件通过而改变CLI结论。最终alpha.46EXE仍为130180760字节，SHA-256 `57f1af73f761af72d75121284b023a001dad05eb30c0c197e18851cc9a7e8c48`，本地未签名/未公开，不重建未变产品。

Windows图形验收工具初始化报` sandboxCwd is not a local file URI`，本轮无法操作原生页面；这不影响已完成的协议、正式授权与真实子任务组件链。此限制不算原生客户端失败，也不将组件证据提升为日常原生页面验收。

## 日常运行状态只读核对

本轮末核对日常中央后台仍为alpha.42，非终态任务0、未决执行0、未决管理0，OpenDesk Desktop健康且已接入；[只读报告](../../../artifacts/mcp-native-acceptance/2026-10-22/daily-read.json)。该状态没有被隔离alpha.46验收改变。需要切换到已交付alpha.46才能在日常窗口继续验新增MCP事实与恢复行为；先用旧窗口“设置→后台运行→停止后台并退出”，再打开下载目录里的alpha.46。没有在无法观察原窗口草稿的情况下关闭日常窗口。

## 收尾检查

新增脚本lint通过；文档检查230份MD/15对模块设计报告/95个Mermaid图、用户站6/6、构建与发布边界审计通过（18用户页、0内部页/证据导出）。[lint](../../../artifacts/mcp-native-acceptance/2026-10-22/lint.log)、[文档检查](../../../artifacts/mcp-native-acceptance/2026-10-22/docs-check.log)、[站点测试](../../../artifacts/mcp-native-acceptance/2026-10-22/docs-test.log)、[构建](../../../artifacts/mcp-native-acceptance/2026-10-22/docs-build.log)。

最终EXE再核验passed，仍为alpha.46，50后台模块/84核心文件/1698Linux文件，四项源码一致性均true，文件字节与SHA-256均未改变。[包复核](../../../artifacts/mcp-native-acceptance/2026-10-22/package-recheck.json)、[验收脚本指纹](../../../artifacts/mcp-native-acceptance/2026-10-22/scripts-sha256.json)。本轮没有新增产品运行修改，因此不重建相同EXE或重跑全部758/68回归。
