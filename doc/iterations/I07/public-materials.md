# CT-04首片：公共材料索引与指定文档修订

2026-10-19后续状态：本页当时的未发布增量已与公开alpha.30–32修复整合，并进入未公开的integrated.3本地候选。原日期/环境/计数和当时未测保持，下文“尚未整合/未打包”属于该片历史时点；当前包与验证见[整合交付](integrated-source.md)。

2026-10-19后续：[桌面阅读、复制与MD下载](public-materials-ui.md)已实现并通过541项桌面回归/Windows八组，模型0。下文是Agent侧首片当时范围，保留525项与真实Claude一个Task的原证据。当前公开另分支alpha.31，本地增量尚未打包。

日期：2026-10-19。关联 AB-F20/F21、M02/M06/M07/M08，核对M10收录边界。**alpha.29之后未发布源码**；alpha.29标签冻结23d256e，不含本片。开发先在该提交的隔离副本中进行，发布会话完成后核对原文件摘要一致，才将改动应用到主工作区；没有污染其构建、测试或公开附件。

## 1. 需求与交付

按[连接矩阵](../../agent-integration-matrix.md)CT-04及[公共材料研究](projects-dots-bots-research.md)推进第一片：让获准Agent先读短索引，再按确切修订取所需正文。Bridge投影已有共享记录，不生成记忆、业务结论或模型配置。

- 新增只读 `team.materials` / MCP `team_materials`，返回工作目标、成员职责、文档版本引用、任务与当前报告/产物、原生状态和消息观察位置，并提供 `markdown` 阅读视图。
- `team.document` / MCP `team_document` 增加可选 `revision`；提供时读取准确的不可变历史修订，不存在就拒绝，不退回最新正文。不提供时保持原有完整当前文档/历史结构。
- 新索引不加载文档正文，不确认消息已读，不改任务/收据，不启动模型或检查远端引用。普通委派仍不要求创建完整公共工作，也不因知道文档引用取得小队身份。

本片提供Agent侧MCP/API与Markdown字符串；没有新增桌面按钮、物理MD导出/同步、全历史产物Library、自动上下文交接包或ACP。因此CT-04是首片实现，CT-05仍为后续目标。

## 2. 完整契约与边界

| 接口 | 输入 | 返回与规则 |
| --- | --- | --- |
| `team.materials` | 用户给runId；可选limit（默认20，1–50）、documentAfter | 当前工作的一页文档元数据及其他短索引 |
| `team_materials` | 可选limit、documentAfter；工作身份来自原MCP scope | 同一只读投影，不能传另一个runId冒充授权 |
| `team.document` / `team_document` | 原documentId，可选正整数revision | 无revision保持旧结构；指定revision返回该版title/content/authorId/time、currentRevision及contentSha256，不附全部history |

索引 `schema:1`、`readOnly:true`、`source:'team-space'`。`snapshotId`是本次返回页的内容摘要，不是新增全局修订或权限凭据。`documents`含items/total/hasMore/next；下一页用next作documentAfter，当前工作没有该游标则拒绝。引用形如 `team-document:<documentId>:<revision>`，正文SHA-256按UTF-8内容计算。文档编辑不重排游标；当前没有删除文档接口。

目标/完成条件最多1200字符、约定800、成员职责300、输入/输出/边界各200、当前报告摘要300；这些是截短阅读入口，完整材料仍从team_context/team_tasks读取。文档每页最多50条，任务沿现有50项上限，仅列每项当前报告的产物；旧产物从team_tasks历史读取。原生执行只列最近20项并标明是否还有历史，消息仅显示已有观察窗口/末序号，不嵌入群正文。

JSON白名单不包含接入配置、entryKey、原requestId、原生Session、endpoint或凭据。Markdown对用户提供的名称/标题等转义，作为材料展示而不是授权指令。文档正文不被索引展开；公共材料本身仍由用户/成员维护。

索引保留任务业务state、原生执行state/等待和成员报告来源，不能把文字“已完成”解释成执行成功。当前产物引用始终标为 `reference-not-checked`，本次读取不说明路径可达、版本已验证或总工作验收。成员职责仍为user_declared，不因进入索引升级成实测能力。

所有读取先走既有TeamSpace授权：原成员/原工作/未撤权，原生成员还须原尝试仍有效。跨工作documentId/游标不泄漏正文；撤权、原生终态/unknown身份和已结束工作仍按原规则拒绝成员访问。所有者保留历史阅读。没有SQLite格式迁移，没有创建新写操作收据，也不变更任何unknown/占位/取消规则。

新MCP schema通过tools/list公布team_materials和team_document.revision，经典六工具不变。旧后台不支持新工具/字段时应继续使用原context/document/tasks通路；不能把旧接口忽略revision后返回的最新正文冒充指定历史版本。客户端核对返回revision及摘要，不能只看服务名称/旧版本字符串。

实现：[投影模块](../../../desktop/electron/team-materials.cjs)、[TeamSpace读取/授权](../../../desktop/electron/team-space.cjs)、[MCP描述](../../../desktop/electron/team-tools.cjs)、[Coordinator入口](../../../desktop/electron/coordinator-service.cjs)。

## 3. 实际验证

| 层次 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 首轮纯索引/授权/修订 | 7/7，受控SQLite，无模型 | [首次TAP](../../../artifacts/public-materials/2026-10-19/targeted.tap) |
| 索引与既有空间/任务集成 | 27/27，含新8项及生产Coordinator→stdioMCP→broker→TeamSpace | [集成TAP](../../../artifacts/public-materials/2026-10-19/targeted-integration.tap) |
| 完整桌面回归 | 525/525，无跳过，受控CLI/socket/SQLite | [最终TAP](../../../artifacts/public-materials/2026-10-19/desktop-final.tap) |
| 真实原生读取 | WSL/Node22.23.1，Claude2.1.303，一个真实Task成功，三组限定检查 | [首次报告](../../../artifacts/public-materials/2026-10-19/2026-10-19T01-54-03.217Z-native.json) |
| 完整观察器重开 | 只查原任务/收据，仍一个Task；文档保持当前第2版 | [只读报告](../../../artifacts/public-materials/2026-10-19/2026-10-19T01-55-42.364Z-native.json) |

新8项覆盖：读前后SQLite业务/收据/通知不变；确定性摘要；后续编辑后仍准确读取旧修订；非法/缺失版本不回退；另一真实工作的文档/游标拒绝；撤权与已终态原生scope拒绝；分页有界不重复；当前报告/产物与unknown原生状态不混淆；内部字段不投影；Markdown标签转义；真实stdioMCP贯通及实时撤权。新增断言补入最终全量；27项与8项属于全量子集，不相加。

真实Agent明确调用team_materials看到文档当前第2版，再用team_document(revision:1)取得原第1版正文，实际原生回答匹配旧内容。仅两次真实MCP读取，未写群消息/任务或批准权限。重开读取同一原执行，不把重复报告计作两次模型任务。[可恢复脚本](../../../desktop/tests/linux-team-materials-native.cjs)、[受控测试](../../../desktop/tests/team-materials.test.cjs)。这不是Windows EXE、其他原生工具或独立SSH验收。

本次核心/前端/原生协议代码未改；alpha.29的核心45/45、类型/构建与包结果保留发布记录日期，不冒充本次重测。新CJS模块进入未来完整打包仍需独立verify-package；本次未构建新包。文档/差异检查及[330份源码清单](../../../artifacts/public-materials/2026-10-19/source-manifest.json)的最终复核纳入[汇总](../../../artifacts/public-materials/2026-10-19/verification-summary.json)。

最终收尾：`node scripts/check-docs.mjs`通过（166份Markdown、14对模块设计/报告、零错误），`git diff --check`通过；[330份源码最终复核](../../../artifacts/public-materials/2026-10-19/source-verification.json)全部匹配。本次只读[GitHub发布元数据](../../../artifacts/public-materials/2026-10-19/release-state.json)确认alpha.29非草稿预发布、两附件uploaded及EXE大小/摘要与既有发布记录一致；没有重复完整下载或将其作为本片EXE证据。

```bash
node --test --test-concurrency=1 desktop/tests/team-materials.test.cjs desktop/tests/team-space.test.cjs desktop/tests/team-work.test.cjs
node desktop/tests/linux-team-materials-native.cjs --plan
# 显式真实执行；已有状态只观察，准备过的操作只查原收据。
node desktop/tests/linux-team-materials-native.cjs --run
node desktop/tests/linux-team-materials-native.cjs --observe
node scripts/check-docs.mjs
```

## 4. 发布状态与下一步

当前公开预发布为[alpha.29](alpha29-release.md)，它冻结在本片开发之前；当前源码版本字符串仍alpha.29不表示新索引已进该EXE。本次没有发布新tag/附件或操作远端后台，发布记录的完整下载/Windows证据不覆盖CT-04。

下一片可以在同一契约上补桌面只读阅读/复制和产物/交接视图，再设计显式选定材料与接收端读取的CT-05。跨机器可达性、新工具真实环境、旧后台兼容/升级、新EXE与完整I06C/I07C继续分别验证，不用本次一个真实读取Task替代全部准出。
