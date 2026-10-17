# Linux daemon 创建时的私有 socket 权限

日期：2026-10-16。源码沿用alpha.22工作区，GitHub预发布alpha.20；未构建新候选包或部署用户后台。关联AB-F05/11、M05-F01/F02。

## 需求与实现

I07B报告记录owned-stop场景启动时出现DAEMON_OWNERSHIP。复核发现daemon先listen再chmod；并发inspect有可能读到尚未私有化的socket。要求socket创建时即为0600，同时恢复调用者umask，保留身份、锁与原请求规则。

[machine-daemon.cjs](../../../desktop/electron/machine-daemon.cjs)在同步Unix bind范围临时设置0177 umask，并在finally恢复，监听后的chmod校验保留。没有await位于修改umask的范围内。未改变架构、数据模型、帧协议或持久格式，已核对对应整体资料，无需更改这些合约。

## 实际验证

环境为本机WSL Linux、Node22.23.1，隔离临时目录与真实Unix socket/后台进程，host为受控夹具，模型调用0。

新增[回归](../../../desktop/tests/machine-daemon.test.cjs)在listen同步返回时读取实际权限。修复前1项失败，实际0755、预期0600，见[首次失败摘要](../../../artifacts/daemon-bind/2026-10-16/initial-failure.txt)（工具输出摘要，非完整TAP）。修复后执行`node --test desktop/tests/machine-daemon.test.cjs desktop/tests/daemon-maintenance.test.cjs`，27/27通过，无跳过，见[完整TAP](../../../artifacts/daemon-bind/2026-10-16/tests.tap)。覆盖创建瞬间0600、原umask恢复与inspect身份，以及既有维护/收据回归。`node --check desktop/electron/machine-daemon.cjs`及`git diff --check`通过。

文档同步覆盖整体功能、M05完整设计/报告及本迭代开发记录；结构结果见[检查输出](../../../artifacts/daemon-bind/2026-10-16/docs-check.log)。

## 边界与下一步

确定性复现证明权限窗口存在并已消除，不证明I07B历史低频失败的完整因果，也不将一次回归当作故障率验证。未运行Windows EXE、独立服务器或真实原生模型，既有alpha.22包不包含本次源码修复。I07C自动激活/原会话续接和完整I06C准出保持未完成；下一步继续各原生接入的续接能力核验。
