# alpha.60 原生客户端十工具与连接策略复验

日期：2026-10-25（Asia/Shanghai）。关联CT-06/07/08、MCP02-T01/T04/T05/T07/T13/T15的组件子项与AB-F02/F07/F08/F11/F12/F13、M03/M06/M07/M08/M10。本轮只有显式验收脚本、受控夹具及文档变化，无产品运行行为、存储或协议变化，不构建新版本/EXE。公开仍为[alpha.60](alpha60-release.md)；工作树已有独立[alpha.61失败操作清理](failed-operation-cleanup.md)增量，本次不混用其解包目录或全量数字。

## 需求与冻结输入

[A3连接工具](../I07/connection-policy.md)已在受控stdio和Windows生产页面验证；还须核对真实原生MCP客户端能否加载新的十工具schema，实际调用连接/断开、遵守用户确认以及撤权后拒绝缓存。原生组件运行与原生父模型自主调用分开，不能以组件通过结束完整CT-08/MCP02。

从已公开alpha.60 EXE单独提取后台，先核对完整**130212267字节**与SHA-256 `d74c711b8475e84834519c8509a12a63351c1864a5ed4c01559588dc1fdc9cf6`，验收前逐项比对构建时原摘要中的**56个后台模块**，再核对EXE内Linux清单version。测试不按当前package.json的alpha.61标注，也不将当前修改后的源码当成冻结60；夹具使用生产冻结AgentNetwork/CoordinatorService并显式传入原版本。[原冻结摘要](../../../artifacts/ct08-connections/2026-10-24/source-manifest.json)、[提取记录](../../../artifacts/native-policy/2026-10-25/extract.log)。

原生来源均复用已有固定原包：

- Pi **1.4.0**：保留的npm tarball完整SHA-512与原npmIntegrity一致，配置加载器、MCP运行期、认证存储、CLI及package.json共5份实际文件与原归档逐字一致；Windows副本再次核对这5份摘要，不修改Pi原包。
- Hermes固定官方源码 **484de065a821b4245697351d08327b465ffd41ba**：原先核对的6份Git blob摘要保持，新增实际使用的传输/发现模块，两者与保留原归档合计8份逐项一致。实际使用Python 3.14.7 与MCP SDK 2.3.0（[环境元数据](../../../artifacts/native-policy/2026-10-25/hermes-runtime.json)），版本显示仍为固定源码unknown，不冒充正式安装版或Windows原生Hermes。

[本轮原包核验](../../../artifacts/native-policy/2026-10-25/native-provenance.json)；源头历史分别见[Pi](pi-mcp-config.md)和[Hermes](hermes-mcp-config.md)。没有网络下载、升级原生产品、安装新依赖或改用户日常Home/凭据。

## 七组场景与实际结果

[验收器](../../../desktop/tests/native-connection-policy.cjs)复用Pi原生loadMcpConfig/McpServerConnection及Hermes原生配置器/MCPServerTask/SDK。Bridge MCP配置、注册、broker及策略由生产模块执行；发现节点、原生执行宿主和用户确认RPC使用隔离受控目录。没有模型父进程，也不提交真实Agent任务。

| 组 | 覆盖行为与实际检查 |
| --- | --- |
| 1 目录 | 原生配置加载/连接后精确发现经典10工具；connect/disconnect的原nodeId/operationId、queryOnly及拒绝附加字段schema完整 |
| 2 来源与只读 | list_connectable仅返回自己预授权目标；伪造身份字段被原生或后端schema拒绝且无授权意图；用户侧decideConnection不在Agent工具面 |
| 3 原操作 | 原生实际connect/disconnect；同ID重复/原ID只查询得到同收据，换目标OPERATION_CONFLICT；断开保留预授权，当前成员已消失 |
| 4 用户确认 | 范围外只待确认，换ID不绕过原pending；隔离用户明确允许/拒绝后原生按原ID读到对应结果。用户后续撤权后，旧confirmed仍为历史收据，list_agents当前目标保持撤销 |
| 5 禁用/撤权 | 原生配置禁用保持disabled，install不自动启用；缓存客户端在显式撤权后连原操作查询也被MCP_REVOKED拒绝 |
| 6 身份轮换 | 明确移除再安装生成新connectionId；新客户端仍发现10工具，但不能继承旧操作收据；旧客户端继续被拒绝，最终移除也拒绝新缓存 |
| 7 执行与清理 | 请求、委派、受控原生任务始终0；原生客户端关闭/进程退出后关闭宿主并删除临时Home，未确认清理将单独失败而不写通过 |

| 实际环境 | 结果 | 原始证据 |
| --- | --- | --- |
| WSL/Linux Node22.23.1 + 原包Pi1.4.0 | **7组通过**，56后台/5原生文件一致，模型0 | [pi-linux.json](../../../artifacts/native-policy/2026-10-25/pi-linux.json) |
| WSL/Linux Node22.23.1 + 固定原版Hermes/Python组件 | **7组通过**，56后台/8原生文件一致，模型0 | [hermes-linux.json](../../../artifacts/native-policy/2026-10-25/hermes-linux.json) |
| Windows系统Node24.18.0 + 原包Pi1.4.0 | **7组通过**，56后台/5原生文件一致，模型0 | [pi-windows.json](../../../artifacts/native-policy/2026-10-25/pi-windows.json) |

这是三条分别完成的原生客户端组件链路，共用七组要求；不将其当作21个不同产品用例或完整十入口通过。Windows使用系统Node及真实Pi原包运行，非普通Electron窗口、非Windows Hermes、非真实父模型/任务。原schema十工具消费与实际连接操作已有本轮证据，托管scope、小队注入、跨真实机器和任务Session归属不因此扩大。

## 驱动修正与工程检查

最早2026-10-24 Linux驱动传相对bridge路径，fs读摘要可用但require按包名解析，未进入原生加载就MODULE_NOT_FOUND。驱动统一解析为绝对路径；原失败保留：[Pi](../../../artifacts/native-policy/2026-10-24/pi-linux-path-failure.json)、[Hermes](../../../artifacts/native-policy/2026-10-24/hermes-linux-path-failure.json)。随后两项执行因自动审批用量限制未能完成审批，命令没有运行；2026-10-25重新通过正常审批后执行，不把未执行或历史组件结果计作本轮通过。

新增冻结输入检查，避免工作树已升61仍把新解包资源记作60；共享夹具只增加可选callerAdapter/version参数，原默认不变。原版Hermes的组件驱动保留默认list_agents，新增可指定工具名/原目录schema供本轮检查，原生源码未修改。

首次新验收脚本lint报告一处未使用表达式（流处理中的三元回调），改成明确if/else后通过。新增明确用户拒绝/历史confirmed不恢复权限的断言后，三条原生链路均完整重跑七组；保留此前版本报告，最终表只引用末次结果。共享夹具相关迁移/多主/策略回归**37/37**，失败/跳过0：[TAP](../../../artifacts/native-policy/2026-10-25/fixture-regression.tap)。这些是当前工作树受控回归，不当作公开60重新全量或alpha.61完整验收。[lint](../../../artifacts/native-policy/2026-10-25/lint.log)。

## 父模型前置与未完成

2026-10-25按原许可仅只读连接日常中央，原命名管道在attach阶段ENOENT，未读取到当前后台版本/获准列表，父请求0、子任务0，原执行意图未创建，未自动启动后台/改关系或换目标。[脱敏前置报告](../../../artifacts/native-policy/2026-10-25/native-parent-preflight.json)。报告nativeParentModel=true描述该旧脚本预定验收类型，不能据此声称本次运行了模型。原端点身份已脱敏；脚本对缺文件/端点错误改用安全摘要，不输出私有路径或管道身份。

Windows OpenCode最多一个心算子任务许可仍保留，不能以WSL或其他Agent替代。当前中央恢复后须重新核对实际版本、正式原生条目、原执行意图和指定空闲目标，再按原ID流程推进。完整自主父模型、用户日常多主、低频操作面收尾、Hermes正式安装版/Windows原生、真实被委派生命周期、图100ms、WSL启动稳定性及完整SSH/故障矩阵仍未准出。目标保持进行中。


最终文档检查0错误，用户站6/6与构建通过：18用户页/19HTML，内部页及证据导出0。[分层汇总](../../../artifacts/native-policy/2026-10-25/verification-summary.json)、[最终验收器摘要](../../../artifacts/native-policy/2026-10-25/scripts-sha256.json)、[文档检查](../../../artifacts/native-policy/2026-10-25/docs-check.log)、[站点测试](../../../artifacts/native-policy/2026-10-25/docs-test.log)、[构建](../../../artifacts/native-policy/2026-10-25/docs-build.log)。
