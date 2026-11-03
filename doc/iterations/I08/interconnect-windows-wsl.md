# I08：Windows Codex 主调用方与 WSL Codex 目标的真实验收

日期：2026-11-03。用户明确选择 Windows Codex 作主 Agent、WSL Codex 作从 Agent。依据[互联边界](interconnect-boundary.md)与[完整开发台账](interconnect-development.md)，本轮沿原认证 Coordinator、CallerContext、MCP、MachineRouter 和原生宿主执行，不增加模型 API 层。公开 alpha.71 保持；以下是未发布源码及独立原生验收证据。

## 1. 当前结论

2026-11-03更新：原WSL网页登录已完成。用户明确选择原生默认gpt-6.1-sol；旧CLI0.101.0的两次模型拒绝保留，原位升级到0.166.0后，当前Windows Codex主对话经真实stdio MCP沿原CallerContext/Conversation/Native Session取得3条成功正文：挑战文件、无工具回忆续聊、在途观察器关闭/重开后的原结果。原生JSONL也确认实际模型与原工作目录。

另验原取消unknown→查询原operation得到confirmed→原Task实际cancelled；辅助上下文在原Task执行中关闭后立即拒读，由管理员观察原生仍成功完成。辅助首轮网络失败及原三条失败/取消Task保留；总请求/委派现为11/11，原生均已知终态，已关闭上下文的委派缓存running不等于实际存活。

本轮真实成功共4条，其中主会话3、撤权上下文原生1。没有伪造Windows模型父Task或增加模型API；这是当前桌面主对话代码模式消费MCP结果，不代表原生工具目录安装、公开EXE、完整已有服务/交互/产物/适配器/SSH矩阵均准出。安装缓存、日志、备份、浏览器与新增状态在D/E。临时Codex转发进程中途曾退出，已沿原地址/凭据恢复，生产网络持续性未准出。

[完整实测、源码及失败保留](interconnect-development.md#17-原生登录恢复后的真实调用与模型退役门禁)、[脱敏汇总](../../../artifacts/interconnect-core/2026-11-03/native-sol-acceptance-result.json)。下述各轮保留当时版本/失败，不再作为当前登录状态。

## 2. 路径、账户与原请求边界

- Windows 既有安装与配置作为只读输入；将原生 EXE、配套 code-mode host、Node 与验收副本放到 D 盘。Windows 原生 CLI 的 CODEX_HOME、SQLite、USERPROFILE、APPDATA、LOCALAPPDATA、TEMP/TMP 与缓存均在 D 盘；原始配置不写回。首次代理调用不能据此宣称外部CCSwitch服务自身存储也已迁移或全链路零C盘写入，该代理轮次不作为非C盘准出。后续profile准备已在模型启动前拒绝存储位置未核对的本地推理代理；当前原生default不走该代理。
- 原生配置和认证副本只存在用户专属 ACL 的仓库外私有目录，不进入提交、公开证据或日志。隔离 profile 保留所选来源的模型、账户与执行策略，去除原工作区、插件、Hook、旧 MCP 与市场路径；不宣称完整用户 profile 已验。
- WSL 存储已核对位于 E 盘。测试包装设置非 C 盘临时目录/缓存、继承原 Linux 原生账号、过滤 PATH 中的 C 盘入口；只从原私有目录内同属主/600模式文件读取本次出网代理，再调用原生产 bootstrap 与 DesktopHost/MachineHost。未伪造 CLI、换账号/模型或绕开 Bridge 执行子需求。
- 原 WSL 主会话在用户选择新拓扑后沿原取消 operation 执行：实际 Task 已观察到 cancelled，原取消收据 confirmed，子请求 0。没有只凭 confirmed 推定取消；旧记录保留。[原取消与终态](../../../artifacts/interconnect-core/2026-11-03/old-wsl-parent-retirement.json)

官方 [Codex 配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)和[MCP 配置](https://learn.chatgpt.com/docs/extend/mcp)用于核对目录及临时 MCP 参数；实际版本、可用性和验收结果以本地运行证据为准，不以当前文档替代旧版本实测。

## 3. 两次实际运行与错误定位

本节为额外独立 Windows CLI 的历史尝试；其“子请求0”不覆盖当前桌面对话的真实委派及续聊。

| 场景 | 实际结果 | 证据与限制 |
| --- | --- | --- |
| Windows 安装副本前置 | 0.164.0 可启动，EXE SHA-256 与原安装一致；模型/供应商配置与当时活动配置一致 | [安装前置](../../../artifacts/interconnect-core/2026-11-03/windows-native-profile-preflight.json)，模型 0 |
| WSL 冷启动首轮 | 验收脚本过早用第一次 snapshot 断言就绪，需求发送前失败；改为等待实际宿主就绪，不更换节点/目录 | [保留首轮](../../../artifacts/interconnect-core/2026-11-03/windows-wsl-startup-first.json)，父/子需求 0 |
| 活动配置的 Windows 主任务 | Task failed，原生错误为 CCSwitch 本地代理的当前 Provider 缺少 base_url；未发生 Bridge 委派 | [原生失败摘要](../../../artifacts/interconnect-core/2026-11-03/windows-live-proxy-failure.json)、[完整运行摘要](../../../artifacts/interconnect-core/2026-11-03/windows-wsl-native-current.json) |
| 当前 default 保存的原生配置 | 只读核对 CCSwitch 当前记录：原生配置仅指定原模型并保存 OAuth，没有自定义 API Provider；模型与活动配置相同。仅在新私有 profile 复用该选定记录；未修改 CCSwitch 或选择其他供应商 | [来源核对](../../../artifacts/interconnect-core/2026-11-03/windows-selected-native-preparation.json)、[新 profile 前置](../../../artifacts/interconnect-core/2026-11-03/windows-native-default-profile-preflight.json)。这不证明 CCSwitch 代理链通过 |
| 原生 default 的 Windows 主任务 | Task failed，workspace routing discovery unauthorized (401)，原生辅助认证亦报 invalid_jwt；Bridge 工具调用 0、子请求 0 | [认证失败摘要](../../../artifacts/interconnect-core/2026-11-03/windows-native-auth-failure.json)、[原生运行摘要](../../../artifacts/interconnect-core/2026-11-03/windows-wsl-native-default-current.json)。需要原生重新登录，不是切换模型重试 |

两次父任务都已实际终态，未将 observation timeout 当成失败。新 profile 的运行发生在前次失败且子请求 0 经核对之后；没有以新 ID/profile 释放 unknown。后续如需另一验收 attempt，必须先核对旧父意图/Task 和子委派均已明确结束；同一未完成 attempt 只能恢复观察与原查询。

## 4. 闭环完成条件与源码

当前桌面主调用方已实际 list_agents、选择获准的 WSL BuildAgent，以稳定 requestId 委派读取随机验收材料并用原 task_result/事件页观察。task_pending 返回空列表，不代表适配器支持权限/表单。三条原 Task 已实际终态；观察器重开后同上下文、原子会话和原生绑定已核对，正文、成功回忆续聊及凭据轮换仍未通过。独立 CLI 用例另要求原父/子 Session 与实际完成的 Bridge 调用核对，不能由模型自报替代。

调用审计只在原 scopedCollaborationTool 成功返回后记录方法名，可能包含内部授权视图检查，不将其计为全部由模型显式发起；不替换返回、不伪造 Native 结果。当前主模型通过 Shell 启动薄 MCP 传输客户端和准备测试参数，没有直接读验收材料或绕过 Bridge 执行子需求。独立 CLI 脚本仍要求父任务仅使用 Bridge 工具。该组合的 Codex 不声明权限/表单能力，普通消息与结果证据不能替代其他适配器的真实权限/表单、SSH、EXE及完整生命周期验收。

| 源码 | 职责 |
| --- | --- |
| [Windows profile 准备](../../../desktop/tests/interconnect-windows-profile.cjs) | 只读原配置输入、私有非 C 盘副本、模型绑定校验、恢复时不覆盖刷新后的认证 |
| [真实双平台验收](../../../desktop/tests/interconnect-windows-wsl-live.cjs) | 实际 native CLI、生产 WSL transport、明确目标、原意图、两回合、轮换/重开和安全方法计数 |
| [当前桌面对话入口](../../../desktop/tests/interconnect-current-chat-live.cjs) | 真实 Coordinator/CallerContext/WSL 宿主，不建立假父 Task；原操作收据恢复配置，未终态拒绝关闭观察器 |
| [代码模式 MCP 传输](../../../desktop/scripts/interconnect-peer-call.cjs) | 真实 initialize、tools/list、tools/call；不做任务规划、模型调用或结果模拟，回应不明不自动重发 |
| [临时网络转发](../../../desktop/tests/interconnect-native-network-relay.cjs) | 仅回环、独立传输凭据、三个原生官方域名443的CONNECT；TLS不解密，重开复用原端口/凭据，原端口仍绑定时拒绝覆盖 |
| [WSL 原生登录](../../../desktop/scripts/interconnect-wsl-native-login.sh) | 原Linux账户/安装/profile与本次非C网络环境；设备码或浏览器交互登录，授权内容不写验收日志 |
| [WSL 环境包装](../../../desktop/tests/interconnect-wsl-native-bootstrap.sh) | 非 C 盘临时/缓存与原 Linux profile，随后调用原生产 bootstrap |
| [attempt 保护](../../../desktop/tests/interconnect-native-case-guard.cjs) | 新 attempt 不绕过旧父/子 unknown；原 attempt 可只读恢复 |
| [原生设备登录脚本](../../../desktop/scripts/interconnect-native-login.ps1) | 核对原 profile/EXE 绑定，在 D 盘进行用户原生登录；不采集验证码或 Token，不修改用户全局环境 |

## 5. 已完成的验证

Windows Node24.12.0；新增受控测试使用 D 盘配置、临时目录与日志，模型 0。

| 验证 | 实际结果 | 原始证据 |
| --- | --- | --- |
| profile 首轮 | 3/4；一项把 TOML 表与普通对象做 deepStrictEqual，因原型差异失败；修正夹具比较为同样解析后的原表，未放宽产品配置校验 | [保留失败](../../../artifacts/interconnect-core/2026-11-03/windows-profile-controlled-first.tap) |
| profile 定向复核 | 4/4；模型/账户/原权限保持、源文件不写回、排除旧路径、刷新认证不被覆盖、模型绑定变化拒绝、C 盘目标拒绝 | [4项](../../../artifacts/interconnect-core/2026-11-03/windows-profile-controlled-final.tap) |
| profile 与 attempt 保护 | 10/10；另含旧父未知、无原收据意图、旧子未知拒绝新 attempt，同一明确上下文的原观察恢复，以及存储未核对的本地推理代理在原生启动前拒绝 | [10项](../../../artifacts/interconnect-core/2026-11-03/windows-wsl-controlled-final.tap)，与4项重叠不相加 |
| 脚本工程检查 | 新增 CJS lint 通过；登录脚本语法及 ValidateOnly 路径/哈希校验通过，未启动登录 | [lint](../../../artifacts/interconnect-core/2026-11-03/windows-wsl-harness-lint.log)；登录动作等待用户 |
| 当前桌面真实主调用方 | 十工具目录、获准发现、真实原生执行/事件/取消与重开后原会话归属已观察；三Task为cancelled/failed/failed，后两次原生401 invalid_refresh_token，尚无正文/成功续聊或轮换 | [当前摘要](../../../artifacts/interconnect-core/2026-11-03/wsl-native-repair-current.json)、[原接入](../../../artifacts/interconnect-core/2026-11-03/current-windows-chat-setup.json) |
| 实际网络与传输门禁 | Windows直连认证TLS/200，WSL直连TLS超时；WSL经临时通道TLS/200。无代理凭据407、范围外目标/端口403、普通HTTP405四项及原绑定覆盖拒绝一项通过，均不调用模型 | [Windows](../../../artifacts/interconnect-core/2026-11-03/windows-native-network-head.json)、[WSL直连](../../../artifacts/interconnect-core/2026-11-03/wsl-native-network-head.json)、[修复通道](../../../artifacts/interconnect-core/2026-11-03/wsl-native-network-relay-probe.json)、[四门禁](../../../artifacts/interconnect-core/2026-11-03/native-network-relay-guards.json)、[原绑定](../../../artifacts/interconnect-core/2026-11-03/native-network-relay-binding.json) |
| 原生认证恢复 | 同账号较新缓存只读比对后暂用于WSL，模型/供应商不改；真实原生服务仍拒绝，已回滚。设备码登录退出1；浏览器登录等待，未宣称认证通过 | [缓存恢复](../../../artifacts/interconnect-core/2026-11-03/wsl-native-auth-cache-repair.json)、[回滚](../../../artifacts/interconnect-core/2026-11-03/wsl-native-auth-cache-rollback.json)、[两次错误及登录状态](../../../artifacts/interconnect-core/2026-11-03/wsl-native-refresh-failure.json) |
| 当前入口工程检查 | 当前入口/薄传输两个CJS及网络转发CJS按既有CommonJS规则lint通过；两份WSL脚本bash语法与登录ValidateOnly通过。首轮lint配置/条件表达式错误保留。直接调用旧npm入口时未带Node PATH的help失败后，改用原Node读取真实login help，确认支持设备码参数；不计模型通过 | [入口lint](../../../artifacts/interconnect-core/2026-11-03/current-windows-chat-lint.log)、[保留首轮](../../../artifacts/interconnect-core/2026-11-03/current-windows-chat-lint-first.log)、[网络lint](../../../artifacts/interconnect-core/2026-11-03/native-network-relay-lint.log)、[脚本检查](../../../artifacts/interconnect-core/2026-11-03/wsl-native-login-validation.json) |
| 原生绑定 | 三条原Task均有native绑定，原生Session及原子Agent会话相同；Task为cancelled/failed/failed；浏览器登录仍等待。绑定相同不证明正文续聊成功 | [原绑定核对](../../../artifacts/interconnect-core/2026-11-03/wsl-native-original-session-proof.json) |

此前互联核心两平台各104/104及三适配器受控链3/3保留于[完整台账](interconnect-development.md)，不能与这里相加或用来关闭本轮真实认证错误。公开 alpha.71 不含这些新接口，未重新打包发布。

本轮主文档、模块报告与开发台账已按当前入口同步。实际执行 `node scripts/check-docs.mjs` 仍因历史缺失失败：2243项，较原基线新增0、消失0；没有补造历史材料。[检查结果](../../../artifacts/interconnect-core/2026-11-03/docs-wsl-native-repair.json)、[逐项基线比较](../../../artifacts/interconnect-core/2026-11-03/docs-wsl-native-repair-comparison.json)。当前仅新增验收支持，没有变更产品运行时、协议或数据模型。

30份本轮文档/证据按实际私有认证值及调用方身份检查，未发现明文；检查只输出命中数，不输出秘密。回滚后已清理仓库外Windows认证候选副本，Windows源文件读取前后保持，原WSL备份仍在E盘私有目录供恢复使用。正在等待的原生登录、临时网络及观察器保留。[公开证据检查](../../../artifacts/interconnect-core/2026-11-03/wsl-native-evidence-redaction.json)、[私有副本清理](../../../artifacts/interconnect-core/2026-11-03/wsl-native-private-cleanup.json)。

## 6. 后续恢复

本次WSL出网通道已恢复；三条原Task均有明确终态，原请求/取消收据和会话记录保留。当前只需在已打开的WSL原生浏览器登录窗口完成账号验证，不发送验证码、Token或auth.json。实际观察原生登录成功后，仍沿原CallerContext及原子会话发送新的明确消息，不重放已结束的旧请求，再验正文、回忆续聊和凭据轮换。临时代理与观察器保持，以支持正在等待的原生登录；不以登录窗口打开、login status字样或网络200当作模型通过。

原生自动刷新、设备码及受信任机器间登录缓存恢复的依据为[官方OpenAI Docs认证说明](https://learn.chatgpt.com/docs/auth?surface=cli)。实际0.101.0的刷新结果和登录退出码以本次实测为准，不用当前文档推定旧版本一定可登录。

以下 Windows 登录步骤只用于继续额外独立 CLI 用例，不是当前桌面主调用方的前提：

在 PowerShell 调用上述登录脚本，ProfileRoot 指向本次已准备的仓库外非 C 盘私有根。它使用原安装的 D 盘副本执行原生设备登录，验证码仅在用户终端显示；用户只需告知已登录，不发送验证码、Token 或 auth.json。

独立 CLI 登录后保留所有失败记录，确认 native 登录与原任务状态，再使用明确的新 attempt 验证；未完成的旧请求只查询。当前用户已明确主从平台，不再要求重新选择环境。当前真实委派结果仍待 WSL 原生执行返回。

## 7. 普通WSL终端的codex启动修复

原修复只向验收宿主导出代理环境，用户普通zsh没有继承，直接启动的Codex进程仍走超时的直连。另一次只读核对发现，原交互登录进程已退出，而started标记留存；此前“窗口已打开”不能当作当前存活证明。此次没有终止无法再次确认身份的用户进程；只记录其身份已变化，不盲目按旧PID结束程序。

新增[仅Codex的启动包装](../../../desktop/scripts/interconnect-wsl-codex.sh)，保留原Linux安装、账号、模型和参数，读取同属主/600的私有网络文件，拒绝C盘工作目录与失效通道，通道不可用时有界报错。版本/help与本地login status不依赖出网。只在原用户.zshrc末尾追加明确标记的codex函数，原文件已备份到E盘私有目录，不向全局shell导出代理变量，也没有更换原生安装或更新模型。包装引用当前D盘源码和本次临时通道，属于本机验收环境修复，不是产品新增任务Runtime或账号层。

当前已卡住的旧窗口先退出原启动，再在WSL中重新加载；新打开的交互式zsh会自动加载：

```bash
source ~/.zshrc && codex
```

[原生登录观察器](../../../desktop/scripts/interconnect-wsl-login-worker.cjs)以独立Linux进程持有原生codex login，记录PID与进程出生值并在重入时核对，避免终端退出留下假等待。授权URL只经私有控制文件交给D盘隔离浏览器，原生输出在内存解析后丢弃，不写工具/验收日志；没有读取网页登录密码或替用户确认身份。登录成功仍须核对原生退出0及原auth文件刷新，不以浏览器存活代替登录完成。

实际检查：新的交互式zsh约3.3秒完成函数解析及原CLI0.101.0版本返回；PTY下完整原生界面约8.2秒出现目录信任提示，未确认信任、未提交业务消息，仅结束自建探针。新的登录观察器/原生进程及隔离浏览器已实际存活，网页登录仍等待。[命令入口](../../../artifacts/interconnect-core/2026-11-03/wsl-codex-command-installed.json)、[交互shell及登录进程](../../../artifacts/interconnect-core/2026-11-03/wsl-ordinary-codex-proof.json)、[完整界面](../../../artifacts/interconnect-core/2026-11-03/wsl-ordinary-codex-tui.json)、[原卡住进程的保守处理](../../../artifacts/interconnect-core/2026-11-03/wsl-original-startup-interrupt.json)。以上为原生启动/网络证据，真实模型回复、成功正文续聊和凭据轮换仍未准出。

## 8. 登录恢复前的当时结论（历史）

当前 Windows Codex 桌面对话已作为真实主调用方，经真实 stdio MCP 与生产 WSL 宿主执行 Codex **0.101.0**。已实际发现目标、委派及读取原事件；网络修复后原生认证服务明确返回 **401 invalid_refresh_token**，尚无成功正文，**闭环未通过**。三条真实 Task 均在同一原 CallerContext 与原子会话：初次卡住的 Task 沿原取消操作实际 cancelled；网络修复及同账号缓存恢复后的两次续聊均实际 failed，不把 unknown 或等待超时当终态。[当前汇总](../../../artifacts/interconnect-core/2026-11-03/wsl-native-repair-current.json)、[原生刷新错误](../../../artifacts/interconnect-core/2026-11-03/wsl-native-refresh-failure.json)。

当前主入口不需要另起 Windows CLI 或先刷新其隔离 profile。此前 Windows CLI **0.164.0** 的两次失败另列。已自行查到 Windows 现有网络能完成认证站点 TLS、WSL 直连超时；临时、仅回环监听且需独立凭据的 CONNECT 转发已使本次 WSL 验收通道完成 TLS 并取得认证站点200，不新增模型 API、不解析 TLS 正文、不改全局网络或模型配置。原二月缓存与只读核对的同账号六月缓存均被原生服务拒绝；缓存恢复试验已回滚并保留原备份。设备码登录退出1，当前独立WSL原生登录观察器持有浏览器认证，等待账号持有人验证；授权URL仅用于私有交接状态及用户浏览器，不进入公开证据。

用户随后反馈普通WSL终端输入codex卡住。已补齐仅针对Codex命令的出网包装；新的交互式zsh能解析到包装函数，真实原CLI完整界面约8秒显示原生目录信任提示，没有提交业务消息。原登录窗口进程退出而旧“started”标记仍在的问题已识别，当前改为独立原生登录观察器，并实际核对观察器/原生进程及D盘隔离浏览器存活，尚未完成身份验证。见第7节，不以旧标记或仅调用Start-Process推定仍在登录。

代码模式由当前模型选择目标、调用并消费真实返回；未伪造 Windows 父 Task、另起推理层或验证桌面原生工具目录安装。每次新消息均在前一原 Task 明确终态后发送，保持原会话/作用域，不复用旧 requestId 重执行，也不以更换入口释放 unknown。既有失败/取消Task的凭据轮换、观察器重开与原记录恢复已验证；成功的同会话正文续聊和在途恢复仍未完成。

随后已独立完成原三条真实Task的读取归属验收：原CallerContext凭据轮换、旧Bearer拒绝、观察器关闭/重开、跨上下文隔离及操作/目标授权撤销读取累计18项通过，原操作权限与目标已恢复、请求3→3。没有新需求或成功正文，也没有模拟真正丢提交回应；不能替代在途恢复、成功模型续聊及已有服务完整生命周期。[完整实测与原目标审计](interconnect-development.md#13-基于三条真实原生task的读控恢复验收)、[最终只读复核](../../../artifacts/interconnect-core/2026-11-03/native-owner-recovery-verify.json)。

