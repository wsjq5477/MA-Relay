import type { AgentNode, ConnectionCapabilities } from './types';

const nativeAdapters = new Set(['claude', 'opencode', 'codex', 'hermes', 'pi', 'dsh']);
const legacyBridgeCallers = new Set(['claude', 'opencode', 'codex']);

// Match the reviewed registry's compatibility boundary. Product names, icons,
// online/available flags and arbitrary claims never establish an adapter.
export function connectionCapability(node: AgentNode | undefined, key: keyof ConnectionCapabilities): boolean | null {
  if (!node || !nativeAdapters.has(node.adapter)) return null;
  if (['execution', 'delegation', 'bridgeMcp'].includes(key) && node.executionSupported === false) return false;
  if(key==='delegation'){
    const execution=connectionCapability(node,'execution');
    if(execution!==true)return execution;
  }
  if (key === 'bridgeMcp' && (!legacyBridgeCallers.has(node.adapter) || node.teamCollaboration === false)) return false;
  if (node.capabilitySource?.kind === 'unknown' || (node.capabilitySource?.adapterId && node.capabilitySource.adapterId !== node.adapter)) return null;
  if (node.connectionCapabilities !== undefined) {
    const value = node.connectionCapabilities[key];
    return typeof value === 'boolean' ? value : null;
  }
  // Older snapshots have no directional contract. Preserve only the reviewed
  // legacy operations; missing new control fields remain explicitly unknown.
  if (key === 'execution' || key === 'delegation') return node.executionSupported === true;
  if (key === 'bridgeMcp') return legacyBridgeCallers.has(node.adapter);
  return null;
}

export const canExecuteNode = (node?: AgentNode) => connectionCapability(node, 'execution') === true;
export const canReceiveDelegation = (node?: AgentNode) => canExecuteNode(node) && connectionCapability(node, 'delegation') === true;
export const canCallBridge = (node?: AgentNode) => canExecuteNode(node) && connectionCapability(node, 'bridgeMcp') === true;

export function bridgeCallerReason(node?: AgentNode) {
  if(!canExecuteNode(node))return '当前节点的执行能力未确认，暂不能设为主 Agent。';
  const direct=canReceiveDelegation(node)?'仍可直接会话或接收普通委派。':'仍可使用直接会话。';
  return connectionCapability(node, 'bridgeMcp') === false
    ? '当前工具不能调用 Bridge MCP，不能作为主 Agent；'+direct
    : 'Bridge 调用能力未知，暂不能设为主 Agent。';
}

export function connectionCapabilitySummary(node: AgentNode) {
  const execution = connectionCapability(node, 'execution');
  if (execution !== true) return execution === false ? '尚未支持执行' : '执行能力未知';
  const delegation = connectionCapability(node, 'delegation');
  const caller = connectionCapability(node, 'bridgeMcp');
  return (delegation === true ? '可被委派' : delegation === false ? '暂不能被委派' : '委派能力未知')
    + ' · ' + (caller === true ? '可调用 Bridge MCP' : caller === false ? '暂不能调用 Bridge MCP' : 'Bridge 调用能力未知');
}
