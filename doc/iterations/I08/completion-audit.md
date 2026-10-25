# 全迭代开发与验收推进台账

后续已随[alpha.63](../I08/alpha63-release.md)公开：源码与EXE/校验文件分发及匿名完整下载核验通过，原实际验收范围与未准出边界保持；开发目标按用户要求暂停。

用户于2026-10-25要求“先到这里，把当前改好的全部提交，exe也传到github”，原开发目标已暂停；仅继续[alpha.63提交/发布](alpha63-release.md)。完整目标未完成。当前[图20样本p95 496.029ms](../I06/alpha63-graph-baseline.md)仍未准出。

alpha.63 [原生MCP生命周期补验](../I08/native-mcp-lifecycle.md)：普通无调试EXE与原版Pi客户端七组通过，三个实际解包目录关闭后删除，原传输/原身份/完整接收收据保持；最后原窗/客户端/Coordinator均确认退出。实际WSL十五分钟180/180及删除/重开/撤权/轮换六组也已通过，两个客户端/原宿主退出且残留0。模型0，其他入口/跨版本升级/托管父模型、WSL冷启动/历史故障与整体MCP02继续未准出。

本地alpha.63已交付CT-05原包传递、目标接入收据和桌面只读审计：源码944/944、Core71/71；冻结Windows传递14/14、原收据4/4、关系37/37、兼容26/26，生产页面新5组/控制台6组、普通EXE6组通过，模型0。Pi→固定源码Hermes实际原生MCP组件7组通过；接收声明不代表模型理解、业务验收或文件可达，完整准出不变。[完整证据与边界](../I07/context-delivery.md)。

[alpha.62对原SSH](alpha62-ssh-readonly.md)只读三组通过，原alpha.37/PID/配置不变，无部署或模型；完整故障/升级与普通EXE联合矩阵仍待。

[alpha.62控制台](../I07/configuration-console.md)源码/包内/生产页面已验；[原窗口验收脚本修复](window-lifecycle-verifier.md)后，普通关闭/重开、完整后台重启和原收据五组通过，真实驱动码0。旧失败为重新枚举误选同进程辅助窗，产品/EXE字节不变，未切换日常后台。

目标：继续将所有迭代开发验收完成。2026-10-22开始按当前工作树持续推进，不把单个修复、候选EXE或受控测试通过当作完整目标完成。当前公开版本alpha.60，冻结a0f313c；日常后台上次成功现场记录为alpha.46；2026-10-25原中央attach端点ENOENT，当前版本/获准列表未能刷新，本轮未启动/切换。发布记录见[alpha.60](alpha60-release.md)，候选、公开包与日常运行证据分开记录。

## 范围与准出来源

| 范围 | 必须核对的准出依据 | 当前缺口与下一动作 |
| --- | --- | --- |
| I06C | [I06验收矩阵](../I06/testing.md)、[收尾记录](../I06/final-delivery.md)、M01–M05/M07/M08/M10设计与报告 | 完整故障矩阵；[alpha.56冻结包图管线诊断](../I06/alpha56-graph-pipeline.md)默认含tracing PNG20条p95 363.722ms未准出、本地同步1556ms通过；软件诊断112.902ms仍失败，不据此关闭产品GPU。alpha.54无trace 241.069ms与alpha.53同步/几何保留原条件；独立LAN/SSH及最终EXE联合流程、完整版本切换/回滚与正式0.6.0准出；[alpha.56已补齐38项原清单与完整维护输入](maintenance-input-capacity.md)，全目录CLI与原unknown查询通过；[当前62实际SSH复验](alpha62-ssh-readonly.md)已再次确认alpha.37原后台认证、1459项严格文件与身份/PID保持，完整故障/升级及普通EXE联合流程仍待准出；历史证据不能替代当前包复验 |
| I07A/B/C | [持续协调验收](../I07/automation.md)、[停止矩阵](../I07/native-stop.md)、[六工具原生覆盖](../I07/connection-native.md)、[普通委派](../I07/connection-delegation.md) | Hermes/Pi/DSH真实直接执行与被委派未覆盖场景、DSH原实例模型、真实执行成员链与完整停止；运行中权限/取消/未知回应不重放 |
| I08-MCP02 / CT-06 | [MCP02-T01–T18](mcp-open-integration.md#8-验收用例与证据层级)、[原生组件层级](mcp-native-acceptance.md) | 十入口逐项配置/原生列表/协议/真实主调用/托管归属矩阵；Hermes/Pi原生配置和公开EXE已交付；[公开60十工具原生组件](native-policy-components.md)三链各7组通过，模型0，真实自主父模型/托管scope仍未验；WSL原有路由已核对，alpha.49增加启动就绪，最终包原生持续连接/撤权5组已验，历史启动9/20通过/11次就绪前退出、失败写入0；[公开60本轮](wsl-launch-origin.md)生产20/20与原始79/80，唯一原始失败无Linux首写标记，当前63已补15分钟180/180持续连接与重开/撤权组件；整体稳定性/冷启动未准出；原生父模型待验；原生父模型自主委派、页面增删/禁用及独立SSH；不可用入口需真实版本证据和正确能力门禁 |
| CT-07 | [委派列表](../I07/delegation-list.md)、[当前连接](../I07/agent-connections.md)、[子任务上下文](../I07/delegation-context.md) | 核对最终候选真实原生消费、分页/归属/撤权和观察重开证据，不只沿用源码/受控报告 |
| CT-08 | [已确认操作面设计](../I07/agent-centric-operations.md)、[接入矩阵](../../agent-integration-matrix.md#4-后续目标与完成条件) | [A3连接策略](../I07/connection-policy.md)本地60实现Agent连接工具、v3预授权/明确确认和多关系策略/审计UI；源码900/900、Windows生产界面4组，模型0；现有图仍selected，[十工具原生组件](native-policy-components.md)三链各7组已验；下一步核对真实父模型、用户日常多主/确认/撤权、跨主原任务恢复；低频操作面已在[alpha.62](../I07/configuration-console.md)收敛配置/审计与显式恢复，不能以受控页面代替完整CT-08准出 |
| CT-04/05 | [公共材料](../I07/public-materials.md)、[上下文选材](../I07/context-packet.md) | [原包传递/接收声明](../I07/context-delivery.md)本地63已交付，原生Pi/Hermes组件、Windows与普通EXE均已验；继续真实父模型消费与完整矩阵，不能把成员接收声明等同于模型理解、业务验收或文件同步 |
| CT-03 | [可选ACP试点](../I07/agent-centric-operations.md) | 仍是可选试点：至少第二种Agent复用同一Client后再决定扩大；不得批量替换当前驱动或把候选研究写成已实现 |
| 交付共性 | [协作与文档规则](../../development-guide.md)、[整体测试](../../testing.md) | 每个产品分片均须同步完整设计/报告/数据/协议、工程检查、新EXE/源码一致性/普通运行和实际原生证据；公开推送、标签/发布、远端部署按对应授权，不能用本地包代替公开发布 |

上表是尚未整体准出的范围索引；逐项通过条件继续使用各专项原编号，不重编号、不改写原历史结果。最终完成审计需逐条检查原要求、命令、测试、指标、环境和产物，并为每项给出同范围的当前权威证据；任何缺失或仅间接证据均保留未完成。

## 已推进分片

| 分片 | 当前权威证据 | 完成边界 |
| --- | --- | --- |
| OpenDesk空默认字段兼容 | [alpha.47交付](opendesk-mcp-defaults.md)：桌面760/760、核心68/68、Windows原生组件7组/普通EXE4组、下载副本SHA一致 | 本地候选完成；公开alpha.46不含此修复，未切换日常后台；不代表原生父模型自主委派或页面验收 |
| DSH Desktop原生MCP适配 | [开发与验收](dsh-desktop-mcp.md)：按已安装原包核对当前数据目录/Profile选择，保存绑定、原目标清理、切换和竞态保护 | 本地交付完成：桌面766/766、核心68/68，原生组件5组/生产前端4组/普通EXE4组、最终包及下载副本SHA一致；不代表日常原生父模型、独立SSH或完整MCP02准出 |
| WSL当前启动/入口诊断 | [2026-10-25公开60](wsl-launch-origin.md)：20/20生产HostConnection、60条握手后请求、20退出及零宿主残留；原始四条件80样本中1次失败无Linux首写标记，8/8派发边界回归 | 20轮是当前已运行发行版/指定资源的窗口，不能作为冷启动或根因修复；原始故障仍在，当前63已补持续15分钟180/180及重开/撤权；冷启动/故障矩阵及完整稳定性待验 |
| WSL宿主就绪与MCP原路径 | [alpha.49开发验收](wsl-host-readiness.md)：共享桌面770/770、核心68/68、包及bootstrap一致性、普通Windows EXE4组通过，模型0 | 源码修复与本地包已完成；最终包真实Windows→WSL MCP5组通过；另保留就绪前退出，稳定性及原生父模型未准出 |
| OpenDesk原生父模型自主委派 | 用户已明确允许最多1个Windows OpenCode心算子任务；2026-10-23日常alpha.46只读复核正式7个目标中没有Windows OpenCode，父Prompt0/子任务0；[授权与现场现状](wsl-host-readiness.md#真实父模型验收待授权) | 授权已获，不再重复申请；最新2026-10-25原中央attach端点不可达，未读取当前版本/列表，提交仍0；[前置证据](native-policy-components.md#父模型前置与未完成)。恢复后再核对指定Windows目标，不替换为WSL/其他Agent或新增关系 |
| 冻结旧daemon与完整维护输入 | [alpha.56](maintenance-input-capacity.md)：原32份不变，新增6份来自已核验EXE，索引38/上限128；863/863、Windows26/26与8,914,703字节解析通过，实际CLI原unknown/daemon PID保持；55的真实文件3组为前片证据 | 55已发现全目录超8MiB而不作完整维护准出；56保留完整目录并修复输入容量。后续[真实SSH只读复验](current-ssh-readonly.md)已证明原服务器认证/严格文件与原PID保持；未做升级/故障/模型，原unknown保护保持 |
| CT-08原生十工具组件 | [2026-10-25公开60](native-policy-components.md)：独立提取公开EXE、56后台摘要一致，Pi/Linux、Pi/Windows、固定源码Hermes/Linux各7组；明确允许/拒绝、历史确认不恢复撤权、身份轮换与缓存拒绝，模型0 | 仅原生组件及受控宿主/用户RPC；真实父模型/任务、日常多主、完整MCP02仍未准出；低频界面见alpha.62本片 |
| CT-08-A2按身份多主运行期 | [alpha.59](../I07/multi-parent-runtime.md)：v2安全迁移、用户侧显式关系API、原父/连接隔离、unknown保留、全关系撤权与原拒绝恢复；884/884、包内Windows21/21和实际中央管道/重启、普通EXE生命周期4组与Downloads SHA通过 | 后续A3已实现连接/envelope与策略/审计UI并随60公开；真实原生父模型/日常多主未准出；低频操作面收敛见alpha.62，旧图仍selected |
| CT-08-A1关系索引存储 | [alpha.57](../I07/relation-storage-migration.md)：旧文件内存迁移/自然原子落盘、索引冲突拒绝、原ID/unknown保持；870/870、Windows包内7/7与真实Coordinator管道及Downloads SHA通过 | 该片只证明存储迁移；后续多主运行和连接策略见A2/A3，不能以A1旧证据证明当前完整CT-08 |
| 当前图管线诊断 | [2026-10-24冻结56](../I06/alpha56-graph-pipeline.md)：默认/软件对照各20条，PNG p95 363.722/112.902ms均失败，同步1556/1514ms通过，文字重复测量0；离线完整性核对4项通过 | 部分慢样本与GPU提交长跨度重叠但非唯一根因；继续默认普通EXE呈现/采帧链路核对；本轮窗口观察初始化因sandboxCwd的WSL路径错误失败，重置后仍复现，无输入或新图指标，见[工具证据](wsl-launch-origin.md#目标与普通窗口前置)。产品不改GPU设置，不把诊断模式当准出 |
| 原SSH后台只读复验 | [2026-10-23实际服务器](current-ssh-readonly.md)：冻结56客户端、实际37 daemon，原凭据/主机指纹认证、1459项原清单校验与两次非接管inspect三组通过；原进程/入口/连接配置保持，模型0 | 没有部署、hello或任务/维护派发；不能替代完整故障/版本切换和普通EXE联合流程 |
| 图尺寸保留 | [alpha.54](../I08/graph-measured-dimensions.md)：最终20次拖动授权边文字测量11,800→0；桌面844/844、Windows前端7组、普通EXE4组、包一致性与Downloads完整SHA通过 | 真实尺寸改变与角色端点保持正确；PNG离线复核20条p95 241.069ms仍未满足100ms；alpha.54已随公开[alpha.60](alpha60-release.md)发布，图指标未准出 |
| 当前包指标/WSL补验 | [alpha.53完整帧样本](../I06/alpha53-current-metrics.md)：自动保存画布0px通过、本地同步p95 1504ms通过，PNG帧p95 388.932ms未准出；[历史WSL](../I06/current-candidate-metrics.md)9/20通过/11次就绪前退出，失败写入0，原始启动器亦复现 | 模型0、产品/包未变；独立LAN/SSH未验，继续图帧观测/渲染定位与WSL根因，不重试原请求 |
| Pi/Hermes原生MCP配置 | [alpha.50联合交付](hermes-mcp-config.md)：桌面794/794、核心68/68；Pi原生Linux/Windows各5组、Hermes原生组件5组、前端5组/普通EXE4组，包与下载副本SHA一致 | 本地分片完成，模型0；Hermes固定源码版本戳unknown，不当作正式安装版或Windows原生成功；真实父模型/生命周期/SSH/完整矩阵继续未准出 |

目标保持进行中。局部环境限制时继续不依赖该环境的实现与验收；原请求回应未知只查原ID，禁止换ID、节点或目录重放。
