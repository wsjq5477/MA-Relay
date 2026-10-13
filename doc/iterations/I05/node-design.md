# I05A：机器与 Agent 节点设计、开发与测试

需求基线：用户已批准 I05 提案。Windows 客户端版本 0.5.0。

## 需求与验收

1. 首屏显示机器，未配置项目也显示 Windows 和各 WSL 环境；WSL 标明宿主机器。
2. 每台机器扫描实际安装的 Claude Code、OpenCode、Codex。空格多选后一次接入，不询问项目、模型或供应商。
3. AgentNode 的身份只属于机器与工具入口。启动多个会话、切换任务目录不创建新节点。
4. 执行目录属于会话；留空创建独立目录。已有目录在目标机器上校验。
5. 保留历史任务、原生会话 ID、原请求收据和未知执行占位；旧模型绑定的会话不静默改变配置。

指标：同机多工具丢失数、重复扫描新增节点数、原会话 ID 错配数均为 0；节点接入必填项目/模型/供应商数量为 0；重复请求 10 次原生任务创建次数为 1。

## 对象与实现

| 模块 | 实现与责任 |
| --- | --- |
| `tool-discovery.cjs` | 各机器本地探测三类工具，仅执行 `--version`。解析 Windows npm 脚本到真实入口；支持 `v2.0.24`，坏安装不遮挡后续可用安装。 |
| `MachineHost` | 聚合原有后台与私有会话上下文。`node-contexts.json` 保留上下文到节点的权威映射。 |
| `AgentNetwork` | 继承现有机器路由，保存 `agent-network.json`；节点与任务目录分离。 |
| `MachineRouter` | 保留来源机器路由、共享目录占用和旧任务映射，导入时保留后台提供的 nodeId。 |
| OpenCode / Claude / Codex 后台 | 创建或续接本工具的原生会话。工具登录、供应商和配置由原生工具管理。 |
| `NetworkApp` | 机器与节点、协作关系、任务看板、会话和设置；复用原任务详情中的权限处理和收据核对。 |

默认目录为机器数据目录下 `sessions/<nodeId>`，不是节点配置。一个节点可拥有多个隐藏执行上下文；同目录的未结束任务仍互斥。上下文按节点、真实目录和是否启用协作区分，原生 Session 只在原上下文续接。

### 原生配置继承

Claude 和 Codex 不注入模型/供应商参数，也不覆盖全局配置。

OpenCode CLI 的“最近模型”与 v2 后台 `/api/model/default` 是不同来源。本机 CLI 的 `model.json` 记住 DeepSeek，后台默认却返回已停用的 exo-free。新节点上下文启用只读的 CLI 偏好继承：原生配置中的显式模型优先，其次 CLI 最近使用的可用模型，最后原生服务默认值；变体也读取原生状态。适配器向新会话传递解析出的原生选择，并在原生引用中保存实际绑定。Bridge 不提供独立模型设置，不写原生配置或偏好文件，不自行替换失败模型。新会话重新读取偏好；续聊保持原 Session 绑定。原生优先顺序参考 [OpenCode 模型加载规则](https://opencode.ai/docs/models/#loading-models)。

旧实例不自动启用该规则，旧指纹和显式模型绑定保留。新 OpenCode 上下文采用独立版本标记，避免改写已经创建的历史上下文。

## 迁移与恢复

首次迁移备份 `machines.json.before-nodes.json`，原子保存新网络文件。旧 instanceId、backendId、targetAgent、任务与会话 ID 保留。原生入口解析造成的路径差异不能覆盖已有上下文的 nodeId。

提交前保存请求意图；传输不明仅查询原请求，禁止自动补发 Prompt。缺少原收据的已分派请求继续占用该节点；其他来源机器仍可工作。界面自动核对原收据，缺少证据继续显示未确认；明确的接入/目录/授权拒绝不记为已执行。验证记录默认收起，真实需求会话是主要入口。

## 测试入口

- `desktop/tests/agent-network.test.cjs`：节点身份、路径解析后的归属、旧模型保护、原请求去重、未知请求。
- `desktop/tests/tool-discovery.test.cjs`：前缀版本、多个安装路径的失败恢复。
- `tests/native-cli-default.test.ts`：原生配置与 CLI 偏好优先级、更新、只读、不发明模型。
- `desktop/tests/windows-i05-ui.cjs`：隔离浏览器中验收空格多选、关系、无配置提交、结果和看板；无真实 Prompt。
- `desktop/tests/windows-i05-real.cjs`：隔离真实 Windows/WSL 后台的发现、接入、回复、续聊和重开。
- `desktop/tests/windows-i05-portable.cjs`：普通 EXE 启动与重开，读取真实节点和历史，不启用调试接口。
