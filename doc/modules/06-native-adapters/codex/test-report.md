# Codex 适配器测试报告

## alpha.27：未派发任务恢复

T-M06-CX-06 / M06-CX-F01：2026-10-17，WSL Node22.23.1、真实Windows Node24.19.0，合成目录，模型0。新增恢复10/10，修复前0/10；覆盖EEXIST持久失败/同ID去重/新请求可进入准备、原job证明、重开保留，以及缺run、空worker.log、旧/空心跳、事件、native/进度均保持unknown。Windows共享契约86/86、最终普通EXE合成恢复5组通过；旧原生POSIX夹具仍由WSL全量验证，未冒充真实Windows模型。[原始日志与未测项](../../../iterations/I06/windows-start-persistence.md)。
## alpha.19 Linux CLI 发现专项

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

## 2026-10-16：Codex明确错误终态

T-M06-CX-08 / M06-CX-F01：alpha.22源码工作区，WSL Linux / Node22.23.1，受控CLI/worker及磁盘、模型0。错误前后混合完成事件且退出0均保持failed；重开原请求仍失败，同ID不重复调用。修复前失败证据、修复后Codex/小队专项23/23（工程共享总数）和未测边界见[专项](../../../iterations/I07/codex-terminal.md)。未重建EXE、未验证真实原生续接或I07C激活。
