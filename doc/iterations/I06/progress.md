# I06 开发与候选交付进度

更新：2026-10-12。**6A 主要功能完成，0.6.0-alpha.2 候选包已通过本次 Windows/SSH 主要使用流程验收。** **6B alpha.6 主要开发与验收完成**，当前证据见 [6B 报告](graph-implementation.md)。整个 I06 和正式 0.6.0 仍未完成，下一阶段为 6C。下方 A01–A06 和 88/88 为 alpha.2 历史证据。

## 当前交付

| 工作项 | 已实现与实际证据 | 具体边界 |
| --- | --- | --- |
| A01 独立 Coordinator | 普通便携 EXE 关闭后同 PID 后台仍在；重开复用，明确停止后退出，新打开复用身份与历史 | 完整升级/旧后台切换属 6C |
| A02 SSH 与凭据 | Windows 真实独立 Linux 密码登录、DPAPI 保存后新实例恢复；加密 RSA 与命名管道 agent 实际 SSH 协议验证；6 项界面检查 | 系统 OpenSSH agent 服务未改动/专项实测；隔离 agent 不能代替全部服务兼容性 |
| A03 安装与离线资源 | Windows 窗口实际安装/连接独立 Linux；1360 个离线文件完整校验；私有 ELF Node 在无可发现 Node 的实际 Linux 隔离 HOME 启动 daemon | 无 Node 独立服务器的整条 SSH 安装未专项复验；独立服务器目前有 Node |
| A04 daemon / relay | 真实 SSH 运行、窗口关闭/中央停止后可回读；历史断线期间执行完成记录保留 | 全退避、游标过期补偿、注销策略与故障指标归 6C |
| A05 远端机器与节点 | Windows 窗口出现独立 Linux 和 OpenCode；空格接入；重开仍为同机器与节点 | 不绑定模型、供应商或项目；跨设备协作图归 6B |
| A06 直接会话 | Windows 界面两轮真实 OpenCode 回复，Conversation 与 native Session ID 完全相同；停止/重开后原任务回读，无新 Prompt | 原生 Codex 续聊/账号限制继续保留 |

[候选验收](acceptance.md)、[汇总 JSON](../../../artifacts/I06A-final/summary.json)、[真实窗口](../../../artifacts/I06A-real/report.json)、[普通便携 EXE](../../../artifacts/I06A-final/portable.json)。所有本次验证使用隔离 Bridge profile，不修改用户现有原生模型配置或项目文件。

## 本次修复

1. 设置页新增“仅关闭窗口”“停止后台并退出”，停止说明与取消确认有效；确认时暂停轮询。
2. electron-builder 会漏掉父资源中的 node_modules；增加独立 Linux 依赖资源项，修复发布包预检失败。
3. daemon 版本改为读取发布包，避免新版本握手被旧常量拒绝。
4. OpenCode 会话 API 返回 canContinue/kind，修复第一轮结束后按钮仍禁用；等待/unknown/无绑定/配置不匹配仍不可续问。
5. 打包后强制验证窗口、后台、前端与 Linux manifest，并记录 EXE 摘要。

## I06A 历史工程基线

核心 43/43、桌面 88/88、根 typecheck/lint、桌面构建通过；文档检查与包校验见 [最终材料](../../../artifacts/I06A-final/summary.json)。不把独立界面、真实 SSH/Agent 和普通 EXE 检查相加冒充更多单元测试。

## 后续迭代

6B 已完成主要范围：机器分组节点图、鼠标/键盘授权连线、独立布局、跨独立设备双向核心协作与原父权限修复。本次核心 43/43、桌面 110/110、Windows 图 10 组通过；真实模型、受控界面和普通便携 EXE 分开记录于 [当前验收](graph-implementation.md)。

6C：machine.updateSsh/machine.remove、游标过期补偿、完整恢复/延迟样本、注销策略、后台版本切换、升级回滚/卸载和最终准出。受环境限制未专项实测的兼容性分支在候选报告中保留，不标全环境通过。

## 2026-10-13 alpha.9 节点管理增量

合并机器/协作页面、按机器添加原生工具、断开/移除及原身份恢复；本次工程 125/125 受控通过。生产窗口/图交互/性能和最终包实际结果见 [完整交付](node-management.md)。旧版本证据保留日期，I06C 与正式准出继续待完成。
