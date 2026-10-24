import {useEffect,useRef,useState} from 'react';
import {call} from './api';
import {canCallBridge,canReceiveDelegation} from './connection-capabilities';
import type {AgentNode} from './types';
type PolicyRow={relationId:string;enabled:boolean;leaderId:string|null;memberIds:string[];revision:number;envelope:{version:1;revision:number;allowedNodeIds:string[]}};
type Operation={operationId:string;action:string;nodeId:string;leaderId:string;state:string;approvalId?:string;callerKind:string;createdAt:string;error?:{message:string}};
type View={schema:1;activeRelationId:string;relations:PolicyRow[];pending:Operation[];audit:Operation[]};
type Intent={method:string;operationId:string;fingerprint:string;params:Record<string,unknown>};
type Receipt={operationId:string;fingerprint?:string;state:string;error?:{message:string}};
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>[key,canonical(v)])):value;
async function fingerprint(value:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value)))))).map(v=>v.toString(16).padStart(2,'0')).join('');}
export default function ConnectionPolicyPanel({directory,nodes,machineName,online,onClose}:{directory:string;nodes:AgentNode[];machineName:(id:string)=>string;online:boolean;onClose:()=>void}){
  const key='agentbridge.connection-policy.'+directory;
  const [view,setView]=useState<View|null>(null),[message,setMessage]=useState(''),[working,setWorking]=useState(false);
  const flight=useRef(false);
  const [invalid,setInvalid]=useState(false),[pending,setPending]=useState<Intent|null>(()=>{
    try{const raw=localStorage.getItem(key);if(!raw)return null;const row=JSON.parse(raw);if(!['saveConnectionPolicy','decideConnection'].includes(row.method)||typeof row.operationId!=='string'||typeof row.fingerprint!=='string'||!row.params||row.params.operationId!==row.operationId)throw Error('invalid');return row;}catch{return {method:'invalid',operationId:'',fingerprint:'',params:{}};}
  });
  const [draft,setDraft]=useState<{leaderId:string;relationId:string;expectedRevision:number;expectedPolicyRevision:number;allowedNodeIds:string[]}|null>(null);
  const label=(n:AgentNode)=>machineName(n.machineId)+' / '+n.name;
  const name=(id:string)=>{const node=nodes.find(n=>n.nodeId===id);return node?label(node):'原节点（当前不可用）';};
  const refresh=async()=>{try{setView(await call<View>('connectionPolicies'));}catch(error){setMessage((error as Error).message);}};
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),4000);return()=>clearInterval(timer);},[directory]);
  useEffect(()=>{if(pending?.method==='invalid')setInvalid(true);},[pending]);
  const select=(leaderId:string)=>{
    if(!view||!leaderId)return;
    const row=view.relations.find(r=>r.leaderId===leaderId)||view.relations.find(r=>r.leaderId===null&&r.relationId===view.activeRelationId);
    setDraft({leaderId,relationId:row?.relationId||crypto.randomUUID(),expectedRevision:row?.revision||0,expectedPolicyRevision:row?.envelope.revision||0,allowedNodeIds:row?.leaderId===leaderId?[...row.envelope.allowedNodeIds]:[]});
  };
  async function settle(result:Receipt,intent:Intent){
    if(result.operationId!==intent.operationId||result.fingerprint!==intent.fingerprint||!['confirmed','rejected'].includes(result.state)){setMessage('原策略操作回应尚未确认，只能查询原操作。');return;}
    try{localStorage.removeItem(key);}catch{setMessage('原结果已读取，但本机意图尚不能清理；保留原ID继续核对。');return;}
    setPending(null);setMessage(result.state==='confirmed'?'授权操作已确认；未执行任何任务。':result.error?.message||'原操作已拒绝，未新增授权。');await refresh();setDraft(null);
  }
  async function write(method:string,params:Record<string,unknown>){
    if(flight.current||working||pending||invalid||!online)return;flight.current=true;setWorking(true);
    try{
      const operationId=crypto.randomUUID(),input={...params,operationId};
      const intent={method,operationId,params:input,fingerprint:await fingerprint({method,params:input})};
      try{if(localStorage.getItem(key)){setMessage('已有原策略意图待核对，请关闭后重新打开本页查询原操作。');return;}localStorage.setItem(key,JSON.stringify(intent));}catch{setMessage('操作未发送：无法保存原策略意图，请检查本机存储。');return;}
      setPending(intent);try{await settle(await call<Receipt>(method,input),intent);}catch(error){setMessage((error as Error).message+'；原ID已保留，请查询原操作。');}
    }catch(error){setMessage((error as Error).message);}finally{flight.current=false;setWorking(false);}
  }
  async function query(){
    if(!pending||invalid||working)return;setWorking(true);
    try{await settle(await call<Receipt>('connectionPolicyOperation',{operationId:pending.operationId}),pending);}catch(error){setMessage((error as Error).message+'；原ID继续保留。');}finally{setWorking(false);}
  }
  const locked=working||!!pending||invalid||!online||!view;
  const candidates=nodes.filter(n=>n.connected&&!n.removed&&!n.supersededBy&&n.nodeId!==draft?.leaderId&&canReceiveDelegation(n));
  return <div className="compose-overlay"><section className="compose-dialog" role="dialog" aria-modal="true" aria-label="连接策略与确认" style={{width:'min(900px,94vw)',maxHeight:'90vh',overflow:'auto'}}>
    <header className="compose-head"><h2>连接策略与确认</h2><button className="text-btn" onClick={onClose}>关闭</button></header>
    <p>在这里预授权可连接范围。Agent 在范围内自行连接或断开，范围外请求须由你明确允许。允许连接只改变授权，不会启动任务。</p>
    {message&&<p role="status">{message}</p>}
    {invalid&&<p role="alert">本机原策略意图无法读取，记录已保留；不能通过新ID重发。</p>}
    {pending&&!invalid&&<div role="alert"><p>原策略操作回应待核对：<code>{pending.operationId}</code></p><button className="btn" disabled={working||!online} onClick={()=>void query()}>查询原策略操作</button></div>}
    <button className="text-btn" disabled={working} onClick={()=>void refresh()}>刷新策略与请求</button>
    {view&&<>
      <h3>预授权范围</h3>
      <label>主 Agent <select aria-label="策略所属主 Agent" disabled={locked} value={draft?.leaderId||''} onChange={e=>select(e.target.value)}><option value="">选择主 Agent</option>{nodes.filter(n=>n.connected&&!n.removed&&!n.supersededBy&&canCallBridge(n)).map(n=><option key={n.nodeId} value={n.nodeId}>{label(n)}</option>)}</select></label>
      {draft&&<><p>保存会收回范围外的当前连接；原任务、原请求和结果归属保留。已配置策略修订 {draft.expectedPolicyRevision}。</p>
        <div className="network-checks">{candidates.map(n=><label key={n.nodeId}><input type="checkbox" aria-label={'预授权 '+label(n)} disabled={locked} checked={draft.allowedNodeIds.includes(n.nodeId)} onChange={e=>setDraft({...draft,allowedNodeIds:e.target.checked?[...draft.allowedNodeIds,n.nodeId]:draft.allowedNodeIds.filter(id=>id!==n.nodeId)})}/>{label(n)}</label>)}</div>
        <button className="btn primary" disabled={locked} onClick={()=>void write('saveConnectionPolicy',draft)}>保存预授权范围</button> <button className="text-btn" disabled={locked} onClick={()=>select(draft.leaderId)}>重新核对当前修订</button>
      </>}
      <h3>各主当前连接</h3>{view.relations.filter(r=>r.enabled&&r.leaderId).map(r=><p key={r.relationId}><strong>{name(r.leaderId!)}</strong>：{r.memberIds.length?r.memberIds.map(name).join('、'):'尚未连接'} · 预授权 {r.envelope.allowedNodeIds.length} 项 · 修订 {r.revision}</p>)}
      <h3>待用户确认</h3>{!view.pending.length&&<p>当前没有待确认请求。</p>}
      {view.pending.map(op=>{const row=view.relations.find(r=>r.leaderId===op.leaderId);return <article key={op.approvalId} className="graph-warning"><strong>{name(op.leaderId)} → {name(op.nodeId)}</strong><span>请求范围外连接，当前未授予权限。</span><code>{op.operationId}</code><button className="btn" disabled={locked||!row} onClick={()=>void write('decideConnection',{approvalId:op.approvalId,decision:'allow',expectedPolicyRevision:row?.envelope.revision||0})}>允许此连接</button><button className="btn" disabled={locked} onClick={()=>void write('decideConnection',{approvalId:op.approvalId,decision:'reject',expectedPolicyRevision:row?.envelope.revision||0})}>拒绝此请求</button></article>;})}
      <h3>最近授权操作</h3>{view.audit.slice(0,20).map(op=><p key={op.operationId+op.leaderId+op.createdAt}>{name(op.leaderId)} → {name(op.nodeId)} · {op.action==='connect'?'连接':'断开'} · {op.state==='pending_approval'?'待用户确认':op.state==='confirmed'?'原授权操作已确认':'未授予连接'} · <code>{op.operationId}</code></p>)}
    </>}
  </section></div>;
}
