# alpha.52公开预发布

日期：2026-10-23（Asia/Shanghai）。用户批准先合并PR #18/#22并发布alpha.52，完成安全登录后复用本机凭据；只在内存使用，未打印或保存凭据。

## 公开源码与附件

- [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.52/AgentBridge-0.6.0-alpha.52-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.52/SHA256SUMS.txt)
- [预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.52)
- [冻结源码](https://github.com/wsjq5477/MA-Relay/tree/49bd12b7fabdeee9d30b5f1fae47efac3e686df2)

标签`v0.6.0-alpha.52`固定`49bd12b7fabdeee9d30b5f1fae47efac3e686df2`，树`eb68c7d76a27ac3d467ccdd4b519e48b167b6356`。本地构建提交afe8aab与该树一致。后续1ec0b39仅更新说明、原始证据与验收脚本，产品与EXE没有重打包。用户批准的PR #18合并为226ec1f，PR #22调整到master后合并为9e2d283，完整已发布增量和#19/#20修复均已进入默认分支。此次发布文档提交不移动冻结标签。

EXE **130190265字节**，SHA-256 **`46f30764b7dc769b6af3497dd71fc32b35ecbc5f0184b4e3778641af7896f28d`**。校验附件109字节。上传state=uploaded，服务端大小/digest与本地一致；随后不带凭据匿名HTTP200完整下载EXE全部130190265字节，重新计算摘要匹配；校验文件完整字节也匹配。并非仅HEAD或部分下载。

[源码/标签](../../../artifacts/native-lifecycle-scope/2026-10-23/publication/github-source.json)、[上传](../../../artifacts/native-lifecycle-scope/2026-10-23/publication/github-upload.json)、[公开状态](../../../artifacts/native-lifecycle-scope/2026-10-23/publication/github-release.json)、[完整匿名下载](../../../artifacts/native-lifecycle-scope/2026-10-23/publication/github-download.json)。初次没有可用保存凭据时停止在认证阶段，未创建标签或上传附件；用户安全登录后成功发布，未从旧聊天恢复Token，未自动打开登录窗口。

## 修复、分层证据与边界

#19：OpenDesk运行中、进程状态不可核验或退出写回未稳定时拒绝原生MCP写入；需真实Node，已断开的原节点可以配置。配置卡持续提示正确顺序，原生列表没有查询入口，明确无法自动核验，不把文件/端点目录当成原生加载和连接。移除先撤权，再安全清理自己的条目；不退出、重启或改写原生程序。

#20：独立节点设主与关系保存按旧/新主成员的资源并集判定，无关node管理unknown不再全局禁用；原节点/共享安装或目录、机器/关系unknown、缺失来源和范围仍保护。草稿不派发，保存一个operationId，同ID幂等；A原unknown/参数/时间/错误保留，不追加查询或重派。[完整需求、时序、反例与验证](opendesk-lifecycle-relation-scope.md)。

桌面841/841、核心68/68、类型/lint；Windows生产前端12组、真实进程拒写、Windows契约40/40（1项Linux专用另在Linux通过），最终普通无调试EXE8组，模型0。包54后台模块、84Core文件、1702Linux资源，Windows/Linux后台、ASAR、Core、前端和bootstrap与冻结源码一致。[包核验](../../../artifacts/native-lifecycle-scope/2026-10-23/package.json)、[普通EXE](../../../artifacts/native-lifecycle-scope/2026-10-23/portable-second.json)、[源码摘要](../../../artifacts/native-lifecycle-scope/2026-10-23/source-manifest.json)。本轮发布后只同步文档，不重复计入产品/模型测试。

程序未签名，未切换日常后台、未部署SSH。真实用户Profile退出/重开原生GUI、原生父模型自主委派、独立SSH和完整I06C/I07C/MCP02、WSL稳定性/图指标仍未准出。主工作区后续并行开发未收入本冻结包，也没有被本轮发布覆盖。

## 使用

先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新EXE；普通关窗口保留后台。OpenDesk须先从托盘完全退出，在原节点配置里刷新核对后添加，再手动打开其MCP管理人工核对。Windows EXE不会自动升级SSH daemon。
