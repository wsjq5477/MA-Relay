# CC Switch 当前界面研究与 AgentBridge 重构映射

日期：2026-10-17。范围：公开版本、官方截图、冻结前端源码和设计系统静态研究。本文为 M01 界面重构的参考输入，实际需求、开发与本产品验收见[当次重构记录](ui-redesign.md)。

结论：CC Switch 当前界面的成熟度主要来自稳定的导航外壳、统一的内容密度、克制的动作层级和明确的状态反馈。AgentBridge 应迁移这些交互原则，按机器、节点、小队、会话和任务重新组织信息；供应商、模型、API Key、Skills 与 Prompts 管理不进入 Bridge。

## 1. 版本与证据范围

| 对象 | 本次核查结果 | 用途与限制 |
| --- | --- | --- |
| 官方入口 | [farion1231/cc-switch](https://github.com/farion1231/cc-switch)；仓库指明唯一官网为 [ccswitch.io](https://ccswitch.io/) | 仅使用官方仓库、发布说明和公开图像，不以第三方宣传图认定产品行为 |
| 查询时最新正式版 | [v4.0.14](https://github.com/farion1231/cc-switch/releases/tag/v4.0.14)，发布于 2026-10-16 12:35:32 UTC | 正式发布的时间和版本边界；不代表本次实际运行了该程序 |
| 正式版冻结提交 | [`5de6feb4e5adda61f4ad824ce0df2c449245f447`](https://github.com/farion1231/cc-switch/commit/5de6feb4e5adda61f4ad824ce0df2c449245f447) | 通过 tag 解引用核实，本文实现引用固定到该 commit |
| main 查询快照 | [`73f37c4b2de4acc5c7075cd89073a5728ed41330`](https://github.com/farion1231/cc-switch/commit/73f37c4b2de4acc5c7075cd89073a5728ed41330)，提交时间 2026-10-17 13:56:57 UTC | 已有正式版之后的增量，例如用量趋势图柱状/面积切换；不并入 v4.0.14 的已发布结论 |
| 官方截图 | v4.0.14 README 采用 `assets/release-notes/v4.0.0/` 下的图 | 图像记录的是 v4.0.0 发布时点；布局与冻结源码交叉核对，局部内容不能冒充 v4.0.14 新截图 |
| 本次研究方式 | GitHub 公开元数据查询、冻结源码阅读、四张官方截图逐张查看 | 未运行 CC Switch 原生程序，未执行其原生直接交互审计、构建测试或模型任务 |

版本元数据来自官方 GitHub `releases/latest`、`commits/main`、tag ref 查询，并以本地 tag 解引用核对冻结 commit。开发主分支可能继续变化，本文不把上述 main 快照描述为永久最新。

## 2. 官方视觉证据与旧图纠偏

四张研究截图复制自冻结 commit 的公开资源，字节保持不变。它们是 CC Switch 官方公开资料，不是 AgentBridge 界面，不是本机运行截图；来源、大小与 SHA-256 见[图像来源说明](../../../artifacts/ui-redesign/2026-10-17/reference/SOURCES.md)。

| 场景 | 当次研究副本 | 官方冻结来源 | 可以观察到的事实 |
| --- | --- | --- | --- |
| 主界面 | [main-zh.png](../../../artifacts/ui-redesign/2026-10-17/reference/main-zh.png) | [官方主界面图](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/assets/release-notes/v4.0.0/main-zh.png) | 固定侧栏、单行页头、模式分段、紧凑列表；当前使用卡片淡色强调，普通对象保持中性 |
| 应用管理 | [apps-zh.png](../../../artifacts/ui-redesign/2026-10-17/reference/apps-zh.png) | [官方应用图](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/assets/release-notes/v4.0.0/apps-zh.png) | 安装位置作为名称下方的次级信息；版本、升级动作与显示开关按列对齐 |
| 会话阅读 | [session-zh.png](../../../artifacts/ui-redesign/2026-10-17/reference/session-zh.png) | [官方会话图](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/assets/release-notes/v4.0.0/session-zh.png) | 对话正文优先，执行过程折叠，右侧目录辅助定位；会话元信息集中在正文上方 |
| 用量统计 | [usage-zh.png](../../../artifacts/ui-redesign/2026-10-17/reference/usage-zh.png) | [官方用量图](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/assets/release-notes/v4.0.0/usage-zh.png) | 筛选、指标、图表、日志分层；页内筛选使用分段，切换日志内容使用下划线页签 |

仓库还保留 [assets/screenshots/main-zh.png](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/assets/screenshots/main-zh.png)。它是顶部应用切换、大留白、大圆角和明显阴影的旧图，不能用来代表当前左侧导航结构。当前 README 已指向 v4.0.0 发布图；研究也以冻结源码为实际实现依据。

官网用于核实官方身份和产品定位，本文没有将官网内容或营销效果当作原生界面的操作证据。

## 3. 十项核心实现发现

以下引用均固定于 v4.0.14 的 commit，行为判断为源码静态核对；视觉判断另由上表截图支持。

| 项目 | 冻结实现事实 | 对 AgentBridge 的启示 | 源码 |
| --- | --- | --- | --- |
| 1. 稳定导航外壳 | 主侧栏分应用目录、全局功能和底部入口；只有应用目录需要滚动，进入设置后替换为设置目录；导航有 `aria-current` 和跳到正文入口 | 用稳定页面入口承载机器、小队、会话、任务，设置沉底；不要让状态说明或操作按钮挤占主导航 | [Sidebar.tsx](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/shell/Sidebar.tsx#L62) |
| 2. 统一页头 | 52px 页头；左边图标、标题、次级页面名，右边动作；长标题允许收缩截断；窗口拖动区与交互区分开 | 页面标题与主操作放同一条；避免每页重复品牌、面包屑、标题和介绍，给内容留高度 | [AppPageHeader.tsx](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/shell/AppPageHeader.tsx#L37) |
| 3. 色彩与字体角色 | 背景、衬底、选中、三级文字、操作色、模式色、语义色分别命名，浅深色对应；13px 正文、16px 对象页标题、18px 全局页标题 | 建立全产品 token，图、列表、小队、对话框共用；品牌色不能兼任在线、成功、选中和危险 | [index.css](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/index.css#L74)、[tailwind.config.cjs](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/tailwind.config.cjs#L210) |
| 4. 动作层级 | 按钮变体统一；一个视图一个实心主动作，其他为描边或透明；28/32px 控件为主，图标按钮有统一尺寸 | 添加机器、新会话等主要动作保留文字；卡片低频操作收进更多，避免每张卡出现一排同权重按钮 | [button.tsx](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/ui/button.tsx#L6)、[ProviderCardActions.tsx](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/providers/ProviderCardActions.tsx#L79) |
| 5. 可扫读的对象列表 | 左图标、中名称和说明、右状态和动作；卡片圆角 10px，主体 min-height 58px、上下 padding 10px；普通卡片细边框，当前生效对象才用模式色；悬停轻度加强 | 机器/节点先用对齐列表呈现对象身份、连接状态、数量和动作；路径与诊断作为辅助信息，关系图保留独立查看入口 | [ProviderCard.tsx](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/providers/ProviderCard.tsx#L294) |
| 6. 页签与筛选语义 | 页面级内容切换使用下划线页签；模式或页内筛选使用浅灰轨道分段；页签支持左右方向键、Home/End 和 roving tabindex，分段使用按钮组及 `aria-pressed` | 机器筛选、图/列表视图使用筛选控件；小队文档/任务/消息等内容导航使用页签，避免全部做成胶囊 | [PageTabs](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/ui/page-tabs.tsx#L5)、[SegmentedControl](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/ui/segmented-control.tsx#L5) |
| 7. 复杂编辑面板 | 新增供应商先选预设再填表；复杂表单覆盖内容区而保留主导航，固定页头、滚动正文和 56px 底部动作栏；小确认才使用居中 Dialog | SSH 接入、节点登记等多步骤输入应有明确阶段、原状态和稳定动作区；迁移原则不要求复制其供应商表单 | [FullScreenPanel](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/common/FullScreenPanel.tsx#L66)、[AddProviderDialog](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/providers/AddProviderDialog.tsx#L480) |
| 8. 解释与反馈分层 | 简短 HoverTip 只报图标动作名称；HelpTip 解释术语；禁用动作给原因；Notice 持续展示待处理信息，NoticeSlot 使用 `role=status`；Toast 同句去重 | 原请求待核对、权限等待、升级要求必须持续可见；一次刷新反馈可短暂显示；关键后果不能只藏在问号里 | [help-tip.tsx](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/ui/help-tip.tsx#L6)、[notice.tsx](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/ui/notice.tsx#L13)、[toast.ts](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/lib/toast.ts#L3) |
| 9. 窄窗与导航记忆 | 200px 侧栏；窗口宽度小于 960px 自动收为图标轨；Windows/Linux 72px、macOS 84px；手动偏好持久化，Ctrl/⌘+反斜杠切换；动画尊重减少动态效果偏好 | 常见桌面窄窗优先让内容可读；不能直接把侧栏文字缩成难辨字号；图标轨必须仍有操作名称 | [useSidebarCollapsed.ts](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/hooks/useSidebarCollapsed.ts#L11) |
| 10. 主题切换与阅读一致性 | 支持浅色、深色、跟随系统；切换时暂时停用颜色过渡，避免不同区块先后变色；深色文字和模式色单独调校，不是简单反相 | 保留 AgentBridge 原偏好入口，统一全局、图画布、小队和弹层的主题；不要只改主背景 | [ThemeProvider](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src/components/theme-provider.tsx#L27) |

## 4. 可迁移的尺寸与 token

下表记录研究对象的冻结实现，不是要求 AgentBridge 逐值复制。实际产品选择和检查以[当次重构记录](ui-redesign.md)为准。

| 角色 | 浅色 | 深色 |
| --- | --- | --- |
| 主背景 | `#FFFFFF` | `#1C1C1E` |
| 侧栏 | `#F5F5F7` | `#161618` |
| 衬底、hover | `#EFEFF2` | `#26262A` |
| 中性选中 | `#E4E4EA` | `#313136` |
| 卡片 | `#FFFFFF` | `#2E2E33` |
| 一级文字 | `#18181B` | `#E4E4E7` |
| 二级文字 | `#52525B` | `#ABABB3` |
| 三级文字 | `#65656E` | `#9A9AA2` |

字号角色为 11px 徽标、12px 说明、13px 正文、14px 强调、15px 分区、16px 对象页标题、18px 全局页标题、24px 指标。系统字体栈含 Segoe UI、微软雅黑，不加载远程字体。页面横向留白 24px，列表间距 8px，常用圆角 6/10/14px，控件高度 28/32/36px。

深色中次级和三级文字分别调为 `#ABABB3`、`#9A9AA2`；选中、警告、模式色底衬降低亮度或采用透明叠加。仓库 `docs/design-system.html` 有部分旧值残留，实际值以冻结 `src/index.css` 为准。正文、路径和错误原因不应为追求密度退回大量 9–10px 小字。

## 5. 无障碍与参考设计的问题

源码存在可取的可访问性措施：侧栏当前页标记和跳转正文入口、图标按钮的 `aria-label`、键盘页签导航、可见焦点环、减少动画偏好、Notice 状态区域和禁用原因说明。`SearchField` 对 Esc 的处理是先清空内容，再让外层决定关闭，清除后回焦输入框；复杂面板会避开已被子弹层消费的 Esc。

这些是静态实现证据，不能据此声称完整无障碍审计通过。还应保留以下问题和限制：

- **主按钮颜色不宜照搬。** 官方[设计系统记录](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/docs/design-system.html#L585)明确写浅色 `#F97316` 加白字对比度约 2.8:1，并以 600 字重补偿；加粗不能让 13px 正常文字达到 4.5:1。深色 `#EA580C` 加白字也只约 3.6:1。AgentBridge 可保留橙色品牌，实心按钮采用更深的底色并实际核对文字对比度。
- **图标动作不能无条件复制。** CC Switch 卡片广泛采用图标加悬停提示；AgentBridge 的发送、重连、查询原请求、停止等动作具有不同后果，应保留必要文字，键盘聚焦也应读得出动作与对象。
- **桌面适配不等于移动适配。** 冻结[窗口配置](https://github.com/farion1231/cc-switch/blob/5de6feb4e5adda61f4ad824ce0df2c449245f447/src-tauri/tauri.conf.json#L19)默认 1000×650、最小 900×600。侧栏在 960px 下收起只能证明桌面窄窗策略，不能扩大为手机布局已验证。
- **帮助说明不能掩盖必要信息。** 规则解释可以进入说明卡，未确认执行、凭据要求、主机身份变化、权限和停止结果必须在主流程可见。

## 6. AgentBridge 迁移映射

AgentBridge 当前职责以[整体设计](../../product-design.md)、[M01 设计](../../modules/01-desktop/design.md)及[测试报告](../../modules/01-desktop/test-report.md)为准。以下为研究后的重构方向，是否已实现和通过必须在当次交付记录另列。

| CC Switch 原则 | AgentBridge 落点 | 必须保持的边界 |
| --- | --- | --- |
| 固定侧栏和单行页头 | 机器与节点、小队、会话、任务、设置；页头放当前页名与主操作 | 不把 CLI 品牌改造成供应商或模型管理导航，不改变外部 Agent 本身的业务职责 |
| 对齐的对象列表 | 机器身份、连接方式、在线状态、节点数量、节点可用性与主操作；关系图作为同页另一视图 | 保留原机器和节点 ID；切换视图、筛选、折叠和重命名不得释放 unknown 占位 |
| 段落和执行详情分层 | 会话正文优先，来源、原节点与状态集中，工具过程和诊断逐步展开 | 原回答、工具结果、子任务和原生过程不混为一个成功结果 |
| 任务与详情主从结构 | 看板/列表用于定位，详情承载原任务、权限、输入、取消与恢复 | 仍沿原 requestId/operationId 查询；权限或取消收据 confirmed 不代表任务成功或已取消 |
| 固定动作区与分步编辑 | SSH 检测、信任、安装批准、接入进度；节点与成员登记 | 表单变美不改变凭据清空、指纹确认、原安装恢复和后台能力检查 |
| 有严重程度的持续提示 | 连接失败、原操作未知、原生等待、旧后台不支持 | 区分待核对、拒绝、执行中和终态；不将未知统一显示成成功或可重试 |
| 共享 token 与组件纪律 | 主壳、机器列表、图、小队、会话、任务、设置、弹层共同覆盖 | 保留独立原生 Agent 配置，不引入 Bridge 模型 API 层 |

不复制的业务范围包括：供应商/API Key 切换、模型路由和聚合、模型定价、原生 Skills/Prompts 管理，以及替代外部 Agent 的业务编排逻辑。CC Switch 的这些功能服务于其配置管理定位，不是 AgentBridge 的产品需求。

## 7. 本次交付与验证边界

本次交付为研究文档、四张公开参考图和图像来源/摘要说明。读取 CC Switch 冻结源码，检查 README 所用图像，并逐张查看了四个参考场景；没有修改 CC Switch，也没有运行其原生程序或直接操作其页面。

本研究没有调用模型任务，没有新增模型接口、凭据或用户原生配置。官方图片内的公开示例路径和数值是研究对象原图的一部分，未加入 AgentBridge 私有状态、本机用户信息或运行日志。

本文不是 AgentBridge 的改造通过报告，也不替代真实 EXE、原生 Agent、独立 SSH 或恢复流程验收。重构实现、工程检查、隔离界面证据及未测项由[当次重构记录](ui-redesign.md)统一维护。
