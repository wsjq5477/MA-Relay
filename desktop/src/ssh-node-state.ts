import type {AgentNode,Machine} from './types';
export const canPreviewSshDaemon=(machine:Machine)=>machine.online||machine.kind==='ssh'&&!!machine.connectionId&&machine.connectionError?.code==='SSH_DAEMON_UPGRADE_REQUIRED';
const labels:Record<string,string>={validating_host:'正在校验主机',awaiting_host_trust:'等待确认主机',authenticating:'正在认证',inspecting:'正在检查远端环境',ready:'远端检测就绪',installing:'正在安装后台',starting:'正在启动后台',handshaking:'正在确认后台身份',reconnecting:'正在重新连接'};
export function sshNodeState(node:AgentNode):string|undefined{
  if(node.errorCode==='SSH_DAEMON_UPGRADE_REQUIRED')return '远端后台版本不受当前客户端支持';
  return node.connectionState?labels[node.connectionState]:undefined;
}
