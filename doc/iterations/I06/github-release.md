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
