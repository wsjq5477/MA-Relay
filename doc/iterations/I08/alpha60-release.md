# alpha.60 公开预发布

日期：2026-10-24（Asia/Shanghai）。用户明确要求发布EXE到GitHub；复用已保存认证，仅在内存使用，不输出或保存凭据，不启动登录窗口。产品源码随master提交公开，标签固定在包含该源码的提交上，未另建分支。

## 下载与冻结边界

- [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.60/AgentBridge-0.6.0-alpha.60-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.60/SHA256SUMS.txt)
- [预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.60)
- [冻结源码](https://github.com/wsjq5477/MA-Relay/tree/a0f313cf5de23966cf1ff6345ab33df16a0d0c3f)

标签 `v0.6.0-alpha.60` 固定 `a0f313cf5de23966cf1ff6345ab33df16a0d0c3f`，树 `01a628aca580e2c6595e273597bb3ff603e87be0`。发布前按[源冻结清单](../../../artifacts/ct08-connections/2026-10-24/source-manifest.json)逐项重算142个产品/依赖文件（56后台模块、45前端源、41份兼容清单），与构建时摘要全部一致、0缺失0改动；随后再次执行包校验通过（56后台/84Core/1713Linux、ASAR/前端/bootstrap/Core/Linux后台源码一致）。现成EXE未经重打包，发布后不再移动标签或覆盖附件，后续只同步发布状态说明。

EXE **130212267字节**，SHA-256 **`d74c711b8475e84834519c8509a12a63351c1864a5ed4c01559588dc1fdc9cf6`**。校验附件109字节。两项上传state=uploaded、大小与服务端digest匹配；随后不带凭据匿名HTTP200完整下载全部EXE字节，重新计算摘要一致；校验文件全部字节也与本地一致。并非仅HEAD或部分下载。

[发布前包复核](../../../artifacts/alpha60-release/2026-10-24/package-before-publication.json)、[源码/标签](../../../artifacts/alpha60-release/2026-10-24/github-source.json)、[附件上传](../../../artifacts/alpha60-release/2026-10-24/github-upload.json)、[公开状态](../../../artifacts/alpha60-release/2026-10-24/github-release.json)、[匿名完整下载](../../../artifacts/alpha60-release/2026-10-24/github-download.json)。

## 本次内容与分层验证

新增CT-08-A3连接管理：各主只能在自己启用的出站关系与用户预授权范围内连接/断开；范围外只登记待确认请求，须用户在“连接策略与确认”页面明确允许；用户可配置范围、决定原请求并审计最近连接操作，缩范围同时收回连接与重连权限。关系索引为relationsVersion3，旧v1/v2只按原成员初始化预授权、不扩大范围。经典MCP由7项增为10项（小队仍18），中央hello新增`agent-connection-policy-v1`/`multi-parent-relations-v1`，旧后台返回定向升级提示。同时包含alpha.54–alpha.59的图尺寸保留、daemon清单上限128、完整维护输入与按原ID只读查询、关系存储迁移与多主运行期。[实现、原始失败与界面证据](../I07/connection-policy.md)。

桌面源码900/900、失败/跳过0；Windows冻结包内迁移+多主+策略37/37与实际中央管道/重启、兼容26/26及9,665,523字节完整维护输入、生产页面4组、普通无调试EXE4组与Downloads SHA通过；类型检查、生产构建、改动文件lint与文档检查通过。模型调用0。[分层汇总](../../../artifacts/ct08-connections/2026-10-24/verification-summary.json)。

发布阶段只重算源冻结清单、复核现成包并核验下载，没有重跑模型、没有扩张产品验收，也没有把alpha.53的Core71/71或更早计数记到本轮。

程序未签名，未切换日常后台、未部署SSH。真实原生十工具消费、用户日常多主确认/撤权/原任务恢复及低频操作面收尾未完成；图100ms、WSL稳定性、完整I06C/I07C/MCP02与独立SSH均不由本次发布准出。

## 使用

先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新EXE；普通关闭窗口保留旧后台。Windows客户端不会自动升级SSH daemon。

原unknown仍须按原operationId查询，not_found保留占位与历史；不能通过重复接入、更换ID或更换安装绕过保护。可对照 `SHA256SUMS.txt` 检查下载完整性。
