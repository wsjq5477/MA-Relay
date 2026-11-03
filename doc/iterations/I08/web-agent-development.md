# Browser Agent 开发与验证台账

2026-11-01更新：已交付包含当前ChatGPT源码及19文件扩展的browser.3 Windows体验包。通过同目录非C盘启动脚本使用，包内Node 72/72及实际EXE载荷核验通过；本包尚无普通GUI/真实模型验收，旧browser.2证据保留为历史。[最新体验包与准确边界](web-agent-browser3-preview.md)。

当前Web范围仅ChatGPT：真实匿名ChatGPT经原MCP/Registry/Router/认证MV3同会话四轮通过，第四轮8次输出/2295字符；父模型是受控夹具。新版DOM及只读原结束失败结算已实现，原第二轮失败与恢复边界保留；DOM39/39、IndexedDB69/69、Host/打包63/63，网络回归44通过/1平台跳过。原生父模型、账号/权限同意、跨设备及当前包内Web链路仍待，Kimi不开发不验收，公开alpha.71保持。[当前实现、产物与原始证据](web-agent-live-chatgpt.md)。

日期：2026-10-30；基于6e7ec6f工作树，Windows / Node24.12.0。用户已确认开发，完整目标仍为[Web Adapter方案](web-agent-design.md)及[实施矩阵](web-agent-implementation-plan.md)。**尚未完成开发与整体验收，不改变公开alpha.71。**

2026-10-31真实网页推进：独立Chromium148匿名ChatGPT页通过公共DOM获得两轮实际回复，原`/uc`会话/消息锚点保持且捕获正文增长。此前browser.2 Driver不支持该布局，当前源码已适配，发送ARIA异步就绪及完成早于停止解除均已纳入门禁；这两轮是DOM可行性原型，尚非Bridge或原生父模型验收。[实际证据与实施边界](web-agent-live-chatgpt.md)。

2026-10-31扩展交付：生产18文件的开发ZIP/清单/SHA接原桌面资源与核验；Windows/WSL构建器及真实ASAR各13/13、ZIP解压MV3受控21组通过。首个开发EXE实际缺桌面ws而拒绝，补精确ws8.22.0及ASAR门禁后browser.2的69后台/84Core/1738Linux、3501实际载荷及包内Node68/68一致。普通启动首轮3组后包装器15秒等待失败保留；同一原profile后继重开/配对保留/正常退出3组通过、wrapper退出0。均不相加为完整矩阵；账号/权限同意/原生父模型仍待。[开发EXE、ZIP、全部失败与边界](web-agent-packaging.md)。

## 当前实现

| 源码 | 已实现行为 |
| --- | --- |
| [browser-protocol.cjs](../../../desktop/electron/browser-protocol.cjs) | 内部身份、UTF-8限额、事件白名单、序号/围栏、网页绑定和错误字段验证 |
| [browser-state.cjs](../../../desktop/electron/browser-state.cjs) | 单一权威browser-state.json保存Task/Conversation/request/control及事件游标，复用atomicWrite；写失败禁止继续写，损坏不重建空表 |
| [browser-adapter-host.cjs](../../../desktop/electron/browser-adapter-host.cjs) | 同步构造/close、异步call串行落盘；connect/submit/continue、原ID查询、只读reconcile/health、空闲Session关闭及未授权内容证明取消；阶段持久后才派命令；重开unknown；输出replace修订与落盘后ACK |
| [agent-adapter-contract.cjs](../../../desktop/electron/agent-adapter-contract.cjs) | 新browser-extension类型允许空commands、禁止假CLI/npm入口；原native规则保持 |
| [browser-pairing.cjs](../../../desktop/electron/browser-pairing.cjs) | 私有配对身份、短期bootstrap、HKDF长期密钥、幂等commit及撤销；损坏/落盘失败不重建凭据 |
| [browser-channel.cjs](../../../desktop/electron/browser-channel.cjs) | 127.0.0.1认证WS，指定扩展Origin、双向HMAC、新连接代次/逐帧MAC和序号、命令限额/超时/原执行事件ACK |
| [扩展client.mjs](../../../browser-extension/src/background/client.mjs)、[wire.mjs](../../../browser-extension/src/shared/wire.mjs) | 原生Web Crypto协议客户端、配对提交前先持久化派生凭据；只负责连接，不在重连时重放网页命令 |
| [indexed-state.mjs](../../../browser-extension/src/background/indexed-state.mjs) | 原生IndexedDB严格事务，单一authority记录；仅事务complete后返回；容量/损坏/异步事务回调拒绝并回滚，取消与内容授权、原事件游标校验 |
| [journal.mjs](../../../browser-extension/src/background/journal.mjs)、[executor.mjs](../../../browser-extension/src/background/executor.mjs) | 扩展侧原操作/Session/请求/资源锁及有界事件outbox；持久发送围栏、内容授权/封存竞争、消息指纹核对、原页动作与恢复查询分离；页面API通过ChromePages注入 |
| [manifest.json](../../../browser-extension/manifest.json)、[后台入口](../../../browser-extension/src/background/index.mjs)、[ChromePages](../../../browser-extension/src/background/pages.mjs) | 可加载MV3包、受信配置消息、动态站点授权脚本注册、真实tabs/document消息、事件持久化/ACK、恢复重连与页面失效；有实际options入口 |
| [content runtime](../../../browser-extension/src/content/runtime.js)、[ChatGPT Driver](../../../browser-extension/src/providers/chatgpt/driver.js) | ISOLATED脚本、原页代次/可信人工输入、一次DOM发送、原用户/回答锚点、可见对话摘要/历史版本、正文修订与完成判据；真实站点兼容性尚未准出 |
| [adapter-identity.cjs](../../../desktop/electron/adapter-identity.cjs)、[browser-discovery.cjs](../../../desktop/electron/browser-discovery.cjs) | 来源机器/adapter/profile的typed发现、连接及执行资源键，无假executable；已配对通道只读健康/站点授权探测 |
| [browser-endpoint.cjs](../../../desktop/electron/browser-endpoint.cjs)、[browser-management.cjs](../../../desktop/electron/browser-management.cjs) | 原机器宿主拥有固定loopback端点/启动恢复与配对RPC；原operationId配对去重，端口/状态失败不更换身份 |
| [agent-network.cjs](../../../desktop/electron/agent-network.cjs)、[mcp-client.cjs](../../../desktop/electron/mcp-client.cjs)、[agent-connections.cjs](../../../desktop/electron/agent-connections.cjs) | 原MCP delegate可选原conversationId、cancel_task可选queryOnly、同原主体及当前关系门禁；task_result返回会话及当前可续状态；旧后台缺实时能力证据不发送新字段动作 |
| [BrowserSettings.tsx](../../../desktop/src/BrowserSettings.tsx)、[设置页](../../../desktop/src/WorkspacePages.tsx) | 按原机器配对/原操作queryOnly/具名撤销，秘密仅内存和剪贴板，本机意图不保存秘密 |
| [扩展设置](../../../browser-extension/src/options/index.html) | 实际图标入口、配对包遮蔽输入、站点权限API、原配对连接状态、暂停/恢复而非重发 |
| [api.ts](../../../desktop/src/api.ts)、[connection-capabilities.ts](../../../desktop/src/connection-capabilities.ts)、[配置弹窗](../../../desktop/src/AgentConfigurationDialog.tsx) | 显式replace修订展示，Browser静态profile来源门禁、被动配置与原身份，无假CLI路径/MCP表单 |

没有新增Broker、路由或模型API。chatgpt-web已在builtin静态Registry注册，原Registry/机器/节点执行与读取已接通。生产宿主已有持久认证通道/配对RPC及MCP原主体续聊，桌面/扩展设置与正文修订UI已接线；**实际站点权限确认/账号与完整多平台/控制/包验收仍未完成**。新任务先保存原Task/Conversation/request，随后session.create或resume、message.prepare、message.send；任何丢回应均unknown且不重发，原查询不进入派发路径。

事件核对原profile/request/task/execution/conversation与lease/bindingRevision；同seq同内容去重，冲突/缺口拒绝。只有submitted绑定后才接受原轮输出/终态；新submitted不能替换原user锚点，续轮不能认领旧user。Task事件/终态/游标同次提交后才throughSeq。桌面已按显式mode=replace处理正文修订，原始事件保留。

无旧绑定且未发出任何浏览器命令的全新prepared可本地取消；继承旧绑定的prepared及creating/preparing/dispatching须原扩展明确contentAuthorized=false并成功封存，收齐原事件后才取消。已授权内容、缺证明或已submitted不能以此释放unknown，通用cancellation仍false且不点击Stop。丢回应由原MCP cancel_task(queryOnly=true)或ipc.operation只读恢复，另读原Task结局。

## 当前本机认证通道

BrowserChannel是适配器运输，不认识主从关系、不提供通用中央RPC。正常机器宿主恢复原committed端点或显式start/createPair时监听127.0.0.1；精确扩展ID由本机调用方经现有设置配对入口传入。最多16连接，每连接5秒认证预算、32个待回应命令、64个排队帧，单帧1MiB及4MiB写缓冲上限。默认20秒业务回应等待，超时/断开只拒绝原pending，不重发。

配对文件browser-pairings.json保存version=1、nodeId及每profile的pairingId/browserInstanceId、origin、bootstrap/派生密钥、expiresAt和pending/committed/revoked。Node先保存pair intent；扩展验证Node证明、派生并通过注入persist回调保存长期凭据后才继续认证/提交。commit与响应丢失可按原身份恢复，不分配新profile。bootstrap两分钟后失效，长期凭据独立；撤销持久化后断开对应通道。Node与扩展HMAC/HKDF交叉实现结果一致。密钥不进入URL、Provider页面或日志；HMAC不提供正文加密，范围仅本机回环。

认证后每帧以方向标签、protocol、connectionEpoch、frameSeq及完整body签名。重复序号/错误签名/错profile拒绝；新连接替换旧连接使原观察变unknown。Host按原execution注册事件处理器，只有Host权威提交成功才event.ack；落盘失败返回event.error而不是ACK。Host关闭只解绑观察，不关闭共享通道或取消网页生成。

## 扩展持久执行基础

IndexedDB保存version=1的authority：revision、requests、operations、sessions、locks、events。IDB readwrite transaction按strict durability请求提交；状态、围栏、事件及ACK游标同次事务。只有complete才允许下一页面动作；abort/容量达限保留原记录。默认8MiB，未ACK事件不跳号不改写；ACK只能推进至已保存lastSeq，删除已确认outbox时保留原请求、submitted与terminal证据。数据库格式或身份/序号关系损坏拒绝打开，不重建空库。

session.create/resume先以operationId保存unknown意图，再调用注入页面API；空闲session.close仅原子写Bridge墓碑与原收据，不触碰页面。回应丢失后相同操作只返回原收据或未知，不再次创建标签页。prepare固定原消息payloadFingerprint及contentAuthorized=false；send使用Web Crypto重算SHA-256，比较Host同一规范JSON摘要，再在事务内将prepared改为dispatching。并发只有一个claim可执行，页面提交另需严格内容授权；原取消封存后新写全部拒绝。恢复函数将dispatching/submitted标unknown并追加原execution事件，锁仍保留；不重新调用submit。不同request/profile/Session不能改写原绑定。Session末轮未明确结束时拒绝新的资源拥有者。

BrowserExecutor组合日志与create/resume/inspect/submit/detach/health接口；每次claimSend后重新inspect，再落盘内容授权，异常保留原unknown而非尝试另一发送动作。ChromePages已实现真实chrome.tabs/content路径，后台入口已接MV3和ChatGPT候选Driver；静态Registry/机器/节点、生产宿主启动/配对RPC、用户配置UI及MCP原主体续聊已受控验证，实际站点/账号仍待，不等于完成日常产品准出。

## 原Registry、机器和节点链路

chatgpt-web静态能力仅execution/delegation/resume，MCP调用方/托管scope/permissions/forms/verification/cancellation为false；Kimi未注册。CLI发现明确跳过browser-extension，不扫描或生成假可执行文件。Browser discovery仅取原committed pairing，healthy表示认证运输及站点权限，loginChecked=false，不能据此宣称真实登录/模型可用。

MachineRouter保留原native安装hash规则，Browser连接键为machineId+adapter+browserInstanceId；导入快照、发现匹配、历史白名单及实例资源锁都携原profile。AgentNetwork的group/siblings/superseded/instance归属按profile收窄，两个profile不会互相取代。MachineHost的Browser context固定在adapter+profile，拒绝同profile新node或workspace/scope别名；不创建项目目录，不接受模型或供应商覆盖。

Node中央请求在派发前保存当时已知的browserInstanceId集合；Host Task也保存当时原committed peer集合（不公开返回）。同一原资源unknown继续占用，当时已知独立profile可执行；后加配对不能绕过。即使中央dispatched但后端尚无Task，也保留这层准入，不以NOT_FOUND释放。旧记录没有集合则只承认原profile，不推断新的独立性。重开保留原machine/node/context/request/Task/Conversation身份，读取只回原来源。

## MV3与ChatGPT候选Driver当前行为

生产manifest最低Chrome120，仅storage/alarms/scripting权限，站点为可选授权；没有cookies、debugger或网站网络拦截权限。后台只接受本扩展页面的配置消息，content不能读取配对凭据；派生密钥保存在TRUSTED_CONTEXTS的local区。站点授权后动态注册ISOLATED脚本。content事件由后台核验sender.id/tab/frameId/documentId、原pageEpoch和允许origin，再进入原journal。取消站点权限时移除脚本并保持原unknown，不将撤权当取消。

ChromePages创建空受控tab，原操作意图先保存，页面就绪探测可读重试，绝不重试创建tab或发送。documentId由公开scripting API取得；Session Resume保持原tab/document/pageEpoch与网页会话锚点。重载/关tab将对应原请求标unknown，页面新代次不自动发送旧消息。后台重开先恢复日志，运输重连只补原事件；每execution一次只保留一个在途事件，ACK后补下一条，避免无界写缓冲。

ChatGPT Driver只接受普通根页或/c会话页，沿可见textarea/contenteditable输入，验证全文并在填充后核对控件身份、URL、人工输入代次及Stop状态，再只click一次。已有草稿、生成中、附件候选标记、无编辑器或缺消息锚点拒绝；不访问React/Lexical内部对象。观察要求新增user内容/ID、原document及会话key一致；仅新assistant可回传文本修订。成功须同轮完成控件、Stop消失、非空回答及1500ms稳定窗口同时成立。15秒提交/90秒无活动/10分钟总预算只导致unknown，不自动重发/Stop。用户输入、分支/导航或归属歧义保留partial/unknown。输出当前为可见纯文本，复杂Markdown保真未准出；不读取隐藏推理。

实际options/桌面配对UI已实现，[源码安装/配对步骤](web-agent-installation.md)可供隔离试用；可选host权限API已接用户动作，但实际浏览器权限确认未完成。Driver只在受控HTML中验收，线上ChatGPT选择器、登录/限流/验证码、复杂工具/模式与长期后台节流仍未验。Kimi只有可选host声明，尚无Driver或执行注册。

## 实际验证

原始证据：[TAP](../../../artifacts/browser-agent/2026-10-30/host-tests.tap)。

```powershell
node --test --test-reporter=tap desktop/tests/browser-adapter.test.cjs desktop/tests/agent-adapter-contract.test.cjs desktop/tests/machine-host-routing.test.cjs
node --check desktop/electron/browser-protocol.cjs
node --check desktop/electron/browser-state.cjs
node --check desktop/electron/browser-adapter-host.cjs
```

最终共享28/28通过（Browser17、注册7、原对象路由4），失败/跳过0；三个实现文件语法检查通过。覆盖去重、发送ACK丢失/重开、不换ID解除unknown、绑定/事件冲突、快照前缀修订、三轮原Session、写失败不派发/不ACK、取消拒绝不改任务、晚到原终态、损坏状态与观察关闭。

扩大到连接能力及网络持久化的定向回归最终49/49，失败/跳过0，[扩展TAP](../../../artifacts/browser-agent/2026-10-30/extended-tests.tap)；这是28项集合的扩展，不相加。根typecheck通过。文档检查仍为既有2243条错误，集合新增/移除均0，[原始检查](../../../artifacts/browser-agent/2026-10-30/docs-check.json)；不称全库通过。git diff --check通过。根lint的覆盖范围为src/tests/scripts，不将它作为新增CJS文件的lint证明；新增CJS已语法检查和定向运行。

上轮28/49项的证据级别为真实本地文件系统/Node异步执行与受控transport/页面事件，不是实际WS、MV3、Provider网页、原生父模型或EXE验证。未安装扩展、读取账号配置、部署SSH或发模型消息。首次Browser集合15/15，补两个反例后17/17；共享集合27→28来自新增注册测试，不跨轮相加。

本机通道专项另以真实loopback WebSocket、真实Node Host和实际扩展ES模块/Web Crypto客户端执行16/16，[专项TAP](../../../artifacts/browser-agent/2026-10-30/channel-tests.tap)。覆盖凭据先持久化、原身份重连、配对commit回应精确丢失、认证超时、错误秘密/Origin/MAC、重放、撤销、原命令超时不重发、事件存储失败不ACK、Host断线unknown及配对文件损坏。不是浏览器原生WS/Origin或MV3验证；测试ws客户端显式提供extension Origin，无法替代真实浏览器权限证明。

扩展共享定向集合最终65/65，失败/跳过0，[完整TAP](../../../artifacts/browser-agent/2026-10-30/transport-regression.tap)；覆盖此前49项，不相加。新channel/pairing CJS与client/wire ES模块语法检查通过。文档检查继续保留既有2243条缺失，新增项单列，不据此准出完整功能。

2026-10-30扩展日志专项：Playwright CLI隔离HeadlessChrome140.0.0.0、真实原生IndexedDB与Web Crypto，[浏览器报告](../../../artifacts/browser-agent/2026-10-30/indexeddb-browser.json)18/18，console错误0。覆盖数据库重开、20次并发claim仅一次许可、重复submit、恢复函数保留unknown和锁、tab创建丢回应不重试、事务abort、8MiB预算受控缩小拒绝、正文修订、ACK限界、旧回答排除、页面接口导航拒绝、原Session续聊/跨profile拒绝、异步回调拒绝、prepare后换指纹与有效JSON损坏、伪造终态不能解锁。页面接口为受控函数计数器，未加载Provider网页；没有真实MV3 worker强制终止或DOM点击证明。最初15项通过后增加指纹/损坏及终态反例为18项，不跨轮相加。

复现：先运行[隔离测试源站](../../../desktop/tests/browser-journal-fixture.cjs)，用Playwright CLI命名隔离会话打开输出的127.0.0.1端口，读取window.result；测试源码为[journal-browser.mjs](../../../browser-extension/tests/journal-browser.mjs)。测试数据库随机命名并在每项后关闭/删除，不使用日常profile。追加测试时一次语法检查因非async回调内await失败，改为预先计算摘要后最终语法检查和18项通过；产品实现未因该测试编写错误改变。Host相关Node65/65本轮重跑保持，结果与浏览器18项分层记录。

真实MV3专项：Windows / Chromium148.0.7778.96，使用实际扩展包源码与真实Origin/WS/Web Crypto/IndexedDB/content/DOM，8组关键检查通过，pageErrors=0，[最终报告](../../../artifacts/browser-agent/2026-10-30/mv3-integration.json)。三轮均观察到Partial正文、最终正文和原Task结果，恰好三次真实DOM点击；第四轮强制关闭实际service worker target，原Task unknown，唤醒后仍只有第四次点击；原页稍后完成可核对回原Task；随后真实可信输入草稿保持，续聊拒绝第五次点击。

该专项是**受控Provider HTML**，不是ChatGPT服务或原生父模型。测试副本将ChatGPT host预授予以单独验证执行链，生产manifest仍为可选权限，未证明授权交互。网络guard只拒绝请求、不转发任何上游连接；provider HTML由路由合成。扩展创建tab的首次导航可能早于自动化Fetch接管，因此测试只在空页、任何Prompt前显式导航到受控源；该测试动作不属于产品重试。初次Windows fs.cp准备失败改逐文件复制；默认Playwright浏览器缺失改显式使用现有缓存Chromium。首次拦截接管及加网络guard后的导航均曾超时（原Task creating/unknown、routedRequests=0，guard拒绝17条请求且上游转发0）；中间JSON被重跑覆盖，未保留完整原始文件。本段保留实际失败事实，最终报告不冒充首次成功；修正测试路由后最终8组通过，不据准备失败改产品为自动重发。

运行`node desktop/tests/browser-extension-live.cjs`；默认使用已安装Playwright的浏览器，若本机只有其他兼容缓存版本，显式设置AGENTBRIDGE_TEST_CHROMIUM指向该测试浏览器。脚本创建独立临时profile和扩展副本，结束关闭浏览器/本机测试通道/网络guard。真实扩展执行需要特别的persistent-context/worker target控制，验收脚本使用已安装Playwright库，不使用用户profile或另装浏览器。

最新Node共享回归67/67（新增两项固定错误码/私密错误文本过滤），失败/跳过0，[最新TAP](../../../artifacts/browser-agent/2026-10-30/mv3-source-regression.tap)。历史65项不与67项相加；MV3八组及IndexedDB十八项保持各自证据层级。站点撤权/标签关闭/导航监听已实现，但未作为本次八组的独立故障准出，后续矩阵须补齐。

2026-10-30核心接线专项：原Registry/MachineHost/MachineRouter/AgentNetwork均为实际实现，通道/原生宿主为空的受控组件，新增8项覆盖typed身份、两个profile不合并/无假路径、原nodeRequest执行与限定ID结果、已知独立profile、后配对拒绝、同profile新node/目录别名拒绝、核心重开原身份/原请求查询，以及中央有派发无后端Task的unknown窗口。[用例](../../../desktop/tests/browser-network.test.cjs)。最终扩展共享回归187/187，失败/跳过0，[原始TAP](../../../artifacts/browser-agent/2026-10-30/network-regression.tap)；包括前述67项及原机器/节点/接入能力/持久化回归，不相加。

真实MV3验收脚本现改由AgentNetwork执行discover→manageNode attach→nodeRequest→MachineRouter→真实MachineHost→静态Registry Host→认证WS→扩展，而非直接调用Host。原八组增至九组，均实际通过，仍为Chromium148/受控Provider HTML，pageErrors0/上游转发0；[最终九组报告](../../../artifacts/browser-agent/2026-10-30/mv3-integration.json)。三轮原Session、Partial→Final、worker强停/恢复、late completion和草稿保护继续满足。中央服务启动及原生MCP调用方没有参与此脚本，不能据此说已验Codex/OpenCode/Claude父模型自主调用。

## 原MCP续聊与生产宿主接线

2026-10-30：经典MCP工具仍10项。delegate新增可选conversationId，要求同一leader、原parentRequestId/parentTaskId/parentConversationId或独立externalConnectionId，与原member及会话一致。原轮必须有明确终态，原后端canContinue=true，current lastTaskId若存在须匹配；不得传新workspace。异步会话核验后重查当前关系/目标及原父任务，新父执行不能沿旧父conversation的派生请求命名空间认领历史。已存在原request只查询或结算原收据，改变会话/需求/目录均冲突。

委派台账新增可选op='submit'|'continue'、resumeConversationId；原返回conversationId仍为结果身份，准备拒绝可用正确continue输入指纹核对，历史缺op按submit。task_result增加conversationId/canContinue；后者只有当前权限、静态resume与原后端均证明才true，只读探测失败仍返回原结果，不保证下一请求获准。MCP没有新增token流推送，网页输出仍经原Task事件及结果轮询。

客户端运行脚本可能比已驻留Broker/中央更新，因此每次续聊先通过原认证入口只读list_agents，须返回supportedOperations含delegate.continue-v1；缺失报MCP_CONTINUATION_BACKEND_UPGRADE_REQUIRED，原delegate发送0。当前授权错误原样返回，不能把失败视为空关系或改建会话。该能力确认不代替后端的实时授权和占用检查。

BrowserManagement由原MachineHost拥有；无配对时不监听，有未撤销记录则启动原端口，扩展以原凭据重连。私有browser-endpoint.json版本1使用排他首次创建保存nodeId/127.0.0.1/随机高端口，后续不改址；端口占用或JSON/绑定损坏明确报错，不扫描替代端口，不清空配对，原生snapshot仍可用。端点初写中断会失败关闭，尚无自动修复/换端口UI。它沿用既有机器进程单拥有者约束，未新增跨进程的独立执行器。

browser.status({machineId})返回无秘密配对列表、在线事实、原端点或固定错误；browser.pair({machineId,extensionId,operationId})创建两分钟包，同operationId回原profile/秘密/期限，改变extensionId冲突；过期或撤销后不自动分配替代。browser.revoke({machineId,pairingId})按原配对幂等撤销并断连接，不结算网页Task。入口走原中央/机器RPC，不写任务pending及其秘密；有原unknown仍允许只读状态与撤销，执行侧原profile占用不变。新中央/daemon以browser-agent-v1声明能力，旧中央/SSH peer缺声明在发送新管理请求前拒绝；不自动升级。

Windows Coordinator与Linux daemon的生产MachineHost已启用；Linux桌面复用同一本地MCP目录和一个Broker，原生discover/context/scope仍交原Core，snapshot/对象路由合并Browser，原callback透传。独立MCP scope由McpIntegration恢复，不能误当托管row.scope复建。以上Linux代码在Windows受控组件中运行，不能写成Linux daemon进程/实际跨设备验证。WSL仍走原Core路径，尚未新增独立Browser配对宿主；不把Windows浏览器映射为WSL节点。

验证：续聊专项[mcp-continuation.test.cjs](../../../desktop/tests/mcp-continuation.test.cjs)8项已运行；包含其前序共享214/214的[TAP](../../../artifacts/browser-agent/2026-10-30/mcp-regression.tap)。管理专项[browser-management.test.cjs](../../../desktop/tests/browser-management.test.cjs)7项，真实WS/磁盘/原机器RPC，扩展客户端Origin在Node ws中显式设置，并非Chrome证明；最新扩大共享[TAP](../../../artifacts/browser-agent/2026-10-30/startup-mcp-regression.tap)260项241通过、19项Linux平台跳过、失败0。含原MCP/机器/节点/注册/持久化及中央/daemon基础，覆盖前述集合，不跨轮相加。

最新[真实MV3报告](../../../artifacts/browser-agent/2026-10-30/mv3-integration.json)十组通过，Chromium148/pageErrors0/上游转发0。实际链为中央配对RPC→正常MachineHost拥有的持久端点，再由真实stdio MCP→既有认证Broker→原Registry/机器/节点→WS→MV3/content/DOM，三轮原会话、partial/final、worker强停后unknown无重发、原页晚到完成及草稿保护保持。父Claude任务为受控fixture，不运行原生模型；Provider仍是合成HTML，host为测试预授予，实际可选权限/登录未验。前一版十组MCP接线结果另存[前序报告](../../../artifacts/browser-agent/2026-10-30/mv3-mcp-integration.json)。

本轮实际失败：首次完整MCP文本含多行委派说明，而合成页面user文本被CSS折叠，Driver按可见全文不匹配进入unknown；仅修夹具white-space:pre-wrap后通过，没有放宽产品全文核验。该失败JSON被后续跑覆盖，未保留完整文件。管理测试最初一项错误断言Broker目录undefined导致6/7，[原始失败](../../../artifacts/browser-agent/2026-10-30/management-tests-initial.tap)保留；后加全局unknown夹具未创建coordinator目录导致19/20，[失败日志](../../../artifacts/browser-agent/2026-10-30/management-gates.tap)保留，修夹具后的[专项22/22](../../../artifacts/browser-agent/2026-10-30/management-gates-final.tap)通过；最新260项已覆盖后续独立MCP scope重开反例。不将测试准备失败改写为产品首次通过。

复现最新共享集合：`node --test --test-reporter=tap desktop/tests/browser-management.test.cjs desktop/tests/browser-network.test.cjs desktop/tests/browser-adapter.test.cjs desktop/tests/browser-channel.test.cjs desktop/tests/agent-adapter-contract.test.cjs desktop/tests/machine-host-routing.test.cjs desktop/tests/machine-router.test.cjs desktop/tests/agent-network.test.cjs desktop/tests/agent-connections.test.cjs desktop/tests/connection-capabilities.test.cjs desktop/tests/network-persistence.test.cjs desktop/tests/mcp-continuation.test.cjs desktop/tests/collaboration-broker.test.cjs desktop/tests/delegation-context.test.cjs desktop/tests/coordinator.test.cjs desktop/tests/mcp-local-machine.test.cjs desktop/tests/machine-daemon.test.cjs desktop/tests/daemon-rejection-ssh.test.cjs`。MV3命令与隔离环境见上文，使用临时目录，不读取用户账号配置。

## 配置与输出UI接线

2026-10-30：桌面设置新增BrowserSettings，按来源机器选择（不列WSL/删除或草稿机器），先将无秘密operationId/extensionId意图写入以directory+machineId隔离的localStorage，再调用browser.pair。回应丢失或页面重开只用queryOnly:true查原操作；NOT_FOUND不创建配对、不清空意图。确认后的pairingId可保存，bootstrap/长期密钥不进持久草稿。包只在内存，复制时写剪贴板，不渲染秘密正文，过期清除内存；原配对明确committed或revoked后才可创建另一个浏览器的独立意图，原unknown仍由后端占用门禁阻止别名绕过。撤销在原行先显示具名确认，返回不发请求；确认后原Task不被结算为取消。

扩展manifest新增options_ui，工具栏点击打开实际设置页；同一受信通道新增status/reconnect/pause/resume。连接、原profile、站点权限分开显示；配对包为遮蔽输入，成功后清空。站点request/remove在用户手势内调用公开Chrome API。pause先保存browserEnabled=false再关闭运输和恢复原journal为unknown；resume沿原凭据连接，只补原事件，不能重发Prompt。已有身份拒绝其他pairingId覆盖，无删除/重置身份释放占用按钮。可选host授权确认不是Extension options确认，更不是Provider登录或Task成功。

桌面ToolKind/能力来源增加chatgpt-web/browser-extension，要求原browserInstanceId及准确static-adapter来源才开放被动委派；缺字段/不符仍未知，不能依产品名字猜执行或MCP能力。Browser配置弹窗只解释网页接入/原profile，不访问原生MCP管理、不显示安装路径。native可执行字段可选化后，旧CLI选择排除无路径入口；DSH原配置检测仅对原字符串处理，不为Browser制造可执行文件。输出事件可选mode/revision，连续输出段的显式replace采用完整新版正文，包括纠正/缩短，CLI delta/旧前缀快照与原始事件保持。此处是现有审计/会话展示，不新增日常聊天入口。

沿用已有IBM Plex与设置样式，无视觉系统重设；扩展字体从已有本地字体复制并保留OFL。[界面约束](web-agent-ui-direction.md)。根类型/lint及桌面生产构建通过，[构建日志](../../../artifacts/browser-agent/2026-10-30/desktop-ui-final-build.log)保留既有大chunk提示；根lint不覆盖新增CJS。共享[回归TAP](../../../artifacts/browser-agent/2026-10-30/ui-integrated-regression.tap)286项267通过/19个Linux平台跳过、失败0，覆盖前述260项；新增Browser UI[专项4/4](../../../artifacts/browser-agent/2026-10-30/browser-ui-final.tap)包含正文修订/CLI保持/静态profile能力/配置不出现MCP表单。专项部分与共享重复，不相加。扩展语法与queryOnly专项已运行，[原查询TAP](../../../artifacts/browser-agent/2026-10-30/management-query-tests.tap)7/7。

该片[真实MV3报告](../../../artifacts/browser-agent/2026-10-30/mv3-ui-final-13.json)13组通过，实际生产桌面表单→剪贴板→实际options→正常MachineHost认证通道，再沿真实stdio原Broker运行原会话三轮；重开查原配对、人工草稿、worker失联不重发、原页晚到及pause/resume保身份均验。Chromium148/pageErrors0/上游转发0；Provider与原生父任务仍为受控夹具，生产optional host在主专项副本中预授予。额外用**未修改的生产manifest**运行权限探测：点击授权后1.5秒仍未授予且请求等待Chrome确认，[原始探测](../../../artifacts/browser-agent/2026-10-30/optional-permission-probe.json)。它不是授权成功、拒绝或人工同意证明，未导航Provider/调用模型。

14张最终截图：[桌面浅色顶端](../../../artifacts/browser-agent/2026-10-30/ui/desktop-light-1440.png)、[桌面深色完整Browser区](../../../artifacts/browser-agent/2026-10-30/ui/desktop-browser-dark-1440.png)、[扩展390浅色](../../../artifacts/browser-agent/2026-10-30/ui/extension-light-390.png)、[扩展390深色](../../../artifacts/browser-agent/2026-10-30/ui/extension-dark-390.png)；完整宽度/主题清单及探针结果见JSON的ui。桌面1440/980各有顶端与完整局部，扩展980/768/390各浅/深；无横向溢出，本地字体已加载。Taste在真实页面运行同源导出的probe/layout/app和规则，六个扩展变体无发现；桌面报告保留隐藏旧ReactFlow图例/署名10px，未扩大范围修改，不称全应用通过。Impeccable机械[扫描](../../../artifacts/browser-agent/2026-10-30/impeccable-browser-ui.json)为空。

独立视觉复查先退回两张1440“深色”误捕浅色的证据，原因是测试直接设置dataset被已保存主题覆盖。改为真实主题控件保存、等主题生效及两帧后重拍全部14张；新完整复查逐张打开后对**本次配置UI范围**给出ship、无material fixes。该结论不代表完整Browser目标/Provider/账号/EXE准出；未单独提供QUALITY BAR卡，任务包已给出具体质量标准。界面系统核对另见[继承与范围记录](web-agent-ui-system-check.md)。

本片实际失败保留：[桌面页被测试导航钩子误当Provider](../../../artifacts/browser-agent/2026-10-30/mv3-ui-routing-failure.json)、[首次配对后夹具未显式重扫发现缓存](../../../artifacts/browser-agent/2026-10-30/mv3-ui-discovery-failure.json)、[首个MCP错误](../../../artifacts/browser-agent/2026-10-30/mv3-ui-mcp-initial-failure.json)（初始错误未保留子原因，后续增加安全错误摘要，未据此改产品为重试）、[空测试页拦截失败](../../../artifacts/browser-agent/2026-10-30/mv3-ui-empty-page-failure.json)、[字体断言失败](../../../artifacts/browser-agent/2026-10-30/mv3-ui-font-failure.json)和[主题重拍前报告](../../../artifacts/browser-agent/2026-10-30/mv3-ui-before-theme-recapture.json)。字体问题确为Chrome扩展UA将body改为10.5px/系统字体，产品CSS补body继承后通过；页面路由/缓存/主题问题只修测试。类型构建最初因两处旧CLI/DSH假定必有executable失败，已改为原生路径判断，未给Browser伪造路径。旧静态注册渲染夹具未携Browser profile导致一项失败，修夹具后16/16，[初次失败TAP](../../../artifacts/browser-agent/2026-10-30/browser-renderer-tests.tap)及[修正TAP](../../../artifacts/browser-agent/2026-10-30/browser-renderer-final.tap)分别保留。不能把最后通过写成第一次就通过。

## 只读核对与原操作查询

2026-10-30：Browser Host复用既有ipc.reconcile(taskId,operationId,可选executionId)，保存kind=reconcile原收据。它只调用output.subscribe请求原扩展日志补传，不调用session.create/resume、message.prepare/send或Stop。ACK只能表示订阅收到，Task和核对收据仍unknown；必须收到原绑定/序号的已验证终态，才在同一Host事务中结算Task及其原核对收据。已有终态可立即返回confirmed，不改变该Task历史。重开只恢复原记录/事件观察；查询operation不派发命令，显式再次核对原ID也只有只读订阅。

核对工作运行在Host串行落盘队列之外，避免同WS先到事件等待Host、Host又等待命令回应的相互等待。operationId不得跨Task或在cancel/reconcile间复用；执行ID不符在保存意图前拒绝。扩展补上operation.get，校验原operationId及完整meta后只读返回unknown/confirmed；request.get/output.subscribe同样核对原request/execution/profile/lease/fingerprint，不因找不到操作而创建页或重发。网页取消仍未适配，核对收据confirmed也不是取消证明。Browser离线时canContinue=false，原完成结果仍可读。

新增Host五个反例后[专项22/22](../../../artifacts/browser-agent/2026-10-30/reconcile-tests.tap)，原生IndexedDB新增两个查询反例后[20/20](../../../artifacts/browser-agent/2026-10-30/indexeddb-controls.json)（Chromium148、pageErrors0），旧18项报告保持原文件。最新[共享回归](../../../artifacts/browser-agent/2026-10-30/reconcile-regression.tap)292项273通过/19个Linux平台跳过、失败0，覆盖此前286项，不相加。真实[MV3十四组](../../../artifacts/browser-agent/2026-10-30/mv3-input-final-14.json)通过：worker强停后的原unknown仅补传事件，订阅ACK后仍unknown，实际原页终态到达后原Task与核对操作同时confirmed，发送总次数仍四次；其余三轮/草稿/配对/主题流程保持，Provider与原生父仍受控。

该MV3第一次与共享回归同时运行时第三轮出现unknown，点击总数三次；[原始失败](../../../artifacts/browser-agent/2026-10-30/mv3-reconcile-first-failure.json)保留，但当时未记录Driver固定错误码，原因未查明。后加固定错误码诊断并单独重跑通过，没有为通过而修改产品重试/重发策略；不把这次不稳定性当作已解释的性能问题。实际高负载/后台节流预算仍待矩阵验证。

## 富文本输入、人工归属与错误码

2026-10-30：补实际Chromium contenteditable路径。原insertText在原生DOM中会产生trusted input；多段换行还会转成额外块间距。仅凭isTrusted把此输入当人工会使发送前保护拒绝自己的写入。当前contenteditable只构造转义文本与显式br，通过一次公开DOM编辑写入；用户的尖括号/实体不是可执行HTML。随后发一次input通知并再次全文核对，最后仍只点击一次发送，没有Enter或另一次填写后备。

归属仅在同步写入期间识别**一个**原编辑器上的已测原生input：type/inputType/data、原控件与完整正文均匹配才视为自身；不重置人工输入代次。其他事件、第二个嵌套事件、人工编辑/粘贴/组合、发送/Stop点击与导航仍失去归属。写入后作用域立即清除，人工草稿仍拒绝覆盖。该事件形态只在Chromium148受控验证，不能宣称跨版本/辅助技术或其他扩展绝对互斥。公开DOM可用性不代表当前线上Provider已采用同一结构。

Executor对页面异常只保留白名单BROWSER_固定错误码；其他异常降为BROWSER_PAGE_ACTION_UNKNOWN，不持久化任意错误文本。仍为unknown并保留占用，不据错误码本身推断“未发送”或自动重试。原生IndexedDB新增错误码/私密异常反例后[22/22](../../../artifacts/browser-agent/2026-10-30/indexeddb-input-errors.json)，旧20项报告另存，pageErrors0。

此前真实DOM六组全部通过，原独立JSON被后续扩展套件覆盖；这些覆盖项现包含在[后续10组报告](../../../artifacts/browser-agent/2026-10-30/driver-dom.json)：多行/缩进/字面HTML保持、一轮一次发送；textarea与contenteditable各在输出中真实人工编辑即unknown且后到完成不冒充成功；站点同步改输入/替换控件均零点击；原人工草稿保持。该套件执行实际Driver/content源码与真实DOM/可信事件，但chrome.runtime为受控收据，不能冒充MV3认证链。原始[可信输入探测](../../../artifacts/browser-agent/2026-10-30/contenteditable-input-probe.json)与[多行DOM探测](../../../artifacts/browser-agent/2026-10-30/contenteditable-multiline-probe.json)分别提供浏览器行为证据。

实际MV3链分别运行[textarea十四组](../../../artifacts/browser-agent/2026-10-30/mv3-input-final-14.json)和[contenteditable十四组](../../../artifacts/browser-agent/2026-10-30/mv3-contenteditable.json)，两者均通过、pageErrors0/上游转发0；受控网页均含完整多行委派说明，三轮同Session、worker失联与只读核对、晚到原完成、草稿和暂停恢复保持，不将两组14相加。它们都预授予测试站点host，父任务与Provider为受控夹具。新增JS/手动验收器语法检查通过，前述共享Node292项代码基线继续适用；本片DOM/错误码测试各自记录，不称重新跑过未改动的全部工程。

失败与诊断：[最初富文本失败](../../../artifacts/browser-agent/2026-10-30/mv3-contenteditable-before-fix.json)、[首次修正仍失败](../../../artifacts/browser-agent/2026-10-30/mv3-contenteditable-first-repair-failure.json)、[选择器夹具失败](../../../artifacts/browser-agent/2026-10-30/mv3-contenteditable-fixture-selector-failure.json)及[隔离环境布尔诊断](../../../artifacts/browser-agent/2026-10-30/mv3-contenteditable-diagnostics.json)保留。切换夹具为div后仍保留textarea选择器，造成页面handler初始化失败；因此不能将这些完整链失败全部归因于产品输入逻辑。独立原生DOM探测及正确夹具的六组/十四组区分了来源。临时诊断副本只记录自身Guard布尔值和输入事件属性，不进入生产扩展；最终通过均使用未插入诊断的产品源码，失败时现在也记录pageErrors。没有据此关闭人工输入保护或增加重发。

## 配对期限、导航围栏与首次认证恢复

2026-10-31（Asia/Hong_Kong；UTC为2026-10-30，artifact目录保留原日期标签）：Node对pending配对的pair和resume认证及commit均核对原期限；派生密钥不能让尚未完成的配对越过两分钟期限。已经committed的原派生密钥可在bootstrap到期后重连；原记录/身份仍保留。客户端在存储/连接前严格校验协议、身份、精确扩展Origin、loopback端口、期限、字段白名单及secret/key格式，拒绝未知字段和混装凭据，不消费Provider Token。

后台配置与启动/定时/断线重连共用串行控制队列；首次认证失败且未保存派生密钥时，只允许修正同一原node/pair/profile/Origin/地址的配对包。已存派生凭据不被再次粘贴替换。状态只返回credentialSaved布尔值，options显示“原配对尚未确认”和遮蔽修正表单，保留原身份及失败说明；没有重置日志/占用入口。期限已过的pending仍不能自行换身份续期，撤销与后续接入必须保留原任务边界。新增四张浅深/980与390截图独立完整复查为**ship（仅该状态UI）**，系统记录见[核对页](web-agent-ui-system-check.md)。

实际发现：Chrome标签页loading通知本身不足以证明document已被替换。原来一律失效会把正常会话路径变化也变为unknown；当前在loading/complete观察中核对Chrome实际documentId，同document不失效，不可核对或换document仍unknown，条件限定原document，不能误伤更新后的记录。与此同时Driver在输入前、同步输入后及观察时拒绝search/hash，和持久绑定契约一致，不在临时/未知URL模式发送。

[配对契约29/29](../../../artifacts/browser-agent/2026-10-30/pairing-contract-tests.tap)包含期限与schema反例；该时点[共享296项](../../../artifacts/browser-agent/2026-10-30/pairing-final-regression.tap)277通过/19平台跳过。实际[首次认证修正十五组](../../../artifacts/browser-agent/2026-10-30/mv3-auth-recovery-15.json)通过；另一次[contenteditable实际换document十五组](../../../artifacts/browser-agent/2026-10-30/mv3-document-navigation.json)证明原任务unknown、新document零click、拒绝续聊与pause/resume不重发。实际DOM现为[10/10](../../../artifacts/browser-agent/2026-10-30/driver-dom.json)，新增query/hash输入前拒绝、输入中切模式零点击及输出中切模式unknown/晚到不成功。均Chromium148、受控HTML，无真实Provider/父模型/可选权限同意证明。

[首个导航失败](../../../artifacts/browser-agent/2026-10-30/mv3-auth-recovery-navigation-failure.json)与[移除测试额外导航后仍失败](../../../artifacts/browser-agent/2026-10-30/mv3-auth-recovery-document-failure.json)均保留。测试钩子原有冗余goto已改为只处理初始网络错误文档，不能据此将产品失效问题全部归为夹具；产品documentId修正后分别通过，原loading处理的失败确实保留。此前一次第三轮unknown仍缺明确原因，不能以本修复倒推其原因或压力已验。

本片执行日期与证据文件写入UTC另见[日期核对](../../../artifacts/browser-agent/2026-10-30/session-close-evidence-dates.json)；目录标签不是本地执行日期。

## 空闲会话关闭与原收据恢复

2026-10-31（Asia/Hong_Kong）：新增原IPC `session.close`，输入原taskId、operationId、expectedRevision及可选executionId。沿既有Coordinator→Router→MachineHost原对象来源→Browser Host，不增加Broker或MCP工具。只接受原会话最新轮次、原绑定版本和明确终态；有任何原执行/控制unknown拒绝，不能靠关闭解除占用。旧中央/SSH peer缺browser-session-close-v1在新关闭发送前拒绝，普通读取不因此要求升级。

Node先保存kind=session.close收据unknown及会话closeState，冻结该profile后续提交；扩展在单一IndexedDB事务内核验原meta/最新请求/终态/空闲并写closed墓碑和confirmed原操作。关闭只禁止该桥接Session未来写入，不访问页面、不关闭tab、不删除Provider历史、也不改变Task状态。Node必须收到匹配原request/execution/conversation及closed=true的持久墓碑结果才confirmed；普通ACK不足。原会话canContinue=false，显式新请求可在同profile创建另一独立会话。

关闭回应未知时，重开及重复同操作不再发session.close；查询原ipc.operation仅通过内部operation.get读取原扩展收据。NOT_FOUND/未知/不匹配保持unknown和资源占用；确认后的关闭收据仍不是任务成功/取消。扩展对原meta可核对的忙碌/旧绑定拒绝也原子保存rejected收据；Node只接受匹配原身份的固定拒绝码，关闭控制可结算rejected，原Task/Session保持。普通异常或缺失仍unknown，不能推断未执行。Node/中央/daemon沿原控制收据、维护门禁及pending恢复路径记录，帧版本和经典MCP十工具保持。该接口当前为源码RPC，未增加日常聊天或桌面关闭按钮；网页Stop仍不支持。

验证：Host新增七项后29/29，覆盖丢回应/重开只查询、无墓碑ACK不释放、活跃/旧轮/版本/身份/操作冲突、Node落盘失败零命令；前一阶段[关闭契约55/55](../../../artifacts/browser-agent/2026-10-30/session-close-contract.tap)保留，前一轮[共享317项](../../../artifacts/browser-agent/2026-10-30/session-close-regression.tap)298通过/19个Linux平台跳过、失败0，包含原pending恢复及SSH旧能力拒绝受控反例，覆盖此前296项，不累计。新增“关闭unknown而Task已完成时，后配对不可绕过/原已知独立profile可用”及原持久拒绝只查询反例后，最终[共享319项](../../../artifacts/browser-agent/2026-10-30/session-close-final-regression.tap)300通过/19平台跳过、失败0。关闭unknown会使Agent busy/available=false，不捏造Task执行状态；close收据私有保存关闭时已知profile集合，不向公开操作结果投影。原生[IndexedDB26/26](../../../artifacts/browser-agent/2026-10-30/indexeddb-session-close-final.json)验证关闭原子性、重复原操作、活跃/unknown拒绝、冲突与事务满额回滚；页面接口在该套件为受控对象。

实际[MV3关闭十六组](../../../artifacts/browser-agent/2026-10-30/mv3-session-close-final.json)通过：生产中央控制台账→原机器/对象→认证MV3/真实IndexedDB关闭原会话，Task仍succeeded、原tab仍在且四次点击保持；MCP原会话续聊拒绝，显式新请求创建另一tab并只点击一次，pause/resume不恢复已关闭会话。Chromium148/pageErrors0/上游转发0；Provider与原生父任务仍受控，主专项预授予host，不是线上登录、Linux daemon进程、实际SSH或EXE准出。

复现关闭专项：在隔离Chromium路径下运行 `AGENTBRIDGE_TEST_SESSION_CLOSE=1`、`AGENTBRIDGE_BROWSER_REPORT=mv3-session-close.json` 的 `node desktop/tests/browser-extension-live.cjs`。换document专项改用 `AGENTBRIDGE_TEST_EDITOR=contenteditable`、`AGENTBRIDGE_TEST_NAVIGATION=reload`、报告名mv3-document-navigation.json；这些是测试准备变量，不进入生产扩展。

## 原会话健康检查与完成后的人工新轮

2026-10-31，Windows Node24.12.0/Chromium148。新增原IPC `session.health(taskId, probeId, executionId?)`，复用原对象来源、机器限定ID及认证BrowserChannel的health.check。probeId只关联一次只读观察，不是新的请求/控制收据；不创建tab、Session、Task或权限，不resume、发送、补发或结算unknown。旧中央/SSH peer缺browser-session-health-v1在发送前拒绝，普通原读取继续可用。

Node在短串行段核对原Task和执行、捕获revision，释放队列后请求原扩展，再进入短串行段重查最新轮次/关闭/unknown。这样原输出事件即使先排在同socket的健康回执前，也能落盘/ACK，不形成相互等待。回执身份、probeId、布尔组合不符降为BROWSER_HEALTH_UNKNOWN；异步期间revision/原最新轮次变化则stale。扩展从原IndexedDB核对完整meta、最新request及原document，公开DOM只读检查页面代次、会话、用户锚点、草稿、生成/错误状态；权限撤销、关闭、旧轮或无法读取原document不创建替代页面。

返回online、storageReady、sitePermission（不明为null）、domChecked/pageReady、loginChecked=false、sessionClosed、blocked、stale、taskStatus、ready及observedAt；整体code与独立pageCode分开，过滤任意远端字段/异常文本。ready只是本次页面/本profile资源观察，既不证明账号，也不授予当前关系或未来提交权限。发现投影仍只证明运输/站点授权，不能把其healthy当DOM/模型就绪。缺编辑器只能给登录/结构提示。检查自身不修改原Node Task、扩展请求/锁或控制台账；已知Node写失败锁定会使storageReady/ready=false，不能被健康页面掩盖。

原用户锚点还须是页面最后一条用户消息，不能只因旧锚点仍存在就继续。任务完成后的人工新轮因此拒绝检查/自动续聊，原已完成Task不接受人工轮结果；已派发的新Bridge请求仍按unknown保留，不凭提示码释放。尚未凭这一规则证明同锚点文字编辑或助手重生成已全部识别，完整冲突矩阵继续保留。

已实际运行：Host[34/34](../../../artifacts/browser-agent/2026-10-31/health-host.tap)含事件先到不死锁、探测中换轮、错误回执、离线/unknown与原状态无写；相关[53/53](../../../artifacts/browser-agent/2026-10-31/health-contract.tap)含原Coordinator/机器对象路由、无中央控制记录与旧peer定向门禁。共享[325项](../../../artifacts/browser-agent/2026-10-31/health-regression.tap)306通过/19个平台跳过、失败0，不与子集相加。原生[IndexedDB30/30](../../../artifacts/browser-agent/2026-10-31/indexeddb-health.json)使用实际Chromium数据库、受控Chrome/page接口，覆盖原document、权限/关闭不触页、固定异常码、foreign/旧轮拒绝与状态不改。

实际[MV3健康与关闭19组](../../../artifacts/browser-agent/2026-10-31/mv3-health-close.json)通过，沿生产中央表单、原stdio/Broker和正常机器宿主到真实MV3/原生IndexedDB/实际DOM：三轮健康不改原Task，生成中与worker失联不可用且不结算unknown，关闭后读墓碑不重开。pageErrors0/上游转发0；Provider HTML与原生父任务受控、host仅测试预授予，不证明真实登录/权限同意或Linux Chrome。后续最新用户锚点守卫与人工新轮的DOM/MV3结果另按实际文件补录，不能把此前19组当后续改动已重跑。

最终Node源码[Windows共享327项](../../../artifacts/browser-agent/2026-10-31/health-final-regression.tap)307通过/20个平台跳过、失败0；Host为35项，其中新增已知存储锁定不可ready，原完成结果仍可读。先前34/53/325是当时已跑集合，不跨轮相加。

补强最终提交边界时，先用原`params.binding`但缺失外层userAnchor的真实DOM反例复现[12通过/1失败](../../../artifacts/browser-agent/2026-10-31/driver-dom-before-submit-guard.json)：仅靠prepare/inspect不能保证submit仍检查旧用户锚点。当前ChromePages.submit完整传递原锚点，Driver也从原params独立恢复/核对，并在写入后再检查用户轮是否新增。无原绑定的新Session若已有消息历史，在写入前拒绝。修复后[实际DOM15/15](../../../artifacts/browser-agent/2026-10-31/driver-dom.json)，包含原锚点删除、未跟踪新用户轮、输入中新增用户轮与新Session已有历史；chrome.runtime仍为受控收据，不能冒充MV3。

最新[实际MV3人工新轮18组](../../../artifacts/browser-agent/2026-10-31/mv3-health-manual-turn.json)通过：四轮原执行后以真实输入/点击发送人工第五轮，health拒绝旧锚点、原已完成Task保持原结果；自动续聊保留unknown且无第六次click，暂停/恢复不重发。另[contenteditable健康/草稿18组](../../../artifacts/browser-agent/2026-10-31/mv3-health-contenteditable.json)通过，实际原页草稿只读提示不改文、不点击，节点/Task/原核对与worker恢复保持；两组pageErrors0/上游转发0，均受控Provider/父任务与测试host预授予，不合并为36组或真实Provider证明。

最新[contenteditable实际换document健康18组](../../../artifacts/browser-agent/2026-10-31/mv3-health-navigation.json)亦通过：健康无法读取原document时不选择新页，原Task保持unknown，新document零click；三轮/worker恢复/原核对/暂停恢复保持。该层同为受控Provider与父任务、测试host预授予，pageErrors0/上游转发0，不能替代真实账号或Linux Chrome。

新增自动入口[browser-journal-live.cjs](../../../desktop/tests/browser-journal-live.cjs)运行原生数据库；现有DOM/MV3验证器可指定AGENTBRIDGE_BROWSER_EVIDENCE_DATE及报告名，新片证据进入2026-10-31目录，并记录UTC时间，不再混用旧日期标签。完整健康时序及字段见[技术设计](web-agent-design.md#61-已实现的原会话健康检查)。

## WSL Linux Node进程、通道与扩大回归

2026-10-31，Ubuntu22.04/WSL x64，使用仓库保留的真实Linux ELF Node22.23.1。默认发行版PATH没有node，改为明确使用包内运行时，未改系统安装或用户配置。没有运行模型或生产SSH部署。

新增[独立进程专项](../../../desktop/tests/browser-daemon.test.cjs)和[子进程夹具](../../../desktop/tests/browser-daemon-fixture.cjs)，在私有临时profile启动真实daemon/MachineHost/BrowserManagement/认证WS，原生侧为空。第二个OS子进程使用同profile被DAEMON_ALREADY_RUNNING拒绝，原监听/配对仍可用；停止原子进程后重开沿原daemon/node/端口/profile及持久Task。受控BrowserClient在父测试内存保留凭据/关闭回执并显式丢第一次关闭回应，重开只发operation.get，消息/关闭各一次，原结果保持；维护期间健康只读可达、配对写拒绝。该对端是Node Web Crypto/WS客户端模拟扩展，不是Linux Chrome/IndexedDB/真实Provider。专项[1/1](../../../artifacts/browser-agent/2026-10-31/linux-browser-daemon.tap)；首次[0/1](../../../artifacts/browser-agent/2026-10-31/linux-browser-daemon-initial.tap)为合成事件误带adapterId等禁止字段导致等待超时，改为准确字段并加event.error反例，未放宽产品事件校验。

直接在Windows挂载源码运行扩大集：[302项297通过/5失败](../../../artifacts/browser-agent/2026-10-31/linux-health-mounted-initial.tap)。三个UI文件因Windows esbuild二进制而未开始业务用例；另有生产daemon调用超时、30ms快照源的200ms聚合断言失败。已复用原先下载的Linux esbuild0.28.2，重新核对lock SHA-512、库版本与二进制逐字节：[完整性记录](../../../artifacts/browser-agent/2026-10-31/linux-esbuild-reuse.json)，未改依赖、锁或下载新版本。生产加载超时在路径/负载/Home隔离同时改变后通过，不能据此认定根因或宣称产品修复。

将当时源码逐文件SHA-256核对后复制至Linux原生临时目录；依赖JS树仍链接原目录，Linux esbuild通过ESBUILD_BINARY_PATH指定，HOME/PATH仅对子测试隔离。首个准备目录在后续调用时不存在，[启动诊断](../../../artifacts/browser-agent/2026-10-31/linux-native-launch-failure.json)明确未开始测试，目录消失原因未建立；改为同一Linux进程准备、执行及安全清理，不修改产品。扩大原生目录[320项318通过/2失败](../../../artifacts/browser-agent/2026-10-31/linux-health-native.tap)：副本漏带examples/custom-agent，以及快照五次冷却刷新仍超过200ms。原生目录和串行运行没有关闭此截止问题，未改阈值或相关产品代码。

[原生源码清单](../../../artifacts/browser-agent/2026-10-31/linux-native-source.json)590文件当时一致，[执行元数据](../../../artifacts/browser-agent/2026-10-31/linux-native-execution.json)记录原码运行期间未变、并发1、临时目录已安全清理。补齐示例后单独[Adapter契约7/7](../../../artifacts/browser-agent/2026-10-31/linux-adapter-contract.tap)，[597文件清单](../../../artifacts/browser-agent/2026-10-31/linux-adapter-contract-source.json)/[执行与清理](../../../artifacts/browser-agent/2026-10-31/linux-adapter-contract-execution.json)保留；没有再把扩大集写为通过。

针对最终Node健康/存储状态及Browser相关变动，独立运行[97/97](../../../artifacts/browser-agent/2026-10-31/linux-browser-controls.tap)，涵盖Host、配对/真实WS、管理/原机器路由、原控制查询与独立daemon。该片[源码清单](../../../artifacts/browser-agent/2026-10-31/linux-browser-controls-source.json)/[执行元数据](../../../artifacts/browser-agent/2026-10-31/linux-browser-controls-execution.json)逐文件相符、原码运行期间未变、无根依赖改动且临时目录清理；其后Driver最终提交守卫只由Windows DOM/MV3实际验证，不把Linux Node集合当成Linux页面执行。97项与扩大集/Windows有重叠，不累计。完整Linux/负载、Linux Chrome及Browser跨设备仍待验。

## 未授权页面内容的原子取消与恢复

2026-10-31，继续用户已授权开发。目标是恢复尚未提交的原请求，不能从页面错误码、普通ACK或NOT_FOUND推断未执行。新增contentAuthorized持久门禁：claimSend仅登记发送意图；原页只读预检后，严格IndexedDB事务写true才可调用pages.submit。取消与授权竞争同一事务队列，成功封存使全部后续create/finish/prepare/send/authorize拒绝。旧无字段记录不回填false；已授权/已submitted仍不能走安全取消，也没有网页Stop。

Node先保存原cancel操作unknown并冻结后续派发；creating/preparing用before-message-send，dispatching用message-send-issued。扩展必须匹配完整原meta/operationId/senderFence；有请求时明确false，无请求时仅Node的发送前围栏可以建立未来封存。取消原子保存content-not-authorized-v1、sealedThroughSeq并结算原未完成create/resume、只释放该请求锁，不造假Session，不触碰草稿/页面。Node收齐封存前事件后匹配证明，才将Task.cancelled和取消confirmed同次提交。丢回应只查原operation.get，重复cancel不重发，第二ID不能绕过unknown；自然完成或submitted证据与取消证明冲突时保留原执行事实和未知控制。

[Node Host专项42/42](../../../artifacts/browser-agent/2026-10-31/precontent-cancel-host.tap)，含意图先落盘、失回执只读恢复、ACK/错误身份/错误围栏不能释放、create晚ACK不再prepare/send、写失败不发控制、原完成不被迟到证明覆盖，以及等待原事件游标。实际Chromium148原生[IndexedDB38/38](../../../artifacts/browser-agent/2026-10-31/indexeddb-precontent-cancel.json)，含授权/封存竞争、原请求后续写阻断、旧字段缺失与已授权拒绝、无请求不能证明已派发、其他请求锁保留、取消/授权事务失败不触页。页面/Chrome API在该层受控，不是MV3或真实Provider。

实际MV3首轮[textarea19组](../../../artifacts/browser-agent/2026-10-31/mv3-precontent-cancel.json)通过：正常机器宿主/中央/原stdio MCP/Broker到扩展，人工草稿导致发送前resume拒绝；同原operation封存后Task.cancelled，草稿/四次click保留，人工清空后新request在原Session完成第五次click。该轮早于后续sealedThroughSeq细化及富文本占位修复，不能替代最终源码回归。最新[富文本MV3 19组](../../../artifacts/browser-agent/2026-10-31/mv3-precontent-cancel-contenteditable.json)及[textarea真实stdio cancel_task 19组](../../../artifacts/browser-agent/2026-10-31/mv3-precontent-cancel-mcp.json)分别通过，包含原会话/worker丢失只核对/健康/取消/新轮及暂停恢复；前者取消经原网络RPC，后者明确经过经典cancel_task原Broker授权。Provider HTML/原生父任务受控，host仅测试预授予，均pageErrors0/上游转发0，不将重叠组数相加。

富文本MV3[首次失败](../../../artifacts/browser-agent/2026-10-31/mv3-precontent-cancel-contenteditable-initial.json)保留：原未发送Task已取消，但用户清空草稿后，新轮仍BROWSER_DRAFT_PRESENT且无第五click。实际Chromium最小检查显示fill空值与键盘全选删除均留下`<br>`/innerText换行。Driver现仅识别精确单个无属性裸BR为空占位，不trim空格、人工换行或复杂DOM。新增DOM测试首轮[16通过/1失败](../../../artifacts/browser-agent/2026-10-31/driver-dom-precontent-cancel-initial.json)为同一个受控requestId连续提交两次，命中原content去重；拆分独立页面后[18/18](../../../artifacts/browser-agent/2026-10-31/driver-dom-precontent-cancel.json)，包含清空占位可明确新发、空格和真实Shift+Enter均保留且零click，既有人工干预/新轮/字面输入保护保持。此层chrome.runtime仍是受控收据，不冒充真实MV3。

扩展WS命令仍按接收顺序执行，task.cancel不会抢占正在等待的create/inspect；未取得原持久证明就继续unknown。内容已授权，即使后续DOM返回错误，也不退回false、不因新ID重发。完整取消故障矩阵、实际Provider与Linux Chrome仍未准出。

最新[Windows定向134项](../../../artifacts/browser-agent/2026-10-31/precontent-cancel-regression.tap)133通过/1个平台跳过、失败0；覆盖Browser Host/通道/配对/管理/网络、原Adapter契约、pending恢复、经典Broker/MCP及连接/Browser UI，不把较窄的本次集合冒充前序327项全部重跑。WSL Ubuntu22.04/真实Linux Node22.23.1的[定向104/104](../../../artifacts/browser-agent/2026-10-31/linux-precontent-cancel.tap)，[597份源码清单](../../../artifacts/browser-agent/2026-10-31/linux-precontent-cancel-source.json)和[执行元数据](../../../artifacts/browser-agent/2026-10-31/linux-precontent-cancel-execution.json)证明原生副本hash一致、原码运行期间未变、并发1、HOME隔离及安全清理；包含本次Node取消与原独立daemon，运输Browser对端仍受控，不是Linux Chrome或生产SSH，不覆盖先前扩大集的快照截止失败。

[52文件语法检查](../../../artifacts/browser-agent/2026-10-31/precontent-cancel-syntax.json)逐文件保存node --check结果，不是lint/构建或Provider验收。新增取消时序使用仓库Mermaid在实际Chromium渲染并打开检查：[SVG](../../../artifacts/browser-agent/2026-10-31/precontent-cancel-sequence.svg)/[PNG](../../../artifacts/browser-agent/2026-10-31/precontent-cancel-sequence.png)/[指标](../../../artifacts/browser-agent/2026-10-31/precontent-cancel-sequence-check.json)，1433×1356、32个文本节点，完整封存/授权/原查询流程可读。未改前端布局、依赖锁、公开EXE或生产配置。

复现用[原生数据库入口](../../../desktop/tests/browser-journal-live.cjs)、[真实DOM入口](../../../desktop/tests/browser-driver-dom.cjs)及[MV3入口](../../../desktop/tests/browser-extension-live.cjs)；设置AGENTBRIDGE_BROWSER_EVIDENCE_DATE=2026-10-31、AGENTBRIDGE_BROWSER_REPORT为独立JSON名，AGENTBRIDGE_TEST_CHROMIUM指向本机已安装Chromium。MV3设置AGENTBRIDGE_TEST_HEALTH=1和AGENTBRIDGE_TEST_PRECONTENT_CANCEL=1；富文本另设置AGENTBRIDGE_TEST_EDITOR=contenteditable，textarea则不设置该项。均使用临时隔离profile和拦截HTML，无真实Provider连接。Linux的prepare-linux-native.cjs使用--run及原测试路径，在同一进程完成源码hash核对、测试与受限临时目录清理，元数据记录真实Linux Node版本与输出路径。

[全库文档检查](../../../artifacts/browser-agent/2026-10-31/docs-precontent-cancel-check.json)仍退出1、2243条既有错误；[相对原基线](../../../artifacts/browser-agent/2026-10-31/docs-precontent-cancel-delta.json)新增/移除均0。git diff --check已通过。此处通过的是本片有界检查，不是全库文档、真实Provider或完整目标准出。

## 经典 MCP 原取消只读恢复

2026-10-31，补齐原生调用方的取消恢复入口：经典十工具不增加名称，cancel_task新增可选queryOnly:boolean。true仅查询该原delegation的machine/task/operation；Node侧仍按原父执行或externalConnectionId核对归属。新stdio先用原认证list_agents核对cancel.query-v1，旧后台缺声明返回MCP_CANCEL_QUERY_BACKEND_UPGRADE_REQUIRED，根本不发送可能被旧后台忽略字段的cancel_task。非布尔值在发往后台前拒绝；缺省/false沿原取消动作，兼容已有调用。

查询必须取得匹配原taskId/operationId、kind=cancel及合法状态的收据。其他kind、缺归属、旧格式缺种类或非法状态都不能冒充取消；NOT_FOUND不创建替代操作。confirmed只是取消控制事实，仍另读task_result，不能据此声称native退出或Task.cancelled。该层不迁移Core操作表、不修改扩展协议/帧；旧目标无法给出可核验kind/taskId时明确拒绝推断，保持原记录。

[专项25/25](../../../artifacts/browser-agent/2026-10-31/mcp-cancel-query-contract.tap)验证真实stdio对旧Broker的发送前拒绝、非布尔字段零派发、原delegation所有权、缺记录不创建、其他种类不能确认，以及取消confirmed但原Task仍running；后续补收据状态枚举反例包含在[Windows定向149项](../../../artifacts/browser-agent/2026-10-31/mcp-cancel-query-regression.tap)，148通过/1平台跳过、失败0。该集合加入原Agent连接视图和MCP只读查询，不与前序134项相加。

[实际富文本MV3 19组](../../../artifacts/browser-agent/2026-10-31/mv3-mcp-cancel-query.json)通过：通过真实stdio cancel_task发出原取消，扩展已严格落盘并返回后，在Host channel.request边界故意抛错丢弃该回应；Node维持unknown，重复原取消ID不发第二命令。随后全程用MCP queryOnly取得原扩展证明，报告cancelCommands=1/cancelQueries=1；缺失原operationId只读报NOT_FOUND且不创建控制，草稿和四次click保持，人工清空后明确新request在原Session完成第五次click。故障是受控Host回调边界丢回执，不能冒充生产网络断包/持久磁盘故障。Provider HTML、原生父任务和host预授予仍受控，pageErrors0/上游转发0，不证明真实账号或父模型。

收据状态枚举细化后的[最终MV3 19组](../../../artifacts/browser-agent/2026-10-31/mv3-mcp-cancel-query-final.json)再次通过，取消命令1/原查询1，pageErrors0/上游转发0；不将两轮结果累加。实际Linux Node22.23.1/Ubuntu22.04的[129/129](../../../artifacts/browser-agent/2026-10-31/linux-mcp-cancel-query.tap)涵盖本次stdio旧后台门禁、Agent连接视图、原MCP查询及既有Browser/独立daemon/原pending；[597份源码清单](../../../artifacts/browser-agent/2026-10-31/linux-mcp-cancel-query-source.json)与[执行元数据](../../../artifacts/browser-agent/2026-10-31/linux-mcp-cancel-query-execution.json)记录hash一致、源码运行期间未变、并发1、隔离HOME与安全清理。Browser对端仍是受控Node客户端，不把它当Linux Chrome，也不覆盖之前快照截止失败。

最终[52文件语法检查](../../../artifacts/browser-agent/2026-10-31/mcp-cancel-query-syntax.json)通过，逐文件列出检查结果，不是lint/typecheck或EXE。配套[文档检查](../../../artifacts/browser-agent/2026-10-31/docs-mcp-cancel-query-check.json)仍为2243条既有错误，[相对原基线](../../../artifacts/browser-agent/2026-10-31/docs-mcp-cancel-query-delta.json)新增/移除均0；git diff --check通过。开发仍未完整准出，公开alpha.71、根/桌面依赖锁、生产profile与SSH配置未变。

## 可见对话证明与同锚点人工冲突

2026-10-31，继续完整人工冲突要求。原实现仅比对sessionKey和最新userAnchor，不能识别同消息ID的文本编辑、assistant重生成，以及编辑后恢复原文。当前Driver在原文档跟踪消息级MutationObserver版本及可信编辑/重生成/分支点击；完成时对可见DOM消息的[role,id,text]序列计算SHA-256，并在异步哈希后重查原快照/版本/会话/停止状态。completed新增可选私有continuation={transcriptFingerprint,assistantAnchor,historyRevision}，扩展终态及Session证明同事务提交，Node原Task/Conversation binding同次保存后才ACK；公开Task/MCP不暴露该私有绑定。

续聊先匹配两端原证明、原页与最新用户/回答，再只读哈希，实际输入/点击之间同步复核同一快照。运行中旧消息及当前user的内容/版本保持，人工编辑后恢复原文也拒绝；新assistant自身流动不改写旧锚点。Node只校验证明形状和原事件归属，Core仍Provider无关。旧完成记录没有证明时保留原成功结果、canContinue=false，不回填摘要或换页面假造原绑定。Journal resume不得将原tab/document/pageEpoch替换为新页；Node也拒绝原续轮submitted切document。

可见历史限1MiB、锚点跟踪限8192，达限拒绝建立证明并保留原任务；不截断历史后声称可续聊。这是本实现的保守资源门禁，不是Provider上下文限额。可见文本/渲染结构与瞬时DOM变化可导致保守拒绝，复杂模式、虚拟化完整性、账号/分支和真实站点行为仍须实测；不宣称绝对互斥或可证明同一账号。

初次[实际DOM17通过/1失败](../../../artifacts/browser-agent/2026-10-31/driver-dom-history-initial.json)为旧只读inspect夹具没有提供原完成证明；改为使用实际Driver完成事件后[26/26](../../../artifacts/browser-agent/2026-10-31/driver-dom-history.json)，含独立Node SHA-256核对、两轮原会话、同ID user/assistant修改、修改后还原、可信重生成点击、哈希等待期间变动、写入同步旧历史编辑还原和运行中改写还原。chrome.runtime仍是受控收据，不能当MV3。扩展[原生IndexedDB41/41](../../../artifacts/browser-agent/2026-10-31/indexeddb-history.json)，含证明/旧记录/错误证明/跨document拒绝；首次验证器[未产生浏览器结果](../../../artifacts/browser-agent/2026-10-31/indexeddb-history-launch-initial.json)，[启动环境核对](../../../artifacts/browser-agent/2026-10-31/indexeddb-history-launch-check.json)显示默认Chromium不存在、指定安装存在，显式指定后才完成实测，不把未启动计通过。

Node Host/网络[56/56](../../../artifacts/browser-agent/2026-10-31/history-host.tap)，含旧无证明成功历史不可续、证明字段非法/种类错不推进seq、私有绑定不公开及原续轮换document拒绝。更早[53/53](../../../artifacts/browser-agent/2026-10-31/history-host-initial.tap)是更新受控完成夹具后、尚未加三个新反例的集合。最新[Windows定向152项](../../../artifacts/browser-agent/2026-10-31/history-regression.tap)151通过/1平台跳过、失败0，不与前序149项相加；Provider和真实父模型未运行。

实际MV3[正常富文本/原取消恢复19组](../../../artifacts/browser-agent/2026-10-31/mv3-history-baseline.json)与[同锚点人工编辑18组](../../../artifacts/browser-agent/2026-10-31/mv3-history-user-edit.json)分别通过。后者在受控Provider HTML加入公开DOM编辑按钮，再用真实可信点击修改原user内容、ID保持；原Task结果保留、health提示TRANSCRIPT_CHANGED，新委派保持unknown且没有第五次send，暂停恢复不重发。前者保留三轮续聊、worker恢复/原核对、MCP取消回执丢弃/原queryOnly与明确新轮。均pageErrors0/上游转发0、host仅测试预授予，不冒充真实Provider编辑UI或生产权限同意。

容量守卫细化后[最终实际DOM28/28](../../../artifacts/browser-agent/2026-10-31/driver-dom-history-final.json)，新增1MiB和8192锚点溢出均在输入前拒绝；此前26项是当时已跑集合。最新[MV3同ID人工重生成18组](../../../artifacts/browser-agent/2026-10-31/mv3-history-regenerate.json)通过：可信公开DOM按钮改变原assistant内容、ID保持，原成功结果不改，新轮unknown且无第五次send，pageErrors0/上游转发0。该层依然受控HTML/父任务/测试host预授予；不将多个变体累计。

真实Linux Node22.23.1/Ubuntu22.04的[132/132](../../../artifacts/browser-agent/2026-10-31/linux-history.tap)包含本片Node证明、原机器/通道/daemon及MCP/pending；[597份原生副本清单](../../../artifacts/browser-agent/2026-10-31/linux-history-source.json)/[执行元数据](../../../artifacts/browser-agent/2026-10-31/linux-history-execution.json)证明hash一致、源码运行期间未变、并发1、HOME隔离及安全清理。它不运行Linux Chrome，也不覆盖先前扩大集的快照截止失败。

最终[52文件语法检查](../../../artifacts/browser-agent/2026-10-31/history-syntax.json)通过，不冒充lint/typecheck或打包。未改前端布局、依赖锁、公开EXE与生产配置；本片文档同步包含总体状态、数据/协议/架构与M02/M03/M05/M06/M07/M08的完整设计/测试报告。

[本片全库文档检查](../../../artifacts/browser-agent/2026-10-31/docs-history-check.json)退出1、2243条既有错误，[相对原基线](../../../artifacts/browser-agent/2026-10-31/docs-history-delta.json)新增/移除均0；git diff --check通过。既有错误和生产验收缺项保留，不能据此声明完整开发完成。

上一片静态审查发现取消发生在resume/prepare前、扩展无该轮request行时，session.close/health仍要求该行；当时未做运行反例与修复。下一节记录本片实际复现及以原封存恢复，不能将本片结果倒写为上一片已通过。

## 取消封存到原 Session 健康与关闭恢复

2026-10-31，实际Chromium148原生IndexedDB先复现[41通过/4失败](../../../artifacts/browser-agent/2026-10-31/indexeddb-cancelled-session-before-fix.json)：resume已开始但回应未知，或resume已确认而prepare尚未建立请求行，两种情况下已确认取消后的health/close均REQUEST_NOT_FOUND。它们不涉及真实Provider或父模型，四个失败都是预期恢复行为尚未满足，不能以缺行当未执行证明。

Journal新增内部controlTarget：从同一权威快照核对完整原meta，存在请求时仍核对原行；缺行时必须有原confirmed task.cancel及content-not-authorized-v1/contentAuthorized=false。目标仅能是原adapter/profile的既有Session，同Session其他requestId的相同或更大leaseEpoch意图会阻断旧取消，即使后来轮次尚未完成resume也不回退。health仅读原document/绑定，不造请求、Session或控制，不结算Node尚未知取消；request.get/output.subscribe保持严格缺行NOT_FOUND。close以单事务写既有Session.closed及原关闭收据，私有recoverySealOperationId引用同meta原取消，重开验证引用。无原封存、错meta/资源、新轮次、未知占用、写失败都不得解除原占用或操作页面。

同时补齐prepared继承旧绑定的取消：Node先持久unknown，再以before-message-send取得扩展封存，延迟派发看到原终态后不再resume/prepare/send；只有无旧绑定且尚未派任何命令的全新prepared仍可本地取消。旧本地confirmed没有扩展封存时不补造或迁移证明。原Task/Session/请求及操作ID保持，Source Core/native表、Browser帧和经典MCP工具数不变。

初修[45/45](../../../artifacts/browser-agent/2026-10-31/indexeddb-cancelled-session.json)后补完整边界，[最终原生IndexedDB53/53](../../../artifacts/browser-agent/2026-10-31/indexeddb-cancelled-session-final.json)：包括无封存不读页/不关闭、错原meta、跨profile旧Session、同/更大lease新轮次、写失败回滚、重开原关闭、错误封存引用，以及继承prepared从未发任何session命令也能封存原Session。测试使用真实数据库/Web Crypto，Chrome/page API受控。Node[Host46/46](../../../artifacts/browser-agent/2026-10-31/cancelled-session-host.tap)包含新prepared延迟派发反例；旧Task成功、unknown及原取消回执语义保持。

真实[MV3草稿导致resume拒绝后恢复21组](../../../artifacts/browser-agent/2026-10-31/mv3-cancelled-session-close.json)及[prepared尚未发浏览器命令时恢复21组](../../../artifacts/browser-agent/2026-10-31/mv3-cancelled-session-prepared.json)分别通过。均沿原生产设置/机器宿主/真实stdio Broker与中央/原扩展数据库：取消和关闭各在Host channel.request边界故意丢弃一次已持久回应，再只查原操作；cancel/close命令与各自原查询均一次。取消未核对时health不结算Task；确认后草稿只读拒绝、人工清空后ready；close使原Task仍cancelled、旧成功结果及旧tab四次click保留，原会话不能再续，新明确请求另建tab只一次click。原生DB只读核对证实该取消请求行仍不存在、关闭记录确引用原取消、原既有Session.closed=true。prepared变体另外确认resume/prepare/send调用为0。两组均pageErrors0/上游转发0，Provider/父任务/host预授予受控，不累计为42组或生产网络故障证明。

首个MV3验证器在[读取证明阶段失败](../../../artifacts/browser-agent/2026-10-31/mv3-cancelled-session-close-initial.json)：本机ServiceWorkerGlobalScope拒绝动态import，业务关闭/健康已完成但整组未通过。改成原生IndexedDB只读事务核对同一authority后，两组才通过；没有为通过修改业务协议或放宽证明。测试只读该隔离扩展日志，不读取凭据或生产profile。

复现沿browser-journal-live.cjs及browser-extension-live.cjs，显式指定已安装Chromium和独立报告名。MV3使用AGENTBRIDGE_TEST_HEALTH=1、AGENTBRIDGE_TEST_PRECONTENT_CANCEL=1、AGENTBRIDGE_TEST_CANCELLED_SESSION_CLOSE=1；继承prepared另加AGENTBRIDGE_TEST_CANCEL_PREPARED=1。完整取消/断电/真实Provider/浏览器跨设备/包及长期负载仍未准出。

最终[Windows定向153项](../../../artifacts/browser-agent/2026-10-31/cancelled-session-regression.tap)152通过/1平台跳过、失败0，含本片Node prepared封存与既有Browser/控制/MCP/UI约束。真实Linux Node22.23.1/Ubuntu22.04的[133/133](../../../artifacts/browser-agent/2026-10-31/linux-cancelled-session.tap)通过，[597文件清单](../../../artifacts/browser-agent/2026-10-31/linux-cancelled-session-source.json)/[执行元数据](../../../artifacts/browser-agent/2026-10-31/linux-cancelled-session-execution.json)记录原生副本hash一致、源码运行期间未变、并发1、HOME隔离及安全清理；不将其写成Linux Chrome或真实Provider通过，也不覆盖此前快照截止失败。

新增原封存恢复时序以仓库Mermaid在实际Chromium渲染并打开检查：[SVG](../../../artifacts/browser-agent/2026-10-31/cancelled-session-sequence.svg)/[PNG](../../../artifacts/browser-agent/2026-10-31/cancelled-session-sequence.png)/[渲染指标](../../../artifacts/browser-agent/2026-10-31/cancelled-session-sequence-check.json)，1173×1002、24个文本节点，完整原取消/健康/墓碑/查询路径可读。未改前端布局、依赖锁、公开EXE、生产profile或SSH配置。

最终[52文件语法检查](../../../artifacts/browser-agent/2026-10-31/cancelled-session-syntax.json)通过，逐文件记录node --check，不冒充lint/typecheck、真实Provider或EXE验收。完整目标保持，不因本片恢复通过缩减原平台/故障/原生父模型/打包与Kimi要求。

[本片文档全量检查](../../../artifacts/browser-agent/2026-10-31/docs-cancelled-session-check.json)仍退出1、2243条既有错误，[相对原基线](../../../artifacts/browser-agent/2026-10-31/docs-cancelled-session-delta.json)新增/移除均0；git diff --check通过。公开alpha.71、依赖锁和生产配置保持，完整开发目标未标为完成。

## 剩余开发与限制

2026-10-31本片最终检查：[50文件语法](../../../artifacts/browser-agent/2026-10-31/health-syntax.json)通过；前端未在本片变更，不将前序typecheck/build改写成今天重跑。新增健康时序以仓库Mermaid在实际Chromium渲染，[SVG](../../../artifacts/browser-agent/2026-10-31/health-sequence.svg)/[PNG](../../../artifacts/browser-agent/2026-10-31/health-sequence.png)/[渲染指标](../../../artifacts/browser-agent/2026-10-31/health-sequence-check.json)保留，已打开PNG检查文字与完整流程。验收器初次尺寸断言失败且原值未保存，按SVG viewBox显式设尺寸后通过，未改变图内容。[全库文档检查](../../../artifacts/browser-agent/2026-10-31/docs-health-check.json)退出1、2243条既有错误，[差异](../../../artifacts/browser-agent/2026-10-31/docs-health-delta.json)新增/移除均0；不能记文档全绿。最终git diff --check通过。

2026-10-31关闭阶段的历史检查：[47文件语法检查](../../../artifacts/browser-agent/2026-10-30/session-close-syntax.json)通过；它不是lint或真实Provider验收。[文档全量检查](../../../artifacts/browser-agent/2026-10-30/docs-session-close-final-check.json)仍退出1、2243条原有错误，[相对基线差异](../../../artifacts/browser-agent/2026-10-30/docs-session-close-delta.json)新增/移除均0。git diff --check通过；不据此声明全库文档全绿或完整目标结束。

完整目标继续保留：实际浏览器站点权限确认、真实ChatGPT站点兼容/登录账号/结束判据；完整人工冲突/高负载和故障矩阵；网页Stop、未授权内容取消的完整故障恢复、health/Session close生产环境与完整故障验收；打包/扩展安装包/实际EXE；三种真实原生父Agent、实际跨设备、Linux宿主进程完整负载/故障及Kimi独立DOM Driver。原MCP/机器/通道、配置/正文修订UI、只读原核对和两类编辑器已接线与受控验证，不据此删减上述验收范围。

当前Host依赖既有机器宿主保证同context单写者，不能由多个进程并发创建。状态容量达限保留原数据并拒绝新写，通道已有pending/缓冲/帧预算；生产日志保留与长时/高负载矩阵仍待。上述受控验证不代表完整目标完成。
