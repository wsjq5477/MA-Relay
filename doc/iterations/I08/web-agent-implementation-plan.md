# Web Agent MVP：文件清单、开发拆解与验收方案

ChatGPT当前已完成真实匿名网页经原MCP四轮持续会话与流式输出；最新文件增量、原失败、只读恢复和剩余准出要求见[实际交付](web-agent-live-chatgpt.md)。当前ZIP19文件；此前browser.2 EXE不包含本轮DOM增量。

当前范围按用户最新指令收敛为**仅开发并验证ChatGPT Web**。Kimi不再是本轮开发、自动化、人工验收或准出条件；此前三项目调研和包含Kimi的原方案保留历史背景，不继续实现Kimi。原生调用方、原请求恢复与ChatGPT持续会话要求保持。

执行状态：用户已授权按本方案开发；[开发台账](web-agent-development.md)记录实际增量与验收，原文档中的拟议接口及未实现项以该台账和源码为准，不因授权即视为已经交付。

当前交付增量：固定18文件的开发ZIP/清单与原桌面打包接入；Windows/Linux构建器/ASAR各13/13、ZIP解压MV3受控21组。开发browser.1普通启动缺ws失败，补桌面精确ws8.22.0/锁及ASAR门禁后browser.2实际包/3501载荷及包内Node68/68一致；原profile后继正常重开/退出通过，首轮15秒包装器等待失败保留。账号/权限同意/原生父模型与完整矩阵单独验收。新增INSTALL/LICENSE、构建器和两份packaging测试；修改两级package.json、桌面锁文件、stage-bridge、verify-package与gitignore。[原始证据与包状态](web-agent-packaging.md)。

日期：2026-10-30。以下是完整开发/验收要求；当前源码已有增量，实际完成状态、失败与未测项以开发台账及原始证据为准。公开alpha.71保持，不能把计划清单当通过记录。

## 1. 交付顺序与准出条件

仅实现并验证ChatGPT Web，其他平台按原计划独立验收。每个阶段按证据准出，不因一个 happy path 成功就开放全部能力。

| 任务 | 范围 / 产物 | 依赖 | 完成条件 |
| --- | --- | --- | --- |
| W0 设计确认 | 七份研究/设计；纯DOM、身份、unknown和取消边界 | 已授权 | 用户已指示开发；后续每项仍须实际证据，不因授权自动准出 |
| W1 DOM可行性 | 专用ChatGPT测试页；独立编写输入、原轮识别、输出序列化、完成/失败探测原型 | W0 | 真实网页证明文字输入和可区分的原轮结束；选择器/模式支持范围明确，不能用私有API兜底 |
| W2 注册与身份 | browser-extension descriptor、typed discovery、profile节点归组、上下文及资源键 | W0 | 原CLI行为不变；多profile不合并；unknown不能被别名绕过 |
| W3 通道与持久日志 | loopback WS、幂等配对/撤销、HMAC、协议schema、Node单一权威状态、扩展IndexedDB | W0；可与W1/W2并行 | 未认证不能发现/控制；两端存储故障不点击；原ID查询可恢复；配对ACK丢失不生成新身份 |
| W4 扩展执行链 | MV3后台、受控tab、content runtime、ChatGPT Driver、prepare/send、人工冲突 | W1/W3 | 最多点击一次；原页/原轮/全文匹配；草稿保护；点击后丢确认unknown |
| W5 流和完整调用 | AdapterHost接原Task/Conversation，revision输出、ACK/回放、原MCP被委派链 | W2/W4 | list_agents→delegate→原Task→result完整；能看到生成中正文，无重复拼接 |
| W6 持续对话 | delegate可选conversationId、所有权/当前关系、终态/取消门禁、可见对话摘要/历史版本与canContinue | W5 | 三轮同网页会话；重连只核对；同锚点编辑/重生成拒绝，旧无证明成功只读；换父scope/跨主体/未知轮次拒绝 |
| W7 取消与恢复 | 未授权内容的原子封存、两端证明及经典MCP queryOnly原取消恢复已实现；Stop候选、页面/worker/Node故障 | W5 | 控制ACK与Task终态分开；只在内容未授权且封存前事件齐备时取消；旧后台无只读声明不发送；不支持的Stop明确false；完整故障仍待 |
| W8 Windows交付 | 设置与受控页提示、打包、实际EXE扩展组合、文档同步与完整定向回归 | W5/W6/W7 | 源码/包一致；三种原生调用方分层实测；保留全部未测项 |
| W9 跨设备 | Windows浏览器为目标，先验远端原生调用方→已有中央/Transport→Windows节点；Linux浏览器另验实际宿主进程 | W8 | 原machine/node/request身份一致；SSH重连不发送第二条；Linux入口正确注入且只有一个监听者 |
| W10历史Kimi候选 | 已移出范围 | 不开发、不验收 | 不作为本轮准出条件 |

W1 若找不到符合要求的 DOM 完成证据，停止该 Driver 的执行开放，记录具体不能证明的场景，再讨论缩小支持范围；不把稳定超时当成功。W7 可以按当前实证保持 cancellation=false，但必须交付接口的明确拒绝与 unknown 查询，不能声称完整网页取消已实现。

## 2. 拟新增文件

下列均为**拟议文件**，本轮没有创建产品实现。落点属于现有 M06 适配器与机器宿主，不新建模块级 Broker。

| 文件 / 目录 | 内容 |
| --- | --- |
| `desktop/electron/browser-adapter-host.cjs` | 同步Host工厂，connect/snapshot/ipc/close；原Task/Conversation投影；原ID/控制收据 |
| `desktop/electron/browser-channel.cjs` | 每机器profile唯一loopback监听、已配对客户端、认证/撤销、transport重连和背压 |
| `desktop/electron/browser-protocol.cjs` | schema、规范封包、指纹、协议/事件版本、错误码、限额；不含Provider选择器 |
| `desktop/electron/browser-state.cjs` | 私有单一权威状态提交、事件游标、绑定、锁、操作收据；原atomicWrite工具 |
| `desktop/electron/browser-discovery.cjs` | 已配对扩展presence→现有discovery；browserInstance身份和能力收窄 |
| `browser-extension/manifest.json`、`package.json`、`tsconfig.json` | 独立可打包MV3扩展；优先小依赖原生API；不导入上游项目 |
| `browser-extension/src/background/{index,channel,pairing,journal,sessions,events}.ts` | 认证运输、IndexedDB、页面注册、围栏、事件ACK/回放、worker恢复 |
| `browser-extension/src/content/{index,runtime,ownership,serializer}.ts` | 消息方向校验、单页执行、人工操作、DOM通用序列化 |
| `browser-extension/src/providers/driver.ts` | Provider Driver契约及有副作用/只读方法边界 |
| `browser-extension/src/providers/chatgpt/{driver,selectors}.ts` | ChatGPT文字DOM driver；选择器版本集中管理 |
| `browser-extension/src/{popup,options}/` | 本机配对、站点授权、指定受控页、原请求与撤销提示 |
| `desktop/src/BrowserSettings.tsx` | 在现有认证配置入口管理浏览器连接，不新增日常聊天产品 |
| `desktop/tests/browser-{adapter,channel,state,identity,collaboration}.test.cjs` | 原Host契约、配对、幂等、身份/资源、续聊授权与故障 |
| `browser-extension/tests/`、`tests/browser-agent/fixtures/` | 扩展状态机、真实Chromium受控站点、DOM变体/手动操作夹具 |

不新增Kimi源码，不登记空Driver。

## 3. 必须修改或核对的现有文件

| 现有文件 | 确切修改原因 |
| --- | --- |
| [agent-adapter-contract.cjs](../../../desktop/electron/agent-adapter-contract.cjs) | browser-extension driver、非可执行发现类型的窄验证，保持同步Host与静态代码所有权 |
| [builtin-adapters.cjs](../../../desktop/electron/builtin-adapters.cjs) | 静态注册与能力上限；Web被委派而不能作MCP调用方 |
| [machine-host.cjs](../../../desktop/electron/machine-host.cjs) | 合并Browser discovery；按typed identity建context；注入共用channel；原对象读取保持来源 |
| [machine-router.cjs](../../../desktop/electron/machine-router.cjs) | connection/importSnapshot/discovery/快照匹配不再假设所有入口都有executable；原machine路由保持 |
| [agent-network.cjs](../../../desktop/electron/agent-network.cjs) | snapshot分组、siblings/superseded/instance绑定、attach匹配；Browser能力投影；续聊委派/指纹/原prepare拒绝恢复 |
| [coordinator-service.cjs](../../../desktop/electron/coordinator-service.cjs) | Windows MachineHost注入、用户配对方法白名单、可信Browser资源准入与管理锁；保留原pending机制 |
| [coordinator-client.cjs](../../../desktop/electron/coordinator-client.cjs)、[runtime-capabilities.cjs](../../../desktop/electron/runtime-capabilities.cjs) | browser-adapter-v1、delegation-resume-v1候选语义门禁；新前台不静默复用缺能力旧中央 |
| [mcp-client.cjs](../../../desktop/electron/mcp-client.cjs) | delegate conversationId schema及说明；task_result的原Session投影。经典工具名保持；小队工具schema不自动扩权 |
| [delegation-context.cjs](../../../desktop/electron/delegation-context.cjs) | 核对新轮上下文与原文渲染；旧contextVersion不迁移。只有实际文案变化才升版本 |
| [pending-journal.cjs](../../../desktop/electron/pending-journal.cjs) | 核对新Browser资源来源、控制unknown；如需修改只加可信资源支持，不能按裸错误释放 |
| [desktop/src/types.ts](../../../desktop/src/types.ts)、[desktop/src/api.ts](../../../desktop/src/api.ts) | ToolKind/driver联合、typed身份/诊断；通用output replace/revision合并，防把全文快照连续拼接 |
| [NetworkApp.tsx](../../../desktop/src/NetworkApp.tsx)、[AgentConfigurationDialog.tsx](../../../desktop/src/AgentConfigurationDialog.tsx) | 配对设置入口、明确被动节点能力与未知/人工状态，不恢复日常submit表单 |
| [src/desktop-host.ts](../../../src/desktop-host.ts) | Linux/WSL进程实际MachineHost注入点；Windows叶子OpenCode-only路径不重复监听；W9之前只核对不扩Linux支持 |
| [machine-daemon.cjs](../../../desktop/electron/machine-daemon.cjs)、[machine-protocol.cjs](../../../desktop/electron/machine-protocol.cjs)、[ssh-host.cjs](../../../desktop/electron/ssh-host.cjs) | 先复用原wire=2、收据/事件；需要时增加可选语义能力，缺能力关闭Browser执行。不能无依据改帧或新增SSH通道 |
| [stage-bridge.cjs](../../../desktop/scripts/stage-bridge.cjs)、[stage-linux-package.cjs](../../../desktop/scripts/stage-linux-package.cjs)、[verify-package.cjs](../../../desktop/scripts/verify-package.cjs) | 新模块/扩展资源清单、依赖解析、摘要与实际包核验；Linux未支持时不宣称已覆盖 |
| [desktop/package.json](../../../desktop/package.json)、[package.json](../../../package.json) | 只有实际构建入口/依赖/资源需要时修改；复用包内已有ws，核对冻结运行时能解析，不添加Python服务 |

源码复核中的额外落点：`AgentNetwork.reconcileDelegation()` 当前固定按 submit 重算准备拒绝指纹，续聊必须保存 op/conversationId 并同步该路径；`MachineRouter` 与 `manageNode` 中 executable 比较、`toLowerCase()` 必须按typed identity分支，不能用假路径绕过。现有CLI原路径测试必须保持。

第一版不需要修改 `src/core.ts` / `src/drivers/driver.ts` 的Provider枚举/native binding，不将Browser强行放进OpenCode Driver；若后续扩展独立Hub/Edge，另开范围审查这些schema。

## 4. 同次实现必须同步的文档

本轮保持主文档当前状态；实际开发时不能只新增迭代说明。

| 文档 | 需要反映 |
| --- | --- |
| I08需求/开发/验收记录、[迭代索引](../README.md) | 每阶段范围、候选/已实现/实测、失败、未测、证据；是否公开发布 |
| [product-design.md](../../product-design.md) | 原AB-F03/F07–F13受影响能力；被动Browser与真实支持范围 |
| [architecture.md](../../architecture.md)、[data-model.md](../../data-model.md)、[protocol.md](../../protocol.md) | 原Host归属、profile节点身份、私有绑定/围栏、接口/事件/错误/能力协商 |
| M01/M02/M03/M06/M07/M08/M10设计和test-report | 配置入口、认证/路由、Adapter/输出、Session/unknown、委派续聊、交付与证据 |
| [agent-integration-matrix.md](../../agent-integration-matrix.md)、[选型指南](../../agent-integration-guide.md)、[custom-agent-development.md](../../custom-agent-development.md) | Browser-extension真实路径；不标成ACP或MCP被调用方；能力按实测启用 |
| [testing.md](../../testing.md)、[project-plan.md](../../project-plan.md)、相关用户说明 | 仅在实现改变基线/范围/交付时更新；未验跨机/取消不可混为通过，Kimi已移出范围 |

## 5. 自动化测试设计

以下 `BW-*` 是本计划局部用例标签，全部**未执行**；实现时映射既有模块编号并登记，不能计入当前通过数。

| 用例组 | 必须覆盖的情景 | 核心断言 |
| --- | --- | --- |
| BW-A 注册/平台 | browser空commands合法，native空commands拒绝；异步Host拒绝；未审查Provider不执行；Windows/Linux/叶子进程 | 注册无动态require；唯一channel所有者；原CLI门面保持 |
| BW-B 配对/认证 | 非loopback、错误Origin、缺秘密、nonce重放、角色反射、旧frame/连接、版本不支持、撤销、配对ACK丢失 | 未认证命令0；幂等pairingId保留原身份；内容脚本拿不到秘密 |
| BW-C 身份/节点 | 两profile同adapter、多tab同会话、tabId复用、document刷新、实例缺字段、profile重装、孤儿unknown | 不合并/改绑；缺依据保守阻断；不能靠目录/新node/新pair释放占用 |
| BW-D 原请求 | 同ID同内容并发10次；同ID不同内容/Session；prepared重复；send/ACK丢失；旧终态回放 | 真实发送计数≤1；冲突拒绝；只查原ID；旧事件不污染新轮 |
| BW-E 提交断点 | Node持久前/后、WS写前/后、扩展事务前/后、content收到前/后、click前/后、submitted前/后强制终止 | 明确未派发才能拒绝/安全取消；其余unknown且锁保留；重开无Prompt重放 |
| BW-F DOM输入 | textarea/contenteditable、延迟按钮、重挂载、长Unicode/多行、IME、草稿、粘贴/附件、导航、用户Enter/Stop | 不覆盖人工内容；全文比对；填充后再核验锚点；点击一次无fallback重发 |
| BW-G 输出/结束 | 旧回答、相同文本的新轮、DOM重排、前缀修改、工具暂停、长思考、Stop selector失效、错误/限流、空回答 | 原轮归属；不提前成功；partial可读；无完成证据unknown |
| BW-H 事件/存储 | 重复/乱序seq、同seq不同内容、ACK丢失、缺口、缓存满、Node rename失败、IndexedDB配额、日志损坏 | ACK仅在单一权威提交后；Task/终态/锁/游标一致；不丢围栏、不重执行 |
| BW-I 续聊/授权 | 三轮同会话；跨connection/父scope/目标/机器；父终态；撤权；两次并发续聊；上一轮/取消unknown | conversationId不是授权；只允许原主体和当前关系；未知不续聊 |
| BW-J 取消/关闭 | prepared取消与send竞态；Stop不支持、click后ACK丢、自然完成胜出、无明确停止标志、close unknown | 控制收据与Task分开；无关页不被Stop；close不释放任务 |
| BW-K UI/格式 | delta/snapshot/revision覆盖、多block、代码/表格/公式、truncated、未支持能力、只读历史 | 不重复拼接；正文不执行HTML；MCP等待不冒称token stream |
| BW-L 跨机/包 | 实际daemon/relay断链、原收据重查、旧中央/daemon、实际包内模块/扩展、普通关窗 | 原machine/request/Session保持；缺语义能力拒绝；关窗不触发重发或冒称取消 |

用可控网页 fixture 重现按钮、DOM、人工事件和错误，不调用模型；用真实 Chromium 扩展验证隔离世界、MessageSender、IndexedDB、worker回收与权限。假DOM单测不能代替这些浏览器API测试。每个关键故障窗口由执行计数器和持久原ID证明，不能仅断言错误字符串。

沿用仓库检查：根类型/lint/build、桌面类型/build及受影响Node测试；新增Browser套件与现有 adapter/network/pending/MCP/capabilities 的定向集合。产品实现后再跑完整约定回归和包核验，历史平台失败如实分开。拟用命令：

```powershell
npm run typecheck
npm run lint
npm run build
npm run typecheck --prefix desktop
npm run build --prefix desktop
node --test desktop/tests/agent-adapter-contract.test.cjs desktop/tests/machine-host-routing.test.cjs desktop/tests/agent-network.test.cjs desktop/tests/connection-capabilities.test.cjs desktop/tests/pending-journal.test.cjs desktop/tests/collaboration-broker.test.cjs
node scripts/check-docs.mjs
```

上面是未来执行清单，本轮没有运行产品工程检查，也没有为文档变更重跑真实Agent/EXE。扩展测试命令要在其实际package创建后冻结，不能把拟议命令当现成工具。

## 6. 人工验收矩阵

所有真实页面和账号测试使用用户明确指定的专用测试会话，原生配置与Provider账号沿用，不复制凭据到证据。每次记录源码/包/扩展hash、OS、浏览器版本、Driver版本、日期、原ID和实际结果。

| 场景 | 验收观察 | 本轮结果 |
| --- | --- | --- |
| 配对/发现/撤销 | 只有配对profile可见；未授权站点不驱动；撤销不假装取消原任务 | 未测试 |
| Codex→ChatGPT | 原生真实MCP发现、文字委派、生成中可见正文、原结果回Codex | 未测试 |
| OpenCode→ChatGPT | 同上，单列原生版本与实际调用证据 | 未测试 |
| Claude Code→ChatGPT | 同上；不能用受控客户端冒充父模型自主委派 | 未测试 |
| 三轮持续对话 | 后两轮依赖首轮内容；原bridge/网页Session与分支不变；各轮requestId独立 | 未测试 |
| 长输出 | 代码/表格/中英文/公式；生成停顿不提前完成；修订不重复拼接 | 未测试 |
| 用户冲突 | 非空草稿、IME输入、手动发送/Stop、编辑历史、开新聊天、导航 | 未测试 |
| 页面/登录限制 | 登出、账号切换、限流、验证码、离线、被支持模式以外页面 | 未测试；不得自动解验证码或换账号 |
| 点击后故障 | 在第一条确认前断WS/杀worker/停Node；重开按原ID查，不新增消息 | 未测试 |
| 取消/关闭 | prepared安全取消；生成中Stop及自然完成竞态；明确区分不支持/unknown/cancelled | 未测试 |
| 多profile与重装 | 两profile节点独立；同URL多tab拒绝歧义；重装不绕过孤儿unknown | 未测试 |
| 跨设备 | Linux原生Agent→既有Bridge跨机路径→Windows浏览器，反向及Linux浏览器后续单列 | 未测试 |
| 实际交付包 | 冻结EXE与扩展资源；普通启动/关窗；重启后原历史/围栏/配对保持 | 未测试 |
| Kimi历史候选 | 当前不开发或验证 | 移出准出条件 |

不要把Fixture、真实扩展无模型、真实网页模型、原生父模型自主委派、跨机和实际EXE结果相加成一个“全通过”。Provider DOM完成与服务器内部结束也分别说明证据范围。

## 7. 本轮文档交付核对

实际操作仅为本仓库静态审查、第三方源码拉取/阅读、官方ACP/Chrome规范查阅及本轮文档写入。环境 Node v24.12.0、Git 2.45.2.windows.1。未改产品代码、依赖、用户profile、原生/Provider配置、发布版本或EXE；未调用模型、部署SSH、安装第三方扩展或运行上游测试。

修改前执行 `node scripts/check-docs.mjs`：失败，**2243条既有缺失链接/材料**，290份Markdown。前几条涉及历史 artifacts 缺失，与AGENTS和alpha.71保留的历史边界一致。交付后实际复跑：297份Markdown，仍为相同2243条错误，新增/消失错误均为0，本轮文档错误0；不修补或伪造历史证据。检查进程退出码仍为1，不能写成全库文档检查通过。

另外核对111个固定提交源码链接：文件均存在、行号未越界；不等于证明运行正确。首次在无DOM的Node环境解析Mermaid时，3张图遇到DOMPurify兼容错误；随后使用Playwright CLI、隔离loopback页面和已安装Mermaid实际渲染，10/10张图成功生成SVG。没有打开Provider网站，唯一浏览器console错误为临时页面favicon的404，图表渲染无失败。浏览器会话与临时服务已关闭。

本轮全部新增设计仍为候选，主文档当前功能状态不变。工作区原有 Paperclip 文档和索引改动保留；本轮只追加自身登记。最终原始核对字段和源码摘要见[本轮检查记录](web-agent-research-checks.json)，结果由实际检查生成，不把本计划用例计为通过。
