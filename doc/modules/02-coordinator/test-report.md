# M02 中央协调后台测试报告

更新：2026-10-12。当前源码候选版本 0.6.0-alpha.6；本次全桌面 106 项通过，图/包/真实验收见 I06B。原 alpha.2 的 Coordinator 专属 3 项受控测试、全桌面 88 项是历史基线；设置页已提供普通关闭与明确停止。真实 Windows 生命周期结果单列，不把 IPC 客户端测试称为真实窗口。

## 1. 基线与证据

| 证据 | 日期/结果 | 可证明的范围 |
| --- | --- | --- |
| [桌面 TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) | 2026-10-12，87/87 通过，0 失败、0 跳过 | 桌面全部自动化回归；Coordinator 专属用例 2 个，其余相关用例共享归属 |
| [核心 TAP](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap) | 2026-10-12，43/43 通过 | 根执行与持久化回归，不证明 Windows 命名管道/DPAPI |
| [已有真实服务器记录](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md) / [原始报告](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json) | 2026-10-10，开发端到真实 Linux 已跑通 | 开发端后台重启、原机器重连、原请求读取；不是本次新执行 |

证据级别：**受控**表示真实模块 + 隔离服务/输入；**集成**表示真实 Bridge 进程和持久化；**真实**表示实际服务器/原生 Agent；**静态**表示源码或资源检查；**未测**表示没有对应运行证据。数字是整套基线计数，不按模块重复累加。

## 2. 功能与已执行用例

| 用例 ID | 功能 ID | 实际用例名/来源 | 结果与证据级别 |
| --- | --- | --- | --- |
| T-M02-01 | M02-F01/F02/F05 | `two windows share one coordinator; closing clients retains requests, wrong local credentials are rejected`，[coordinator.test.cjs](../../../desktop/tests/coordinator.test.cjs) | 通过，受控：同 PID、客户端关闭不关闭服务、错误身份拒绝、第二服务被占用锁拒绝。测试中的 two windows 是两个 IPC 客户端，没有启动 Electron 窗口 |
| T-M02-02 | M02-F01/F05 | `coordinator source identity survives restart and local UTF8 frames remain complete`，同上 | 通过，受控：重启 ID 不变、中文/emoji 完整 |
| T-M02-03 | M02-F03 | `one failed source keeps healthy results and marks only cached active tasks uncertain`；`changing the selected machine preserves other hosts and their running work`，[machine-router.test.cjs](../../../desktop/tests/machine-router.test.cjs) | 通过，受控路由回归；共享 M03 证据 |
| T-M02-04 | M02-F04 | `automatic receipt recovery preserves the original entry and records the reconciliation`；`recovery does not overwrite a concurrently updated journal entry`，[main.test.cjs](../../../desktop/tests/main.test.cjs) | 通过，受控台账；测试复用 `coordinator-service.cjs`，不是真窗口操作 |
| T-M02-05 | M02-F04 | `transport uncertainty blocks a new ID and instance switch, permits readonly query, and keeps original journal`，同上 | 通过，受控：不确定状态阻止新写入，允许只读核对 |
| T-M02-06 | M02-F04 | `accepted original request is confirmed by its receipt without sending a prompt`，[pending-journal.test.cjs](../../../desktop/tests/pending-journal.test.cjs) | 通过，受控；恢复过程没有二次发送 |
| T-M02-07 | M02-F02/F03/F04 | 真实记录第 9/10 项及 `verify-reconnect.cjs` | 通过，真实/既有：开发端后台重启，重连原 Linux machineId，读取原任务与会话；未复测 Windows |
| T-M02-08 | M02-F06 | `detached runtime survives portable extraction cleanup and retains license`；`missing ICU or V8 resources reject startup before admitting a native task`，[worker-runtime.test.cjs](../../../desktop/tests/worker-runtime.test.cjs) | 通过，受控：模拟 Electron 文件资源，不是新 EXE 的真实清理过程 |

## 3. 验收缺口与限制

| 用例 ID | 功能 ID | 未完成项 | 当前结论 |
| --- | --- | --- | --- |
| T-M02-09 | M02-F01/F02/F06 | 0.6.0-alpha.2 窗口关闭/重开、便携 wrapper 退出后同 PID/原任务回读 | 通过；[真实窗口](../../../artifacts/I06A-real/report.json)、[普通 EXE](../../../artifacts/I06A-final/portable.json)；不能扩大为所有系统 ACL 用户边界 |
| T-M02-10 | M02-F05 | 实际 Windows 身份目录 ACL、命名管道错误用户隔离、DPAPI 用户边界 | 未测；当前自动化为 Linux 身份文件权限与错误令牌测试 |
| T-M02-11 | M02-F07 | 设置页明确停止，验证后台 PID 退出；新窗口启动新 PID、保留身份并恢复原机器/任务 | 通过；[真实窗口](../../../artifacts/I06A-real/report.json)，恢复阶段新 Prompt=0 |
| T-M02-12 | M02-F01/F06 | 运行旧后台时打开新版客户端、冻结依赖/离线包更新一致性 | 未单独验收；附着只校验协议与身份，资源摘要未覆盖全部依赖内容 |

`main.test.cjs` 的测试名称沿用旧主进程台账命名，但测试入口已加载 `coordinator-service.cjs`。维护者应按测试实际加载对象判断覆盖范围。

## 4. 可复制复查命令

在仓库根目录，使用 Node ≥22.13：

```bash
node --test desktop/tests/coordinator.test.cjs desktop/tests/main.test.cjs desktop/tests/pending-journal.test.cjs desktop/tests/worker-runtime.test.cjs
npm test --prefix desktop
```

若运行生产后台的集成测试，先 `npm run build` 生成根 `dist`。上述自动化使用临时测试目录，不连接用户服务器、不发送真实模型需求，也不修改原生模型/账号配置。真实 `verify-reconnect.cjs` 使用开发 SSH 配置，可能启动后台和远端 daemon，不应作为日常无副作用单元测试自动执行。

下次改动生命周期、IPC 或台账后，更新本报告的日期、测试名、原始证据和未测项，同时更新 [设计](design.md)与当期迭代记录。旧结论保留在对应迭代历史中，不能把未运行的新环境改成通过。

## 2026-10-12：6A 收尾

新增受控用例 `explicit shutdown closes coordination while ordinary client close leaves it running` 已通过。Coordinator 专属回归现在为 3 项，全桌面为 88 项：[最新 TAP](../../../artifacts/I06A-final/desktop-tests.tap)。界面停止/取消/普通关闭通过隔离验证：[SSH UI](../../../artifacts/I06A-ssh-ui.json)。真实 Windows 包生命周期见 [窗口报告](../../../artifacts/I06A-real/report.json)，只按该报告实际 status 判定。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## 新窗口管理旧后台

2026-10-12 / alpha.4 新窗口、实际 alpha.2 Coordinator / 隔离 Windows/WSL profile。验证新窗口自己的设置页可连接并停止同 profile 的已认证旧后台，旧窗口已关闭，之后重开新窗口核对版本与配置身份。产品代码未修改，最终结果见 [真实报告](../../../artifacts/new-client-stop/2026-10-12/report.json)、[脚本](../../../desktop/tests/windows-new-client-stop-old.cjs)、[范围说明](../../iterations/I06/client-background-operation.md)；未停止用户生产后台，未提交原生模型需求。

该场景最终通过：旧后台 IPC 停止，新窗口重开得到 alpha.4 后台，新 PID 与原配置身份核对正确。此结果来自上述实际隔离窗口，不代表用户生产配置已被自动切换。


## 当前 alpha.5 恢复错误清理验证

T-M02-13 / M02-F03：2026-10-12 / alpha.5，新增 2 项受控状态回归、全桌面 95/95，通过。旧版本报错在恢复成功后撤销并持久化，旧目录成功快照不继承错误，新的 RPC/主机密钥错误仍显示；原连接/接入节点/任务历史保持。Windows 当前前端的受控快照卡片渲染 2 项通过。原用户状态只读核验，不是新包实际远端重连或模型验收。[本次测试与范围](../../iterations/I06/ssh-error-recovery.md)、[TAP](../../../artifacts/ssh-error-clear/2026-10-12/desktop-tests.tap)、[UI](../../../artifacts/ssh-error-clear/2026-10-12/ui.json)。

## I06B 当前验证入口

2026-10-12 / 0.6.0-alpha.6：T-M02-14 / M02-F04：独立图意图台账、稳定收据与提交前后实际隔离进程 SIGKILL；恢复只查询，未确认不能换 ID；模型调用数为零。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


T-M02-15 / M02-F04：2026-10-12 / alpha.6，原请求只读返回确定执行前 AGENT_UNHEALTHY 才 settle rejected；NOT_FOUND、DESKTOP_UNCONFIRMED、传输失败继续原占位。查询保持原 machineId/requestId，提交调用数=0；通过。[共享恢复测试](../../../desktop/tests/pending-journal.test.cjs)、[全桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)。

## alpha.9 当前节点管理专项

T-M02-16 / M02-F04：2026-10-13 / 0.6.0-alpha.9。范围：node/relation 意图互锁，原生 pending 拦截，来源机器规范化，确定拒绝原收据查询和未知不重放。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。
