import { bridgeCallerReason, canCallBridge, connectionCapabilitySummary } from './connection-capabilities';
import type { AgentNode } from './types';

export function PrimaryAgentButton({node, current=false, disabled=false, className='btn', onSelect}: {
  node:AgentNode; current?:boolean; disabled?:boolean; className?:string; onSelect:()=>void;
}) {
  const supported = canCallBridge(node);
  return <button className={className} disabled={disabled || !node.connected || !supported}
    title={supported ? '允许此 Agent 调用 Bridge 委派给已授权子节点' : bridgeCallerReason(node)}
    onClick={onSelect}>{current ? '当前主 Agent' : '设为主 Agent'}</button>;
}

export default function CollaborationChoice({node, isLeader, checked, onChange}: {
  node?: AgentNode; isLeader:boolean; checked:boolean; onChange:(value:boolean)=>void;
}) {
  const allowed = canCallBridge(node);
  return <div className="conversation-collaboration">
    {isLeader && <label className="network-checks"><input type="checkbox" checked={allowed && checked} disabled={!allowed} onChange={event=>onChange(event.target.checked)}/>允许主 Agent 使用已配置的子 Agent</label>}
    {node && <small>{connectionCapabilitySummary(node)}</small>}
    {isLeader && !allowed && <p role="status">{bridgeCallerReason(node)} 已有主节点记录保留，可关闭协作后使用直接会话。</p>}
  </div>;
}
