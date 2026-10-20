# 已发布修复与MCP/公共材料源码整合

日期：2026-10-19。AB-F02/F03/F07/F08/F10/F11/F12/F13/F17/F20/F21；M01/M02/M03/M04/M05/M06/M07/M08/M10。最终本地候选版本 **0.6.0-alpha.32.integrated.3**，公开预发布仍alpha.32；完整I06C/I07C未准出。实际检查见本页验收表和最终汇总，不把前一候选或历史结果当作最终包证据。

## 1. 需求、基线与整合方法

本工作区Git HEAD为a872275/alpha.29，已有CT-04 Agent索引/精确文档修订、桌面MD入口和独立MCP未提交修改。另一独立问题修复分支已发布alpha.30–32。近期相关会话均completed，无限流中断可续接；直接从旧基线打包会漏掉已发布的原对象路由、兼容门禁和机器管理修复。

| 要求 | 完成行为 |
| --- | --- |
| IS-01 | 在同一工作源码保留CT-04和独立MCP，整合alpha.30–32已发布修复，不回退原有恢复规则 |
| IS-02 | 新旧MCP归属都使用原请求去重/持久拒绝证明；未知不换ID、节点或目录重发 |
| IS-03 | 原任务/会话/控制回原后端，缺Owner不猜根OpenCode；详情错误局部化 |
| IS-04 | 机器范围管理锁、OpenCode仅2.x准入和中央/daemon能力门禁一致，旧后台不能假装支持新行为 |
| IS-05 | 冻结不同本地候选，核对新增生产依赖、包/普通EXE/重启；公开版本与本地候选分开 |
| IS-06 | 当前公开alpha.32原daemon精确清单随新包保存，维护不因新候选版本而失去可信旧版入口 |

只读GitHub API核对alpha.32标签为fcdad72fba454bf731cf66df54bc1caf2a06e0a2，发布非草稿、两附件uploaded；[元数据](../../../artifacts/integrated-source/2026-10-19/release-state.json)。从已存在的独立修复工作树读取该不可变Git对象的产品差异，最终发布文档读取9203b18，未修改该工作树。按共同基线a872275逐文件三方整合100个路径；整合前保存所有原tracked/untracked文件，主工作区Git HEAD、index和分支不动，没有commit/push/tag或新公开发布。[整合计划](../../../artifacts/integrated-source/2026-10-19/integration-plan.json)、[原文件摘要](../../../artifacts/integrated-source/2026-10-19/initial-files.json)。

主要运行冲突为AgentNetwork的委派分支：保留独立MCP的owner/connectionId和无父Task语义，同时接入原节点/机器/输入指纹、dispatched=false、preparationRejection且无任务绑定的持久拒绝核对。原原生父会话继续用自身scope。保留两边独立测试，并新增“长期MCP准备失败，同ID两次只准备一次、无原生执行、外来scope不改原记录”的整合测试。[AgentNetwork](../../../desktop/electron/agent-network.cjs)、[回归](../../../desktop/tests/agent-network.test.cjs)。

文档冲突保留两边历史/模块正文，当前状态由本片及整体入口说明。导入原发布文档明确引用的86份小型历史日志/报告，保留原日期与环境；[来源清单](../../../artifacts/integrated-source/2026-10-19/historical-evidence-import.json)不代表本次重跑。既有MCP/材料历史证据未覆盖。

## 2. 最终运行行为

- MachineHost按原task/conversation及backend自身快照确定来源；真正legacy仍可服务，缺归属/重复来源明确拒绝，原native Session与历史保留。原控制仍由原backend核对execution/operation/interaction，不猜根后端。详情失败不再进入全局同步锁，真实同步失败仍保护全局。[历史修复](history-detail-recovery.md)。
- 新中央需要owned-object-controls-v1、scoped-management-v1、opencode-v2-admission-v1；旧中央只保留设置/运行信息/显式停止入口。SSH原对象读控要求原安全路由能力，已知旧daemon的观察/原收据/维护保留。独立MCP四方法及TeamSpace新只读接口仍沿原授权/机器归属，不从版本号推断旧后台支持。[协作兼容](collaboration-compatibility.md)。
- OpenCode当前准入仍仅2.x：发现的安装健康不等于执行兼容，1.x明确NATIVE_VERSION；新连接/保存配置恢复在serve前检查，确定API/认证错误立即返回。没有在本片实现官方1.x另一套API，alpha.31的1.x兼容策略仅保留历史。已派发原收据查询不被当前版本门禁隐藏。[当前版本/管理修复](version-management-recovery.md)。
- 管理pending按原machineId/connectionId范围阻断，缺来源仍保守；relation未确认继续保护相关授权。不同机器意图可并存，原两个localStorage key保留，旧单对象兼容数组；关闭重开只查原operationId。公共材料读取不解除原unknown。
- CT-04小队17工具与经典六工具保持分开；索引/精确修订与桌面复制/下载完整保留。独立MCP仍绑定connectionId、parentTaskId=null，不伪造原生主任务或Session，撤权不取消已派发任务。[MCP功能](mcp-installation.md)、[Agent材料首片](public-materials.md)、[桌面阅读](public-materials-ui.md)。

没有新增模型API层、原生账号迁移、自动模型执行或跨厂家Session搬运；Core/daemon wire版本仍2，TeamSpace SQLite格式3、机器/网络JSON格式1、原收据和权限/取消终态分别核对。

## 3. 实际构建发现与修复

标准npm ci首次离线缺smol-toml缓存，保留[离线失败](../../../artifacts/integrated-source/2026-10-19/package-offline-initial.log)，转标准锁文件安装后构建成功。该初始integrated.1构建实际报告smol-toml告警，[原审计](../../../artifacts/integrated-source/2026-10-19/runtime-audit.json)；更新到同主版本1.9.1并同步根package/lock，未执行npm audit fix或改无关依赖。

原1.4.2解析20,000行合法注释会RangeError，1.9.1正确解析，[实测对比](../../../artifacts/integrated-source/2026-10-19/toml-comments-baseline.json)。新增Codex配置注释保留、添加/移除原样回读及损坏配置不覆盖的回归。新解析器返回无原型表，两个旧deepStrictEqual夹具只因JS原型失败；按实际IPC JSON数据比较修正，不把解析器改回普通原型或放宽配置/授权校验。[首次失败全量](../../../artifacts/integrated-source/2026-10-19/desktop-toml-prototype-initial.tap)、[MCP回归](../../../desktop/tests/mcp-integration.test.cjs)。最终实际生产依赖审计为0项告警，[审计](../../../artifacts/integrated-source/2026-10-19/runtime-audit-final.json)；这不是对所有开发依赖或未知漏洞的保证。

Windows材料夹具首次在新增OpenCode接入API准备检查处失败，[原日志](../../../artifacts/integrated-source/2026-10-19/windows-team-materials-ui.cjs.log)；仅允许受控context准备，native IPC仍需显式nativeExecution选项，未放宽生产门禁。MCP界面脚本增加独立输出目录参数，防止整合复测覆盖旧报告。

最终候选另补公开alpha.32原Linux manifest。来源为129,955,724字节原EXE，其SHA-256 87adda262cde786ba602971c4d03c5b25a6a0da9ac00e3cdfaba1e7fc5a14440匹配本次GitHub附件元数据；提取的规范清单摘要33bbd002f9163bbada063b5ef9feb89aaa8653e12dcd6b86d068c5beaa190d19匹配原发布包报告。[原EXE/清单来源](../../../artifacts/integrated-source/2026-10-19/alpha32-compatibility-source.json)。受控连接/维护预览保持原daemon、无上传/写入，改摘要仍拒绝；不是升级用户服务器。新Windows候选不会自动更新远端daemon。

## 4. 本次验收与证据分层

核心工程：51/51、零跳过；根构建/类型/lint与桌面TypeScript/Vite构建通过，保留大于500KB前端包提示。[核心TAP](../../../artifacts/integrated-source/2026-10-19/core-final.tap)、[核心构建](../../../artifacts/integrated-source/2026-10-19/core-build.log)、[根类型](../../../artifacts/integrated-source/2026-10-19/core-typecheck.log)、[lint](../../../artifacts/integrated-source/2026-10-19/lint.log)、[桌面构建](../../../artifacts/integrated-source/2026-10-19/desktop-build-initial.log)。
最终桌面570/570、零跳过，包含新长期MCP不重准备/长注释配置/精确alpha.32清单保护；定向85/85、兼容15/15是全量相关子集，不相加。均为受控SQLite/CLI/HTTP/本机TCP/SSH，模型0。[最终TAP](../../../artifacts/integrated-source/2026-10-19/desktop-final.tap)、[定向](../../../artifacts/integrated-source/2026-10-19/targeted-initial.tap)、[兼容](../../../artifacts/integrated-source/2026-10-19/compatibility-final.tap)。
最终integrated.3从独立冻结副本构建：42后台CJS、78核心文件、1446 Linux条目、窗口ASAR和前端与源码/构建输出一致；实际包含TOML1.9.1与alpha.32兼容pin。EXE130,015,387字节，SHA-256 `c983514cfb656678551b8d07f00fb9909443fb4ae6e03d5495a5b4514677a242`。[标准构建日志](../../../artifacts/integrated-source/2026-10-19/package-integrated3-build.log)、[包校验](../../../artifacts/integrated-source/2026-10-19/package-integrated3.json)、[本地EXE](../../../artifacts/integrated-source/2026-10-19/AgentBridge-0.6.0-alpha.32.integrated.3-Windows-x64.exe)、[SHA256SUMS](../../../artifacts/integrated-source/2026-10-19/SHA256SUMS.txt)。
最终普通Windows EXE五组通过，无调试参数、模型0：三项中央能力；真实IPC/SQLite精确文档旧修订、独立MCP TOML导出与孤立Codex原两轮历史共存；窗口重开复用；后台完整重启保留同一MCP连接/材料/原请求；持久副本模块及TOML1.9.1匹配源码。原合成unknown与原native Session保持、网络原生requests/delegations始终0；只导出文件，未安装到原生用户配置。此为真实EXE+隔离合成历史，不是真实Agent/用户现场验收。[最终报告](../../../artifacts/integrated-source/2026-10-19/windows-portable.json)、[日志](../../../artifacts/integrated-source/2026-10-19/windows-portable-final.log)、[脚本](../../../desktop/tests/windows-integrated-source-portable.cjs)。

Windows生产前端复测共26组：历史详情7、协作门禁3、按机器管理4、公共材料8、MCP配置4，页面错误0、模型0。前14组在integrated.1冻结前端完成，后12组在相同前端字节/修正夹具和新依赖下复测；候选.2/.3前端构建字节不变。历史/门禁/管理使用合成IPC；材料/MCP使用真实Coordinator/SQLite/配置文件和受控机器。clipboard仍为受控接收/拒绝，MD是实际浏览器下载。重复观察/不同平台不跨模块叠加计数。[历史](../../../artifacts/integrated-source/2026-10-19/ui-history/report.json)、[兼容](../../../artifacts/integrated-source/2026-10-19/ui-compatibility/report.json)、[管理](../../../artifacts/integrated-source/2026-10-19/ui-management/report.json)、[MCP](../../../artifacts/integrated-source/2026-10-19/ui-mcp/report.json)、[材料](../../../artifacts/integrated-source/2026-10-19/ui-materials-final.log)。

独立冻结目录与[源码清单](../../../artifacts/integrated-source/2026-10-19/source-manifest.json)对应。初始.1包已被依赖修复后的.2取代，.2普通EXE五组通过但不含alpha.32兼容pin，最终以.3及其独立报告为准。没有把旧候选摘要改写成最终版本，旧日志保留。[.1包](../../../artifacts/integrated-source/2026-10-19/initial-package.json)、[.2包](../../../artifacts/integrated-source/2026-10-19/package-final.json)、[.2普通EXE](../../../artifacts/integrated-source/2026-10-19/windows-portable-integrated2.json)。

最终收尾：358份源码/配置/测试/素材在主工作区与冻结副本全部摘要匹配；原有文件无非预期删除/源码变化，Git HEAD仍a872275。[源码复核](../../../artifacts/integrated-source/2026-10-19/source-verification.json)、[保留核对](../../../artifacts/integrated-source/2026-10-19/preservation.json)。`node scripts/check-docs.mjs`及`git diff --check`通过，[文档检查](../../../artifacts/integrated-source/2026-10-19/docs-final.log)、[最终汇总](../../../artifacts/integrated-source/2026-10-19/verification-summary.json)。

## 5. 分发与未测边界

本地候选是新的整合源码，**公开alpha.32不含本片MCP/CT-04**。本次未公开上传、推送或移动标签，未对公开alpha.32重新完整匿名下载；保留它的原发布日期/源码/EXE证据。Git HEAD仍a872275，仅工作文件完成整合，不能把工作区说成已合入远端master。

未验证用户真实profile升级、独立SSH升级/真实多机协作、当前候选真实原生模型、官方OpenCode1.x新驱动、完整I06C/I07C。普通EXE限定合成旧历史/隔离MCP配置/真实本地IPC和SQLite，不扩大为真实Agent验收。既有Claude/Codex/OpenCode真实模型证据保留原日期/冻结源码。

下一功能优先为CT-04完整产物/显式交接与CT-05选定版本上下文；真实Hermes/Pi/DSH仍需已安装原生环境。若要公开发布，应先对本片最终冻结源码建立独立版本/提交及发布校验，不能沿用旧公开alpha.32的标签和摘要。

## 6. 复现

```bash
npm run build
node --import tsx --test --test-concurrency=1 tests/*.test.ts
node --test --test-concurrency=1 desktop/tests/*.test.cjs
npm run typecheck
npm run lint
npm run build --prefix desktop
# 独立冻结副本构建；不覆盖旧候选或公开附件
npm run dist:win --prefix desktop
# Windows Node + 本地候选路径 + 输出报告路径；隔离合成profile，模型0
node desktop/tests/windows-integrated-source-portable.cjs <candidate.exe> <report.json>
node scripts/check-docs.mjs
```
