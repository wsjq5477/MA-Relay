import {useState} from 'react';
import {call} from './api';
import './relation-conflict.css';
type Inspection={conflict:boolean;blockedReason?:string;diagnostic?:{index:{revision:number;memberCount:number;enabled:boolean};collaboration:{revision:number;memberCount:number};receipts:Record<'relationOperations'|'nodeOperations'|'machineOperations',{confirmed:number;unresolved:number;recentConfirmed?:{revision:number|null;memberCount:number|null}[]}>};proposal?:{sourceDigest:string;revisionFrom:number;revisionTo:number;envelopeFrom:number;envelopeTo:number;leaderChanged:boolean;chain:{kind:string;revision:number;memberCount:number}[];members:{label:string;change:string}[]}};
export default function RelationConflictPanel({onRecovered}:{onRecovered:(message:string)=>void}){
  const [inspection,setInspection]=useState<Inspection|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
  const [operationId]=useState(()=>crypto.randomUUID());
  async function inspect(){setBusy(true);setError('');setConfirmed(false);try{setInspection(await call<Inspection>('relationRecovery.inspect'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function recover(){if(!inspection?.proposal||!confirmed)return;setBusy(true);setError('');try{const receipt=await call<{backup:string;backupDigest:string}>('relationRecovery.confirm',{operationId,sourceDigest:inspection.proposal.sourceDigest,confirm:true});setInspection(null);setConfirmed(false);setError('恢复已提交，原文件副本：'+receipt.backup+'；SHA-256：'+receipt.backupDigest);onRecovered('关系恢复已提交。原文件副本：'+receipt.backup+'；SHA-256：'+receipt.backupDigest);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const p=inspection?.proposal,d=inspection?.diagnostic;
  return <section aria-label="关系冲突检查" className="relation-conflict-panel">
    <button className="btn small" disabled={busy} onClick={()=>void inspect()}>{busy?'正在核对…':'检查关系冲突'}</button>
    {error&&<p role="status" style={{overflowWrap:'anywhere'}}>{error}</p>}
    {inspection&&!inspection.conflict&&<p>未发现关系视图冲突，请按连接错误提示排查。</p>}
    {d&&<><h2>关系视图不一致</h2><p>索引修订 {d.index.revision}，{d.index.memberCount} 个成员，{d.index.enabled?'已启用':'未启用'}；兼容视图修订 {d.collaboration.revision}，{d.collaboration.memberCount} 个成员。检查未改动原文件。</p>
      <p>已确认收据：关系 {d.receipts.relationOperations.confirmed}、节点 {d.receipts.nodeOperations.confirmed}、机器 {d.receipts.machineOperations.confirmed}。未决收据合计 {Object.values(d.receipts).reduce((n,r)=>n+r.unresolved,0)}。</p>{Object.entries(d.receipts).map(([kind,r])=><p key={kind}>{kind==='relationOperations'?'最近关系收据':kind==='nodeOperations'?'最近节点收据':'最近机器收据'}：{r.recentConfirmed?.map(row=>row.revision===null?'缺少关系修订':('修订 '+row.revision+' / '+row.memberCount+' 个成员')).join('；')||'无可投影记录'}</p>)}</>}
    {inspection?.blockedReason&&<p role="status">不能生成恢复提案：{inspection.blockedReason} 原文件保留，请人工核对；重新连接不会自动修复。</p>}
    {p&&<><h3>核对恢复提案</h3><p>关系修订 {p.revisionFrom} → {p.revisionTo}；预授权策略修订 {p.envelopeFrom} → {p.envelopeTo}。{p.leaderChanged?'主节点将变化。':'主节点保持。'}</p>
      <ol>{p.chain.map(r=><li key={r.revision}>修订 {r.revision}：{r.kind==='relationOperations'?'关系保存':'节点撤权'}，{r.memberCount} 个成员。</li>)}</ol>
      <ul>{p.members.map(m=><li key={m.label}>{m.label}：{m.change==='add'?'增加':m.change==='remove'?'移除':'保留'}</li>)}</ul>
      <p>成员使用本提案内的匿名编号。提交前会逐字节备份原文件；任务、请求与原收据保留。</p>
      <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>我已核对收据顺序与成员变化，确认恢复此提案</label>
      <p><button className="btn" disabled={busy||!confirmed} onClick={()=>void recover()}>备份并恢复关系</button> <button className="btn" disabled={busy} onClick={()=>{setInspection(null);setConfirmed(false);}}>取消提案</button></p></>}
  </section>;
}
