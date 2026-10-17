# I07C：小队原生等待可见性

当前该增量已纳入alpha.24本地候选；Windows等待呈现与停止专项的新增证据见[后续交付](native-stop.md)。本机真实Claude权限等待/允许/拒绝的后续证据见[补验](native-permission.md)。以下30项及当时未测范围保留原片记录。

日期：2026-10-16。基于alpha.23源码的未发布增量，GitHub/EXE仍为原alpha.23。关联I07-R08/09/11/12，AB-F09/10/11/20/22，M01-F10/F12、M02-F10、M07-F08/F10、M08-F09。

## 需求与边界

原生工具等待用户权限或输入时，Task仍可能为running；小队此前只显示执行中。用户应能在“小队协作 → 工作空间 → 手动执行与原结果”看到需要处理的等待，同时保持原任务占用和原权限通道。

仅保存等待类别和请求数量，追加普通系统消息给主角色；不将该消息当激活事件，不代表收到授权或任务完成。原生问题、命令、工具参数和原权限请求ID不进入公共材料，成员不能通过消息代替用户批准。实际批准继续在对应节点原任务中进行。

## 实现与流程

[TeamSpace.observe](../../../desktop/electron/team-space.cjs)在原请求/task/Conversation身份核验后处理waiting：permission/input保存kind与去重请求数量；私有waitingFingerprint摘要避免相同等待重复通知。摘要不进入公共attempt。unknown保留最后已知等待而不猜测消失；新可信快照没有等待或原任务终态时清除。旧格式3记录缺字段兼容，无迁移。

[TeamWorkspace](../../../desktop/src/TeamWorkspace.tsx)显示类别/数量及原任务处理指引；unknown显示“上次观察到”，避免冒充当前仍确定等待。[类型](../../../desktop/src/team-types.ts)同步可选字段。未添加权限批准按钮或修改自动调度算法。

整体架构分层无变化；data-model和protocol补充可选字段及隐私/unknown语义。同步M01/M02/M07/M08完整设计和测试报告、整体功能及本迭代开发记录。未改变发布或整体验收基线。

## 实际验证

环境：WSL Linux / Node22.23.1，受控原执行查询、真实TeamSpace SQLite及重启，模型调用0。

新增[回归](../../../desktop/tests/team-automation.test.cjs)修复前因公共attempt没有waiting失败，保留[首次TAP](../../../artifacts/I07C-waiting/2026-10-16/initial.tap)。修复后验证类别/数量可见，敏感原生描述和请求ID不出现在公共上下文；相同等待跨后台对象重启只通知一次，unknown不清除或重发，可信恢复后清除，后续input等待产生独立通知，终态清除。本场景原生执行夹具调用总数保持1。

命令`node --test desktop/tests/team-automation.test.cjs desktop/tests/team-space.test.cjs desktop/tests/team-work.test.cjs`，**30/30通过，无跳过**，见[完整TAP](../../../artifacts/I07C-waiting/2026-10-16/tests.tap)。这是共享工程计数，不跨模块累加。

`npm --prefix desktop run build`通过TypeScript和生产前端构建，保留原有单包体积提示，见[构建日志](../../../artifacts/I07C-waiting/2026-10-16/build.log)。`node scripts/check-docs.mjs`见[文档检查](../../../artifacts/I07C-waiting/2026-10-16/docs-check.log)；`git diff --check`及CJS语法检查通过。

## 未测与下一步

本次未执行Windows浏览器/真实EXE、真实Claude权限批准与取消，未连接独立SSH，也未重建发布包。构建通过不等于界面交互已验收。完整权限生命周期、真实执行成员和完整停止仍待后续；此增量只完成小队等待观察与呈现，不声称完整I07C/I06C准出。
