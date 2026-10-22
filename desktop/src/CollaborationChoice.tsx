import { bridgeCallerReason, canCallBridge, canHostManagedTask, connectionCapabilitySummary } from './connection-capabilities';
import type { AgentNode } from './types';

function managedNote(node?: AgentNode) {
  if (!canCallBridge(node)) return '';
  const managed = canHostManagedTask(node);
  if (managed === true) return '';
  // Managed-task injection is a separate dimension. Not having it must not be
  // presented as missing MCP support.
  return managed === false ? ' · 以独立 MCP 会话作为主 Agent，托管任务绑定未适配' : ' · 托管任务绑定未确认，不影响独立 MCP 调用';
}

export function PrimaryAgentButton({node, current=false, disabled=false, className='btn', onSelect}: {
  node:AgentNode; current?:boolean; disabled?:boolean; className?:string; onSelect:()=>void;
}) {
  const supported = canCallBridge(node);
  return <button className={className} disabled={disabled || !node.connected || !supported}
    title={supported ? '允许此 Agent 调用 Bridge MCP，向已授权子节点委派' + managedNote(node) : bridgeCallerReason(node)}
    onClick={onSelect}>{current ? '当前主 Agent' : '设为主 Agent'}</button>;
}

export default function CollaborationChoice({node, isLeader, checked, onChange}: {
  node?: AgentNode; isLeader:boolean; checked:boolean; onChange:(value:boolean)=>void;
}) {
  const allowed = canCallBridge(node);
  return <div className="conversation-collaboration">
    {isLeader && <label className="network-checks"><input type="checkbox" checked={allowed && checked} disabled={!allowed} onChange={event=>onChange(event.target.checked)}/>允许主 Agent 使用已配置的子 Agent</label>}
    {node && <small>{connectionCapabilitySummary(node)}{managedNote(node)}</small>}
    {isLeader && !allowed && <p role="status">{bridgeCallerReason(node)} 已有主节点记录保留，可关闭协作后使用直接会话。</p>}
  </div>;
}
