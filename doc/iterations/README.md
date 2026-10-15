# 迭代资料目录

更新：2026-10-12。当前范围与优先级见 [迭代路线](../project-plan.md)；整项目设计见 [整体资料](../README.md)。

迭代说明“这次改了什么”。阅读模块如何工作，应去对应完整模块设计；历史报告只证明原日期、原版本和原环境。

| 迭代 | 需求与设计 | 结果 / 当前状态 |
| --- | --- | --- |
| I01 | [需求](I01/requirements.md)、[设计](I01/design.md)、[开发](I01/development.md) | [测试与验收](I01/testing.md) |
| I02 | [需求](I02/requirements.md)、[设计](I02/design.md)、[开发](I02/development.md) | [测试](I02/testing.md) |
| I03A | [需求](I03A/requirements.md)、[设计](I03A/design.md)、[开发](I03A/development.md) | [报告](I03A/report.md)、[体验修正](I03A/cli-fix.md) |
| I03B | [需求](I03B/requirements.md)、[设计](I03B/design.md)、[开发](I03B/development.md) | [报告](I03B/report.md) |
| I04 | [需求](I04/requirements.md)、[设计](I04/design.md)、[开发](I04/development.md) | [报告](I04/report.md) |
| I04B | [需求](I04B/requirements.md)、[设计](I04B/design.md) | [双环境交付](I04B/report.md) |
| I04C–G | 各版本稳定性修正 | [C](I04C/report.md)、[D](I04D/report.md)、[E](I04E/report.md)、[F](I04F/report.md)、[G](I04G/report.md) |
| I05 | [提案](I05/proposal.md)、[节点](I05/node-design.md)、[协作](I05/collaboration-design.md) | [0.5.0 验收](I05/acceptance.md) |
| I06 | [需求](I06/requirements.md)、[开发](I06/development.md)、[验收计划](I06/testing.md) | [当前进度](I06/progress.md)、[6A 候选验收](I06/acceptance.md)、[alpha.3 发现修复](I06/codex-discovery-fix.md)、[alpha.4 兼容复用](I06/ssh-compatible-reuse.md)；[6B 验收](I06/graph-implementation.md)，I06C 未完成 |

## 后续迭代必须写清

1. 需求编号、对应整体功能与模块、可验收行为。
2. 本次设计取舍与被更新的整体/模块文件。
3. 实际完成项、代码落点与未完成项。
4. 测试运行范围、真实证据、失败/未测和发布包状态。

不能只把新方案追加在迭代目录而让整体设计继续描述旧实现。同步规则见 [开发维护指南](../development-guide.md)。

当前新增 [I06B 图编辑实施与验收](I06/graph-implementation.md)，记录 alpha.6 与各层原始证据，不覆盖 I06A 的历史结论。

最新 I06B 图优化候选见 [alpha.7 专项](I06/graph-usability.md)：主节点强调、连线避让、中键平移，原生历史结论保留。

最新 [alpha.8 拖动修复](I06/graph-drag-fix.md)：旧后台兼容、本机布局、组背景拖动、主组居左与实际打包窗口验证。

## GitHub Windows EXE 交付

2026-10-13：[alpha.9 GitHub 预发布及附件核验](I06/github-release.md)。分发已有程序，不变更原源码行为、不替代 Windows/SSH/原生 Agent 验收。

当前 alpha.16 维护未发送边界补强与发布状态：[I06C 当前验收](I06/final-delivery.md)；[GitHub 源码与 Windows EXE 发布](I06/github-release.md)。完整 I06C 仍未准出。

当前 alpha.16 维护发送失败、原收据恢复、工程与实机分层验收见 [增量交付](I06/maintenance-launch-recovery.md)。

- [I06 alpha.18：Windows 运行缓存与原提交恢复](I06/runtime-recovery.md) — 同原意图核对、无 Prompt 重放；工程/Windows/包证据分别记录。

- [I06 alpha.19：Linux 非交互后台 CLI 发现](I06/linux-cli-discovery.md) — 用户态安装目录、原 PATH/身份保留及 SSH 实际后台升级边界。

- [I06 alpha.19：OpenCode 二次发现与 Windows 配置写入](I06/opencode-discovery.md) — 核验原安装、Windows实际PE/配置/受控启动退出及合并交付边界。

I06C alpha.20预发布：[未确认请求的资源范围与准备拒绝恢复](I06/pending-isolation.md)，独立节点可继续工作，原 unknown 与共享目录保护保留。
