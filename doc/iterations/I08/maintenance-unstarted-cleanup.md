# I08 issue #32：维护未执行的明确确认

2026-11-09 开始，2026-11-10 复验；基线 `1807bc6`，未发布源码。M01/M02/M04：原维护仍为 unknown 且远端原 ID 返回 not_found 时，仅在用户明确确认后只读核对原 ID 台账和预览。版本、摘要、安装目录、状态目录、profile 和 UID 均与原意图一致，且无需替换，才把本机原收据结算为 rejected 并恢复自动重连。查询 not_found 本身仍保留 unknown。只接受 upgrade、rollback、replace；旧记录缺少校验信息或凭据、远端不可用、身份变化均保留 unknown。

协调器先校验原 graph 意图及指纹，然后使用同一原 operationId 查询本机拒绝收据结算 graph。两份本机文件不是一个事务：若中途 graph 写入失败，原收据保持可按原 ID 查询恢复，不能重新发维护。确认过程经 SFTP 只读原 ID 台账并校验远端身份和写锁，不调用可能触发恢复的普通 query，不暂存控制器、不发送原维护动作；未更换 ID 或修改远端版本及目录。用户的确认不是远端执行证明，仍依赖现场只读核对与明确声明。

Windows Node 受控 fixture：维护运行时、访问和管理恢复最终 21 通过、1 Linux 专属跳过；确认及协调器定向 8/8 通过（部分共享，不累计）。原基线运行新增确认测试时因缺少方法失败，属于入口缺失证据，不是完整真实场景复现。根类型检查、lint、根构建、桌面构建通过；前端构建有大 chunk 提示。未验证真实 SSH、真实用户 profile、生产远端、普通 EXE 或真实模型；未执行远端维护写入。文档检查在独立工作树中为 3065 个缺链，与同基线错误集合相同，新增 0；不计为通过。生产 renderer 的合成 IPC 浏览器测试通过：机器卡片直达、确认前禁用、严格原 ID 参数、确认后入口消失；1280×960 与 800×760 实图已检查。普通 EXE 启动未测。

原始证据：[专项](../../../artifacts/issue32/focused-tests.txt)、[界面](../../../artifacts/issue32/ui-test.txt)、[宽屏](../../../artifacts/issue32-ui/confirmation.png)、[窄屏](../../../artifacts/issue32-ui/confirmation-narrow.png)。

2026-11-10：隔离桌面依赖后，实际 unpacked 包校验通过：75 个后台模块、87 个核心文件、Linux 1748 文件、ASAR 源码、前端、bootstrap 和 ws 依赖均匹配，见[包报告](../../../artifacts/issue32/unpacked-check.json)。首轮缺少 Linux Node 运行时停止；共享依赖扫描被中止后改用 D 盘隔离安装。依赖安装报告 high 1，未在本修复中升级依赖。

便携候选也已通过 verify-package --portable（未发布，沿用本地 alpha.74 包版本）：EXE 132347766 字节，SHA-256 256a4fc5d377d6380bfb2ab3d4c35da0bd4954eb9974b6ab2bc1a2940319496f。[完整包报告](../../../artifacts/package-check/0.6.0-alpha.74/package.json)。未执行普通 EXE 启动或真实 SSH 维护。
