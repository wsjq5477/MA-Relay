# OpenDesk 双入口原生接入（已撤回方案）

本轮修改OpenDesk原生程序的方案已由用户撤回；alpha.41和定制CLI tgz不用于接入现装OpenDesk。当前实现见[仅适配已有接口](opendesk-existing-interfaces.md)。以下保留当时的开发与验证历史，不能作为当前接入验收。

日期：2026-10-21。用户批准按源码分析方案开发。公开基线仍alpha.36；本轮不推送源码、标签或发布，不部署用户远端，不重放任何既有任务。

## 需求与实现

关联AB-F02/F07/F08/F10/F11/F13，M01/M03/M05/M06-F05/M07/M08/M10/M11。OpenDesk CLI与Windows Desktop在原环境分别接入，继承原模型、账号、Skills与业务工具。CLI走原生HTTP，Desktop走原实例WebSocket；源码静态注册两个入口，使用共同持久Host/独立worker。原生源码在相邻OpenDesk仓库，新增版本化控制服务和任务循环真实终态观察，两个传输共用一份实现。

新增控制方法hello/submit/request/cancel/operation。持久requestId+输入摘要、原生Session/消息身份与派发围栏；同ID同输入查询旧记录，改输入冲突；重启未知保留unknown。取消收据与原轮次终态独立。loopback私有描述符/令牌校验；实例变化拒绝改绑。恢复不启动替代服务、不重新提交Prompt。旧CLI通过只读serve帮助探测拒绝，不能启动不支持协议的后台。

独立MCP配置适配原生servers数组，保留其他配置、拒绝身份/结构/并发冲突，移除先撤权。原生自主MCP调用与托管scope分开；后者及小队未开放。Bridge权限、表单和验证false，不自动批准原生权限。

## 验证记录

原始输出归档到`artifacts/opendesk/2026-10-21/`。普通沙箱禁止loopback监听（EPERM），首轮受限进程测试缺少子用例输出，未算有效通过；在获准的本地执行环境重跑实际断言。

- 首批Bridge定向：34/34，通过，隔离HTTP/WebSocket真连接、独立worker、丢ACK只读恢复、原Session续聊、重复ID/冲突、取消自然成功竞态和配置保留；模型0。
- OpenDesk原任务/原HTTP回归：3套、63/63通过；新控制层持久收据测试2/2通过。均为受控依赖，模型0。
- 后续工程检查、原生构建、候选包与现场范围在完成后补入，不以计划计通过。

## 部署边界

必须同时使用支持控制协议的OpenDesk原生版本与本轮Bridge。Windows EXE不自动替换原生Desktop、WSL CLI或远端daemon。原生模型真实执行、用户Windows桌面实例和独立SSH尚未验证。无签名、无公开GitHub发布。

## 收尾发现

完整桌面首轮712项中711通过，生产daemon安装扫描超过旧3秒测试预算；生产探测专用调用预算按已有单工具5秒探测上限调整为15秒，定向重跑38/38通过。后续交错源码的全套出现旧夹具与新worker不一致，未计最终通过。冻结后714项中713通过，发现既有维护锁在EEXIST与owner读取之间已释放导致ENOENT；修正为重新竞争，新增确定性回归并与原维护/接入检查35/35通过。该修正不改变维护身份、收据、任务或切换行为，最终全套与最终包另行记录。

OpenDesk完整桌面构建：标准构建与限制堆内存重试均在renderer被系统终止；使用本地构建API关闭压缩后仍触发V8内存上限。main/preload编译已完成，但不能据此声称完整桌面原生产物或Windows安装器通过；没有修改系统Swap。最终再将renderer放在独立新进程、使用原生产配置和3GiB堆单独构建，仍触发V8 OOM（`native-desktop-renderer-only.log`），未计通过。普通CLI源码构建与本地tgz隔离安装各自完成真实认证、令牌拒绝、原请求只读零任务和重启身份四组检查，模型0。

前端生产构建9组通过，涵盖新增OpenDesk两个原机器的MCP添加/移除、目标切换、对话框关闭和图标。首轮浏览器缺libnspr4，使用仓库已缓存库重跑；新增用例等待写入结束、关闭按钮恢复后再切换目标，最终页面错误0、模型0。这是生产前端加受控IPC，不是Windows EXE或OpenDesk原生GUI。

文档发布构建发现Vite生成的文件hash偶然含I31F被当成迭代编号；仅规范化真实生成资源的hash后审计正文，资源正文继续完整扫描。回归同时证明hash可通过而正文M06-F01仍拒绝；18用户页、19HTML、搜索/页面158份检查通过，内部页与证据导出0。

## 最终候选与工程检查

本地候选`0.6.0-alpha.41`：Windows x64便携EXE 130075553字节，SHA-256 `f25dd8c0b2ff0faa372e716476c39bf481d2957dde31dced119459f29f847ac1`。包验证50 CJS/81 Core/1462 Linux，ASAR、前端与Linux源码匹配；最终冻结后的核心57/57、桌面715/715，失败/跳过0；类型检查、lint和生产构建通过。最终输出为`desktop-final.tap`、`package-build.log`、`package.json`及`source-manifest.json`，不沿用中间候选hash。

OpenDesk原生CLI候选`@bitclub.ai/opendesk-cli@0.3.9-agentbridge.1`，本地tgz 5185216字节、SHA-256 `7e57fddf249076d6cc7861cdcfe4deedc3a84fc7d84aa47f1d7290a1844ae822`。在独立prefix安装后，真实本地HTTP认证/错误令牌拒绝/缺失原请求零任务/服务重启身份四组通过；模型0、未改用户全局CLI或原配置。源码变更快照为`opendesk-native.patch`，基于原生仓库`228fabe`。完整原生桌面renderer构建未通过，不能将CLI产物作为Windows原生桌面安装器。

## 本地切换

先在旧Bridge“设置 → 后台运行 → 停止后台并退出”，再打开alpha.41 EXE。WSL在目标发行版执行`npm install -g /home/jiqi/LLM/AgentBridge/desktop/release/bitclub.ai-opendesk-cli-0.3.9-agentbridge.1.tgz`，用`command -v opendesk`核对当前PATH，再在Bridge对应WSL机器重新扫描并接入OpenDesk CLI。模型与账号沿用原配置。旧CLI不支持控制协议时会明确拒绝；新的任务可启动新原生控制服务，原请求核对不启动替代实例。

Windows OpenDesk Desktop需要包含本轮原生控制服务的原生桌面构建后再接入；现有旧版不会被EXE自动替换。独立MCP通过节点配置“添加到原生Agent”写入对应原生配置，按提示重启原生程序；移除先撤权。独立MCP可用于普通委派，托管协作scope/小队仍不可选。SSH后台需单独升级，本轮未操作。

## Windows普通EXE隔离验证

2026-10-21，Windows 10.0.22000.2538，最终同hash的alpha.41普通EXE通过5组：无调试参数正常开窗及生产Coordinator能力；SQLite材料精确修订、独立MCP导出和孤立原生历史；窗口关闭重开复用原后台；完整后台重启重载相同资料与MCP连接；冻结包依赖与六个集成模块源码字节一致。保留原unknown和原生请求记录，Prompt/模型0，原生配置仅导出未安装。独立临时profile，测试退出时关闭自己的窗口与后台，用户日常alpha.37实例保持运行。原始证据`windows-portable.json`；这不代表OpenDesk原生Windows桌面或真实模型验收。

最终文档检查：224份Markdown、15组模块设计/测试报告、4723本地链接、94 Mermaid、446测试用例，errors0；文档工具6/6，用户站18页/19HTML/158资源审计通过，内部页与证据导出0。
