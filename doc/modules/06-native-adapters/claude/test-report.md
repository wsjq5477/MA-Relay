# Claude Code 适配器测试报告

2026-10-24，经典连接工具的允许项/托管指引进入900/900受控全量与最终25/25定向；没有运行真实claude模型或安装用户持久配置，不代表该原生客户端已实际消费10工具。 [本片契约与证据](../../../iterations/I07/connection-policy.md)。

## 普通子任务上下文输入

T-M06-CC-155 / M06-CC-F01：2026-10-21，WSL Node22.23.1，未发布源码。统一生产AgentNetwork加受控宿主覆盖该目标入口的说明+原文与无scope/MCP/TeamScope传参；本轮667/667完整桌面/121项定向、Windows36项、Core构建为共用工程证据，不跨模块相加。没有以当前实际claude CLI/模型、Windows EXE或独立SSH消费新上下文，模型0。[实际范围与来源](../../../iterations/I07/delegation-context.md)。

## CT-07只读委派列表（2026-10-20）

T-M06-CC-153 / M06-CC-F01：WSL Node22.23.1定向110/110（含新7项列表+1项Claude允许项）与最终冻结桌面615/615零跳过/退出0；Windows Node24.19.0列表/真实stdio及独立MCP8/8。覆盖父/连接隔离、空身份/游标、unknown/非实时、撤销关系保留原读、父终态/连接撤权拒绝、观察器重开不重派，Claude/Codex允许只读项但reply_task仍需原审批。共用计数不相加，模型0；Windows原生CLI/真实模型/新EXE/独立SSH未验，首次冻结缺C资源及初次TAP覆盖如实记录。[日志、脚本、版本与范围](../../../iterations/I07/delegation-list.md)。

## CT-05实际材料包消费

T-M06-CC-151 / M06-CC-F01：WSL Node22.23.1、真实Claude2.1.303，一个原Task成功，实际MCP调用team_context/team_materials/team_context_packet共3次。当前文档2版时明确选择1版，返回正文摘要与最终回答严格匹配；完整重开及重复观察仍1Task、未重派。共享桌面576/576/Windows定向14项为受控检查，不能与真实任务或重复报告相加。不是另一个成员已收到或跨工具/Windows EXE/独立SSH验收。[实际报告、最终严格核对和可恢复脚本](../../../iterations/I07/context-packet.md)。

## 独立 MCP 接入

默认编辑用户.claude.json中的mcpServers.agentbridge，尊重CLAUDE_CONFIG_DIR；独立导出为agentbridge.mcp.json。真实2.1.303在隔离配置中添加、stdio连接和删除通过。托管任务原--mcp-config仍保持原任务授权范围。测试使用WSL隔离配置、无模型调用；Windows生产界面为受控机器，非该工具真实Windows/EXE/独立SSH验证。[完整流程、源码和证据](../../../iterations/I07/mcp-installation.md)。

## CT-04真实材料读取

T-M06-CC-147 / M06-CC-F01：WSL Node22.23.1 / 真实Claude2.1.303，一个原Task成功，两次真实MCP调用team_materials/team_document(revision:1)，当文档最新第2版时准确返回第1版正文。三个限定检查及完整观察器重开通过，仍1Task；重复报告不计额外执行。受控8项及stdioMCP检查纳入共享桌面525/525（无模型），不与真实Task相加。本片未打包，Windows EXE/独立SSH/其他工具未验。[报告与恢复脚本](../../../iterations/I07/public-materials.md)。

## CT-02真实MCP调用方与被调用方

T-M06-CC-146 / M06-CC-F01：当前WSL原生2.1.302，本工具真实作主发现/委派另外两种工具并读取成功结果，另在两条链中作为普通子任务被实际启动。各回答/原生Session/父子归属与精确消息通过，完整重开不重放；三工具共享9Task/6方向/16次MCP调用，不跨模块重复累加。保护7/7计入全桌面517/517，均为无模型回归，与真实Task分别计数。产品运行代码未改；Windows、新三工具、独立SSH/权限/表单/执行中断点未补验。[实际脚本、原始报告及边界](../../../iterations/I07/connection-delegation.md)。

## CT-02真实直接生命周期

T-M06-CC-145 / M06-CC-F01：当前WSL、Node22.23.1、真实原生2.1.302。首轮与原Session回忆均succeeded，取消收据与原Task cancelled分别核验，完整观察重开保留同Session/回答；3个原任务，重复只读观察前后3→3。沿用原生配置，未批准权限或重发原请求。新增验收保护7/7及最终桌面510/510为共享受控计数，不是该工具模型测试数。源码无产品行为变化；本轮未验真实委派/MCP调用方、新EXE或独立SSH。[原始结果、脚本、首次环境/契约失败及边界](../../../iterations/I07/connection-native.md)。

## 真实原生开发/复核成员

T-M06-CC-142 / M06-CC-F01：Claude2.1.302真实自动开发/复核各一轮，主协调同原生Session三轮，共5次，五组检查通过；每角色实际原生history观察到模型、job模型覆盖0，实际MCP工具调用22/7/6次，非Bridge工具/权限回复0。完成后只读重开仍5次，成员原生终态后逐项验收、主原生终态后总完成。同WSL受控机器路由/独立Bridge宿主，非独立SSH/新WindowsEXE或代码编译返修。[完整结果](../../../iterations/I07/native-members.md)。

2026-10-18 / T-M06-CC-140：新增受控原生CLI回归证明过期check不被空闲snapshot重跑，显式check仍可执行且未提交模型任务。[专项TAP](../../../../artifacts/desktop-polling/2026-10-18/claude-idle.tap)、[完整结果与Windows边界](../../../iterations/I07/desktop-polling.md)。

## 真实原会话续接后的权限

T-M06-CC-11：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。三项检查通过，共两次自动回合、手动启动0；阶段2的task/request不同但Conversation/实际原生Session相同，每轮真实权限等待/观察后台重启/精确Write允许后成功。累计attempt/used/Write/权限命令各2，持久事件仅user_start/attention且pending0；完成重查未重派。[证据及复现](../../../iterations/I07/resume-native-permission.md)，共享计数不跨模块累加。未测后续轮拒绝、执行成员交接、Windows或独立SSH；未更新包或发布。


## 真实自动主角色首轮权限

T-M06-CC-10：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次事件自动原生回合、手动原生启动0，权限等待/观察后台重启、精确Write允许成功/拒绝failed三项检查通过；每项工作attempt/used各1、只有已消费user_start且pending0，原生Write和权限命令各合计2次。首次工具断言遗漏及修正后的只读恢复核对分别保留，[证据与复现](../../../iterations/I07/auto-native-permission.md)。不是执行成员交接/原会话续接轮次、Windows或独立SSH，未更新EXE。共享真实证据不跨模块累计。


## 真实原生权限补验

T-M06-CC-09：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次手动小队原生调用，等待/观察后台重启、允许隔离Write并成功、拒绝后failed且文件不存在三项检查通过；完成后重复执行脚本只查原记录，每场景attempt1条、权限控制命令合计2次。真实原生证据共享引用，不跨模块重复计数。[报告、复现与限制](../../../iterations/I07/native-permission.md)。未测自动权限链、Windows真实模型或独立SSH；未改产品源码/包，以下历史结果保持原日期。


更新日期：2026-10-12。功能 **M06-CC-F01**；对应[设计](design.md)。

## 1. 当前受控回归

[claude-host.test.cjs](../../../../desktop/tests/claude-host.test.cjs) 的 **16 项**测试均在 [2026-10-12 桌面 TAP](../../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) 中通过。测试启动受控 JSONL CLI 进程，包含真实 OS detached 进程和文件恢复行为；夹具回复不是真实 Claude 模型回复。

| 测试 ID | 实际测试名称（同源文件） | 证明范围 | 结果 |
| --- | --- | --- | --- |
| T-M06-CC-01 | `discovers executable, separates a shared tool connection from project instances, checks real installation/auth`；`missing and unsupported authentication status never report a healthy Claude connection`；`npm Windows launchers bypass shell expansion, and discovery includes standard native/npm installs` | 发现/认证区分、连接与实例分离、Shell 不展开 | passed / 受控 CLI 与命令构造 |
| T-M06-CC-02 | `idempotent submission and native resume survive closing and reopening the observer`；`detached execution completes while observer is closed and replay keeps its result` | 稳定请求、原 Session、窗口观察关闭后原执行继续 | passed / detached 夹具 |
| T-M06-CC-03 | `permission prompts are visible, replies use the original control channel and replay an operation receipt` | 原许可可见、正确通道回应、重复操作读取收据 | passed / JSONL 控制夹具 |
| T-M06-CC-04 | `denied tools, provider failures, missing result and unsupported forms never become successful tasks`；`API error result with stale running state finishes failed after the native process exits` | 拒绝/Provider/无结果/不支持表单不假成功；result error 能正确退出 | passed / 失败夹具 |
| T-M06-CC-05 | `cancellation is idempotent and final only after native process exit, preserving history` | 取消去重、原生退出确认和历史保持 | passed / OS 进程与控制协议 |
| T-M06-CC-06 | `independent project instances execute concurrently through their shared Claude installation`；`missing observer heartbeat preserves unknown outcome and project occupancy without replaying the request` | 独立上下文并行；unknown 不释放、不重投 | passed / detached 与状态注入 |
| T-M06-CC-07 | `worker bootstrap exit is a failed unstarted task with persisted diagnostics`；`Windows sharing violations retry an atomic replacement without discarding the JSON document`；`heartbeat rename errors cannot crash the observer, and diagnostics redact credentials` | 运行资源失败、原子替换重试、诊断不中断观察且脱敏 | passed / 启动和文件故障注入 |
| T-M06-CC-08 | `per-instance model overrides pass to the CLI without changing global settings, and resume preserves the conversation snapshot`；`instance model updates require the current revision, preserve old conversations and support restoring inheritance` | 旧实例 API 兼容、revision 和会话快照保护 | passed / 兼容路径；不是当前节点模型界面需求 |

本表分组覆盖全部 16 项，不把 8 个分组当作测试计数。整个桌面套件 87/87 还包含机器、SSH、Coordinator 和协作测试。

## 2. 历史真实 Windows 证据

| 日期 | 实际功能 | 结果与证据 | 范围 |
| --- | --- | --- | --- |
| 2026-10-09 | 原生许可、实际 Write、取消后进程退出与重开历史 | [I04B-claude-controls-real.json](../../../../artifacts/I04B-claude-controls-real.json)：4 项 passed | 隔离实例，曾使用实例模型覆盖；不代表当前全部原生继承流程 |
| 2026-10-09 | Windows Claude 与 WSL OpenCode 两轮同 Session、各自正确答案 | [I04B-dual-real.json](../../../../artifacts/I04B-dual-real.json)、[说明](../../../iterations/I04B/report.md)：passed | 同一物理宿主的两个环境 |
| 2026-10-10 | Claude 2.1.296 原生默认真实回复与续聊 | [I05-real.json](../../../../artifacts/I05-real.json)：`claudeNativeResume` 和 Claude 直接回复检查为 true | I05 汇总状态 partial，包含其他工具失败 |
| 2026-10-10 | Claude → OpenCode、OpenCode → Claude、Claude → WSL Codex、WSL Codex → Claude | [I05-real.json](../../../../artifacts/I05-real.json)、[Codex 主任务记录](../../../../artifacts/I05-codex-main.json)：4 条核心链 passed | 真 MCP + 原生子回答；不是跨物理机器双向验证 |

本次文档整理未重新运行真实 Claude、未修改账号和模型。真实历史结果的原生版本与日期须随使用场景一起保留。

## 3. 未通过、未测和完成标准

| 项目 | 当前状态 | 下一次验收应保存 |
| --- | --- | --- |
| AskUserQuestion 结构化表单 | 未适配；明确拒绝路径已测试 | 新协议设计、实际问题结构、原请求回应与操作收据 |
| 当前源码 0.6.0-alpha.1 的 Windows 便携包 | 尚未交付真实复验 | 包摘要/资源、真实原生初始化与两轮、关闭重开无新 Prompt |
| 当前版本所有 Provider / 登录模式 | 未全面覆盖 | 原生版本/认证方式、真实回复或原错误，不替换原配置 |
| 流式 GUI 完整端到端延迟 | 当前基线未重测 | 原生确认时间、worker事件、GUI可见时间，说明采样边界 |

旧 `spawn UNKNOWN`、ICU 资源清理和 heartbeat 文件故障有对应修复/回归，不等于可以把未来任何启动异常标为“未执行”。仍须根据 native-starting/completion 证据区分 failed 与 unknown。

## 4. 复现与维护

专用回归：`node --test desktop/tests/claude-host.test.cjs`。完整回归：`npm test --prefix desktop`。真实脚本：[windows-claude-controls-real.cjs](../../../../desktop/tests/windows-claude-controls-real.cjs)、[windows-dual-real.cjs](../../../../desktop/tests/windows-dual-real.cjs)、[windows-i05-real.cjs](../../../../desktop/tests/windows-i05-real.cjs)。

真实脚本应在 Windows Node 和独立 profile/目录运行，会有原生模型调用，许可场景也会产生指定文件修改。报告必须区分受控 fixture、Mock UI、实际 CLI 和最终包，并同步设计能力表及当前迭代验收状态。

## I06C alpha.13 独立实机补充

2026-10-14：原生 OpenCode 2.0.26 / Windows Claude，继承已有账号与配置。独立 SSH 双向 MCP 主子及 OpenCode 同 Session 两轮通过；Windows Claude 取消以 nativeExited 和 Task cancelled 验证。OpenCode 文件任务遇到内核 OOM，未知保持原 Task/Session 占位；未确认终态不算成功，不换请求/目录重做。详细版本、实际结果及证据见 [I06C 实机](../../../iterations/I06/final-delivery.md)。
