# M06 原生 Agent 适配器测试报告

## 2026-10-17：Windows原请求上下文恢复

T-M06-126 / M06-F01：alpha.25本地候选，WSL Node22.23.1/Windows Node24.19.0，受控记录，模型0。4个反例修复前全部失败，修复后专项48/48、串行桌面243/243、Windows契约17/17通过，原回执可恢复且缺回执仍unknown。共享计数不跨模块累加，包内33 CJS/78 core/1390 Linux资源一致；alpha.24普通EXE对照3组、alpha.25候选4组通过，原记录均为合成。候选包/普通EXE与失败日志见[专项](../../iterations/I06/windows-context-recovery.md)。未实测用户另一台电脑或真实原生模型，不改变GitHub alpha.24已发布冻结包。

## 2026-10-17：真实原会话续接后的权限

T-M06-124：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。三项检查通过，共两次自动回合、手动启动0；阶段2的task/request不同但Conversation/实际原生Session相同，每轮真实权限等待/观察后台重启/精确Write允许后成功。累计attempt/used/Write/权限命令各2，持久事件仅user_start/attention且pending0；完成重查未重派。[证据及复现](../../iterations/I07/resume-native-permission.md)，共享计数不跨模块累加。未测后续轮拒绝、执行成员交接、Windows或独立SSH；未更新包或发布。


## 2026-10-16：真实自动主角色首轮权限

T-M06-123：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次事件自动原生回合、手动原生启动0，权限等待/观察后台重启、精确Write允许成功/拒绝failed三项检查通过；每项工作attempt/used各1、只有已消费user_start且pending0，原生Write和权限命令各合计2次。首次工具断言遗漏及修正后的只读恢复核对分别保留，[证据与复现](../../iterations/I07/auto-native-permission.md)。不是执行成员交接/原会话续接轮次、Windows或独立SSH，未更新EXE。共享真实证据不跨模块累计。


## 2026-10-16：真实原生权限补验

T-M06-122：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次手动小队原生调用，等待/观察后台重启、允许隔离Write并成功、拒绝后failed且文件不存在三项检查通过；完成后重复执行脚本只查原记录，每场景attempt1条、权限控制命令合计2次。真实原生证据共享引用，不跨模块重复计数。[报告、复现与限制](../../iterations/I07/native-permission.md)。未测自动权限链、Windows真实模型或独立SSH；未改产品源码/包，以下历史结果保持原日期。


## alpha.23 / I07C首批实际验证

T-M06-110 / M06-F04：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

## alpha.22 / I07B 实际验证

T-M06-101 / M06-F02/M06-F03：2026-10-16，WSL Node22.23.1、Windows Node24.18.0及Edge155。核心45/45、最终桌面208/208、Windows契约18/18；这是全工程计数，不跨模块重复相加。真实Claude两轮手动开发、独立MCP编译连接器实际Node检查X失败/Y通过、MCP协调员验收；Windows生产前端/Coordinator受控目录7组通过、模型0。首次原有daemon启动失败、重查及最终包/普通EXE的实际结果均见[I07B报告](../../iterations/I07/task-handoff.md)。未验证用户自研产品、独立SSH小队链、OpenCode/Codex任务闭环或I07C自动激活。


## alpha.21 / I07A 实际验证

2026-10-15 / WSL Node22.23.1、Windows Node24.18.0 / 源码alpha.21，GitHub预发布alpha.20。

| 用例 | 功能 | 结果与证据边界 |
| --- | --- | --- |
| T-M06-100 | M06-F02 | 真实Linux Claude读上下文/发群消息/写文档4项通过；Windows stdio契约7/7通过。其他原生工具仅受影响回归，不升级为真实小队推理验收。 |

原始证据、工程总数及真实工具/界面/普通EXE分别见[I07A交付](../../iterations/I07/delivery.md)。[核心45/45](../../../artifacts/I07A/2026-10-15/root-tests.tap)、[桌面197/197](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)为全工程计数，不在本模块重复相加；I07B/C能力不计为已通过。


## alpha.19 OpenCode 二次发现与 Windows 配置专项

WSL Ubuntu / Node 22.23.1：discovery 3/3（含于核心 45/45），桌面 181/181；受控回归、模型 0。[核心 TAP](../../../artifacts/opencode-discovery/2026-10-14/root-tests.tap)、[桌面 TAP](../../../artifacts/opencode-discovery/2026-10-14/desktop-tests.tap)。Windows 原始报告 UTC 2026-10-14T17:35:28.789Z / Electron Node 24.21.0：真实 PE 版本/解析、旧二次发现失败、修复后原路径核验、配置完整写入与旧revision拒绝、serve受控退出保留NATIVE_EXITED、删除原安装，共6组通过，[实际报告](../../../artifacts/opencode-discovery/2026-10-14/windows.json)。这是隔离PE/进程夹具，无真实OpenCode模型或用户另一台电脑验收。原生Windows完整生命周期和断电持久性未验证。根因、失败原证据、最终包与边界见 [专项](../../iterations/I06/opencode-discovery.md)。

## alpha.19 Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

## alpha.18 历史专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。


更新日期：2026-10-12。对应[模块设计](design.md)。本报告区分当前源码的受控回归、历史真实工具实验和未完成的产品发布验证。

## 1. 基线与结论

当前源码版本 `0.6.0-alpha.4`；稳定历史 EXE `0.5.0`、先前候选 `0.6.0-alpha.2`。2026-10-12 发现修复的桌面回归 **89/89**，失败和跳过均为 0；核心 **43/43**为先前未改动部分基线，未在本次重跑。本次实际调用原生 Codex/Claude 验证自然语言发现，详见子报告。全部工程测试通过不能证明每个原生版本、账号或 Windows 新发布包可用。

- [核心 TAP](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap)
- [桌面 TAP](../../../artifacts/codex-discovery/2026-10-12/desktop-tests.tap)

## 2. 分模块结果

| 测试 ID | 对应功能 | 验证与证据级别 | 结果 | 限制 |
| --- | --- | --- | --- | --- |
| T-M06-01 | M06-F01 原生配置继承 | `tests/native-cli-default.test.ts` 受控原生 HTTP；Claude/Codex 专用测试检查启动参数；MachineHost 拒绝覆盖实现审查 | 当前回归通过 | 旧实例 API 保留兼容覆盖，不能按该路径推断当前节点行为 |
| T-M06-OC-01–08 | M06-OC-F01 | [OpenCode 报告](opencode/test-report.md)：HTTP 契约、原生/OS 故障、历史真实 OpenCode | 受控回归通过；已有真实回复、续聊、权限/取消证据 | 远端 2.0.26 两轮未保存 native Session ID 比较；限工具验证仅允许 2.0.24 |
| T-M06-CC-01–08 | M06-CC-F01 | [Claude 报告](claude/test-report.md)：原生 JSONL 夹具 + 真实 Windows CLI | 16 项宿主回归通过；历史真实回复/权限/取消通过 | 表单不支持；当前源码和新 Windows 包尚未做全量真实复验 |
| T-M06-CX-01–07 | M06-CX-F01 | [Codex 报告](codex/test-report.md)：原生 JSONL 夹具 + 真实 Windows/WSL CLI | 4 项宿主回归通过；WSL 自然语言发现、真实委派和连接图通过 | WSL 原生续聊失败；Windows 原配置模型被账号拒绝 |
| T-M06-02 | M06-F01 原始事件与可读输出 | [I04F streaming UI](../../../artifacts/I04F-streaming-ui.json) 与 [conversation UI](../../../artifacts/I04F-conversation-ui.json)，隔离前端 Mock | 历史 UI 检查通过；当前聚合实现存在 | Mock 不证明真实模型产出和刷新延迟；当前基线不重跑该 UI 脚本 |
| T-M06-03 | M06-F01 主 Agent 真实工具调用 | [I05-real.json](../../../artifacts/I05-real.json)、[I05-codex-main.json](../../../artifacts/I05-codex-main.json)，真实 CLI/MCP | 4 条核心双向链通过 | I05 总报告保留 partial；不是当前跨物理机器双向协作验收 |

功能 ID 是稳定追踪入口，表内范围不是一次测试执行的计数。核心 43 与桌面 89 是整个工程数字，不能相加后称为本模块专用测试数。

## 3. 真实证据的适用范围

| 证据日期 | 环境 | 实际已验证 | 应保留的边界 |
| --- | --- | --- | --- |
| 2026-10-08 | Linux/WSL OpenCode 2.0.24 | 三轮同 Session、取消、原生服务重用、只读恢复、CLI 权限与文本表单链路 | 模型自主生成表单未核验；是该日期的真实结果 |
| 2026-10-09 | Windows Claude + 同宿主 WSL OpenCode | 双工具两轮、原 Session、Claude Write 审批和取消 | 测试隔离实例曾覆盖模型；不是当前所有继承行为的证据 |
| 2026-10-10 | Windows Claude 2.1.296、WSL OpenCode 2.0.24/Codex 0.161.0 | 原生默认回复、Claude/OpenCode 续聊、4 条主子协作链 | Windows Codex 原模型被拒绝；WSL Codex `list_turns` 续聊未通过 |
| 2026-10-10 | 开发机连接独立 Linux OpenCode 2.0.26 | 远端发现、新会话、按原 conversationId 续聊、断线期间完成和重连读取 | 未记录两轮 native Session ID 比较；未完成新 Windows 发布包验证 |

详细历史范围见 [I03B 验收](../../iterations/I03B/report.md)、[I04B 验收](../../iterations/I04B/report.md)、[I05 验收](../../iterations/I05/acceptance.md)和 [I06 当前核对](../../iterations/I06/progress.md)。它们解释变更过程，本报告负责给出模块当前可依赖的事实。

## 4. 待补验收与完成标准

| 项目 | 当前状态 | 完成标准 |
| --- | --- | --- |
| alpha.3 Windows 修复包 | 资源比对、普通启动/关闭/重开通过 | [普通 EXE](../../../artifacts/codex-discovery/2026-10-12/portable.json)未提交模型需求；alpha.2 的 SSH 历史适用范围保留，未重跑完整原生专项 |
| 远端原生续聊身份 | 缺直接比较证据 | 两轮分别保存 native Session ID，断言相等，并证明第二轮使用第一轮上下文 |
| Codex 原生续聊 | WSL 已知失败 | 合适原生版本真实 `exec resume` 成功且 thread ID 不变；失败仍原样显示 |
| Codex 许可/表单 | 未适配 | 单独设计协议、审批策略和失败边界；不得用自动批准替代 |
| Claude 结构化问题 | 未适配 | 独立实现 AskUserQuestion 回应和收据测试；之前保持明确拒绝 |
| 升级原生版本 | 按具体版本补核验 | 至少真实新会话、同会话、取消/等待、配置继承和异常恢复；版本更高不自动等于兼容 |

## 5. 复现与维护

工程回归使用 `npm test`、`npm test --prefix desktop`。专用测试可按子模块报告运行。真实脚本会调用用户已有的模型并可能执行受控文件操作，必须在隔离目录下按相应验收场景运行；不能把 fixture 回复登记为真实工具验收。

修改代码时同时更新设计中的能力边界和本报告：写明测试命令、日期、原生版本、证据类型、通过/失败/未测、产物链接以及剩余问题；对应迭代也保存需求和交付状态。


I06B alpha.6：共享 MachineHost 的原生就绪等待受控通过，connect/两次 snapshot、Prompt=0；案例共享 T-M03-16，不新增 Driver 真模型通过声明。[测试](../../../desktop/tests/machine-host-readiness.test.cjs)、[本次全桌面 110/110](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)。

## alpha.13 当前验证

T-M06-13 / M06-F01：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：原生 Driver 与账号/模型继承方式不变。daemon/Coordinator 只接受原控制操作和原 execution/task 的可核对收据；原生 unknown、外来 operationId、缺收据不会变成成功。表单秘密答案在 UI 遮罩、中央台账脱敏；适配器自身原生能力仍以各子模块报告为准，未支持交互不假成功。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## alpha.13 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

## 2026-10-16：Codex明确错误终态

T-M06-CX-08 / M06-CX-F01：alpha.22源码工作区，WSL Linux / Node22.23.1，受控CLI/worker及磁盘、模型0。错误前后混合完成事件且退出0均保持failed；重开原请求仍失败，同ID不重复调用。修复前失败证据、修复后Codex/小队专项23/23（工程共享总数）和未测边界见[专项](../../iterations/I07/codex-terminal.md)。未重建EXE、未验证真实原生续接或I07C激活。
