# AgentBridge 开发与文档协作

2026-10-20 issue #12：当前隔离源码修复同机独立节点被管理 unknown 误锁、原操作查询无反馈及设置台账漏项。管理写入仍按机器保护，执行按原节点/同安装/共享目录保护；机器维护、授权和来源缺失继续保守保护。当前准备 **0.6.0-alpha.35** 候选，公开仍 alpha.34，未把用户现场或完整 I06C/I07C 改为通过。[需求、开发、验收与交付](doc/iterations/I07/scoped-execution-recovery.md)。

2026-10-20 **0.6.0-alpha.34已预发布**：当前整合源码和新Tag已推送，标签冻结`1af4dab`，EXE与SHA-256附件已上传并通过匿名完整下载核验。包含OpenCode1.x/2.x、独立MCP、CT-04/CT-05及既有alpha.30–33修复；Windows旧后台门禁、包/普通EXE与未测边界分别见[交付记录](doc/iterations/I07/alpha34-release.md)。完整I06C/I07C仍未准出。

2026-10-20发布前准备记录 **0.6.0-alpha.34**：用户授权提交当前完整源码并发布Windows EXE，含OpenCode1.x/2.x、独立MCP、CT-04/CT-05与既有alpha.30–33整合，补alpha.33精确daemon清单。固定源码构建、普通EXE及公开完整下载结果完成后在[本轮交付](doc/iterations/I07/alpha34-release.md)登记；当时仍在发布准备阶段，旧包/标签范围不变。

2026-10-20 **0.6.0-alpha.33已预发布**：PR #11已合并，标签冻结`ecc47d5679dcc7a1de0a5d746c018f68e169cf4e`，EXE与校验附件已公开并完成匿名完整下载核验。本次为公开alpha.32上的issue #10独立补丁，不含主工作区CT-04/独立MCP/CT-05或后续OpenCode1.x未发布驱动。维护上传的进度错误不再中断SFTP，最终台账保存失败仍不发送原维护输入。 [交付、校验与升级边界](doc/iterations/I07/maintenance-persistence.md)。

2026-10-20当前源码新增[OpenCode 1.x/2.x兼容修复](doc/iterations/I07/opencode-v1-compatibility.md)：官方1.x独立HTTP路径、原Session续聊/取消/只读恢复与MCP双布局，保留2.x。官方1.19.3 CLI加本机受控模型传输完成生命周期与生产MCP连接，真实模型/当前Windows/独立SSH未测；未打新包，公开alpha.32与integrated.3冻结范围不变。

## 2026-10-20：维护上传进度与持久化修复（issue #10）

进度仅内存通知、异常不打断上传，原子保存有界重试；最终台账保存失败不发送维护。主工作区CT-04/CT-05与旧integrated.3范围保留，公开补丁独立构建。 [完整设计、实测与边界](doc/iterations/I07/maintenance-persistence.md)。

2026-10-20后续源码完成[CT-05桌面选材与导出](doc/iterations/I07/context-packet-ui.md)：明确目标成员及文档/任务/消息/历史产物版本，核对后文字预览、复制、MD/JSON本机下载。观察到任务修订/成员变化或切工作时旧包失效，不发送/授权/执行。桌面581/581、Windows生产前端9组通过，模型0；未打新包，公开alpha.32与本地integrated.3旧冻结范围不变。

2026-10-20当前源码新增[CT-05明确选择的材料包](doc/iterations/I07/context-packet.md)：同一工作有效成员、明确文档修订/任务轮次/消息/产物版本，只读JSON/Markdown；每类8项、总响应256 KiB，不派发/授权/已读/搬原生Session。WSL桌面576/576、Windows定向14/14，真实Claude2.1.303一个Task读取旧版并重开不重放。公开仍alpha.32，本地integrated.3冻结EXE不含本片，未打新包；以下按原日期保留历史范围。

2026-10-19整合完成：工作源码已结合公开alpha.30–32修复与既有CT-04/独立MCP，保留原任务/收据与全部原未提交增量。当前本地候选0.6.0-alpha.32.integrated.3；公开仍alpha.32，Git HEAD仍a872275，仅工作文件整合，未commit/push/tag。当前功能/包/未测以整合专项为准，下方是原日期历史范围。[整合与验证](doc/iterations/I07/integrated-source.md)。

2026-10-19 issues #8/#9已在隔离工作树实现并发布 **0.6.0-alpha.32**：OpenCode仅2.x、新旧上下文快速版本拒绝；按机器隔离管理unknown并保留原意图。公开alpha.32已完成普通EXE及匿名完整下载核验，发布以[本轮专项](doc/iterations/I07/version-management-recovery.md)实际证据为准，原CT-04/MCP修改不入包。

2026-10-19较早issue #7独立修复已发布 **0.6.0-alpha.31**：OpenCode实际API兼容、委派持久准备拒绝、原对象控制路由及中央/daemon能力激活；冻结源码`002107da776687474c2d369d9a182a9f81d50e90`，Windows EXE与SHA-256已公开完整下载核验；发布与分层证据见[本次交付](doc/iterations/I07/collaboration-compatibility.md)。CT-04/MCP未提交工作不纳入，完整I06C/I07C未准出。

2026-10-19源码/GitHub预发布alpha.30修复issue #6，GitHub已预发布alpha.30；原CT-04未提交开发保持独立，[源码/EXE、远端升级和验证边界](doc/iterations/I07/history-detail-recovery.md)。

2026-10-19较早GitHub预发布 **0.6.0-alpha.29**（历史时点），标签冻结源码`23d256e`，包含当前UI/原生接入/发现/刷新与连接能力修改；EXE及SHA-256附件已发布并完成匿名完整下载核验。以下alpha.28及更早条目保留历史范围，当前发布与验收边界见[alpha.29交付](doc/iterations/I07/alpha29-release.md)，完整I06C/I07C仍未准出。

2026-10-19当前核对：公开预发布已由独立修复分支推进到alpha.31；本地HEAD仍a872275/alpha.29派生，保留CT-04/独立MCP源码增量，尚未合入alpha.30/31修复，也未打新包。发布与源码范围不能互代。[本次只读核对与后续整合边界](doc/iterations/I07/public-materials-ui.md)。

2026-10-19较早GitHub预发布 **0.6.0-alpha.29**，标签冻结源码`23d256e`，包含当前UI/原生接入/发现/刷新与连接能力修改；EXE及SHA-256附件已发布并完成匿名完整下载核验。以下alpha.28及更早条目保留历史范围，当前发布与验收边界见[alpha.29交付](doc/iterations/I07/alpha29-release.md)，完整I06C/I07C仍未准出。

2026-10-17源码/GitHub预发布alpha.28修复issue #5远端持久拒绝恢复，GitHub已预发布alpha.28；开发、验证和未测边界见[专项](doc/iterations/I06/daemon-rejection-recovery.md)。

项目的完整资料入口是 [doc/README.md](doc/README.md)，同步规则见 [doc/development-guide.md](doc/development-guide.md)。人类和 Agent 按同一套规则开发。

## 开发前

- 阅读整体功能设计、相关模块的 `design.md`、`test-report.md` 和当前迭代。
- 核对实际源码、发布包和测试证据，区分已发布、源码已实现、已确认设计与候选功能。
- 稳定历史 Windows 版本为 0.5.0；当前 GitHub 预发布为 0.6.0-alpha.34；当前整合源码已提交并推送，新Tag/EXE绑定1af4dab，旧integrated.3保持历史范围，完整 I07C/I06C 仍未准出。I06A 候选 0.6.0-alpha.2 的 Windows/SSH 主要流程已验收，专项覆盖限制见 doc/iterations/I06/acceptance.md；I06B alpha.6 主要范围已验收，专项限制见 doc/iterations/I06/graph-implementation.md；alpha.7 图可用性优化见 doc/iterations/I06/graph-usability.md，alpha.8 旧后台拖动与主居左修复见 doc/iterations/I06/graph-drag-fix.md；alpha.9 合并页面与节点管理见 doc/iterations/I06/node-management.md；I06C alpha.10 首批机器管理/历史与事件补偿见 doc/iterations/I06/machine-management.md；alpha.13 可信后台维护/控制恢复及 alpha.15 维护入口通道拒绝恢复及 alpha.16 未发送边界补强见 doc/iterations/I06/final-delivery.md，以该页当前逐项证据为准。

alpha.18 的 Windows 运行缓存与原未派发提交恢复见 [专项](doc/iterations/I06/runtime-recovery.md)。源码已提交独立修复分支及 PR #1，尚未合入 master；发布标签绑定已验证源码，不以预发布替代完整 I06C 准出。

alpha.19 已作为预发布分发，修复 Linux 非交互后台 CLI 发现及 OpenCode 二次检查/Windows 配置保存，SSH 必须升级原远端后台后重扫；当前验证见 [专项](doc/iterations/I06/linux-cli-discovery.md)，不把本机受控 SSH 当作用户服务器实测。

alpha.20 已作为GitHub预发布分发，修复未确认操作的节点/目录阻塞范围、准备阶段与 NOT_CONFIGURED 拒绝恢复；当前实际验证及发布状态见 [专项](doc/iterations/I06/pending-isolation.md)，不以候选包替代完整 I06C 准出。

## 修改后必须同步

任何产品功能变更，在同一次交付中更新：

1. 当次迭代的需求/开发/验收记录。
2. `doc/product-design.md` 的功能状态、行为或模块修改记录。
3. 每个受影响模块的完整设计与测试报告。
4. 边界/数据/协议变化所影响的 `architecture.md`、`data-model.md`、`protocol.md`。
5. 改变基线、发布或范围时，更新整体验证报告和迭代路线。

不要只写一份新的迭代说明而留下整体设计过期。纯文档改错不用伪造产品需求或重跑模型测试；无行为变更的重构在迭代说明原因，并核对模块落点/测试记录。

## 证据与边界

- 实际运行后才填写通过；模拟、受控测试、真实原生 Agent 和真实 EXE 的结果分别标明。
- 报告写明日期、版本、环境、场景、实际结果、原始证据和未测项。历史记录不能冒充今天实测。
- 关系与节点不绑定模型/供应商或项目；继承原生配置，不添加新的模型 API 层。
- requestId/operationId 回应未知时查询原请求，不重新执行；不能以换 ID、节点或目录别名释放 unknown 占位。
- 不把权限收据或取消收据的 confirmed 当作任务已成功/已取消。
- 不把内部身份、密码、Token、私钥或敏感原生配置写进文档、提交、报告或日志。

## 文件与检查

- 完整材料写入 `doc/`，迭代写入 `doc/iterations/`；不再向 `docs/` 新增设计副本。
- 功能 ID 和模块 ID 保持稳定，源码定位使用可点击相对路径，跨进程/恢复流程优先使用清晰的图表。
- 交付前执行 `node scripts/check-docs.mjs`，并运行与实际产品改动相应的工程检查。
- 文档同步是完成条件，不额外要求用户批准，也不替代用户已有授权。用户指令优先。

alpha.23 已作为GitHub预发布分发，包含I07A/B和I07C首批持续协调；真实Claude自动主角色与受控MCP执行成员证据分开记录，其他原生自动续接/独立SSH/完整停止仍未准出。[功能与验收](doc/iterations/I07/automation.md)、[源码/EXE发布记录](doc/iterations/I07/github-release.md)。

2026-10-17较早GitHub预发布alpha.25（历史时点）：Windows未完成上下文缺少Agent身份时不得截获原请求/任务查询，包含先前不完整任务回应保护；标签绑定修复提交2e957e3，EXE/校验文件及完整公开下载均核验。工程/程序与未测边界见[原请求恢复专项](doc/iterations/I06/windows-context-recovery.md)。

2026-10-17当前GitHub预发布alpha.26：补收Linux alpha.24/alpha.25可信清单，恢复原alpha.24连接后可维护升级。标签绑定冻结源码3efc3d2，EXE与原候选一致；master另有I07续接Conversation增量未包含该EXE。发布/下载/验证及边界见[旧Linux后台升级专项](doc/iterations/I06/ssh-alpha24-upgrade.md)。

2026-10-17当前GitHub预发布alpha.27：修复issue #3的Codex准备失败/严格未派发任务核对、issue #4的台账分享锁重试及历史未派发结算；候选与预发布状态、工程/程序证据统一见[交付专项](doc/iterations/I06/windows-start-persistence.md)。
