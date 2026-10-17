# I07C：不完整原生任务回应保持待核对

日期：2026-10-17。基于alpha.24的未发布源码补丁；本地alpha.24 EXE和GitHub alpha.23保持原冻结文件，均不含本补丁。关联I07-R08/11/12、AB-F08/11/20/22、M02-F08/F10、M07-F08/F10、M08-F09。

## 1. 缺陷与需求

TeamSpace首次observe原执行回应时仅检查状态和requestId。若返回succeeded却缺少taskId或Conversation，原尝试也会被结算为成功、撤销scope并解除运行占用。它不足以证明是哪一轮真实原任务，不应成为自动续接/业务验收的成功依据。

要求对原taskId和conversationId进行完整性检查：两者均为非空白字符串，再核对原request及既有task/Conversation。无身份或无效身份的回应不能更新执行事实；首次派发之后遇到该回应记unknown，后续刷新只查询原请求，保留已有状态/占用，不重新执行。之后原请求返回完整匹配身份时方可恢复真实终态。

## 2. 实现与影响

[TeamSpace.observe](../../../desktop/electron/team-space.cjs)在任何状态更新/撤权/通知/验收前验证taskId及conversationId。缺失、空字符串、全空白或非字符串均报TEAM_EXECUTION；原execute错误路径保留unknown，refresh忽略无效观测并继续保留原事实。包括unknown在内的任务观测也须完整；原生连任务身份都未确认时只能保持派发意图，不绑定不完整记录。

无新增接口、字段、持久格式、daemon帧版本或模型层。检查architecture/data-model：原有对象身份和分层不变，故无格式更新；protocol补充消费端完整性要求，模块M02/M07/M08设计/报告与整体功能同步。原始私有任务ID仅用于测试夹具，不向公开报告复制真实原生身份。

## 3. 实际验证

环境：WSL Linux / Node22.23.1，真实TeamSpace SQLite、受控execute/query，模型0。

新增[回归](../../../desktop/tests/team-automation.test.cjs)：5种输入分别为缺taskId、缺conversationId、空taskId、数字conversationId、空白taskId。修复前5个子场景全部失败，父测试随之失败；TAP共6个失败条目，不把父测试当第6种缺陷，见[首次TAP](../../../artifacts/I07C-receipt/2026-10-17/initial.tap)。

修复后自动化/公共空间/任务/停止/生产受控路由专项共**45/45通过，无跳过**，包含新增父测试及5子场景，见[最终TAP](../../../artifacts/I07C-receipt/2026-10-17/tests.tap)。每个场景验证不完整succeeded保持unknown、scope未被终态撤销、明确新事件不能绕过原占用；完整原请求查询恢复succeeded、同attempt/request不变，execute实际仅调用1次。

复现：`node --test desktop/tests/team-automation.test.cjs desktop/tests/team-space.test.cjs desktop/tests/team-work.test.cjs desktop/tests/team-stop.test.cjs desktop/tests/team-stop-routing.test.cjs`。`node --check desktop/electron/team-space.cjs`、`git diff --check`通过；文档结构见[检查输出](../../../artifacts/I07C-receipt/2026-10-17/docs-check.log)。本次是受控回归，不是模型或真实EXE验收。

## 4. 未测与下一步

未向真实模型制造损坏收据、未实测独立SSH或Windows EXE，未重建/发布包；历史原生权限和停止证据保留原源码/日期，不冒充本补丁实测。下一片仍为真实执行成员自动交接及跨机器链。完整I07C/I06C仍未准出，冻结alpha.24包与当前补丁源码需分别看待。
