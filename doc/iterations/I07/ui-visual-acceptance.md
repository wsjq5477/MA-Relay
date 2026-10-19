# I07 桌面重构：Windows 视觉与交互验收

日期：2026-10-18（北京时间）。关联 I07-UI-R01–R05、M01-F01/02/05/06/07/08/09/10/14。基于 alpha.28 的未发布工作区；本页记录生产前端的 Windows Edge 隔离验证，不改变 GitHub alpha.28 的冻结源码、EXE 或校验文件。

## 1. 本轮交付与证据层级

本轮在[界面重构](ui-redesign.md)基础上完成实际浏览器检查，并修复菜单退出、搜索焦点、会话阅读布局和异步详情身份混合等问题。[CC Switch 调研](cc-switch-ui-research.md)使用官方 v4.0.0 界面图与 v4.0.14 冻结源码作参考；本轮没有运行原生 CC Switch，不将参考图写成当前 CC Switch 应用实测。

| 层级 | 当前实际结果 | 原始证据与限制 |
| --- | --- | --- |
| Windows 生产前端与隔离 Coordinator | 5 组检查通过，12 张截图，页面异常 0，模型调用 0 | [最终报告](../../../artifacts/ui-redesign/2026-10-18/verified/ui.json)、[执行脚本](../../../desktop/tests/windows-ui-redesign.cjs)；任务历史合成、机器执行器受控，不访问用户 profile |
| 截图人工检查 | 当次执行者已逐张查看最终verified目录12张截图 | 本页逐步展示；不把截图数量作为12个独立业务用例累计 |
| 独立状态矩阵 | 10组/8图通过，另有小队状态3组/3图通过；均无页面异常、无模型调用 | 覆盖离线、迟到回应、作用域、菜单、长名及小队会话异常；报告见末节 |
| 稳定关系图补捕获 | 已完成；截图等待“布局已保存”，原图交互10组回归通过 | 鼠标、键盘、缩放、草稿与原操作恢复均使用受控机器 |
| 普通 Windows EXE | 最终本地候选`0.6.0-alpha.28.ui.2`包核验及普通程序4项通过 | [字节、生命周期与使用说明](ui-redesign.md)；本地交付，未发布GitHub |

环境为 Windows Node **24.19.0**、Microsoft Edge **155.0.4283.45**，Playwright 实际操作生产构建的 React 页面；使用临时隔离 Coordinator、受控机器和合成任务/会话，模型调用 **0**。标准视口 1440×960；最小桌面视口 980×660，与 Electron 当前最小窗口一致。`verified/ui.json`的12步均记录document/content横向overflow为false，`errors=[]`。这两个指标不替代逐张视觉检查，也不构成完整无障碍合规声明。

## 2. 本次修复后的完整行为

| 场景 | 当前行为 | 语义边界 |
| --- | --- | --- |
| 机器与节点更多菜单 | 同时只展开一个菜单；外部点击关闭；Escape 关闭并返回菜单入口焦点；选定可用动作后关闭菜单 | 禁用动作不提交；断开/移除继续使用既有确认与后台门槛 |
| 搜索 | 清空按钮和 Escape 清空后让焦点留在搜索框；匹配与清空只改变本机视图 | 不更换 nodeId、machineId、Conversation 或原操作 ID |
| 长名称与安装位置 | 机器/Agent 名称和路径按容器换行 | 独立长名状态用例另行记录，不以本页普通长度截图替代 |
| 会话阅读与最小窗口 | 阅读区滚动，续问区保持可见；最小窗口保留双栏阅读和可用滚动 | 不把留空目录描述成新文件隔离；预览会话不允许实际续发 |
| 任务/会话详情刷新 | 发起查询时固定原详情 ID；仅在仍选中同一 ID 且返回身份相符时应用结果 | 选 A 后改选 B，或关闭原任务详情，迟到的 A 回应不能重开窗口或给 B 混入 A 的内容/来源 |
| 新建、续聊与节点管理 | 共用后台/关系保存执行锁；续聊还检查来源节点在线/接入、原占位、历史、上一轮终态和 canContinue | 后台异常或原关系保存待核对时不靠旧可用快照提交；unknown 只查询原操作 |
| 会话筛选 | 机器范围或验证记录开关排除当前会话时，阅读与续问区隐藏该选择；返回原范围后按原身份显示 | 不清除后台历史、不转移执行归属；本地关键词搜索只缩小列表 |
| 小队会话异常 | 每个带公开 continuationError 的原执行显示“会话身份异常，当前记录不能作为可信验收依据” | 原生 status、结果和原错误保留；不凭全部历史异常全局禁用验收，不自行推断后台验收结果 |

小队会话身份异常的后台验收守卫继续按[原生绑定与业务验收专项](acceptance-native-binding.md)执行。前端只是展示现有公开事实，没有新增后台字段、RPC、模型 API 或迁移。图仍保持挂载及 280×132 节点几何；授权与布局各自沿原修订、原 operationId 恢复。

## 3. 实际交互检查

[最终报告](../../../artifacts/ui-redesign/2026-10-18/verified/ui.json)记录以下 5 组；它们不与此前 375 项桌面工程基线、53 项 SSR 或后续状态矩阵相加：

| 组 | 已执行场景与实际结果 | 限制 |
| --- | --- | --- |
| 1 | 五个生产页面、关系图、智能体接入表单、深浅主题与最小窗口完成 12 步截图；无页面异常 | 控制的机器目录与合成历史，非真实模型结果 |
| 2 | 机器搜索及无匹配空态、清空恢复；侧栏折叠在 reload 后保持且可展开 | 本机 UI 偏好，不涉及用户后台数据恢复 |
| 3 | 关系草稿跨概览/关系图/页面切换保留；丢失授权 ACK 后概览及新建禁用；查询原收据恢复，授权保存调用次数不增加 | 真实 Coordinator/授权存储与受控传输故障，不是独立 SSH 故障 |
| 4 | 任务搜索保留原记录语义；原任务详情能打开并关闭 | 任务历史合成，未调用原生工具 |
| 5 | 系统主题随模拟的 OS 深浅变化即时更新；停止后台先显示明确确认，取消后关闭确认框 | 本组取消停止，没有将浏览器 window stub 当真实后台退出 |

## 4. 逐步截图、健康与观察

以下截图均来自`verified`，图下分别记录布局观察与未证明的范围。每步健康为当次页面没有记录JavaScript异常，document/content均无横向溢出。

### 01 机器概览 · 1440×960

![机器概览：机器分组、工具、角色、状态与动作](../../../artifacts/ui-redesign/2026-10-18/verified/01-machines.png)

健康：document/content overflow=false。观察：机器分组与横向工具行建立默认入口，主动作和低频管理分层；首页说明区已收紧，避免说明文字占据过多空白。限制：已接入/可用来自受控工具检查，未证明真实模型可回复。

### 02 关系图 · 1440×960

![关系图：原机器分组、授权工具与独立布局](../../../artifacts/ui-redesign/2026-10-18/verified/02-graph.png)

健康：document/content overflow=false。观察：原机器组、节点、授权与布局工具保留，概览切换继续复用同一图实例。限制：本张记录捕获时画面；待“布局已保存”后的稳定补捕获另补，不从静态图推断所有拖动/键盘或保存恢复已验收。

### 03 任务看板 · 1440×960

![任务看板：进行中、待核对、成功与失败分列](../../../artifacts/ui-redesign/2026-10-18/verified/03-tasks.png)

健康：document/content overflow=false。观察：四列数量与原任务状态分开呈现，可按需求或来源搜索。限制：状态和回答来自合成历史，不将视觉成功色当真实原生终态证据。

### 04 会话阅读 · 1440×960

![会话：双栏、原回答与可见续问区](../../../artifacts/ui-redesign/2026-10-18/verified/04-conversation.png)

健康：document/content overflow=false。观察：列表、来源、原轮次回答与续问区域分层；已修复初版续问区落在视口外的问题。限制：示例 canContinue=false，界面明确给出预览原因，本步未发送实际续问。

### 05 设置 · 1440×960

![设置：外观、连接、后台与恢复分组](../../../artifacts/ui-redesign/2026-10-18/verified/05-settings.png)

健康：document/content overflow=false。观察：外观、连接、后台运行和原操作恢复有独立分组，窗口关闭与后台停止保持两个含义。限制：本步无合成 pending；原请求阻塞矩阵另测，停止确认取消不证明实际后台退出。

### 06 小队起步 · 1440×960

![小队起步：页内导航、首次接入指引与工作空间](../../../artifacts/ui-redesign/2026-10-18/verified/06-team-start.png)

健康：document/content overflow=false。观察：工作空间/智能体/小队设置导航与首次接入指引可见，协作说明渐进展开。限制：这是空目录起步，不覆盖真实多成员工作、自动续接或跨机器链路。

### 07 智能体接入表单 · 1440×960

![智能体接入表单](../../../artifacts/ui-redesign/2026-10-18/verified/07-team-agent.png)

健康：document/content overflow=false。观察：接入方式、职责与输入输出按表单层级组织，原生与外部入口仍沿既有能力边界。限制：本步只展示表单，没有接入用户自研 Agent 或提交模型需求。

### 08 深色机器概览 · 1440×960

![深色机器概览](../../../artifacts/ui-redesign/2026-10-18/verified/08-machines-dark.png)

健康：document/content overflow=false。观察：外壳、机器组、工具行及状态随主题切换，主动作与中性色层级保持。限制：本步不是全页面对比度或屏幕阅读器审计。

### 09 深色会话阅读 · 1440×960

![深色会话阅读](../../../artifacts/ui-redesign/2026-10-18/verified/09-conversation-dark.png)

健康：document/content overflow=false。观察：列表选中、回答、来源与续问原因在深色主题保持可读层次。限制：未执行真实原生流式输出或长时运行。

### 10 最小窗口机器概览 · 980×660

![980×660 机器概览](../../../artifacts/ui-redesign/2026-10-18/verified/10-machines-minimum.png)

健康：document/content overflow=false。观察：最小桌面窗口自动使用图标侧栏，机器/工具操作通过内容区滚动保持可达。限制：这是 Electron 当前最小桌面尺寸，不声称移动端验收。

### 11 最小窗口会话阅读 · 980×660

![980×660 会话双栏与续问区](../../../artifacts/ui-redesign/2026-10-18/verified/11-conversation-minimum.png)

健康：document/content overflow=false。观察：保留双栏和原回答滚动区，续问区不再随长页面落出可用视口。限制：该截图是普通长度合成回答；极端长名和迟到回应属于另行状态矩阵。

### 12 最小窗口设置 · 980×660

![980×660 设置分组与滚动](../../../artifacts/ui-redesign/2026-10-18/verified/12-settings-minimum.png)

健康：document/content overflow=false。观察：设置分组在最小窗口可滚动访问，主题和后台动作保持可见层级。限制：未在这一步停止真实 Coordinator 或恢复用户机器。

## 5. 初次失败与修复保留

[initial/ui.json](../../../artifacts/ui-redesign/2026-10-18/initial/ui.json)明确记录失败：前 7 张完成后，`getByLabel('主题', { exact: true })` 等待超时。主题控件的可访问名称已修复，随后完整重跑，`final/ui.json` 为 passed，12 张截图和 5 组检查均完成；不删除或改写首次失败。

初版人工检查还发现会话续问区出视口、首页说明区域空白过多。本轮修复阅读/续问区布局并压缩说明留白。保留[初版会话](../../../artifacts/ui-redesign/2026-10-18/initial/04-conversation.png)、[初版机器概览](../../../artifacts/ui-redesign/2026-10-18/initial/01-machines.png)和[失败时画面](../../../artifacts/ui-redesign/2026-10-18/initial/failure.png)，与本页verified截图对照。横向 overflow=false 不能证明垂直操作区可达，因此人工检查和最小窗口复测均保留为独立证据。

## 6. 复现与剩余边界

在具有既有开发依赖、Windows Node 和已安装 Edge 的环境，先构建生产前端，再从仓库根运行：

```bash
npm run build --prefix desktop
node desktop/tests/windows-ui-redesign.cjs --output artifacts/ui-redesign/2026-10-18/review-run
```

输出目录需为新的当次目录，保留 initial/final 历史；脚本自行创建绑定 127.0.0.1 的临时预览，不读取用户 profile，也不执行真实模型。`--capture-only` 仅取图，不等同上表 5 组完整验证。浏览器运行不要求最终 Windows 用户安装 Node/WSL，最终用户交付继续为 EXE。

本轮未完成用户故障机、独立SSH、真实原生模型或多成员自动交接验收。既有[工作区工程基线](integration-baseline.md)及[会话异常业务验收](acceptance-native-binding.md)保留各自日期与源码边界；最终工程381项与候选冻结资源另有当次证据。完整I06C/I07C仍未准出，GitHub alpha.28附件保持原冻结版本。

## 后续已完成的状态与图交互

同日状态矩阵10组通过（8图、无跳过、无pageerror、业务执行0），原图真实鼠标/键盘回归10组通过；分别见[状态报告](../../../artifacts/ui-redesign/2026-10-18/state/2026-10-18T00-48-05-809Z/ui.json)和[图交互报告](../../../artifacts/ui-redesign/2026-10-18/graph/ui.json)。菜单异步toggle时序问题经键盘反例暴露后修复，当前截图已更新为verified目录。普通EXE与候选字节仍按[当次交付](ui-redesign.md)记录，不从浏览器推定。

小队专项3组/3图通过，执行者逐张查看：旧异常记录单独提示且保留succeeded和原结果，后续正常执行无警告；存在完整合成工作项时不因历史异常全局禁用验收，但不点击真实验收；unknown保留上次权限等待、原错误及confirmed取消收据，不推定批准或取消终态。[报告与截图](../../../artifacts/ui-redesign/2026-10-18/team/2026-10-18T00-50-21-765Z/ui.json)，writeAttempts=0、modelCalls=0、pageErrors=[]。
