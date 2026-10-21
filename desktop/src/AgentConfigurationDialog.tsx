import {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import AgentIcon from './AgentIcon';
import McpSettings from './McpSettings';
import DshSettings from './DshSettings';
import type {AgentNode, Machine} from './types';

export default function AgentConfigurationDialog({node, machine, unavailable = false, onClose}: {
  node: AgentNode;
  machine: Machine;
  unavailable?: boolean;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const closing = useRef({busy, onClose}); closing.current = {busy, onClose};
  useEffect(() => {
    const previous = document.activeElement as HTMLElement|null;
    closeButton.current?.focus();
    const keydown = (event:KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); if (!closing.current.busy) closing.current.onClose();}
      if (event.key !== 'Tab') return;
      const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]') || []).filter(element => element.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (!first) {event.preventDefault(); panel.current?.focus();}
      else if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    };
    document.addEventListener('keydown', keydown, true);
    return () => {document.removeEventListener('keydown', keydown, true); if (previous?.isConnected) previous.focus();};
  }, []);
  const disabled = unavailable || !node.online || !machine.online || !!node.removed || !!machine.removed;
  const mcp = ['claude', 'codex', 'opencode'].includes(node.adapter);
  const service = ['dsh-desktop', 'dsh-web'].includes(node.adapter);
  return <div className="modal-overlay" onClick={event => {if (event.target === event.currentTarget && !busy) onClose();}}>
    <section ref={panel} tabIndex={-1} className="modal agent-configuration" role="dialog" aria-modal="true" aria-labelledby="agent-configuration-title" aria-describedby="agent-configuration-source">
      <header className="modal-head">
        <div><h2 id="agent-configuration-title"><AgentIcon adapter={node.adapter}/>{node.name} 配置</h2><p id="agent-configuration-source">{machine.name} · {node.name}</p></div>
        <button ref={closeButton} className="icon-btn" aria-label="关闭 Agent 配置" disabled={busy} onClick={onClose}><X size={18}/></button>
      </header>
      <div className="modal-body">
        {disabled && <p className="workspace-inline-note" role="status">原机器或节点当前不可用。配置仅供查看，请恢复连接后修改。</p>}
        {mcp ? <McpSettings node={node} disabled={disabled} onBusyChange={setBusy}/>
          : service ? <DshSettings node={node} disabled={disabled} onBusyChange={setBusy}/>
          : <div className="agent-native-configuration"><h3>原生工具配置</h3><p>此入口沿用 {node.name} 自身的账号、模型和运行配置。请在原生工具中修改，完成后重新扫描本机器。</p><p>当前接入暂不支持添加 Bridge MCP。</p><details><summary>安装位置</summary><code>{node.executable}</code></details></div>}
      </div>
    </section>
  </div>;
}
