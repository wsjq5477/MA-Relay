# I07C前置：Codex明确错误的终态保护

日期：2026-10-16。源码工作区alpha.22，GitHub预发布基线alpha.20；没有构建或发布新EXE。关联AB-F07/08/11、M06-F03、M06-CX-F01。

## 需求与缺陷

I07C自动续接依赖可信的原执行终态。检查发现Codex worker虽然保存error/turn.failed，却仅凭退出码0及turn.completed决定成功。包含明确错误的混合事件流因此可能错误产生succeeded。要求明确错误不能被完成事件覆盖，同时保持取消确认、原请求去重及恢复语义。

## 实现

[codex-host.cjs](../../../desktop/electron/codex-host.cjs)将成功条件统一为退出码0、收到turn.completed、没有明确failure；最终状态与文字共同使用该判定。取消依然等所属进程退出才生成cancelled。不改模型、账号、原生配置或原生Session，也不根据失败重发请求。

检查整体architecture/data-model/protocol：没有新增字段、接口、状态或存储迁移，既有成功/失败契约不变，无需更新合约正文。模块总设计与Codex子设计/报告、整体功能和开发记录已同步；候选及发布基线没有变更。

## 实际验证与证据

环境：WSL Linux、Node22.23.1；受控独立CLI/worker进程、隔离磁盘目录，模型调用0，不代表真实Codex模型或用户机器验收。

[新增回归](../../../desktop/tests/codex-host.test.cjs)先在修复前失败：error-before-completed返回succeeded而非failed，完整[首次TAP](../../../artifacts/I07C/2026-10-16/codex-initial.tap)。修复后验证error→completed、turn.failed→completed、completed→error且退出0的三种情况均failed且保留明确错误，不生成成功result；同请求返回原任务，观察端重开后仍读到原失败，CLI实际执行总数仅3次。

执行`node --test desktop/tests/codex-host.test.cjs desktop/tests/team-space.test.cjs desktop/tests/team-work.test.cjs`，**23/23通过、无跳过**，见[完整TAP](../../../artifacts/I07C/2026-10-16/codex-team.tap)。既有正常续聊/配置继承/取消与小队授权、版本返修、验收回归包含在该总数，不跨模块重复计数。

`node --check desktop/electron/codex-host.cjs`、`git diff --check`通过；`node scripts/check-docs.mjs`结果见[文档检查](../../../artifacts/I07C/2026-10-16/docs-check.log)。没有为本次小改动重复全工程/Windows构建，不能声称当前候选包已包含修复。

## 剩余项

真实原生版本的混合事件未实测，本次证明的是受控事件下判定规则。Codex真实原thread续接的历史失败保持原结论；I07C自动激活、持续协调和完整I06C准出仍未完成。下一步核验各原生接入新任务/查询/原会话续接/终态能力，再实现有授权和预算的激活台账。
