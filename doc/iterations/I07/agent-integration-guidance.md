# I07：接入方式比较、推荐与快速接入文档

日期：2026-10-20。关联AB-F02/F07/F08/F10/F11/F12/F13、M06-F01/F05。用户要求结合已有Agent接入表，说明原生CLI、API、MCP、ACP、插件、SDK的优缺点、可实现功能、后续选型和如何快速接入。

## 本轮交付

| 文档 | 作用与变更 |
| --- | --- |
| [接入矩阵](../../agent-integration-matrix.md) | 仍是各Agent当前实际接入状态的唯一表；补选型与操作导航，推荐不进入已实现列 |
| [方式比较与选型指南](../../agent-integration-guide.md) | 六方式优缺点、功能条件、连接方向与组合、逐Agent后续建议、用户已有入口操作、开发阶段和实施验收 |
| [源码开发指南](../../custom-agent-development.md) | 对照当前八入口、CLI与服务发现、静态注册、Host契约、真实源文件/命令、阶段门禁及worker/包/daemon部署 |
| [文档入口](../../adapters.md)、[总入口](../../README.md)、[整体设计](../../product-design.md)、[M06设计](../../modules/06-native-adapters/design.md)/[报告](../../modules/06-native-adapters/test-report.md) | 统一链接和当前状态说明，不把文档补足列为新运行功能 |

## 核对事实与建议边界

- 当前六种产品、八个入口；新增DSH Desktop/Web仍是alpha.34之后源码。未新增通用ACP Client、Bridge原生插件或SDK驱动。
- MCP当前为Agent调用Bridge；CLI/API为Bridge执行目标Agent。插件/SDK可承载协议，六列不是互斥选择。目标原生支持的功能，不等同Bridge已适配。
- 官方规范仅核对带版本的MCP和ACP v1材料；会话load/resume可选，取消通知不等同原Task已取消，协议请求ID不代替持久业务去重。完整引用维护在[指南来源](../../agent-integration-guide.md#7-核对来源)。
- 优先复用已有可用原生路径；只需调用Bridge时优先原生MCP；用户已有Desktop/Web服务优先评估原生API；结构化CLI适合当前框架的快速执行适配；ACP保留可选试点，插件/SDK按明确缺口评估。没有对全部路线做性能或开发耗时实验。
- 现成ExampleHost仅检查契约并明确拒绝执行，不是已经接入的新Agent。派发前保存Bridge请求/摘要/派发围栏，原生Session返回后立即绑定；不能要求所有CLI在首次Prompt前产生Session。
- 本次是文档完善，不修改运行代码、数据模型、协议或发布范围；无需伪造产品需求、真实模型或EXE验证。已有未提交DSH与其他源码保持原样，不在本轮宣称其已发布。

## 本轮验证

环境：WSL Ubuntu，使用仓库原Node运行文档/骨架检查，未安装新运行依赖、未连接原生Agent、模型调用0。

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 注册/Host示例可执行性 | 通过；native executions=0 | [骨架输出](../../../artifacts/agent-integration-guidance/2026-10-20/extension-example.txt) |
| 文档本地链接/模块追踪 | 通过；180份Markdown、4199个本地链接、0错误 | [文档检查](../../../artifacts/agent-integration-guidance/2026-10-20/docs-check.json) |
| diff空白检查 | 通过；git diff --check退出0 | [diff检查](../../../artifacts/agent-integration-guidance/2026-10-20/diff-check.txt) |
| 新适配器/原生模型/独立SSH/新EXE | 未运行，不适用于本轮文档验收 | 未改产品行为；原有专项证据保留各自日期/版本 |

复现：

```bash
node examples/custom-agent/check.cjs
node scripts/check-docs.mjs
git diff --check
```

首次文档检查时，所引用的diff-check证据尚未生成，因此报告一条缺文件；生成实际检查文件后重跑通过，[首次结果](../../../artifacts/agent-integration-guidance/2026-10-20/docs-check-initial.json)保留。这是证据文件生成顺序问题，没有修改产品来规避检查。

前两项验证文档引用和静态开发骨架，不证明真实执行、模型回复、恢复、Windows包或任何未来ACP/插件/SDK功能。
