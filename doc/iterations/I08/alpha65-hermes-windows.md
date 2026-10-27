# alpha.65 Windows Hermes适配与发布

日期：2026-10-27（Asia/Hong_Kong）。基于master d2ca4df，用户授权增加本机Hermes适配、同步文档、验证并发布GitHub。已公开预发布0.6.0-alpha.65，冻结提交47cba616919e3f508176e0ac965f1f3cc7e551bc。

## 需求与原生依据

仓库已有固定源码Linux Hermes MCP组件证据，不能当作本机正式安装版。本机实际安装Hermes 0.22.5，固定源bf0203a794a07aac3ff764972ab9087baa4e4f4e，Python3.14.9。原生启动器位于LOCALAPPDATA/hermes/bin，未进入当前Codex/Bridge进程PATH；原5秒版本检查实际超时。

[官方Windows说明](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native)和本机固定源码核对：原生安装发布bin启动器；chat的stream-json走网关，拒绝--no-restore-cwd；客户端退出不取消已接收工作。模型、账号、配置及网关仍由Hermes原生管理，Bridge不增加模型API层。

## 实现与边界

- [发现](../../../desktop/electron/tool-discovery.cjs)：Windows只为Hermes添加HERMES_HOME/bin及LOCALAPPDATA/hermes/bin，PATH优先且失败不静默换安装；显式空候选禁止发现，固定Profile仍可发现原默认安装。Hermes版本探测20秒，其余5秒。
- [原生协议](../../../desktop/electron/native-cli-protocols.cjs)：保留chat/--query-file stdin/stream-json/精确--resume，去掉旧cwd参数。源上下文工作目录与原Session保持，无模型/供应商/权限覆盖。stderr中的Session/session_id精确行只绑定身份，不证明任务完成。
- [宿主](../../../desktop/electron/native-cli-host.cjs)：正式结果与退出码判断成功；缺result、网关连接/读取失败、130分离或输出截断保持unknown与原占用，不换ID重发。活动Hermes取消拒绝新意图，静态和宿主cancellation=false；旧取消收据原ID/种类/任务核对保留，confirmed仍不等于已取消。
- Windows心跳替换复用[atomicWrite](../../../desktop/electron/graph-layout.cjs)的有界共享冲突重试；定时心跳写失败不再使观察器崩溃，持续失败由原15秒观察规则标unknown，继续消费原子进程事件，不重派。
- 原MCP Profile选择、禁用/删除不补装、撤权与缓存身份保持。原生组件验收脚本更新为当前十工具及实际安装戳，隔离Profile通过临时junction复用本机既有依赖环境；不修改原生源码或日常MCP配置。

涉及AB-F02/F07/F08/F11/F12/F13，M03/M06/M07/M08/M09/M10/M11。没有新RPC、数据版本、Session迁移、关系或SSH协议；整体架构/数据/协议与受影响模块和用户说明已同步。

## 已运行的分层验证

Windows、Node24.12.0；Hermes0.22.5固定原生安装，受控scratch Profile与真实日常账号执行分别标明。共享计数不跨模块相加。

| 层级 | 实际结果与证据 |
| --- | --- |
| Hermes定向受控 | 31/31，无模型；发现、YAML、原Session、未知不重派、取消拒绝/旧收据、心跳EPERM包含在内。[原始日志](../../../artifacts/hermes-windows/2026-10-27/hermes-verified.tap) |
| 扩展源码回归 | 73项72通过/1失败；Pi既有Session文件测试在未修改d2ca4df也复现；三工具委派fixture在Windows因Unix入口不可执行失败，同基线复现，不算产品通过。[本轮](../../../artifacts/hermes-windows/2026-10-27/targeted-verified.tap)、[原基线](../../../artifacts/hermes-windows/2026-10-27/baseline-targeted.tap)、[委派基线](../../../artifacts/hermes-windows/2026-10-27/baseline-delegation.tap) |
| 正式安装版MCP | 源码与冻结Windows后台各五组通过：实际CLI/Profile列表、原生MCPServerTask/SDK十工具及正式只读调用、参数拒绝、禁用/删除重启不补装、撤权/切Profile身份与原目标精确清理，模型0。[源码](../../../artifacts/hermes-windows/2026-10-27/native-mcp-reuse.json)、[冻结包](../../../artifacts/hermes-windows/2026-10-27/frozen-native-mcp.json) |
| 真实模型执行/续聊 | 心跳修复后原生两轮succeeded、相同Session、第二轮记住第一轮Unicode标记、原请求去重、观察器重开通过。只读核对原两任务/收据，不重放；旧心跳失败的unknown仍保留。[原状态核对](../../../artifacts/hermes-windows/2026-10-27/native-heartbeat-verified.json) |
| 工程 | 根/桌面生产构建、根类型与lint已执行；最终状态按日志核对。[构建](../../../artifacts/hermes-windows/2026-10-27/build-final.log)、[类型](../../../artifacts/hermes-windows/2026-10-27/typecheck.log)、[lint](../../../artifacts/hermes-windows/2026-10-27/lint.log) |

## 失败、未知和未测项

首次真实CLI因旧--no-restore-cwd被拒绝，模型0。去掉后第一次模型成功，续聊期间worker心跳rename遭EPERM崩溃，原Bridge第二请求保持unknown；只读查原Session仅见第一轮，未把缺历史当作未派发证明，未重发该原请求或清占用。[原失败](../../../artifacts/hermes-windows/2026-10-27/native-execution-final.json)、[只读核对](../../../artifacts/hermes-windows/2026-10-27/original-session-readonly.json)。

独立心跳回归用不同验证内容验证修复后的两轮原生执行，两轮实际均完成；验收器随后把原生管理文件的字节变化当失败，故原报告status=failed保留。不归因于Bridge、也不宣称模型/认证文件字节保持；修正验收器分别记录原生文件变化与任务结果。通过报告仅只读核对已完成的原两任务、Session、结果与原收据，没有新模型请求。[原验收器失败](../../../artifacts/hermes-windows/2026-10-27/native-heartbeat-regression.json)、[只读脚本](../../../artifacts/hermes-windows/2026-10-27/verify-execution.cjs)。本轮成功完成的模型轮次合计3；MCP组件模型0。

第一次MCP脚本错误地把依赖runtime重定向到空临时目录，CLI没有加载证明；后续复用原安装依赖，未修改原包。临时原生CLI直接启动未禁用lazy安装时曾自动准备隔离依赖，已按原父进程身份结束整个测试进程树；不是产品安装流程，也不计通过。[原失败](../../../artifacts/hermes-windows/2026-10-27/native-mcp-debug.json)。

未验证Hermes父模型自主调用Bridge/跨Agent委派、原生网关取消、完整异常恢复/生命周期、Linux正式安装版、独立SSH与完整I06C/I07C/MCP02。既有图100ms、冷启动/WSL及全量平台失败边界不变。未切换日常Bridge后台、未部署SSH。

## 构建与GitHub发布

alpha.65候选EXE已构建并逐项核对真实载荷：132222581字节，SHA-256 `271c7e2884ad4b1e14f268687285723cc67cd3d9d7dadff17ff00e1f9e8d0ba9`；58后台模块、84Core、1672个Windows Bridge文件和1721个Linux资源一致，44份兼容pin，原alpha.64 pin与原EXE载荷完全相同。[打包校验](../../../artifacts/package-check/0.6.0-alpha.65/package.json)、[EXE载荷](../../../artifacts/hermes-windows/2026-10-27/exe-payload-check.json)。

普通EXE首次已通过启动/原撤权等四组，原主窗关闭后包装进程未在30秒内退出，原失败保留；随后只补验同一原profile，不重置原数据/收据/unknown。源码产品字节未改，验收器使用120秒退出观察窗口。最终补验与公开核验见下节。alpha.64旧标签/附件保留，不移动。


### 最终普通EXE与公开核验

同一原profile补验三组通过：原数据/原撤权收据/unknown不重置，完整中央重启保持；普通无调试EXE通过真实生产管道发现本机Hermes0.22.5原安装，healthy=true且取消能力false；补验原窗/包装进程退出0，原测试Coordinator已显式退出。合计首四组与补验三组事实；不将首次包装进程30秒退出等待失败改写为通过，不把预算120秒解释为性能修复。首次启动165381ms，补验158267ms，冷启动/退出性能不准出。[原失败](../../../artifacts/hermes-windows/2026-10-27/portable.json)、[同profile补验](../../../artifacts/hermes-windows/2026-10-27/portable-verified.json)。

公开[v0.6.0-alpha.65](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.65)，冻结47cba616919e3f508176e0ac965f1f3cc7e551bc。源码、132222581字节EXE和109字节SHA256SUMS已公开；两个附件uploaded，服务端大小/digest一致，匿名HTTP200完整下载两附件后全部字节/SHA匹配。GitHub插件无Release附件写接口，使用本机既有Git凭据在内存内调用REST，无凭据落盘/日志。[服务端](../../../artifacts/hermes-windows/2026-10-27/github-release.json)、[匿名下载](../../../artifacts/hermes-windows/2026-10-27/github-download.json)、[输入保持](../../../artifacts/hermes-windows/2026-10-27/source-input-check.json)、[汇总](../../../artifacts/hermes-windows/2026-10-27/acceptance-summary.json)。

最终工程：根/桌面构建、根typecheck/lint通过；Hermes定向31/31，扩展73项72/1（Pi原基线）；Core16项13/3与原基线相同；用户站18页/19HTML、内部页和证据导出0，docs:test5/6与原基线同型失败。完整资料检查2243条原材料缺失、新增0，不标全绿。本次文档同步覆盖产品/架构/数据/协议、接入矩阵/指南、M01/M03/M05/M06/M07/M08/M09/M10/M11设计与报告、用户页面与当前版本入口；原alpha.64标签/附件不移动，产品输入210项保持。源码标签后的master仅同步发布说明，不改变EXE或运行代码。
