# Claude Code 适配器测试报告

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
