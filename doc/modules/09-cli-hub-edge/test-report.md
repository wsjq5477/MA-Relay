# M09 CLI、controller 与 Hub/Edge 测试报告

## 后续原生组件验收（2026-10-22，alpha.46）

已安装OpenDesk/DSH原生MCP组件协议分别5组/6组通过；两条生产协作链各完成1个真实Claude子任务，并分别只读重开原任务/Session/结果，无重放。原生父模型自主决策与日常原生页面未验；产品运行代码与EXE未变，不把新增验收与原全量计数叠加。[脚本、初次失败、准确层级和未测项](../../iterations/I08/mcp-native-acceptance.md)。

## MCP02恢复与观测（2026-10-22）

非GUI新增nodes、attach和原操作查询operation；稳定operationId与桌面profile共享；打包manifest取真实版本、离线包随后台暂存。JSON保留授权状态枚举，隐藏凭据。 WSL Node22.23.1共享桌面758/758、根68/68通过，最终JSON修复后CLI11/11及类型/lint/核心构建通过；模型0，真实原生模型委派未测，Windows结果按专项登记。 [实现、原始证据与未测项](../../iterations/I08/mcp-open-recovery.md)。

## OpenCode 1.x / 2.x 兼容修复

M09-F01：Core 接受可识别 1.x/2.x 并只读握手选择原生协议；Edge 使用统一 reply/interrupt 客户端分派，operationId 仍先持久且控制不重试。V1 permission/question 映射复用原表单校验；禁工具验证入口仍仅核验过 2.0.24。 本次共用专项的全套日志，不跨模块累加；受控测试、官方 CLI 加受控传输与未测 Windows/SSH/真实模型分列。 [需求、实现、验证与未测边界](../../iterations/I07/opencode-v1-compatibility.md)。

2026-10-18 / T-M09-140：桌面空闲修复源码，WSL Node22.23.1 / Windows Node24.19.0及Edge155。核心45/45、桌面424/424、定向20/20、Windows受控界面3组通过，模型0；属于共享工程计数，不跨模块相加。普通EXE与黑窗观察、冻结包、首次环境失败及用户现场未测边界按[本次完整报告](../../iterations/I07/desktop-polling.md)记录，历史包不冒充本次修复。

## OpenCode 二次发现与 Windows 配置专项

WSL Ubuntu / Node 22.23.1：discovery 3/3（含于核心 45/45），桌面 181/181；受控回归、模型 0。[核心 TAP](../../../artifacts/opencode-discovery/2026-10-14/root-tests.tap)、[桌面 TAP](../../../artifacts/opencode-discovery/2026-10-14/desktop-tests.tap)。Windows 原始报告 UTC 2026-10-14T17:35:28.789Z / Electron Node 24.21.0：真实 PE 版本/解析、旧二次发现失败、修复后原路径核验、配置完整写入与旧revision拒绝、serve受控退出保留NATIVE_EXITED、删除原安装，共6组通过，[实际报告](../../../artifacts/opencode-discovery/2026-10-14/windows.json)。这是隔离PE/进程夹具，无真实OpenCode模型或用户另一台电脑验收。原生Windows完整生命周期和断电持久性未验证。根因、失败原证据、最终包与边界见 [专项](../../iterations/I06/opencode-discovery.md)。

核对日期：2026-10-12。对应 [功能设计](design.md)。结论：本机 CLI/Core 受控回归通过，已有真实 OpenCode/PTY 验收；本报告不声称公网 Hub/WSS 或 CLI 全节点拓扑已经实现。

## 1. 基线和证据层级

本次采用已保存的 [root-tests.tap](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap) 核心 43/43、[desktop-tests.tap](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) 桌面 87/87，均无失败/跳过。以下引用的是项目总基线中的案例，模块间共用不能累加。

历史真实验收在 2026-10-08，环境为 WSL/Linux、Node 22.23.1、OpenCode 2.0.24。本次读取报告，没有重新安装 CLI 或提交模型任务；历史延迟样本不代表当前或任意机器性能。

## 2. 功能与自动化案例映射

| 案例 ID | 功能 | 真实测试文件 / 名称 | 结果及层级 |
| --- | --- | --- | --- |
| T-M09-01 | M09-F01 | `terminal.test.ts`：`TTY discovers OpenCode, space-selects and connects without configuration questions or model calls` | 通过；受控 TTY，空格接入无需逐项确认 |
| T-M09-02 | M09-F01 | `terminal.test.ts`：`TTY exposes real native startup failure instead of reporting a connected Agent` | 通过；受控启动失败正确呈现 |
| T-M09-03 | M09-F01 / F03 | `terminal.test.ts`：`advanced setup can save an explicitly disabled draft without launching services`；`Ctrl+C and EOF at TTY menu exit cleanly while the existing controller survives` | 通过；高级草稿及退出不停止后台 |
| T-M09-04 | M09-F02 | `cli-entry.test.ts`：`installed CLI symlink invokes the command instead of silently exiting` | 通过；真实 OS symlink 命令入口 |
| T-M09-05 | M09-F02 | `controller.test.ts`：`non-TTY default command is passive; terminal control sequences cannot rewrite display` | 通过；非交互无动作，终端序列清洗 |
| T-M09-06 | M09-F03 / F06 | `controller.test.ts`：`controller: concurrent startup, configuration conflicts, local apply, dedupe, forms and unknown resource protection` | 通过；真实 OS 后台配合受控原生服务 |
| T-M09-07 | M09-F03 | `controller.test.ts`：`foreign IPC server or regular file is never adopted, stopped or unlinked` | 通过；陌生进程/路径不接管 |
| T-M09-08 | M09-F04 / F06 | `integration.test.ts`：`I01 real cross-process CLI acceptance: baseline, auth, persistence, idempotency and crashes` | 通过；真实跨进程 HTTP/WS，执行器为 mock，不是生产模型 |
| T-M09-09 | M09-F04 | `core.test.ts`：`protocol rejects unsupported versions, source spoofing and missing event shape` | 通过；协议反例、来源与版本校验 |
| T-M09-10 | M09-F05 | `hub-fault.test.ts`：`AC-F06-04: real Hub preserves truncated results and returns 503 on SQLite write failure`；`AC-F06-04: Edge write failure before execution sends no false ACK or invocation` | 通过；真实存储故障注入，不虚报 ACK |
| T-M09-11 | M09-F05 | `hub-fault.test.ts`：`an interrupted HTTP upload does not disable healthy Hub storage` | 通过；坏输入与健康存储区分 |
| T-M09-12 | M09-F05 | `i03b.test.ts`：`B03: an ACK lost after Hub persistence replays the same seq once without invoking again` | 通过；受控丢 ACK，顺序补传与零再调用 |
| T-M09-13 | M09-F06 | `settings.test.ts`：`atomic settings write refuses stale revision; storage failure preserves complete last version` | 通过；旧修订拒绝、文件完整性 |
| T-M09-14 | M09-F06 | `settings.test.ts`：`missing credential and malformed import do not write authority or alter legacy files; repair can import`；`owner-import.test.ts`：`import preserves limited operator ACL and hides foreign occupied task in offline summary` | 通过；导入不扩大授权、不篡改原文件 |

代码：[TTY 测试](../../../tests/terminal.test.ts)、[controller 测试](../../../tests/controller.test.ts)、[跨进程验收](../../../tests/integration.test.ts)、[故障测试](../../../tests/hub-fault.test.ts)、[设置测试](../../../tests/settings.test.ts)、[owner 导入测试](../../../tests/owner-import.test.ts)。

## 3. 历史真实验收

原始材料：[I03B-acceptance.json](../../../artifacts/I03B-acceptance.json)、[I03B-terminal.txt](../../../artifacts/I03B-terminal.txt)、[I03A-I03B-regression-acceptance.json](../../../artifacts/I03A-I03B-regression-acceptance.json)、[I03B-native-contract.json](../../../artifacts/I03B-native-contract.json)、[I03B-checks.txt](../../../artifacts/I03B-checks.txt)。

| 案例 ID | 功能 | 真实行为 | 历史结果 |
| --- | --- | --- | --- |
| T-M09-15 | M09-F01 / F02 | PTY 自动发现、空格接入、真实分析、允许/拒绝编辑、退出重返 | 通过；单终端完成流程 |
| T-M09-16 | M09-F02 / F05 | 三轮原生 Session 上下文、每轮独立回答、菜单续问 | 通过；没有额外 Prompt |
| T-M09-17 | M09-F03 / F05 | controller SIGKILL 后核验并复用原生进程 | 通过；原生 PID 保留，重新注册与观察约 623 ms |
| T-M09-18 | M09-F02 | 20 个已确认状态到终端显示样本 | 通过；历史 p95=231 ms，目标≤2000 ms |
| T-M09-19 | M09-F06 | 正常导入、有限 owner、已知凭据产物扫描 | 通过；本轮已知泄漏命中=0 |

623 ms 从新后台启动到注册/观察恢复计时；231 ms 从后台已确认状态到终端显示计时，均不含模型生成时间。不能用它们替代 I06 SSH 网络恢复指标。

## 4. 边界与未验收

| 范围 | 当前判定 | 说明 |
| --- | --- | --- |
| 模型自主创建并完成所有表单 | 未完整验证 | 真实文本表单证明原生 API → CLI → 回复，不能扩大到所有生成路径 |
| 权限拒绝后模型最终完成 | 历史样本部分 | 已证明拒绝及文件未变；某原生轮次仍 running，保留其状态 |
| 第二 OS 用户 IPC 访问 | 未完成真实验收 | 私有目录/权限及陌生 socket 反例不等于第二账户测试 |
| CLI 管理 Claude/Codex/SSH 全拓扑 | 当前未实现 | 新能力在桌面/Coordinator 层，CLI 仍是 OpenCode 兼容入口 |
| TLS/WSS / 公网 Hub | 当前未实现 | 配置仅允许环回 HTTP，Edge 当前使用 WS |
| 不同 `--dir` 或原生 CLI 的项目互斥 | 不属于保证范围 | 资源锁限定当前 Bridge 实例，不是全系统沙箱 |
| 任意 Webhook/JSONL/Harness 接入 | 当前未实现 | 不能从统一协议设计推导为已交付适配器 |

## 5. 复现和材料更新

受控基线：`npm test`。需要 Node 22.13+；测试包括真实进程与存储，但生产原生模型调用在单独真实脚本中进行。

若修改命令、默认向导、退出语义或协议，必须保留非 TTY 无动作、Ctrl+C 不取消、原 ID 查询、外来 IPC 拒绝、导入不扩大授权等反例。同步 [功能设计](design.md)、本报告和迭代验收，并把历史性能与新环境实测分开记录。
