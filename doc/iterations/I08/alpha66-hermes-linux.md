# alpha.66 Linux Hermes CLI适配与发布

日期：2026-10-27（Asia/Hong_Kong）。用户补充要求适配Linux Hermes CLI，继承上一轮代码、文档、验证及GitHub发布授权。基于公开alpha.65/a22a736；当前公开0.6.0-alpha.66已完成下述分层验证。用户随后指定先在本机WSL安装Hermes；独立Linux CI用于模型0组件验证，不访问/部署用户SSH。

## 需求与依据

[官方安装说明](https://hermes-agent.nousresearch.com/docs/getting-started/installation)明确POSIX默认源码~/.hermes/hermes-agent、发布包装器~/.local/bin/hermes；HERMES_HOME选择数据目录，--dir/HERMES_INSTALL_DIR可独立选择源码。固定官方v0.22.5的annotated tag剥离后为bf0203a794a07aac3ff764972ab9087baa4e4f4e，与上轮Windows安装源一致；本地未修改上游源码。

旧扫描器只补固定Hermes venv目录，漏数据Home/bin及独立源码根，且把Hermes专用目录加入所有Agent的候选池，可能误选放在其中的其他命令。

## 实现

[tool-discovery.cjs](../../../desktop/electron/tool-discovery.cjs)新增Linux Hermes专用候选解析：

1. PATH原命令优先，版本失败不静默切换其他安装。
2. 显式HERMES_INSTALL_DIR的.hermes/bin和venv/bin在PATH缺失时先于通用便利目录；旧版布局保留。
3. HERMES_HOME/bin、当前Profile所属根、默认~/.hermes及数据目录后缀下的原生安装布局均可发现。数据/源码路径按字面展开~/$VAR/${VAR}，无shell求值，缺变量或相对源码路径不依当前cwd猜测。
4. Hermes专用目录不提供其他Agent；显式空候选继续禁用扫描，20秒版本预算与原安装canonical身份保持。

Linux执行继续使用alpha.65的stream-json/精确--resume，继承原生账号/模型。未增加模型API、RPC、数据字段/版本或Session迁移；原unknown/取消收据及网关取消false不改变。原生MCP配置与清理仍按绑定Profile，不因扫描而写入或创建Profile。架构已同步，data-model/protocol核对无新合约。

[新增Linux路径回归](../../../desktop/tests/hermes-linux-discovery.test.cjs)覆盖默认/旧布局、独立源码根、PATH优先/失败不换绑、变量/波浪线、固定Profile、后缀、跨Agent隔离及禁用。新增[Linux正式安装验收](../../../desktop/tests/linux-hermes-installed.cjs)使用原生包装器解析其已提交Python依赖代次，复用原MCP五组/十工具生命周期，模型0。

[GitHub Ubuntu流程](../../../.github/workflows/hermes-linux.yml)使用只读contents权限、固定官方Actions SHA；依赖安装、根构建/类型/lint/Core及Linux适配回归后，安装固定官方0.22.5、不交互配置账号、不启用浏览器/计算机工具，运行真实原生CLI和MCP组件。只上传本轮无账号证据，不上传原生Home、凭据或接入身份。它不是用户SSH/WSL或真实父模型验证。

## 当前实际结果

- Windows Node24.12.0受控Hermes定向39/39，模型0：[日志](../../../artifacts/hermes-linux/2026-10-27/targeted-windows.tap)。其中新增Linux路径测试是在Windows文件系统模拟Linux分支，不当作Linux真实CLI证明。
- 本机Ubuntu-22.04早期启动返回HCS_E_SERVICE_NOT_AVAILABLE；用户后续运行WSL后已能启动，无重启/改写系统服务。用户安装遇到curl SSL超时，实测WSL对官网/GitHub/PyPI均TLS超时，而Windows访问正常。仅安装进程通过Windows临时回环HTTPS CONNECT通道下载，保留证书校验，不改全局代理、路由或用户模型配置。官方脚本固定源码0.22.5/bf0203，非交互CLI安装完成；未安装可选浏览器/计算机控制组件，未配置账号。临时通道已停止，WSL直连网络问题仍需独立处理，未冒充已修复。
- 首次原生安装的版本stamp显示0.21.5+距离，但源HEAD正确；官方Git版本查询仅3秒，实际标签历史遍历3.222秒，导致回退旧日期标签。补取并核对官方v0.22.5、生成本地Git commit-graph后标签查询0.006秒，再执行原生source_completion写入正确stamp；上游源码未改。现在原生`hermes --version`为0.22.5/Python3.14.9，zsh登录终端能找到官方便利包装器。保留[初始stamp](../../../artifacts/hermes-linux/2026-10-27/wsl-initial-source-stamp.json)、安装及收尾日志。
- 本机WSL使用候选包内Linux Node22.23.1及冻结MachineHost/发现/MCP代码，对正式安装Hermes完成安装发现、最小PATH独立源码根、两个官方包装器共同原生运行命令及MCP五组/十工具生命周期，模型0：[安装验收](../../../artifacts/hermes-linux/2026-10-27/wsl-frozen/installed.json)、[原生MCP](../../../artifacts/hermes-linux/2026-10-27/wsl-frozen/native-mcp.json)。测试只修改临时原生Profile，未写用户默认MCP配置，未迁移或重投任务；不是SSH、原生父模型或独立服务器验收。
- [首轮Ubuntu CI](https://github.com/wsjq5477/MA-Relay/actions/runs/40469768580)的工作流状态为success，但下载原始附件发现适配回归99/100、原生安装验收失败；根Core71/71通过。默认shell的tee吞掉前段失败，已显式选择bash以启用pipefail；不把工作流绿色计为通过。隔离测试固定TAP reporter，消除终端默认reporter差异。官方POSIX便利包装器与源码包装器是两个不同文件，验收改为分别核对选中路径及原生已提交Python代次，保持原可执行身份，不把别名当新节点释放unknown。首轮原始证据保留，最终重跑结果见下文。
- [第二轮Ubuntu CI](https://github.com/wsjq5477/MA-Relay/actions/runs/40474885490)适配回归100/100、Core71/71通过，pipefail如实报告原生验收失败：验收脚本误将Python的code模块当作支持-c的解释器入口。改用官方`--print-runtime-command -- --version`边界核对两个包装器的完整原生运行命令，再使用其声明的Python与原PM API解析已提交依赖代次。本机WSL包内Node重跑已通过，独立CI最终重跑已通过；原失败保留。
- 最终[独立Ubuntu CI](https://github.com/wsjq5477/MA-Relay/actions/runs/40476122933)实际Core71/71、适配回归100/100及正式Hermes0.22.5原生MCP五组/十工具通过，模型0：[安装验收](../../../artifacts/hermes-linux/2026-10-27/ci-evidence/installed.json)、[MCP](../../../artifacts/hermes-linux/2026-10-27/ci-evidence/native-mcp.json)。
- WSL原生pm doctor退出0，已安装Python/Node/npm/uv/rg/FFmpeg均通过；普通doctor在External Tools部分90秒超时，未记为全健康。账号未配置，可选浏览器/计算机控制和其他工具未安装；[pm doctor](../../../artifacts/hermes-linux/2026-10-27/wsl-pm-doctor.log)、[原doctor日志](../../../artifacts/hermes-linux/2026-10-27/wsl-doctor.log)。
- 普通无调试EXE七组生命周期通过，三次原窗/包装进程与两次测试Coordinator正常退出，原unknown、撤权收据和历史保留：[原报告](../../../artifacts/hermes-linux/2026-10-27/portable-verified.json)。启动实际220059/198798/196659ms，不视为冷启动性能准出。
- 冻结13e6c49b0b4cbabdcfd79c9d222d1de1535a3421；211产品/依赖输入与冻结源码核对，58后台/84Core/1672 Bridge文件/1722 Linux文件、ASAR/前端/bootstrap与实际EXE载荷逐项匹配；alpha.65原daemon兼容pin字节保持。EXE132220720字节，SHA-256 eac36223030837837c468b31dda5af94598b43b8242f6315bcf782fe18763999；[包核验](../../../artifacts/hermes-linux/2026-10-27/package-check.json)、[实际EXE载荷](../../../artifacts/hermes-linux/2026-10-27/exe-payload-check.json)、[输入快照](../../../artifacts/hermes-linux/2026-10-27/build-source-manifest.json)。alpha.65旧标签/附件不动。

未切换日常Bridge后台、未部署SSH；Hermes网关取消、真实Linux父模型/自主MCP与完整异常恢复仍按原矩阵分层验收。共享计数不跨模块相加；不以历史Linux固定源码组件成功冒充本轮正式安装版。


## 发布状态

首次匿名下载尝试落盘，在6MiB处因工作盘空间不足失败，未计为完整下载；保留原失败日志，仅删除本轮不完整下载文件。随后不落盘、流式读取全部响应并逐块计数/计算SHA-256，两个附件HTTP200、完整字节及摘要均匹配；本地原始EXE与载荷校验报告保留。

源码、Windows EXE与SHA256SUMS.txt已公开，服务端size/digest与匿名HTTP200完整下载逐项一致：[GitHub发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.66)、[附件与下载证据](../../../artifacts/hermes-linux/2026-10-27/github-download.json)。文档网站只发布18页用户材料/19 HTML，无内部页面或原始证据导出；docs:test原5/6失败与历史材料缺失基线保留，无新增文档错误。
