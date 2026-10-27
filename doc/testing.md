# 整体测试与验收报告

alpha.66源码补齐Linux Hermes安装发现：原生数据目录bin、独立HERMES_INSTALL_DIR、固定Profile所属根与默认根、后缀/路径展开；Hermes专用运行时目录不再用于发现其他Agent。PATH原命令优先，原生模型/配置/Session与unknown不变。Windows受控Hermes39/39，Linux原生CI验证进行中；当前公开仍alpha.65。[本轮范围与证据](iterations/I08/alpha66-hermes-linux.md)。

当前公开alpha.65补齐Windows已安装Hermes：扫描原生bin目录、20秒有界版本探测，stream-json不再传网关拒绝的旧参数；原Session续聊、退出不等于取消、缺终态保留unknown。Hermes的Bridge取消能力明确false，原生MCP独立保留。真实安装0.22.5的首轮及同Session续聊、包内原生MCP十工具已分层验证；[完整证据、失败和边界](iterations/I08/alpha65-hermes-windows.md)。当前包已公开，继承能力与未准出边界按下表。

当前公开alpha.65的Hermes定向31/31，扩展源码73项72通过/1个原Pi失败，Core16项13通过/3个原失败，docs:test5/6同基线；正式安装版执行/同Session续聊、冻结Windows MCP五组与普通EXE同profile补验通过。首次旧参数、心跳EPERM原unknown和包装进程30秒等待失败保留，未改写完整矩阵；[本轮完整证据](iterations/I08/alpha65-hermes-windows.md)。

alpha.63 [原生MCP生命周期补验](iterations/I08/native-mcp-lifecycle.md)：普通无调试EXE与原版Pi客户端七组通过，三个实际解包目录关闭后删除，原传输/原身份/完整接收收据保持；最后原窗/客户端/Coordinator均确认退出。实际WSL十五分钟180/180及删除/重开/撤权/轮换六组也已通过，两个客户端/原宿主退出且残留0。模型0，其他入口/跨版本升级/托管父模型、WSL冷启动/历史故障与整体MCP02继续未准出。

公开alpha.63已交付CT-05原包传递、目标接入收据和桌面只读审计：源码944/944、Core71/71；冻结Windows传递14/14、原收据4/4、关系37/37、兼容26/26，生产页面新5组/控制台6组、普通EXE6组通过，模型0。Pi→固定源码Hermes实际原生MCP组件7组通过；接收声明不代表模型理解、业务验收或文件可达，完整准出不变。[完整证据与边界](iterations/I07/context-delivery.md)。

alpha.62普通窗口生命周期五组与真实驱动退出码0已补验：旧脚本后续误选同进程无标题辅助窗，现绑定原主窗口并在关闭前核对归属/标题；三次正常关闭均原进程退出、包装码0，产品和EXE字节未改。未切换日常后台，模型0。[定位、修复与当前边界](iterations/I08/window-lifecycle-verifier.md)。

2026-10-25冻结alpha.62已完成原实际SSH只读复验：保存凭据/主机指纹认证、alpha.37原清单1459项逐文件核对、两次非接管inspect三组通过，原PID/current.json/本地配置保持，模型0；未部署、hello或任务。完整故障/升级矩阵与普通EXE联合流程仍未准出。[当前证据](iterations/I08/alpha62-ssh-readonly.md)。

本地alpha.62保留已失败管理操作清理，将实际桌面入口收敛为接入/小队设置、执行/会话审计和原操作恢复；日常提交、续聊、分工、报告、正文编辑与验收从原生Agent的MCP入口完成。小队收据补原operationId和完整内容指纹，丢回应、损坏或并发变化的本机意图只读核对，不换ID重发。源码Core71/71、桌面928/928、Windows生产页面6组通过，模型0，公开alpha.60不变；普通EXE正常关闭/重开与完整中央重启五组已补验，原收据保持；[实现、分层验证与交付](iterations/I07/configuration-console.md)。

WSL当前补验（2026-10-25）：公开alpha.60冻结HostConnection独立启动20/20，60条只读请求均在握手后发送、原进程退出已确认，模型0；但原始80次WSL探针仍有1次首条Linux入口标记前失败。没有产品修复可解释差异，发行版冷启动/持续连接/故障恢复与整体稳定性仍未准出；普通EXE图观察因窗口运行时拒绝WSL工作目录未执行。[本轮定位、全部样本与边界](iterations/I08/wsl-launch-origin.md)。

公开alpha.60的十工具已完成原生客户端组件复验：Pi1.4.0在Linux/Windows、固定源码Hermes在Linux各7组通过，包含实际连接/断开、用户允许/拒绝、原ID/历史确认和缓存撤权，模型0。真实父模型、日常多主、托管scope和跨真实机器仍未准出。[当前证据与完整边界](iterations/I08/native-policy-components.md)。

alpha.56冻结包图管线诊断（2026-10-24）：默认渲染含tracing的完整20条PNG p95 363.722ms未达100ms，本地同步p95 1556ms通过；GPU提交停顿与部分慢样本重叠，软件渲染诊断仍112.902ms失败，不能据此关闭产品GPU或宣告准出。[本轮证据与限制](iterations/I06/alpha56-graph-pipeline.md)。

当前冻结alpha.56客户端已对原独立SSH服务器完成只读复验：实际daemon为alpha.37，原凭据/主机指纹认证、生产逐文件核验、两次非接管inspect通过；原daemon身份/PID、远端入口与本地连接配置保持，模型0。完整故障/升级矩阵与普通EXE联合流程仍未准出。[实际证据与边界](iterations/I08/current-ssh-readonly.md)。

公开**alpha.60**实现CT-08-A3连接管理：各主在用户预授权内自行连接/断开，范围外请求须用户明确确认；原ID/unknown和原父读控保持。源码900/900、Windows包内37/37与实际中央管道/重启、兼容26/26、生产页面4组、普通EXE4组及Downloads SHA通过，模型0；[本片证据](iterations/I07/connection-policy.md)、[发布核验](iterations/I08/alpha60-release.md)。旧图仍编辑selected，完整真实原生多主/图100ms/WSL及SSH仍未准出；未切换日常后台/未部署SSH。

alpha.53冻结包补验：自动保存画布位移0px通过；完整20次PNG帧观测p95 388.932ms未满足100ms，本地20次状态同步p95 1504ms通过，未出现longtask。生产包资源一致性通过；不代表普通EXE窗口、独立LAN/SSH或物理显示器首帧准出。[原始报告与边界](iterations/I06/alpha53-current-metrics.md)。

alpha.53历史交付修复 #21：核心71/71、桌面844/844、启动专项9/9、Windows生产前端2组、普通EXE6组与包源码一致性通过，类型/lint/文档检查通过，用户站6/6及构建通过，模型0；原 unknown/安装/上下文保留。最终启动专项、包/普通EXE与工程检查按[本轮分层记录](iterations/I08/opencode-bounded-probe.md)登记，现场WindowsApps1.2.22及真实模型未复验，完整准出不变。

当前公开预发布 **0.6.0-alpha.65**，标签冻结 `47cba61`；EXE 132222581字节、SHA-256 `271c7e2884ad4b1e14f268687285723cc67cd3d9d7dadff17ff00e1f9e8d0ba9`。210个产品/依赖输入保持，源码、EXE与校验文件已公开，匿名HTTP200完整下载字节/摘要匹配。Hermes定向31/31，原生执行/同Session续聊两轮、冻结Windows原生MCP五组及普通EXE原profile补验通过。未签名、未切换日常后台、未部署SSH；Hermes网关取消/父模型自主MCP、图100ms、冷启动与完整矩阵继续未准出。 [完整发布证据](iterations/I08/alpha65-hermes-windows.md)。

连接身份/节点管理修复已在公开 alpha.46 基线上完成隔离桌面回归 777/777，Windows 生产前端 10 组受控交互通过，原始三项故障在未修复基线上均复现。当前工作目录集成桌面817/817、核心68/68、Windows契约55/55及最终普通EXE5组通过，模型0；集成包验证单独记录，不把受控 IPC/临时配置结果当成真实 DSH/OpenDesk 或模型验收。[证据与边界](iterations/I08/connection-identity-node-scope.md)。

原生现场历史证据（alpha.46）：已安装OpenDesk/DSH原生MCP组件正式授权、撤权和恢复通过；两条生产协作链各完成1个真实Claude子任务，原观察器重开保持原Session与请求，不重放。OpenDesk 日常原生父模型只读发现已通过，实际 list_agents 返回 7 个获准节点；[原生发现证据](iterations/I08/opendesk-mcp-diagnostic-repair.md)。父模型自主委派与原生页面仍未验；[组件层级与原始证据](iterations/I08/mcp-native-acceptance.md)。

alpha.46历史验证（2026-10-22）：WSL Node22.23.1根全量68/68、桌面758/758；最终JSON脱敏修复后CLI相关11/11、类型/lint/核心构建通过。已公开EXE130180760字节、SHA-256 `57f1af73f761af72d75121284b023a001dad05eb30c0c197e18851cc9a7e8c48`；包核验50后台模块/84核心文件/1698 Linux文件及四项一致性通过。Windows普通EXE、非GUI与生产前端的实际结果单列于[本轮专项](iterations/I08/mcp-open-recovery.md)，不将模拟、端点工具调用或历史原生模型混记为真实主Agent委派。未签名、已公开、未部署SSH；冻结提交9766eb4，匿名完整下载核验通过，[当前发布证据](iterations/I08/alpha46-release.md)。

OpenDesk Desktop0.3.9已有真实执行/续聊与诊断MCP列表可见记录；DSH Web/CLI显式profile已有受控原生握手/7工具记录。正式原生授权调用、十入口人工增删与主调用/托管归属仍未全部完成。历史候选与各次计数保留于[迭代目录](iterations/README.md)。

真实DSH认证/接口、原Session两轮/去重与Desktop模型RATE_LIMIT的证据保留在[DSH专项](iterations/I07/dsh-exe-delivery.md)，本轮没有重测真实模型。CT-07连接视图的18项受控协议验证、此前列表与恢复候选的专项记录保留在[迭代目录](iterations/README.md)，不能将原计数相加成当前新测试数。

机器/节点、原生适配、任务会话与本机协作已有可运行实现；I06A SSH 核心路径有真实服务器记录；I06B 图/授权/独立双向链已验收；I06C 维护收尾已交付，完整故障与升级指标仍有明确覆盖边界，整个 I06 不能标记完成。

真实连接证据：WSL 三工具（Claude/Codex/OpenCode）真实直接生命周期与全部六个普通委派方向通过；三独立 Claude 宿主公共文档链五次自动原生回合通过。Hermes/Pi/DSH 及 DSH Desktop/Web 为受控证据，真实工具执行验收见[接入矩阵](agent-integration-matrix.md)。

“全部自动测试通过”只对应指定测试集，不代表每个账号、原生版本或发布物全部可用。

## 2. 资料整理时的历史持久基线

下表保留早期资料整理的 87/43 基线与原路径，作为文档检查的持久对照；各轮实际计数见对应迭代专项，不能将旧表冒充当前源码重新运行。

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
| AB-F03 节点接入 | [M01 报告](modules/01-desktop/test-report.md)、M03 | 0.5.0 空格多选保留历史；节点动作接入与目标选择实测通过 |
| AB-F04/05 SSH 与凭据 | [M04 报告](modules/04-ssh-access/test-report.md) | 密钥真实路径有记录；Windows 密码/DPAPI 与实际加密密钥/隔离 agent 通过；系统服务全兼容未测 |
| AB-F06 安装与后台 | [M04](modules/04-ssh-access/test-report.md)、[M05](modules/05-linux-daemon/test-report.md) | 有系统 Node 的真实 Linux 安装通过；无 Node 实环境待测 |
| AB-F07 原生执行 | [M06 报告](modules/06-native-adapters/test-report.md)及三个子报告 | Claude/OpenCode 有真实记录；Codex 账号/原生续接限制保留；Hermes/Pi/DSH 受控 |
| AB-F08 会话 | [M07 报告](modules/07-task-session/test-report.md)与 M06 | 同会话续聊有证据；Windows SSH 两轮已有原生 Session ID 对比 |
| AB-F09 过程与回答 | [M01](modules/01-desktop/test-report.md)、M06 | 输出来源与聚合有实现/模拟证据；不是统一 token push |
| AB-F10 原生控制 | M06、M07 | 受控控制通过；各工具表单/许可能力不同 |
| AB-F11 原请求与恢复 | [M07](modules/07-task-session/test-report.md)、[M02](modules/02-coordinator/test-report.md)、M05 | 去重/unknown 保护有回归；游标过期补偿已实现 |
| AB-F12/13 关系与协作 | [M08 报告](modules/08-collaboration/test-report.md) | 四条 Windows/WSL 真实链；原父权限反例与独立 SSH 双向核心链通过 |
| AB-F14 常驻中央 | [M02 报告](modules/02-coordinator/test-report.md) | 受控与 Linux 开发环境重启证据；普通 Windows EXE 生命周期实测通过 |
| AB-F15 CLI | [M09 报告](modules/09-cli-hub-edge/test-report.md) | 本机 OpenCode CLI/Hub/Edge 合约及历史原生验收存在 |
| AB-F16 节点图 | M01、M08 | 实现与 10 组实际鼠标/键盘/持久布局通过 |
| AB-F17 发布 | [M10 报告](modules/10-packaging/test-report.md) | 0.5.0 历史包通过；开发候选已生成并验收，正式 0.6.0 未准出 |

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
| 无系统 Node 的独立 Linux | 未真实验收 | 私有 Node 安装、运行与原生 CLI 路径 |
| 注销清理 / systemd 用户服务 | 未完整实现/验收 | 对实际服务器策略验证，不能承诺所有 logout 后存活 |
| 20 样本状态延迟 p95 / 全退避时序 | 未完成本次测量 | 按 I06 定义保存样本、链路条件与计算 |
| 忙时升级与失败回滚 | 源码及真实 daemon/process 受控验证通过 | 独立服务器与原生验收见 I06C 收尾 |
| Hermes/Pi/DSH 真实工具执行 | 源码已实现，仅受控证据 | 真实安装环境执行与被委派验收（I07C 收尾） |
| DSH Desktop/Web 原实例 | 受控服务验证 | 连接用户原服务后的真实推理/续聊/取消验证 |

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

桌面资料站仅发布 `doc/user/` 用户Markdown；内部报告/历史/过程不参与路由、搜索和资源导出。网页构建、发布边界、搜索、目录、DSH章节、接入摘要、主题与Mermaid的实际结果在 [M11 报告](modules/11-documentation-portal/test-report.md)维护；不纳入核心测试计数，也不改变 Windows EXE 交付结论。按用户要求不做手机专项验收。
