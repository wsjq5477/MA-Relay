# 迭代资料目录

## 2026-10-21：alpha.36全部修复整合（已公开发布）

[全部修复整合与公开发布](I07/alpha36-delivery.md)：公开alpha.35独立修复与当前全部增量整合，核心57/57、桌面676/676；标签`1fef25f`，EXE 130032973字节、SHA-256 `43e09dd3…`，EXE与校验附件已公开并通过匿名完整下载核验。

## 2026-10-21：CT-07子任务最小上下文

[持久版本、历史原请求与严格准备拒绝证明](I07/delegation-context.md)：冻结桌面667/667、定向121/121、Windows受控36/36及Core构建通过，模型0；真实生产链加受控三种CLI子进程观察到完整输入，历史原文、原ID/unknown和无新授权保持。首轮118/120及修复记录保留，未打新包；CT-07三项源码/受控已覆盖，整合包和真实工具消费仍待验。

## 2026-10-21：Agent 行配置入口

[配置移至所属机器与Agent](I07/agent-row-configuration.md)：开始会话右侧增加编辑图标/配置按钮，固定原节点打开MCP或DSH服务弹窗，全局设置移除接入卡片；修复健康DSH被误作OpenCode安装。桌面649/649、核心57/57、Windows前端8组/MCP文件4组/DSH前端3组与普通EXE6组通过；本地config.2文件与校验见专项（该增量已随alpha.36公开），不扩张原生模型/独立SSH准出。

## 2026-10-21：CT-07当前调用方连接视图

[原身份、当前角色和查询期间撤权](I07/agent-connections.md)：冻结桌面643/643、定向103/103、Windows受控18/18及Core构建通过，模型0；空参数、当前角色/授权原因、原父/独立连接隔离和原unknown保留。未打新包；CT-07子会话最小上下文仍待开发。

## 2026-10-20：扫描、原管理操作与DSH状态修复

[四项问题与严格恢复](I07/agent-management-recovery.md)：设置展示原管理台账；扫描与查看入口可用，实际写入/执行继续保护；原ADAPTER_HOST接入拒绝严格结算；DSH缺服务连接不再显示工具异常。桌面632/632、核心56/56、Windows前端6组/契约29项与普通EXE6组通过；本地recovery.1文件与校验见专项，当前公开alpha.35独立边界保留。

## 2026-10-20：CT-07只读委派列表首片

[原委派分页列表与原生工具允许项](I07/delegation-list.md)：定向110/110、冻结桌面615/615、Windows8/8通过，模型0；严格原父/连接隔离，台账不是实时状态，unknown不重发。公开元数据已alpha.35但该独立修复未整合至本工作区，本片未打包；首次冻结资源遗漏和未测边界如实保留。

迭代说明"这次改了什么"。模块如何工作看对应[模块设计](../module-plan.md)；历史报告只证明原日期、原版本和原环境。当前范围与优先级见 [迭代路线](../project-plan.md)，项目入口见 [资料入口](../README.md)。

历史发布与逐轮交付统一在本页索引维护；主文档只保留当前状态，不堆叠带日期条目。

## 迭代总览

| 迭代 | 需求与设计 | 结果 / 当前状态 |
| --- | --- | --- |
| I01 | [需求](I01/requirements.md)、[设计](I01/design.md)、[开发](I01/development.md) | [测试与验收](I01/testing.md) |
| I02 | [需求](I02/requirements.md)、[设计](I02/design.md)、[开发](I02/development.md) | [测试](I02/testing.md) |
| I03A | [需求](I03A/requirements.md)、[设计](I03A/design.md)、[开发](I03A/development.md) | [报告](I03A/report.md)、[体验修正](I03A/cli-fix.md) |
| I03B | [需求](I03B/requirements.md)、[设计](I03B/design.md)、[开发](I03B/development.md) | [报告](I03B/report.md) |
| I04 | [需求](I04/requirements.md)、[设计](I04/design.md)、[开发](I04/development.md) | [报告](I04/report.md) |
| I04B | [需求](I04B/requirements.md)、[设计](I04B/design.md) | [双环境交付](I04B/report.md) |
| I04C–G | 各版本稳定性修正 | [C](I04C/report.md)、[D](I04D/report.md)、[E](I04E/report.md)、[F](I04F/report.md)、[G](I04G/report.md) |
| I05 | [提案](I05/proposal.md)、[节点](I05/node-design.md)、[协作](I05/collaboration-design.md) | [0.5.0 验收](I05/acceptance.md) |
| I06 | [提案](I06/proposal.md)、[需求](I06/requirements.md)、[设计基线](I06/ssh-design.md)/[图设计](I06/graph-design.md)、[开发](I06/development.md)、[进度](I06/progress.md)、[验收计划](I06/testing.md) | 6A/6B 主要范围已验收；I06C 完整范围未准出，专项索引见下 |
| I07 | [目标](I07/goals.md)、[需求](I07/requirements.md)、[设计](I07/design.md)、[开发切片](I07/development.md) | [验收计划](I07/testing.md)；I07A/B 与 I07C 首批已实现，完整 I07C 未准出，专项索引见下 |

## I07 专项索引：外部智能体、小队与协作

### 规划与研究

| 专项 | 说明 |
| --- | --- |
| [Agent侧自主操作与通用调用方规划](I07/agent-centric-operations.md) | CT-06/CT-07/CT-08规划、插件薄传输决策与实施顺序（纯文档） |
| [接入选型与快速指南核对](I07/agent-integration-guidance.md) | 六方式比较、逐Agent建议与快速接入（纯文档） |
| [用户文档发布边界与原生Agent阅读](I07/user-documentation.md) | 当前用户页与内部资料分离，补DSH/全部Agent章节、六方式与功能摘要；网页范围验证 |
| [文档目录重组](I07/docs-reorganization.md) | 主文档只留当前状态，历史索引集中到本目录（纯文档） |
| [连接通路目标与ACP/Multica研究](I07/connectivity-research.md) | 核心目标校准，CT-01至CT-05与ACP候选来源 |
| [Claude Projects与小队公共空间调研](I07/claude-projects-research.md) | Claude Projects一手资料与公共协作空间映射 |
| [Claude Projects / Dots / Grok Bot研究](I07/projects-dots-bots-research.md) | 共享记忆/选定上下文/可见交接对比，细化CT-04/05；Grok Build为CT-03候选 |
| [CC Switch深度调研](I07/cc-switch-ui-research.md) | 桌面UI重构的设计依据 |

### 发布记录

| 版本 | 交付与边界 |
| --- | --- |
| **0.6.0-alpha.36** | 公开发布：[全部修复整合与本地EXE](I07/alpha36-delivery.md)；含公开alpha.35修复与当前增量，标签冻结`1fef25f`，EXE与SHA-256公开核验 |
| **0.6.0-alpha.35** | issue #12：[同机独立执行与完整管理恢复](I07/scoped-execution-recovery.md)；PR #13合并，标签冻结`b5de577`，EXE与SHA-256公开核验 |
| **0.6.0-alpha.34** | [交付记录](I07/alpha34-release.md)：OpenCode 1.x/2.x、独立MCP、CT-04/CT-05及alpha.30–33整合；标签冻结`1af4dab`，EXE与SHA-256公开核验 |
| **0.6.0-alpha.29** | [alpha.29交付](I07/alpha29-release.md)：UI重构/原生接入/连接能力整合发布 |
| **0.6.0-alpha.23** | [发布记录](I07/github-release.md)：I07A/B及I07C首批持续协调分发 |
| alpha.30–alpha.33 | 见下方"协作兼容与按机器管理"和"维护修复"各专项；alpha.31/32/33为独立修复分支补丁，alpha.30为issue #6独立工作树 |
| 全部版本对照 | [历史发布登记](release-ledger.md)：按版本的标签/冻结提交、EXE 字节、SHA-256 与当时发布边界，含早期源码同步检查记录；未列入的中间版本见上方各专项 |

### 连接能力与委派（CT-01/CT-02）

| 专项 | 说明 |
| --- | --- |
| [CT-01连接能力与原关系拒绝恢复](I07/connection-capabilities.md) | 八项三态能力、方向门禁与原关系拒绝恢复；受控验收 |
| [CT-02首批真实原生生命周期](I07/connection-native.md) | WSL三工具真实直接回答/原Session续聊/取消/重开不重放 |
| [CT-02真实MCP六方向](I07/connection-delegation.md) | Claude/Codex/OpenCode全部六个普通委派方向真实通过 |
| [原生接入准入与核对收据](I07/native-integration-guards.md) | 仅直接会话工具的小队准入与原operationId核对收据 |

### 公共材料与共享上下文（CT-04/CT-05）

| 专项 | 说明 |
| --- | --- |
| [CT-04公共材料首片](I07/public-materials.md) | 只读工作索引/Markdown与指定不可变修订；真实Claude单Task消费 |
| [CT-04桌面材料入口](I07/public-materials-ui.md) | 桌面按需阅读/精确版本核对/复制与MD下载 |
| [CT-05选定上下文首片](I07/context-packet.md) | 明确选择材料版本的只读JSON/Markdown包；不派发/授权/搬Session |
| [CT-05桌面选材与导出](I07/context-packet-ui.md) | 桌面明确选材、核对预览与MD/JSON本机副本 |

### 独立MCP与原生Agent扩展

| 专项 | 说明 |
| --- | --- |
| [独立MCP文件与原生配置管理](I07/mcp-installation.md) | 三格式配置增删、长期接入撤权与外部委派归属 |
| [Hermes/Pi/DSH与自定义适配接口](I07/native-agent-expansion.md) | 三种新工具直接会话、六种图标与源码注册接口 |
| [DSH Desktop/Web接入](I07/dsh-desktop-web.md) | alpha.34之后源码：两个认证HTTP服务入口、原轮次恢复、同名Distributed Shell排除与Web安装提示 |
| [DSH本地EXE与真实连接验证](I07/dsh-exe-delivery.md) | .dsh.3候选；真实303/命名参数修复、两服务认证与Desktop模型限流分列 |
| [OpenCode宿主生命周期修复](I07/opencode-host-lifecycle.md) | 公开alpha.35冻结源码仍缺close；本地config.2已含修复，包内两入口复核通过，已随alpha.36公开 |
| [OpenCode 1.x/2.x兼容修复](I07/opencode-v1-compatibility.md) | 官方1.x独立HTTP路径与MCP双布局，保留2.x |
| [当前Agent版本发现修复](I07/current-agent-discovery.md) | 多版本节点按当前命令入口报告，旧安装保留历史 |

### 小队与自动化（I07A/B/C）

| 专项 | 说明 |
| --- | --- |
| [I07A交付](I07/delivery.md) | 登记、小队、公共文档/消息与手动原生执行 |
| [I07B任务交接交付](I07/task-handoff.md) | 任务板、精确产物版本、授权交接与返修/重试 |
| [I07C首批持续协调](I07/automation.md) | 授权事件激活、Claude原主会话自动续接 |
| [小队停止与原生终态核对](I07/native-stop.md) | 用户停止工作、撤销访问与取消/任务双重核对（alpha.24候选） |
| [小队原生等待可见性](I07/native-waiting.md) | 权限/输入等待类别与数量展示 |
| [真实三原生成员验收](I07/native-members.md) | 同WSL三独立Claude宿主公共文档链，五次自动回合 |
| [本机手动权限等待补验](I07/native-permission.md) | 真实Claude权限等待/允许/拒绝实测 |
| [自动主角色首轮权限补验](I07/auto-native-permission.md) | 事件自动启动后的真实权限等待 |
| [原会话后续轮权限补验](I07/resume-native-permission.md) | 自动主角色续接轮的独立权限控制 |
| [不完整任务回应保护](I07/incomplete-receipt.md) | 缺失身份的succeeded不能假成功或解除占用 |
| [续接意图绑定保护](I07/intended-conversation.md) | 首条续接回应前核对原Conversation |
| [空白原生Session边界](I07/blank-native-session.md) | 空白Session不开放自动续接 |
| [Codex错误终态保护](I07/codex-terminal.md) | 原生错误不被同轮完成事件覆盖 |
| [Linux后台启动权限窗口](I07/daemon-bind.md) | Unix socket创建即限0600 |
| [会话异常的业务验收保护](I07/acceptance-native-binding.md) | 会话异常时succeeded不得进入业务验收 |
| [整合源码与本地候选](I07/integrated-source.md) | alpha.30–32修复与CT-04/MCP同工作源码整合（integrated.3） |
| [当前工作区整体验证](I07/integration-baseline.md) | 未发布工作区核心/桌面全量受控回归 |

### 协作兼容与按机器管理（已发布修复）

| 专项 | 说明 |
| --- | --- |
| [OpenCode 2.x与按机器管理](I07/version-management-recovery.md) | issues #8/#9，alpha.32：严格2.x准入与unknown按机器隔离 |
| [协作兼容修复](I07/collaboration-compatibility.md) | issue #7，alpha.31：API兼容判定、原对象控制路由与能力激活 |
| [历史详情读取恢复](I07/history-detail-recovery.md) | issue #6，alpha.30：按实际backend定位原对象与局部错误隔离 |

### 维护修复

| 专项 | 说明 |
| --- | --- |
| [维护上传进度与持久化修复](I07/maintenance-persistence.md) | issue #10，alpha.33：进度不中断SFTP，最终台账保存失败不发送 |

### 界面与体验

| 专项 | 说明 |
| --- | --- |
| [桌面界面整体重构](I07/ui-redesign.md) | 统一壳层/机器概览/图切换，本地候选alpha.28.ui.2 |
| [Windows视觉与交互验收](I07/ui-visual-acceptance.md) | 主界面/状态/小队/关系图分层验收 |
| [桌面空闲黑窗与刷新优化](I07/desktop-polling.md) | 轮询与安装扫描分离，poll.4本地候选 |

## I06 专项索引：机器网络、SSH与后台

### 迭代主记录与阶段验收

| 专项 | 说明 |
| --- | --- |
| [6A候选验收](I06/acceptance.md) | 独立Coordinator/SSH/Linux daemon主要流程，alpha.2候选 |
| [I06B图编辑实施与验收](I06/graph-implementation.md) | alpha.6图/授权事务/原父权限与独立双向链 |
| [I06C收尾](I06/final-delivery.md) | alpha.13/15/16可信后台维护、控制恢复与未发送边界 |
| [GitHub EXE发布记录](I06/github-release.md) | alpha.9起Windows EXE与校验分发 |
| [新程序管理旧后台](I06/client-background-operation.md) | 新EXE设置页停止同profile旧Coordinator的说明与验证 |

### 修复专项（按alpha版本）

| 专项 | 说明 |
| --- | --- |
| [alpha.3 Codex发现修复](I06/codex-discovery-fix.md) | 自然语言发现指引与MCP工具名展示 |
| [alpha.4 兼容复用](I06/ssh-compatible-reuse.md) | 可信旧daemon清单校验与复用 |
| [alpha.5 SSH恢复错误清理](I06/ssh-error-recovery.md) | 恢复后清除旧错误并保留新失败 |
| [alpha.7 图可用性优化](I06/graph-usability.md) | 主节点强调、连线避让与中键平移 |
| [alpha.8 拖动修复](I06/graph-drag-fix.md) | 旧后台本机布局与整组背景拖动 |
| [alpha.9 节点管理](I06/node-management.md) | 合并页面与节点接入/断开/移除生命周期 |
| [alpha.10 机器管理](I06/machine-management.md) | SSH连接编辑、历史持久化与事件游标补偿 |
| [alpha.14 上传诊断与恢复](I06/ssh-upload-recovery.md) | SFTP失败分类、ACK进度与重检入口 |
| [alpha.16维护发送边界](I06/maintenance-launch-recovery.md) | 未发送证明持久化与rejected/unknown边界 |
| [alpha.18运行缓存与原提交恢复](I06/runtime-recovery.md) | 缓存清单自引用排除与原未派发意图恢复 |
| [alpha.19 Linux CLI发现](I06/linux-cli-discovery.md) | 非交互用户态安装目录扫描 |
| [alpha.19 OpenCode二次发现](I06/opencode-discovery.md) | 共享扫描核验原安装与Windows配置写入 |
| [alpha.20 未确认请求隔离](I06/pending-isolation.md) | 准备拒绝恢复与独立节点不阻塞 |
| [alpha.25 Windows原请求恢复](I06/windows-context-recovery.md) | 未完成上下文不得截获原请求查询 |
| [alpha.26 旧Linux后台升级](I06/ssh-alpha24-upgrade.md) | 补收可信清单，恢复alpha.24连接后可维护升级 |
| [alpha.27 Windows未派发恢复](I06/windows-start-persistence.md) | issues #3/#4：严格未派发核对与台账锁重试 |
| [alpha.28 SSH持久拒绝恢复](I06/daemon-rejection-recovery.md) | issue #5：只读原daemon持久拒绝结算 |

## 后续迭代必须写清

下一迭代目标与优先级见 [迭代路线](../project-plan.md)。

1. 需求编号、对应整体功能与模块、可验收行为。
2. 本次设计取舍与被更新的整体/模块文件。
3. 实际完成项、代码落点与未完成项。
4. 测试运行范围、真实证据、失败/未测和发布包状态。

不能只把新方案追加在迭代目录而让整体设计继续描述旧实现。同步规则见 [开发维护指南](../development-guide.md)。主文档（资料入口、整体设计、架构、数据、协议、测试、路线）只保留当前状态；逐轮历史写入本目录并在本页登记。
