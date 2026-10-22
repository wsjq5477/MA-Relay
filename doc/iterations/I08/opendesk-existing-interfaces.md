# OpenDesk：仅在Bridge侧适配已有接口

2026-10-21。用户明确不修改OpenDesk，继续开发现有接口接入。关联AB-F02/F07/F08/F10/F11/F13，M01/M03/M05/M06-F05/M07/M08/M10/M11。公开基线仍alpha.36，不推送、发布或部署用户远端。

## 需求与纠正

上一轮alpha.41新增原生控制接口的方案已撤回，它的测试/原生tgz不能证明现装OpenDesk可接入。该轮记录保留于[历史专项](opendesk-integration.md)。本轮不新增原生代码、不构建OpenDesk仓库，仅精确撤回上一轮误加的原生接口，不安装其定制CLI，不替换用户桌面程序。仅在AgentBridge适配原有HTTP和设备网关，并保留独立MCP配置管理。

核对原生仓库原有HEAD而非上一轮新增代码：CLI原有serve支持opencode HTTP和ACP两种模式；HTTP会话创建、消息同步提交、消息读取、abort均存在。Desktop原有chat.send/history/abort绑定connId与sessionKey，原生idempotencyKey只关联runId，没有可靠去重。已有网关identity.get可核对本用户身份。所有去重、派发围栏与原请求记录改由Bridge保存。

## 实现

CLI启动现有`serve --mode opencode --hostname 127.0.0.1 --port 0`，用环境变量传递随机Basic密码；沿用原安装、原账号、模型、工具与Skills，不覆盖模型。桌面只读原生setting与网关身份，连接已运行设备网关；不提供新原生协议。静态入口ID保持opendesk/opendesk-desktop，执行profile更新为opendesk-http-v2/opendesk-gateway-v2，旧记录不解释为新执行。

Bridge独立连接持有进程复用原CLI服务/桌面连接，私有锁、心跳与领取围栏防止重复派发。Desktop原生接口不接受单次目录，默认沿用原生目录，其他目录发送前拒绝；变更原生目录须重启网关。只接收当前Session/runId回应，普通分片final不算完整处理器响应。窗口/Host重开可复用仍活着的后台连接，空闲30分钟退出；原连接丢失后关闭旧会话续聊，不自动重连或重发。

原API读历史可能生成completed时间，不能恢复当前轮终态。CLI只在原同步请求返回且新用户/父子消息绑定匹配时确认成功；丢回应或文本错误语义含糊时unknown。Desktop显式完整final才可结束，错误帧/取消后无法确认结果保持unknown。cancel只调用一次，ACK不改变任务终态。只读reconcile仅使用已保存且严格匹配的原回应，无充分证明就保留占用。

## 实测与证据

证据目录`artifacts/opendesk-existing/2026-10-21/`。首次10项定向中9通过，发现CLI controller心跳首次缺connected字段，使已完成会话短暂不可续聊；在发消息前保存已连接状态后10/10通过。后续新增断线与父子消息证据测试、全套、UI和最终包结果在实际完成后登记。

2026-10-21：已安装、未修改的`@bitclub.ai/opendesk-cli@0.3.8`由生产worker启动，在独立空配置完成5组：认证健康、无凭据401、空会话列表不创建任务、缺失原会话查询保持只读、创建/读取空会话。Prompt/模型0。安装入口SHA-256 `289ac0fc965288068c8a92f10d5fee36a4585201a6aff238d36d0380ea8bf75c`。未更改全局CLI或用户配置；新适配不依赖OpenDesk源码改动。

## 边界与使用

当前Windows默认OpenDesk原生配置目录存在但为空，没有可核对的setting与网关身份，因此本轮不能声称用户原桌面网关/模型实测通过。桌面发送/续聊/断线由真实WebSocket加受控原生夹具验证；CLI真启动与会话检查不等于真实模型回复。独立SSH未测，旧后台须另行升级。独立MCP支持普通委派，托管scope、小队、Bridge权限/表单/验证未开放。

使用时先在旧Bridge“设置 → 后台运行 → 停止后台并退出”，再运行最终候选EXE。WSL无需安装上一轮tgz；使用正常安装的OpenDesk CLI并重新扫描。Windows先打开OpenDesk并启用设备网关，再扫描Windows机器。原生网关或CLI安装缺少对应现有接口时展示实际失败，不自动改源码或安装定制包。原unknown与历史继续保留，不以更换目录、ID或新连接绕过。

## 工程收尾记录

核心57/57、第一轮桌面720/720、类型检查与lint通过。生产界面9组通过，新增原生目录与断线提示，pageErrors0、模型0。文档生成首轮因接入矩阵状态文字未使用生成器约定的“已接入”而拒绝；改为“已接入（源码）”后文档工具6/6、用户站18页/19HTML/158资源审计通过，无内部页面或证据导出。

Windows打包Node运行时的第一轮协议测试12/12通过。后续补充原生取消后可能返回无message的完整final场景：明确转为unknown，避免持续显示运行；连接持有进程的空闲计时从当前任务结束后开始。首个alpha.42打包与该修正并行，包校验正确拒绝opendesk-worker源码不匹配，未作为交付；冻结后重新全量验证和打包，最终数据另见下文。

## 原生仓库撤回

使用上一轮保存的`opendesk-native.patch`先执行反向应用检查，通过后仅精确撤回其中的专用控制层、任务补丁、CLI开关、测试和文档。撤回后OpenDesk仓库`git status --porcelain`为空、`git diff --check`通过；没有reset整个目录，没有重新构建、替换全局CLI或操作原生安装。撤回前diff摘要、补丁摘要及撤回后状态保存在`source-manifest.json`。旧定制tgz仍作为历史证据保留，不作为当前安装步骤。

最终冻结回归：核心57/57、桌面721/721、Windows Electron打包Node运行时协议13/13、生产界面9组，均失败/跳过0、模型0。Windows协议用例使用本机HTTP/WebSocket受控执行夹具和真实独立worker，不能冒充OpenDesk用户原实例。原生CLI 0.3.8探测5组通过。

## 最终本地候选

`0.6.0-alpha.42` Windows x64便携EXE，130084772字节、SHA-256 `9b822ee11848201dda14e67e8ffc92aff32ca9f3d96c1ecb016c7c01a37fd39a`。最终包核验通过：50 CJS、81 Core、1462 Linux，前端/ASAR/Core/Linux源码一致；原始`package.json`、`package-build.log`、`SHA256SUMS.txt`与`source-manifest.json`。只交付Bridge，无新的OpenDesk tgz或原生桌面构建。未签名、未公开GitHub、未升级远端；公开基线仍alpha.36。

最终同hash的Windows普通EXE在独立profile通过5组：无调试参数正常开窗与生产Coordinator能力；SQLite文档精确修订、独立MCP导出及原历史/unknown保留；窗口重开复用原后台；完整后台重启读取同一资料与MCP连接；冻结包依赖及集成模块与源码字节一致。Prompt/模型0，不写用户原生配置、不停止日常Bridge，证据`windows-portable.json`。这不替代OpenDesk原生桌面现场和真实模型验证。

最终文档检查225份Markdown、15组模块设计/报告、4719本地链接、94 Mermaid、446测试用例，errors0；文档工具6/6，用户站18页/19HTML/158资源审计通过，内部材料与证据导出0。OpenDesk源码仓库撤回后仍干净，Bridge冻结源码清单复核一致。
