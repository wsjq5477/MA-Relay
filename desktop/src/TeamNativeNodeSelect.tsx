import { toolLabel } from './agent-tools';
import {canExecuteNode} from './connection-capabilities';
import type { AgentNode } from './types';

// Older Coordinators omit teamCollaboration. Only the original team adapters
// have that compatibility path; direct execution alone does not establish the
// ability to receive the scoped team tools.
const legacyTeamAdapters = new Set(['claude', 'opencode', 'codex']);
export function supportsNativeTeam(node: AgentNode) {
  return legacyTeamAdapters.has(node.adapter)
    && (node.teamCollaboration === undefined || node.teamCollaboration === true);
}
export function nativeTeamNodes(nodes: AgentNode[]) {
  return nodes.filter(n => n.connected && canExecuteNode(n) && !n.removed && !n.supersededBy && supportsNativeTeam(n));
}

export default function NativeTeamNodeSelect({ nodes }: { nodes: AgentNode[] }) {
  const current = nodes.filter(n => n.connected && canExecuteNode(n) && !n.removed && !n.supersededBy);
  const unsupported = [...new Set(current.filter(n => !supportsNativeTeam(n)).map(n => toolLabel(n.adapter)))];
  return <label>原生节点<select aria-label="原生节点" name="nodeId" required defaultValue=""><option value="" disabled>请选择节点</option>{nativeTeamNodes(nodes).map(n => <option key={n.nodeId} value={n.nodeId}>{n.name} · {toolLabel(n.adapter)}</option>)}</select>{unsupported.length > 0 && <small>{unsupported.join('、')} 尚不支持小队协作。请按“机器与 Agent”的能力说明使用直接会话或作为普通子节点接收委派。</small>}</label>;
}
