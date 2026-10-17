# 整体测试与验收报告

2026-10-17新增未发布身份校验补丁，相关受控专项45/45通过，模型0；[证据与范围](iterations/I07/incomplete-receipt.md)。以下alpha.24全量/包为原冻结基线，未包含该补丁，未在本次重跑。

## alpha.24当前源码/本地候选

核心45/45、最终串行桌面233/233、Windows契约38项、生产前端受控后端7组通过，lint/类型/构建及包一致性通过，普通Windows EXE7组通过；原控制路由与真实WSL Claude取消分别执行；最新全工程/包/普通EXE与首次失败以[停止专项](iterations/I07/native-stop.md)为准。真实Claude仅1次原取消命令，后台重启后cancelled终态才归档；Windows模型0；本机手动小队Claude真实权限允许/拒绝补验见[专项](iterations/I07/native-permission.md)，自动主角色首轮权限已[补验](iterations/I07/auto-native-permission.md)；原会话后续轮权限亦已[补验](iterations/I07/resume-native-permission.md)；执行成员交接/独立SSH和完整I07C/I06C仍未准出。以下alpha.23和更早结果均保持原版本。

更新：2026-10-16。源码/本地候选alpha.24停止专项见[当片验收](iterations/I07/native-stop.md)；当前预发布 0.6.0-alpha.23 / 小队协作与持续协调首批；历史稳定版 0.5.0。6A 与 6B 主要范围已验收，I06C 与正式准出未完成，专项限制保留。

## 1. 总结论

I07C首批源码/GitHub预发布alpha.23：核心45/45、最终串行桌面222/222、Windows契约29/29、生产前端受控界面10组通过；真实Claude2.1.299自动主角色3次激活，原Conversation/Session与新scope核对、后台重启及X失败/Y通过真实Node证据通过。开发/编译成员为受控MCP，不把它们计成真实原生Agent。初次端点恢复失败、并行维护ENOENT、最终包/普通EXE与限制见[I07C首批交付](iterations/I07/automation.md)；完整I07C、其他接入/独立SSH/完整停止和I06C仍未准出，GitHub已分发alpha.23，下载与摘要核验见[I07发布记录](iterations/I07/github-release.md)。I07A/B历史数量保留原日期，不加到本次总数。

机器/节点、原生适配、任务会话与本机协作已有可运行实现；I06A SSH 核心路径有真实服务器记录。alpha.6 核心 43/43、桌面 110/110、6B 图/性能、独立 SSH 双向核心链和普通 EXE 通过；alpha.8 当前图交互/工程/包证据见文末专项；系统 agent、无 Node 独立服务器整体安装和完整故障/升级指标仍有明确覆盖边界，整个 I06 不能标记完成。

“全部自动测试通过”只对应指定测试集，不代表每个账号、原生版本或发布物全部可用。

当前合并源码基线：核心45/45、桌面181/181，lint/类型/构建通过；最终包78个core文件、28个后台模块、1384个Linux清单条目逐项匹配。包内真实Codex0.162.1探测、Windows受控6组、普通EXE4组通过；本机隔离SSH不等同用户独立服务器，Windows受控PE不等同真实模型验收。完整摘要与边界见[alpha.19合并专项](iterations/I06/linux-cli-discovery.md)。

## 2. 资料整理时的历史持久基线

下表保留早期资料整理的 87/43 基线与原路径。alpha.6 实际 110/43 及界面、原生、EXE 证据见文末 I06B 当前基线，不能将旧表冒充当前源码重新运行。

| 检查 | 结果 | 持久记录 |
| --- | --- | --- |
| 核心 `npm test` | 43 tests / 43 pass / 0 fail | [root TAP](../artifacts/docs-baseline/2026-10-12/root-tests.tap) |
| 桌面 `npm test --prefix desktop` | 87 tests / 87 pass / 0 fail | [desktop TAP](../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) |
| 根 typecheck | 通过 | [基线摘要](../artifacts/docs-baseline/2026-10-12/summary.json) |
| 根 lint | 通过 | 同上 |
| 桌面 TypeScript + Vite build | 通过 | 同上 |
| 文档完整性与本地链接 | 整理完成后执行检查，以实际结果记录 | 同上 |

130 是这两个受控集的总数。一个跨模块用例可在多份报告引用，不能把各模块行数或复用数量相加成更多测试。

## 3. 各类证据分别证明什么

| 证据层级 | 可以证明 | 不能证明 |
| --- | --- | --- |
| 受控测试 | 数据/权限/去重/状态/错误分支的合约与受控进程行为 | 某个真实账号和厂商当前模型可用 |
| 生产后端无推理 | 真正 DesktopHost/MachineHost/daemon 能加载、发现工具与创建上下文 | 实际需求已有模型回复 |
| 隔离界面模拟 | 用户交互、参数、可见状态、秘密字段与错误展示 | 真实 SSH 密码、DPAPI、原生回复、EXE 寿命 |
| 真实 Agent | 指定时间/工具/账号/环境的一条执行链 | 所有原生版本能力、全部账号与系统 |
| 真实发布包 | 该 EXE 的启动、资源与具体流程 | 另一份未打包源码具有同样的发布状态 |

一条真实回复需要读取实际结果内容及所属任务。Codex 当前成功状态没有强制非空文本，因此仅检查 status=succeeded 不能作为用户回复验收。

## 4. 整体功能到模块验收的映射

| 整体功能 | 验收归属 | 当前结论 |
| --- | --- | --- |
| AB-F01/02 机器与发现 | [M03 报告](modules/03-machine-network/test-report.md) | 本机/WSL 已发布；远端 Linux 有真实记录；不覆盖全部第三方工具 |
| AB-F03 节点接入 | [M01 报告](modules/01-desktop/test-report.md)、M03 | 0.5.0 空格多选保留历史；alpha.6 节点动作接入与目标选择实测通过 |
| AB-F04/05 SSH 与凭据 | [M04 报告](modules/04-ssh-access/test-report.md) | 密钥真实路径有记录；alpha.2 Windows 密码/DPAPI 与实际加密密钥/隔离 agent 通过；系统服务全兼容未测 |
| AB-F06 安装与后台 | [M04](modules/04-ssh-access/test-report.md)、[M05](modules/05-linux-daemon/test-report.md) | 有系统 Node 的真实 Linux 安装通过；无 Node 实环境待测 |
| AB-F07 原生执行 | [M06 报告](modules/06-native-adapters/test-report.md)及三个子报告 | Claude/OpenCode 有真实记录；Codex 账号/原生续接限制保留 |
| AB-F08 会话 | [M07 报告](modules/07-task-session/test-report.md)与 M06 | 同会话续聊有证据；alpha.2 Windows SSH 两轮已有原生 Session ID 对比 |
| AB-F09 过程与回答 | [M01](modules/01-desktop/test-report.md)、M06 | 输出来源与聚合有实现/模拟证据；不是统一 token push |
| AB-F10 原生控制 | M06、M07 | 受控控制通过；各工具表单/许可能力不同 |
| AB-F11 原请求与恢复 | [M07](modules/07-task-session/test-report.md)、[M02](modules/02-coordinator/test-report.md)、M05 | 去重/unknown 保护有回归；游标过期补偿未闭环 |
| AB-F12/13 关系与协作 | [M08 报告](modules/08-collaboration/test-report.md) | 四条 Windows/WSL 真实链；alpha.6 原父权限反例与独立 SSH 双向核心链通过 |
| AB-F14 常驻中央 | [M02 报告](modules/02-coordinator/test-report.md) | 受控与 Linux 开发环境重启证据；alpha.6 普通 Windows EXE 生命周期实测通过 |
| AB-F15 CLI | [M09 报告](modules/09-cli-hub-edge/test-report.md) | 本机 OpenCode CLI/Hub/Edge 合约及历史原生验收存在 |
| AB-F16 节点图 | M01、M08 | alpha.6 实现与 10 组实际鼠标/键盘/持久布局通过 |
| AB-F17 发布 | [M10 报告](modules/10-packaging/test-report.md) | 0.5.0 历史包通过；alpha.6 开发候选已生成并验收，正式 0.6.0 未准出 |

具体 `T-Mxx-xx` 场景、真实测试名称与结果在每个模块报告，整体页不复制所有细节。

## 5. 真实证据基线

| 记录 | 时间/范围 | 结果与限制 |
| --- | --- | --- |
| [I05 验收](iterations/I05/acceptance.md)、[原始真实记录](../artifacts/I05-real.json) | 2026-10-10，Windows + 同宿主 WSL，0.5.0 | 四条 Claude↔OpenCode/WSL Codex 协作链通过；整体 raw status=partial 保留原生失败 |
| [I05 发布包](../artifacts/I05-portable.json) | 0.5.0 普通启动与重开 | 机器、节点、历史保留，无新 Prompt；不是 I06A 新包证据 |
| [I05 UI](../artifacts/I05-ui.json) | 6 项隔离界面检查 | 通过，子回复来自 fixture |
| [I06A SSH UI](../artifacts/I06A-ssh-ui.json) | 5 组隔离界面检查 | 通过，没有真实 SSH/模型调用 |
| [Linux 真实说明](../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md)、[原始报告](../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json) | 2026-10-10，开发机到独立 Linux，密钥认证、OpenCode 2.0.26 | 首次安装连接 77.8s，两轮 succeeded、同 Conversation；断线期间完成和中央重启回读有既有记录 |

Linux JSON 两轮终态只保存 status/summary，脚本用原 conversationId 续聊；本地台账也确认同会话与节点。不能据此独立证明两轮 native Session ID 一致，应在后续验收保留实际对比。

## 6. 未通过 / 未测试不合并

| 场景 | 状态 | 下一证据 |
| --- | --- | --- |
| Windows Codex 原模型账号拒绝 | 历史原生环境限制 | 用户原生账号/配置可用后再验证；Bridge 不替换模型 |
| WSL Codex 原生续聊 list_turns | 历史原生接口失败 | 支持的版本实测同 thread；不能新开伪装续聊 |
| Windows I06A 密码/加密密钥/agent/DPAPI | 未测试全部真实分支 | Windows 程序 + 真实登录/保护/恢复，不仅 mock |
| 新 Windows EXE | 0.6.0-alpha.2 候选主要流程通过 | 代码资源、普通启动/关闭/重开、真实 SSH 及同 Session 已验证；alpha.6 同样实测普通启动/重开；正式 0.6.0 待 6C |
| 无系统 Node 的独立 Linux | 未真实验收 | 私有 Node 安装、运行与原生 CLI 路径 |
| 注销清理 / systemd 用户服务 | 未完整实现/验收 | 对实际服务器策略验证，不能承诺所有 logout 后存活 |
| 事件游标过期补偿 | 已知生产者/消费者字段不一致 | 故障注入 + 快照补偿回归 |
| 停止中央的 GUI 入口 | 候选实测通过 | 设置页明确停止、PID 退出及新窗口恢复均有真实报告 |
| 换主/清主后旧父任务 MCP 查询 | alpha.6 修复，受控反例通过 | 活跃原父原账本可读控；新父/伪造/终态父拒绝 |
| 20 样本状态延迟 p95 / 全退避时序 | 未完成本次测量 | 按 I06 定义保存样本、链路条件与计算 |
| 节点图与图权限保存 | alpha.6 主要验收通过 | 实际端点鼠标/键盘、节点/组拖动、持久布局与原子授权；丢回执只查原 ID |
| 忙时升级与失败回滚 | alpha.12 源码及真实 daemon/process 受控验证通过 | 独立服务器与原生验收见 I06C 收尾 |

## 7. 可复现检查

不调用真实模型的工程检查：

```bash
npm run lint
npm run typecheck
npm test
npm test --prefix desktop
npm run build --prefix desktop
node scripts/check-docs.mjs
```

Node ≥22.13；测试可能启动隔离后台/worker 并调用原生安装 `--version`，不等于纯静态检查。模块报告给出更窄的适当测试入口。

真实模型、SSH 部署与发布包脚本单列在所属模块；使用明确授权的目标与隔离状态，不在文档保存秘密。运行前保存需要保留的历史报告，因为一些旧脚本会覆盖同名 artifact。

## 8. 维护方法

修改模块后更新其完整设计与报告、这里的功能结论、当次迭代和发布状态。新增的测试计划只登记待测，实际执行后保存证据再变更结论。规则见 [开发维护指南](development-guide.md)。

## 网页资料入口验收

新增桌面资料站，使用同一份 Markdown。网页构建、搜索、目录、主题、Mermaid 和引用资源的实际结果在 [M11 报告](modules/11-documentation-portal/test-report.md)维护；不纳入原 43/87 核心测试计数，也不改变 Windows EXE 交付结论。按用户要求不做手机专项验收。

## 当前 6A 候选验收结果

最新候选 0.6.0-alpha.2 的核心 43/43、桌面 88/88 通过，参见 [汇总](../artifacts/I06A-final/summary.json)。真实 Windows 两轮同 native Session、普通关闭、明确停止、重开恢复和普通便携 EXE 通过；Windows 独立 Linux 密码/DPAPI 与加密私钥/agent 隔离协议各自单列，不混用证据。完整准出/环境限制见 [6A 验收](iterations/I06/acceptance.md)。原 43+87 的文档基线是此前快照，不是本轮最终计数。

## Codex 发现修复基线

2026-10-12 / 0.6.0-alpha.3：桌面 **89/89**、失败/跳过 0，见 [TAP](../artifacts/codex-discovery/2026-10-12/desktop-tests.tap)。WSL 真实 Codex 0.161.0 → Claude Code 2.1.296 在隔离受控允许关系下，通过真实 MCP 完成自然语言发现、委派、回读和连接图：[报告](../artifacts/codex-discovery/2026-10-12/native-report.json)。根 TypeScript、桌面类型/Vite 构建、新 Windows 包资源比对通过：[构建](../artifacts/codex-discovery/2026-10-12/package-build.log)、[包校验](../artifacts/codex-discovery/2026-10-12/package.json)。

这是后续修复基线；前述 43/87 和 alpha.2 的 43/88 是各自历史结果。核心未改动部分本次未重跑；原生 Codex resume、生产 profile 升级与全部 SSH/权限/故障流程未重跑，不能因构建和本条真实样本通过宣称全产品重新验收。详情见 [修复交付](iterations/I06/codex-discovery-fix.md)。

alpha.3 普通 Windows EXE 另行真实验证：隔离 profile 启动、冻结 Codex 代码与源码一致、关闭保留后台、重开复用同一后台、requests/delegations=0；通过。[报告](../artifacts/codex-discovery/2026-10-12/portable.json)。没有切换用户现有生产后台或提交新的模型需求。

## SSH 兼容复用修复基线

2026-10-12 / alpha.4：桌面 **93/93**，0 失败/跳过，[TAP](../artifacts/ssh-compatibility/2026-10-12/desktop-tests.tap)。新增 4 项 SSH/SFTP 受控反例，覆盖清单、版本、目录、归属、探测后变化和无写入复用。真实 Windows 使用现有加密凭据核验用户原 alpha.2 独立 Linux 后台，并完成原连接握手、重新发现 OpenCode、核对原 daemonId/PID/current 保持：[只读](../artifacts/ssh-compatibility/2026-10-12/remote-readonly.json)、[真实连接](../artifacts/ssh-compatibility/2026-10-12/remote-connect.json)。没有安装新后台或发送模型需求。

新 Windows portable 构建/资源比对通过，[包校验](../artifacts/ssh-compatibility/2026-10-12/package.json)。旧 alpha.3 发布的真实服务器样本、升级/回滚、完整故障与原生模型专项未重跑；[交付与边界](iterations/I06/ssh-compatible-reuse.md)。核心 43/43 仍是未改动部分的历史基线。


## SSH 恢复错误清理当前基线

2026-10-12 / alpha.5：桌面 **95/95**、lint、根/前端类型及构建、包完整性通过。新增 2 项受控状态恢复测试，覆盖旧版本拒绝撤销及持久化、旧目录成功快照、新 RPC 和主机密钥错误保留、原节点/历史不变。Windows 浏览器当前前端与受控快照 2 项通过，不是实际 SSH 重连。原用户 alpha.4 状态核对只读。核心 43/43 和远端模型/认证均保留先前版本证据，未重跑；[交付与证据](iterations/I06/ssh-error-recovery.md)。


alpha.5 普通 Windows 便携 EXE 的启动/关闭/重开另有实际 3 项通过，[报告](../artifacts/ssh-error-clear/2026-10-12/portable.json)；隔离配置、无模型需求。

## I06B 当前基线

2026-10-12 / alpha.6：本次核心 43/43、桌面 110/110 实际通过，图事务/原父权限/状态投影加入桌面回归；Windows 图 10 组、性能 p95 30.0ms、两条独立 SSH 原生链、普通 EXE 和最终资源核对分别通过；实际计数、UI/性能、包与真实协作完整状态见 [I06B 实施](iterations/I06/graph-implementation.md)。证据层级分别记录，不用受控机器代替独立 SSH，不用模型标记自答代替实际 MCP 工具调用。历史 alpha.2–alpha.5 范围继续保留。


2026-10-13 最终核对：两条最终包独立原生链的 [原请求结果](../artifacts/I06B/2026-10-12/real-resumed.json)通过；反向经历服务退出/同上下文恢复，旧窗口失败保留，未冒充一次新的窗口全链复验。隔离后台/两个空闲原生控制器在任务终态后停止，用户原profile不变。实际界面 10 组、普通无 debug EXE 3 项与最终包资源比对分别通过，自动恢复完整矩阵仍待 I06C。

## alpha.7 当前图优化基线

2026-10-13：桌面 116/116、生产图性能 p95 37.9ms；主角色、方向端点、卡片避让及中键五个区域/重开/unknown 6 组，原图交互 10 组，路由专项 6 项。完整工程计数、60 节点/59 边生产性能、普通 EXE 与摘要见 [当次报告](iterations/I06/graph-usability.md)。本轮无模型需求，核心/真实 SSH 与双向原生链保留 alpha.6 历史范围，不能算 alpha.7 重跑。

## alpha.8 当前拖动修复基线

2026-10-13：原 Windows profile 只读 IPC 证实 alpha.5 方法拒绝，alpha.7 打包窗口实际复现锁定。alpha.8 实际 Electron + 认证生产 IPC/受控旧接口 7 组，生产前端 10+6 组和桌面 116/116 通过；真实窗口与浏览器分别记录，native prompts=0。原 profile 未写入、未重启，SSH/原生模型不重跑。性能、包与普通 EXE 见 [交付](iterations/I06/graph-drag-fix.md)。

## alpha.9 当前节点管理基线

2026-10-13：本次桌面工程 125/125（受控）通过，节点状态/撤权/收据原子提交、原生/授权 unknown、忙碌/离线、原身份恢复、原 IPC 接入约束及写盘失败均有反例。Windows 生产界面的新节点生命周期、旧图交互、实际打包窗口、普通 EXE、性能与资源逐项结果见 [本次验收](iterations/I06/node-management.md)。历史稳定 0.5.0 和真实 alpha.6 原生链仍分别保留，不能扩大为 I06C 准出。

## 当前 I06C alpha.10 基线

2026-10-13 / alpha.10：机器 SSH 连接编辑、确认断开/移除、原身份恢复、已观察历史持久化/阅读及事件游标缺口分页补偿已实现；桌面 136/136、真实本机 TCP SSH/生产 daemon 隔离恢复和 Windows 界面分别通过。完整 I06C、升级回滚和正式 0.6.0 未准出。

- [桌面 TAP](../artifacts/I06C/2026-10-13/desktop-tests.tap)：136/136，包含 10 项新增机器管理合约和 1 项生产 daemon/真实本机 TCP SSH 集成；模块交叉引用不重复计数。
- [构建](../artifacts/I06C/2026-10-13/build.log)、[lint](../artifacts/I06C/2026-10-13/lint.log)、[核心类型检查](../artifacts/I06C/2026-10-13/typecheck.log)：实际执行。根业务代码未改，43/43 仍保留 alpha.6 历史基线。
- [机器界面](../artifacts/I06C/2026-10-13/ui-machines.json)与[图回归](../artifacts/I06C/2026-10-13/ui.json)：Windows 真实输入/中央真实存储、受控宿主；没有真实模型调用。20 受控状态事件 p95 1.85 秒，非独立服务器 LAN 指标。
- 打包窗口、普通 EXE、包内源码/资源、原始失败与未测项均以 [I06C 首批](iterations/I06/machine-management.md)实际记录为准。完整 I06C 仍未准出。

## GitHub 下载分发核验

2026-10-13：alpha.9 Windows x64 EXE 已作为 GitHub 预发布附件提供，[下载程序](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.9/AgentBridge-0.6.0-alpha.9-Windows-x64.exe)、[发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.9)。用户无需自行编译或安装 WSL/Node.js 来运行 AgentBridge。稳定历史版本仍为 0.5.0；这次发布不代表完整 I06C 或正式 0.6.0 准出，也没有将本地 alpha.10 源码/程序同步到该标签。

M10 的 T-M10-25 仅记录真实上传、附件大小/摘要与公开发布状态；不增加模型、SSH 或 Windows 普通 EXE 的重测数量。历史 alpha.9 包证据与本次源码同步的沙箱失败分别保留，详见 [本次分发](iterations/I06/github-release.md)。

## 当前 alpha.13 收尾状态

alpha.13 已实现后台可信升级/回滚/停止/卸载、原维护恢复、控制收据校验与敏感表单脱敏。桌面 150/150、维护 7 项与源码/包一致性通过；独立 Linux 原生链和最终准出仍按 [I06C 收尾](iterations/I06/final-delivery.md) 的实际证据更新。 历史发布和各次原生证据保留原日期，候选包构建不等于正式发布。

## 2026-10-14：SSH 上传失败诊断与安装入口恢复

AB-F06/F17，M01/M04/M10：alpha.14 区分安全的 SFTP 失败类别、按实际 ACK 字节计进度并等待关闭确认；明确上传失败后可重新检测和批准原安装，unknown 不显示重装入口。桌面 155/155、上传专项 5/5（含本机真实 TCP SSH/SFTP）和 Windows 受控响应界面 2 组通过。用户另一台机器到原服务器未重测；本次不自动改变 GitHub alpha.9 附件或完整 I06C 准出。包与 EXE 的分层实际结果见 [alpha.14 上传诊断与恢复](iterations/I06/ssh-upload-recovery.md)。

## alpha.16 本次工程与实机恢复

2026-10-14，WSL Ubuntu / Node 22.23.1：桌面 163/163、其中 SSH 7/7 通过，合成凭据/受控远端维护，不等于原生模型验收。alpha.15 发布提交的工程结果保留 159/159。当前实机与程序分层结果、实际修复前失败和原 unknown 任务边界见 [完整增量验收](iterations/I06/maintenance-launch-recovery.md)。

当前 alpha.17 工程 164/164，包含校验结果复用后清单篡改拒绝。服务器原链冻结 alpha.16，工程与实机结果分版本；详见 [本次增量](iterations/I06/maintenance-launch-recovery.md)。

2026-10-14 最终：冻结 alpha.16 独立空闲维护全链通过，模型 0；alpha.17 工程 164/164、最终 EXE 包与普通启动/关闭/重开通过。原文件任务绑定保留、unknown 未解除，完整 I06C 未准出。见 [当前最终分层验收](iterations/I06/maintenance-launch-recovery.md)。

## alpha.18 Windows 运行缓存与原提交恢复

I06-FIX-RUNTIME-01 / AB-F07/11/17：排除共享缓存清单自引用，兼容旧清单，保留损坏副本；核对原未派发意图恢复旧 unknown，不重发需求；查询显示结果和固定原因。桌面 176/176、根 43/43 及类型/构建/lint 已通过；Windows 与最终包的实际结果、命令和未测范围以 [专项交付](iterations/I06/runtime-recovery.md) 为准，完整 I06C 未准出。

当前 alpha.18 已以 GitHub prerelease 分发：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/AgentBridge-0.6.0-alpha.18-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/SHA256SUMS.txt)、[源码 PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。源码标签绑定 `1f0d9ef`，独立分支未合入 master；分发只证明对应附件核验，不扩大为完整 I06C 准出。详见 [发布记录](iterations/I06/github-release.md)。

## alpha.19 Linux CLI 发现修复

I06-FIX-DISCOVERY-01 / AB-F02/07/17：补充非交互 Linux daemon 的常见用户态安装目录，PATH 优先/坏候选回退及 Windows npm 发现保留。发现回归 6/6；真实 Codex 0.162.1 经生产 daemon/本机隔离 TCP SSH 版本发现通过，模型 0；用户独立 Ubuntu 未更新或实测。完整工程、当前包、使用步骤和范围见 [专项](iterations/I06/linux-cli-discovery.md)。

## alpha.19 OpenCode 二次发现与 Windows 配置写入

I06-FIX-DISCOVERY-02 / AB-F02/07/17：共享扫描核验原安装，不替换已删除/损坏路径；Windows Core 配置使用可写句柄刷新/原子替换，Linux目录刷新保留。核心45/45、桌面181/181及Windows隔离PE/进程6组通过；模型0，用户另一台电脑未实测。与LinuxCLI修复统一候选/包校验，完整I06C未准出，最终发布事实见合并交付。详见 [需求/实现/验收](iterations/I06/opencode-discovery.md)。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

当前 alpha.19 已以 GitHub prerelease 分发：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/AgentBridge-0.6.0-alpha.19-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/SHA256SUMS.txt)、[源码PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。包含 Linux Codex 发现与 OpenCode 二次检查/Windows配置保存修复；源码标签绑定 `fce41be`，尚未合入master。远端需“后台维护→升级后台”后重扫。核心45/45、桌面181/181，包内Linux真实版本探测、Windows受控6组/普通EXE4组通过；未实测用户服务器/Windows原生推理，完整I06C未准出。


## 未确认操作资源范围（未发布源码）

2026-10-15 / alpha.19工作区修复：桌面188/188、定向40/40（包含在全量内）、桌面类型/构建通过，Windows Edge生产前端与受控API4组通过，模型0。独立节点可工作，同节点/共享目录和未知来源继续保护；准备拒绝与原意图严格对账。不更新GitHub alpha.19附件，未构建新EXE、未复测用户故障或服务器，I06C未准出。[专项及原始证据](iterations/I06/pending-isolation.md)。


alpha.20已公开分发：核心45/45、桌面串行188/188、包校验、普通Windows EXE/合成原记录4组、Edge受控4组通过；公开HTTP200且完整下载EXE摘要匹配。初次并行维护测试失败和复验保留。分发不替代原生/用户故障验收。[完整专项](iterations/I06/pending-isolation.md)。
