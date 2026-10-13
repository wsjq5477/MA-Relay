# I04 开发记录

日期：2026-10-09。用户要求开发 Windows 前端看板。本轮按 M1 连接、M2 看板与会话、M3 控制与交付实施。

| 增量 | 实际实现 | 验证 |
| --- | --- | --- |
| M1 | desktop 独立 React/Electron 包；Windows 本机窗口与自有图标；五页导航、深浅主题；自动读取既有实例；发现/勾选/项目选择；真实 Agent 状态 | 实际 Windows 五页/主题与真实 WSL 连接；空实例接入，模型任务数 0 |
| M2 | 任务分栏与筛选；回答/事件详情；每轮会话；新建与原会话续問；快照轮询防重叠，输入草稿不被刷新重置 | 两轮真实同 Session；每轮回答隔离；重返历史；20 次刷新测量 |
| M3 | 权限一次允许/拒绝、原生表单；取消与只读对账；写前台账；未知阻止新 ID 操作与实例切换；Windows 打包/说明 | 真 edit 批准、等待取消、文件与 CLI 对照；3 项主进程隔离测试；最终便携包正常启动检查 |

新增入口 src/desktop-host.ts：Zod 消息校验、受限 IPC、旧 controller 复用；不暴露任意 shell，不重建任务数据库。tests/desktop-host.test.ts 补充两项确定性合约测试，原回归共 42 项通过。

Electron 的 preload 仅暴露固定 API，renderer 无 Node。应用自身保存的 runtime.json 只有版本、时间、连接与记录数量，便于不启用调试端口的启动排障，不包含任务内容或凭据。未知操作保持原 ID，已确认的校验拒绝不会误归为结果未知；未确认记录不随最近历史裁剪掉。

Windows → WSL 初版多行命令参数在本机返回“参数错误”，已改成随包 bootstrap.sh 文件入口。脚本选择 Node 22.13+，默认启动目录为 WSL 用户家目录。后台仅携带生产依赖（约 8.8 MiB），移除打包时不需要的 TypeScript/ESLint 等开发依赖。

构建入口：npm run desktop:build、desktop:pack、desktop:dist。主进程测试：npm test --prefix desktop；真实 Windows 任务验收：npm run acceptance:desktop。最终产物与源码摘要见 artifacts/I04-build.json。

实际 Windows 自动交互验收来自解压版。最终便携版采用普通启动 + 自有只读健康记录验收；CDP 附加请求被自动审批拒绝后没有继续使用该接口，已结束失败测试的调试进程。WSL 互操作错误的排查没有重启 WSL 或停止日常 Bridge。
