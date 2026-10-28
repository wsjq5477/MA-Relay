# M10 构建与发布测试报告

当前公开alpha.68已收录本模块本轮改动；冻结38cd637，EXE与源码/实际载荷匹配，普通EXE独立合成profile恢复及整个后台重启通过。源码受控、真实原生组件与普通EXE结果分别记录，未进行真实用户profile恢复或新增模型轮次。[发布、证据和未准出项](../../iterations/I08/alpha68-release.md)。


## 当前源码字体资源（2026-10-28）

M10-F01/F03；本地alpha.68工作树，Windows Node24.12.0、Edge157.0.4341.16。TypeScript/Vite生产构建通过，两个WOFF2输出与原始资源逐字节摘要匹配，OFL许可已随源资源保存；生产浏览器实际加载Sans及展开路径后的Mono，外部HTTP请求0。仅为前端构建与加载证据，未构建/验证新EXE、ASAR或刷新公开alpha.67的产品输入清单。[字体产出核对](../../../artifacts/taste-impeccable/2026-10-28/font-output.json)、[构建日志](../../../artifacts/taste-impeccable/2026-10-28/build-verified.log)、[浏览器报告](../../../artifacts/taste-impeccable/2026-10-28/verified/report.json)；完整来源与限制见[迭代](../../iterations/I08/taste-impeccable-ui.md)。

2026-10-27 / alpha.67公开：Windows受控22/22、独立Ubuntu适配109/109/Core71/71及正式Hermes0.22.5原生MCP五组通过。Windows→WSL Node24.13.0→Hermes两轮、原ID去重、通道重开/同Session续聊与配置字节保持通过；两原传输退出0。原生持久会话只读核对两用户/两助手消息、API2/工具0；临时网络通道已停止，WSL直连未修复。实际EXE七组模型0、212输入/58后台/84Core/1723Linux及载荷一致。首轮Core70/71、旧就绪失败及临时验收目录后续缺失如实保留，完整矩阵未准出。[全部分层证据与边界](../../iterations/I08/alpha67-hermes-linux-live.md)。

2026-10-27 / alpha.66公开：Windows Node24.12.0受控定向39/39；独立Ubuntu Node24.12.0适配100/100、Core71/71；本机Ubuntu22.04/WSL使用包内Node22.23.1及冻结后台，对正式Hermes0.22.5完成发现和原生MCP五组/十工具，独立Ubuntu原生组件亦通过。普通EXE七组通过，均模型0。WSL直连TLS仍有问题，临时安装通道已停止；普通doctor90秒未完成，pm doctor退出0且所有已安装运行组件通过。真实Linux模型、SSH、冷启动与完整矩阵未准出。[本轮环境、原始失败与证据](../../iterations/I08/alpha66-hermes-linux.md)。

2026-10-27 / alpha.65 / Windows Node24.12.0：共享Hermes定向31/31，扩展73项72通过/1个Pi原基线失败，不能跨模块相加。已安装Hermes0.22.5、冻结Windows后台原生MCP五组通过（模型0）；真实执行/续聊两轮通过，但首轮参数拒绝、早期心跳EPERM及验收器原生配置字节比较失败均保留。普通EXE/发布状态按[专项](../../iterations/I08/alpha65-hermes-windows.md)逐项登记，不把源码结果当作EXE/父模型准出。

## alpha.64构建与受控验收（2026-10-27）

M10-F01/F02/F03/F05/F06；Windows Node24.12.0、Electron44.7.0、electron-builder26.15.3、Edge157.0.4341.16。公开EXE132227581字节，SHA-256 `86b8aad407400754d77012c9d873a19dd52a6576c59cc6c568a3f503705446dd`，58后台/84Core/1720Linux及ASAR/前端/bootstrap、实际EXE载荷一致。源码定向155/155；包内撤权14/14、关系37/37、传递14/14、收据4/4、兼容29/29，认证管道/重启另记录；图12组与控制台6组通过，模型0。普通EXE前五组及同一原profile重启/退出补验两组通过，两个附件uploaded且匿名HTTP200完整下载/摘要匹配。第三轮验证器提前attach的ENOENT已在master修正并接续补验，冻结产品/EXE字节未变。WSL服务不可用，未更新历史全量/原生/SSH准出；首次构建缓存EXDEV、ASAR路径误报、前端准备路径失败和普通启动120秒未就绪均保留。[完整原始证据、重试与未测项](../../iterations/I08/alpha64-release.md)。

## alpha.63实际WSL持续连接（2026-10-25）

原生产Windows→WSL HostConnection、实际Ubuntu/原生Codex0.162.1列表与Linux通用stdio客户端：15分钟180/180原宿主/驱动/connectionId保持，原生配置摘要不变，任务/委派/模型0；删除/宿主重开不补装、撤权、轮换、移除共六组通过。原Windows启动进程退出、两客户端停止和Linux残留0已确认；这是MCP组件，不是原生父模型，未停止/冷启动发行版或部署SSH。历史入口前失败和完整稳定性仍未准出，原有全量不相加。[实际样本、首次测试路径失败、清理及边界](../../iterations/I08/native-mcp-lifecycle.md)。

## alpha.63普通窗口关闭后的原生MCP（2026-10-25）

普通无调试EXE + 系统Node24.18.0 + 原版Pi1.4.0 MCP组件七组通过；三次原窗/包装进程均退出0且解包文件删除，原生客户端仍可读取原工作/原包/完整接收收据。原生重开、三个不同解包路径和完整Coordinator重启后原端点身份/配置字节不变；最终所有原进程确认退出，模型0。仅原工作MCP22工具组件，非经典独立连接/托管任务/真实父模型，其他入口/SSH/跨版本仍待；共享组不相加。[最终证据与验收器收尾修复](../../iterations/I08/native-mcp-lifecycle.md)。

## CT-05原包传递候选（2026-10-25）

本地alpha.63打包与资源校验通过：57后台/84Core/1715Linux、ASAR/前端/bootstrap一致；EXE130203473字节、SHA-256 `2ba100ea01ceee057bed3a03763b92a442c75bd4b094ed70873608f49157b40a`。冻结后原生Pi/Hermes组件7组通过，模型0；Windows传递14/14、原收据4/4、关系37/37、兼容26/26、新审计页面5组/控制台6组及普通EXE6组通过，原包/确认时间/发送收据重开保持，未签名/未公开/未部署SSH。[完整证据与边界](../../iterations/I07/context-delivery.md)。

2026-10-25：冻结alpha.62对原真实SSH只读三组通过，认证/指纹、原37清单1459项、两次非接管检查及原PID/配置保持，模型0；完整故障/版本切换与普通EXE联合流程仍未准出。产品无变更，[当前证据](../../iterations/I08/alpha62-ssh-readonly.md)。

2026-10-25后续：alpha.62普通EXE五组与真实驱动码0已通过，原主窗口三次正常关闭、重开和完整后台重启均保持原SQLite/收据。旧失败来自脚本重新枚举到无标题辅助窗，原报告保留；产品未改，模型0。[原窗口绑定、负向保护及分层证据](../../iterations/I08/window-lifecycle-verifier.md)。

2026-10-25本地alpha.62配置/审计控制台：最终Core71/71、桌面928/928、原收据/审计专项78/78及Windows生产页面6组通过；pageErrors=0、新执行尝试0，模型0。覆盖原ID/完整指纹/页面重开/并发变更与损坏记录保护、默认只读/显式原任务恢复、权限变更正文保持。共享计数不相加；普通EXE与包交付状态统一见[本片分层证据](../../iterations/I07/configuration-console.md)。公开alpha.60及完整原生/图/WSL/SSH边界保持。

## WSL当前启动与入口定位

2026-10-25，公开alpha.60冻结资源真实Windows→WSL独立启动20/20；60条environment/snapshot均在原握手后发送，无重放，20个Windows启动进程退出0，事后Linux匹配宿主残留0，模型0。原8项就绪/关闭代次边界8/8；原始WSL四条件80条中1条在首写入口标记前失败，Windows/Linux直接观察80/80一致，未把该失败或历史9/20改成通过。未测试冷启动、持续原生连接、独立SSH或普通窗口图反馈；computer-use初始化仍被WSL路径元数据拒绝，窗口输入0。产品/包无改动，[全部证据、驱动首次失败与未准出](../../iterations/I08/wsl-launch-origin.md)。共享计数不累加。

## alpha.60原生客户端连接策略复验

2026-10-25，公开alpha.60冻结后台56份原摘要逐项一致：真实原生Pi1.4.0在Linux/Windows、固定源码Hermes在Linux各7组通过，含十工具schema、连接/断开、范围外明确允许/拒绝、原ID/历史确认与缓存撤权；临时Home与受控发现/宿主/用户RPC，模型/原生任务/委派0。原Task/Session生命周期、真实父模型和独立SSH未补验；Hermes不是正式安装版/Windows原生。本轮仅验收/夹具和文档，无产品或新包，37/37是共享夹具相关回归，不覆盖当前alpha.61全量。[完整证据、失败与边界](../../iterations/I08/native-policy-components.md)。

## alpha.61 失败清理候选

T-M10-CLEANUP / M10-F01/F02/F03：2026-10-24，WSL Node22.23.1交叉构建Windows x64便携包，Windows Node24.18.0 / Edge155隔离验证，模型0。EXE130211264字节，SHA-256 `f2ac27eb331b30858de0da0fbf72867adaf42d50574fdff8664b60048fdc4948`；56后台/84Core/1714Linux及ASAR/前端/bootstrap匹配，175个冻结源码/依赖文件重算一致。桌面921/921、核心71/71、兼容26/26、生产页面4组、普通无调试EXE恢复7组与包内协议6组通过，Downloads完整SHA一致。未签名/未公开，未切换日常后台/部署SSH；真实1.2.22/模型/日常profile及完整准出未测。首次包因修复中源码变化被校验拒绝，冻结后重建；所有日志见[完整交付](../../iterations/I08/failed-operation-cleanup.md)。共享计数不跨模块相加。

当前公开alpha.60：CT-08-A3连接工具/预授权/用户确认与策略页面，41份原daemon清单；EXE130212267字节，SHA-256 `d74c711b8475e84834519c8509a12a63351c1864a5ed4c01559588dc1fdc9cf6`。56后台/84Core/1713Linux及ASAR/前端/bootstrap一致；源码900/900、Windows包内37/37和实际中央管道/重启、兼容26/26与9,665,523字节输入、生产页面4组、普通EXE4组及Downloads完整SHA通过，模型0。发布前142个产品/依赖文件与构建时冻结摘要逐项复核一致，EXE与校验附件已上传并经匿名完整下载核验；未签名、未切换日常后台/部署SSH；真实原生多主/图100ms/WSL和完整SSH仍未准出。[发布证据](../../iterations/I08/alpha60-release.md)、[完整交付与原始失败](../../iterations/I07/connection-policy.md)。
alpha.56冻结包图管线诊断（2026-10-24）：默认渲染含tracing的完整20条PNG p95 363.722ms未达100ms，本地同步p95 1556ms通过；GPU提交停顿与部分慢样本重叠，软件渲染诊断仍112.902ms失败，不能据此关闭产品GPU或宣告准出。实际冻结前端/后端配受控20机器/60节点/59边，模型0；仅验收器增加诊断模式，产品与EXE未变。[完整报告](../../iterations/I06/alpha56-graph-pipeline.md)。

2026-10-23，当前冻结alpha.56客户端已对原独立SSH服务器完成只读复验：实际daemon为alpha.37，原凭据/主机指纹认证、生产逐文件核验、两次非接管inspect通过；原daemon身份/PID、远端入口与本地连接配置保持，模型0。完整故障/升级矩阵与普通EXE联合流程仍未准出。[原始报告、脚本及来源](../../iterations/I08/current-ssh-readonly.md)。既有863/863为alpha.56交付证据，本轮不重复计数。


## issue #21 有界协议协商验证

2026-10-23，alpha.53 已公开；M10-F01/F02/F03。共享桌面844/844、核心71/71通过；最终启动专项9/9、Windows生产前端2组与普通无调试EXE6组通过；包54后台/84Core/1702Linux及各类源码一致性通过，模型0。修复前挂起/启动失败对照、最终启动专项、包与普通EXE结果分层登记，不以合成1.2.22替代现场原生。[完整证据、命令、首次失败与未测边界](../../iterations/I08/opencode-bounded-probe.md)。 已公开EXE与SHA256SUMS，全部字节匿名下载核验一致；[发布证据](../../iterations/I08/alpha53-release.md)。

T-M10-201 / M10-F01/F02/F03：2026-10-23，alpha.52公开，标签49bd12b，EXE130190265字节；上传及匿名完整下载SHA一致，包54后台/84Core/1702Linux匹配冻结源，普通EXE8组，模型0；未签名、未切换日常后台或部署远端。[发布证据与边界](../../iterations/I08/alpha52-release.md)。

## #19/#20 修复验证

EXE与校验文件已公开，匿名完整下载HTTP200、130190265字节及SHA-256一致；[发布核验](../../iterations/I08/alpha52-release.md)。

2026-10-23，alpha.52公开版；M10-F01/F02/F03。定向生命周期、中央资源与原请求回归131/131，远端/断开身份契约9/9，Windows生产前端12组通过、pageErrors=0；实际Windows进程检测识别日常OpenDesk运行并在隔离文件拒写，模型0。共享计数不跨模块累加；桌面共享全量841/841、核心68/68，类型/lint通过；普通无调试Windows EXE8组通过；包54后台/84Core/1702Linux与冻结源码一致，模型0。原失败、命令、原始证据及未测项见[本轮记录](../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

| 场景 ID | 实际结果 |
| --- | --- |
| T-M10-200 | 2026-10-23，本地0.6.0-alpha.51.recovery.2生成，EXE130196014字节；53后台/84Core/1701Linux、ASAR/Core/前端/bootstrap一致性通过。最终普通无调试Windows EXE5组通过、模型0；普通EXE验证分层见[交付记录](../../iterations/I08/connection-identity-node-scope.md)。 |

已公开0.6.0-alpha.51.recovery.2；本次未签名、未部署SSH或切换日常后台。

2026-10-23 / alpha.50未改包补验：本地20次落盘→DOM同步p95 1513ms通过；20组/60节点/59边的20次真实拖动观测上界p95 117.9ms未达到100ms门槛，未记录>500ms卡顿。WSL启动9/20通过/11次就绪前退出、失败写入0，原始WSL/PowerShell也复现；根因未定位。包与源码一致性重核通过，EXE未变；模型0，未重跑原全量，不替代独立LAN/SSH或原生模型。[本轮完整样本、失败、脚本与限制](../../iterations/I06/current-candidate-metrics.md)。
2026-10-23 / alpha.50本地候选：共享桌面794/794、核心68/68，工程与最终包核验通过；Pi原生Linux/Windows各5组、Hermes固定官方源码原生组件5组、Windows生产前端5组/普通EXE4组通过，模型0。原生阶段/受控发现、首次YAML与验收脚本/受限socket失败分别保留；真实自主父模型、Hermes正式安装版/Windows原生、独立SSH及完整矩阵未准出。共享计数不相加。 [最终实现、原始证据与范围](../../iterations/I08/hermes-mcp-config.md)。

2026-10-23 / alpha.49，WSL Node22.23.1：共享桌面770/770、核心68/68、类型/lint/生产构建和最终包/bootstrap一致性通过；普通Windows EXE4组通过，模型0。新启动受控契约4项在全量内，真实生产WSL只读三次中2次通过/1次就绪前退出；最终包真实Windows→WSL MCP组件5组通过，包含原生Codex0.162.1及Linux stdio调用/重开/撤权/轮换/清理；稳定性、原生父模型与独立SSH尚未准出，失败不抹除。共享计数不跨模块累加。 [完整需求、实现、原始证据与限制](../../iterations/I08/wsl-host-readiness.md)。

## DSH Desktop原生MCP（2026-10-22）

T-M10-MCP02DSH / M10-F01/F02/F03/F06；2026-10-22，alpha.48候选。共享桌面766/766、核心68/68、工程检查通过；Windows原生组件5组/生产前端4组（模型0），最终EXE130183681字节、SHA-256 `44f5d34d9ed365b2cec7c047a38045593a1ce51ac6a49949d28756c3f48740f6`，51后台/84Core/1699Linux资源与源码一致，普通无调试EXE4组通过，下载副本完整摘要一致。目录链接保护追加后保留首包记录并重建最终包，首次包不作交付。未签名、未公开、未切换日常后台或部署SSH。 [开发、原始失败与分层验收](../../iterations/I08/dsh-desktop-mcp.md)。

## alpha.47 本地候选（2026-10-22）

T-M10-MCP02DEFAULT / M10-F01/F02/F03/F06：WSL Node22.23.1交叉构建，EXE130179147字节、SHA-256 `281cfc14d4ea48c95408b32f0177037f6a79130ac6eac585651159b2730bff45`；50后台模块/84核心/1698Linux文件和ASAR/前端/后台/Core源码一致性均通过。桌面760/760、核心68/68及类型/lint/生产构建通过；Windows原生组件7组、普通无调试EXE隔离启动/资料持久化/关闭重开/完整后台重启4组通过，模型0；Windows下载副本完整SHA-256一致。[本轮交付](../../iterations/I08/opendesk-mcp-defaults.md)。未签名、未公开、未切换日常后台、未部署SSH，公开alpha.46保持原字节。

## alpha.46 公开分发核验（2026-10-22）

冻结源码9766eb4已推送master并固定标签v0.6.0-alpha.46；EXE与SHA256SUMS.txt已公开。匿名无凭据完整下载HTTP 200、130180760字节、SHA-256 `57f1af73f761af72d75121284b023a001dad05eb30c0c197e18851cc9a7e8c48`，与本地和附件digest一致。本轮核心68/68、桌面758/758及类型/lint/用户站6/6与构建通过；包复核50后台模块/84核心/1698Linux文件和四类一致性均通过。普通EXE四组为同日未变产品的既有结果，不标本轮重跑；未签名、未部署SSH，完整准出限制保留。[源码、首次认证失败与公开核验](../../iterations/I08/alpha51-recovery2-release.md)。

## 后续原生组件验收（2026-10-22，alpha.46）

已安装OpenDesk/DSH原生MCP组件协议分别5组/6组通过；两条生产协作链各完成1个真实Claude子任务，并分别只读重开原任务/Session/结果，无重放。原生父模型自主决策与日常原生页面未验；产品运行代码与EXE未变，不把新增验收与原全量计数叠加。[脚本、初次失败、准确层级和未测项](../../iterations/I08/mcp-native-acceptance.md)。

## MCP02恢复与观测（2026-10-22，本地交付时）

本地候选版本alpha.46；最终包冻结、SHA-256及Windows隔离验收见本轮交付记录。未签名、未公开、未部署SSH。 WSL Node22.23.1共享桌面758/758、根68/68通过，最终JSON修复后CLI11/11及类型/lint/核心构建通过；模型0，真实原生模型委派未测，Windows结果按专项登记。 [实现、原始证据与未测项](../../iterations/I08/mcp-open-recovery.md)。

## alpha.45 本地候选（OpenDesk 原生 MCP 可见性修复，2026-10-22）

T-M10-MCP02Q / M10-F01/F02/F03/F06：版本位 `0.6.0-alpha.44` → **`0.6.0-alpha.45`**（`desktop/package.json` 与 lock 同步，含本轮 stdio 协议与启动器修复；根 `package.json` 仍 0.1.0）。构建方式同 alpha.44：WSL/Linux 交叉构建 `npm run desktop:dist`（node v22.23.1、electron-builder 26.15.3、Electron 44.7.0），`win.signExecutable:false` → **未签名**。

| 项 | 结果 |
| --- | --- |
| 产物 | `desktop/release/AgentBridge-0.6.0-alpha.45-Windows-x64.exe`（`desktop/release/` gitignore，不入库） |
| 大小 / 摘要 | **130177443 字节** / SHA-256 **`35674f6c29187524e5e51dbbe983447478508d21d68971b6ec956fd14371b3a6`** |
| 包核验 | `verify-package --portable` → `status: passed`，version `0.6.0-alpha.45`，backendModules 50、coreFiles 84、`coreBuildMatches`/`appAsarSourceMatches`/`frontendMatches`/`linuxBackendMatches` 均 true，linuxFiles 1698，linuxManifestDigest `195081305a67fd70a505989241ae82bccceb9df5d7a6515b2f0de4230fed1a9b` |
| 分发 | 已复制到 Windows `C:\Users\jiqi\Downloads\` |
| 回归 | 桌面 **753/753**（新增 `mcp-client-protocol` 2 例 + OpenDesk launcher 偏好 1 例）；根测试直接运行 66/66（`npm test` 外壳曾超时）；根 typecheck/eslint src/build 与桌面 tsc 通过 |

证据：`artifacts/mcp-open-integration/evidence/package-verify-alpha45.json`、`portable-sha256-alpha45.txt`。**未测**：未在真实 Windows 启动该 EXE（与日常后台共用 `%APPDATA%`），普通 EXE 启动/重开/后台重启/临时解包目录变化（MCP02-T16）仍待执行；未签名、未公开、未打标签、未部署远端。包核验只证明包内容与源码一致，不等于真实 EXE 或原生调用验收。[§14](../../iterations/I08/mcp-open-integration.md#14-opendesk-原生-mcp-可见性修复2026-10-22alpha45)

## alpha.44 本地候选（WSL/Linux 交叉构建，2026-10-22）

T-M10-MCP02P / M10-F01/F02/F03/F06：本次是**在 WSL/Linux 上交叉构建 Windows x64 便携包**，不再是 Windows 原生构建。版本位由 `0.6.0-alpha.43` → `0.6.0-alpha.44`（`desktop/package.json` 与 lock 同步，源码/依赖未变；根 `package.json` 仍 0.1.0）。命令 `npm run desktop:dist`，环境 node v22.23.1 / electron-builder 26.15.3 / Electron 44.7.0，构建缓存置于工作区 `.cache-electron*`、`.npm-cache-build` 并已 gitignore。签名沿用 `win.signExecutable:false`，构建日志记录 “file signing skipped via signExecutable configuration”，产物**未签名**。

| 项 | 结果 |
| --- | --- |
| 产物 | `desktop/release/AgentBridge-0.6.0-alpha.44-Windows-x64.exe`（`desktop/release/` 已 gitignore，不入库） |
| 大小 / 摘要 | **130186782 字节** / SHA-256 **`b78a2bcf7d45d67f95044186747e557881d461911077a01bda47addb549d6c63`**；`file` 识别为 PE32 GUI/NSIS 自解压便携包 |
| 包核验 | `verify-package --portable` → `status: passed`，version `0.6.0-alpha.44`，backendModules 50、coreFiles 84、`coreBuildMatches`/`appAsarSourceMatches`/`frontendMatches`/`linuxBackendMatches` 均 true，linuxFiles **1698**，linuxManifestDigest `8e47ae3b3ae245fc8338ff6bebcdc5dcc0d575bf7b8efe7f93427959096018c7` |
| 分发副本 | 已复制到 Windows `C:\Users\jiqi\Downloads\AgentBridge-0.6.0-alpha.44-Windows-x64.exe`，复制后哈希一致 |
| 回归 | 版本变更后桌面全量仍 **750/750**（0 失败）；根套件随本轮文档复跑 |

证据：`artifacts/mcp-open-integration/evidence/package-verify.json`、`portable-sha256.txt`。

**未测/边界**：未在真实 Windows 启动该 EXE（会与日常 alpha.43 后台共用 `%APPDATA%/AgentBridge`，需用户决定后再受控运行），因此普通 EXE 启动、重开、后台重启、临时解包目录变化（MCP02-T16）**仍待执行**；未签名、未公开、未打标签、未部署远端、未做公开下载核验；日常后台与窗口仍为 alpha.42/alpha.43，未切换。包核验只证明“源码可冻结、可交叉构建、包内容与源码一致”，不等于真实 EXE 或原生 Agent 验收。

2026-10-22 / alpha.43：OpenDesk CLI/Desktop前端执行门禁修复；生产注册表遍历回归8/8，桌面全套722/722，生产界面10组与包源码核验通过，新增Prompt0。Windows实际包内窗口4组、普通无调试便携EXE4组均通过。首次失败和未测边界见[本轮专项](../../iterations/I08/opendesk-ui-admission.md)。

2026-10-22 / OpenDesk Desktop 0.3.9：已安装原网关的真实执行、续聊与普通EXE窗口重开通过；无运行代码变更，不将历史自动测试计为今日重跑。分层计数与未测项见[现场专项](../../iterations/I08/opendesk-desktop-live.md)。
当前候选alpha.43仅在alpha.42已有接口适配基础上修复前端门禁；alpha.42原构建/普通EXE证据见[历史专项](../../iterations/I08/opendesk-existing-interfaces.md)。仅打包Bridge，不构建OpenDesk；本轮未重跑真实模型或独立SSH，不能把历史结果计入当前通过数。

2026-10-21 / M10-F01/F03：alpha.42核心57/57、桌面721/721、Windows协议13/13、普通EXE隔离5组与生产前端9组通过；包核验50 CJS/81 Core/1462 Linux，ASAR、前端与后台源码匹配。候选130084772字节、SHA-256 `9b822ee1…`，未签名、未公开。普通EXE运行结果与原生实例限制另见[本轮专项](../../iterations/I08/opendesk-existing-interfaces.md)。

## alpha.38 本地候选包核验

T-M10-172 / M10-F01/F03/F06：2026-10-21，本地构建 `0.6.0-alpha.38` Windows x64 便携 EXE 并核验。包报告 `status: passed`：48 个后台 CJS、81 个核心文件、**1460** 个 Linux 资源（1459 + 新增 alpha.37 pin 文件），`coreBuildMatches`/`appAsarSourceMatches`/`frontendMatches`/`linuxBackendMatches` 均为 true，`linuxManifestDigest` = `451aba34…`；产物 **130038728** 字节、SHA-256 `296260f2…`，与包报告一致并已独立 `sha256sum` 复核。包内 `compatibleDaemons` 共 **32** 条，含新增 `0.6.0-alpha.36`（digest `4f14b5f5…`，1458 文件）与 `0.6.0-alpha.37`（digest `3fff4ab3…`，1459 文件）。回归：`daemon-maintenance`+`ssh-recovery-integration` **26/26**、新界面用例 **5 checks**、既有进度界面用例 **3 checks**、全量桌面 **689/689（0 失败）**、`npx tsc --noEmit` 0 错、`npx vite build` 成功；`check-docs` errors 0、`docs:test` 6/6。未在 Windows 真机运行该 EXE、未签名、无真实用户远端、`windows-*.cjs` Edge 套件本机未跑、未公开 GitHub；公开 alpha.36 与本地 alpha.37 候选未被覆盖，完整 I06C/I07C 准出不变。[交付、指纹与未测边界](../../iterations/I08/alpha38-delivery.md)。

## alpha.37 本地候选包核验

T-M10-171 / M10-F01/F03/F06：2026-10-21，本地构建`0.6.0-alpha.37` Windows x64便携EXE并核验。包报告`status: passed`：48个后台CJS、81个核心文件、1459个Linux资源，`coreBuildMatches`/`appAsarSourceMatches`/`frontendMatches`/`linuxBackendMatches`均为true；产物130034719字节、SHA-256`76e30b1e…`，与包报告一致并已独立`sha256sum`复核。新增alpha.36兼容pin从已公开alpha.36 EXE（130032973字节、`43e09dd3…`）内`linux-package/manifest.json`原样提取，1458个文件逐项sha256匹配，`manifestDigest`=`4f14b5f5…`（`sha256(JSON.stringify(manifest))`口径）；包内`compatibleDaemons`索引31条含该pin，不安装旧清单、不自动升级远端。回归：维护/SSH专项39/39、切片A真实chromium界面3/3、构建后全量桌面684/684（构建前682项679通过中的3项失败经独立验证定位为测试未隔离`DSH_HOME`，同日由测试侧修复、只改测试文件不进包，见[回归日志](../../../artifacts/alpha37/regression-full-suite.log)与[测试文件指纹](../../../artifacts/alpha37/regression-test-fingerprints.txt)）；`check-docs` errors 0、`docs:test` 6/6。未在Windows真机运行该EXE、未签名、无真实用户远端、`windows-*.cjs` Edge套件本机未跑、未公开GitHub；公开alpha.36 EXE/标签/附件未改动，完整I06C/I07C准出不变。[交付、指纹与未测边界](../../iterations/I08/alpha37-delivery.md)。

## alpha.36 公开发布核验

T-M10-170 / M10-F01/F03/F06：2026-10-21，用户明确要求推送源码并公开发布。推送前把远端alpha.35历史合并进本地（30个冲突按本地内容解决，合并结果树与合并前提交逐字节一致），推送`7c4aaa1`/`1fef25f`/`7ac9dcd`三笔；标签`v0.6.0-alpha.36`冻结合并提交`1fef25f`。标签树对打包源632项逐文件核对：612项一致，差异20项全部为冻结后补充的文档与测试，运行/打包源差异0（测试不在electron-builder的`files`清单内）。GitHub预发布上传EXE与SHA256SUMS.txt，上传返回digest与本地一致；匿名不带凭据完整下载130032973字节后计算SHA-256与本地一致，校验附件字节一致。未改旧标签/附件，未签名（`signExecutable=false`），未验证用户profile、真实模型或独立SSH。[交付与边界](../../iterations/I07/alpha36-delivery.md)。

## alpha.36整合边界

2026-10-21 / WSL Node22.23.1：本轮全量核心57/57、桌面676/676，类型/lint/前端构建通过。各模块共享计数不相加；包核验、Windows契约144/144、界面26组与普通EXE7组通过，具体以专项为准，真实模型/用户profile/独立SSH未验。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## 子任务上下文源码交付边界

T-M10-155 / M10-F01/F02：2026-10-21，冻结桌面667/667、定向121/121、Windows受控36/36及Core构建通过；现有CJS收集方式可包含新helper，无新依赖。未构建/验证新EXE或Linux发布包；已交付.config.2冻结清单无delegation-context.cjs，不将其算作本片包证据。原v1文本与中央渲染/严格准备证明须在未来冻结包保持一致。[来源与未测范围](../../iterations/I07/delegation-context.md)。

## OpenCode 包内宿主复核

2026-10-21 / WSL Node22.23.1：现有本地alpha.35.config.2冻结包生产stdio/daemon入口2/2通过，完整EXE摘要及包一致性重核通过。公开alpha.35冻结b5de577仍为缺close旧工厂；本轮未重下公开EXE、重跑普通Windows EXE或验证用户profile/真实模型。[本轮证据与切换步骤](../../iterations/I07/opencode-host-lifecycle.md)。

## Agent 行配置构建与验证

M10-F01/F02/F03/F05；2026-10-21。当前最终源码核心57/57、桌面649/649、生产SSR82/82、Windows配置界面8组、生产MCP文件4组及既有DSH界面3组通过。config.2普通无调试EXE6组通过；47后台/81核心/1455Linux资源及ASAR/前端一致，133项生产源码未变。原profile/真实模型/独立SSH未验。最终冻结清单、包一致性、普通EXE和摘要见[专项实际记录](../../iterations/I07/agent-row-configuration.md)，共享计数不相加。

## CT-07连接视图源码边界

T-M10-154 / M10-F01/F02：2026-10-21，冻结桌面643/643、定向103/103、Windows受控18/18及Core构建通过；agent-connections随现有electron CJS收集，无新依赖。未打新EXE/Linux发布包或切换后台；recovery.1和公开alpha.35不计为本片包验收。未来打包前仍须整合公开独立修复并核对运行副本。[日志与未测范围](../../iterations/I07/agent-connections.md)。

## 扫描恢复候选验证

M10-F01/F02/F03/F05；2026-10-20，alpha.34派生工作源码。完整桌面632/632、核心56/56、Windows前端6组、最后定位改动SSR76/76通过。最后冻结131项生产源码未变、前端构建一致；最终EXE/包/普通运行的实际结果统一见[交付核对](../../iterations/I07/agent-management-recovery.md)，不跨模块累加共享计数，不冒充用户原profile/真实模型/独立SSH验收。

## 委派列表包范围（2026-10-20）

T-M10-153 / M10-F01/F02：615项冻结源码回归、110项定向和Windows8项均为受控源码证据，未构建或验收新EXE/Linux发布包；原公开alpha.35及DSH候选不因本片源码变化自动含新工具。现有CJS收集方式核对无新依赖，未来候选须校验helper/MCP/宿主一致并先整合公开独立修复。[最终来源与未测范围](../../iterations/I07/delegation-list.md)。

## DSH Desktop/Web 当前包边界

本地候选`0.6.0-alpha.35.dsh.3`已冻结并构建，包内45个CJS/81个核心文件/1453个Linux资源与窗口ASAR、前端一致。核心56/56、桌面607/607、Windows DSH11/11、Edge生产前端3组通过；真实Windows/WSL认证与Session列表通过，Desktop两轮同Session及去重已观察，模型均RATE_LIMIT。普通EXE和最终摘要见[本地交付](../../iterations/I07/dsh-exe-delivery.md)，不计GitHub分发或真实模型成功，公开alpha.34保持原字节。

2026-10-20 / M10-F01/F03/F05：alpha.33 EXE129965530字节及SHA-256附件公开完整下载核验一致；普通EXE5组通过，发布不代替用户现场或独立SSH验收。 [交付、校验与升级边界](../../iterations/I07/maintenance-persistence.md)。

## 维护上传进度与持久化修复（issue #10）

M10-F01/F03/F05：本轮WSL专项7/7、相关42/42与核心51/51，Windows最终7/7及SSR66/66通过；最终全量/真实TCP/普通EXE/公开下载逐层记录。用户profile及独立服务器未验，共享计数不跨模块叠加。 [完整设计、实测与边界](../../iterations/I07/maintenance-persistence.md)。

## CT-05桌面构建边界

T-M10-152 / M10-F01/F02：桌面TypeScript/Vite生产构建通过，保留大于500KB单包提示；实际Windows前端9组验证相应生产资源，未构建新EXE/Linux包。公开alpha.32与integrated.3原候选文件/摘要保持，581项源码回归及浏览器下载不扩大旧包证据；真实Agent/独立SSH未测。[构建、资源摘要与交付范围](../../iterations/I07/context-packet-ui.md)。

## CT-05包范围核对

T-M10-151 / M10-F01/F02：仅核对新electron CJS模块沿原打包收集路径，无版本/依赖变化；本轮未构建或验收新EXE/Linux包。576/576桌面、Windows定向14项及真实Claude一次消费是源码证据，不能扩大先前integrated.3普通EXE五组的冻结范围，旧文件/摘要保留。公开仍alpha.32，工作源码晚于integrated.3。[本片未测与后续发布条件](../../iterations/I07/context-packet.md)。

## 整合源码与本地候选

T-M10-149 / M10-F01/F02/F03/F05/F06：核心51/51、桌面570/570零跳过（定向85/85及兼容15/15是相关子集），根类型/lint/构建与桌面构建通过。Windows前端26组/模型0，按历史/门禁/管理/材料/MCP分别记录；最终integrated.3普通Windows EXE五组通过：原历史/文档/MCP导出、窗口/后台重开、持久资源和原unknown保留，原生请求0；这是隔离合成profile，不是真实Agent模型或用户现场。包42 CJS/78核心/1446 Linux条目匹配，未部署用户SSH或跑真实模型。各模块共用计数不相加；首次夹具/原型失败与原历史证据保留。[版本、源码、所有原始结果和限制](../../iterations/I07/integrated-source.md)。

## issues #8/#9受控验证

M10-F01/F03/F05：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## issue #7 协作兼容修复

M10-F01/F03/F05：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## 历史详情路由与局部错误

T-M10-150 / M10-F01/F03/F05：alpha.30隔离修复；合成路由6项、受控TCP SSH1项、Windows纯CJS91/91、Linux SSR63/63，新生产前端7组和既有10组通过，模型0。最终桌面529/529、核心45/45、lint/类型/构建通过；38 CJS/78 core/1401 Linux资源匹配145个冻结源文件。普通Windows无调试EXE合成原两轮/Session只读与关闭重开/后台重启4组通过。分发实际结果及首次失败统一见[当次专项](../../iterations/I07/history-detail-recovery.md)；共享计数不跨模块叠加，用户故障profile/独立服务器未复测。

2026-10-19：当前完整源码已发布为 **alpha.29 GitHub预发布**，新Tag、EXE与SHA-256校验附件均已上传；版本、包资源与实际发布状态统一见[alpha.29 交付](../../iterations/I07/alpha29-release.md)。历史专项保留原日期/冻结范围，完整 I06C/I07C 未准出。

## 桌面材料入口与公开版本核对

本次桌面类型/Vite构建、541项受控回归和Windows前端八组通过，模型0；没有新包、普通EXE或verify-package，不登记新包通过。只读GitHub API确认alpha.31/标签002107da、两附件uploaded、EXE大小与服务器digest；未重新完整下载或执行该包。本地a872275/alpha.29派生尚未合入alpha.30/31修复，材料/MCP增量也不能视作alpha.31内容。[原始元数据/构建/源码与限制](../../iterations/I07/public-materials-ui.md)。

## 独立 MCP 文件与配置增删

M10-F01/F02；日期2026-10-19，alpha.29后未发布工作区。WSL Node22.23.1受控全桌面537/537、核心45/45；真实原生列表三工具增删通过，Claude/OpenCode连接、Codex仅列表；Windows Edge155生产界面4组通过但机器/原生执行受控。计数为共享结果不跨模块相加，模型调用0。新EXE、真实Windows原生Agent、独立SSH与独立接入真实模型委派未测。源码/命令、首次失败、原始日志和逐层边界见[专项验收](../../iterations/I07/mcp-installation.md)。 本次没有运行打包，不将源码构建当作包内验收。

## CT-04尚未打包

M10-F02/F03/F06边界核对：本次只改源码/测试和文档，桌面525/525及一个真实WSL Claude Task通过；没有执行新包构建、verify-package、新普通EXE或公开上传，不登记包通过用例。较早alpha.29冻结23d256e的38 CJS/1400 Linux条目、Windows EXE四项及公开摘要结果保留[原发布记录](../../iterations/I07/alpha29-release.md)，不覆盖新增team-materials模块。[本片源码与未测范围](../../iterations/I07/public-materials.md)。

2026-10-19较早：冻结源码23d256e已发布为 **alpha.29 GitHub预发布**，新Tag、EXE与SHA-256校验附件均已上传；版本、包资源与实际发布状态统一见[alpha.29 交付](../../iterations/I07/alpha29-release.md)。历史专项保留原日期/冻结范围，完整 I06C/I07C 未准出。

poll.4最终候选：129,933,135字节，SHA-256与[校验文件](../../../artifacts/desktop-polling/2026-10-18/SHA256SUMS.txt)一致，普通EXE4组通过；没有创建GitHub发布，用户profile未升级。[完整交付](../../iterations/I07/desktop-polling.md)。

2026-10-18 / T-M10-141：桌面空闲修复源码，WSL Node22.23.1 / Windows Node24.19.0及Edge155。核心45/45、桌面424/424、定向20/20、Windows受控界面3组通过，模型0；属于共享工程计数，不跨模块相加。普通EXE与黑窗观察、冻结包、首次环境失败及用户现场未测边界按[本次完整报告](../../iterations/I07/desktop-polling.md)记录，历史包不冒充本次修复。

## 原生扩展工程与打包检查边界

T-M10-140 / M10-F01/F03/F05/F06：alpha.28 后新增适配器源码，根类型/lint/核心构建和桌面生产构建通过，[前端构建日志](../../../artifacts/native-agent-expansion/2026-10-18/desktop-build.txt)；原 `.cjs`/assets 打包规则纳入新增模块与图标，Codex/new native worker 副本的注册依赖已由实际受控子进程验证。Windows生产前端六图标均加载，无开发机file路径或外部资源请求。[实际检查与边界](../../iterations/I07/native-agent-expansion.md)。未为本次适配器构建新EXE、未核对新发行包摘要、未升级独立SSH；现有ui.2/GitHubalpha.28证据保持原冻结范围。

## UI 本地候选 alpha.28.ui.2

T-M10-129 / M10-F01/F02/F03/F05/F06：独立快照构建 `0.6.0-alpha.28.ui.2`，主工作区 package/lock 和旧 alpha.28 EXE 保持原版本与字节；没有 GitHub 发布。候选包含 UI 重构、原生空白 Session 与会话异常业务验收保护，不能把它描述成只换皮的原 alpha.28。[需求、设计与交付](../../iterations/I07/ui-redesign.md)、[视觉与交互验收](../../iterations/I07/ui-visual-acceptance.md)。

本次工程/前端/包结果只对应北京时间08:50冻结的UI交付源码。11:18后共享目录新增的其他线程Agent适配、工具发现和图标修改未进入ui.2，本报告不宣称当前共享目录的全部最新代码已经验证。

| 层级 | 日期、环境与实际结果 | 原始证据及限制 |
| --- | --- | --- |
| UI冻结源码工程 | 2026-10-18，WSL Node22.23.1；桌面381/381、无跳过，含59项生产React SSR；核心45/45见原同日集成基线 | [最终桌面TAP](../../../artifacts/ui-redesign/2026-10-18/desktop-tests-final.tap)、[核心/工程基线](../../iterations/I07/integration-baseline.md)；不覆盖11:18后增量，不与历史375/373或SSR子集叠加 |
| 候选资源一致性 | 34个后台CJS、78个core文件、1396个Linux条目、窗口ASAR和前端逐项匹配，status=passed | [包报告](../../../artifacts/ui-redesign/2026-10-18/package-ui2.json)、[构建日志](../../../artifacts/ui-redesign/2026-10-18/package-ui2-build.log)；不是用户远端安装验证 |
| 普通 Windows EXE | Windows，实际无debug portable，隔离profile、真实Coordinator IPC及SQLite，4项通过：启动版本、公共记录持久化、普通关闭/重开、全后台重启后保留 | [普通EXE报告](../../../artifacts/ui-redesign/2026-10-18/portable-ui2.json)；原nativeRequests无新增或重放，模型0；观察到的10条只读历史作为基线，不要求历史为空 |
| 生产前端交互 | Windows Node24.19.0 / Edge155.0.4283.45；主界面5组12图、状态矩阵10组8图、小队3组3图、关系图10组分别通过 | [分层视觉记录](../../iterations/I07/ui-visual-acceptance.md)；受控数据/故障和合成历史，各组不与工程计数相加，不等于真实模型或独立SSH验收 |

最终[本地候选](../../../artifacts/ui-redesign/2026-10-18/AgentBridge-0.6.0-alpha.28.ui.2-Windows-x64.exe)为 **129899528 字节**，SHA-256 `20a84ce98380457e5520d6bb9fc941c666c299a67b216e862d8568b7b3d015a6`。快照相对08:50冻结的UI交付源码只增加版本元数据和可信旧清单差异；候选 Linux manifest digest 为 `c0e1db13e63a1f7985f074afc5d9791b07b555b66f30566351b1d400251e2d83`，新增原 alpha.28 清单 digest 为 `b06a14fe3716c2df46cb665e21f137d05aab6046a611cb0275c5cadbc365d00d`。

首个 ui.1 中间包在菜单时序反例出现后停止交付；普通 EXE 初次脚本将“无新增执行”错误假定为“历史为空”，已改为原请求指纹和观察基线核对，失败记录保留于当次专项。最终结果只绑定 ui.2，不把中间包、原 alpha.28 或历史真实 Agent 结果当本候选新验收。未使用用户profile、未连接用户SSH、未发模型需求；完整I06C/I07C仍未准出。

## SSH持久拒绝恢复

T-M10-128：alpha.28已预发布，WSL Node22.23.1/Windows Node24.19.0，合成台账和受控TCP SSH，模型0。最终桌面317/317、核心45/45、Windows契约93/93，lint/类型/构建通过；真实TCP SSH丢响应/daemon重启1项及普通Windows无调试EXE合成验证6组通过，34 CJS/78 core/1395 Linux资源匹配源码。发布以[当次实际记录](../../iterations/I06/daemon-rejection-recovery.md)为准，不推定用户现场恢复。历史记录不计为本次重测。

## Windows恢复专项

T-M10-128：2026-10-17 / WSL Node22.23.1与Windows Node24.19.0 / alpha.27已预发布，模型0。Codex恢复10/10、共享原子写入10/10、网络最终50/50、Windows契约86/86；全桌面最终运行288/288、核心45/45及工程检查通过；新增alpha.26兼容文件另验10/10。共享计数不跨模块累加，Windows为受控目录/执行器，不是用户故障或真实模型。首轮限制/维护ENOENT与未测范围保留；最终普通Windows EXE对合成记录恢复/重开/重启/冻结源码共5组通过，包内33 CJS/78 core/1393 Linux条目一致；发布结果以[当片报告](../../iterations/I06/windows-start-persistence.md)后续实际记录为准。
## 可信清单预发布

实际冻结alpha.24→alpha.26的受控TCP SSH/SFTP链4组、Windows普通EXE5组通过；Linux独立资源归档1392条目一致，独立服务器/真实原生任务迁移未测。

新增 alpha.24/alpha.25 可信清单已匹配原交付 manifest digest；兼容/安全/升级/恢复36/36、核心/前端构建及候选包资源一致性通过，WSL Linux / Node22.23.1，模型0。候选独立冻结，未混入工作区 I07 增量；原发布附件没有覆盖。实际EXE、摘要、Windows和真实受控SSH结果及失败/未测边界见[专项交付](../../iterations/I06/ssh-alpha24-upgrade.md)。

## Windows原请求上下文恢复

T-M10-126 / M10-F01/F03/F05：alpha.25已预发布，WSL Node22.23.1/Windows Node24.19.0，受控记录，模型0。4个反例修复前全部失败，修复后专项48/48、串行桌面243/243、Windows契约17/17通过，原回执可恢复且缺回执仍unknown。共享计数不跨模块累加，包内33 CJS/78 core/1390 Linux资源一致；alpha.24普通EXE对照3组、alpha.25候选4组通过，原记录均为合成。发布前再验相关72/72、lint/类型/前端构建、合成unknown生产恢复链及包一致性通过；EXE和校验文件均uploaded且大小/digest匹配，公开完整下载HTTP200、摘要及校验文本一致。分发证据、候选包/普通EXE与失败日志见[专项](../../iterations/I06/windows-context-recovery.md)。未实测用户另一台电脑或真实原生模型，不改变GitHub alpha.24已发布冻结包。

## 停止协调候选验证

T-M10-121 / M10-F01/F02/F03/F05/F06：2026-10-16，源码/本地候选alpha.24，GitHub仍alpha.23。核心45/45、最终串行桌面233/233、Windows契约38/38、受控界面7组、普通无debug Windows EXE7组通过；33 CJS/78 core/1390 Linux条目、app.asar与前端匹配最终源码。普通程序完整重启后停止归档、原收据与撤权保留，运行文件摘要和包报告一致，模型0。WSL真实Claude取消及首次失败单列于[停止专项](../../iterations/I07/native-stop.md)，不能以普通包证明Windows真实原生取消或完整I07C/I06C。

## I07C首批实际验证

T-M10-110 / M10-F01/F02/F03/F05：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

2026-10-16分发复核 / M10-F06：源码标签绑定`e8cc95a2abb474571a8d133b99c18e6df6fd61df`，GitHub两附件uploaded、大小/digest匹配，完整公开EXE与校验文件HTTP200、下载摘要匹配；源码/包一致性复核通过。该结果只证明分发，不扩大原生验收范围。[发布记录及证据](../../iterations/I07/github-release.md)。

## I07B候选

T-M10-101 / M10-F01/F02/F03/F05：2026-10-16，工程核心45/45、最终桌面208/208、Windows契约18/18，lint/类型/构建通过；最终资源31 CJS/78 core/1388 Linux条目、app.asar及前端与源码一致。普通无debug Windows EXE 5组通过，实际窗口/IPC/SQLite/MCP、模型0，关闭和全后台重启后原任务/授权/收据保留并继续Y。摘要、本地分发、首次失败保留和未测范围见[I07B完整报告](../../iterations/I07/task-handoff.md)。GitHub保持alpha.20；不计作独立SSH或用户自研实例验收。

## I07A候选

T-M10-100 / M10-F01：2026-10-15，新候选工程检查、包/普通EXE的实际结果、摘要与未测项统一见[I07A交付](../../iterations/I07/delivery.md)。GitHub预发布保持alpha.20，源码与本地候选alpha.21，不以构建或受控UI替代真实原生/普通EXE；I07B/C与I06C未准出。

## OpenCode 二次发现与 Windows 配置专项

WSL Ubuntu / Node 22.23.1：discovery 3/3（含于核心 45/45），桌面 181/181；受控回归、模型 0。[核心 TAP](../../../artifacts/opencode-discovery/2026-10-14/root-tests.tap)、[桌面 TAP](../../../artifacts/opencode-discovery/2026-10-14/desktop-tests.tap)。Windows 原始报告 UTC 2026-10-14T17:35:28.789Z / Electron Node 24.21.0：真实 PE 版本/解析、旧二次发现失败、修复后原路径核验、配置完整写入与旧revision拒绝、serve受控退出保留NATIVE_EXITED、删除原安装，共6组通过，[实际报告](../../../artifacts/opencode-discovery/2026-10-14/windows.json)。这是隔离PE/进程夹具，无真实OpenCode模型或用户另一台电脑验收。原生Windows完整生命周期和断电持久性未验证。根因、失败原证据、最终包与边界见 [专项](../../iterations/I06/opencode-discovery.md)。

## Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

## 历史专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。

历史 alpha.15 基线：2026-10-14 / 0.6.0-alpha.15。工程和包一致性验证通过；独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
更新：2026-10-13。当前 0.6.0-alpha.8 拖动修复候选，最新包与普通窗口验证见当前专项；alpha.2/alpha.3 证据保留原版本。真实窗口/普通便携流程分别记录；0.5.0 保留为历史稳定发布，不把新包生成等同于整个 I06 准出。

## 当前包验证

T-M10-22 / M10-F01/F02/F03/F06：2026-10-13，桌面 116/116，根及前端 TypeScript/Vite 构建，27 CJS 与 1368 个 Linux 文件版本/摘要/前端比对。旧 alpha.7 manifest 先按历史 digest 核对再收入可信兼容；普通 EXE 与实际 Electron 拖动按 [当次交付](../../iterations/I06/graph-drag-fix.md)分别记录。不重启用户原后台，不自动升级旧远端，不把本机布局缓存称为后台保存成功。最终 alpha.8 portable 包完整性与普通 EXE 启动/关闭/重开 3 项通过，原始报告见当次交付。

## 历史包验证

T-M10-21 / M10-F01/F02/F03/F06：2026-10-13，当前桌面 116/116、前端构建与全部后台/版本/离线资源比对通过；普通 Windows EXE 启动/关闭/重开 3 项通过。版本、摘要及原始报告按 [专项交付](../../iterations/I06/graph-usability.md) 记录。可信兼容增加原已交付 alpha.6 manifest，先按历史 digest 核对；当前候选 27 个后台 CJS、1367 个 Linux 文件。SSH/原生账号不重跑，用户 profile 和远端 daemon 不变。

## 1. 历史材料快照核对

| 对象 | 此前资料整理快照（最新结果见本页候选验收） |
| --- | --- |
| 桌面源码版本 | 当时 0.6.0-alpha.2；先前资料快照为 0.6.0-alpha.1 |
| 根 CLI 版本 | `package.json` = `0.1.0` |
| Linux 离线 manifest | `0.6.0-alpha.1` / protocol 2 / linux x64 / Node `v22.23.1`；当时 1,360 个清单文件，134,646,484 字节解包总量 |
| 最新 portable EXE | [AgentBridge-0.5.0-Windows-x64.exe](../../../desktop/release/AgentBridge-0.5.0-Windows-x64.exe)，101,464,168 字节 |
| EXE SHA-256 | `fd11bbaaa3d5d4fb5c52171ff8c4900a79e7235a374578b494e438725b13dc7a`，当次重新计算 |
| `desktop/release/win-unpacked` | 旧构建；最新进度核对发现缺 ssh-host 且多个后台文件不一致，不能用于当前源码验收 |

本节 Linux 清单数量是当时资源快照；当前 alpha.8 见文末专项。2026-10-10 真实安装记录中的压缩包 46.9 MB / 约 78 秒是当时构建，不把它说成今日新包的性能复测。清单读取与 EXE 哈希只读，不安装/更新后台。

## 2. 功能/已执行测试矩阵

| 用例 ID | 功能 ID | 实际测试或证据 | 结果与级别 |
| --- | --- | --- | --- |
| T-M10-01 | M10-F01 | [根 TAP](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap)，43/43；[桌面 TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap)，87/87 | 通过，自动化/共享全工程基线；不是模块独立 130 个新用例 |
| T-M10-02 | M10-F01 | [2026-10-12 进度核对](../../iterations/I06/progress.md)：根 lint/typecheck、桌面类型检查/Vite build | 核对记录通过；未保留本模块单独的新 EXE 构建日志，不能证明 portable 构建完成 |
| T-M10-03 | M10-F05 | `detached runtime survives portable extraction cleanup and retains license`，[worker-runtime.test.cjs](../../../desktop/tests/worker-runtime.test.cjs) | 通过，受控：合成 executable/ICU/V8 资源，删除合成解包目录后复用，许可证保留 |
| T-M10-04 | M10-F05 | `missing ICU or V8 resources reject startup before admitting a native task`，同上 | 通过，受控：实际断言删 ICU 后报缺资源，未启动原生任务 |
| T-M10-05 | M10-F05 | `ordinary Node keeps using its existing executable`，同上 | 通过，受控：普通 Node 不复制 Electron 资源 |
| T-M10-06 | M10-F04 | `release manifest path traversal and checksum changes stop before upload`，[ssh-security.test.cjs](../../../desktop/tests/ssh-security.test.cjs) | 通过但限定为具体 `../` 路径与 Node 版本断言；用例没有独立构造合法路径文件摘要损坏 |
| T-M10-07 | M10-F03/F04 | [既有真实 Linux 说明](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md) / [原始 JSON](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json)，首次安装 `connectSsh` 77.8 秒 | 通过，真实/既有：单归档上传、运行时/逐文件校验、原子发布、daemon 握手；实际使用系统 Node，非缺 Node 分支 |
| T-M10-08 | M10-F02/F05/F06 | [I05 便携报告](../../../artifacts/I05-portable.json) | 通过，真实旧版：普通窗口读机器/节点、私有后台资源打包、重开节点/关系/历史保留、启动无新 Prompt、无 debug 接口；适用 `0.5.0` |
| T-M10-09 | M10-F03/F06 | 本次版本/清单读取、最新 EXE 大小/SHA-256 核对 | 先前静态核对通过；本次重建候选包结果见 T-M10-10/15 |

worker-runtime 专属测试为 3 项，计入桌面 87 项；发布脚本本身没有独立 `stage-linux-package.test.cjs`。共有受控测试、真实旧包和真实 Linux 正常安装支撑不同层级，不按文档数量重复计数。

## 3. 新版本发布缺口

| 用例 ID | 功能 ID | 场景 | 当前结论 |
| --- | --- | --- | --- |
| T-M10-10 | M10-F02/F06 | 0.6.0-alpha.2 EXE、窗口/后台/前端/离线 manifest 完整性 | 通过；[包校验](../../../artifacts/I06A-final/package.json)；25 个后台模块、1360 个 Linux 文件、app.asar 和前端与源码/构建输出一致 |
| T-M10-11 | M10-F05 | 普通候选 EXE 的便携 wrapper 退出后后台存活、重开同 PID/身份、原任务 Session 不变 | 通过；[普通 EXE](../../../artifacts/I06A-final/portable.json)；不含每个 worker 故障点 |
| T-M10-12 | M10-F02/F03 | 私有 Linux ELF/版本一致性、实际无可发现 Node 的 Linux 隔离 HOME | 通过实际私有运行验证；无 Node 独立服务器整体 SSH 安装未专项实测 |
| T-M10-13 | M10-F04 | 坏 archive、manifest 文件摘要篡改、远端 UID 不同/空间变化/解压失败、原子发布失败 | 部分安全函数覆盖，完整安装故障矩阵未测 |
| T-M10-14 | M10-F07 | 已有活动任务时升级、失败回滚、卸载仅删所属 Bridge 资源 | 未实现产品流程 |
| T-M10-15 | M10-F06 | 候选验收报告、EXE 摘要、真实 Windows 使用及普通便携程序 | 候选通过；[6A 验收](../../iterations/I06/acceptance.md)，不代表整个 I06 最终准出 |

## 4. 可复制检查与副作用

仓库根目录、Node ≥22.13：

```bash
node --test desktop/tests/worker-runtime.test.cjs desktop/tests/ssh-security.test.cjs
npm run desktop:build
```

第一条只创建测试临时文件，不连接服务器/调用模型。第二条改写编译物、检查前端，不生成 EXE。完整包构建使用：

```bash
npm run desktop:dist
```

它会重写 staging/release，安装根生产依赖时可能下载依赖，需要预备 Linux Node 和 Windows 构建环境。普通 EXE 的真实验收脚本可能连接已配置机器；模型任务是否调用必须根据各脚本具体范围记录。不要在未核实 profile 时把旧用户配置当测试目录清理。

变更发布材料后更新 [设计](design.md)、本报告、整体发布状态和当期迭代报告。新版本应留存构建日志、清单、包摘要和包内实际资源比对；失败/跳过/未测项必须原样报告，不通过改版本号或仅重跑源码测试消除缺口。

## 6A 收尾

本次真实 Windows 预检发现依赖漏打包，已增加独立资源规则；先前版本常量与新清单不一致也已修复。最终 package 校验包含 25 个后台模块、1360 个 Linux 文件、窗口 app.asar、前端与 EXE 摘要：[报告](../../../artifacts/I06A-final/package.json)。

私有 Linux Node 实际启动通过：[报告](../../../artifacts/I06A-final/private-runtime.json)。它使用真实 Linux 隔离 HOME，不是远端无 Node 整体 SSH 部署。候选程序的真实窗口/普通便携启动报告单列，尚未运行的流程保持未测。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## 修复候选

T-M10-16 / M10-F02/F06：2026-10-12 / 0.6.0-alpha.3，Windows x64 portable 构建及完整资源比对通过；25 个后台 CJS、1360 个 Linux manifest 文件、app.asar、前端及版本一致。EXE 大小 129,293,929 字节，SHA-256 `e89a5a6c0e931d8da1f2e9b8a7fb6258ea43203a8c2cf32007244f65c0fbd130`。证据：[构建日志](../../../artifacts/codex-discovery/2026-10-12/package-build.log)、[包校验](../../../artifacts/codex-discovery/2026-10-12/package.json)、[交付及限制](../../iterations/I06/codex-discovery-fix.md)。alpha.2 的完整 SSH/权限流程没有因本条构建被记为新版本重跑。

T-M10-17 / M10-F02/F05/F06：2026-10-12 / alpha.3 普通 Windows portable EXE，隔离 Windows/WSL 状态，未开启 inspector/debug，未提交模型需求。真实窗口与 alpha.3 Coordinator 启动、冻结 Codex 后台与修复源码摘要一致、普通关闭保留后台、重开复用同一 Coordinator 且 requests/delegations=0；通过。[报告](../../../artifacts/codex-discovery/2026-10-12/portable.json)、[脚本](../../../desktop/tests/windows-codex-discovery-portable.cjs)。未切换用户生产后台，生产 profile 升级和全部 SSH 专项未重新验证。

## 兼容复用候选

T-M10-18 / M10-F03/F06：2026-10-12 / alpha.4，Windows portable 构建、25 个后台模块、1362 个 Linux 文件（含两份可信旧清单）、app.asar、前端和版本一致；通过。[构建日志](../../../artifacts/ssh-compatibility/2026-10-12/package-build.log)、[包校验](../../../artifacts/ssh-compatibility/2026-10-12/package.json)。新包大小/SHA-256 与实际兼容范围见 [交付](../../iterations/I06/ssh-compatible-reuse.md)。不是远端 daemon 升级验收；先前 alpha.3/alpha.2 包报告保留。

alpha.4 普通 EXE 在隔离 Windows/WSL profile 中实际启动、关闭、重开，后台版本正确、冻结 Codex 代码与源码一致、复用同一 Coordinator、请求数保持 0；通过，[报告](../../../artifacts/ssh-compatibility/2026-10-12/portable.json)。最终源文件如再改动，需要重建及核对新包；此前普通启动记录的行为适用范围保留。

T-M10-19 / M10-F01/F02/F03/F06：2026-10-12 / alpha.5，桌面 95/95，类型/前端构建/lint、25 个后台模块、1363 个 Linux 文件及 EXE 完整性通过。第三份可信 manifest 为已交付 alpha.4，复制前按历史包摘要核对。Windows 受控前端快照检查单列，真实 SSH 原生流程未重跑。[包报告](../../../artifacts/ssh-error-clear/2026-10-12/package.json)、[本次交付](../../iterations/I06/ssh-error-recovery.md)。

当前 alpha.5 普通便携 EXE 在 Windows 隔离 profile 实际运行：无 debug 参数启动、普通关闭保留后台、重开同后台 3 项通过，native prompts/delegations=0。[报告](../../../artifacts/ssh-error-clear/2026-10-12/portable.json)。不扩大为真实原服务器 SSH 回归。

## I06B alpha.6 历史验证入口

2026-10-12 / 0.6.0-alpha.6：T-M10-20 / M10-F01/F02/F06：alpha.6 新锁定图依赖与所有后台模块离线打包；校验报告默认按版本隔离，避免覆盖 alpha.2 历史。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。

## 当前节点管理专项

T-M10-23 / M10-F01/F02/F03/F06：2026-10-13 / 0.6.0-alpha.9。范围：alpha.9 最终前端、中央与 Linux 包一致性，可信 alpha.8 清单，实际窗口和普通 EXE 分开验证。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。

## I06C alpha.10 当前专项

T-M10-24 / M10-F01/F02/F03/F06：2026-10-13。范围：alpha.10 包含机器管理、私有历史和事件补偿当前源码/前端；收录 alpha.9 历史 manifest 前与实际已交付 digest 核对。现有可信 daemon 只复用、不升级。窗口 app.asar、冻结后台、Linux 离线资源和 portable 均逐项校验。新数据含管理状态，直接旧后台回退不支持；完整升级/回滚/卸载仍待 6C 后续。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## GitHub alpha.9 预发布附件核验

T-M10-25 / M10-F06：2026-10-13 / alpha.9，真实 GitHub API 上传与公开发布查询通过。EXE 为 129,583,670 字节，服务器 state=uploaded，digest=`sha256:80c8a39036ba93466de96955e707280f436b6da258d5e047c7590822e2c0d688`，与本地已有包一致；SHA256SUMS.txt 108 字节，两附件核验后 draft=false/prerelease=true。这是分发核验，没有重新执行 EXE/模型/SSH 验收。已有本地包验收保留原日期与版本；本次源码同步的沙箱回归失败仍保留。原始脱敏元数据与分层结果见 [发布记录](../../iterations/I06/github-release.md)。

## 当前验证

T-M10-25 / M10-F01/F03/F04/F07：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：alpha.11 包含 28 个后台 CJS 和 1376 个 Linux 文件，收录已交付 alpha.10 可信清单。Linux 增加静态 owned-stop、glibc 许可与重链接说明；从 C 源码编译并纳入逐文件摘要。旧 daemon 的安全停机需要支持 pidfd 的 Linux 内核（5.3+）；不支持时明确拒绝，不退回仅 PID 停机。新 daemon 使用认证停机 RPC。verify-package 逐项比对窗口、冻结后台、前端及离线资源；新候选生成并不自动发布或修改原用户后台。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## 上传修复验证

T-M10-26 / M10-F02/F03：2026-10-14 / alpha.14。桌面受控 155/155，上传专项 5/5（含真实本机 TCP SSH/SFTP，使用隔离服务器和数据），Windows Edge 受控响应界面 2 组通过；原生提交 0，未连接用户 Linux。打开/写入/关闭失败、权限/空间/通道关闭/超时、分片/乱序 ACK、原 ID 重新检测和批准、unknown 不提供重装分别有证据。当前包、普通 EXE、原始材料与限制见 [完整增量验收](../../iterations/I06/ssh-upload-recovery.md)。155 包含 5，不重复相加。

alpha.14 包内容比对通过：28 CJS / 1379 Linux 文件，[包报告](../../../artifacts/ssh-upload/2026-10-14/package.json)含版本、大小与 SHA-256；普通 portable Windows 隔离启动/关闭/重开 3 项通过，原生提交和委派为 0，[报告](../../../artifacts/ssh-upload/2026-10-14/portable.json)。未上传新 GitHub Release，未连接用户服务器。

## 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

## alpha.15 源码包重建

2026-10-14 / WSL Ubuntu / Node 22.23.1：从当前 `0.6.0-alpha.15` 源码执行 `npm run dist:win`，Windows x64 portable EXE 构建与 `verify-package.cjs --portable` 均通过。后端 28 个模块、Linux 离线资源 1380 个文件；`app.asar` 源码和前端与当前源码一致。EXE 为 129,851,710 字节，SHA-256 `d1052ed5cd7893a9842ee96b6bf87c40b2ec6a5389ac59ef28ad5eb528e0ac4f`。本次构建没有重新执行真实 Windows 用户流程；alpha.13 普通 EXE 的实机证据与 alpha.15 包构建分开记录，完整 I06C 仍未准出。

alpha.15 发布复核：源码提交 `15b7c9ea9c3d53802797b655e0cffaf365658574` 已位于 GitHub `master`，`v0.6.0-alpha.15` 为 prerelease。EXE 远端 state=`uploaded`、129,851,710 字节、digest 与本地一致；`SHA256SUMS.txt` state=`uploaded`，109 字节。真实 Windows 用户流程未在这次构建后重跑；稳定历史版本仍为 0.5.0，完整 I06C 未准出。详见 [发布记录](../../iterations/I06/github-release.md)。

发布后测试补充：新增四项仅测试代码的维护传输边界回归，桌面全量当前 163/163。新增测试不改变 alpha.15 EXE 中的产品源码；具体边界见 [M04 SSH 测试报告](../04-ssh-access/test-report.md)。

## alpha.16 源码包重建

2026-10-14 / WSL Ubuntu / Node 22.23.1：`npm run dist:win` 首次因 electron-builder 临时打包错误退出，28 MB 临时文件未使用；清理临时 EXE 后重跑成功，`verify-package.cjs --portable` 通过。最终包版本 `0.6.0-alpha.16`，28 个后台模块、1381 个 Linux 文件，app.asar/前端匹配源码；EXE 129,851,194 字节，SHA-256 `d1e35450e57967767fc5031ba4bdc8dfb5f5552dc374079a4a3005fc5f3223ba`。根 43/43、桌面 163/163、SSH 定向集成 7/7 通过。真实 Windows 用户流程未重跑；完整 I06C 未准出。

## 最终候选验证

2026-10-14：Windows x64 EXE 129,851,194 字节，SHA-256 `d1e35450e57967767fc5031ba4bdc8dfb5f5552dc374079a4a3005fc5f3223ba`；28 后台模块/1381 Linux 文件与源码一致：[最终包报告](../../../artifacts/I06C-final/2026-10-14/package-alpha16-final.json)。普通无调试 EXE 真实启动/关闭/重开 3 项通过，独立 profile、原生需求 0：[报告](../../../artifacts/I06C-final/2026-10-14/portable-alpha16.json)。实际 Linux 维护、原文件任务与完整准出限制见 [当前交付](../../iterations/I06/maintenance-launch-recovery.md)。历史 alpha.15 分发摘要不被本版本覆盖。

## 独立最终候选检查

2026-10-14：源码快照独立构建后与主工作区逐项校验通过，28 CJS / 1382 Linux 文件；EXE 129,849,380 字节，SHA-256 `aa97a2b2adbd3bff8837fee10d16433b929225d384dc5e5b1966d315873905d5`。[包报告](../../../artifacts/I06C-final/2026-10-14/package-alpha17-final.json)。普通 Windows EXE 启动/关闭/重开 3 项通过，无调试参数，独立 profile，原生需求 0：[窗口报告](../../../artifacts/I06C-final/2026-10-14/portable-alpha17.json)。冻结 alpha.16 服务器维护结果分别计，alpha.17 未冒充原生模型重测。

当前 alpha.18 已以 GitHub prerelease 分发：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/AgentBridge-0.6.0-alpha.18-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/SHA256SUMS.txt)、[源码 PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。源码标签绑定 `1f0d9ef`，独立分支未合入 master；分发只证明对应附件核验，不扩大为完整 I06C 准出。详见 [发布记录](../../iterations/I06/github-release.md)。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

当前 alpha.19 已以 GitHub prerelease 分发：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/AgentBridge-0.6.0-alpha.19-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/SHA256SUMS.txt)、[源码PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。包含 Linux Codex 发现与 OpenCode 二次检查/Windows配置保存修复；源码标签绑定 `fce41be`，尚未合入master。远端需“后台维护→升级后台”后重扫。核心45/45、桌面181/181，包内Linux真实版本探测、Windows受控6组/普通EXE4组通过；未实测用户服务器/Windows原生推理，完整I06C未准出。

## 候选打包与普通EXE

T-M10-27 / M10-F01/F02/F03/F05/F06：2026-10-15，WSL Node22.23.1构建Windows x64 portable，28个CJS/78个核心文件/1385个Linux清单项与源码匹配。EXE 129,856,325字节，SHA-256 `3219d8ae59aea83a2d208e4bb71eb7fdc080a2a812504aa6f506d2cce40e1e41`。核心45/45、桌面串行188/188、lint/类型/构建/包校验通过；初轮并行维护测试ENOENT及专项8/8复验均保留。Windows普通无调试EXE/合成NOT_CONFIGURED恢复及关闭重开4组、Edge生产前端/受控API4组通过，模型0。发布/下载证据与未测项见[专项](../../iterations/I06/pending-isolation.md)。不宣称用户故障已复现或完整I06C准出。

alpha.20已公开预发布：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/AgentBridge-0.6.0-alpha.20-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.20)。分发元数据和完整EXE下载摘要核验通过，源码标签9b2d5ea；不将分发成功扩大为用户故障或真实模型验收。[发布及证据](../../iterations/I06/pending-isolation.md)。
