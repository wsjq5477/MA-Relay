# AgentBridge Windows

当前本地候选alpha.63新增原选材包持久传递、目标接入收据和桌面只读审计，继承alpha.62配置控制台与alpha.61恢复出口；公开仍alpha.60。原生Pi→固定源码Hermes组件7组通过，模型0；[当前交付与完整边界](../doc/iterations/I07/context-delivery.md)。

公开alpha.60实现按身份多主连接、用户预授权/明确确认和策略审计/原意图恢复页面，旧图仍selected。源码900/900、包内Windows37/37与实际中央管道/重启、兼容26/26、生产页面4组、普通EXE4组及Downloads SHA通过，模型0；未切换日常后台，真实原生多主未验。[完整交付与边界](../doc/iterations/I07/connection-policy.md)、[发布核验](../doc/iterations/I08/alpha60-release.md)。

## 当前状态

当前公开预发布为 **0.6.0-alpha.60**，标签冻结 `a0f313c`：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.60/AgentBridge-0.6.0-alpha.60-Windows-x64.exe) · [SHA-256](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.60/SHA256SUMS.txt) · [发布记录](../doc/iterations/I08/alpha60-release.md)。全部130212267字节匿名下载核验通过；未签名，未部署SSH，完整验收边界保留。

升级：先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；SSH 远端需在原机器空闲时确认升级，不自动重发原维护。

未准出范围：完整 I06C/I07C 与正式 0.6.0 未准出；用户 profile、独立生产 SSH、真实模型、Windows 原生 OpenCode 1.x 推理均未声明验收。未发布的本地整合源码/候选不等于公开发布版本，不能把本地候选叫作已发布版本；来源、验证与未测边界见[整合交付](../doc/iterations/I07/integrated-source.md)。

## 运行与使用

1. 关闭旧版窗口，双击下载的 EXE（稳定历史版产物为 `desktop/release/AgentBridge-0.5.0-Windows-x64.exe`；当前预发布见上方下载入口）。便携版也已复制到本次 Windows 产物目录。第一次打开需要解包；无需开两个终端。
2. “接入配置”自动显示本机和各 WSL 环境及工具。WSL 标明物理宿主；空机器也显示。
3. 按空格勾选发现的工具，点击“接入所选 Agent”。不要求项目、模型、供应商，不在扫描时调用模型。
4. “协作关系”选择主 Agent 与允许连接的子 Agent，保存。
5. 在“接入配置”生成或安装原生Agent的Bridge MCP；从原生Agent会话输入需求，在授权范围内发现目标、委派和查询。目录由原生会话或本次委派指定。
6. 在“执行审计”“会话审计”和“最近委派”查看原父子任务。日常交互回原生Agent处理；需恢复已有执行时，打开原任务并显式选择“处理这条原执行”，沿原请求回复/取消并核对。

可用示例：将 Windows Claude Code 设为主节点、WSL OpenCode 设为子节点，发送“请发现子 Agent，委派给 OpenCode 只读分析目标目录，再读取实际结果并总结”。给子节点明确目标目录；它不会自动操作主节点的文件系统。

工具登录和配置由原生 CLI 管理。OpenCode 继承原生配置及 CLI 记住的最近模型，已实际验证本机 DeepSeek-V4.1-Flash。新会话重新读取偏好，续聊保持原 Session。界面没有模型或供应商设置。

Windows 目录使用原生 C:\、D:\ 路径；WSL 使用 Linux 路径或转换后的 /mnt/<盘符>。跨发行版目录拒绝。共享目录的运行、等待和未知任务继续互斥，来源离线保留占位。其他机器的已确认可用节点不因单个来源未确认而全部阻塞。

关闭窗口不取消原生任务，重开读取原任务与收据，不自动重发 Prompt。普通会话默认隐藏连接验证，勾选“显示连接验证记录”可查看旧记录。旧模型覆盖会话保留原绑定，不能在新节点规则下静默换配置续聊。

## 构建与测试

从仓库根目录运行：

```bash
npm ci
npm ci --prefix desktop
npm run desktop:build
npm run desktop:pack
npm run desktop:dist
npm test
npm test --prefix desktop
npm run lint
npm run typecheck
```

可执行文件在 `desktop/release`。窗口代码在 `desktop/src`；机器、节点、MCP 与原生后台在 `desktop/electron`；OpenCode 宿主、控制器和 Driver 在根 `src`。

偏好、机器目录、节点关系和未确认操作保存在 Electron userData；Windows 原生任务在其中 `windows` 目录。WSL 数据默认位于 `~/.local/state/agentbridge`；每个新会话上下文单独保留原生任务和引用。迁移前备份机器目录，保留原实例与任务 ID。`AGENTBRIDGE_DESKTOP_PROFILE` 用于隔离自动测试，`runtime.json` 用于普通启动诊断。

便携后台保存持久 Electron/Node 运行资源，避免窗口临时解包目录清理使原任务失效。原请求不明时自动只读核对，有证据才解除保护；真实未知执行继续占用来源节点。

## 实际边界

- 已真实验证 Windows Claude ↔ WSL OpenCode、Windows Claude ↔ WSL Codex，两个方向均有子原生回复与父结果证据。
- Windows Codex 0.145.0 的原生配置模型被账号拒绝，不能声明真实回复可用；WSL Codex 0.161.0 回复和主从协作通过，原生续聊接口仍返回 `list_turns is not supported yet`。不自动切换模型或另建会话冒充续聊。
- Windows 和 WSL 是同一物理宿主的执行环境；远程物理电脑接入属于 I06。
- 保留原生权限控制；Codex 执行接口尚不支持桌面代答原生表单。Claude 原生问题表单仍有既有适配边界。
- 程序未商业签名；自动升级、托盘、成本统计、全量历史分页未纳入本次。

[I05 节点模块](../doc/iterations/I05/node-design.md)、[协作模块](../doc/iterations/I05/collaboration-design.md)、[验收报告](../doc/iterations/I05/acceptance.md)。I04B–I04G 的旧交付与修复记录保留在对应迭代目录。
