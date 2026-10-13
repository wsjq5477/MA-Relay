# 本地配置示例

运行 node dist/cli.js init --dir .agentbridge 生成完整可执行配置。示例由 src/config.ts 的 initDemo 维护，每次生成独立随机凭据，不维护可复用明文 Token。

Hub 配置绑定 edge-a → mock-a、edge-b → mock-b，普通演示用户有两个目标的访问权；limited-client.json 只允许 mock-a、仅自己任务且不能访问详细事件。

所有 dataDir/tokenFile 相对各配置文件的目录，移动配置时须一同处理相对路径。生成的 RUN.md 给出绝对路径运行命令。更改 mode/delayMs/healthy 后重启对应 Edge，不能通过任务消息更改 Mock 行为。

I01 仅有本机回环示例；跨主机和 Windows 原生配置在 I06 实测后添加。
