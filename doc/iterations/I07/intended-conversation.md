# I07C：首次续接回应核对原Conversation

日期：2026-10-17。基于alpha.25的未发布源码补丁，当前GitHub alpha.25 EXE及其冻结源码不含本次变更。关联I07-R08/11/12、AB-F08/11/22、M02-F10、M07-F10、M08-F09。

## 需求与缺陷

续接意图已持久保存resumeConversationId，但新attempt尚未接收原生回应时没有conversationId。原observe只校验已绑定的conversationId，因此第一条回应即使返回另一个Conversation，仍会更新运行/成功事实。实际native Session相同也不能替代Bridge原Conversation归属。

要求在接受任何首条续接回应前，按意图中的原Conversation核对；不匹配不得绑定外来Conversation、报告成功或解除占用。之后只查原requestId，只有正确的原回应才能恢复，不自动重发或换会话。

## 实现与合约

[TeamSpace.observe](../../../desktop/electron/team-space.cjs)使用已有conversationId，尚未绑定时使用resumeConversationId作为expectedConversationId，随后统一核对request/task/Conversation。核对失败发生在状态、身份和scope更新之前；首次派发返回不匹配时沿原错误路径保持unknown，后续refresh继续保留原记录。

无新增数据字段、迁移、RPC、daemon帧版本、模型API或适配器行为。architecture分层不变；data-model/protocol补充既有resumeConversationId的约束时点，模块M02/M07/M08的完整设计和报告同步。另校正这些模块“不完整身份校验尚未发布”的过期说明：该旧校验已纳入alpha.25，新Conversation补强仍仅在源码中。

## 实际验证

环境：WSL Linux / Node22.23.1，受控执行/查询与真实TeamSpace SQLite，模型0。

新增[回归](../../../desktop/tests/team-automation.test.cjs)分别构造首次续接返回foreign Conversation的running、succeeded，两者都携带与前轮相同native Session。修复前2个子场景全部失败，父测试也失败，TAP为3个失败条目，不计成3种缺陷；见[首次TAP](../../../artifacts/I07C-conversation-binding/2026-10-17/initial.tap)。

修复后自动化/公共空间/任务/停止/生产受控路由专项**48/48通过，无跳过**，见[完整TAP](../../../artifacts/I07C-conversation-binding/2026-10-17/tests.tap)。两场景均验证错误回应保持unknown、不落入外来Conversation，轮询不新增派发；原request查询恢复正确Conversation后可结算succeeded，执行调用总数保持首轮+续接共2次。

复现：`node --test desktop/tests/team-automation.test.cjs desktop/tests/team-space.test.cjs desktop/tests/team-work.test.cjs desktop/tests/team-stop.test.cjs desktop/tests/team-stop-routing.test.cjs`。`node --check desktop/electron/team-space.cjs`、`git diff --check`通过；文档检查见[输出](../../../artifacts/I07C-conversation-binding/2026-10-17/docs-check.log)。这些是受控工程证据，不是真实模型或EXE验收。

## 未测与下一步

未对真实模型注入错误Conversation，未运行Windows/独立SSH或重建发布包。此前真实Claude原会话权限证据保持原日期/源码，不当作本补丁重测。真实执行成员自动交接和跨机器仍待验证，完整I07C/I06C未准出；下一次打包需重新核对当前源码与附件。
