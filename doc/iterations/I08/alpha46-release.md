# alpha.46 源码与 Windows EXE 发布

日期：2026-10-22。用户明确授权提交所有本地源码修改并将源码和 EXE 推送 GitHub。本轮沿用已完成 Windows 验证且与当前运行源码一致的 alpha.46 EXE；不重建相同产品，不升级日常后台或远端 daemon。

## 冻结范围

整合 alpha.36 公开基线之后的全部产品、测试与文档增量：维护恢复/进度与原收据核对、OpenCode 原上下文准备、OpenDesk 已有 CLI/桌面网关、MCP 原生配置管理与独立调用、DSH profile、MCP 启动器/恢复/观测有效期和非 GUI 首次接入。逐轮设计、首次失败与验收见[迭代目录](../README.md)、[MCP02 恢复](mcp-open-recovery.md)、[原生组件验收](mcp-native-acceptance.md)及[日常 OpenDesk 恢复与原生查询](opendesk-mcp-diagnostic-repair.md)。

源码包含维护中的测试和文档；用户原生配置、凭据、运行状态、原始验收材料和 EXE 不进入 Git 源码树。一个误落到仓库根的 Windows 路径诊断端点文件已移至本地忽略的原始材料目录，仅保留本地备查。

## 包与验证

| 项目 | 事实 |
| --- | --- |
| 版本与文件 | `0.6.0-alpha.46`，`AgentBridge-0.6.0-alpha.46-Windows-x64.exe` |
| 大小 | 130180760 字节 |
| SHA-256 | `57f1af73f761af72d75121284b023a001dad05eb30c0c197e18851cc9a7e8c48` |
| 本轮包复核 | 50 后台模块、84 Core 文件、1698 Linux 文件，Windows/Linux 后台、Core、ASAR 和前端与当前源码一致；[package.json](../../../artifacts/github-alpha46/2026-10-22/package.json) |
| Windows 普通 EXE | 同日最终包已通过 4 组隔离生命周期检查，模型 0；[原始结果](../../../artifacts/mcp-open-recovery/2026-10-22/windows-portable.json)，本轮不重跑已完成且产品未变的相同环境检查 |
| 真实原生 | OpenDesk/DSH 组件各有正式授权与真实 Claude 子任务证据；日常 OpenDesk 父模型已实际只读调用一次 list_agents，返回 7 个获准节点；这不证明父模型自主委派或日常页面验收 |
| 本轮工程检查 | 本轮核心 68/68、桌面 758/758、类型/lint、用户站 6/6 与构建通过；提交前完整文档检查232份Markdown、15对模块设计/报告通过；发布状态同步后再刷新。日志见 [核心](../../../artifacts/github-alpha46/2026-10-22/core.log)、[桌面](../../../artifacts/github-alpha46/2026-10-22/desktop.log)及同目录工程日志 |

## 发布步骤与边界

源码提交 `9766eb4e6b9d5faa7a764fa2fe998c452b128cbb` 已推送 `master`，标签 `v0.6.0-alpha.46` 固定同一提交；[GitHub预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.46) 已公开，[EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.46/AgentBridge-0.6.0-alpha.46-Windows-x64.exe) 与 [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.46/SHA256SUMS.txt) 均已上传。上传附件大小和服务端digest与本地一致，随后匿名无凭据完整下载返回HTTP 200，全部130180760字节的SHA-256与本地及校验附件相同。旧标签和旧EXE未改动。后续仅发布状态文档提交位于冻结标签之后，不改变产品包。

首次使用原有发布凭据得到HTTP 401，本地提交及标签准备先完成；用户更新凭据后认证和仓库写入通过，再执行源码/标签原子推送、草稿上传、公开发布和匿名下载。凭据仅通过非回显输入与进程内存使用，不写入Git、文档、日志、校验文件或本轮发布报告。

公开核验见[public-download.json](../../../artifacts/github-alpha46/2026-10-22/public-download.json)，附件元数据见[github-release.json](../../../artifacts/github-alpha46/2026-10-22/github-release.json)。

程序未签名，Windows 可能提示未知发布者。升级前在旧 Bridge 的“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；只关窗口不会替换后台。Windows EXE 更新不自动升级 SSH daemon。OpenDesk 由 Bridge 写入 MCP 配置前须先从托盘完全退出，写入后再打开，避免旧内存配置覆盖。

完整 I06C/I07C/MCP02 未准出；原生父模型自主委派、日常原生页面与独立 SSH 等边界按专项保留。本轮发布不放宽原请求 unknown 的恢复规则，不重发旧任务，不发布用户私有材料。
