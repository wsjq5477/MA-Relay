# alpha.68 预发布交付

日期：2026-10-28（Asia/Hong_Kong）。承接公开 alpha.67，版本 0.6.0-alpha.68。当前正在验证候选 EXE，尚未标记公开发布。

## 本轮范围

- issue #27：关系视图冲突的只读脱敏检查、连续唯一原收据提案、明确确认后的逐字节备份及原子恢复，旧后台的 v3 写入能力前置门禁。[设计、流程与限制](relation-conflict-diagnostic.md)。
- 工作区已有的[原生启动失败边界](native-start-boundary.md)、[Hermes 分离输入保护](hermes-detached-input.md)、[Pi 原会话目录核对](pi-session-workspace.md)，均进入本次源码与包。
- 现有[桌面界面及离线字体精修](taste-impeccable-ui.md)，继承原生配置与原任务，不添加模型 API 层。
- alpha.67 原 Linux manifest 精确保留为兼容 pin。新版不自动升级日常后台或 SSH；v3 缺关系索引同步能力的旧后台须用户停止后打开新版。任意手动启动旧 EXE 的直接写入仍不能由新客户端隔离。

## 本轮实际验证

Windows Node24.12.0；界面构建与 Core 构建、类型检查、lint 通过。关系定向受控137/137、包内冻结关系后台16/16、Windows恢复路由25/25、原生生命周期受控40通过/1跳过。生产 renderer 合成 RPC 确认、取消、失败与成功反馈已验，不当作真实原生执行。

桌面全量原1001项：926通过、74失败、1跳过，未做同工作区变更前全量比较，不能全部认定历史失败。文档检查2243项缺失，与提供基线数量一致；没有删除历史引用。npm生产依赖审计仍有Zod 1项high（GHSA-mrhx-c7xc-m3w5，锁定4.6.5），本轮未升级依赖。两次打包失败为共享缓存EXDEV和重试相对目录ENOENT，改用隔离缓存与绝对预打包目录；失败原日志保留本地，不把失败写成通过。

当前未签名；真实用户 profile 恢复、真实模型/父模型完整协作、网关取消、完整原生矩阵、独立SSH、图100ms及冷启动性能仍未准出。模型调用为0，不切换日常后台。

## 候选证据

[定向回归](../../../artifacts/issue27/2026-10-28/targeted.txt)、[冻结Windows后台](../../../artifacts/issue27/2026-10-28/frozen-windows.txt)、[Windows恢复路由](../../../artifacts/issue27/2026-10-28/windows-recovery-contract.txt)、[Windows原生生命周期](../../../artifacts/issue27/2026-10-28/windows-native-contract.txt)、[依赖审计](../../../artifacts/issue27/2026-10-28/dependency-audit.json)、[产品输入冻结摘要](../../../artifacts/issue27/2026-10-28/product-inputs.json)。包字节、普通EXE与公开下载结果完成后登记在本页。
