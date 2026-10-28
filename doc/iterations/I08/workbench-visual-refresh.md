# I08 桌面工作台视觉调整

日期：2026-10-28（Asia/Hong_Kong）。基线为master `c40f45e9696c7c3e97ad8bf4f72486a843bed3c5`及当前工作树；公开版本仍为0.6.0-alpha.67。本片更新源码与生产前端构建，未打包、发布新EXE。工作树已有的原生接入改动继续保留，不计入本片的产品实现范围。

## 需求与验收目标

用户要求前端更有设计感。关联AB-F01/09/16、M01-F01/F03/F06/F09/F14，验收项T-M01-201。现有界面导航、统计和工具卡片的灰度、字号相近，阅读层级不足；本片在现有桌面与品牌资产上调整外观，不新增页面、供应商或模型配置。

| 目标 | 最终实现 |
| --- | --- |
| 清晰的整体层级 | 石墨绿导航、暖白工作区、橙色主操作、青绿色选中；独立深色语义变量 |
| 易于扫读的接入页 | 大标题、四张独立统计卡、范围/视图切换和机器分组；连接策略与添加机器集中在页首 |
| 连贯的其他页面 | 执行审计四色列边、会话选中标记与正文行距、设置/小队/弹窗的统一表面与间距 |
| 原交互可用 | 搜索与清空焦点、侧栏偏好重开、概览/图切换、弹窗Escape及返回焦点；执行入口保持配置/审计边界 |
| 两主题与桌面尺寸 | 1440×960及980×660不横向溢出；品牌、导航、统计标签与主操作文字对比度均至少4.5:1 |

## 源码与设计落点

- [AppShell](../../../desktop/src/AppShell.tsx)：导航与页内说明、同步标记；连接中使用中性色。
- [NetworkApp](../../../desktop/src/NetworkApp.tsx)：统计标签与页首操作编排，原计数口径及回调保持。
- [MachineInventory](../../../desktop/src/MachineInventory.tsx)：为已有机器类型提供呈现标记，不改变节点筛选或能力。
- [workbench.css](../../../desktop/src/workbench.css)与[workspace-pages.css](../../../desktop/src/workspace-pages.css)：主题、侧栏局部变量、字号/留白、卡片、焦点及响应式。关系图保持280×132节点几何与原路由；未增加外部字体/图片请求或依赖。
- [preview-ui.cjs](../../../desktop/scripts/preview-ui.cjs)：隔离预览版本从当前package读取；MCP读写明确返回预览限制，不将fixture内部错误带进界面或访问原生配置。
- [check-workbench-design.cjs](../../../desktop/scripts/check-workbench-design.cjs)：生产前端、一次性Coordinator、合成任务历史；输出指定的新证据目录，拒绝覆盖已有报告。

截图检查发现并修正浅色模式侧栏品牌继承深色文字的问题，以及SSH认证选项受通用label边距影响而高度不齐的问题。前后截图与首次调整证据分别保留，不用最终截图改写最初结果。

架构、数据模型和协议已核对：原NetworkApp/preload/Coordinator分层、RPC、Task/Session、operationId/requestId、持久字段与授权均没有因外观改动而变化；图维持挂载。未修改架构/数据/协议正文，不以视觉状态释放unknown、确认任务成功或认定取消。现有用户说明的页面及入口名称继续适用。

## 实际验证

环境：Windows，Node `v24.12.0`，Edge `157.0.4341.16`；Vite生产前端、一次性受控Coordinator、合成机器/任务历史。真实模型调用0，未读取或改写日常用户profile/原生敏感配置。

| 检查 | 结果 | 原始证据 |
| --- | --- | --- |
| 生产前端构建 | TypeScript与Vite通过；原大于500KB chunk提示保留 | [最终构建日志](../../../artifacts/workbench-design/2026-10-28/build-verified.log) |
| 相关组件回归 | 105/105，无跳过；渲染、配置门禁、恢复与MCP事实展示 | [最终TAP](../../../artifacts/workbench-design/2026-10-28/renderer-tests-final.tap) |
| 生产浏览器 | 六组检查通过、18张最终截图、pageErrors=0 | [最终报告](../../../artifacts/workbench-design/2026-10-28/verified/report.json) |
| 代表性文字对比度 | 两主题八项全部通过，最低5.08:1；不等于完整无障碍审计 | 同上contrast字段 |
| 原界面对照 | 同一1440×960/980×660窗口、五页与关系图14张截图 | [变更前报告](../../../artifacts/workbench-design/2026-10-28/before/report.json) |
| 文档检查 | 检查仍返回失败：原2243项历史材料缺失；新增0、消除0，没有重建历史材料或掩盖原失败 | [原基线](../../../artifacts/workbench-design/2026-10-28/docs-before.log)、[最终输出](../../../artifacts/workbench-design/2026-10-28/docs-after.log)、[差异](../../../artifacts/workbench-design/2026-10-28/docs-delta.json) |
| 格式与变更范围 | 本片五个源/脚本文件Prettier检查通过；所改已跟踪源码及文档的diff检查通过 | [范围差异检查](../../../artifacts/workbench-design/2026-10-28/diff-scoped.log) |

浏览器六组分别验证：页面/关系图与主题尺寸、代表性文字对比度、搜索及清空焦点、侧栏偏好重开、机器/原生配置弹窗及返回焦点、没有日常执行/续聊入口或执行请求。18是截图数，不当作18条独立业务测试；105项组件测试与浏览器检查不相加。

| 同状态截图 | 变更前 | 最终源码 |
| --- | --- | --- |
| 浅色接入配置 | [原图](../../../artifacts/workbench-design/2026-10-28/before/01-machines-light.png) | [新图](../../../artifacts/workbench-design/2026-10-28/verified/01-machines-light.png) |
| 深色接入配置 | [原图](../../../artifacts/workbench-design/2026-10-28/before/07-machines-dark.png) | [新图](../../../artifacts/workbench-design/2026-10-28/verified/07-machines-dark.png) |
| 会话阅读 | [原图](../../../artifacts/workbench-design/2026-10-28/before/04-conversations-light.png) | [新图](../../../artifacts/workbench-design/2026-10-28/verified/04-conversations-light.png) |
| 980×660桌面 | [原图](../../../artifacts/workbench-design/2026-10-28/before/10-machines-compact.png) | [新图](../../../artifacts/workbench-design/2026-10-28/verified/10-machines-compact.png) |

## 复现

在仓库根执行；界面检查的输出路径必须使用新的目录，以保留已有证据。仅使用隔离受控数据，不调用模型。

```powershell
npm run build --prefix desktop
node --test desktop/tests/ui-redesign.test.cjs desktop/tests/agent-configuration-ui.test.cjs desktop/tests/connection-ui.test.cjs desktop/tests/connection-recovery-ui.test.cjs desktop/tests/mcp-status-facts-ui.test.cjs
node desktop/scripts/check-workbench-design.cjs --output artifacts/workbench-design/local-recheck
node scripts/check-docs.mjs
```

本机交互预览使用`node desktop/scripts/preview-ui.cjs`，默认`http://127.0.0.1:4197`。版本标明“UI预览”，任务历史为合成数据，MCP/模型执行返回明确预览限制；不能作为真实原生配置或模型通过的证据。

报告与截图版本为实际验证时读取的alpha.67；预览会动态读取当前package版本，后续工作树版本字段变化不能作为本片新EXE已构建或验收的依据。

## 未测与交付边界

本轮没有重新打包或运行普通EXE，没有部署SSH、启动真实原生Agent/模型、刷新完整工程矩阵，也没有重测关系图100ms、冷启动或真实多机性能。980×660是桌面窗口验证，不声明移动端或所有更窄尺寸通过；CSS的760px两列规则尚无本轮截图验收。跟随系统与减少动态效果沿用原实现，未以本轮截图冒充系统主题切换专项。原docs:test 5/6、2243项历史材料缺失和I06C/I07C/MCP02未准出保持。

本轮同步整体功能设计、M01完整设计与测试报告、整体测试的证据边界、迭代路线和迭代索引。公开alpha.67与既有EXE字节不变。
