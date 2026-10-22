import type { AgentNode, ConnectionCapabilities } from './types';

const nativeAdapters = new Set(['claude', 'opencode', 'codex', 'hermes', 'pi', 'dsh', 'dsh-desktop', 'dsh-web', 'opendesk', 'opendesk-desktop']);
// Product names, icons, online/available flags and arbitrary claims never
// establish an adapter. Keep the reviewed registry boundary for unknown ones.
const executionGatedKeys: (keyof ConnectionCapabilities)[] = ['execution', 'delegation', 'bridgeMcp', 'mcpClient', 'nativeMcpConfig', 'hostManagedTask'];

// MCP client support, native config management and managed-task injection are
// independent dimensions. `bridgeMcp` and `teamCollaboration` remain aliases
// for old consumers, but MCP calling is never narrowed by managed-task support
// or by a hard-coded product whitelist.
export function connectionCapability(node: AgentNode | undefined, key: keyof ConnectionCapabilities): boolean | null {
  if (!node || !nativeAdapters.has(node.adapter)) return null;
  if (node.executionSupported === false && executionGatedKeys.includes(key)) return false;
  if (key === 'delegation') {
    const execution = connectionCapability(node, 'execution');
    if (execution !== true) return execution;
  }
  if (node.capabilitySource?.kind === 'unknown' || (node.capabilitySource?.adapterId && node.capabilitySource.adapterId !== node.adapter)) return null;
  if (node.connectionCapabilities !== undefined) {
    if (key === 'bridgeMcp') {
      const projected = node.connectionCapabilities.bridgeMcp;
      if (typeof projected === 'boolean') return projected;
      // Legacy alias: the backend may only project the new dimension.
      const client = node.connectionCapabilities.mcpClient;
      return typeof client === 'boolean' ? client : null;
    }
    const value = node.connectionCapabilities[key];
    return typeof value === 'boolean' ? value : null;
  }
  // Older snapshots have no directional contract. Only the reviewed execution
  // operations stay readable; every new control/MCP field remains explicitly
  // unknown instead of being guessed from team collaboration or the adapter id.
  if (key === 'execution' || key === 'delegation') return node.executionSupported === true;
  return null;
}

export const canExecuteNode = (node?: AgentNode) => connectionCapability(node, 'execution') === true;
export const canReceiveDelegation = (node?: AgentNode) => canExecuteNode(node) && connectionCapability(node, 'delegation') === true;
export const canCallBridge = (node?: AgentNode) => canExecuteNode(node) && connectionCapability(node, 'bridgeMcp') === true;
// Bridge can manage this product's own native MCP config entry.
export const canConfigureMcp = (node?: AgentNode) => connectionCapability(node, 'nativeMcpConfig') === true;
// Bridge can inject a per-managed-task scoped MCP into its managed session.
export const canHostManagedTask = (node?: AgentNode) => connectionCapability(node, 'hostManagedTask') === true;

export function mcpClientUnknownReason(node?: AgentNode) {
  const caller = connectionCapability(node, 'bridgeMcp');
  if (caller === true) return '可调用 Bridge MCP。';
  if (caller === false) return '该产品未确认提供 MCP 客户端，不能调用 Bridge MCP。';
  return 'MCP 调用能力未确认，需升级后台或重新接入后核对。';
}

export function bridgeCallerReason(node?: AgentNode) {
  if (!canExecuteNode(node)) return '当前节点的执行能力未确认，暂不能设为主 Agent。';
  const direct = canReceiveDelegation(node) ? '仍可直接会话或接收普通委派。' : '仍可使用直接会话。';
  const caller = connectionCapability(node, 'bridgeMcp');
  if (caller === true) return '可调用 Bridge MCP。';
  if (caller === false) return '该产品未确认提供 MCP 客户端，不能作为主 Agent；' + direct;
  // Host managed-task injection is a separate dimension; not having it must
  // not be presented as an MCP client refusal.
  return 'MCP 调用能力未确认，暂不能设为主 Agent；' + direct;
}

export function connectionCapabilitySummary(node: AgentNode) {
  if (node.status === 'upgrade_required') return '后台需要升级后才能执行和读取协作结果';
  if (node.status === 'version_incompatible') return '需要 OpenCode 2.x，当前版本不能执行或被委派';
  if (node.status === 'configuration_required') return '已安装，需先在设置中配置原生服务连接';
  if (node.status === 'needs_check') return '需要重新接入并检查原生 API';
  const execution = connectionCapability(node, 'execution');
  if (execution !== true) return execution === false ? '尚未支持执行' : '执行能力未知';
  const delegation = connectionCapability(node, 'delegation');
  const caller = connectionCapability(node, 'bridgeMcp');
  const callerLabel = caller === true ? '可调用 Bridge MCP' : caller === false ? '该产品未确认提供 MCP 客户端' : 'MCP 调用能力未确认';
  return (delegation === true ? '可被委派' : delegation === false ? '暂不能被委派' : '委派能力未知')
    + ' · ' + callerLabel;
}
