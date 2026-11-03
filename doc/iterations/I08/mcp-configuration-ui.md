# 原生 Agent 接入配置弹窗重构

## 需求与范围

2026-11-03，用户要求查看todo材料并实施优化。已实际读取[重构规范](../../../todo/AgentBridge_Claude_Code_接入配置弹窗_重构需求.md)、[简洁版参考](../../../todo/AgentBridge_Claude_Code_简洁版参考图.png)、[已连接参考](../../../todo/AgentBridge_Claude_Code_已连接参考图.png)与[交互原型](../../../todo/AgentBridge_Claude_Code_配置界面_参考原型.html)。MD的状态准确性/行为约束优先，PNG用于视觉结构，HTML模拟提示不作为业务实现。

关联AB-F02/F07/F08/F11及M01-F01/F02/F04/F06/F14，M06只同步状态消费边界；不扩大互联核心、小队工作流或真实原生验收范围。当前工作树包含其他Browser/互联边界工作，本片保留这些内容，仅修改配置弹窗及其验证和说明。公开alpha.71、既有browser.3 EXE均不改变。

## 开发结果

默认结构为身份标题→接入摘要→单容器2×2状态→真实原生路径/复制→收起的高级设置→固定底栏。宽672px；正文与底栏分离，短窗口只滚动正文。状态以文字及小型图标显示，使用原IBM Plex、原Agent资源、Lucide和浅深主题token，无新增框架或依赖。

| 原操作 | 当前入口与实际行为 |
| --- | --- |
| 添加Bridge MCP | 未配置时唯一主按钮，沿用`mcp.install`；添加仅进入待验证 |
| 重新探测原生列表 | 已配置时“检测接入状态”/“重新检测”，沿用`mcp.probe`；诊断内也保留详细原生列表探测 |
| 刷新配置状态 | 更多操作→重新读取配置，只调用`mcp.status`，不声称执行了原生探测 |
| 生成独立MCP文件 | 更多操作→导出MCP配置，沿用`mcp.export`；已有输出位置时确认覆盖，成功后展开文件位置 |
| 移除Bridge MCP | 更多操作，仅适用且非外部归属时显示，确认具体影响后沿用`mcp.remove`；保留其他MCP条目 |
| 撤销连接授权 | 高级设置→授权管理→撤销授权，确认后沿用`mcp.revoke`；保留原生配置与已有任务 |

综合态未配置/待验证/正常/异常只在前端派生。配置、授权、原生加载、原生连接和工具仍为独立事实；四格未展示的连接/归属保留在高级诊断。原接口有时把`bridge-stdio`服务端目录映射为工具可用，前端明确降为原生工具未验证；不改后台字段或把服务端握手当作原生工具获得。

只有配置/授权有效且当前原生加载、连接及工具事实全部充分才可显示正常。观察缺日期、未来时钟、过期60秒、目标变化、不支持或来源响应不符时保持未验证/异常；界面每秒更新TTL，每15秒及窗口获焦只读重读。保留原节点/适配器/DSH profile，忽略旧源迟到响应，错误显示脱敏。原持久化格式、配置路径归属、密钥存储、请求/操作身份、RPC和六个后台方法保持，没有模型API层或自动修复。

DSH profile、服务连接及其他原生说明位于高级设置，字段/独立保存流程不变；OpenDesk保留退出后写入门禁及原生人工验证，Browser节点不展示不适用的MCP表单。高级项不是三个大入口卡片。菜单支持方向键、Home/End、外点关闭及先按Escape收起；再次Escape关闭弹窗并回到原配置按钮。写入/检测在途禁止重复提交和关闭。

源码入口：[身份弹窗](../../../desktop/src/AgentConfigurationDialog.tsx)、[主视图与操作](../../../desktop/src/McpConnectionSettings.tsx)、[派生层](../../../desktop/src/mcp-connection-view.ts)、[六项诊断](../../../desktop/src/McpDiagnostics.tsx)、[样式](../../../desktop/src/mcp-connection.css)。原[McpSettings导出](../../../desktop/src/McpSettings.tsx)保留兼容入口。

其余工程变更文件：[main.tsx](../../../desktop/src/main.tsx)加载新样式；[新状态测试](../../../desktop/tests/mcp-connection-view.test.cjs)、[配置渲染测试](../../../desktop/tests/agent-configuration-ui.test.cjs)、[事实渲染测试](../../../desktop/tests/mcp-status-facts-ui.test.cjs)、[旧验收命令兼容入口](../../../desktop/tests/windows-mcp-settings-ui.cjs)和[六操作浏览器脚本](../../../desktop/scripts/check-mcp-configuration.cjs)。文档变更范围列于本页“同步与复现”，完整视觉证据独立登记于QA页。

## 实际验收

Windows、Node24.12.0、E盘Chrome140.0.7339.128。所有项目临时目录、隔离配置、缓存、构建、日志与截图在D盘；只读取本地技能和提供的参考文件。不接触日常profile、生产SSH或真实模型。

| 检查 | 实际结果与证据 |
| --- | --- |
| TypeScript/Vite | 最终构建通过；原500KB以上chunk提示保持。[构建](../../../artifacts/mcp-config-ui/2026-11-03/build-complete.log) |
| 渲染与状态 | 120/120，0失败/跳过；含四综合态、TTL/错误时间、未知/不支持、服务端目录反例、外部归属、OpenDesk/DSH门禁、原诊断事实及既有界面。[日志](../../../artifacts/mcp-config-ui/2026-11-03/tests-complete.log)、[派生测试](../../../desktop/tests/mcp-connection-view.test.cjs) |
| 六操作与真实隔离存储 | 10组通过、17张截图。实际Coordinator/McpIntegration写D盘合成配置；添加、路径复制、导出位置及覆盖取消、重读不探测、检测在途互斥、撤权/移除分别确认和取消、其他MCP条目及外部编辑保留。原生探测受控；不证明真实Agent加载。[最终报告](../../../artifacts/mcp-config-ui/2026-11-03/browser-final/report.json)、[完整脚本](../../../desktop/scripts/check-mcp-configuration.cjs) |
| 状态/键盘/尺寸 | 四状态及正常态仅来自独立受控原生事实；当前真实后台的Bridge端目录不触发正常。开窗TTL到期降级、读失败脱敏、错误节点响应拒绝、菜单键盘/焦点、1440/980/390浅深及480高窗口固定底栏通过；WSL/SSH身份与路径为受控界面，非远端实测。与上行同一10组，不相加 |
| 五页回归 | 8组/22张图，五页/关系图、配置/任务详情、浅深/1440与980、字体/对比度/搜索/焦点、执行写入0、外部请求0、页面异常0。[报告](../../../artifacts/mcp-config-ui/2026-11-03/workbench/report.json) |
| 视觉对照 | 已打开同画面左右对照的配置待验证与正常态，复查五项视觉维度；窄屏与危险按钮缺陷修正后通过。[完整QA](mcp-configuration-ui-design-qa.md) |
| 静态质量 | 新源/脚本Prettier通过；Impeccable五个界面目标输出`[]`；Taste应用静态检查0 FAIL/1 WARN，提示向上菜单的浮层阴影，属于实际弹出菜单且按规范保留。[格式](../../../artifacts/mcp-config-ui/2026-11-03/format-check.log)、[Impeccable](../../../artifacts/mcp-config-ui/2026-11-03/impeccable.json)、[Taste](../../../artifacts/mcp-config-ui/2026-11-03/taste-lint.log) |

所有原始状态、文件、工具与机器均为隔离或合成；窗口中的“接入正常”截图仅证明该派生分支可正确显示，不证明真实原生工具或模型已完成验收。真实工具可见性/客户端握手、生产SSH、真实DSH/OpenDesk生命周期、完整矩阵、实际EXE、性能及全量无障碍未刷新。

## 原失败与修正

最初把CSS从主视图直接导入，Node侧SSR无法解析CSS；已移到主样式入口。[原失败](../../../artifacts/mcp-config-ui/2026-11-03/initial-render-tests.log)保留。按钮迁移后，旧SSR断言仍假定添加/移除/导出同时平铺，初次26项17通过/9失败；已改为检查新主次层级及纯动作门禁，实际可达性在浏览器六操作中验证。[原断言日志](../../../artifacts/mcp-config-ui/2026-11-03/render-tests-before-update.log)。不能把更新断言当作六操作已运行的证据。

第一轮浏览器功能10组通过，但亲自看图发现窄屏摘要单字换行、撤销按钮继承红底红字。已修为窄屏摘要/标签分行和中性危险按钮；最近检测显示实际记录时间，不把证据“有效”当作整次检测通过。[第一轮图与报告](../../../artifacts/mcp-config-ui/2026-11-03/browser-first/report.json)与最终图分别保留。完整QA记录初次阻塞、修正及重拍证据。

## 同步与复现

已同步整体产品、M01/M06设计与报告、整体验证、迭代路线/目录、机器/MCP/DSH用户说明。架构、数据与协议核对后无需改写：仅新增消费既有`facts/evidence`的派生UI和确认交互，未改任何RPC、存储字段或后台行为。没有删改todo原始材料、重打EXE、公开发布或修改其他原生配置。

预先把`TEMP/TMP/LOCALAPPDATA/APPDATA/npm_config_cache/PLAYWRIGHT_BROWSERS_PATH`设为非C盘目录，并用`AGENTBRIDGE_TEST_CHROMIUM`指定非C盘浏览器。使用新的输出目录保留旧证据：

```powershell
npm run build --prefix desktop
node --test desktop/tests/ui-redesign.test.cjs desktop/tests/agent-configuration-ui.test.cjs desktop/tests/connection-ui.test.cjs desktop/tests/connection-recovery-ui.test.cjs desktop/tests/mcp-status-facts-ui.test.cjs desktop/tests/browser-ui.test.cjs desktop/tests/mcp-connection-view.test.cjs
node desktop/scripts/check-mcp-configuration.cjs artifacts/mcp-config-ui/local-check
node desktop/scripts/check-workbench-design.cjs --output artifacts/mcp-config-ui/local-workbench
node scripts/check-docs.mjs
```

[旧MCP窗口验收命令](../../../desktop/tests/windows-mcp-settings-ui.cjs)现在转入同一六操作脚本，不重复累计通过数。其他历史原生UI脚本/真实生命周期矩阵未逐个迁移或重跑，本片不引用其历史通过数作为本次证据。

最终执行`node scripts/check-docs.mjs`仍因原2243项历史材料缺失失败，新增0、消除0；不称全库文档通过。[检查结果](../../../artifacts/mcp-config-ui/2026-11-03/docs-after.json)、[差异](../../../artifacts/mcp-config-ui/2026-11-03/docs-delta.json)。本片已跟踪源码/文档的`git diff --check`通过，新源/脚本通过格式检查；专用临时脚本与浏览器配置清理，原始证据保留在D盘artifacts。
