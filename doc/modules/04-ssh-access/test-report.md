# M04 SSH 接入测试报告

当前公开alpha.69已收录当前维护源码，冻结04ee6fe。包内源码/前端/Linux资源与实际EXE载荷匹配；普通EXE合成profile恢复和完整重启通过，真实原生与用户profile仍按各自证据边界。[本轮发布与分层验收](../../iterations/I08/alpha69-release.md)。

T-M04-213 / M04-F03/F08：2026-10-29，master10fdbb3及未发布工作树，Windows系统Node24.12.0。中文profile的原密文删除回归修复前0/2、最终2/2，并在Electron组件共享7/7与WSL共享151/151中通过；准确删除、替换/取消保存、缺失引用和非文件错误与机器编辑共享验证。合成加密输出，未读取用户凭据或重测真实DPAPI；本机Electron44.7.0/Node24.21.0对照未复现rmSync问题。[原始反例、最终结果与限制](../../iterations/I08/windows-regression-and-native-probes.md)。

2026-10-25：冻结alpha.62对原真实SSH只读三组通过，认证/指纹、原37清单1459项、两次非接管检查及原PID/配置保持，模型0；完整故障/版本切换与普通EXE联合流程仍未准出。产品无变更，[当前证据](../../iterations/I08/alpha62-ssh-readonly.md)。

2026-10-23，当前冻结alpha.56客户端已对原独立SSH服务器完成只读复验：实际daemon为alpha.37，原凭据/主机指纹认证、生产逐文件核验、两次非接管inspect通过；原daemon身份/PID、远端入口与本地连接配置保持，模型0。完整故障/升级矩阵与普通EXE联合流程仍未准出。[原始报告、脚本及来源](../../iterations/I08/current-ssh-readonly.md)。既有863/863为alpha.56交付证据，本轮不重复计数。

2026-10-23，alpha.56本地候选：桌面全量863/863、零跳过；实际完整维护CLI读取超过旧8MiB的大目录并查询原unknown，原收据文件字节与真实合成daemon PID/daemonId不变。输入保真3/3与复用/查询传输26/26通过，完整命令保留所有版本，查询不改原持久意图。均为本地受控进程/传输，模型0，不是用户SSH或真实任务准出。[完整证据与边界](../../iterations/I08/maintenance-input-capacity.md)。

2026-10-23，alpha.55本地候选；M04-F04/F05/F06与M05-F01/F02。真实冻结53的1702文件/原Node在受控probe与文件系统SFTP适配下验证3组通过，篡改稳定返回SSH_PACKAGE_CHECKSUM、原元数据和合成unknown字节不变，变更方法0；不是实际SSH网络/原生产PID证明。最终桌面856/856、Windows包内兼容23/23及八字节诊断通过，模型0。未知版本、摘要/归属/路径和索引129项拒绝；37份已核验pin与128项边界分开计数。[原始证据、失败与交付边界](../../iterations/I08/daemon-compatibility-refresh.md)。

2026-10-23，alpha.52：远端与断开原节点受控契约9/9通过，包含旧后台无安全写入标记零派发拒绝。完整桌面841/841、核心68/68共享回归通过；Linux daemon契约在Linux已通过，Windows上明确不支持。未连接或部署独立SSH，不提升原远端/模型验收。[原始证据](../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

## alpha.38 只读门禁 RPC 与越过确认

T-M04-152 / M04-F04/F06/F08：2026-10-21，工作区 0.6.0-alpha.38，受控 TCP SSH + 假 client/installer，模型 0。[daemon-maintenance.test.cjs](../../../desktop/tests/daemon-maintenance.test.cjs) 与 [ssh-recovery-integration.test.cjs](../../../desktop/tests/ssh-recovery-integration.test.cjs) 合计 **26/26**（失败/跳过 0），覆盖显式确认后的门禁收集与 `overridden`/`unresolved` 落盘、非越过路径行为不变；新界面用例 [ui-maintenance-blockers.cjs](../../../desktop/tests/ui-maintenance-blockers.cjs) 5 checks 通过，其中第②③⑤项覆盖“按原 ID 单次查询”“门禁原话显示”与“无收据端点不判整体失败”。**真实 SSH 远端与真实 EXE/GUI 未测**：越过路径的远端停机与占位接管只在受控夹具验证；真实阿里云机器的切换是运维侧带外作业，不作为产品 UI 验收（见[交付记录第 5 节](../../iterations/I08/alpha38-delivery.md)）。[契约、风险与未测边界](../../iterations/I08/alpha38-delivery.md)。

## alpha.36整合边界

2026-10-21 / WSL Node22.23.1：本轮全量核心57/57、桌面676/676，类型/lint/前端构建通过。各模块共享计数不相加；包核验、Windows契约144/144、界面26组与普通EXE7组通过，具体以专项为准，真实模型/用户profile/独立SSH未验。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## 维护终态重连恢复

T-M04-151 / M04-F06/F08：2026-10-21 / 工作区 0.6.0-alpha.36 / Linux 本机 Node v22.23.1，受控 TCP SSH + 假 client/installer，模型 0。[ssh-recovery-integration.test.cjs](../../../desktop/tests/ssh-recovery-integration.test.cjs) 8/8（新增 1）：终态 rejected 收据 `stopped:false` → 维护暂停解除（`autoReconnect=true`、不再 `disconnected_manual`），可读到拒绝原因；`stopped:true/rolledBack:false` → 保持 `disconnected_manual` 且不自动重连。该文件与 [daemon-maintenance.test.cjs](../../../desktop/tests/daemon-maintenance.test.cjs) 12/12 合计 20/20（相关 SSH 专项集合 38/38）；受控夹具不是真实用户远端或真实 EXE/GUI，未在用户现场复现。[本轮说明与未测边界](../../iterations/I08/maintenance-offline/maintenance-offline.md)。

## 维护上传进度与持久化修复（issue #10）

M04-F04/F06：本轮WSL专项7/7、相关42/42与核心51/51，Windows最终7/7及SSR66/66通过；最终全量/真实TCP/普通EXE/公开下载逐层记录。用户profile及独立服务器未验，共享计数不跨模块叠加。 [完整设计、实测与边界](../../iterations/I07/maintenance-persistence.md)。

## 整合源码与本地候选

T-M04-149 / M04-F04/F05/F08：核心51/51、桌面570/570零跳过（定向85/85及兼容15/15是相关子集），根类型/lint/构建与桌面构建通过。Windows前端26组/模型0，按历史/门禁/管理/材料/MCP分别记录；最终integrated.3普通Windows EXE五组通过：原历史/文档/MCP导出、窗口/后台重开、持久资源和原unknown保留，原生请求0；这是隔离合成profile，不是真实Agent模型或用户现场。包42 CJS/78核心/1446 Linux条目匹配，未部署用户SSH或跑真实模型。各模块共用计数不相加；首次夹具/原型失败与原历史证据保留。[版本、源码、所有原始结果和限制](../../iterations/I07/integrated-source.md)。

## issues #8/#9受控验证

M04-F03/F05：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## issue #7 协作兼容修复

M04-F03/F05：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## 历史详情路由与局部错误

T-M04-150 / M04-F04/F05/F08：alpha.30隔离修复；合成路由6项、受控TCP SSH1项、Windows纯CJS91/91、Linux SSR63/63，新生产前端7组和既有10组通过，模型0。最终桌面529/529、核心45/45、lint/类型/构建通过；38 CJS/78 core/1401 Linux资源匹配145个冻结源文件。普通Windows无调试EXE合成原两轮/Session只读与关闭重开/后台重启4组通过。分发实际结果及首次失败统一见[当次专项](../../iterations/I07/history-detail-recovery.md)；共享计数不跨模块叠加，用户故障profile/独立服务器未复测。

## UI 本地候选的旧 alpha.28 可信清单

M04-F04/F05/F08：`0.6.0-alpha.28.ui.2` 本地候选在独立源码快照中收入原 alpha.28 Linux manifest，原清单 digest 为 `b06a14fe3716c2df46cb665e21f137d05aab6046a611cb0275c5cadbc365d00d`，来源对应[原 alpha.28 包报告](../../../artifacts/daemon-rejection-recovery/2026-10-17/package.json)。没有修改主工作区版本/lock或原发布包，也没有放宽未知版本信任。

所有本次结果绑定北京时间08:50冻结的UI交付源码，不覆盖11:18以后其他线程在共享目录加入的Agent适配、工具发现和图标增量；未把后续目录变化重新打入或当成本候选已测范围。

| 范围 | 本次实际结果 | 证据与边界 |
| --- | --- | --- |
| 候选内可信清单与离线资源 | 包校验passed，34 CJS/78 core/1396 Linux条目、ASAR与前端匹配；新manifest digest `c0e1db13e63a1f7985f074afc5d9791b07b555b66f30566351b1d400251e2d83` | [包报告](../../../artifacts/ui-redesign/2026-10-18/package-ui2.json)；这是本地包完整性证据，没有执行远端安装 |
| UI 原状态门槛 | Windows Edge受控API状态矩阵10组通过，包含connected但online=false禁续问、snapshot失败保留旧快照时禁发、unknown原节点隔离；业务执行0 | [状态报告](../../../artifacts/ui-redesign/2026-10-18/state/2026-10-18T00-48-05-809Z/ui.json)、[视觉专项](../../iterations/I07/ui-visual-acceptance.md)；不是SSH认证、SFTP或真实daemon链路 |
| 普通候选 EXE | Windows隔离profile、真实IPC/SQLite和关闭/重开/后台重启4项通过，模型0，原请求无新增/重放 | [普通EXE报告](../../../artifacts/ui-redesign/2026-10-18/portable-ui2.json)；观察到10条只读历史，不证明用户远端迁移或升级 |
| 用户SSH和原生模型 | 本次未连接用户独立服务器，未安装/升级/回滚远端daemon，未提交模型需求 | 历史SSH认证、原后台复用和真实任务证据保留原日期/版本，不能挪为本候选新验收 |

候选完整版本、字节摘要和失败保留见[当次交付](../../iterations/I07/ui-redesign.md)。GitHub仍为原alpha.28公开附件；本次清单收入不改变完整I06C/I07C未准出的状态。

## SSH持久拒绝恢复

T-M04-128：alpha.28已预发布，WSL Node22.23.1/Windows Node24.19.0，合成台账和受控TCP SSH，模型0。最终桌面317/317、核心45/45、Windows契约93/93，lint/类型/构建通过；真实TCP SSH丢响应/daemon重启1项及普通Windows无调试EXE合成验证6组通过，34 CJS/78 core/1395 Linux资源匹配源码。发布以[当次实际记录](../../iterations/I06/daemon-rejection-recovery.md)为准，不推定用户现场恢复。历史记录不计为本次重测。

## Windows恢复专项

T-M04-128：2026-10-17 / WSL Node22.23.1与Windows Node24.19.0 / alpha.27已预发布，模型0。Codex恢复10/10、共享原子写入10/10、网络最终50/50、Windows契约86/86；全桌面最终运行288/288、核心45/45及工程检查通过；新增alpha.26兼容文件另验10/10。共享计数不跨模块累加，Windows为受控目录/执行器，不是用户故障或真实模型。首轮限制/维护ENOENT与未测范围保留；普通EXE/包/发布结果以[当片报告](../../iterations/I06/windows-start-persistence.md)后续实际记录为准。
## Linux 后台重连专项

实际冻结alpha.24→alpha.26的受控TCP SSH/SFTP链4组、Windows普通EXE5组通过；Linux独立资源归档1392条目一致，独立服务器/真实原生任务迁移未测。

alpha.26 预发布：SSH 兼容/安全/维护/恢复 36/36 通过，WSL Linux / Node22.23.1，受控 TCP SSH 和真实隔离后台测试、模型0；原 alpha.25 确认缺少 alpha.24 信任清单，候选匹配原 alpha.24/alpha.25 digest。源码回归不等于用户独立服务器已恢复；实际包/Windows/端到端结果及失败证据统一见[专项报告](../../iterations/I06/ssh-alpha24-upgrade.md)。

## Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

当前基线：2026-10-14 / 0.6.0-alpha.16。工程与受控维护验证通过；独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
更新：2026-10-13。当前候选 alpha.8 的兼容资源核对见下节；alpha.5 修复与此前 0.6.0-alpha.2 的主要认证验收保持原范围。Windows 到独立 Linux 密码登录与实际 DPAPI 恢复通过；Windows 加密私钥/命名管道 agent 使用真实 SSH 协议与隔离服务验证。系统 OpenSSH agent 服务兼容性、全故障/延迟指标仍未专项实测。



## 兼容资源边界

原 alpha.7 manifest 先与历史交付 digest 核对，再收入 alpha.8 资源。27 后台 CJS 与 1368 个 Linux 文件、既有受控回归见 [拖动修复](../../iterations/I06/graph-drag-fix.md)。本次没有原用户 SSH 重连、升级 daemon 或模型任务；历史原生与认证结果仍按原日期/版本保留。

## 历史兼容资源核对

T-M04-24 / M04-F04：2026-10-13，alpha.6 Linux manifest 与历史交付 digest 核对后加入 alpha.7 可信兼容清单。完整桌面 116/116 包含既有 SSH/SFTP 受控回归；新包资源与摘要见 [图优化](../../iterations/I06/graph-usability.md)。本次没有对用户原 SSH 服务器重连、安装、升级或提交模型需求；真实 SSH/认证结果继续按原日期/版本保留。

## 1. 已执行基线

| 来源 | 日期/结果 | 范围 |
| --- | --- | --- |
| [桌面 TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) | 2026-10-12，87/87 通过，0 失败/跳过 | `ssh-security.test.cjs` 共 9 个受控用例；它们是全套回归的子集 |
| [界面报告](../../../artifacts/I06A-ssh-ui.json) | 2026-10-10，5 项通过、0 错误 | Edge 隔离 renderer + mock；没有 SSH 或真实 Agent 调用 |
| [真实服务器说明](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md) / [JSON](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json) | 2026-10-10，密钥真实连接、安装、发现、任务/恢复成功 | 接入端为 Linux 开发环境；远端 Linux x64/glibc 2.32、系统 Node 24.13.0、OpenCode 2.0.26 |

本次文档整理读取上述证据，没有新连接服务器或修改认证设置。既有证据中的“密码”仅用于先前公钥配置，不是 Bridge 密码认证分支验收。

## 2. 功能/测试映射

下列真实测试名均来自 [ssh-security.test.cjs](../../../desktop/tests/ssh-security.test.cjs)，结果可在本次 TAP 找到。**受控**表示模块函数 + 合成输入/注入替身，不能证明真实 sshd 登录。

| 用例 ID | 功能 ID | 实际用例名 | 结果及证明边界 |
| --- | --- | --- | --- |
| T-M04-01 | M04-F02 | `host trust persists only a specifically accepted key and refuses changes` | 通过，受控：首次未保存、明确保存后复用、端口不同与公钥变化拒绝 |
| T-M04-02 | M04-F02 | `OpenSSH known_hosts supports hashed names, wildcard exclusions, and revoked keys take precedence` | 通过，受控：哈希记录、否定通配、撤销优先 |
| T-M04-03 | M04-F02 | `relevant CA records and changed global keys cannot become an automatic first trust` | 通过，受控：CA 报未支持，已有公钥变化不变成首次信任 |
| T-M04-04 | M04-F03 | `unsaved credentials are memory-only, expire, and are zeroed after consumption` | 通过，受控：手动 discard 和 TTL 清零，不落秘密文件；没有登录真实服务器 |
| T-M04-05 | M04-F03 | `saved credentials use only encrypted system-store output and configs contain only a reference` | 通过，受控：注入 AES-GCM 加解密函数检查引用和密文，不是真 DPAPI |
| T-M04-06 | M04-F03 | `system protection failure has no plaintext fallback and DPAPI uses current user` | 通过，受控/静态：保护函数报错不写明文，检查 DPAPI 脚本文本 CurrentUser/stdin；没有运行真实 PowerShell 解密 |
| T-M04-07 | M04-F01 | `SSH endpoint validation rejects shell-looking addresses while usernames stay structured data` | 通过，受控：地址/端口验证、IPv6、用户名作为数据、受控路径引用；不是认证成功测试 |
| T-M04-08 | M04-F04 | `release manifest path traversal and checksum changes stop before upload` | 通过但范围有限：具体用例只构造 `../` 路径并检查 Node 门槛，没有单独篡改合法文件 SHA-256；摘要校验代码不能由这个名称直接宣称实测 |
| T-M04-09 | M04-F04 | `SFTP directory checks reject symlink parents and foreign UID before mutation` | 通过但范围有限：具体断言为符号链接父目录及 HOME 外路径拒绝，没有单独构造不同 UID |
| T-M04-10 | M04-F01/F02/F03/F04/F05/F07 | `windows-i06a-ssh-ui.cjs` 的 5 项界面流程 | 通过，mock 界面：隐藏密码/默认不保存、指纹批准、安装摘要、空格选择 Agent、远端目录与重连输入、密钥变化没有忽略入口 |
| T-M04-11 | M04-F01/F04/F05 | 真实报告 `createSshDraft` → `testSsh` → `connectSsh` → snapshot/attachNode | 通过，真实/既有：密钥认证 + 已有哈希 known_hosts 信任；首次安装连接 77.8 秒，发现远端 OpenCode |
| T-M04-12 | M04-F06/F07 | 真实说明第 9–13 项；`verify-reconnect.cjs` / `verify-survival.cjs` | 通过，真实/既有：中央重启沿用原机器，断线期间任务继续，重连读结果；完整自动退避和时间指标不由此证明 |

界面脚本名含 Windows，实际使用 Windows Edge 测 renderer mock。报告里的 fixture-password 为合成输入，不是用户服务器密码。它不能证明 Electron 主进程、本地 IPC、ssh2 或 Windows 系统密码保护。

## 3. 未完成验收

| 用例 ID | 功能 ID | 场景 | 状态 |
| --- | --- | --- | --- |
| T-M04-13 | M04-F01/F03 | Windows 密码登录、DPAPI 保存后新实例解密并重连 | 通过；真实独立 Linux OpenSSH 与实际 DPAPI，[密码报告](../../../artifacts/I06A-password-real.json)；不保存后的 EXE 密码重连未专项实测 |
| T-M04-14 | M04-F01/F03 | Windows 加密私钥与命名管道 agent 实际签名 | 通过；真实 TCP SSH/加密 RSA/命名管道签名，服务端和 agent 为隔离测试进程，[认证报告](../../../artifacts/I06A-auth.json)；未改动或实测系统 OpenSSH agent 服务 |
| T-M04-15 | M04-F02 | 真实未知主机确认/拒绝、真实 host key 改变及撤销 | 未单独实测；当前真实服务器沿用已有可信 known_hosts |
| T-M04-16 | M04-F04 | 无系统 Node 真实机器、磁盘不足、坏归档/逐文件篡改、不支持 glibc/架构 | 未完成；实际服务器使用系统 Node，安全函数受控覆盖有限 |
| T-M04-17 | M04-F06 | 1/2/4/8 秒退避、凭据就绪后 ≤30 秒恢复、20 样本状态同步 p95 ≤2 秒 | 未测性能指标；77.8 秒是首次安装连接，不是断线恢复耗时 |
| T-M04-18 | M04-F06 | 事件 cursorGap 后自动完整 snapshot 恢复 | alpha.10 已修复并通过生产 daemon/真实本机 TCP SSH 隔离集成；独立服务器专项待验 |
| T-M04-19 | M04-F08 | 修改/移除连接、升级/停止/卸载后台 | alpha.10连接编辑/移除/恢复已有专项；alpha.11后可信升级/回滚/停止/卸载已实现，按[I06C收尾](../../iterations/I06/final-delivery.md)与后续恢复专项的实际分层证据判定；ui.2未在用户远端复验 |

## 4. 复查命令与副作用

仓库根目录、Node ≥22.13：

```bash
node --test desktop/tests/ssh-security.test.cjs
npm test --prefix desktop
```

上述自动化只用临时测试文件和合成秘密，不接真实服务器、不发送模型请求。界面 mock 可在 Windows 启动开发前端后执行：

```powershell
npm run dev --prefix desktop -- --port 4206
node desktop/tests/windows-i06a-ssh-ui.cjs http://127.0.0.1:4206
```

第二条需要脚本所配置的 Windows Edge 路径和 Playwright；覆盖的是隔离界面。真实脚本 [e2e-i06a.cjs](../../../.agentbridge-dev/e2e-i06a.cjs) 与 verify 脚本会连接已有开发 SSH 配置，安装/启动 Bridge、建立原生会话并可能产生模型费用，不作为自动回归命令默认执行。

修改 SSH/安装时同步 [设计](design.md)、本报告、原始证据和当期迭代。新增通过项必须注明使用哪个系统、认证方式、发布包以及是否实际调用模型，不能把受控加密或 mock 回答改写成真实验收。

## 6A 收尾

| 用例 ID | 功能 | 本次运行 | 结果 |
| --- | --- | --- | --- |
| T-M04-20 | M04-F01/F03 | Windows TCP SSH 密码、加密私钥、命名管道 agent 与实际 DPAPI | 4 项通过；[认证报告](../../../artifacts/I06A-auth.json)、[脚本](../../../desktop/tests/windows-i06a-auth.cjs)。SSH 服务与 agent 是隔离进程，未调用模型 |
| T-M04-21 | M04-F01/F03 | Windows 到独立 Linux 密码登录、DPAPI 保存后新实例读取并再次登录 | 2 项通过；[报告](../../../artifacts/I06A-password-real.json)、[脚本](../../../desktop/tests/windows-i06a-password-real.cjs)。只读认证检查，无部署或模型请求 |

窗口安装、节点接入与真实两轮回复按 [Windows 报告](../../../artifacts/I06A-real/report.json) 当前 status 判定。此前“Windows/DPAPI 未实测”的结论仅适用于整理前历史基线；本节与 T-M04-13/14 是当前结果。

## 兼容已安装后台

T-M04-20 / M04-F04/F05/F06：2026-10-12，alpha.4，新增 `ssh-compatibility.test.cjs` 四项受控场景，桌面 93/93 通过。[TAP](../../../artifacts/ssh-compatibility/2026-10-12/desktop-tests.tap)核验旧发布只读复用、未知版本/摘要/别名拒绝、探测后变化/归属/符号链接拒绝及清单/远端文件核验失败拒绝。

T-M04-21：Windows → 用户已有独立 Linux，使用现有 DPAPI 加密凭据，真实探测和逐文件核验原 alpha.2 发布、核对原 daemonId/PID、版本入口不变；通过，[只读报告](../../../artifacts/ssh-compatibility/2026-10-12/remote-readonly.json)。没有安装/部署写入，没有发送模型需求。[脚本](../../../desktop/tests/windows-ssh-compatible-real.cjs)；旧 alpha.3 真实远端连接、完整升级/回滚和故障矩阵未单独验证。

T-M04-22 / M04-F05/F06：真实原 SSH 连接经 alpha.4 完成协议/身份/版本握手，重新发现 OpenCode，实际旧 daemon PID 保持，版本入口保持；通过，[连接报告](../../../artifacts/ssh-compatibility/2026-10-12/remote-connect.json)。测试观察通道结束后关闭，本报告不宣称用户仍在运行的旧客户端已加载新代码。初次脚本把已安装工具断言在执行实例列表中，断言失败记录保留为 [初次记录](../../../artifacts/ssh-compatibility/2026-10-12/remote-connect-initial.json)；改用真实 discover 检查安装后通过，产品代码没有为该断言失败修改。


## 当前 alpha.5 恢复错误清理验证

T-M04-23 / M04-F05/F06：2026-10-12 / alpha.5，新增 2 项受控状态回归、全桌面 95/95，通过。旧版本报错在恢复成功后撤销并持久化，旧目录成功快照不继承错误，新的 RPC/主机密钥错误仍显示；原连接/接入节点/任务历史保持。Windows 当前前端的受控快照卡片渲染 2 项通过。原用户状态只读核验，不是新包实际远端重连或模型验收。[本次测试与范围](../../iterations/I06/ssh-error-recovery.md)、[TAP](../../../artifacts/ssh-error-clear/2026-10-12/desktop-tests.tap)、[UI](../../../artifacts/ssh-error-clear/2026-10-12/ui.json)。

## 当前节点管理专项

T-M04-25 / M04-F04/F05：2026-10-13 / 0.6.0-alpha.9。范围：alpha.9 包中已核对摘要的 alpha.8 信任清单；未触发用户远端自动升级。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。

## I06C alpha.10 当前专项

T-M04-26 / M04-F02/F03/F05/F06/F07/F08：2026-10-13。范围：machine.updateSsh/remove/restore/disconnect/reconnect 接收 operationId、connectionId、expectedRevision 和可选原 machineId；operation 查询原收据。updateSsh config 为白名单 name/host/port/username/authKind/keyPath，修订冲突拒绝。绑定 SSH 用户不可变；改认证来源解除旧引用并删除密文，remove 清除保存凭据，known_hosts 与远端安装保留。原主机公钥、daemonId 与 UID 核对跨地址继续有效。配置与 lifecycleOperations 同文件原子提交；状态 removed 不自动重连。cursorGap 后全量快照且 drain 全部分页，无任务重放。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## 维护预览与控制收据验证

T-M04-19 / M04-F08：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：machine.daemonPreview 返回可信当前、目标、previous 版本及 previewId；machine.maintainDaemon 校验 expectedRevision、摘要和动作，先完整暂存并验证目标，再持久化原意图、暂停自动重连，发送一次远端维护启动。控制器复制到私有 `state/maintenance-runtime/<digest>`，使卸载后仍可查询原收据。远端回应丢失仅 machine.operation 查询；中央重开仍保留同一 remoteInput 与操作。凭据失效显示 needs_credentials，输入后继续查询原维护，不能另起升级。暂存/认证明确未发送失败为 DAEMON_STAGE_REJECTED。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## 上传修复验证

T-M04-20 / M04-F04/F06：2026-10-14 / alpha.14。桌面受控 155/155，上传专项 5/5（含真实本机 TCP SSH/SFTP，使用隔离服务器和数据），Windows Edge 受控响应界面 2 组通过；原生提交 0，未连接用户 Linux。打开/写入/关闭失败、权限/空间/通道关闭/超时、分片/乱序 ACK、原 ID 重新检测和批准、unknown 不提供重装分别有证据。当前包、普通 EXE、原始材料与限制见 [完整增量验收](../../iterations/I06/ssh-upload-recovery.md)。155 包含 5，不重复相加。

## 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

## 维护入口会话拒绝恢复验证

T-M04-27 / M04-F08：2026-10-14 / alpha.15，WSL Ubuntu / Node 22.23.1。范围：预检单 SFTP 会话；只读预检同连接+新连接各一次受控重试、语义拒绝不重试、凭据缺口 needs_credentials；维护启动"可证明未发出"重试一次、再次未发出记 rejected、其余保持 unknown；查询通道拒绝新连接重试一次；错误消息携带原因码/退出码。发布提交时桌面回归 159/159；随后新增四个传输边界用例与产品修复属于 alpha.16，当前 163/163 与实机状态见下一节。根 43/43、lint、typecheck 通过。受控服务器不等于独立服务器根因确认；独立空闲维护专项需以 alpha.15 重验，结果另计。


## 维护未发送状态跨重试与查询验证

2026-10-14 / WSL Ubuntu / Node 22.23.1：根测试 43/43、桌面全量 163/163、SSH 恢复 TCP 集成 7/7 通过。新增/更新场景覆盖 open 前明确未发送、重试登录缺少凭据、重启后同 operationId 查询、operation 冲突保留语义错误，以及 stream/timeout 响应不明时原 unknown 收据不被替代。Windows portable 包一致性校验通过，实际 Windows 用户流程与独立服务器维护重验未执行；无用户服务器操作和模型调用。具体行为见 [I06C 收尾 alpha.16](../../iterations/I06/final-delivery.md)。

## 维护发送边界验证

T-M04-28 / M04-F08：2026-10-14 / WSL Ubuntu / Node 22.23.1，桌面 163/163，SSH 恢复 7/7 已包含其中。覆盖认证前未发送证明、实际原子快照重开查询/占位恢复、第二次打开拒绝、发送后流中断/超时仍 unknown、原操作去重与新 ID 拒绝。真实 TCP SSH，受控服务/合成凭据，模型 0。alpha.15 发布仍为原 159/159；当前独立服务器与包结果见 [当次交付](../../iterations/I06/maintenance-launch-recovery.md)。

## 当前性能与信任验证

2026-10-14 / WSL Ubuntu / Node 22.23.1，桌面 164/164 通过。新增已校验快照后兼容清单篡改仍拒绝的受控检查；Windows Node / WSL UNC 的冻结 alpha.16 资源完整校验 11,821ms，14 份固定清单核对 289ms。不是全链时延，不是 alpha.17 模型实测。[完整分层验收](../../iterations/I06/maintenance-launch-recovery.md)。

2026-10-14：冻结 alpha.16 的独立 Linux 空闲维护升级/回滚/再次升级/停止/明确重连/卸载全链通过，五个原维护 confirmed，原生需求 0，身份与用户原配置保持。该 profile 无原生任务，不充当非空模型历史迁移验收；原文件 unknown 另存。[最终实机证据与限制](../../iterations/I06/maintenance-launch-recovery.md)。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

2026-10-29 / alpha.70候选 / Windows：定向98/98、包内关系/SSH33/33、普通portable恢复与完整重启、实际包内恢复及真实回环SSH/SFTP界面流程通过，模型0。第二轮全量1030通过/1失败/41平台跳过，DSH同一竞态基线也有失败；各原失败及验收器收尾限制保留。不代表真实profile、生产SSH或完整矩阵准出。[证据与边界](../../iterations/I08/issues27-28-current-state.md)。
