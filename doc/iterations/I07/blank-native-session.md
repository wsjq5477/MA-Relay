# I07C：空白原生Session不建立或清除会话绑定

日期：2026-10-17。基于alpha.28的未发布源码增量；GitHub alpha.28和本地EXE保持原冻结文件，不含本次补丁。关联I07-R08/11/12、AB-F08/11/22、M02-F10、M06-F04、M07-F10、M08-F09。

## 需求与根因

小队observe接受长度小于500的任意字符串作为nativeSessionId，因此纯空白会被视为已绑定，可能错误开放自动续接。原任务已经观察到有效Session后，后来查询中的空字符串还会覆盖原绑定并留下会话变化错误，阻断本可继续的原会话。

要求空/纯空白字段不构成原生身份证据：未绑定时不能据此开放续接，已有有效绑定时不能被它清除或据此报告Session变化。真实非空Session发生变化仍按既有continuationError规则处理，不能用忽略空值掩盖真正的会话切换。

## 实现与接口

[TeamSpace.observe](../../../desktop/electron/team-space.cjs)在既有字符串/长度约束上增加非空白检查，只有有效值才进入原生Session绑定/变化核验。原生Task状态和request/task/Conversation校验保持原规则；缺少Session不等于该轮没有真实终态，但没有可用绑定就不能自动继续。

不修改或trim实际原生Session值，不增加UUID格式假设；不改变原生CLI参数、账号、模型或原任务状态。数据格式、RPC和daemon帧版本不变；data-model/protocol补充可选身份字段的证据规则，architecture分层核对后无变化。同步M02/M06/M07/M08完整设计与测试报告、整体功能和本迭代。

## 实际验证

环境：WSL Linux / Node22.23.1，受控execute/query与真实TeamSpace SQLite，模型调用0。

新增[回归](../../../desktop/tests/team-automation.test.cjs)包含两个子场景：首次纯空白Session不绑定、结束后新事件不能创建续接；已有有效绑定遇到空/纯空白观测不清除且不产生continuationError，之后沿原Conversation继续。修复前两个子场景失败、父测试失败，首次TAP共3个失败条目，见[原始TAP](../../../artifacts/I07C-session-binding/2026-10-17/initial.tap)。

修复后自动化/公共空间/任务/停止/生产受控路由共**51/51通过，无跳过**，含父测试和子场景；[最终TAP](../../../artifacts/I07C-session-binding/2026-10-17/tests.tap)。原有真正Session变化反例同时回归，未放宽原身份/权限约束。共享总数不跨模块重复累计。

复现：`node --test desktop/tests/team-automation.test.cjs desktop/tests/team-space.test.cjs desktop/tests/team-work.test.cjs desktop/tests/team-stop.test.cjs desktop/tests/team-stop-routing.test.cjs`。`node --check desktop/electron/team-space.cjs`、`git diff --check`通过；文档检查见[结果](../../../artifacts/I07C-session-binding/2026-10-17/docs-check.log)。

## 限制和下一步

没有证据表明某个真实CLI版本正在返回这些空白值，本次为消费端受控边界回归。未调用真实模型、独立SSH或Windows EXE，未重建包；此前真实会话权限证据保持原日期，不视为本补丁实测。真实执行成员交接及跨机器仍待验证，完整I07C/I06C仍未准出。
