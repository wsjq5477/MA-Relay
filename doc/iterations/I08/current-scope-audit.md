# 当前功能范围、实现缺口与验收

2026-11-22。源码从 GitHub `master` 的 `16a197c` 建立独立工作树。当前公开预发布为 `0.6.0-alpha.76.issue33.3`，冻结 `84ed341`。原本地工作区有未提交改动，作为产品约束和路线的输入，本轮在独立分支交付。[公开预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.76.issue33.3) · [现行产品约束](../../product-constraints.md)

## 功能核对

| 功能 | 源码及证据 | 仍需完成 |
| --- | --- | --- |
| 获准发现、固定端点、新建与原 Session 续聊 | 登记、独立调用方、原绑定续聊和串行准入均有实现。历史 Windows Codex → WSL Codex 有正文、续聊、在途重开及取消证据 | Windows Codex → 独立 Linux OpenCode 的工具实际可见、固定提交和目标目录、首次成功耗时及两轮结果消费 |
| 原任务、事件与未知提交恢复 | `task_result` 按原 Task/委派/独立调用方的客户端 request ID 恢复，事件使用原游标。受控回归覆盖丢回应、原执行一次、撤权与历史缺口 | 所选实机链路中的提交回应丢失、后台重开、越权及目录变化 |
| 原生等待与答复 | OpenCode 已接权限和表单，Claude Code 已接权限。MCP 原答复没有只读恢复入口，本轮已补齐 | 实机原生等待转交和丢回应后的恢复。Claude Code 结构化表单、其他入口仅按各自能力表处理 |
| 已启动的 OpenCode 服务 | Core Controller 可连接既有服务。本轮用 WSL OpenCode 1.2.10 重验只读连接和观察器重开，原服务保持 | 完整的 MachineHost/登记端点与已有服务链及其升级验收 |
| 最小上下文交接、结果和材料 | 普通委派传递版本化任务正文，`task_result` 返回获准结果，CT-04/05 公共材料可选 | 由调用方明确选第二个 Agent 并核对真正读到的摘要与日志。实体文件交付、通用 Markdown 回写和写入冲突处理尚未实现 |
| 可选扩展 | 静态 Adapter 注册、现有 TeamSpace/TeamAutomation 保留。DSH NEXT 连接面板已发布 | 通用第三方插件宿主、Markdown 工作区、Memory 和 Profiles 处于后续范围。Attach/Steer、任意已有会话导入和跨主体接管未进入首阶段 |

历史证据及各适配器限制见[真实 Codex 验收](interconnect-development.md#17-原生登录恢复后的真实调用与模型退役门禁)、[接入矩阵](../../agent-integration-matrix.md)和[迭代路线](../../project-plan.md)。

独立 Linux 实机验收使用已有授权的 SSH 目标及该用户的 OpenCode 配置，固定目标目录和仓库提交。记录从原生 Codex 执行发现工具到首条结果可读的耗时。核对两轮请求使用同一原生 Session，实际等待经原任务答复，并在一次丢回应或断线时用原 ID 与游标找回结果。之后再验证第二个 Agent 实际读到的日志和摘要，以及可选 Markdown 回写的版本冲突。

## 原答复收据恢复

- 在现有 `reply_task` 增加只读参数 `queryOnly=true`。只接受 `taskId` 和原 `operationId`，stdio 通过实时 `list_agents` 核对 `reply.query-v1`。后台沿原机器和已拥有的委派查询，返回原答复类型及状态。找不到、类型不符或读控资格失效时拒绝，保留原意图。
- Core 为新收据持久保存 Task、执行和操作类型。已知拒绝释放交互请求占用，原操作收据仍按原执行查询。旧 Core 收据保持原 HTTP GET 行为，缺少原 Task 或类型证据时 MCP 无法确认；Claude 原收据可沿用已有 `op: reply` 证据。
- 已确认答复与 Task 结局分别读取。适配器和调用方仍使用现有授权及原生交互。MCP 工具名、原 Task 状态和公共任务台账沿用原契约。

[MCP 入口](../../../desktop/electron/mcp-client.cjs) · [原任务路由](../../../desktop/electron/agent-network.cjs) · [Core 收据](../../../src/storage/operations.ts) · [调用方契约](interconnect-caller-contract.md#原答复收据)

## 文档刷新

以现行产品约束和公开预发布更新资料入口、整体设计、路线、接入矩阵、协议及模块设计和报告。主文档删除重复的旧发布摘要，按版本保留历史迭代和验收记录。用户文档清理早期 alpha.64/alpha.65 等限定，补齐 DSH NEXT 操作路径；用户站适配表修复与注册表不匹配的问题，生成 11 个原生入口和包含 ChatGPT Web 的 12 入口能力表。

## 验收

| 证据 | 结果 |
| --- | --- |
| Windows Node 24.12.0 桌面定向回归 | 扩展回归 43 通过、1 失败。认证 Coordinator 启动报 `PRIVATE_DIRECTORY_TIMEOUT`，在同环境的未修改基线也复现。原答复专项 4/4，覆盖丢回应、读取期间撤权及新旧后台门禁，目标为受控宿主 |
| Windows OpenCode V1 | 5/5。生产 Hub/Edge 连受控 HTTP 服务，覆盖权限、表单、拒绝与确认收据、Hub/Edge 重开、只读复查与原权限/表单各派发一次 |
| Windows Core 扩展回归 | 首轮 20 通过、2 失败、2 平台跳过。两项 OpenCode 启动耗时断言在未修改的 `16a197c` 和本轮源码上均复现 |
| WSL 实际 OpenCode 1.2.10，Node 24.13.0 | 9 项只读生命周期检查通过。原服务先于观察器启动，观察器关闭/重开两次仍复用同一服务，任务数为 0。首轮把空白配置的首次原生写入计入观察器对照，复验把基线移到服务就绪后。复验未发送模型消息 |
| WSL Node 24.13.0 桌面后端 | 扩展回归 44/44，无跳过。认证 Coordinator 和真实 stdio 到受控宿主，模型 0 |
| 用户站 | 6/6。实际 VitePress 构建与静态产物审计通过，18 个用户页与 404、两张表、158 个网页和搜索资源，内部页和原始证据导出均为 0 |

整仓文档检查在独立工作树仍有 3071 项既有本地证据链接缺失，逐项比较无新增链接错误。原始日志保存在 D 盘 `artifacts/current-scope-20261122`，包括 `desktop-final.log`、`desktop-reply-focused.log`、`desktop-registry-baseline.log`、`core-regression.log`、`opencode-version-baseline.log`、`wsl-desktop-suite.log`、`wsl-existing-opencode-final.log`、`wsl-existing-opencode-recheck.log`、`docs-site-final.log` 和 `docs-delta.json`。Windows 开发数据和临时文件在 D 盘，Ubuntu-22.04 存储在 E 盘。实机尚缺独立 Linux SSH OpenCode 目标和该拓扑的真实原生模型证据。公开包验收引用对应发布记录。
