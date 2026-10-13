# CLI 配置向导、Agent 管理与主 Agent 方案

2026-10-10 当前方向：I05 已交付“机器 → Agent 工具节点”及主从协作。下一迭代 [I06](../../iterations/I06/proposal.md)按用户确认采用 SSH 用户名/密码或密钥连接独立 Linux daemon，并以机器分组的节点图替换主从和执行目标下拉框；用户拖拽端点连接，布局与授权分开保存。完整交互、草稿冲突与验收见 [I06 图设计](../../iterations/I06/graph-design.md)、[需求](../../iterations/I06/requirements.md)、[测试](../../iterations/I06/testing.md)。I06 功能尚未开发。本文件下方保留此前 CLI 与实例配置的历史方案。

日期：2026-10-09。状态：I03 使用 CLI；用户已要求 I04 开发 Windows 桌面看板，复用当前 WSL 后台。I03A 体验修正和 I03B 已实施并通过本轮验收，当前交付见 [迭代三最终报告](../../iterations/I03B/report.md)。I01/I02 已有交付不变。

## 1. 当前入口与本轮目标

I03 的实际入口为 CLI：agentbridge 提供终端向导、默认菜单与后台生命周期，agents/run/task/native 等命令用于查询、执行和原生等待操作。旧前台 up 保留给自动化和排障。

I03A 在 CLI 内增加首次配置向导、Agent 列表与状态，以及同终端提交、观察和等待回复。后台服务维持连接，操作者不用另开一个常驻服务终端。采用普通提示、列表和菜单，不开发全屏 TUI。

I03 不设计或开发浏览器页面、Web 配置控制台、Cookie/CSRF、前端构建或桌面包装。I04 按最新要求独立开发 Windows 桌面窗口，详见第 7 节。

## 2. 首次向导与日常交互

| 步骤 | 终端操作 | 完成条件 |
| --- | --- | --- |
| 发现工具 | 查看支持的工具、版本、路径 | 已安装与已接入分开；当前真实 Driver 为 OpenCode 2 |
| 创建连接 | 空格勾选已发现工具；自动使用当前目录、托管方式和继承模型；手动项放高级设置 | 必填校验通过；敏感输入不回显 |
| 保存并连接 | 回车自动保存、启动并只读检查，无额外启动确认 | 停用草稿仅在高级模式保存；已有配置可预览后原位导入 |
| 检查与验证 | 分项检查服务/认证/模型，再由用户触发真实标记回复 | 元数据通过不等于可执行；真实验证有独立任务证据 |
| 默认目标 | 首个连接自动设默认；多连接可按名称选择默认目标 | 当前目标和不可用原因明确，不自动换其他 Agent |
| 完成向导 | 输出配置摘要和 Agent 概览，进入操作菜单 | 再次进入读取已保存配置，不重复向导或验证 |

日常流程：agentbridge → Agent 概览 → 选择目标/提交新需求 → 当前终端观察 → 遇到权限或表单直接提示作答 → 展示真实结果 → 返回菜单。

退出交互客户端不停止后台或取消任务；重返按原 Task 查询，不新建 Prompt。新任务新建原生会话；I03B 的连续会话入口可续问同 Session，每轮独立记录，详情见 [I03B 模块设计](../../iterations/I03B/design.md)。

默认入口为 agentbridge，显式向导为 agentbridge setup [--dir PATH] [--import PATH] [--advanced]。agents/run/task/native 等原有命令保留，默认配置与同终端交互按 I03A 扩展；service status/stop 查询和停止后台。这些入口已实现。

## 3. Agent 列表与状态

列表展示所有已配置连接，包括停用和离线项；显示名称、工具、设备、目录、原生 Agent/模型、默认标识、最近检查时间和当前任务。

| 状态维度 | 示例 | 依据 |
| --- | --- | --- |
| 配置 | 草稿、已配置、待应用、应用失败、停用 | 配置和实际生效版本 |
| 连接 | 连接中、在线、离线、认证失败 | Hub/Edge 与原生检查 |
| 执行验证 | 未验证、上次通过、上次失败、过期 | 当前执行配置的真实任务证据 |
| 工作 | 空闲、执行中、等待授权、等待输入、unknown | 持久任务与原生事件 |

单次 agents 显示查询快照；交互任务观察或 agents --watch 持续更新。读取失败显示原因和最后时间，不能把旧在线状态当当前确认或把 Hub 失败当没有 Agent。

连接添加/编辑局部生效，不重启整个 Edge 干扰其他任务。同本机真实目录最多一个启用连接；busy/unknown 不因停用、换 ID、模型、端口或目录别名解除占位。停用不取消旧任务和等待，I03A 不提供删除和 unknown 释放。

## 4. 主 Agent 与 Hub

OpenCode 保留为首版默认执行工具和未来主 Agent 候选，模型由用户原生配置决定，不固定为验收使用的 DeepSeek。I03A 默认原生 Agent 为 build，其他原生 Agent 选择以实际契约核验为条件。

当前默认 Agent 只接收新任务；智能协调、成员选择、受限委派与结果汇总属于 I05。Hub 继续负责认证、连接、寻址、任务状态和持久化，不增加推理或通用工具管理。

I03A 一个配置实例记录一个默认执行目标；后续协作阶段再设计项目协调者与成员。更改默认不改变旧任务的执行目标和上下文。

## 5. 迭代安排

| 交付 | 范围 | 验收重点 |
| --- | --- | --- |
| I02，已交付 | 真实 OpenCode CLI 执行 | 沿用既有真实任务与异常保护证据 |
| I03A，已交付 | CLI 向导、后台、Agent 管理、分层验证、同终端单次任务/等待回复 | 额外必需终端 0；真实执行；重返不重投；资源占位保留 |
| I03B，已交付 | 连续会话、完整控制与恢复 | 续接绑定正确；取消效果可核实；故障对账不重复执行 |
| I04，已交付待用户复核 | Windows 桌面看板：连接、任务、会话和控制 | 实际 Windows 窗口、真实 OpenCode、UI/CLI 一致、重返不重投 |
| I05 | 主 Agent 与成员协作、新 Adapter | 真实 A → B → A 委派与回报 |
| I06 | 正式部署、跨设备与外部入口 | 实际安装、身份边界和跨设备证据 |

本机管理使用 OS 权限保护的 IPC，CLI 通过 Hub/Edge 身份与任务授权完成回复；原生密码不进入交互输出。后台不负责开机启动；I03B 在进程重返与连接恢复后核验身份并恢复原执行观察。

## 6. 文档与参考

I03A 细化以[需求规格](../../iterations/I03A/requirements.md)、[模块分析与设计](../../iterations/I03A/design.md)、[开发计划](../../iterations/I03A/development.md)、[测试计划](../../iterations/I03A/testing.md)为准。CLI 功能已开发，I03A 初始证据见 [报告](../../iterations/I03A/report.md)。I03B 的 [需求](../../iterations/I03B/requirements.md)、[模块设计](../../iterations/I03B/design.md)、[开发记录](../../iterations/I03B/development.md)、[测试计划](../../iterations/I03B/testing.md)及 [最终报告](../../iterations/I03B/report.md)对应连续会话与恢复控制，不展开浏览器工作。

此前研究的参考资料保留用于连接配置、状态分层和协调角色：[CC Switch](https://github.com/farion1231/cc-switch#quick-start)、[OpenClaw 向导](https://docs.openclaw.ai/start/wizard)、[Multica Agents](https://multica.ai/docs/agents)、[Multica Squads](https://multica.ai/docs/squads)。I03 入口以 CLI 为准；I04 按用户最新要求采用 Windows 桌面窗口。

## 7. I04 Windows 桌面入口

最新交互为双击 Windows 程序 → 自动加载既有实例或发现连接 → 在总览新建任务 → 看板查看过程 → 会话续问。授权、输入和取消都在当前窗口，用户不需要保持终端。五页模块、深浅主题、受限 host 与后台复用方式见 [I04 模块设计](../../iterations/I04/design.md)。当前支持 Windows 窗口 + WSL 后台，Windows 原生后台未验收。
