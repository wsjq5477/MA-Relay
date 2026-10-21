# alpha.36 全量整合与本地 EXE 交付

日期：2026-10-21。用户要求生成包含当前全部修复的36版EXE，版本为0.6.0-alpha.36。本轮交付本地文件与SHA-256，没有创建/推送提交、标签或公开GitHub发布，不修改用户运行中的profile/原生配置。

## 整合范围与实现

基于工作区HEAD d9bf2a5，加上本轮前全部工作文件；三方核对HEAD与公开alpha.35冻结b5de577，整合其生产代码/测试与精确alpha.34 daemon清单。再从alpha.35原冻结构建获取精确manifest，摘要与原包报告一致后收录，不能从当前已被其他版本覆盖的暂存目录推断。

- OpenCode：stdio/daemon完整call/close宿主、1.x/2.x双协议、与DSH发现隔离；原账号与模型继承。
- 管理恢复：公开alpha.35执行资源级保护、原收据来源/指纹校验、五类管理查询与反馈；当前工作区原ADAPTER_HOST严格持久拒绝恢复同时保留。
- 桌面：扫描/添加可查看，实际变更继续保护；MCP/DSH配置移至所属Agent行，保留固定原目标及敏感输入清空。
- DSH：原CLI加Desktop/Web认证服务入口、持久原轮次/去重/取消/只读恢复；真实模型限制仍保留历史报告。
- 协作：CT-04/05公共材料与选材包、CT-07只读委派列表、按调用方连接视图、子任务最小上下文；CT-06/08仅规划。

源码落点：[OpenCode宿主](../../../src/desktop-host.ts)、[daemon](../../../desktop/electron/machine-daemon.cjs)、[执行范围](../../../desktop/electron/agent-network.cjs)、[中央准入](../../../desktop/electron/coordinator-service.cjs)、[原收据](../../../desktop/electron/graph-operations.cjs)、[共享恢复](../../../desktop/src/management-recovery.ts)、[应用](../../../desktop/src/NetworkApp.tsx)。版本改desktop/package.json及lock；根CLI包版本保持其原约定。

合并冲突手动保留两侧行为：中央graphPending的blockedNodeIds与DSH路由、原收据匹配与本地宿主拒绝恢复、scoped-management-execution-v1与dsh-web-desktop-v1能力、配置按钮与执行保护提示、统一恢复引擎与原设置定位入口。实际应用只展示同一原操作一次；旧SettingsPage显示参数仅作既有独立fixture兼容，不从真实NetworkApp传入重复台账。

身份/Task/Session/权限和线协议版本不变；graphPending新增可选blockedNodeIds投影，前后端用同样资源规则。中央能力要求包含scoped-management-execution-v1，旧中央须显式停止重开；SSH原安全门槛不扩大，远端升级仍单独操作。

## 实际验证与证据

环境：WSL Linux / Node22.23.1；后续Windows验证单独记录。受控测试不调用真实模型，不切换用户原profile。

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 完整核心 | 57/57，失败/跳过0 | [核心](../../../artifacts/alpha36/2026-10-21/core.tap) |
| 完整桌面 | 676/676，失败/跳过0 | [桌面](../../../artifacts/alpha36/2026-10-21/desktop.tap) |
| 类型/lint/前端构建 | 通过；前端有既有大chunk提示 | [类型](../../../artifacts/alpha36/2026-10-21/typecheck.log)、[lint](../../../artifacts/alpha36/2026-10-21/lint.log)、[前端](../../../artifacts/alpha36/2026-10-21/desktop-build.log) |
| alpha.35精确兼容清单 | 原manifest摘要与冻结包一致 | [清单来源](../../../artifacts/alpha36/2026-10-21/alpha35-manifest-source.json) |

包构建、包内入口、普通EXE、Windows界面和最终摘要实际结果见下表。完整I06C/I07C未准出，用户真实模型、独立SSH与原故障profile未验。此次用户授权的是本地生成，公开alpha.35附件保持原状。


## 最终本地文件与分层验证

- [alpha.36 Windows x64 EXE](../../../desktop/release/AgentBridge-0.6.0-alpha.36-Windows-x64.exe)
- [SHA256SUMS.txt](../../../artifacts/alpha36/2026-10-21/SHA256SUMS.txt)
- **130032973字节**；SHA-256 **`43e09dd34e1a86998a446048dd39279a91356189d132c1eae9facebec1472798`**。
- 从632项工作文件独立冻结构建，非单一git提交；[构建源清单](../../../artifacts/alpha36/2026-10-21/source-manifest.json)与[运行源码最终核对](../../../artifacts/alpha36/2026-10-21/source-freeze-check.json)确认123项生产源码无变化、前端资源一致。测试入口/清理及交付文档后补不冒称进入EXE运行代码。

| 层级 | 实际结果与边界 | 原始证据 |
| --- | --- | --- |
| 冻结构建与完整包核验 | 48 CJS、81 Core、1458 Linux资源，ASAR/前端/Windows与Linux后台一致 | [构建](../../../artifacts/alpha36/2026-10-21/package-build.log)、[包报告](../../../artifacts/alpha36/2026-10-21/package.json)、[复制后完整摘要](../../../artifacts/alpha36/2026-10-21/portable-file.json) |
| OpenCode实际包资源 / WSL Node22.23.1 | stdio/daemon两个生产宿主入口2/2通过，原绑定不改，无新任务 | [包内测试](../../../artifacts/alpha36/2026-10-21/packaged-host.tap) |
| Windows标准Node24.19.0受控后台 | 144/144、失败/跳过0；含原收据/管理范围、DSH、CT-07列表/连接/子任务上下文与真实stdio传输 | [最终日志](../../../artifacts/alpha36/2026-10-21/windows-contract.stdout.log) |
| Windows Edge155生产前端 / 受控IPC | 原管理恢复15组、Agent行配置8组、DSH3组；页面错误0、模型0 | [恢复](../../../artifacts/alpha36/2026-10-21/scoped-ui/report.json)、[配置](../../../artifacts/alpha36/2026-10-21/configuration-ui/report.json)、[DSH](../../../artifacts/alpha36/2026-10-21/dsh-ui/report.json) |
| 普通Windows EXE / 隔离profile | 7组通过：原ADAPTER_HOST确定拒绝、无关unknown保留、原两轮/Session历史、准确材料/MCP导出、真实打包Electron stdio发现、窗口重开与中央完整重启、运行资源摘要一致 | [普通EXE](../../../artifacts/alpha36/2026-10-21/portable.json) |
| 普通EXE旧后台升级与生命周期 | 5组通过：检测仍运行的alpha.34中央并保留设置/显式停止入口，停止后启动alpha.36；原两轮/Session、窗口重开及后台完整重启保留，冻结模块摘要一致 | [升级与生命周期](../../../artifacts/alpha36/2026-10-21/portable-upgrade.json) |
| 用户文档站 | 构建通过，17用户页/2生成表，内部资料与证据导出0；源边界6/6 | [站点](../../../artifacts/alpha36/2026-10-21/docs-build.log)、[源边界](../../../artifacts/alpha36/2026-10-21/docs-site.tap) |

普通EXE使用Windows标准Node启动测试脚本，真实窗口/Coordinator与MCP仍由生成的EXE及其Electron运行时启动；没有用Node替代产品运行时。Windows受控后台与EXE/界面是不同证据层，不跨模块重复累计。

### 首次失败与限定修正

1. Windows不能沿冻结副本的Linux node_modules符号链接加载依赖；保留[契约入口失败](../../../artifacts/alpha36/2026-10-21/windows-contract.initial.stderr.log)与[界面入口失败](../../../artifacts/alpha36/2026-10-21/scoped-ui.initial.stderr.log)，改从生产字节/前端均与冻结副本一致的工作区运行测试。
2. 最初用Electron Node运行全部契约，真实stdio夹具失败且运行器未完成；改用标准Windows Node后其真实stdio用例通过。普通EXE另增实际导出Electron MCP的tools/list检查并通过，未据运行器替换跳过产品Electron验证。[首次输出](../../../artifacts/alpha36/2026-10-21/windows-contract.stdout.electron-initial.log)。
3. 旧alpha.35界面断言要求扫描禁用，与本工作区已实现的只读扫描可用冲突；只将该断言改为enabled，原执行/管理写入校验保留。[原报告](../../../artifacts/alpha36/2026-10-21/scoped-ui-before-scan-update/report.json)。最终同15组通过。
4. Windows契约首次143/144，DSH原unknown恢复业务断言已通过，但退出后临时目录清理EPERM；将测试清理改为await fs.promises.rm并保留重试，Linux该文件11/11、Windows全套144/144通过。没有修改产品行为或将失败跳过。[原清理失败](../../../artifacts/alpha36/2026-10-21/windows-contract.stdout.cleanup-failure.log)、[Linux相关回归](../../../artifacts/alpha36/2026-10-21/dsh-cleanup.tap)。

文档检查最终通过：212篇Markdown、14组设计/报告、89张图、431项用例，错误0。[检查日志](../../../artifacts/alpha36/2026-10-21/docs-final.log)。

最终[分层汇总](../../../artifacts/alpha36/2026-10-21/verification-summary.json)与本地完整EXE摘要已重新核对；不同层级/重复场景不相加为独立验收总数。

### 使用与限制

在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开alpha.36 EXE。确认版本后观察原WSL节点；若有原接入管理unknown，先在设置核对原operationId，仅按确定收据/严格持久拒绝结算，不清台账或重放任务。SSH daemon须在原机器空闲后单独维护升级，新Windows EXE不自动替换远端。

这是本地生成的完整整合包，未上传GitHub、未创建/推送标签或提交；公开alpha.35附件保持。EXE未签名，打包器按现有signExecutable=false构建。真实OpenCode/DSH模型、用户故障profile与独立SSH未实测，完整I06C/I07C未准出；此前DSH RATE_LIMIT不能因本轮打包改为模型成功。
