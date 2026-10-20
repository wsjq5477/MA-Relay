# CT-04桌面材料阅读、复制与MD下载

2026-10-19后续状态：本页当时的未发布增量已与公开alpha.30–32修复整合，并进入未公开的integrated.3本地候选。原日期/环境/计数和当时未测保持，下文“尚未整合/未打包”属于该片历史时点；当前包与验证见[整合交付](integrated-source.md)。

日期：2026-10-19。AB-F20/F21，M01-F10；复用M08-F07既有材料只读接口，检查M10包边界。源码基于本地a872275/alpha.29派生工作区，保留前片公共材料与独立MCP未提交修改。此次只改桌面读取/传出及测试，没有改后端、存储、原生执行或请求恢复规则。

## 1. 实际需求与实现

用户在小队工作中按需打开“公共材料”：先读短索引，再阅读选定版本的正文，将当前页索引或单份指定版本复制/下载为Markdown。材料阅读不能因原未知写操作而被阻塞，也不能解除原占位。

[TeamMaterials](../../../desktop/src/TeamMaterials.tsx)接入[工作空间](../../../desktop/src/TeamWorkspace.tsx)，[类型](../../../desktop/src/team-types.ts)和[传出/版本核对](../../../desktop/src/team-material-transfer.ts)负责呈现与传出。新组件按directory+runId挂载，已有轮询只更新原工作上下文，不定时请求team.materials；收起/展开不会偷偷刷新已有快照。用户显式刷新回首页。文档按默认20条分页，前后页都重新读取，MD按钮明确为“当前页索引”，没有伪装成全文档打包。

索引同时保留Markdown文本框及当前产物引用说明；引用只作文字展示，不主动打开文件/网络，也不验证可达性。没有新增交接授权或完整产物Library。当前任务/原生状态与权限仍由原结构化台账判断。

## 2. 精确版本和失效流程

点击“阅读此版本”传索引documentId/revision；也可明确输入另一正整数修订。返回必须匹配原工作/文档/修订，currentRevision有效，且浏览器重新计算UTF-8正文SHA-256匹配返回值。请求索引指定版本时，还核对索引的contentSha256。只显示已核对正文；缺版本/旧后台忽略字段/正文摘要不符均清空旧正文和复制/下载入口，明确报错，不回退最新版。

切工作/目录使组件失效，读索引与正文各自有代次检查；A的迟到响应不能进入B或成为B的下载内容。刷新/分页也使旧正文读取失效。新索引接口不存在时显示真实后台错误，原共享工作文档及历史入口保留；没有从旧接口造出新索引或声称准确旧修订。

正文和标题以React文字/textarea呈现，不运行HTML，也不引入新的Markdown执行器。复制等待clipboard API结果；失败提供手动文本框。下载由用户点击触发浏览器Blob，文件为UTF-8 Markdown；单文档附明确revision、读取时currentRevision、版本引用及正文摘要，原正文保留。文件名去除路径/Windows非法字符并加固定前缀。界面只说“已发起下载”，不把它声称成磁盘保存/交付成功；URL在触发后回收。

这是一份本机静态阅读副本，无导入、实时MD同步、原生Session/推理迁移、通用上下文交接包或自动执行。快照不授予目标读者Bridge访问权；跨Agent交接仍用原授权及任务规则。

## 3. 本次实际验证

| 层级 | 日期/环境与实际结果 | 原始证据 |
| --- | --- | --- |
| 版本/传出保护 | WSL Node22.23.1，四项：外来身份/旧接口拒绝、正文摘要、固定旧版导出及Windows文件名，通过 | [4/4正常执行TAP](../../../artifacts/public-materials-ui/2026-10-19/transfer-normal.tap) |
| 桌面全量 | WSL正常本机，541/541，零跳过，无模型；新增4项属于全量子集，不能再相加 | [完整TAP](../../../artifacts/public-materials-ui/2026-10-19/desktop-tests.tap) |
| 类型/前端构建 | 桌面tsc/Vite通过；保留大于500KB单包提示 | [构建日志](../../../artifacts/public-materials-ui/2026-10-19/desktop-build.log) |
| Windows生产前端 | Node24.18.0 / Edge155.0.4283.45，真实Coordinator/SQLite，受控机器，八组流程通过、页面错误0、模型0 | [最终报告](../../../artifacts/public-materials-ui/2026-10-19/ui/2026-10-19T08-20-01-437Z/report.json)、[旧修订阅读](../../../artifacts/public-materials-ui/2026-10-19/ui/2026-10-19T08-20-01-437Z/pinned-document.png)、[窄桌面工作B](../../../artifacts/public-materials-ui/2026-10-19/ui/2026-10-19T08-20-01-437Z/materials-work-b.png) |
| 实际浏览器下载 | 下载的旧版正文UTF-8字节与受控clipboard收到的Markdown完全一致，B索引没有A内容 | [旧版MD](../../../artifacts/public-materials-ui/2026-10-19/ui/2026-10-19T08-20-01-437Z/document-revision-1.md)、[B索引MD](../../../artifacts/public-materials-ui/2026-10-19/ui/2026-10-19T08-20-01-437Z/work-b-index.md) |

八组包含：显式打开/有界分页/标题文字转义；前后页；精确旧版与实际MD下载；拒绝clipboard及手动回退；缺失版本/旧接口/损坏正文；旧后台不支持索引；A迟到响应与B导出隔离；760px窄桌面无横向溢出、只有读取调用、原unknown操作不变且原生请求0。Windows clipboard使用页面受控实现验证内容/拒绝，不代表写入系统剪贴板；下载则是实际浏览器下载和保存文件。首次和最终浏览器均通过，最终补保存阅读截图，不能把重复运行加算16组。

受限执行器的Windows互操作报vsock错误，转正常本机后通过；受限TSX仅报一个测试文件外壳，不计四项证据，正常执行逐项4/4并纳入全量。见[环境说明](../../../artifacts/public-materials-ui/2026-10-19/execution-notes.json)、[受限TAP](../../../artifacts/public-materials-ui/2026-10-19/transfer-tests.tap)。这不是产品失败后改写日志。

较早[Agent侧首片](public-materials.md)的真实Claude2.1.303一个Task保留原日期/接口范围；本片模型0，未新开真实Agent、未重发原任务。核心/后端/原生源码未改，较早MCP工作区核心45/45与alpha.29包证据不冒充本次重跑。[源码清单](../../../artifacts/public-materials-ui/2026-10-19/source-manifest.json)、[仅七份源码/测试变化](../../../artifacts/public-materials-ui/2026-10-19/source-delta.json)与[最终汇总](../../../artifacts/public-materials-ui/2026-10-19/verification-summary.json)记录冻结范围和检查。

最终收尾：`node scripts/check-docs.mjs`通过（168份Markdown、14对模块设计/报告、零错误），`git diff --check`通过；[262份源码摘要复核](../../../artifacts/public-materials-ui/2026-10-19/source-verification.json)全部匹配，仅预期七份源码/测试新增或变化，其余既有未提交运行源码保留。

## 4. 公开发布与本地源码分开

本次只读GitHub API核对：当前公开预发布已是[alpha.31](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.31)，标签002107da776687474c2d369d9a182a9f81d50e90，非草稿，两附件uploaded；EXE129,953,583字节，服务器摘要e8a53cf59d520a546756daa4e2d183e3928a76bada6c6ba64d0de28ba01a5753。[原始脱敏元数据](../../../artifacts/public-materials-ui/2026-10-19/release-state.json)。此次没有重新下载/验证此EXE，不把API附件元数据当作本次完整包/现场证据。

alpha.30/31由独立问题修复分支交付；本工作区HEAD仍a872275，未合入它们的原对象路由/兼容检查等修复。反向也不能推断公开alpha.31包含本地CT-04和独立MCP未提交增量；本片未打新包、未推送发布。后续交付必须先整合两边源码，再冻结、工程回归、打包/verify-package和实际Windows EXE验证，不能直接用本工作区替换公开修复版。完整I06C/I07C及独立SSH依旧未准出。

## 5. 复现与下一步

```bash
node --test desktop/tests/team-material-transfer.test.cjs
node --test --test-concurrency=1 desktop/tests/*.test.cjs
npm run build --prefix desktop
# Windows Node + Edge；临时SQLite/受控机器，模型0
node desktop/tests/windows-team-materials-ui.cjs
node scripts/check-docs.mjs
```

CT-04已补桌面阅读/复制/单份MD下载；完整历史产物目录、显式交接视图与CT-05选定版本上下文继续待开发。新包/真实EXE、其他原生工具消费导出文件和独立SSH未测；不由历史真实Agent或浏览器结果替代。
