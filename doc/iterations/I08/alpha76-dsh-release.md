# I08 alpha.76 DSH NEXT 接入与连接面板

2026-11-16，Windows。发布基于远端 master 的维护恢复版本，仅合入本轮 DSH NEXT 支持、独立调用方结果查询、本地打包脚本及 DSH 创造模式生成的可选插件。

## 使用

打开 Bridge 的「接入配置」，点击已安装的 DSH NEXT 的「接入」。使用产品自己的原生登录。Bridge 可为尚未配置的当前 Profile 添加 MCP，已存在的条目和授权保持其原归属。DSH 调用目标需在 Bridge 中明确授权。

DSH NEXT 的「插件 → 添加插件」可安装 [AgentBridge 连接插件](../../../plugins/dsh-agentbridge-connections/README.md)。左侧面板按机器显示授权 Agent、在线和忙碌状态，可刷新。该插件随发布提供独立 ZIP。

## 发布前的本机证据

- 本地候选 `0.6.0-alpha.72.dsh.3` 和 DSH NEXT `2.0.23-next` 使用真实窗口发现并接入，第一次冷启动窗口进程约 174 秒。
- 使用已有授权，DSH NEXT 实际给 Claude Code `2.1.325` 派发一次编码任务，原 Task 成功。首次调用以节点 ID 被拒，以获准 Agent ID 派发。Claude 处理 CommonJS 模块边界后执行测试，3 通过、0 失败，独立复跑一致。DSH 通过 `task_result` 读回同一原任务。原生工具权限逐项确认。
- DSH 创造模式实际生成、安装和打开连接插件，面板刷新获取一个已获准、在线且空闲的本机 Claude 目标。Bridge 委派及请求计数不变。映射测试 9/9。

本机原生结果属于先行候选。

## 冻结源码与公开分发

- 标签 `v0.6.0-alpha.76` 指向 `f2fd338bdb1d0f2fccdf3b9bb780f0537e49e1b9`。EXE 132449534 字节，SHA-256 `f1c4eba37969da19adeb9e2d915892873a5303a5142d9803814702680db39566`。 Windows EXE 未签名。
- 实际 EXE 内 3522 个文件与构建目录的路径、大小和 SHA-256 一致。包内校验包含 76 个后台模块、87 个核心文件、1749 个 Linux 资源及前端。
- Windows 桌面类型检查通过。专项回归首轮 168 项通过、2 项触发 45 秒用例超时。分别检查 Pi 和 DSH 的受控进程委派场景，复跑 0 项通过、2 项未通过。 受控复验仅将该用例的时限临时延长至 120 秒，2 项通过、0 项未通过。 文档检查仍有 3071 个历史归档相对链接缺失。
- 普通 Windows 便携 EXE 打开实际窗口并启动同版本 Coordinator，耗时约 179 秒。实际识别 DSH NEXT 2.0.23-next，一键接入成功，隔离的原生 Profile 写入了 Bridge MCP。
- 公开 EXE、插件 ZIP（21073 字节，SHA-256 `7699e28514db2206a9c3466498038659e1af53ff0fa767586c7d64fb271c57a2`）与校验文件匿名完整下载后均匹配。

[GitHub 预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.76)

冻结版本的真实模型委派、生产 SSH 和全量平台矩阵仍待独立验收。
