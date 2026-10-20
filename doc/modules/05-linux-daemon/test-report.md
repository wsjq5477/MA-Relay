# M05 Linux daemon 测试报告

## 2026-10-20：维护上传进度与持久化修复（issue #10）

M05-F04/F06：本轮WSL专项7/7、相关42/42与核心51/51，Windows最终7/7及SSR66/66通过；最终全量/真实TCP/普通EXE/公开下载逐层记录。用户profile及独立服务器未验，共享计数不跨模块叠加。 [完整设计、实测与边界](../../iterations/I07/maintenance-persistence.md)。

## 2026-10-19：issues #8/#9受控验证

M05-F02/F04：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## 2026-10-19：issue #7 协作兼容修复

M05-F02/F04：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## 2026-10-19：历史详情路由与局部错误

T-M05-150 / M05-F04/F06：alpha.30隔离修复；合成路由6项、受控TCP SSH1项、Windows纯CJS91/91、Linux SSR63/63，新生产前端7组和既有10组通过，模型0。最终桌面529/529、核心45/45、lint/类型/构建通过；38 CJS/78 core/1401 Linux资源匹配145个冻结源文件。普通Windows无调试EXE合成原两轮/Session只读与关闭重开/后台重启4组通过。分发实际结果及首次失败统一见[当次专项](../../iterations/I07/history-detail-recovery.md)；共享计数不跨模块叠加，用户故障profile/独立服务器未复测。

## 2026-10-18：当前 Agent 版本与历史安装合流

T-M05-141 / M05-F04：alpha.28后未发布工作区、WSL Ubuntu/Node22.23.1。真实本机WSL版本探测与生产MachineHost/AgentNetwork在隔离目录合流；没有独立SSH或用户后台升级。 桌面421/421、核心45/45通过，计数为共享工程结果不跨模块相加；真实Claude版本2.1.302与受控历史节点合流明确分层。类型/lint/前端构建通过；当前EXE、用户运行中profile、真实模型和独立SSH未验证。[完整场景、原始日志与首次失败](../../iterations/I07/current-agent-discovery.md)。

## 2026-10-18：新增宿主的部署边界

T-M05-140 / M05-F01/F02：alpha.28 后源码，新增 Hermes/Pi/DSH 宿主沿用现有 MachineHost 与协议2，无 daemon 身份/帧格式修改。受控本机原生 worker 的观察重开、原请求和 unknown 占用验证计入[原生专项](../../../artifacts/native-agent-expansion/2026-10-18/native-targeted.tap)；全桌面仍含原 daemon 回归，结果见[扩展验收](../../iterations/I07/native-agent-expansion.md)。本次未升级或测试独立 SSH daemon，没有把本机受控 CLI 当独立服务器/真实模型通过。

## 2026-10-17：SSH持久拒绝恢复

T-M05-128：alpha.28已预发布，WSL Node22.23.1/Windows Node24.19.0，合成台账和受控TCP SSH，模型0。最终桌面317/317、核心45/45、Windows契约93/93，lint/类型/构建通过；真实TCP SSH丢响应/daemon重启1项及普通Windows无调试EXE合成验证6组通过，34 CJS/78 core/1395 Linux资源匹配源码。发布以[当次实际记录](../../iterations/I06/daemon-rejection-recovery.md)为准，不推定用户现场恢复。历史记录不计为本次重测。

## alpha.23 / I07C首批实际验证

T-M05-110 / M05-F08：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

## alpha.22 / I07B继承与回归

T-M05-101 / M05-F08：2026-10-16，最终桌面208/208通过，旧原请求/来源/准入范围继续受测；未改变原身份或SSH帧契约，未连接用户独立服务器。本轮真实Claude与受控编译MCP、首次原有daemon启动失败及8/8重查、包内容分别见[I07B交付](../../iterations/I07/task-handoff.md)，不以同机测试证明独立SSH链。工程数只计一次。

## alpha.21 / I07A边界

T-M05-100 / M05-F08：2026-10-15，旧scope与来源/原请求相关回归包含于[桌面197/197](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)。新的MachineHost能力门控已有生产Coordinator受控检查；真实Linux Claude链为本机WSL，用户独立SSH小队通信尚未测试，不能据离线包构建推定远端准出。[范围](../../iterations/I07/delivery.md)。

## alpha.19 Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

当前基线：2026-10-14 / 0.6.0-alpha.13。工程与受控维护验证通过，独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
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

## I06C alpha.10 当前专项

T-M05-25 / M05-F06/F07：2026-10-13。范围：daemon.eventRead 的 cursorGap/earliestCursor、items/nextCursor/hasMore 由当前 SSH 客户端完整处理：缺事件先补 snapshot，再读完保留页；客户端不猜 latestCursor，事件处理失败不提前推进。连接代次与原 daemon 身份不变，无 Prompt 补发。新候选仍可信复用旧协议 2 发布；升级/回滚/卸载流程继续待实现。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## alpha.13 当前验证

T-M05-16 / M05-F05/F06/F09：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：daemon.quiesce 先建立内存准入门再读取任务与收据；非终态、忙节点、在途创建或未确认原控制均拒绝切换。维护租约持久化到 maintenance.json，daemon.shutdown 仅接受同一操作且无在途任务。独立维护 worker 校验 owner/profile/UID、版本及每文件摘要后切换 current.json，目标健康核对失败回到原版本。旧 daemon 不支持停机 RPC 时使用已经校验的 owned-stop：先取得 pidfd，再核对 UID 与原启动标识，只经内核句柄发送 SIGTERM，拒绝 PID-only 降级。未知 native 控制收据不能被包装为 confirmed；只确认原 operationId 与原目标的有效状态，取消接收与实际终态分开。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## alpha.13 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

2026-10-14：冻结 alpha.16 独立 Linux 生产 daemon/worker 空闲维护全链通过，五个维护 confirmed，原身份保持、卸载保留状态/原收据。模型 0；原 alpha.13 文件任务 unknown 在另一 profile，未停止其任务或释放占位。[逐项实机结果](../../iterations/I06/maintenance-launch-recovery.md)。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

## 2026-10-16：创建时权限回归

T-M05-26 / M05-F01/F02：alpha.22源码工作区，WSL Linux / Node22.23.1。受控host、真实Unix socket/独立维护进程、模型0。新增回归修复前在bind返回时观察到0755而失败，修复后0600、调用者umask恢复及inspect身份通过；daemon与maintenance专项27/27通过，无跳过。[完整TAP](../../../artifacts/daemon-bind/2026-10-16/tests.tap)、[实现与限制](../../iterations/I07/daemon-bind.md)。未重建Windows包、未测独立服务器，历史低频DAEMON_OWNERSHIP的完整因果未确认。
