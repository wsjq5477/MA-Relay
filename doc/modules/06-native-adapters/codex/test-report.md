# Codex 适配器测试报告

## 普通子任务上下文输入

T-M06-CX-155 / M06-CX-F01：2026-10-21，WSL Node22.23.1，未发布源码。统一生产AgentNetwork加受控宿主覆盖该目标入口的说明+原文与无scope/MCP/TeamScope传参；本轮667/667完整桌面/121项定向、Windows36项、Core构建为共用工程证据，不跨模块相加。没有以当前实际codex CLI/模型、Windows EXE或独立SSH消费新上下文，模型0。[实际范围与来源](../../../iterations/I07/delegation-context.md)。

## CT-07只读委派列表（2026-10-20）

T-M06-CX-153 / M06-CX-F01：WSL Node22.23.1定向110/110（含新7项列表+1项Claude允许项）与最终冻结桌面615/615零跳过/退出0；Windows Node24.19.0列表/真实stdio及独立MCP8/8。覆盖父/连接隔离、空身份/游标、unknown/非实时、撤销关系保留原读、父终态/连接撤权拒绝、观察器重开不重派，Claude/Codex允许只读项但reply_task仍需原审批。共用计数不相加，模型0；Windows原生CLI/真实模型/新EXE/独立SSH未验，首次冻结缺C资源及初次TAP覆盖如实记录。[日志、脚本、版本与范围](../../../iterations/I07/delegation-list.md)。

## 历史详情归属

T-M06-CX-150：受控快照/真实本机TCP SSH读取原两轮与native Session，移除实时对象后只读保留历史；非用户服务器/模型调用。实际普通EXE的持久CodexHost验证及源码/包状态以[专项](../../../iterations/I07/history-detail-recovery.md)为准；不把受控host当真实模型通过。

## 独立 MCP 接入

编辑CODEX_HOME/config.toml（默认~/.codex/config.toml）的自有mcp_servers.agentbridge标记块；导出agentbridge.codex.toml。保留其他设置/注释，外来条目或块内无关数据拒绝覆盖。真实0.162.1隔离用户配置增删与mcp list可见性通过，本次未通过模型调用该长期入口。原托管任务-c覆盖仍保留任务scope隔离。测试使用WSL隔离配置、无模型调用；Windows生产界面为受控机器，非该工具真实Windows/EXE/独立SSH验证。[完整流程、源码和证据](../../../iterations/I07/mcp-installation.md)。

## CT-02真实MCP调用方与被调用方

T-M06-CX-146 / M06-CX-F01：当前WSL原生0.163.0-alpha.10.2，本工具真实作主发现/委派另外两种工具并读取成功结果，另在两条链中作为普通子任务被实际启动。各回答/原生Session/父子归属与精确消息通过，完整重开不重放；三工具共享9Task/6方向/16次MCP调用，不跨模块重复累加。保护7/7计入全桌面517/517，均为无模型回归，与真实Task分别计数。产品运行代码未改；Windows、新三工具、独立SSH/权限/表单/执行中断点未补验。[实际脚本、原始报告及边界](../../../iterations/I07/connection-delegation.md)。

## CT-02真实直接生命周期

T-M06-CX-145 / M06-CX-F01：当前WSL、Node22.23.1、真实原生0.163.0-alpha.10.2。首轮与原Session回忆均succeeded，取消收据与原Task cancelled分别核验，完整观察重开保留同Session/回答；3个原任务，重复只读观察前后3→3。沿用原生配置，未批准权限或重发原请求。新增验收保护7/7及最终桌面510/510为共享受控计数，不是该工具模型测试数。源码无产品行为变化；本轮未验真实委派/MCP调用方、新EXE或独立SSH。[原始结果、脚本、首次环境/契约失败及边界](../../../iterations/I07/connection-native.md)。

## 核对收据与同批终态保护

T-M06-CX-142 / M06-CX-F01：核对原operationId收据持久/冲突/重启、取消kind兼容及原未派发边界通过；终态后晚到started/output/native不覆盖成功或失败，offset完整推进。原收据初17项及迟到事件2项修复前实际失败，最终跨宿主定向57/57、合并全桌面474/474；均为受控CLI/磁盘事件，非真实Codex模型或Windows EXE。[日志、源码摘要及完整边界](../../../iterations/I07/native-integration-guards.md)。

2026-10-18 / T-M06-CX-140：Windows可见窗口/进程链确认旧alpha.28周期Codex黑窗和poll.1启动复现；最终修复验证原npm安装直接启动二进制并保留JS身份，嵌套optional/bundled和缺失拒绝有受控回归。最终普通EXE与真实版本探测以[专项](../../../iterations/I07/desktop-polling.md)实际结果为准，模型0。

## 发现器注册依赖回归

T-M06-CX-140 / M06-CX-F01：alpha.28 后源码、WSL Node22.23.1、受控CLI进程。新发现器引入静态注册依赖后，首次Codex受控五项超时；冻结worker补齐builtin-adapters与契约模块后 **5/5**通过，计入[43项定向TAP](../../../../artifacts/native-agent-expansion/2026-10-18/native-targeted.tap)。未改变Codex原生协议，不重跑真实模型/Windows/原生续聊验收。[原因与交付边界](../../../iterations/I07/native-agent-expansion.md)。

## 未派发任务恢复

T-M06-CX-06 / M06-CX-F01：2026-10-17，WSL Node22.23.1、真实Windows Node24.19.0，合成目录，模型0。新增恢复10/10，修复前0/10；覆盖EEXIST持久失败/同ID去重/新请求可进入准备、原job证明、重开保留，以及缺run、空worker.log、旧/空心跳、事件、native/进度均保持unknown。Windows共享契约86/86、最终普通EXE合成恢复5组通过；旧原生POSIX夹具仍由WSL全量验证，未冒充真实Windows模型。[原始日志与未测项](../../../iterations/I06/windows-start-persistence.md)。
## Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

更新日期：2026-10-12。功能 **M06-CX-F01**；对应[设计](design.md)。结论：当前受控执行回归通过，真实 WSL 新会话和主子协作通过；真实续聊与 Windows 原配置模型存在明确失败。

## 1. 当前工程回归

[codex-host.test.cjs](../../../../desktop/tests/codex-host.test.cjs) 的 **4 项**用例在 [发现修复桌面 TAP](../../../../artifacts/codex-discovery/2026-10-12/desktop-tests.tap) 中全部通过（全桌面 89/89）。测试启动自制 JSONL CLI 夹具，包含 detached OS 进程，回复不是 Codex 模型生成内容。

| 测试 ID | 实际用例名称 | 核验内容 | 结果 / 证据 |
| --- | --- | --- | --- |
| T-M06-CX-01 | `Codex executes native JSON events, inherits configuration, deduplicates and resumes the exact session after observer restart` | JSON 事件/答案、原 Session、宿主重开、同 ID 去重、不同内容拒绝、不传模型覆盖 | passed / 受控 CLI |
| T-M06-CX-02 | `Codex provider failure stays failed and cancellation is confirmed only when its owned native process exits` | 原生失败保持 failed；取消先 unknown，原 child 退出后 cancelled/confirmed | passed / 受控 CLI + OS |
| T-M06-CX-03 | `MCP approval adaptation is scoped to bridge tools and does not replace native account, model or filesystem policies` | 只限定 Bridge MCP 工具批准，不设置 model/provider/approval_policy/sandbox_mode，不自动批准 reply_task | passed / 参数与 MCP 夹具 |

新增 T-M06-CX-06：`Codex Bridge turns distinguish connected nodes from native agents on new and resumed sessions without altering direct prompts or receipts`。受控 CLI 实际收到新会话/原 Session 续聊的协作指引，直接聊天输入不变，同请求仍返回原任务，原消息与原生模型/权限配置保持；通过。源码版本 0.6.0-alpha.3，运行环境 WSL / Node v22.23.1，夹具不产生真实模型回复。

新增 T-M06-CX-07：[真实报告](../../../../artifacts/codex-discovery/2026-10-12/native-report.json) / [脚本](../../../../desktop/tests/linux-codex-discovery-real.cjs)。2026-10-12，WSL / Codex 0.161.0 / Claude Code 2.1.296，沿用原生账号与模型。将用户原自然语言需求交给真实 Codex，经真实 stdio MCP `list_agents → delegate → task_result` 实际启动 Claude，子任务和主任务均 succeeded，主回答包含连接图；通过。允许关系与 broker dispatcher 为隔离受控实现，主/子模型回复是真实原生结果；不是 GUI 关系或跨物理设备验收。实测时源码标签为 alpha.2 加发现修复，与随后 alpha.3 的 Codex 代码相同；未实测真实 Codex resume。

[原始故障核对](../../../../artifacts/codex-discovery/2026-10-12/diagnosis.json)：两轮 MCP 配置均存在，原生日志只有内部 `list_agents`，没有 Bridge MCP 调用；stderr 模型列表刷新超时，任务仍成功退出。I05 主 Agent 验收需求显式要求 MCP，未覆盖这类自然语言请求。私有节点、scope、原生 Session 与 endpoint 均未复制到报告。

测试 T-M06-CX-01 的 resume 返回同一 Session 来自夹具，不能代替真实 CLI resume 验收。整个桌面 89/89 也不是“87 个 Codex 测试”。

## 2. 真实 CLI 结果

| 测试 ID | 日期与环境 | 实际结果 | 原始证据 |
| --- | --- | --- | --- |
| T-M06-CX-04 | 2026-10-10 / WSL Codex 0.161.0 | 原生默认新会话回复、作为 Claude 子任务、作为主 Agent 委派 Claude 并读取实际结果通过 | [I05-real.json](../../../../artifacts/I05-real.json)、[I05-codex-main.json](../../../../artifacts/I05-codex-main.json) |
| T-M06-CX-05 | 2026-10-10 / Windows Codex 0.145.0 + WSL Codex 0.161.0 | Windows 原 gpt-6.1-sol 被当前 ChatGPT 账号拒绝；WSL 续聊原生报 `thread/resume failed: list_turns is not supported yet (code -32601)` | [I05-real.json](../../../../artifacts/I05-real.json)、[I05 验收说明](../../../iterations/I05/acceptance.md) |

I05 总报告保持 partial，两项原生失败没有被重写为通过。没有更换用户账号、默认模型或原生状态数据库；未新建 thread 冒充原会话恢复。本次文档整理没有再次运行这些真实任务。

## 3. 未验证项与完成标准

| 项目 | 当前状态 | 验收标准 |
| --- | --- | --- |
| 真实 Codex 同 thread 续聊 | WSL 已知失败 | 在目标原生版本两轮成功、thread ID 相同、上下文正确；保留模型与协议配置来源 |
| Windows 原生默认真实回复 | 原账号/模型阻塞 | 用户原生配置可用时进行真实回复验证，不能让 Bridge 擅自改模型 |
| 原生许可/结构化表单 | 未适配 | 单独设计、原请求 ID、可见等待、用户回应和操作收据；不得关闭权限系统替代 |
| token 级文本流 | 未实现 | 新原生事件契约与 delta 展示测试；当前 item.completed 已明确说明 |
| alpha.3 Windows 修复包 | 已生成、普通启动/关闭/重开通过 | [包校验](../../../../artifacts/codex-discovery/2026-10-12/package.json)、[普通 EXE](../../../../artifacts/codex-discovery/2026-10-12/portable.json)；Windows 原生 Codex 模型与完整任务流程未重跑 |
| 独立 Linux Codex | 未实测 | 真实发现、默认新会话、会话身份、取消、重连查询；远端 OpenCode 成功不能代替 |

## 4. 复现与维护

专用回归：`node --test desktop/tests/codex-host.test.cjs`。真实脚本：[windows-i05-real.cjs](../../../../desktop/tests/windows-i05-real.cjs)、[windows-i05-codex-main.cjs](../../../../desktop/tests/windows-i05-codex-main.cjs)。后者验证真实主 Agent 的 MCP 委派闭环，须使用独立 profile 和目标账号已有配置。

原生升级后先复查 `exec --json` 的 thread/item/turn 字段，再做真实续聊。报告必须保留失败与未测；不能用静态 `resume: true` 或夹具通过证明当前原生版本可续聊。同步设计、模块总表和对应迭代需求/验收。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

## Codex明确错误终态

T-M06-CX-08 / M06-CX-F01：alpha.22源码工作区，WSL Linux / Node22.23.1，受控CLI/worker及磁盘、模型0。错误前后混合完成事件且退出0均保持failed；重开原请求仍失败，同ID不重复调用。修复前失败证据、修复后Codex/小队专项23/23（工程共享总数）和未测边界见[专项](../../../iterations/I07/codex-terminal.md)。未重建EXE、未验证真实原生续接或I07C激活。
