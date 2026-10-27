# alpha.66 Linux Hermes CLI适配与发布

日期：2026-10-27（Asia/Hong_Kong）。用户补充要求适配Linux Hermes CLI，继承上一轮代码、文档、验证及GitHub发布授权。基于公开alpha.65/a22a736；当前候选0.6.0-alpha.66，公开仍alpha.65。原生目标机器待用户指明，独立Linux CI先用于模型0组件验证，不访问/部署用户SSH。

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
- 本机Ubuntu-22.04已枚举，但启动返回HCS_E_SERVICE_NOT_AVAILABLE；没有启动原生Linux进程或模型，不据此重启/改写系统服务。
- Linux CI及正式0.22.5组件验证待运行，完成后追加真实结果、失败和原始证据。
- 新EXE/离线资源、冻结提交、GitHub附件及匿名完整下载均待本轮验证；alpha.65旧标签/附件不动。

未切换日常Bridge后台、未部署SSH；Hermes网关取消、真实Linux父模型/自主MCP与完整异常恢复仍按原矩阵分层验收。共享计数不跨模块相加；不以历史Linux固定源码组件成功冒充本轮正式安装版。
