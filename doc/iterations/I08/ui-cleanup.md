# 桌面界面文案与层级整理

## 需求与范围

2026-11-01，用户反馈当前界面混乱，要求删除冗余说明、修复字号/字重不一致，并逐页检查无效元素。关联AB-F01/09/12/16、M01-F04/F14；基于当前alpha.71后的工作树，保留此前Browser Agent开发内容，不把本片视为已发布alpha.71或browser.3更新。

## 实现与审查

| 界面 | 实际修改 |
| --- | --- |
| 共享外壳 | 删除侧栏引导、口号、工作空间标签、顶栏重复介绍和标题栏宣传语；保留导航、同步、版本与主题入口 |
| 接入配置 | 页头只留标题与操作；删除重复列表说明、相同工具名称和泛化页脚，保留机器/节点状态与能力 |
| 连接策略 | 原`compose-overlay/compose-dialog/compose-head`无样式定义，导致内容挤进关系图。改用共享模态框，正文独立滚动；标题、分组、正文、辅助状态分别使用16/14/14/13px；分组标题600、正文/标签400。当前连接分行，默认不显示修订，授权审计有记录才显示且折叠，原ID仍可展开查看 |
| 小队设置 | 删除介绍和“协作如何运行”；无智能体只显示接入，有智能体无小队显示创建入口；无工作不显示空选择器，无小队不显示不可用的工作表单。原登记、组队和工作配置入口保留 |
| 执行/会话审计 | 删除页头介绍；任务详情默认只读状态，恢复状态保留简短的“不重发”提示；来源、结果、原执行恢复保持 |
| 设置与配置 | 删除主题、概况、后台、恢复等分组的重复说明；保留关闭窗口/停止后台的实际差异、错误、未知回应及存储风险。MCP加载帮助按需展开；浏览器配对保留同机条件及ID格式说明；添加机器删除泛化SSH介绍 |

原授权写入、双修订CAS、写前本地意图、收据指纹、未知回应锁定、请求ID、模型及后台均未改变。架构、数据模型与协议检查后无需改写。无模型API层或新依赖。

## 验证环境与原始证据

Windows、Node24.12.0，生产React/Vite renderer；最终验证使用E盘现有Chrome140.0.7339.128，临时目录、配置、缓存、输出均在D盘。旧测试脚本默认C盘Edge，初始启动失败；已增加`AGENTBRIDGE_TEST_CHROMIUM`覆盖，后续使用非C盘浏览器。受控Coordinator和合成历史，不接触日常profile、不部署远端、不调用模型。

最终结果见本页验收表。复现前设置`TEMP`、`TMP`、`LOCALAPPDATA`、`APPDATA`、`npm_config_cache`、`PLAYWRIGHT_BROWSERS_PATH`到D盘；`AGENTBRIDGE_TEST_CHROMIUM`指定非C盘浏览器。构建及回归：

```powershell
npm run build --prefix desktop
node --test desktop/tests/ui-redesign.test.cjs desktop/tests/agent-configuration-ui.test.cjs desktop/tests/connection-ui.test.cjs desktop/tests/connection-recovery-ui.test.cjs desktop/tests/mcp-status-facts-ui.test.cjs desktop/tests/browser-ui.test.cjs
node desktop/scripts/check-workbench-design.cjs --output artifacts/ui-cleanup/local-recheck
node desktop/tests/windows-connection-policy-ui.cjs D:\LLM\MA-Relay\desktop\dist D:\LLM\MA-Relay\artifacts\ui-cleanup\local-policy
node scripts/check-docs.mjs
```

测试脚本的旧MCP标题/页头介绍断言已改为实际新标题与保留的结果；连接策略刷新断言改读当前连接列表，避免依赖已删修订文案或误计折叠审计行。最初111项中6项因旧文案断言失败，原[日志](../../../artifacts/ui-cleanup/2026-11-01/renderer-tests.log)保留。首次策略浏览器回归误计审计中同名目标，原[失败日志](../../../artifacts/ui-cleanup/2026-11-01/policy.log)保留，后续收窄为当前连接区域。

最初Edge及沙箱Chrome未能启动，原[Edge失败](../../../artifacts/ui-cleanup/2026-11-01/before/report.json)、[隔离路径重试](../../../artifacts/ui-cleanup/2026-11-01/before-retry/report.json)、[沙箱Chrome失败](../../../artifacts/ui-cleanup/2026-11-01/after/report.json)保留；后改为沙箱外E盘Chrome，未改日常浏览器profile。没有可用的运行前截图，不伪造同状态前后图；用户提供截图及原组件/CSS用于定位。

## 验收与边界

| 检查 | 实际结果与证据 |
| --- | --- |
| 最终前端构建 | TypeScript与Vite通过；原大于500KB chunk提示保持。[构建日志](../../../artifacts/ui-cleanup/2026-11-01/build-complete.log) |
| 渲染回归 | 111/111，0失败/0跳过。[最终日志](../../../artifacts/ui-cleanup/2026-11-01/tests-complete.log) |
| 五页与弹窗 | 8组通过，22张截图，1440×960/980×660无水平溢出；浅深主题代表性文字对比度≥4.5:1、本地字体、搜索、侧栏、配置弹窗及焦点通过；执行写入0、外部HTTP0、页面异常0。[最终报告](../../../artifacts/ui-cleanup/2026-11-01/verified/report.json) |
| 连接策略 | 5组通过；四张浅深/宽窄图，1440/980/390弹层边界和14px/600分组标题一致，Tab约束/Escape回焦、原授权与恢复门禁通过。[最终报告](../../../artifacts/ui-cleanup/2026-11-01/policy-verified/windows-policy-ui.json) |
| Taste与Impeccable | Taste接入配置入口1440/980/390：0 FAIL/0 WARN；非所有页面的Taste测量。静态6文件0 FAIL/1 WARN，SHA-256的`padStart`不是界面编号，保留算法。最终Impeccable13个变更目标输出`[]`。[Taste测量](../../../artifacts/ui-cleanup/2026-11-01/taste-final/report.json)、[静态日志](../../../artifacts/ui-cleanup/2026-11-01/taste-lint.log)、[最终检测](../../../artifacts/ui-cleanup/2026-11-01/impeccable-final.json) |

实际打开检查五页、任务详情、Agent/MCP配置、添加机器、智能体登记/小队配置、深色机器页、窄设置及策略浅深/窄屏截图。重点复查了分组字体、按钮间距、错误与空态；任务只读状态改为中性操作行，避免无错误时展示警告块。Taste截图按应用可操作性复查：接入对象、状态和下一操作明确，保留AgentBridge标识/原机器层次，无新装饰或虚构数据；此为本次自查，不冒充独立审查或全量无障碍准出。

| 最终示例 | 截图 |
| --- | --- |
| 接入配置 | [深色](../../../artifacts/ui-cleanup/2026-11-01/verified/07-machines-dark.png) |
| 连接策略 | [深色1440](../../../artifacts/ui-cleanup/2026-11-01/policy-verified/policy-dark-1440.png) · [深色390](../../../artifacts/ui-cleanup/2026-11-01/policy-verified/policy-dark-390.png) |
| 空小队 | [只显示接入入口](../../../artifacts/ui-cleanup/2026-11-01/verified/05-teams-light.png) |
| 原任务详情 | [中性只读操作行](../../../artifacts/ui-cleanup/2026-11-01/verified/22-task-audit-detail.png) |

未构建/发布新EXE，未验真实模型、生产SSH、日常配置、完整原生矩阵、全量无障碍与性能。窄屏为浏览器布局检查，不扩大桌面窗口或移动端支持承诺。合成设置页的旧管理能力/Browser状态错误属于受控夹具状态，不代表实际生产后台失败。

`node scripts/check-docs.mjs`实际运行后仍失败：原2243项历史材料缺失保持，新增0、消除0；不是全库文档通过。[检查输出](../../../artifacts/ui-cleanup/2026-11-01/docs-after.log)、[前后差异](../../../artifacts/ui-cleanup/2026-11-01/docs-delta.json)。本次源码/文档的范围diff检查通过；本次专用临时浏览器配置已清理，原始日志/截图保留在D盘artifacts。
