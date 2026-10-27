# alpha.67 Linux Hermes 实际执行与 WSL 启动修复

日期：2026-10-27（Asia/Hong_Kong）。需求：在已安装并配置的 WSL Hermes CLI 上完成项目对接、代码与文档、实际验收和 GitHub 发布。承接公开 alpha.66；当前候选 alpha.67，旧标签与附件保持。

## 缺口与实现

alpha.66 已完成 Linux 安装发现、独立 Ubuntu 回归及原生 MCP 组件；本轮继续补实际 Windows→WSL→MachineHost→正式 Hermes 的真实执行、原请求去重和同 Session 续聊。只沿用 WSL 原生配置，不复制 Windows 凭据，不增加模型 API 或覆盖供应商/模型。

两次原 alpha.66 HostConnection 启动在就绪前失败，未准备节点上下文或提交模型请求。原验收目录保留，Linux /proc 核对原宿主均已退出。直接在 Linux 启动同一冻结入口，实际 47188ms 后输出就绪帧并退出0，无业务请求；原 Windows 端 30000ms 预算不足。已将仅 WSL 的启动握手预算改为120000ms，业务请求的65000ms计时仍从握手后开始。并发启动共享原Promise，未握手不写业务帧，超时/关闭仍返回严格未派发证明；已写入后失联保持unknown，不自动重放。不是冷启动性能准出。

新增实际 Windows→WSL Hermes 验收脚本，先核对冻结后台与Linux manifest，私有检查点保存原验收目录、提交意图与请求；恢复时先查原收据，未确认的原意图不重发。两轮均要求原生成功结果、原Session一致与上一轮记忆；独立记录原生配置变化，不把原生自身迁移或认证刷新当作Bridge改写模型。公开报告不包含凭据、原生Session或私有接入身份。

WSL原生已配置模型凭据，但原配置HTTPS端点直连不可用；临时Windows回环CONNECT通道实测返回HTTP401（仅证明未带凭据可达，模型0），后续真实验收只在进程环境使用该通道，保留TLS证书校验，不改全局路由/代理。不是日常网络已修复的证明。

## 当前证据

- 原未派发启动失败：[首轮](../../../artifacts/hermes-linux/2026-10-27/live-wsl/report-startup-first.json)、同目录恢复失败；两次均无节点上下文/业务提交，首个验收器退出跟踪不足如实保留。
- 冻结Linux入口47188ms：[实测](../../../artifacts/hermes-linux/2026-10-27/native-entry-probe.json)。
- WSL握手与Hermes发现受控22/22：[TAP](../../../artifacts/hermes-linux/2026-10-27/live-targeted.tap)，其中握手9/9；不是模型或真实启动通过数。
- Windows→WSL Node24.13.0→正式Hermes0.22.5实际两轮成功，原ID去重、完整观察通道重开、同原生Session及上一轮记忆验证通过；只存在两条原任务/请求，原配置字节一致，两原WSL传输退出0：[实际验收](../../../artifacts/hermes-linux/2026-10-27/live-wsl-alpha67/report.json)、[当次原Bridge状态只读核对](../../../artifacts/hermes-linux/2026-10-27/alpha67-original-state-verified.json)。未复制Windows凭据，未覆盖模型；成功原生模型轮次共2，不将组件模型0计入真实轮次。
- 实际模型验收使用已冻结完整Linux资源，manifest与最终独立全依赖构建字节相同：[包绑定](../../../artifacts/hermes-linux/2026-10-27/alpha67-live-bundle-match.json)。该绑定和最终EXE载荷核对共同证明实际测试的后台进入发布物；不是用纯模拟替代真实执行。
- [首轮CI](https://github.com/wsjq5477/MA-Relay/actions/runs/40491390054)适配109/109、原生MCP通过，但Core70/71，controller.test控制器启动超时，原日志保留。相同源码aef5abd的[独立复跑](https://github.com/wsjq5477/MA-Relay/actions/runs/40492533908)Core71/71，未修改Core或该测试；最终3d6d220[CI](https://github.com/wsjq5477/MA-Relay/actions/runs/40493412034)再次Core71/71、适配109/109和正式Hermes原生MCP五组通过。不能把复跑通过解释为已修复原控制器波动：[最终Core](../../../artifacts/hermes-linux/2026-10-27/alpha67/ci-final/core.tap)、[最终适配](../../../artifacts/hermes-linux/2026-10-27/alpha67/ci-final/targeted.tap)、[最终原生安装](../../../artifacts/hermes-linux/2026-10-27/alpha67/ci-final/installed.json)。
- 临时网络通道已停止，事后原生网关进程核对为0；WSL直连TLS问题仍独立存在：[通道收尾](../../../artifacts/hermes-linux/2026-10-27/alpha67-network-cleanup.json)、[原生网关](../../../artifacts/hermes-linux/2026-10-27/alpha67-native-gateway-final.json)。
- 构建在C盘隔离工作树进行。Node24.12在该目录的cpSync报EIO/Access denied，已有Node24.21（Electron run-as-node）执行相同stage脚本成功；直接用该模式跑builder CLI又因argv识别失败，故采用Node24.21暂存、普通Node24.12 builder/核验。依赖链接构建曾出现定位警告，最终发行只使用另一个真实npm ci依赖目录；旧候选即使后续完成也不公开。依赖锁与产品源码不因环境处理改写。清理旧构建进程/链接的操作被自动审批以blocked by policy拦截，未执行；旧构建后来正常结束，链接目录保留。
- 普通EXE、实际EXE载荷、源码冻结、附件及匿名完整下载待本轮收尾后登记。

涉及M02/M05/M06/M07/M10/M11，整体设计、接入矩阵、协议和模块文档同步。检查data-model无持久字段/版本或身份变化，SSH协议、原Node/Task/Session/unknown及Hermes取消false保持；没有切换日常Bridge后台或部署SSH。

## 原始资料的后续可用性

当次原Bridge状态只读核对完成后，后续复查发现Linux临时验收目录已不存在；没有重建目录/原任务或重发模型请求。当次成功报告、两条原传输退出和状态只读核对报告保留。随后仅查询Hermes原生持久SQLite：同一个原会话恰有两条用户消息、两条助手消息，上一轮记忆正确，原生API计数2、工具调用0；未导出原生身份、未新增模型调用：[原生会话只读补证](../../../artifacts/hermes-linux/2026-10-27/alpha67-native-history-verified.json)。这一限制不被写成原业务unknown已解除。
