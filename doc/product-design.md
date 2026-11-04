# AgentBridge 整体功能设计

alpha.73 在桌面本机「添加 Agent」提供 Hermes 自定义运行时。用户选择基础类型，填写显示名、命令和可选描述，版本探测通过后可添加并接入。运行时身份与内置 Hermes 独立，仍需既有授权。[自定义运行时记录](iterations/I08/custom-runtime-design.md)

当前公开预发布alpha.72已收录冻结fd450ce的源码实现；实际EXE/资源、分层测试及未准出范围见[本次交付](iterations/I08/alpha72-release.md)。不因打包发布关闭未完成的原生模型、完整生命周期、已有服务或跨机目标。

生命周期边界按实际入口区分：关闭调用方/观察门面不自动取消Task；明确停止Core Controller可停止经核验的自有托管服务，外部服务及用户原生Session不因此转归Bridge。IPC/PID消失不结算终态或释放unknown。[资源归属表](iterations/I08/interconnect-caller-contract.md#资源归属与停止范围)已与源码核对，真实在途/服务完整链/升级仍待验证，[完整决策审计](iterations/I08/interconnect-development.md#16-当前源码与完整决策的完成审计)。

M06-OC-F01 / M09-F01：OpenCode连接check复用同次协议握手的Agent信息；执行使用独立客户端，原任务观察及回复/取消按原nativeProtocol绑定客户端，健康检查不能改写其API选择。失败发现使缓存失效，协议不匹配仍拒绝；控制收据与任务终态保持分层。managed=false已有服务仍归外部操作者，低层原Controller/Client有真实1.2.10只读连接和关闭/重开证据；互联登记完整链仍待。[当前开发与验证](iterations/I08/interconnect-development.md#15-原任务协议与健康检查并发停止后的资源释放)。

未发布源码补齐无taskId恢复：list_delegations取得原delegationId后，task_result仅查询原机器/原请求并关联原Task；不经新委派或上下文准备，目标新派发授权撤销后原属主仍按当前result权限查询。缺记录保留unknown，确定准备拒绝是调用拒绝而非Task终态。经典仍十工具，旧后台须task.original-request-v1能力；[完整契约](iterations/I08/interconnect-caller-contract.md)。

## 产品职责与当前后续范围

AgentBridge 管理谁能调用哪个 Agent，以及一次调用如何可靠交付和核对。核心是身份/获准发现、授权/寻址、明确目标调用、消息/状态/结果关联、交互控制、资源准入与原 ID 恢复。任务拆分、目标选择、业务规划和业务验收由用户或上层 Agent 决定；原生 Runtime 拥有 Session 内部行为、Agent Loop、工具、模型与执行权限。

AB-F19 的身份/职责登记继续保留；其小队/工作容器及 AB-F20/21/22 的公共空间、依赖/复验/返修/业务验收、事件激活与自动续接定位为可选上层，暂停扩张，不作为基础发现/委派或外部 Super-agent 接入前提。已有接口、数据、授权和在途执行保持，不因定位调整删除或迁移。MachineHost、daemon、必要 worker、SSH 受控部署维护、Session/取消控制及配置/审计属于互联基础设施，继续保留。

独立登记第一片已源码实现：复用原Agent登记/SQLite收据及固定端点，不要求小队；经典仍十工具，停用不释放unknown、不重绑原任务。调用方/上下文/凭据、原事件与原delegationId恢复已有源码与受控证据。Windows Codex主对话经真实stdio MCP调用WSL Codex0.166.0，继承用户明确选择的原生默认gpt-6.1-sol；原主CallerContext/Conversation/Native Session保持。真实正文、无工具回忆续聊及执行中观察器关闭/重开后的原结果均通过，另验原取消unknown→原操作confirmed→Task实际cancelled。独立上下文执行中撤销后读权立即拒绝，管理员观察原生任务仍成功完成。本轮仅调整经用户授权的本机原生模型及CLI安装、扩展真实验收夹具，不增加Bridge模型API或修改持久协议。完整已有服务登记/升级链、真实丢提交回应、原生权限/问题转交、产物实体交付、完整适配器/跨机/性能、生产SSH与EXE仍未准出；公开基线现为alpha.72，本文原生与矩阵证据不扩张。[本轮真实证据与限制](iterations/I08/interconnect-development.md#17-原生登录恢复后的真实调用与模型退役门禁)。

当前未发布源码的桌面界面删减五页、侧栏及配置弹窗中的重复说明；连接策略使用独立弹窗、统一分组标题，历史授权按需展开。原生Agent配置采用摘要、四项状态、路径、折叠高级设置与固定底栏，六操作按状态分配；服务端工具目录不作为原生接入成功证据。小队工作表单按前置条件显示，后续工作流暂停扩张。关联AB-F01/09/12/16、M01-F02/F04/F06/F14，原授权与恢复契约保持。[整体界面整理](iterations/I08/ui-cleanup.md)、[原生配置弹窗与验收](iterations/I08/mcp-configuration-ui.md)。

最新本地Windows体验包为0.6.0-alpha.71.browser.3，包含当前ChatGPT-only 19文件扩展及最新后台，源码/实际EXE载荷/ASAR核验和包内Node契约72/72通过；普通GUI、包内真实Web与原生父模型仍未准出。仅用户体验交付，公开基线现为alpha.72，本文原生与矩阵证据不扩张。[产物、非C盘启动及完整证据](iterations/I08/web-agent-browser3-preview.md)。

当前Web范围仅ChatGPT：真实匿名ChatGPT经原MCP/Registry/Router/认证MV3同会话四轮通过，第四轮8次输出/2295字符；父模型是受控夹具。新版DOM及只读原结束失败结算已实现，原第二轮失败与恢复边界保留；DOM39/39、IndexedDB69/69、Host/打包63/63，网络回归44通过/1平台跳过。原生父模型、账号/权限同意、跨设备及当前包内Web链路仍待，Kimi不开发不验收，公开基线现为alpha.72，本文原生与矩阵证据不扩张。[当前实现、产物与原始证据](iterations/I08/web-agent-live-chatgpt.md)。


Browser Agent正在开发：AB-F03/F07/F08/F09/F10/F11复用原Registry/机器/节点、认证配对、原MCP续聊、配置/修订UI、只读核对、空闲关闭、原会话健康、未授权页面内容的安全取消、MCP原取消只读恢复、可见对话证明/同锚点冲突门禁及取消后缺请求行的原健康/关闭恢复。取消须原持久封存证明和事件齐备，普通ACK不够；旧后台未证明queryOnly支持时拒绝发送，已提交Stop仍不支持。健康不证明账号或放行unknown；人工新轮在发送前拒绝。Windows MV3/IndexedDB/DOM及Linux Node分层受控，扩大集的快照截止失败保留。真实账号/权限同意/父模型/Browser跨设备/完整控制及真实包内Web链路仍待，公开基线现为alpha.72，本文原生与矩阵证据不扩张。[当前证据与余项](iterations/I08/web-agent-development.md)。

alpha.71的SSH维护只读入口始终可打开查看；具体替换/升级仍核对原操作与远端门禁。[入口与实际EXE验证](iterations/I08/issue29-maintenance-entry.md)。


alpha.71已修复#29的维护入口闭锁：未登记后台仍不直接复用，但版本拒绝的离线机器可以打开维护，明确确认后替换为客户端自带的已校验后台。原身份、状态、收据与旧目录保留；不自动运行未校验旧版本回滚。[行为、实际验证与边界](iterations/I08/issue29-explicit-daemon-replacement.md)。


当前公开alpha.71：SSH维护只读入口在离线、任务忙和unknown时仍可打开，明确确认后可替换未登记后台；实际写入门禁和原ID保留。源码/EXE/SHA公开，匿名完整下载匹配。Windows扩展147通过/1平台跳过、包内兼容26/26；独立Ubuntu Core79/79、适配111/111、关系/SSH98/98、替换/入口105/105。实际包内UI与普通portable启动/关窗分层验证；历史Windows全量DSH竞态1失败/41跳过、文档2243缺失和依赖high1保留，真实profile/生产SSH/完整矩阵及性能未准出。[完整交付](iterations/I08/alpha71-release.md)。

关系缩权与清空不重新准入旧节点；新增/换主仅检查新目标，无关unknown不全局阻塞。未确认执行继续按原ID查询；“清理已失败操作”只结算有完整证据的确定失败，保留历史。MCP配置、原生加载、连接、工具、授权和归属分别展示；直接配置与托管scope能力独立，桌面保留配置/审计及原执行恢复，日常协作由原生Agent发起。模块与[接入矩阵](agent-integration-matrix.md)限定各入口实际能力，历史见[迭代目录](iterations/README.md)。

当前源码的桌面外观按Taste/Impeccable采用浅色框架、白色工作面板及中性深色主题；统计为数字栏，机器/工具信息优先，设置按说明与操作分段，字体本地离线加载。关联AB-F01/09/16及M01-F14，已进入公开alpha.68的EXE；原生接入、授权、原ID恢复与业务状态口径保持。[当前设计、验收与源码](iterations/I08/taste-impeccable-ui.md)。

源码界面预览新增仓库根双击启动器和 `npm run desktop:preview`：先构建再提供本机合成预览，终端保持开启才可访问。该开发入口未修改公开alpha.68的包或业务协议。[启动与验证](iterations/I08/taste-impeccable-ui.md#预览入口修复2026-10-28)。

## 1. 产品解决什么问题

用户已经在不同机器上安装并配置了自己的 Agent。当前源码的原生/桌面/服务接入有七种产品、十个执行入口；另有开发验收中的ChatGPT Web被动入口，尚不计入已准出支持。原有入口为：Claude Code、OpenCode、Codex、Hermes、Pi、DSH CLI（原生 CLI），以及DSH Windows Desktop与Linux/WSL Web、OpenDesk CLI HTTP与Windows Desktop设备网关。Hermes/Pi/DSH 为源码已实现，真实工具执行验收以[接入矩阵](agent-integration-matrix.md)为准。AgentBridge 把这些工具呈现为可观察的 Agent 节点，用户从原生Agent提出需求，在Bridge配置接入与授权、看进度和读取结果；权限与协作能力按工具分别声明。

中央后台管理连接与消息，不作为主 Agent 推理。当前主角色按原生 MCP 调用能力及既有身份/关系准入，由用户指定；只能通过受限协作接口发现、委派和查询获准目标，不以固定产品名单代替能力判断。各入口实际证据见接入矩阵；通用外部调用方身份契约仍待实现。

用户不用在 AgentBridge 重新配置模型、供应商或模型 API Key。账号、模型、工具权限与原生运行环境由各 Agent 自己管理。

## 2. 用户面对的对象

| 对象 | 用普通话解释 | 示例 |
| --- | --- | --- |
| 机器 / 执行环境 | 能访问某个用户安装工具与文件的地方 | Windows、Windows 下的 WSL Ubuntu、SSH 接入的 Linux 用户环境 |
| Agent 节点 | 某个环境中的一个受支持工具安装 | Windows 上的 Claude Code、Linux 上的 OpenCode |
| 执行上下文 | 为具体任务保存目录、运行配置与执行记录的内部实例 | 本轮在 Linux 的 `/srv/project` 执行 |
| 会话 | 与同一个 Agent 连续讨论同一项需求 | 分析 → 修改 → 解释测试结果 |
| 任务 | 会话中的一次请求与执行 | “分析当前目录”这一轮 |
| 协作关系 | 每个主节点及其获准出站成员，旧图显示selected关系 | Claude 为主，OpenCode 为子 |

节点不绑定文件夹，不绑定模型。目录在发送具体需求时才指定；不需要操作已有文件时可以留空，后台使用该节点的默认执行目录。同一节点、目录与模式会复用上下文，新会话不保证文件目录相互隔离。

WSL 是单独的执行环境，但属于同一台物理 Windows 宿主。SSH 机器身份按远端登录用户与 Bridge profile 绑定，不能把两个不同用户误合并为同一个可授权身份。完整对象定义见 [数据模型](data-model.md)。

## 3. 完整功能目录

当前公开alpha.68已包含的原生保护：

| 功能 | 当前行为 | 设计与证据 |
| --- | --- | --- |
| AB-F07/F10/F11 启动失败 | Hermes/Pi/DSH所选启动进程明确未启动时，以失败结束原请求，控制收据注明nativeExited=false；已启动失联/历史unknown不据此清理 | [启动边界](iterations/I08/native-start-boundary.md) |
| AB-F08/F11 Pi续聊 | 唯一原Session文件cwd与原上下文须为同一可用真实目录，否则意图/派发前拒绝；历史与unknown保持 | [目录绑定](iterations/I08/pi-session-workspace.md) |
| AB-F10/F11 Hermes分离 | 查看器退出3/130保持原unknown与占用；原生等待回复、网关恢复与取消仍未适配 | [分离保护](iterations/I08/hermes-detached-input.md) |

`AB-Fxx` 是整体功能编号；模块内使用 `Mxx-Fxx` 等细化编号，测试报告再映射实际用例。整体状态不能代替具体工具能力与环境验证。

| 功能 | 用户得到什么 | 当前状态 | 模块与验收 |
| --- | --- | --- | --- |
| AB-F01 机器概览 | 首先看到机器，再看到机器上的工具；没有项目也能查看 | 本机 Windows/WSL 已发布；SSH 编辑/断开/移除/恢复专项通过，历史和身份保留；维护被拒的离线机器直接显示远端原因与重连入口 | [M03](modules/03-machine-network/design.md) / [报告](modules/03-machine-network/test-report.md) |
| AB-F02 自动发现工具 | 扫描受支持安装位置，显示名称、版本、健康与安装位置 | 当前源码注册七种产品十个入口；排除同名 Distributed Shell，DSH Desktop 安装与 Linux Web profile 未配置时显示服务连接提示；扫描不调用模型，SSH 须更新实际远端 daemon；每个入口分别声明“可执行/可被委派/可调用MCP/可管理原生MCP配置/可注入托管scope”，不再用单一`teamCollaboration`代替 | [M03](modules/03-machine-network/design.md) / [报告](modules/03-machine-network/test-report.md) |
| AB-F03 接入节点 | 图节点动作接入；不要求项目、模型和供应商 | 0.5.0 多选已发布；支持按机器添加、断开、移除及原身份恢复 | [M01](modules/01-desktop/design.md) / [报告](modules/01-desktop/test-report.md) |
| AB-F04 SSH 添加 Linux | 输入地址、端口、用户名和已有 SSH 登录方式 | 源码已实现；Windows 密码与真实 Linux 接入通过；其他认证专项范围见 M04 报告 | [M04](modules/04-ssh-access/design.md) / [报告](modules/04-ssh-access/test-report.md) |
| AB-F05 主机信任与凭据 | 首次确认指纹；默认不保存秘密；可选 Windows 系统加密保存 | 源码与受控测试存在；Windows 密码/DPAPI 及加密私钥/隔离 agent 有实际证据；系统服务兼容专项保留 | [M04](modules/04-ssh-access/design.md) / [报告](modules/04-ssh-access/test-report.md) |
| AB-F06 远端后台部署 | 用户确认安装摘要后自动部署用户态 daemon；无需第二终端 | 历史真实 Linux 验收保留；上传阶段/错误类别和明确失败后的重新检测入口已实现，保持原安装 ID；维护被拒但原后台仍在运行/已恢复时不再留置离线；新增**显式确认后越过未确认收据**（任务/Agent 门禁永不可越过，越过记录写入终态收据） | [M04](modules/04-ssh-access/design.md)、[M05](modules/05-linux-daemon/design.md) |
| AB-F07 原生工具执行 | 沿用工具原有账号与配置，执行真实需求 | Windows Hermes0.22.5已验首轮与原Session续聊；网关取消未适配、失联保留unknown。OpenCode/Claude/Codex及Pi/DSH的其他入口按[矩阵](agent-integration-matrix.md)分层核对，安装/配置不等于模型可用 | [M06](modules/06-native-adapters/design.md) / [报告](modules/06-native-adapters/test-report.md) |
| AB-F08 新会话与续聊 | 从原生Agent发起需求与续聊，每轮独立记录 | alpha.62桌面只读审计；原生/CLI适配能力与旧Task/Session保留，公开alpha.60仍有旧日常表单 | [M07](modules/07-task-session/design.md) / [报告](modules/07-task-session/test-report.md) |
| AB-F09 进度、回答与看板 | 看来源、状态、本轮回答、工具过程与最终结果 | 已发布；窗口通过轮询刷新，不是直接订阅原生 token | [M01](modules/01-desktop/design.md)、[M06](modules/06-native-adapters/design.md) |
| AB-F10 权限、输入与取消 | 通过原任务处理原生等待；取消结果以原生确认判断 | 严格核对原控制收据、表单遮罩及恢复台账脱敏；原生支持范围分别记录 | [M06](modules/06-native-adapters/design.md)、[M07](modules/07-task-session/design.md) |
| AB-F11 未确认请求与恢复 | 原 ID 查询，不重发 Prompt；保留历史和占位 | 历史功能已发布；Windows OpenCode 原记录恢复已修复；已观察历史跨重开保留，cursorGap 补偿通过验证；MCP配置操作丢失回应时同样先查原状态，配置重启恢复只重建私有端点、不写原生配置、不恢复已撤销授权 | [M07](modules/07-task-session/design.md) / [报告](modules/07-task-session/test-report.md) |
| AB-F12 指定主从关系 | 用户指定主 Agent 及允许的子节点 | 按身份维护多主与预授权/确认策略已发布，旧图仍编辑selected；Agent连接在预授权内，范围外须用户确认，各父读控交集/原ID与撤权保持；主角色准入只看MCP调用能力（`mcpClient`），托管scope注入`hostManagedTask`是独立维度，有MCP客户端但未适配托管注入的入口可以作主并单独注明“托管任务绑定未适配” | [M08](modules/08-collaboration/design.md) / [报告](modules/08-collaboration/test-report.md) |
| AB-F13 原生 Agent 协作 | 主 Agent 实际调用工具委派，读取子结果并汇总；源码可列原父/独立连接的委派ID | 独立MCP接入与Bridge托管scope分开：托管任务保留原父作用域，独立会话以connectionId归属、不伪造父Task。WSL三工具六个委派方向保留原真实证据；list_delegations、当前调用方list_agents及普通子任务最小上下文为源码/受控验证；当前角色与目标状态分开，查询等待中的撤权不返回旧目标，非实时委派台账不扩权；子任务附简短角色/结果交回说明，历史原输入保持，不授新工具/权限；不能等同新EXE模型或独立SSH验收 | [M08](modules/08-collaboration/design.md) / [报告](modules/08-collaboration/test-report.md)、[CT-02](iterations/I07/connection-delegation.md) |
| AB-F14 常驻中央后台 | 关闭窗口继续协调，重开复用历史与连接 | I06A 源码已实现；候选 Windows 关闭/停止/重开已验收 | [M02](modules/02-coordinator/design.md) / [报告](modules/02-coordinator/test-report.md) |
| AB-F15 CLI 兼容入口 | 单终端自动发现、提交、续聊、查看和控制 OpenCode | 已实现；不等同于桌面节点网络的全部入口 | [M09](modules/09-cli-hub-edge/design.md) / [报告](modules/09-cli-hub-edge/test-report.md) |
| AB-F16 节点图 | 机器分组、拖动节点、拖拽端点授权连线 | 支持旧后台下本机拖动、整组背景拖动及主居左；撤权按关系自身门禁、新授权按目标准入，布局接口独立；主角色/方向/避让保留；机器维护并入图页 | [M01](modules/01-desktop/design.md)、[M08](modules/08-collaboration/design.md) |
| AB-F17 发布与安装维护 | 源码、离线包、Windows EXE 一致，版本可验证 | 0.5.0 历史稳定；可信升级/回滚/停止/卸载源码与受控验证通过；维护收据新增 stopped/phase，停机未确认恢复保持 unknown 由原 ID 恢复；alpha.46已公开，包含越过未确认收据契约与两个只读门禁 RPC（历史指纹见[交付记录](iterations/I08/alpha38-delivery.md)，当前分发见[发布记录](iterations/I08/alpha46-release.md)）；正式 0.6.0 准出见当前报告 | [M10](modules/10-packaging/design.md) / [报告](modules/10-packaging/test-report.md) |
| AB-F18 网页资料入口 | 当前用户功能/设计/使用页、六Agent章节与六方式/能力对照；搜索、主题和图表 | 源码已实现；仅发布doc/user许可页面，排除内部编号、测试、问题、过程与历史；独立于Agent控制 | [M11 设计](modules/11-documentation-portal/design.md) / [报告](modules/11-documentation-portal/test-report.md) |
| AB-F19 智能体登记与小队 | 登记外部已有功能的智能体、说明职责/边界，组成小队和独立工作 | 已发布；职责登记保留，小队/工作容器定位为可选上层、暂停扩张；不实现Skill/模型/目录或业务能力，独立登记/固定端点及独立调用方/上下文/凭据源码已实现，真实原生与完整生命周期仍待验 | [M03](modules/03-machine-network/design.md)、[M08](modules/08-collaboration/design.md) |
| AB-F20 小队公共空间 | 共享约定/文档/群消息、成员通知、按权限写入与手动原生执行 | 可选上层，保留兼容、暂停扩张。CT-04 索引/旧修订/桌面MD和CT-05 选材/导出保留；原包持久传递、目标接入确认和桌面只读审计已随公开alpha.63交付；Pi/Hermes跨客户端组件已验；真实父模型消费及实体同步未准出，完整 I07C 未准出 | [M01](modules/01-desktop/design.md)、[M08](modules/08-collaboration/design.md)、[CT-04](iterations/I07/public-materials.md)、[CT-05](iterations/I07/context-packet.md)、[桌面选材](iterations/I07/context-packet-ui.md)、[原包传递](iterations/I07/context-delivery.md) |
| AB-F21 小队任务与授权交接 | 分配/接手、依赖、精确产物版本、限额交接、返修历史与业务验收 | 可选上层，保留兼容、暂停扩张，不作为通用调用状态机。I07B 任务/授权交接基础保留；CT-05 桌面可选任务/历史产物生成核对副本，观察到任务/成员变化会使旧导出失效；不改变交接授权；新增[原包接收声明](iterations/I07/context-delivery.md)与业务验收分开 | [M07](modules/07-task-session/design.md)、[M08](modules/08-collaboration/design.md)、[I07B任务交接交付](iterations/I07/task-handoff.md) |
| AB-F22 持续协调首批 | 用户授权自动成员与预算，重要事件激活、原会话续接、原生终态后验收 | 可选上层，保留兼容、暂停扩张，不作为互联核心完成条件。已随 alpha.23 分发；停止/撤权与原生终态核对已实现，真实 Claude 取消通过；其他接入/多原生角色/完整故障矩阵未准出 | [M02](modules/02-coordinator/design.md)、[M06](modules/06-native-adapters/design.md)、[I07C首批交付](iterations/I07/automation.md) |

## 4. 用户的完整操作路径

### 4.1 本机与 WSL

打开程序 → 识别机器和工具 → 点击节点接入 → 开始会话 → 输入需求与可选目录 → 查看回答与过程。需要协作时先保存主从关系，再从主节点创建允许协作的会话。

安装探测通过只说明工具能被找到、调用与检查；“模型真实回复验证”是另一项执行。账号拒绝或默认模型不可用应在原工具中修复，不自动替换供应商。

### 4.2 独立 Linux 服务器

```mermaid
flowchart TD
  Add[添加 Linux 机器] --> Login[填写地址、用户与认证方式]
  Login --> Trust{主机密钥已有可信记录?}
  Trust -->|否| Confirm[显示指纹，用户确认]
  Trust -->|是| Auth[SSH 认证]
  Confirm --> Auth
  Auth --> Inspect[检测系统、目录、运行时与现有安装]
  Inspect --> Install{需要安装 Bridge?}
  Install -->|是| Preview[展示摘要，一次批准安装并连接]
  Install -->|否| Connect[连接兼容后台]
  Preview --> Connect
  Connect --> Nodes[机器上线，发现该用户的工具]
  Nodes --> Task[接入节点并发送真实需求]
```

首次主机指纹和安装决定有实际意义。除这些步骤及已有 SSH 认证外，不要求用户再复制设备 Token 或配置中央公网地址。主机密钥改变必须停止连接，不能提供忽略身份检查的捷径。

服务器项目必须在服务器上存在；AgentBridge 不自动同步本机代码，也不把 Windows 路径转换为远端 `/mnt/c`。

### 4.3 新会话与续聊

每次发送生成稳定的 `requestId`。新会话创建或选择属于目标节点的上下文，提交后返回 Task 与 Conversation。后续追问携带原 `conversationId`，保持原节点、上下文目录与原生 Session；已保存的配置按各适配器核验，原生全局配置仍由工具管理。当前没有对三种工具统一拍摄全局配置指纹。

界面在上一轮结束且后端 `canContinue` 为真时允许发送。该字段不保证每个原生版本都能成功续接：当前 Codex 有 thread 绑定时仍可能显示输入，原生 resume 失败后在本轮显示错误，尚未把该限制完整转为禁用入口。连接验证记录有专用标识，不用它继续实际需求。

### 4.4 协作

用户指定主节点和子节点 → 保存关系 → 发送允许协作的主任务 → 主 Agent 通过 MCP 查询允许的子节点 → 委派子任务 → 读取真实子结果 → 在主会话总结。

“允许协作”不保证模型一定委派；验收必须有真实协作工具调用、子任务和父结果，不能把主 Agent 自己回答或人工复制结果算作协作。

节点图编辑同一套权限。拖动位置只是布局变更；端点连线先成为草稿，只有后台稳定收据确认后生效。轮询不吞草稿，冲突显式处理，回应未知只查询原 ID；换主不转交旧父的子任务。

## 5. 关闭、断开、取消的区别

| 操作 | 预期行为与当前边界 |
| --- | --- |
| 关闭 I06A 窗口 | 退出窗口客户端，独立 Coordinator 继续运行；候选 Windows 包已实测 |
| 断开 SSH 机器 | 关闭通信并关闭自动重连，不停止 daemon 已接收任务 |
| 网络中断 | 无口令私钥、可用 agent 或已保存的凭据可尝试重连；未保存密码/加密私钥口令时仍需输入；不重发任务 |
| 停止中央后台 | 协作与聚合暂不可用，远端 daemon 保留已接收任务；后台接口存在，设置页已提供明确停止入口 |
| 取消某个任务 | 只控制原任务；确认收到请求与实际取消是两个不同事实 |
| 旧 CLI 的 `service stop` | 停止该 CLI 实例及核验归属的托管服务，语义不能套用于“关闭窗口” |

中央机器关机、睡眠或停止全部后台时，不承诺协作仍可进行。Linux 的注销清理政策可能影响 detached 进程，需按实际服务器验收。

## 6. 必须向用户解释清楚的状态

- “已发现”：找到受支持工具，尚未接入网络。
- “已接入”：节点已允许使用；不代表模型已真实回复。
- “机器离线”：当前无法通信，历史结果不删除。
- “正在工作”：原任务尚未结束；等待原生权限也可能显示此状态。
- “执行待核对”：调用或结果不明，只查原 ID，不换 ID 重做。
- “维护前置门禁”：维护前的实时只读阻塞项（任务、Agent 或未确认收据）。任务/Agent **永不可越过**；未确认收据只有在用户显式确认“这些操作不会再运行”后才可越过，且越过内容会记入维护结果，收据本身不删除。
- “不支持”：本适配器或原生版本没有该能力，不假成功。

一次请求的回答和执行过程分别显示。Claude 的文本 delta 在呈现层合并，不能把一个 token 一条过程记录作为面向用户的默认阅读体验。

## 7. 产品边界与后续候选

AgentBridge 不重写 Agent，不负责模型供应商配置，不调度编译机或实验室设备，不提供任意远程 shell，不创建通用工作流引擎。SSH 只用于 Bridge 部署、身份验证与受控消息传输。

自研 Agent 可按 I07A/B 的本机 MCP 成员契约接入公共空间和任务板；当前另有[原生适配开发接口与指南](custom-agent-development.md)，开发者实现宿主、测试后静态注册并随包部署。它不是任意命令或 MCP 地址的自动执行器。Hermes/Pi/DSH 直接会话实现见[扩展专项](iterations/I07/native-agent-expansion.md)，新增三种不声明 Bridge 权限表单或小队成员 MCP 注入；各入口实际能力与真实未测边界见[接入矩阵](agent-integration-matrix.md)。通用执行接入方式由 CT-03 ACP 试点评估；调用方通用化与 Agent 侧连接操作按 [CT-06/07/08 规划](iterations/I07/agent-centric-operations.md) 推进。企业IM/Webhook、中央云端部署、多用户、文件同步与多层协作图保留历史候选记录，未纳入本轮后续目标。

当前验收结论见 [整体验证报告](testing.md)；具体版本和进度见 [迭代路线](project-plan.md)。后续修改本功能目录时，按 [同步维护规则](development-guide.md) 同时更新模块与迭代材料。


AB-F02/F12/F13/F16：alpha.68支持关系冲突只读检查、唯一原收据提案与用户明确确认后的备份/原子恢复；未知及缺来源保持只读，旧后台自动启动/复用须索引同步能力。[完整规则与验证](iterations/I08/relation-conflict-diagnostic.md)。

## 当前源码：关系恢复与 SSH 当前观察

AB-F02/F12/F13/F16：关系恢复区分已核对的原关系变更和节点观察，丢回应只查询准确原持久收据，不改写 unknown。SSH 失败清除旧 probe，阶段与错误按当前中央投影显示；未登记版本稳定拒绝并停止自动重试，公共兼容范围不变。已随alpha.70发布，验证与剩余项见[本轮记录](iterations/I08/issues27-28-current-state.md)。
