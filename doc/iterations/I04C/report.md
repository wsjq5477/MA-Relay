# I04C 便携运行修复记录

日期：2026-10-09。当前交付：0.4.3。0.4.2 修复 Windows Claude 验证任务停在“结果待核对”的运行原因；0.4.3 补全旧失败记录的恢复交互，保留原任务及机器归属。

## 原因与修复

0.4.1 的便携启动器使用每次构建固定的解包目录。再次打开同一 exe 后，第二个启动器退出并清理共享目录，导致第一窗口仍在运行但 ICU 等资源已消失。Claude worker 复用该临时 Electron.exe，在进入 Node 脚本前报出 `Invalid file descriptor to ICU data received`。原实现忽略 worker 标准错误，未收到任何心跳或原生 Session，只能保守显示 unknown。

现在每次便携启动使用独立解包目录。配置 `portable.unpackDirName: true` 按本仓库 electron-builder 26.15.3 的实际 NsisTarget.js 分支省略 UNPACK_DIR_NAME，使用每次启动独立的 PLUGINSDIR；该版本的类型文档描述与代码分支不一致，因此以最终 Windows 重复启动验证为准。

ClaudeHost 在任务登记前准备持久 Electron Node 运行资源，原窗口关闭和解包目录清理不影响 worker。复制所有顶层运行文件与许可证，缓存位于 windows/runtime，约 320MB；不依赖额外安装 Node。缺少 ICU/V8 资源时拒绝新任务，明确提示重新打开新版程序。

worker 记录标准错误与退出；原生 CLI 启动前必须持久记录 native-starting.json。只有确定 worker 在此记录之前退出，才报告“启动失败、任务未执行”；已进入原生执行且缺少终态时继续保留 unknown，不重投任务。

## 用户原任务恢复

对 `claude-task-redacted-id` 单独核验：任务登记于 01:54:49.306 UTC，启动目录日志对应 09:54:49.354 的 ICU 初始化错误；worker 无执行事件/心跳，无原生会话文件，进程已退出。已保留诊断证据，登记启动失败事件，原任务仍在历史中；没有重放该验证 Prompt，也没有修改实例模型或全局配置。[诊断记录](../../../artifacts/I04C-user-bootstrap-diagnosis.json)。其他未知执行没有自动释放。

## 验收

| 检查 | 结果与范围 |
| --- | --- |
| 桌面回归 | 37/37：原机器路由与控制合约、持久运行资源、worker 启动退出及日志 |
| 构建 | 根 TypeScript、桌面 TypeScript/Vite、Windows portable 均通过 |
| 真实 Electron 原生执行 | 正常 Electron 主进程加载最终 ASAR 内的 ClaudeHost，真实随机标记验证，观察进程关闭并清理原 ICU/V8 资源后仍完成；原生退出与历史恢复均通过，共 5 项 |
| 最终 exe 重复打开 | 同一隔离配置正常打开两次，第二次退出后第一窗口的 ICU/ASAR 保留，第一窗口继续产生页面快照，共 3 项 |
| 校验和 | 仓库与 Windows 本地副本一致：5dacb670d8a12a41676770571abc742591a8b375fcf9110847aa999d418bf712 |

[真实运行报告](../../../artifacts/I04C-packaged-runtime-real.json)、[便携重复启动报告](../../../artifacts/I04C-portable-repeat.json)。未启用 CDP 或远程调试。Computer Use 初始化因当前 WSL cwd 映射错误失败，因此没有声称完成图形界面点击任务验收；原生执行验证使用打包代码及正常 Electron 主进程，窗口验证使用真实 portable 程序的运行诊断。

真实模型验证仅在隔离实例使用 `DeepSeek-V4.1-Flash`。用户默认 GLM-5.1 的权限问题仍需在项目实例“模型设置”选择可用模型，安装/运行资源修复不代表供应商默认模型有权限。

## 使用

关闭旧窗口，打开 [AgentBridge-0.4.3-Windows-x64.exe](../../../desktop/release/AgentBridge-0.4.3-Windows-x64.exe)。既有机器、实例、任务和历史保留；已确认未启动的旧验证显示失败，可再次验证。第一次 Claude 执行会准备独立运行资源。

## 0.4.3 旧记录恢复交互

用户在 0.4.2 中看到原验证的错误历史，但界面仍展示“发送继续当前会话”。这条记录未创建原生 Session，因此续问必然被后端 CONVERSATION_UNBOUND 拒绝。升级不应清除历史，界面必须明确区分历史错误与新的执行。

Claude 宿主在快照、会话列表与会话详情中提供 canContinue、continuationReason 和 kind；不公开私有原生 Session 字段，也不改变旧 ID。界面将自动验证显示为“连接验证”，说明未创建原生会话时的恢复方式，不再提供不可用的续问输入框。

“重新验证连接”沿用同机器/实例，生成新请求及随机标记；“新建会话”预选原项目实例，提交后直接进入新会话，不静默迁移旧上下文。普通启动失败同样需要新建会话。有原生绑定的正常会话继续支持续问；unknown 保留占用，不能借恢复入口重投。原失败任务、内容和诊断保留，用户全局与实例模型没有自动改动。

后端桌面回归 37/37 通过，新增断言覆盖无 Session 的快照/列表/详情、拒绝无效续问且未执行 Prompt、新建独立会话、保留旧记录和有 Session 的续问。最终桌面类型/Vite 构建通过。

[前端恢复验收](../../../artifacts/I04C-conversation-recovery-ui.json) 为独立 Edge Mock，无真实后台或认证，共 8 项检查通过：人类可读验证、零自动重投、同源新会话、正常续问、新请求验证、普通失败、unknown 保护、原始历史保留。[用户原记录只读核验](../../../artifacts/I04C-original-conversation.json) 确认原任务 failed、kind=verification、canContinue=false；没有调用模型或修改配置。本次只修改会话元数据和界面，0.4.2 的真实运行与重复启动证据沿用，不声称重新验证模型执行。
