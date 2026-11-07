# I08 Pi 自定义运行时

2026-11-07，当前未发布工作树；沿用已有原生 Pi JSON 宿主，不改变公开 EXE。关联 AB-F04/F07、M01/M03/M05/M06。

## 需求与最终行为

用户要求扩展第一步的协议类型，明确提出 Pi。当前自定义运行时开放 Hermes、Pi 两种协议，使用已有品牌图标。第二步按所选协议显示名称和命令示例；返回保留表单，再选协议会清理旧错误。

目标机器创建链路不变：Coordinator 按 machineId 路由，本机、WSL 或认证 SSH Linux 的 MachineHost 探测程序并保存配置。Pi 固定参数在原宿主生成的 JSON/print/session 参数之前，输入通过原 stdin 传入；会话文件及目录沿用原 Pi 宿主的绑定与校验。Pi 的取消和结束解析沿用既有宿主能力。自定义运行时仍不由 Bridge 管理 MCP，不引入模型 API 或自动选目标。

私有配置新增 adapter 字段；旧配置缺字段时只解释为 Hermes，不重写文件、不迁移 ID。发现按已保存协议报告，执行时复核配置协议和原上下文协议一致。同一 profileId 改换协议拒绝；相同配置重试返回原 ID。

Pi 固定参数拒绝覆盖 mode/print、session/session-dir、continue/resume、no-session、model/provider、api-key 及帮助、版本、导出等改变运行模式的参数（含受支持短参数）。版本探测仅证明可启动和报告版本，不证明任意第三方命令兼容 Pi 事件协议。

实现入口：[私有配置](../../../desktop/electron/custom-runtime.cjs)、[目标宿主](../../../desktop/electron/machine-host.cjs)、[原 Pi 协议](../../../desktop/electron/native-cli-protocols.cjs)、[图标向导](../../../desktop/src/CustomRuntimeDialog.tsx)。

## 验证与证据

Windows、Node 24.12.0、Chrome Headless Shell；临时目录、浏览器状态和原始输出位于 D 盘；模型调用 0。

| 场景 | 实际结果与来源 |
| --- | --- |
| TypeScript / Vite | 通过；[构建输出](../../../artifacts/custom-runtime/2026-11-07-pi/build.log) |
| 配置与机器路由 | 23/23；含 Pi 重开保留协议、同 ID 换协议拒绝、旧 Hermes 兼容、Pi 参数拒绝、上下文协议不符零宿主、既有远端路由回归。[输出](../../../artifacts/custom-runtime/2026-11-07-pi/profiles-router.tap)、[配置用例](../../../desktop/tests/custom-runtime.test.cjs) |
| 生产 Coordinator/MCP/MachineHost/子进程 | Hermes/Pi 联合专项 2/2；Pi 首轮与原会话续聊、丢回应后原请求查询、原 Task 去重、独立节点及固定 argv 通过。补强精确会话文件与原配置保留断言后 Pi 专项另验 1/1。[联合输出](../../../artifacts/custom-runtime/2026-11-07-pi/native.tap)、[最终 Pi 输出](../../../artifacts/custom-runtime/2026-11-07-pi/pi-final.tap)、[用例](../../../desktop/tests/native-delegation.test.cjs) |
| 生产界面 / 受控后台 | Hermes/Pi 各 1440/1024/390 三宽度，共六组通过；SSH Linux 创建入口、图标选择、失败保留、返回及重新提交。[脚本](../../../artifacts/custom-runtime/2026-11-07-pi/browser-check.cjs)、[输出](../../../artifacts/custom-runtime/2026-11-07-pi/browser.log)、[图标](../../../artifacts/custom-runtime/2026-11-07-pi/pi-types-1440.png)、[Pi 窄屏](../../../artifacts/custom-runtime/2026-11-07-pi/pi-dialog-390.png) |
| Impeccable | 弹窗检测无发现；[输出](../../../artifacts/custom-runtime/2026-11-07-pi/impeccable.json) |

首轮 Pi 续聊测试错误地携带 workspace，被既有会话门禁拒绝；去掉新目录后原 Session 续聊通过。[保留初次失败](../../../artifacts/custom-runtime/2026-11-07-pi/native-first-failure.tap)。不得将首次失败覆盖成全程全绿。

本轮没有运行真实 Pi 账号/模型、独立 Linux daemon、生产 SSH 或发布 EXE。上述协议 CLI 为受控夹具，远端浏览器数据也为受控后台；不作为真实原生远端闭环。其他协议（Claude/Codex/OpenCode/DSH 等）的自定义运行时仍未开放。

文档检查见[输出](../../../artifacts/custom-runtime/2026-11-07-pi/docs-check.log)，仍有 2243 项既有错误，本轮新增记录与链接无报错，不作为完整验收通过。
