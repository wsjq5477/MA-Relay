# Agent 协作开发入口

当前节点协作使用原生工具接入的受限 MCP，不要求用户在两个终端搬运任务结果。

完整资料：

- [主从关系、作用域与父子任务](modules/08-collaboration/design.md)。
- [实际协作与越权测试报告](modules/08-collaboration/test-report.md)。
- [原生工具的 MCP 注入与能力](modules/06-native-adapters/design.md)。
- [回调协议与身份](protocol.md)。

旧 CLI delegate/Skill 路径与桌面 MCP 的授权方式不同，不能混用。换主/清空关系后的旧父任务作用域有已知缺口，见模块报告；多层图不是当前已交付能力。

原说明保存在 [历史快照](archive/legacy/agent-collaboration-skill-mcp.md)。后续协作修改同步整体设计与模块报告，规则见 [维护指南](development-guide.md)。
