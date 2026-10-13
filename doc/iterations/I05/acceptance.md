# I05 / Windows 0.5.0 验收报告

日期：2026-10-10。用户已批准 I05A、I05B 开发。机器节点和主从协作的核心交付通过，两个 Codex 原生限制单列，未声明全部工具功能通过。

## 交付物

- 程序：`desktop/release/AgentBridge-0.5.0-Windows-x64.exe`。
- Windows 本次产物目录也有同名 EXE：`C:\Users\jiqi\.codex\visualizations\2026\10\08\redacted-id`。
- 大小：101464168 bytes。SHA-256：`fd11bbaaa3d5d4fb5c52171ff8c4900a79e7235a374578b494e438725b13dc7a`。
- [节点模块需求、设计、开发与测试](node-design.md)；[协作模块需求、设计、开发与测试](collaboration-design.md)。

## 功能与指标

| 验收项 | 结果与证据 |
| --- | --- |
| 无项目也显示机器和节点 | 2 个执行环境、4 个实际安装节点；Windows / WSL 分开，WSL 标记同一宿主。 |
| 同机多工具自动发现 | Windows Claude 2.1.296、Codex 0.145.0；WSL OpenCode 2.0.24、Codex 0.161.0。重复扫描无重复节点。 |
| 简化接入 | 空格多选、一次接入；项目、模型、供应商必填数量 = 0；元数据扫描无推理调用。 |
| 节点身份独立 | 原生启动脚本解析不产生第二节点；目录在任务阶段指定；续聊保持原生 Session，Claude / OpenCode 已真实验证。 |
| 原生 OpenCode 默认设置 | 修复 CLI 最近模型与后台默认模型不一致；真实任务绑定 csi-provider/DeepSeek-V4.1-Flash#medium，回复与续聊通过。没有修改原生配置或偏好文件。 |
| 用户指定关系 | 一个默认组的主节点、多选子节点、修订号保护、刷新和重开保留关系。 |
| 真实主从闭环 | Claude → OpenCode、OpenCode → Claude、Claude → WSL Codex、WSL Codex → Claude 四条均通过；实际 MCP 调用、子原生回复、父结果均有记录，人工转述 = 0。 |
| 后台关系约束 | 未授权目标、自我委派、伪造来源、跨父任务控制均拒绝；撤销后阻止新委派，既有任务可查询/取消。 |
| 十次重试去重 | 普通请求和子委派各重复 10 次，原生创建次数分别 = 1。 |
| 未确认执行 | 原 ID 查询，不补发 Prompt；缺少收据仍占用节点；界面只阻止来源机器，其他机器可工作。 |
| 原生控制 | 已有权限、表单、取消和收据流程复用；Codex 取消确认必须观察到原进程结束。受控测试通过；本轮真实协作样本只要求文本回复。 |
| 普通 EXE 启动、重开 | 两次启动收到 2 环境 / 4 节点、15 条原任务；节点 ID、关系、历史数量不变，无新增 Prompt，无调试接口。 |
| 包内源码 | 主进程、节点、MachineHost、Codex、MCP 与 TS 后台资源完整；与最终源代码一致，CLI 默认继承修复包含在 EXE 内。 |

## 自动检查

- 根项目：43 / 43 通过。
- 桌面后台：62 / 62 通过。
- lint、根 typecheck、桌面 TypeScript / Vite 构建通过。
- 隔离浏览器界面：6 项交互检查通过；未确认操作自动核对：6 项检查通过。
- Windows 便携版：普通启动、资源完整、重开保留历史、无 Prompt 重放、无调试接口均通过。

这些数字区分受控测试、浏览器 Mock、真实工具和真实 EXE；不把 Mock 的子回复当作真实协作。

## 未通过与边界

| 环境 / 功能 | 实际结果 | 交付判断 |
| --- | --- | --- |
| Windows Codex 0.145.0 原生回复 | 原配置的 gpt-6.1-sol 被 ChatGPT 账号拒绝；保留原始失败。 | 安装发现和执行接口适配存在，不能宣称这台环境的真实回复已验证可用；不替换模型或登录方式。 |
| WSL Codex 0.161.0 原生续聊 | `thread/resume failed: list_turns is not supported yet (code -32601)`。 | 新会话回复及作为主/子协作通过；续聊未通过。不新开会话冒充恢复，不改用户原生状态数据库。 |
| 远程物理机器 | 本次只验证同一宿主的 Windows 与 WSL。 | I06 独立开发和验收。 |
| 原生表单 / 权限 | Codex 代答表单未适配，Claude 表单仍有既有边界。 | 保留真实状态与错误，不声明所有工具的全部交互均通过。 |

`I05-real.json` 总状态保留 partial：它包含上述失败与被原生 Windows Codex 配置阻塞的两条链；四条核心协作链均明确记录为 passed。安装探测 healthy / connected 与真实推理成功是不同证据。

## 原始证据与复现

- `artifacts/I05-real.json`：真实节点、机器、直接回复、续聊、4 条成功链及 2 条原生配置阻塞链；OpenCode 原生模型绑定证据。
- `artifacts/I05-codex-main.json`：修复 MCP 注解与审批适配后的真实 Codex 主任务。
- `artifacts/I05-ui.json`、`I05-machines-ui.png`、`I05-relations-ui.png`：隔离界面交互与截图。
- `artifacts/I04G-journal-ui.json`：最终界面的原请求自动核对回归。
- `artifacts/I05-portable.json`：普通启动与重开观察。
- `artifacts/I05-package-contents.json`、`artifacts/I05-build.json`：最终包与汇总。

运行：关闭旧版窗口 → 双击 0.5.0 EXE → 机器页接入节点 → 协作关系选主/子 → 会话页发送需求。需要文件工作时提供目标机器上的目录；不需要操作已有文件时可留空。

真实脚本位于 `desktop/tests/windows-i05-*.cjs`，通过 Windows Node 执行并使用隔离目录；真实回复与委派会发生模型调用。自动测试与隔离 UI 测试不需要模型请求。旧 CLI 项目执行入口继续兼容，本次机器关系入口在 Windows 客户端。
