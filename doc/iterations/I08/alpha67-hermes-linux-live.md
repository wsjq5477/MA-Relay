# alpha.67 Linux Hermes 实际执行与 WSL 启动修复

日期：2026-10-27（Asia/Hong_Kong）。需求：在已安装并配置的 WSL Hermes CLI 上完成项目对接、代码与文档、实际验收和 GitHub 发布。承接公开 alpha.66；当前候选 alpha.67，旧标签与附件保持。

## 缺口与实现

alpha.66 已完成 Linux 安装发现、独立 Ubuntu 回归及原生 MCP 组件；本轮继续补实际 Windows→WSL→MachineHost→正式 Hermes 的真实执行、原请求去重和同 Session 续聊。只沿用 WSL 原生配置，不复制 Windows 凭据，不增加模型 API 或覆盖供应商/模型。

两次原 alpha.66 HostConnection 启动在就绪前失败，未准备节点上下文或提交模型请求。原验收目录保留，Linux /proc 核对原宿主均已退出。直接在 Linux 启动同一冻结入口，实际 47188ms 后输出就绪帧并退出0，无业务请求；原 Windows 端 30000ms 预算不足。已将仅 WSL 的启动握手预算改为120000ms，业务请求的65000ms计时仍从握手后开始。并发启动共享原Promise，未握手不写业务帧，超时/关闭仍返回严格未派发证明；已写入后失联保持unknown，不自动重放。不是冷启动性能准出。

新增实际 Windows→WSL Hermes 验收脚本，先核对冻结后台与Linux manifest，私有检查点保存原验收目录、提交意图与请求；恢复时先查原收据，未确认的原意图不重发。两轮均要求原生成功结果、原Session一致与上一轮记忆；独立记录原生配置变化，不把原生自身迁移或认证刷新当作Bridge改写模型。公开报告不包含凭据、原生Session或私有接入身份。

WSL原生已配置模型凭据，但原配置HTTPS端点直连不可用；临时Windows回环CONNECT通道实测返回HTTP401（仅证明未带凭据可达，模型0），后续真实验收只在进程环境使用该通道，保留TLS证书校验，不改全局路由/代理。不是日常网络已修复的证明。

## 当前证据

- 原未派发启动失败：[首轮](../../../artifacts/hermes-linux/2026-10-27/live-wsl/report-startup-first.json)、同目录恢复失败；两次均无节点上下文/业务提交，首个验收器退出跟踪不足如实保留。
- 冻结Linux入口47188ms：[实测](../../../artifacts/hermes-linux/2026-10-27/native-entry-probe.json)。
- WSL握手与Hermes发现受控22/22：[TAP](../../../artifacts/hermes-linux/2026-10-27/live-targeted.tap)，其中握手9/9；不是模型或真实启动通过数。
- alpha.67实际执行/续聊、独立Ubuntu CI、冻结包、普通EXE及公开附件待本轮完成后逐项登记。

涉及M02/M05/M06/M07/M10/M11，整体设计、接入矩阵、协议和模块文档同步。检查data-model无持久字段/版本或身份变化，SSH协议、原Node/Task/Session/unknown及Hermes取消false保持；没有切换日常Bridge后台或部署SSH。
