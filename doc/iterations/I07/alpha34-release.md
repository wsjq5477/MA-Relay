# alpha.34：OpenCode 双协议与当前源码整合发布

日期：2026-10-20。当前状态：**0.6.0-alpha.34 已作为 GitHub Windows x64 预发布交付**，源码/新标签、EXE/校验附件及匿名完整下载均已核验。稳定历史版仍为 0.5.0，完整 I06C/I07C 未准出。

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

本次在源码提交之后导出独立构建副本，所有打包检查对该固定副本执行。`verify-package.cjs --portable` 核对前端、app.asar、Core、Windows后台、Linux 后台与实际 EXE 摘要；普通 Windows EXE 使用隔离 profile 验证启动、生产 IPC、保留历史、窗口/后台重开和未重发。最终冻结提交 `1af4dab415d63072be59c103a606df0952ab2ff8`，570 个 tracked 文件逐一与独立副本匹配。实际验证：核心 56/56、桌面 592/592，构建/类型/lint/文档检查通过；43 个后台 CJS、81 个 Core 构建文件、1451 个 Linux 文件、app.asar 与前端均匹配冻结源码。Linux alpha.34 manifest digest 为 `1174495692496e1e594a87cf4d312edc5defa162e01fdf7b6815e44bc9fc8678`。

Windows 包内 Core 受控协议五组通过，模型 0：原 1.x 启动器准入/未知 major 拒绝、原生生成 Session 下的续聊、重开只读、不重发、取消证据及旧协议绑定隔离。普通无调试 EXE 另有整合功能五组与 alpha.33→alpha.34 升级五组通过，包含 SQLite 精确修订、MCP 导出、孤立历史、原 unknown、窗口重开和完整中央后台重启；未执行原生模型任务。不同层级不相加为真实模型验收数。

## 3. 当前分发状态

已推送源码提交：`1af4dab415d63072be59c103a606df0952ab2ff8`；新标签 **v0.6.0-alpha.34** 固定该提交，旧标签和旧 EXE 不移动。后续发布材料提交只更新文档，不改变已上传 EXE 或冻结标签。

- [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.34/AgentBridge-0.6.0-alpha.34-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.34/SHA256SUMS.txt)
- [GitHub 预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.34)
- [冻结源码](https://github.com/wsjq5477/MA-Relay/commit/1af4dab415d63072be59c103a606df0952ab2ff8)

EXE 大小 **130,025,537 字节**，SHA-256：`12252dc8627c31f0d7a010c14e8080e3e2673a22586f535e1cc7013662094180`。GitHub asset uploaded/size/digest、校验附件及匿名 HTTP 200 完整下载均一致。

实际原始证据：[发布元数据](../../../artifacts/alpha34-release/2026-10-20/github-release.json)、[匿名完整下载](../../../artifacts/alpha34-release/2026-10-20/public-download.json)、[发布日志](../../../artifacts/alpha34-release/2026-10-20/publish.log)、[最终汇总](../../../artifacts/alpha34-release/2026-10-20/verification-summary.json)、[源文件逐项复核](../../../artifacts/alpha34-release/2026-10-20/source-verification.json)、[包一致性](../../../artifacts/alpha34-release/2026-10-20/package.json)、[核心](../../../artifacts/alpha34-release/2026-10-20/core-tests.log)、[桌面](../../../artifacts/alpha34-release/2026-10-20/desktop-tests.log)、[Windows包内Core](../../../artifacts/alpha34-release/2026-10-20/windows-opencode-v1.json)、[普通整合EXE](../../../artifacts/alpha34-release/2026-10-20/windows-integrated-portable.json)、[旧后台升级EXE](../../../artifacts/alpha34-release/2026-10-20/windows-upgrade-portable.json)。

## 4. 升级与未测边界

Windows：先在旧版设置里选择“后台运行 → 停止后台并退出”，再运行新 EXE。仅关闭窗口会保留旧中央后台；新窗口不能据此认定已换成新实现。

SSH：客户端更新不会自动替换远端 daemon。原机器空闲时查看“后台维护 → 升级后台”，确认后升级、重连并重新扫描。原 unknown 只查原 requestId/operationId，不重新执行，也不以新节点/目录绕开占位。

本轮未声明用户 profile、独立生产 SSH、真实模型、Windows 原生 OpenCode 1.x 推理或所有 1.x 小版本已验收。普通 EXE 的合成持久历史/IPC 验证与真实原生工具生命周期分开记录。
