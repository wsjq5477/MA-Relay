# alpha.51.recovery.2公开预发布

日期：2026-10-23（Asia/Shanghai）。用户授权发布EXE并提供发布凭据；凭据只在进程内使用，不写入源码、文件或日志。

## 公开附件与源码

- [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.51.recovery.2/AgentBridge-0.6.0-alpha.51.recovery.2-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.51.recovery.2/SHA256SUMS.txt)
- [预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.51.recovery.2)
- [冻结源码](https://github.com/wsjq5477/MA-Relay/tree/905b79249dcc662584894659623616bb9e341802)

标签 `v0.6.0-alpha.51.recovery.2` 固定 `905b79249dcc662584894659623616bb9e341802`；文件树 `f5aea404acea65821fa48137c50997e3c8e71b4a`，712个源码/测试/文档文件。对应源码分支 `codex/release-alpha51-recovery2`，PR #17已在本次发布前合入master；完整集成源码由PR #18另行审查。该标签承接此前本地alpha.50/51的完整集成增量，包括Pi/Hermes/DSH原生MCP及WSL/图修复；不能把仅含#15/#16的PR #17当作本EXE的完整源码。主工作区版本仍alpha.51，打包版本只在冻结快照调整为recovery.2；发布后仅同步文档，不移动冻结标签或重新打包。

EXE **130196014字节**，SHA-256 **`db079cb622d4fea75607758cb7e94a6f151683fb81c8f29b88b5f382f65152cd`**。校验附件120字节；上传资产state=uploaded、大小与服务端digest均匹配。匿名HTTP200完整下载全部130196014字节后独立计算摘要，与本地EXE/服务端/校验文件一致；不是HEAD或部分下载。下载过程不附凭据。

[源码与tag核对](../../../artifacts/connection-recovery/2026-10-23/publication/github-source.json)、[上传](../../../artifacts/connection-recovery/2026-10-23/publication/github-upload.json)、[公开状态](../../../artifacts/connection-recovery/2026-10-23/publication/github-release.json)、[完整公开下载](../../../artifacts/connection-recovery/2026-10-23/publication/github-download.json)。

## 内容、实际验证与限制

本版修复DSH保存后刷新/重开回退默认或旧连接，以及同机OpenCode管理unknown误锁独立OpenDesk接入。原unknown、原节点/安装/共享目录保护、任务与原生Session保留；不重派旧请求。[需求、完整流程与失败反例](connection-identity-node-scope.md)。

- 独立修复分支桌面777/777；当前集成桌面817/817、核心68/68，类型/lint/构建通过。
- Windows受控生产前端10组、纯CJS契约55/55；最终普通无调试EXE5组，模型0。真实原生服务/模型/用户profile/独立SSH不在本轮验收内。
- 包核验53后台模块、84Core文件、1701Linux资源；Windows/Linux后台、ASAR、Core、前端与bootstrap均匹配冻结源码。发布前复核126个产品源码文件未变化。

[包源码一致性](../../../artifacts/connection-recovery/2026-10-23/candidate2/package.json)、[集成回归](../../../artifacts/connection-recovery/2026-10-23/desktop-integrated.json)、[最终普通EXE](../../../artifacts/connection-recovery/2026-10-23/portable-final.json)。既有alpha.50/51原生组件、WSL/图证据沿原版本记录，不冒充本轮新实测；完整I06C/I07C/MCP02、原生父模型自主委派、WSL稳定性及图指标仍未准出。

## 使用与部署

先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新EXE。DSH保存后刷新核对原目标，再显式扫描与接入。普通关闭窗口不会停止后台；旧alpha.46中央因缺scoped-node-management-v1需显式停止重开。

程序未签名。本次没有切换日常后台或部署SSH；Windows客户端不会自动升级远端daemon。公开附件不是对真实模型、独立SSH或完整迭代准出的承诺。
