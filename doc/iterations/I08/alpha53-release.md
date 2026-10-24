# alpha.53 公开预发布

日期：2026-10-23（Asia/Shanghai）。用户明确要求发布EXE到GitHub；复用已保存认证，仅在内存使用，不输出或保存凭据，不启动登录窗口。修复源码在发布前已经公开，本轮未另推源码或合并分支。

## 下载与冻结边界

- [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.53/AgentBridge-0.6.0-alpha.53-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.53/SHA256SUMS.txt)
- [预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.53)
- [冻结源码](https://github.com/wsjq5477/MA-Relay/tree/5269d6532a007cc1a4aef10a1b9003633c5932a5)

标签 `v0.6.0-alpha.53` 固定 `5269d6532a007cc1a4aef10a1b9003633c5932a5`，树 `7a93aeebe638988bf0d391bd4b48ccd0aec0351e`。131个产品/依赖清单文件与构建时源码摘要及该提交逐项一致；发布前再次执行包校验通过。现成EXE未经重打包，后续仅同步发布状态说明，不移动标签或覆盖附件。

EXE **130190405字节**，SHA-256 **`3f82bbc3c03ce52c348315f325fe5838de73daadfc1a6658a0170d58d8d3f4a3`**。校验附件109字节。两项上传state=uploaded、大小与服务端digest匹配；随后不带凭据匿名HTTP200完整下载全部EXE字节，重新计算摘要一致；校验文件全部字节也与本地一致。并非仅HEAD或部分下载。

[发布前状态](../../../artifacts/issue21/2026-10-23/publication/preparation-status.json)、[源码/标签](../../../artifacts/issue21/2026-10-23/publication/github-source.json)、[附件上传](../../../artifacts/issue21/2026-10-23/publication/github-upload.json)、[公开状态](../../../artifacts/issue21/2026-10-23/publication/github-release.json)、[匿名完整下载](../../../artifacts/issue21/2026-10-23/publication/github-download.json)、[发布前包复核](../../../artifacts/issue21/2026-10-23/package-before-publication.json)。

## 修复与验证

修复 #21：OpenCode 早期1.x先检查有界健康入口及完整V1元数据，避免 `/api/info` 挂起消耗启动预算。候选各700ms，全套协议/元数据4秒；已监听的协议/认证/HTTP错误不吞为20秒启动超时。2.x正常契约保留，可选V1健康路径非认证失败不遮蔽有效V2。节点状态、能力、观察版本一致，原安装不因PATH改变而换绑。

原unknown、operationId、节点、上下文、Session、Task与历史保留；新探测不结算旧操作，不查询后重放。[需求、设计、首次失败与最终证据](opencode-bounded-probe.md)。承接alpha.52的OpenDesk生命周期与独立关系修复。

核心71/71、桌面844/844、最终启动专项9/9、Windows后端2/2、生产前端2组、普通无调试EXE6组，模型0。核心全量先通过，最后启动/候选分支补强再由9项专项验证；不将两层计数相加。包54后台模块、84Core文件、1702Linux资源及Core/Windows与Linux后台/ASAR/前端/bootstrap源码一致性均通过。Windows源码SSR受Linux esbuild依赖限制，Linux SSR及Windows生产前端另证；不是原生模型证据。[分层摘要](../../../artifacts/issue21/2026-10-23/verification-summary.json)、[普通EXE](../../../artifacts/issue21/2026-10-23/portable.json)。发布阶段只复核源码、包和下载，没有重跑模型或扩张产品验收。

程序未签名，未切换日常后台、未部署SSH。现场真实WindowsApps OpenCode1.2.22.h0.r1未复测，受控1.2.22契约夹具不冒充真实安装。真实模型、完整原生Session、独立SSH、完整I06C/I07C/MCP02、原生父模型自主委派、WSL稳定性与图指标仍未准出。

## 使用

先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新EXE；普通关闭窗口保留旧后台。Windows客户端不会自动升级SSH daemon。

原NATIVE_START_TIMEOUT unknown仍须查询原operationId；not_found保留占位和历史，不能通过重复接入、换ID或换安装绕过保护。
