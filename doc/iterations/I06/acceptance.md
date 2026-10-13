# I06A 候选交付验收

日期：2026-10-12。版本：**0.6.0-alpha.2**。结论：6A 主要功能与 Windows/SSH 主要流程验收通过，可以使用候选 EXE；整个 I06 的节点图、双向物理设备协作、完整故障与最终准出仍需 6B/6C。

## 用户交付与使用

程序：[AgentBridge-0.6.0-alpha.2-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.2-Windows-x64.exe)。从 Windows 文件资源管理器打开即可，不需要两个终端。

添加 Linux 机器 → 填写已有 SSH 登录信息 → 核对首次指纹 → 批准安装并连接 → 空格接入发现的 Agent → 新建会话、发送需求、继续原会话。设置页可以只关闭窗口，或确认停止后台并退出。

若之前运行过旧 6A 开发后台，先在新程序设置页停止后台，再重新打开以加载新代码；本次没有实现自动后台版本切换。0.5.0 保留为历史稳定版本，本候选不等于正式 0.6.0。

## 实际验收

| 范围 | 结果 | 原始证据 |
| --- | --- | --- |
| 核心 / 桌面回归 | 43/43、88/88 通过 | [核心 TAP](../../../artifacts/I06A-final/root-tests.tap)、[桌面 TAP](../../../artifacts/I06A-final/desktop-tests.tap) |
| typecheck / lint / 前端 | 通过 | [类型](../../../artifacts/I06A-final/typecheck.log)、[lint](../../../artifacts/I06A-final/lint.log)、[构建](../../../artifacts/I06A-final/desktop-build.log) |
| 接入与退出界面 | 6 项通过；明确为隔离模拟 | [UI](../../../artifacts/I06A-ssh-ui.json) |
| Windows 三认证/秘密保护 | 4 项真实 TCP SSH/加密 RSA/命名管道/DPAPI 通过；SSH 服务及 agent 为隔离进程 | [认证](../../../artifacts/I06A-auth.json) |
| Windows 独立 Linux 密码与 DPAPI | 2 项通过，实际 OpenSSH 登录和新实例解密再次登录 | [密码](../../../artifacts/I06A-password-real.json) |
| 私有 Linux Node | 实际无可发现 Node 的隔离 HOME，启动与重复启动 2 项通过；不冒充 SSH 整体安装 | [运行时](../../../artifacts/I06A-final/private-runtime.json) |
| Windows 新窗口与独立 Linux | 安装、发现、空格接入、两轮真实回复；同 Conversation/native Session；普通关闭、明确停止、重开原任务通过 | [真实窗口](../../../artifacts/I06A-real/report.json) |
| 普通便携 EXE | 3 项通过；无 inspector/debug 参数，关闭与重开保留后台/历史、请求数不增加 | [普通 EXE](../../../artifacts/I06A-final/portable.json) |
| 发布资源 | 25 个后台模块、1360 个 Linux 文件、窗口 app.asar、前端及包摘要一致 | [包校验](../../../artifacts/I06A-final/package.json) |

两轮原生 Session ID 的实际对比在真实窗口 JSON。恢复阶段仅查询同一批原 Task，submittedNativePrompts=0；这是原任务回读，不是换 ID 重跑模型。初始两轮只要求返回验证标记，没有修改项目文件。

## 包摘要

大小：129,301,297 字节。

SHA-256：`9e636e45f7242949a2e901ec6576b7fa6fcc75ed98bf1c0c127c4407d16b0e3d`。

## 限制与排期

- 系统 Windows OpenSSH agent 服务未专项实测；已验证 Windows 命名管道真实签名协议，未修改系统服务或用户密钥列表。
- 独立服务器有系统 Node；缺 Node 的私有运行时使用实际 Linux 隔离 HOME 验证。无 Node 独立服务器整条 SSH 安装尚未专项实测。
- 加密私钥到独立服务器、EXE 内不保存密码后的再次输入流程没有各自独立真实报告；模块协议与界面检查结果分别保留。
- 原生 Codex 账号与续聊版本限制没有通过更换模型规避。
- 节点图及跨独立设备双向协作归 6B；完整故障指标、游标补偿、连接编辑/移除、注销策略和升级回滚归 6C。

这些限制不被候选通过结论掩盖。整体设计、M01/M02/M04/M05/M06/M07/M10 与本迭代已同步，完整材料从 [文档入口](../../README.md)阅读。

## 后续 alpha.3 发现修复

2026-10-12：0.6.0-alpha.3 修复 Codex 把原生内部列表误用作 Bridge 连接列表的问题。新候选 EXE 已生成，源码受控回归、真实原生发现/委派/汇总和包内资源检查结果见 [单独交付](codex-discovery-fix.md)。本页 alpha.2 的真实 SSH/生命周期证据保留原日期、版本和适用范围，不覆盖或冒充 alpha.3 的全部流程复测。

## 后续 alpha.4 兼容复用

2026-10-12：[alpha.4 交付](ssh-compatible-reuse.md)修复客户端升补丁后无法连接既有可信 alpha.2/alpha.3 daemon 的预检问题。桌面 93/93、用户原服务器只读校验与新候选资源比对通过。复用不升级远端代码，也不重跑本页 alpha.2 的全部 SSH/模型/故障验收；I06B/C 未完成。


## 后续 alpha.5 重连报错清理

2026-10-12：[alpha.5 交付](ssh-error-recovery.md)修复在线机器缓存保留旧版本报错。桌面 95/95、真实 Windows 浏览器受控快照 2 项及新包完整性通过；核对原用户状态为只读，不冒充新 EXE 对原远端的重连实测。旧原生/认证验收保留原版本，I06B/C 未完成。

## I06B alpha.6 候选验收

alpha.6 的节点图、原父权限和独立 SSH 双向核心协作主要范围通过；与本页 alpha.2 验收分开，图/中央存储、独立双向链及最终包分别见 [I06B 实施](graph-implementation.md)。本页历史结果未覆盖或被替换，正式 0.6.0 和 I06C 尚未准出。


6B 最终核对：2026-10-13，原 profile 的反向请求在原服务恢复后完成，实际父子均成功，原 requestId/内容/授权保持；[原请求报告](../../../artifacts/I06B/2026-10-12/real-resumed.json)。普通 EXE 与图交互分别验收，原窗口失败不覆盖，完整自动恢复仍待 I06C。

## alpha.7 图优化专项

2026-10-13：主角色、避让方向与中键交互单独验证，当前结果见 [专项验收](graph-usability.md)。不覆盖本页 alpha.2 或 alpha.6 的原生/SSH 历史结果，也不代表 I06C 已完成。

## alpha.8 拖动与旧后台专项

2026-10-13：原 alpha.5 后台只读诊断、alpha.7 Electron 复现和 alpha.8 实际窗口拖动验收分别记录；完整结果见 [专项](graph-drag-fix.md)。不把受控旧接口称为原用户窗口实测，原 SSH/模型历史不重跑。

## 2026-10-13 节点管理增量

I06-UI/机器节点增量：合并重复的机器/协作页，按机器添加已安装 Agent、明确断开/移除及原身份恢复。节点状态与撤权原子提交，忙碌/未知/离线拦截，回应未知只读查询原 ID；原生安装与历史保留。需求、开发、逐项实际验收和未测范围见 [alpha.9 记录](node-management.md)。不将节点移除扩大为 I06C 的机器移除/卸载。
