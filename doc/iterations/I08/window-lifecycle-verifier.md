# alpha.62 普通窗口关闭验收定位与脚本修复

日期：2026-10-25（Asia/Shanghai）。关联I06C、AB-F09/F11/F14、M01-F08、M02-F01/F02/F04/F08与M10-F01/F02/F05/F06。承接[配置/审计控制台](../I07/configuration-console.md)的普通EXE关闭失败：本轮修复验收脚本，产品代码、协议、数据格式与版本不变，仍是同一alpha.62 EXE。上一目标轮属于progress；本轮补齐普通窗口验收并刷新真实SSH证据，整体目标仍未完成。

## 原失败与根因

此前3次alpha.62与1次保留alpha.61在普通关闭后等待包装进程退出的断言失败。Windows的CloseMainWindow返回true不能单独证明原主窗口已关闭。两版窗口主进程源码SHA均为`696f15eda4e37d04f5ea4df9496ff46c8f40fbf40b2c8bd05a95d4dda766cb1f`，不能直接把失败归因于新控制台。旧失败报告全部保留，未改写为通过。

定位拆开两条路径：

| 层级 | 实际观察 | 可支持的结论 |
| --- | --- | --- |
| 隔离诊断副本，原main与renderer | 应用内部close在约20ms后触发closed，约21ms到will-quit；自身发出的系统关闭也触发完整退出事件 | 生产关闭代码可达；诊断副本不等于普通EXE/真实用户输入 |
| 相同便携EXE，仅启用本机主进程Inspector观察 | 最初选中的PID/句柄与BrowserWindow一致；较晚重新创建Get-Process对象时，其MainWindowHandle转而指向同进程无标题辅助窗，实际BrowserWindow句柄未变；错误目标的关闭没有触发BrowserWindow.close | 旧验收脚本重新枚举错了窗口，而非原主窗口拒绝退出 |
| 发送端只读上下文检查 | 两侧完整性RID均8192、未提升权限、UIAccess/AppContainer为false、所查作业UI限制为0、会话相同；先读标题/先读句柄均复现误选 | 已查项没有解释差异；不宣称排除了所有Windows权限因素，也不修改安全设置 |

[应用内部事件](../../../artifacts/window-lifecycle/2026-10-25/api-close.json)、[系统消息诊断](../../../artifacts/window-lifecycle/2026-10-25/system-close.json)、[初次便携观察](../../../artifacts/window-lifecycle/2026-10-25/portable-main-trace.json)、[权限上下文](../../../artifacts/window-lifecycle/2026-10-25/portable-process-context.json)、[实际发送时核对](../../../artifacts/window-lifecycle/2026-10-25/portable-close-sender-verified.json)、[严格目标门禁](../../../artifacts/window-lifecycle/2026-10-25/portable-guarded-close.json)、[读取顺序对照](../../../artifacts/window-lifecycle/2026-10-25/portable-property-order.json)。system-close报告沿用通用scope文案，具体system-close-request事件及对应驱动才区分该路径；不把其passed投影为普通EXE通过。

本轮只确定辅助窗无标题、属于同进程；没有把它猜测为tooltip、ghost或原生权限弹窗。Inspector阶段不算普通EXE准出，不把内部close替代原要求。

## 脚本修复

[windows-portable-window.cjs](../../../desktop/tests/windows-portable-window.cjs)在启动时绑定已观察到的同一.NET Process实例和原主窗口句柄，保留该对象直到正常关闭。发送前用只读IsWindow/GetWindowThreadProcessId/GetWindowText核对原句柄仍属于原PID且标题为AgentBridge，进程名与退出状态也须匹配。仅接受字面close指令，没有任意命令或强制结束入口。目标变化拒绝，不向无标题辅助窗发送关闭。

[普通EXE专项](../../../desktop/tests/windows-portable-mcp-defaults.cjs)改用该绑定；仍调用原CloseMainWindow，仍要求30秒内原包装进程退出，进一步记录原主进程消失、包装退出码0和剩余原PID为空。没有增加超时时间、跳过重开或删减原SQLite/收据断言。关闭收据与实际进程终态继续分开核对。非产品活Node进程负向验证拒绝绑定，未发关闭，[负向证据](../../../artifacts/window-lifecycle/2026-10-25/window-guard-negative.json)。

首个绑定版的底层CJS五组已通过，但外层PowerShell的Start-Process对象返回空ExitCode，驱动因此误报失败；[底层报告](../../../artifacts/config-console/2026-10-25/windows-portable-bound.json)与[驱动日志](../../../artifacts/window-lifecycle/2026-10-25/ordinary-bound-driver.log)同时保留。最终驱动改用显式ProcessStartInfo/Process.Start/WaitForExit，并先用真实exit(0)和exit(7)正反对照核对退出码，再重跑普通验收。[退出码契约](../../../artifacts/window-lifecycle/2026-10-25/driver-exit-contract.json)。不以报告passed覆盖未知退出码。

## 最终普通EXE实际结果

Windows系统Node24.18.0驱动，同一无调试alpha.62便携EXE/一次性profile/真实生产Coordinator IPC与SQLite；模型0。EXE **130201291字节**、SHA-256 **`bcce8eb39eba18969e76869f844736d014e6cd811e5e44a7534041d0391c990f`**。

[最终报告](../../../artifacts/window-lifecycle/2026-10-25/ordinary-final.json)五组通过，[实际驱动退出码0](../../../artifacts/window-lifecycle/2026-10-25/ordinary-driver-result.json)：

1. 普通窗口、准确版本、真实Windows目录和认证中央可用，启动参数无调试标志；原生历史只读。
2. 原生模型尝试0，生产IPC/SQLite保留受控成员、小队、公共文档和消息；业务写入仅隔离合成资料。
3. 普通关闭/重开复用同一中央，原资料不重放。
4. 完整隔离中央停止/重启后读取原资料，新中央PID与原PID不同，原生执行仍0。
5. 原team.operation的ID、完整持久指纹和原结果在窗口重开及完整中央重启后精确相同，没有重新派发。

三次普通关闭均验证原句柄归属/标题，原主进程已退出、包装退出码0、剩余原PID为空；没有强杀窗口或把另一个窗口关闭当作原窗口退出。[本轮执行源码快照](../../../artifacts/window-lifecycle/2026-10-25/runner/windows-portable-mcp-defaults.cjs)、[原窗口绑定快照](../../../artifacts/window-lifecycle/2026-10-25/runner/windows-portable-window.cjs)、[最终驱动](../../../artifacts/window-lifecycle/2026-10-25/windows-final-driver.ps1)。

最终重新核对56后台/84Core/1714Linux/ASAR/前端/bootstrap与同一EXE，177个冻结产品/依赖文件无变化；Downloads完整SHA保持，测试结束后的首次清点有1个早期失败诊断留下的临时中央；核对原profile、原PID/版本及零请求/委派/小队工作后，经原认证连接shutdown并确认原PID退出，最终AgentBridge清点0。[包重检](../../../artifacts/window-lifecycle/2026-10-25/package-recheck.json)、[源码重检](../../../artifacts/window-lifecycle/2026-10-25/source-recheck.json)、[交付与进程](../../../artifacts/window-lifecycle/2026-10-25/final-delivery-processes.json)、[机器可读验收汇总](../../../artifacts/window-lifecycle/2026-10-25/verifier-fix-analysis.json)。CJS验收脚本lint和diff检查通过；文档检查0错误、用户站6/6、18页/19HTML构建通过，内部页面/证据导出0。[lint](../../../artifacts/window-lifecycle/2026-10-25/final-lint.log)、[文档检查](../../../artifacts/window-lifecycle/2026-10-25/docs-check.log)、[用户站测试](../../../artifacts/window-lifecycle/2026-10-25/docs-test.log)、[站点构建](../../../artifacts/window-lifecycle/2026-10-25/docs-build.log)。

## 初次诊断与边界

诊断副本首次在应用启动前因PATHEXT缺失结束，[设置失败](../../../artifacts/window-lifecycle/2026-10-25/api-close-setup-failure.log)保留。一个Inspector实例在主模块尚未就绪时查询失败；观察原进程仍活后只恢复该原诊断，记录窗口状态并强制清理该一次性诊断进程，[原失败](../../../artifacts/window-lifecycle/2026-10-25/portable-close-sender.json)、[诊断清理](../../../artifacts/window-lifecycle/2026-10-25/early-diagnostic-recovery.json)。该次强制清理不计普通关闭通过；其留下的原临时中央后续按零请求/委派/工作核对并正常shutdown，未删除记录，[原中央清理](../../../artifacts/window-lifecycle/2026-10-25/owned-coordinator-cleanup.json)、[首次清点](../../../artifacts/window-lifecycle/2026-10-25/final-delivery-before-cleanup.json)。其余主进程探针使用app.quit清理，同样不算普通窗口证据。就绪查询已补主模块保护，不因观察超时重启同一在途测试。

原产品177个冻结文件与alpha.60/61/62 EXE继续核对；本轮仅新增/修复验收脚本与资料，无新产品需求、模型API、RPC、Session/Task/unknown迁移或新版本。Core71/71、桌面928/928及包内/页面结果沿用前片当前冻结基线，不冒充本轮重跑。

普通窗口生命周期这一项已补齐，但未执行用户日常profile切换，也没有真实用户“×”点击/图100ms呈现证据。用户补充当前未运行或未观察“×”，不当作人工通过。原生父模型、日常多主、WSL持续稳定性、独立SSH故障/升级与完整I06C/I07C/MCP02仍未准出。指定Windows OpenCode最多一个心算子任务授权未消耗。当前公开alpha.60保持，未部署SSH；同轮[alpha.62真实SSH只读三组](alpha62-ssh-readonly.md)独立记录。
