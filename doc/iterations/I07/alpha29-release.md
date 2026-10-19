# I07 alpha.29 当前源码与 Windows 发布

日期：2026-10-19（北京时间）。用户要求将当前全部修改生成 EXE、创建新标签并发布 GitHub。版本 `0.6.0-alpha.29`，产品基于 `9e867ea`；包含 UI 重构、原生适配器扩展、当前 PATH 发现、空闲刷新/隐藏启动、原生协作准入与 CT-01 连接能力。CT-02 原生证据保留原日期和环境，不冒充本次 EXE 模型实测。

## 需求、开发与版本边界

M10-F01/F02/F03/F05/F06：新版本重新构建全部当前源码，旧 alpha.28、ui.2 与 poll.4 字节保留。桌面 package/lock 同步为 alpha.29；收录原 alpha.28 Linux manifest，规范 SHA-256 `b06a14fe3716c2df46cb665e21f137d05aab6046a611cb0275c5cadbc365d00d`，与既有冻结交付记录核对一致，不信任任意未知后台。

没有新增产品协议、存储结构或模型 API；本次版本与打包变化落在 M10。全模块设计及测试报告沿用 `9e867ea` 同步材料，新发布状态以本页为准，历史“未发布”均指各专项当时状态。完整 I06C/I07C 仍未准出，Hermes/Pi/DSH 真实模型、用户故障机及独立 SSH 升级未验。

## 构建、验收与发布

正在构建和核验，尚未宣布发布成功。原始证据保存在 `artifacts/releases/0.6.0-alpha.29/`。首轮受限沙箱核心测试异常/未完成，保留 core.log；允许本机进程/socket 后单独运行 core-local.log 与 desktop-local.log，不把首次失败算通过。

## 下载与升级

完成后发布地址为 [GitHub alpha.29](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.29)。

升级前在旧程序“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；普通关窗会保留旧后台。SSH 如需本版后台修复，另执行“后台维护 → 升级后台 → 确认升级”，再连接扫描；本轮不自动升级用户远端。unknown 操作继续查询原 requestId/operationId，不新建 ID 重派。不要覆盖运行数据降级至旧版。
