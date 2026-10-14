# I06：alpha.9 GitHub Windows EXE 分发

日期：2026-10-13。关联 AB-F17、M10-F06、T-M10-25。用户要求将可直接运行的 Windows EXE 上传到 GitHub；不要求用户准备 WSL 或自行编译。

## 范围与设计

分发已有 `0.6.0-alpha.9` Windows x64 便携包，作为 GitHub prerelease，不把二进制写入源码树。标签 `v0.6.0-alpha.9` 绑定已上传源码提交 `2b6f4f71c19608be878fc33dc1be422a6fd349e9`。本地后来开发的 alpha.10 首批不在此次源码标签或附件内。

流程：核对已有包 → 创建发布草稿 → 上传 EXE 与校验文件 → 核对远端附件状态、大小和摘要 → 发布候选 → 查询公开发布。回应不明确查询原发布/附件，不删除重传、不借换版本号绕过未知结果。

没有产品代码、架构、数据模型、协议或恢复合约变化；仅新增下载入口与分发记录。已同步整体设计、M10 设计/报告、整体验证和路线。稳定历史版本仍为 0.5.0，完整 I06C 与正式 0.6.0 准出不受这次分发改变。

## 实际核验

| 场景 | 实际结果 | 证据级别与边界 |
| --- | --- | --- |
| 本地附件 | EXE 129,583,670 字节；SHA-256 `80c8a39036ba93466de96955e707280f436b6da258d5e047c7590822e2c0d688`，与原 alpha.9 包报告一致 | 本次实际文件核验；未重新构建 |
| GitHub 上传 | EXE 与 SHA256SUMS.txt 均 state=uploaded；服务器大小和 SHA-256 与本地一致 | 真实 GitHub API；不是程序启动验收 |
| 公开发布 | draft=false，prerelease=true；源码目标为上述提交 | 真实公开发布查询；不作为稳定版 |
| 历史程序验收 | 2026-10-13 原 alpha.9 包资源及普通 portable 启动/关闭/重开证据继续保留 | [原报告](node-management.md)，本次没有重跑 |
| 原生与服务器 | 本次没有提交模型 Prompt、连接或升级用户服务器 | 未测试；历史结果不改日期/版本 |

脱敏分发元数据：[release.json](../../../artifacts/github-release/2026-10-13/release.json)。该文件仅含公共发布链接、源码提交和附件核验字段；不包含凭据、原生配置或内部运行身份。原始模型/界面日志留在本地。

本次源码同步时的沙箱回归失败继续保留在 [源码范围说明](../../repository-sync.md)，不因上传成功改写为通过。完整本地资料检查见实际执行输出；仅源码克隆仍缺历史 EXE 和私有原始材料。

## 下载与使用

- [Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.9/AgentBridge-0.6.0-alpha.9-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.9/SHA256SUMS.txt)
- [候选发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.9)

下载 EXE 后双击运行，无需为 AgentBridge 安装 Node.js 或 WSL；使用的原生 Agent 工具仍需自行安装并登录。远端 Linux 资源已包含在程序中，用于 SSH 接入，不要求本机有 Linux 环境。已有旧后台时，在新窗口“设置 → 后台运行 → 停止后台并退出”后重新打开；保留原机器、节点和历史。

## 2026-10-14：alpha.15 当前源码与 Windows EXE

将当前 I06C 源码提交 `15b7c9ea9c3d53802797b655e0cffaf365658574` 推送到 `master`，并将从该源码重建的 Windows x64 portable EXE 发布为 `v0.6.0-alpha.15` prerelease。源码提交、构建包、远端附件和校验文件均分别核对。

| 核验项 | 实际结果 | 证据级别与边界 |
| --- | --- | --- |
| 源码 | `master` 指向 `15b7c9e`；发布标签绑定同一提交 | GitHub API 读取确认 |
| 本地 EXE | 129,851,710 字节；SHA-256 `d1052ed5cd7893a9842ee96b6bf87c40b2ec6a5389ac59ef28ad5eb528e0ac4f` | WSL 重建；包校验通过，未重跑真实 Windows 用户流程 |
| GitHub EXE | 129,851,710 字节，state=`uploaded`，远端 digest 与本地 SHA-256 相同 | 真实 GitHub API 查询 |
| SHA256SUMS.txt | 109 字节，state=`uploaded` | 真实 GitHub API 查询；内容仅包含 EXE 文件摘要 |
| 发布状态 | `draft=false`、`prerelease=true` | 真实 GitHub API 查询；不是稳定版 |
| 工程验证 | 根测试 43/43、桌面测试 159/159、文档检查通过；包含 28 个后台模块与 1380 个 Linux 文件，app.asar/前端与源码匹配 | 本次自动/受控检查；完整 I06C 原生准出仍未完成 |

完整 I06C、正式 0.6.0 和本次重建包的真实 Windows 使用验收均未完成；alpha.13 的历史 Windows 实机结果不冒充 alpha.15 验收。稳定历史版本仍为 0.5.0。

下载：[Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.15/AgentBridge-0.6.0-alpha.15-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.15/SHA256SUMS.txt)、[GitHub 预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.15)。

## 2026-10-14：alpha.16 当前代码与 Windows EXE

alpha.16 修复维护通道在 open 阶段确认未发送后，因重连凭据不可用而残留 unknown 的状态边界，并保留语义冲突原错误。源码、测试和同步文档推送至 GitHub `master`；Windows x64 EXE 从当前源码重建并通过 portable 包校验，作为 prerelease 附件分发。

| 核验项 | 实际结果 | 证据级别与边界 |
| --- | --- | --- |
| 测试 | 根 43/43、桌面 163/163、SSH 本机 TCP 恢复集成 7/7 | 自动化/受控；不等于独立服务器验收 |
| EXE | 129,851,194 字节；SHA-256 `d1e35450e57967767fc5031ba4bdc8dfb5f5552dc374079a4a3005fc5f3223ba` | WSL 重建与包一致性校验通过；未重新执行真实 Windows 用户流程 |
| 包内容 | 后台模块 28 个；Linux 离线资源 1381 个；app.asar/前端匹配源码 | 本地构建验证 |
| 发布成熟度 | 0.6.0-alpha.16 prerelease；稳定历史仍为 0.5.0 | 完整 I06C 与正式 0.6.0 尚未准出 |

下载：[Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.16/AgentBridge-0.6.0-alpha.16-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.16/SHA256SUMS.txt)、[GitHub 预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.16)。

## 2026-10-14 alpha.18 源码与 Windows EXE 分发

修复源码提交 `1f0d9efb98009053761580cc97af10a63b698863` 已推送到 `codex/windows-runtime-recovery-alpha18`，并提交 [PR #1](https://github.com/wsjq5477/MA-Relay/pull/1) 审阅；尚未合入 `master`。`v0.6.0-alpha.18` GitHub prerelease 绑定该确切源码提交，EXE/前端/后台/离线资源已核对一致。默认分支保持原提交，未强制更新。

[Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/AgentBridge-0.6.0-alpha.18-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.18)。EXE **129,851,140** 字节，SHA-256 `2d532ca797e49094314587fcbfa286c9fb58f41374b05f8d21dce0246ee3bc33`；两附件 state=uploaded，远端大小和 digest 与本地一致，发布 draft=false/prerelease=true。公开元数据和下载检查见 [分发证据](../../../artifacts/runtime-recovery/2026-10-14/github-release.json)。

桌面 176/176、核心 43/43、lint/类型/构建/文档通过；真实 Windows Electron 资源、Edge 受控响应、普通无调试 EXE/合成旧记录及关闭重开分别通过，模型 0。28 个后台模块和 1383 个 Linux 资源文件与最终源码匹配。未在用户新电脑复测，完整 I06C/正式 0.6.0 未准出，历史原生失败和 unknown 仍按原证据保留。
