# M05 Linux daemon 测试报告

更新日期：2026-10-13。当前 alpha.8 资源范围见下节；以下为 alpha.2 daemon、协议 `2` 的历史结论：13 个本模块自动化用例通过，其中包括生产 Bridge host 与实际 detached 进程集成；已有服务器断线任务保留证据。完整故障、事件过期补偿、升级和各服务器登录策略仍未验收。



## alpha.8 兼容资源边界

原 alpha.7 manifest 先与历史交付 digest 核对，再收入 alpha.8 资源。27 后台 CJS 与 1368 个 Linux 文件、既有受控回归见 [拖动修复](../../iterations/I06/graph-drag-fix.md)。本次没有原用户 SSH 重连、升级 daemon 或模型任务；历史原生与认证结果仍按原日期/版本保留。

## alpha.7 历史资源边界

本次 daemon 后台源码未修改，版本与清单随 alpha.7 包更新；受控桌面 116/116 与 1367 个 Linux 文件资源核对见 [图优化](../../iterations/I06/graph-usability.md)。兼容资源增加已验证 alpha.6 清单，不自动切换原 daemon；真实 SSH 执行与故障恢复不在本轮重跑，历史结果保持原版本。

## 1. 基线与证据级别

[桌面 TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap)：2026-10-12 全套 87/87，通过、0 跳过。本模块 [machine-daemon.test.cjs](../../../desktop/tests/machine-daemon.test.cjs) 的 13 项包含在 87 项中，不重复累加。生产 host 与 detached 用例需要根 `dist/desktop-host.js`，这次基线未跳过。

**受控**：生产 daemon/protocol/relay + 合成 host；**集成**：实际 Bridge host/后台进程，无模型需求；**真实**：实际独立服务器及 OpenCode。受控用例名中的 native/session 不等于使用真实模型，也不自动证明 native Session ID 相等。

## 2. 功能/测试矩阵

| 用例 ID | 功能 ID | 实际用例名 | 结果与覆盖边界 |
| --- | --- | --- | --- |
| T-M05-01 | M05-F03 | `4BE framing preserves Chinese and emoji across every byte and coalesced messages` | 通过，受控：逐字节分片与粘帧仍返回完整对象 |
| T-M05-02 | M05-F03 | `frame decoder rejects oversized headers before allocation, malformed UTF-8 and truncation` | 通过，受控：长度/UTF-8/不完整帧错误不伪造正常回应 |
| T-M05-03 | M05-F01/F02 | `private daemon identity rejects symlinks, conflicting profile and ordinary socket files` | 通过，受控：归属冲突拒绝，普通文件保留不覆盖 |
| T-M05-04 | M05-F02/F04 | `daemon handshake binds owner, daemon identity and protocol before exposing native calls` | 通过，受控：错误协议/中央/后台拒绝，正确握手可发现合成工具，执行次数为 0 |
| T-M05-05 | M05-F01 | `one daemon per profile owns its socket and short paths safely support long user homes` | 通过，受控：重复后台拒绝、长路径短 socket 可检查 |
| T-M05-06 | M05-F05 | `ten same-ID requests invoke native submit once and changed content cannot reuse an ID` | 通过，受控：10 次相同需求调用合成 host 一次，变更参数/超长文本拒绝 |
| T-M05-07 | M05-F06 | `closing a relay preserves running tasks and reconnect continuation uses the original native session` | 通过，受控：relay EOF 不 close host，重连 continue 沿用 conversationId；fixture 没有真实 native Session ID |
| T-M05-08 | M05-F01/F05 | `restart keeps daemon ID and receipts; missing backend receipt remains unknown without replay` | 通过，受控：重启 UUID/收据保留，未知记录查询不再 submit |
| T-M05-09 | M05-F07/F08 | `inspect never fences a live coordinator; new hello fences stale callbacks and event cursors survive restart` | 通过，受控：inspect 不替代连接，hello 淘汰旧回调，cursor 递增并可恢复 |
| T-M05-10 | M05-F04 | `production daemon loads built DesktopHost and real MachineHost without creating native tasks` | 通过，集成：真实环境/发现/快照，若有可用 Codex 则创建上下文；snapshot 无任务，不调用模型 |
| T-M05-11 | M05-F05 | `uncertain cancellation recovery retains original task identity` | 通过，受控：取消中断后原 operation 查询使用原 task，cancel 调用一次 |
| T-M05-12 | M05-F03 | `blocked transport rejects excess queued bytes and daemon rejects request 65` | 通过，受控：堵塞 writer 拒绝超额字节，64 在途后第 65 项拒绝 |
| T-M05-13 | M05-F01/F06 | `real detached ensure calls reuse one verified daemon and it survives its bootstrap parent` | 通过，集成：真实独立进程，同 profile 并发 ensure 为同 UUID/PID，客户端断开后仍可 inspect；无真实任务执行 |

## 3. 已有独立服务器证据

来源：[2026-10-10 真实说明](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md)、[原始 JSON](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json)、[断线脚本](../../../.agentbridge-dev/verify-survival.cjs)、[中央重启脚本](../../../.agentbridge-dev/verify-reconnect.cjs)。本次只读取证据，没有再次连接或执行模型。

| 用例 ID | 功能 ID | 已有行为 | 结论 |
| --- | --- | --- | --- |
| T-M05-14 | M05-F01/F04 | 自动安装后启动/握手，机器出现在 snapshot，发现并接入远端 OpenCode | 通过，真实；实际系统 Node 24.13.0，未测试缺 Node 分支 |
| T-M05-15 | M05-F04/F06 | 真实新会话成功；使用原 conversationId continue，第二轮 succeeded | 通过同 Bridge 会话续聊；两轮 native Session ID 未留在原 JSON，不能独立证明 native ID 相等 |
| T-M05-16 | M05-F05/F06 | submit 收据后断开 SSH，远端任务到 succeeded，重连读取原结果 | 通过，真实/既有；说明记录包含 daemon/worker 生存与事件 cursor 变化，未形成全部故障点自动化报告 |
| T-M05-17 | M05-F01/F05 | 中央重启后自动重连原 machineId，原 request/task/conversation 可读 | 通过，真实/既有；没有据此证明 Linux 系统重启后自动启动 |

## 4. 缺口与未实现项

| 用例 ID | 功能 ID | 场景 | 状态 |
| --- | --- | --- | --- |
| T-M05-18 | M05-F07 | 累计超过 2,000 事件、旧游标回读、客户端完整 snapshot 补偿 | 未完成；客户端 cursorExpired 与服务 cursorGap 字段不一致 |
| T-M05-19 | M05-F05/F07 | 日志截断、大历史/空间不足、receipt 写入和原生调用间全部故障点 | 未完成矩阵；现有受控重启/未知用例只覆盖其中部分 |
| T-M05-20 | M05-F06 | 不同发行版 `KillUserProcesses`、断开最终 SSH 登录、服务器重启 | 未测策略；当前代码没有策略探测/系统服务安装 |
| T-M05-21 | M05-F08 | 真实 Windows 主 Agent ↔ SSH 子 Agent，两方向发现/委派/读结果/总结 | 未完成 I06B 验收；通道 callback 测试只证明传输归属 |
| T-M05-22 | M05-F09 | 忙时升级、校验失败回滚、停止/卸载不删原生配置/历史 | 未实现产品功能，不标记为通过 |

## 5. 可复制检查与副作用

仓库根目录、Node ≥22.13：

```bash
npm run build
node --test desktop/tests/machine-daemon.test.cjs
```

会在本机 Linux 临时目录创建状态/socket，启动测试归属的 detached daemon，并在测试结束清理和停止该进程。生产 host 集成会发现本机工具、执行版本检查，可能在测试目录建立上下文，但不提交模型需求，也不修改原生账号/模型配置。缺少 `dist` 时两个集成用例可被跳过；验收报告须保留跳过数，不能按 13 个通过填写。

真实 SSH/模型脚本会安装后台、保留远端数据并调用模型，必须按目标测试环境运行，不能混入日常无模型回归。变更后更新 [设计](design.md)、本报告和当期迭代，记录原始输出与实际 native ID；未知结果不得用新需求重发来“验证恢复”。

## 2026-10-12：6A 收尾

| 用例 ID | 功能 | 实际执行 | 结果 |
| --- | --- | --- | --- |
| T-M05-23 | M05-F01/F04 | 发布包私有 Node 启动实际 Linux daemon，重复启动身份/PID 复用 | 通过；[报告](../../../artifacts/I06A-final/private-runtime.json)、[脚本](../../../desktop/tests/linux-i06a-private-runtime.cjs)。隔离 HOME，生产 probe 确认没有可发现 Node；不替代无 Node 独立服务器的 SSH 整体安装 |

握手回归改为比较桌面 package.json 的实际版本。最新全桌面 88/88 通过，包含 daemon 13 个受控场景：[TAP](../../../artifacts/I06A-final/desktop-tests.tap)。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## 兼容复用的原后台核对

T-M05-14 / M05-F01/F02：2026-10-12 / alpha.4 客户端、原 alpha.2 独立 Linux daemon。经真实 Windows SSH 认证、本地可信旧 manifest 逐文件校验和非抢占 inspect，原 daemonId/PID 与 current 版本入口保持；通过。[报告](../../../artifacts/ssh-compatibility/2026-10-12/remote-readonly.json)。本次复用不升级 daemon，旧适配器代码保持原版本，未发送模型需求。桌面 93/93 包含原有 13 项 daemon 回归；完整升级、busy/unknown 切换仍未实现或未验收。

同日真实 `hello`/重连后原 daemonId/PID 仍保持，OpenCode 发现与旧任务快照读取通过；[连接报告](../../../artifacts/ssh-compatibility/2026-10-12/remote-connect.json)。未新建后台进程、未提交模型需求；临时观察结束只关闭通道。


## I06B 原生就绪与原拒绝核对

2026-10-12 / alpha.6：本次全桌面 110/110 通过，与其他模块共享，不重复累计。T-M05-15 / M05-F05：AGENT_UNHEALTHY 的执行前拒绝持久化、重启后的同 ID/原查询仍拒绝且 native 提交仅首次尝试一次；T-M05-16 / M05-F05：旧原记录已保存 AGENT_UNHEALTHY 时只读核对改为 rejected，不调用原生提交；其他传输未知/缺收据反例继续 unknown。生产 daemon 与受控 host，[测试](../../../desktop/tests/machine-daemon.test.cjs)、[本次 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)。这些拒绝测试 native 真模型提交=0，不冒充真实模型闭环。原生链发现的失败、修复和最终复验见 [I06B 实施](../../iterations/I06/graph-implementation.md)。

## alpha.9 当前节点管理专项

T-M05-24 / M05-F01/F06：2026-10-13 / 0.6.0-alpha.9。范围：alpha.9 离线包与 alpha.2–alpha.8 信任资源逐文件校验；协议仍为 2。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。
