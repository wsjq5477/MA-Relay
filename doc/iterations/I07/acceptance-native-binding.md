# I07C：会话异常不能通过业务验收

日期：2026-10-18（北京时间）。基于alpha.28的未发布源码增量；GitHub alpha.28和已冻结EXE保持原文件，不含本次变更。关联I07-R07/08/11/12、AB-F08/11/21/22、M02-F10、M07-F09/F10、M08-F08/F09。

## 1. 缺陷与验收要求

原生Session变化已有continuationError保护，会阻止该回合继续使用小队工具或新增激活。但业务报告可以在变化之前提交，随后原生任务仍可真实succeeded；原acceptTask只检查执行成功，acceptRun只检查任务已完成和没有在途执行，可能据此验收这份报告。延后总验收也只检查主角色自己的continuationError，遗漏已完成工作项当前执行的身份异常。

要求将原生终态与业务可信度分开：succeeded保持原生事实，不改成failed，但当前有效原执行有会话异常时不得验收工作项、直接总验收或完成先前的总验收提议。旧轮次或已被后续明确执行取代的历史异常不应使整项工作永久无法验收。

## 2. 实现与范围

[team-work.cjs](../../../desktop/electron/team-work.cjs)补齐工作项最新执行的continuationError检查，并提供hasBindingIssue：只取工作项当前业务轮次的最后一次执行，以及每成员最后一次独立协调执行。历史轮次及被后续执行取代的记录继续保留，不作为当前阻断依据；所有非终态原执行仍按既有守卫阻断验收。

直接总验收在创建提议或完成前核对该规则。[team-automation.cjs](../../../desktop/electron/team-automation.cjs)在延后总验收落为completed前再次核对，捕获提议后的会话异常；失败提议清除并保留工作active及原异常历史，不伪造任务失败或取消，也不替用户执行修复。

没有新增数据字段、迁移、模型API、RPC或帧版本；architecture分层和data-model字段核对后不变。protocol补充业务验收守卫，M02/M07/M08完整设计/报告及整体功能、迭代记录同步。本次保留工作区已有的UI重构与空白Session修复，不混淆各自证据。

## 3. 实际验证

环境：WSL Linux / Node22.23.1，真实TeamSpace SQLite、受控执行状态与业务报告，模型0。没有向真实CLI制造Session变化。

新增[工作项/直接验收回归](../../../desktop/tests/team-work.test.cjs)和[延后验收回归](../../../desktop/tests/team-automation.test.cjs)，修复前两项均失败，见[首次TAP](../../../artifacts/I07C-acceptance-binding/2026-10-18/initial.tap)。修复后验证：当前工作项会话异常拒绝验收；旧业务轮次异常不阻塞新轮次；最新独立协调执行异常拒绝总验收；后续明确正常执行可替代旧异常；提议后出现当前工作项异常时总工作仍active、提议失效。

相关自动化/公共空间/任务/停止/生产受控路由**53/53通过，无跳过**，含既有父/子测试，见[完整TAP](../../../artifacts/I07C-acceptance-binding/2026-10-18/tests.tap)。共享总数不跨模块重复累计。复现：`node --test desktop/tests/team-automation.test.cjs desktop/tests/team-space.test.cjs desktop/tests/team-work.test.cjs desktop/tests/team-stop.test.cjs desktop/tests/team-stop-routing.test.cjs`。

`node --check desktop/electron/team-work.cjs`、`node --check desktop/electron/team-automation.cjs`及`git diff --check`通过；文档结构检查见[输出](../../../artifacts/I07C-acceptance-binding/2026-10-18/docs-check.log)。没有因本次后台校验重复界面全量或模型测试。

## 4. 未测与下一步

未运行Windows浏览器/EXE、真实模型或独立SSH，未重建发布包。已有UI重构的待验项保持其独立记录，不将后台受控回归当作界面验收。真实执行成员自动交接、多机器和完整I07C/I06C仍待验证；下次构建须重新核对源码与包。
