# I04 测试与人工验收

## 检查分层

| 层级 | 场景 | 证据 |
| --- | --- | --- |
| 工程 | 根项目 typecheck/lint/build/test；桌面 typecheck/Vite 构建；依赖检查 | 实际命令输出，42 项后端测试 |
| 宿主合约 | 空实例只读快照；非法方法拒绝；有限配置保存；同数据源、去重、会话、权限取消 | tests/desktop-host.test.ts，2 项确定性夹具测试 |
| Windows 窗口 | 真实 win32 进程；五页、主题、WSL 实例连接；renderer 隔离与未知方法拒绝 | desktop/tests/windows-smoke.cjs；artifacts/I04-windows-smoke.json |
| 真实模型闭环 | 首次发现/连接、真实两轮、一次授权 edit、权限等待取消、历史重返、UI/CLI 核对 | scripts/i04-desktop-acceptance.ts、desktop/tests/windows-real.cjs；artifacts/I04-acceptance.json |
| 主进程保护 | 不明回应阻止新 ID/实例切换；只读查原操作解除确认；已知拒绝不误锁；未确认历史保留；诊断无凭据 | desktop/tests/main.test.cjs，3 项通过 |
| 普通启动 | 最终便携包不带调试参数启动；窗口标题、进程归属、renderer 实际快照 | desktop/tests/windows-normal-startup.cjs；I04-windows-startup.json |
| 刷新延迟 | 20 次后台确认的连接名更新，对比界面可见时间，p95 ≤2s | I04-acceptance.json 的 observation |

合约夹具用于可重复验证，不能代替真实 OpenCode。Windows 截图来自实际 Electron 窗口。真实验收使用独立 Windows profile、/tmp 下的 Bridge 状态和复制的 calculator 示例；只在该配置覆盖验收模型 csi-provider/DeepSeek-V4.1-Flash，结束后停止该测试实例，不改变日常实例。

## 运行

```bash
npm ci
npm ci --prefix desktop
npm run typecheck
npm run lint
npm test
npm run desktop:dist
```

Windows 跨系统验收脚本包含本机的 Node 路径、WSL 发行版及已部署 app 路径，需要按测试机器调整。运行 npm run acceptance:desktop；Windows Node 仅用于自动验收，正常双击 app 不需要它。失败保留隔离状态便于排查，不再次提交原任务。

## 人工验收

1. 双击 Windows 本机目录中的 AgentBridge.exe；确认既有 OpenCode 出现在 Agent 连接页，项目/模型来自真实配置。
2. 首次空实例：发现并连接 Agent，空格勾选，选择项目，连接；没有 Key/端口/是否启用等重复确认。
3. 新建只读任务，在看板打开详情看到真实进度和结果；进入会话续问并检查上下文。
4. 在自己的可测试项目请求修改；等授权卡片出现，选择仅允许本次，确认文件及测试结果。
5. 另一轮处于授权等待时取消，等实际“已取消”；未经批准的文件修改未发生。
6. 关闭并重开，按需求标题进入历史；检查任务与轮次没有新增；切换深浅主题。
7. 错选 WSL/实例路径时看到错误及修复入口；恢复后重新查询，不补发任务。

原生 Windows 后台、ARM64、Mac、Linux GUI、代码签名、自动升级、托盘和全量历史分页没有在本轮验收。
