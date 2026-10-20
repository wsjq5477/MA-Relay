# alpha.34：OpenCode 双协议与当前源码整合发布

日期：2026-10-20。当前状态：准备发布 **0.6.0-alpha.34** Windows x64 预发布；只有最终上传与公开下载核验完成后才标记已交付。稳定历史版仍为 0.5.0，完整 I06C/I07C 未准出。

## 1. 本次源码范围

用户明确授权 Git 提交并发布 EXE。本次冻结整个当前已验证工作源码，包括：

- [OpenCode 1.x/2.x 兼容修复](opencode-v1-compatibility.md)：执行、同 Session 续聊、权限/问题、取消与只读恢复，MCP 双格式。官方 1.19.3 Linux CLI + 本机受控模型传输五组通过；不是 Windows 原生或真实模型验收。
- [独立 MCP](mcp-installation.md)、[CT-04 公共材料](public-materials-ui.md)、[CT-05 明确材料包](context-packet.md)及[桌面选材导出](context-packet-ui.md)。
- 原已整合的 alpha.30–32 历史路由、版本/管理/收据保护，以及[alpha.33 维护持久化修复](maintenance-persistence.md)。不回退原有请求/控制语义。
- 精确收录 alpha.33 daemon manifest，摘要 `a8a8af7c048f430b1138603dd3cc3a89ca8f8cfc3207768e61ceffd8676a83fc`；继续拒绝未知/被篡改版本，不把同协议号作为信任依据。

原工作区 HEAD 为 a872275，远端已包含 alpha.30–33。提交保留当前完整工作树及现有远端历史，不强制覆盖 master，不删除原未提交功能。原始运行材料、私有状态、凭据、依赖目录、构建产物和 EXE 不进入源码提交。普通三方合并的冲突已逐项核对，保留两侧历史；没有采用忽略远端树的合并策略。

发布门禁新增 `opencode-dual-api-v1` / `team-context-mcp-v1`，因此新 EXE 遇到仍运行的 alpha.33 中央后台会明确要求停止并重开，设置和停止入口仍可使用。daemon 同时声明语义能力，未知原请求不受此版本更新释放。

## 2. 验证与冻结方法

发布前当前工作源码已完成核心 **56/56**、桌面 **592/592**，build/typecheck/lint/文档检查通过，见[OpenCode 专项证据](../../../artifacts/opencode-v1/2026-10-20/summary.json)。历史专项保留原日期，不把旧源码结果归为新包实测。

本次在源码提交之后导出独立构建副本，所有打包检查对该固定副本执行。`verify-package.cjs --portable` 核对前端、app.asar、Core、Windows后台、Linux 后台与实际 EXE 摘要；普通 Windows EXE 使用隔离 profile 验证启动、生产 IPC、保留历史、窗口/后台重开和未重发。实际执行后记录结果，不提前填写通过。

## 3. 当前分发状态

新 Tag、源码提交、EXE 大小与 SHA-256、公开 URL 与完整匿名下载结果在完成后补录。本页准备阶段不构成发布成功证明，alpha.33 标签和旧 EXE 不移动。

## 4. 升级与未测边界

Windows：先在旧版设置里选择“后台运行 → 停止后台并退出”，再运行新 EXE。仅关闭窗口会保留旧中央后台；新窗口不能据此认定已换成新实现。

SSH：客户端更新不会自动替换远端 daemon。原机器空闲时查看“后台维护 → 升级后台”，确认后升级、重连并重新扫描。原 unknown 只查原 requestId/operationId，不重新执行，也不以新节点/目录绕开占位。

本轮未声明用户 profile、独立生产 SSH、真实模型、Windows 原生 OpenCode 1.x 推理或所有 1.x 小版本已验收。普通 EXE 的合成持久历史/IPC 验证与真实原生工具生命周期分开记录。
