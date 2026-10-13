# I04 模块分析与设计

## 页面模块

| 模块 | 用户需求与设计 | 实现 |
| --- | --- | --- |
| 工作台导航 | 五个固定入口；可见运行环境与后台状态；原生窗口按钮 | desktop/src/App.tsx，style.css |
| 总览 | 连接数、活动/待处理/完成数、真实连接与会话；统计限定当前加载的记录 | App 的快照与总览呈现 |
| Agent 管理 | 工具发现与项目选择；继承原生模型；在线/健康与真实验证分开 | ConnectDialog、controller agents/check/verify |
| 任务看板 | 状态分栏；按 Agent、状态和文本过滤；详情抽屉 | taskCard、TaskDetail |
| 会话阅读与输入 | 每轮需求和回答；上一轮终止后才允许续问；失败保留输入草稿 | Composer、NewTask、conversation/continue |
| 等待处理 | 读取原生等待项；一次授权/拒绝；表单条件字段/必填校验；取消确认 | TaskDetail、FormReply、pending/reply/cancel |
| 设置与恢复 | 主题、WSL、实例路径；查询尚未确认的请求；运行环境诊断 | preferences、pending journal、environment |

App 负责业务状态，types.ts 定义只供页面使用的数据类型，api.ts 封装固定通道及可读状态。刷新间隔 1.25 秒，避免重叠请求；任务详情和会话详情按原 ID 查询。展示完全依赖真实快照，没有演示数据注入。

## Windows 壳与受限桥接

```text
Windows Electron 主窗口
  → 隔离 preload 的固定方法
  → main.cjs 校验发送页面、方法和大小
  → rpc.cjs / wsl.exe / bootstrap.sh
  → WSL desktop-host.js
  → 已有 controller IPC
  → Hub → Edge → OpenCode
```

| 模块 | 职责及设计依据 |
| --- | --- |
| main.cjs | 单实例；本地页面；禁新窗口/导航；contextIsolation、sandbox 开启，Node Integration 关闭；偏好和未确认操作持久化 |
| preload.cjs | 只提供固定 bridge API；不暴露文件系统、shell、原生 IPC 或凭据 |
| rpc.cjs | 结构化 JSONL 请求与关联 ID；65 秒超时；固定启动程序，不拼接 shell 命令；退出只断开宿主 |
| bootstrap.sh | 在所选 WSL 查找 Node，加载随包分发的后台程序；文件启动避免 Windows 多行参数解析问题 |
| src/desktop-host.ts | 入口 schema 与方法白名单；复用 controller；仅名称/启停的有限保存；连接重新验证发现目标 |
| controller / Hub / Edge | 沿用已验收的权限、资源占位、幂等、会话绑定、原执行对账与托管进程身份核验 |

Windows 端通过路径映射访问打包的 host：盘符目录映射 /mnt/<盘符>，WSL UNC 路径必须属于所选发行版。后台从 WSL 用户的家目录启动，默认读取同一用户的 ~/.local/state/agentbridge；设置可指定独立实例。项目可选 WSL 目录或映射后的 Windows 目录，目录存在性由原 SettingsStore 检查。

## 写操作与恢复

提交/续问/验证使用 requestId；回复/取消使用 operationId。Electron 主进程在发往后台前写入 pending.json，收到结果后记为 confirmed 或 unknown。传输中断后保留原参数及 ID，只读查询原 request/operation；未确认期间阻止新的写操作与运行实例切换，主题仍可修改。不自动换 ID 补发。结果与任务终态分别显示，关闭窗口只关闭宿主 stdin，后台任务继续由独立 controller 执行。

任务/会话沿用 Hub/Edge 的 SQLite，不建立桌面端任务副本。用户偏好与未确认操作保存在 Windows 用户 AppData；原生供应商凭据留在 OpenCode，前端不要求模型 Key。

## 外观与技术选择

参考 [CC Switch 4.0.2 官方主题](https://github.com/farion1231/cc-switch/blob/v4.0.2/src/index.css)和[正式/预览发布列表](https://github.com/farion1231/cc-switch/releases)：浅灰侧栏、白色卡片、细边框、黑白主按钮、#f97316 橙色强调、深浅主题。使用 AgentBridge 自有名称与图形。设计依据为官方主题代码，没有宣称逐像素复刻。

Electron 用来复用既有 Node/TypeScript 后台协议，React 提供页面与表单。没有引入另一个推理框架。窗口能在 Windows 原生运行；当前执行后台仍在 WSL。正式原生 Windows 后台需要单独实现 named pipe/ACL、进程身份与生命周期核验。
