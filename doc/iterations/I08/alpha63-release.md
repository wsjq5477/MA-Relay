# alpha.63 公开预发布

日期：2026-10-25（Asia/Shanghai）。用户明确要求暂停继续开发、提交当前全部改动并将EXE上传GitHub。开发目标已暂停，本轮只完成源码/文档提交、冻结标签、附件分发和下载核验；不切换日常后台、不部署SSH、不调用模型。

## 下载与冻结边界

已公开预发布 [v0.6.0-alpha.63](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.63)，标签固定源码提交 `da600546c9feb12f07493f0f6181658d9e3a4b25`，树 `cdbc98b74cdefb60542ccd508773720f20359bfa`；master随后仅同步公开发布状态说明，不移动该标签。

- [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.63/AgentBridge-0.6.0-alpha.63-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.63/SHA256SUMS.txt)
- [冻结源码](https://github.com/wsjq5477/MA-Relay/tree/da600546c9feb12f07493f0f6181658d9e3a4b25)

两个附件均uploaded、服务端大小和digest匹配；随后不带凭据匿名HTTP200完整下载全部130203473个EXE字节，重新计算摘要一致，校验文件全部字节也匹配。不是仅HEAD或分段下载。[源码与标签](../../../artifacts/alpha63-release/2026-10-25/github-source.json)、[附件](../../../artifacts/alpha63-release/2026-10-25/github-upload.json)、[公开状态](../../../artifacts/alpha63-release/2026-10-25/github-release.json)、[完整匿名下载](../../../artifacts/alpha63-release/2026-10-25/github-download.json)。

已验证EXE **130203473字节**，SHA-256 `2ba100ea01ceee057bed3a03763b92a442c75bd4b094ed70873608f49157b40a`。发布前180个构建时冻结产品/依赖文件重算一致，复用原EXE，不重打包或将验证器/文档更新算作产品版本变化。包57后台/84Core/1715Linux、ASAR/前端/bootstrap一致；Linux digest `242c83de189b75c28e928b7b0e4b1331e06fb22c5a9f2ec396ded096512e2b27`。

## 本次产品内容

- 桌面收敛为接入配置、小队设置、执行/会话审计及显式原执行恢复；日常需求、续聊、分工、报告、正文编辑与业务验收从原生Agent的既有MCP入口完成。[控制台](../I07/configuration-console.md)
- CT-05明确原packetId、目标和版本引用，持久传递原包；目标接入读取后提交匹配原包的收据，桌面只读审计。接收声明不代表业务验收、模型理解或产物文件可达，不启动成员或扩张权限。小队MCP18→22，经典10保持。[原包传递](../I07/context-delivery.md)
- 小队原operationId和完整指纹核对，损坏/丢回应/并发变化的本机意图保留；接入失败清理仅适用严格匹配的原拒绝证明，不以裸not_found释放unknown。[恢复出口](failed-operation-cleanup.md)

## 已运行的分层验证

发布前当前源码重新执行桌面 **944/944**、Core **71/71**，零失败/零跳过、模型0；与原Windows/原生组件计数分开，不重复累加。[桌面TAP](../../../artifacts/alpha63-release/2026-10-25/desktop.tap)、[Core TAP](../../../artifacts/alpha63-release/2026-10-25/core.tap)。

最终包Windows传递14/14、原收据4/4、关系37/37、兼容26/26；生产审计页面5组/控制台6组，原包/收据普通EXE六组通过。[分层交付](../I07/context-delivery.md)。后续普通EXE+原版Pi MCP七组通过，三个实际解包目录删除后原生仍可读取，原身份/完整接收收据在重开/后台重启后保持；实际WSL持续十五分钟180/180及删除/重开/撤权/轮换/移除六组通过，模型0、残留0。[生命周期](native-mcp-lifecycle.md)。

## 未准出与使用

程序未签名。当前完整20条PNG p95 **496.029ms**仍不满足图100ms，不能把发布当作图性能准出；后续诊断开关组合的验证器中断也保留。[当前失败](../I06/alpha63-graph-baseline.md)。真实父模型、原生日常多主/托管生命周期、WSL冷启动与历史入口前失败、独立SSH故障/升级及完整I06C/I07C/MCP02继续未准出。

使用前先在旧版“设置 → 后台运行 → 停止后台并退出”，再打开新EXE；普通关闭窗口保留旧后台。Windows客户端不自动升级SSH daemon；原unknown只查原ID，不换ID、节点或目录重发。


发布状态同步后的文档检查0错误、用户站6/6与构建通过；只包含23份Markdown状态同步，产品代码/180项冻结摘要和标签不变。[最终文档检查](../../../artifacts/alpha63-release/2026-10-25/docs-check-final.json)、[站点测试](../../../artifacts/alpha63-release/2026-10-25/docs-test.log)、[构建](../../../artifacts/alpha63-release/2026-10-25/docs-build.log)。
