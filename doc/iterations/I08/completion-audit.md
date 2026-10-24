# 全迭代开发与验收推进台账

目标：继续将所有迭代开发验收完成。2026-10-22开始按当前工作树持续推进，不把单个修复、候选EXE或受控测试通过当作完整目标完成。当前公开版本alpha.53，冻结5269d65；日常后台最近现场记录为alpha.46（2026-10-23，本轮未切换）。发布记录见[alpha.53](alpha53-release.md)，候选、公开包与日常运行证据分开记录。

## 范围与准出来源

| 范围 | 必须核对的准出依据 | 当前缺口与下一动作 |
| --- | --- | --- |
| I06C | [I06验收矩阵](../I06/testing.md)、[收尾记录](../I06/final-delivery.md)、M01–M05/M07/M08/M10设计与报告 | 完整故障矩阵；[alpha.56冻结包图管线诊断](../I06/alpha56-graph-pipeline.md)默认含tracing PNG20条p95 363.722ms未准出、本地同步1556ms通过；软件诊断112.902ms仍失败，不据此关闭产品GPU。alpha.54无trace 241.069ms与alpha.53同步/几何保留原条件；独立LAN/SSH及最终EXE联合流程、完整版本切换/回滚与正式0.6.0准出；[alpha.56已补齐38项原清单与完整维护输入](maintenance-input-capacity.md)，全目录CLI与原unknown查询通过；[实际原SSH只读复验](current-ssh-readonly.md)已确认alpha.37原后台认证、严格文件与身份/PID保持，完整故障/升级及普通EXE联合流程仍待准出；历史证据不能替代当前包复验 |
| I07A/B/C | [持续协调验收](../I07/automation.md)、[停止矩阵](../I07/native-stop.md)、[六工具原生覆盖](../I07/connection-native.md)、[普通委派](../I07/connection-delegation.md) | Hermes/Pi/DSH真实直接执行与被委派未覆盖场景、DSH原实例模型、真实执行成员链与完整停止；运行中权限/取消/未知回应不重放 |
| I08-MCP02 / CT-06 | [MCP02-T01–T18](mcp-open-integration.md#8-验收用例与证据层级)、[原生组件层级](mcp-native-acceptance.md) | 十入口逐项配置/原生列表/协议/真实主调用/托管归属矩阵；Hermes/Pi原生配置及本地EXE已交付，真实自主父模型/托管scope仍未验；WSL原有路由已核对，alpha.49增加启动就绪，最终包原生持续连接/撤权5组已验，启动补验9/20通过/11次就绪前退出、失败写入0，原始WSL也复现，稳定性未准出；原生父模型待验；原生父模型自主委派、页面增删/禁用及独立SSH；不可用入口需真实版本证据和正确能力门禁 |
| CT-07 | [委派列表](../I07/delegation-list.md)、[当前连接](../I07/agent-connections.md)、[子任务上下文](../I07/delegation-context.md) | 核对最终候选真实原生消费、分页/归属/撤权和观察重开证据，不只沿用源码/受控报告 |
| CT-08 | [已确认操作面设计](../I07/agent-centric-operations.md)、[接入矩阵](../../agent-integration-matrix.md#4-后续目标与完成条件) | [A3连接策略](../I07/connection-policy.md)本地60实现Agent连接工具、v3预授权/明确确认和多关系策略/审计UI；源码900/900、Windows生产界面4组，模型0；现有图仍selected，下一步核对真实原生消费、用户日常多主/确认/撤权和跨主原任务恢复，不能以受控页面代替完整CT-08准出 |
| CT-04/05 | [公共材料](../I07/public-materials.md)、[上下文选材](../I07/context-packet.md) | 核对实际发送/接收与跨工具消费，不能把本地投影/下载等同于外部收件 |
| CT-03 | [可选ACP试点](../I07/agent-centric-operations.md) | 仍是可选试点：至少第二种Agent复用同一Client后再决定扩大；不得批量替换当前驱动或把候选研究写成已实现 |
| 交付共性 | [协作与文档规则](../../development-guide.md)、[整体测试](../../testing.md) | 每个产品分片均须同步完整设计/报告/数据/协议、工程检查、新EXE/源码一致性/普通运行和实际原生证据；公开推送、标签/发布、远端部署按对应授权，不能用本地包代替公开发布 |

上表是尚未整体准出的范围索引；逐项通过条件继续使用各专项原编号，不重编号、不改写原历史结果。最终完成审计需逐条检查原要求、命令、测试、指标、环境和产物，并为每项给出同范围的当前权威证据；任何缺失或仅间接证据均保留未完成。

## 已推进分片

| 分片 | 当前权威证据 | 完成边界 |
| --- | --- | --- |
| OpenDesk空默认字段兼容 | [alpha.47交付](opendesk-mcp-defaults.md)：桌面760/760、核心68/68、Windows原生组件7组/普通EXE4组、下载副本SHA一致 | 本地候选完成；公开alpha.46不含此修复，未切换日常后台；不代表原生父模型自主委派或页面验收 |
| DSH Desktop原生MCP适配 | [开发与验收](dsh-desktop-mcp.md)：按已安装原包核对当前数据目录/Profile选择，保存绑定、原目标清理、切换和竞态保护 | 本地交付完成：桌面766/766、核心68/68，原生组件5组/生产前端4组/普通EXE4组、最终包及下载副本SHA一致；不代表日常原生父模型、独立SSH或完整MCP02准出 |
| WSL宿主就绪与MCP原路径 | [alpha.49开发验收](wsl-host-readiness.md)：共享桌面770/770、核心68/68、包及bootstrap一致性、普通Windows EXE4组通过，模型0 | 源码修复与本地包已完成；最终包真实Windows→WSL MCP5组通过；另保留就绪前退出，稳定性及原生父模型未准出 |
| OpenDesk原生父模型自主委派 | 用户已明确允许最多1个Windows OpenCode心算子任务；2026-10-23日常alpha.46只读复核正式7个目标中没有Windows OpenCode，父Prompt0/子任务0；[授权与现场现状](wsl-host-readiness.md#真实父模型验收待授权) | 授权已获，不再重复申请；指定正式Windows目标缺失，不能替换为WSL/其他Agent或新增关系，继续不依赖该目标的准出项 |
| 冻结旧daemon与完整维护输入 | [alpha.56](maintenance-input-capacity.md)：原32份不变，新增6份来自已核验EXE，索引38/上限128；863/863、Windows26/26与8,914,703字节解析通过，实际CLI原unknown/daemon PID保持；55的真实文件3组为前片证据 | 55已发现全目录超8MiB而不作完整维护准出；56保留完整目录并修复输入容量。后续[真实SSH只读复验](current-ssh-readonly.md)已证明原服务器认证/严格文件与原PID保持；未做升级/故障/模型，原unknown保护保持 |
| CT-08-A2按身份多主运行期 | [alpha.59](../I07/multi-parent-runtime.md)：v2安全迁移、用户侧显式关系API、原父/连接隔离、unknown保留、全关系撤权与原拒绝恢复；884/884、包内Windows21/21和实际中央管道/重启、普通EXE生命周期4组与Downloads SHA通过 | Agent连接/envelope与完整策略/审计UI仍待开发；真实原生父模型未补验，旧图仍selected，不代表CT-08整体完成 |
| CT-08-A1关系索引存储 | [alpha.57](../I07/relation-storage-migration.md)：旧文件内存迁移/自然原子落盘、索引冲突拒绝、原ID/unknown保持；870/870、Windows包内7/7与真实Coordinator管道及Downloads SHA通过 | 运行仍单主；完整多主路由/全关系撤权/连接工具/envelope与前端审计待下一片，普通EXE窗口未补验；不代表CT-08完成 |
| 当前图管线诊断 | [2026-10-24冻结56](../I06/alpha56-graph-pipeline.md)：默认/软件对照各20条，PNG p95 363.722/112.902ms均失败，同步1556/1514ms通过，文字重复测量0；离线完整性核对4项通过 | 部分慢样本与GPU提交长跨度重叠但非唯一根因；继续默认普通EXE呈现/采帧链路核对，产品不改GPU设置，不把诊断模式当准出 |
| 原SSH后台只读复验 | [2026-10-23实际服务器](current-ssh-readonly.md)：冻结56客户端、实际37 daemon，原凭据/主机指纹认证、1459项原清单校验与两次非接管inspect三组通过；原进程/入口/连接配置保持，模型0 | 没有部署、hello或任务/维护派发；不能替代完整故障/版本切换和普通EXE联合流程 |
| 图尺寸保留 | [alpha.54本地候选](graph-measured-dimensions.md)：最终20次拖动授权边文字测量11,800→0；桌面844/844、Windows前端7组、普通EXE4组、包一致性与Downloads完整SHA通过 | 真实尺寸改变与角色端点保持正确；PNG离线复核20条p95 241.069ms仍未满足100ms；未公开/未切换日常后台 |
| 当前包指标/WSL补验 | [alpha.53完整帧样本](../I06/alpha53-current-metrics.md)：自动保存画布0px通过、本地同步p95 1504ms通过，PNG帧p95 388.932ms未准出；[历史WSL](../I06/current-candidate-metrics.md)9/20通过/11次就绪前退出，失败写入0，原始启动器亦复现 | 模型0、产品/包未变；独立LAN/SSH未验，继续图帧观测/渲染定位与WSL根因，不重试原请求 |
| Pi/Hermes原生MCP配置 | [alpha.50联合交付](hermes-mcp-config.md)：桌面794/794、核心68/68；Pi原生Linux/Windows各5组、Hermes原生组件5组、前端5组/普通EXE4组，包与下载副本SHA一致 | 本地分片完成，模型0；Hermes固定源码版本戳unknown，不当作正式安装版或Windows原生成功；真实父模型/生命周期/SSH/完整矩阵继续未准出 |

目标保持进行中。局部环境限制时继续不依赖该环境的实现与验收；原请求回应未知只查原ID，禁止换ID、节点或目录重放。
