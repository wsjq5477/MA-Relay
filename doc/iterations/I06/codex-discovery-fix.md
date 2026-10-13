# I06A Codex 自然语言发现修复交付

日期：2026-10-12。关联 I06-FIX-CX-01、I06-NET-03、AB-F07/09/13/17、M06-CX-F01、M08-F02/F05、M10-F02/F06。源码与修复候选为 **0.6.0-alpha.3**；0.6.0-alpha.2 的历史 6A 验收保留，不代表旧包包含本次修复。正式稳定版仍为 0.5.0，I06B/C 未完成。

## 问题与根因

用户原需求是“查看你的模型，以及你连接的子agent有哪些，让他们分别告诉你他们的模型是什么。你汇总并输出一个连接图，标识agent与模型”。两轮原任务均已带 Bridge MCP 配置，原生日志却调用 Codex 内部 `list_agents`，依据只有 `/root` 得出没有连接子 Agent 的结论；没有 Bridge MCP 调用。stderr 有模型列表刷新超时，两轮仍以成功终态退出，不能把该超时当成发现入口错误的根因。

Codex worker 只向 CLI 发送原始需求，未像 Claude/OpenCode 一样提供 Bridge 协作指引。I05 真实主 Agent 验收需求显式要求 MCP，未覆盖本次自然语言需求。[只读脱敏诊断](../../../artifacts/codex-discovery/2026-10-12/diagnosis.json)保留实际证据，不复制生产节点身份、原生 Session、scope、endpoint 或凭据。

## 实现与兼容

- [codex-host.cjs](../../../desktop/electron/codex-host.cjs)：带协作 MCP 的新会话/续聊回合在 stdin 原始需求前加入指引，明确 Bridge 发现入口、原生列表区别、MCP 故障语义、稳定委派 ID 和模型自报依据。普通任务输入不变；用户消息、任务标题、持久 job、请求指纹和原生配置不变。
- MCP 工具过程显示 `mcp_tool_call · server/tool`，便于识别是否调用了 `agentbridge/list_agents`；不记录工具参数或私有 endpoint。
- [Codex 回归](../../../desktop/tests/codex-host.test.cjs)增加新会话/原 Session 续聊/普通任务/请求去重覆盖；[真实脚本](../../../desktop/tests/linux-codex-discovery-real.cjs)使用原自然语言需求，不在测试需求中额外指定 Bridge MCP。
- 桌面版本与锁文件升为 alpha.3；[包校验脚本](../../../desktop/scripts/verify-package.cjs)支持 `AGENTBRIDGE_PACKAGE_REPORT` 指定独立产物路径，不覆盖 alpha.2 既有报告。

数据模型、RPC/API、授权、父请求 scope、取消与 unknown 状态契约不变，核对 `data-model.md` / `protocol.md` 无需迁移。整体设计、M01、M06/Codex、M08、M10、架构与迭代路线已同步。

## 实际验证

| 场景 | 环境与证据级别 | 实际结果 | 原始证据 |
| --- | --- | --- | --- |
| 桌面受控回归 | WSL / Node v22.23.1；受控进程/CLI/MCP | 89/89，失败/跳过均为 0；Codex 4/4 | [TAP](../../../artifacts/codex-discovery/2026-10-12/desktop-tests.tap) |
| 自然语言真实发现与汇总 | WSL / Codex 0.161.0、Claude Code 2.1.296；真实原生主/子与 stdio MCP，允许关系和 dispatcher 为隔离受控实现 | 实际 `list_agents → delegate → task_result`，双方 succeeded，主回答包含连接图 | [报告](../../../artifacts/codex-discovery/2026-10-12/native-report.json) |
| Windows 候选构建 | 0.6.0-alpha.3，WSL 构建 Windows x64 portable | 根 TS/前端类型与 Vite 构建、Windows 包生成通过 | [构建日志](../../../artifacts/codex-discovery/2026-10-12/package-build.log) |
| 包内资源比对 | Windows app.asar / 后台 / Linux manifest | 25 个后台模块、1360 个 Linux 文件，窗口/前端/版本与本次源码一致 | [包校验](../../../artifacts/codex-discovery/2026-10-12/package.json) |

真实模型实验在版本标签 alpha.2 加修复时运行，随后仅变更交付版本为 alpha.3，Codex 行为代码相同。核心 TS 无行为修改，复用先前 43/43 基线，本次未重跑；受控 resume 不能替代原生 resume 验收。模型信息来自子节点自报，未独立核实供应商运行时模型字段。隔离受控关系不替代 GUI 全关系、生产网络全部节点或独立物理机器双向协作验收。

## 程序与加载方式

新程序：[AgentBridge-0.6.0-alpha.3-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.3-Windows-x64.exe)。大小 129,293,929 字节；SHA-256 `e89a5a6c0e931d8da1f2e9b8a7fb6258ea43203a8c2cf32007244f65c0fbd130`。

现有 Coordinator 持有旧冻结代码，普通关闭窗口不会替换它。打开新 EXE，从新窗口的“设置 → 后台运行 → 停止后台并退出”停止现有后台，再次打开新 EXE，在原主 Agent 协作会话中重新提出需求或新建协作会话；不需要旧窗口。已有历史和关系保留；不原地修改旧版本目录，不把源码修复冒充旧包已更新。本次没有停止用户生产后台。

真实 Codex 原 thread 续聊、现有生产 profile 的升级全过程、完整 SSH/权限/取消/故障指标未重跑，历史边界继续保留；原生 `list_turns` 限制没有通过更换模型或新建 thread 绕过。跨独立设备链与节点图属于 I06B/C。

## 普通新 EXE 实测

2026-10-12 / alpha.3 / Windows 普通 portable EXE：窗口与新 Coordinator 启动，冻结 Codex 后台摘要与修复源码一致；正常关闭窗口/便携 wrapper 后后台保持，重开复用同一 Coordinator，requests/delegations=0。没有 inspector/debug 参数，没有提交模型需求，没有修改生产 profile；通过。[报告](../../../artifacts/codex-discovery/2026-10-12/portable.json)、[脚本](../../../desktop/tests/windows-codex-discovery-portable.cjs)。

交付前再次执行升版后的桌面回归 89/89，通过；根 lint 及修改的 CJS 语法检查通过。[lint](../../../artifacts/codex-discovery/2026-10-12/lint.log)。文档检查通过：106 篇 Markdown、14 对模块设计/测试、986 个本地链接（后续增加引用后以 [最终检查](../../../artifacts/codex-discovery/2026-10-12/docs-check.log) 为准）。
