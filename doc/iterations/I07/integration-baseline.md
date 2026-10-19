# I07当前未发布工作区整体验证

日期：2026-10-18。基于alpha.28工作区，合并观察到的UI重构、空白原生Session保护和会话异常业务验收补丁；不修改源码行为，不构建或发布新EXE。GitHub alpha.28及旧包摘要仍对应原冻结版本，完整I07C/I06C未准出。

## 1. 本轮验收增量

[UI重构](ui-redesign.md)已有373项全桌面基线，随后新增[业务验收保护](acceptance-native-binding.md)仅做相关53项回归。本次把当前整个工作区放在一起检查，避免把不同日期/源码的各专项通过数拼成完整候选验证。

开始前核对AGENTS、文档入口、整体功能、M01/M02/M06/M07/M08设计和报告、当前迭代；保留全部未提交文件，不运行用户profile或重放原操作。没有新增产品需求/接口，不修改architecture/data-model/protocol行为；现有模块设计和源码落点一致，本次只刷新实际测试证据。

## 2. 实际运行

环境：本机WSL Linux / Node22.23.1，既有本地依赖，真实进程/SQLite/受控SSH及HTTP测试端点；原生回复为夹具，模型调用0，未连接用户独立SSH服务器。各测试使用其隔离数据，源码已有运行约束保持。

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 核心 | 45/45，通过，无跳过，含根TypeScript构建 | [日志](../../../artifacts/I07-integration/2026-10-18/core.log) |
| 串行全桌面 | 375/375，通过，无跳过；含父/子测试和生产React SSR检查 | [TAP](../../../artifacts/I07-integration/2026-10-18/desktop.log) |
| lint | 通过；范围为原npm脚本src/tests/scripts，不声称覆盖所有CJS/前端 | [日志](../../../artifacts/I07-integration/2026-10-18/lint.log) |
| 根类型 | 通过 | [日志](../../../artifacts/I07-integration/2026-10-18/types.log) |
| 前端类型和生产构建 | 通过，保留既有大于500KB单包提示 | [日志](../../../artifacts/I07-integration/2026-10-18/frontend.log) |
| 文档结构/差异 | check-docs和git diff --check通过；不计产品用例 | [文档检查](../../../artifacts/I07-integration/2026-10-18/docs-check.log) |

[机器可读汇总](../../../artifacts/I07-integration/2026-10-18/verification-summary.json)记录实际命令、结果和未测层级。本次没有初次失败或通过后更换配置重跑。桌面串行只控制桌面测试间并发，核心工程等独立检查同时运行；日志保留实际输出。

源码清单覆盖246个代码/测试/工程配置文件，包含未跟踪UI文件；[路径与SHA-256](../../../artifacts/I07-integration/2026-10-18/source-manifest.json)。清单在校验过程中采集，全部命令结束后再次比对匹配；它是该观察时点至结束的源码追踪，不是开始前冻结证明、提交发布证明或EXE资源匹配证据。文档更新不在该源清单范围内。

各模块引用375/45时只共享同一次工程结果，不跨模块相加；新增两项验收测试已包含在375内，不再叠加成另一总数。历史373/53/317等保持原日期与对应源码。

## 3. 复现与边界

仓库根用已安装Node运行：`npm test`、`node --test --test-concurrency=1 desktop/tests/*.test.cjs`、`npm run lint`、`npm run typecheck`、`npm --prefix desktop run build`和`node scripts/check-docs.mjs`。前端构建更新本地开发dist，不修改发布EXE或用户后台。

尚未运行新UI浏览器视觉/交互、新工作区Windows普通EXE或独立服务器；SSR和构建不能替代这些证据。此前真实Claude/旧EXE证据继续属于各自原始版本，没有在本轮重跑。UI重构专项原有的浏览器替代验证待确认事项保持原记录，本次没有改变其授权状态。

下一片继续补新UI交互和实际候选包验证，以及真实执行成员自动交接/跨机器；这份工程基线不放行完整I07C/I06C，也不改写GitHub alpha.28已发布附件。
