import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {call} from './api';
import {sshTransferSize} from './AddMachineDialog';
import type {Machine} from './types';
type Preview={daemonVersion:string;targetVersion:string;rollbackVersion?:string;previewId:string;installPath:string;stateDirectory:string;replacementRequired?:boolean};
export interface BlockerTask{taskId?:string;requestId?:string;executionId?:string;conversationId?:string;status?:string;adapter?:string;agentId?:string;nodeId?:string;busy?:boolean;currentTask?:BlockerTask}
export interface BlockerReceipt{key:string;op:string;state:string;updatedAt?:string}
export interface MaintenanceBlockers{available:boolean;reason?:string;code?:string;tasks?:BlockerTask[];agents?:BlockerTask[];receipts?:BlockerReceipt[];receiptsSupported?:boolean}
export interface BlockedOperationResult{state:string;detail?:Record<string,unknown>}
export interface MaintenanceGateDetails{gate?:string;tasks?:BlockerTask[];agents?:BlockerTask[];receipts?:BlockerReceipt[]}
type Props={machine:Machine;pending:boolean;onClose:()=>void;run:(config:Record<string,unknown>)=>Promise<boolean>;poll?:()=>void|Promise<void>;blockers?:()=>Promise<MaintenanceBlockers>;queryBlocked?:(key:string,op:string)=>Promise<BlockedOperationResult>};
const phaseNames:Record<string,string>={uploading:'正在上传',extracting:'正在解包',verifying:'正在校验'};
const gateText=(details:MaintenanceGateDetails)=>details.gate==='receipts'?`未确认收据 ${(details.receipts||[]).length} 条`:`运行、等待或未知任务 ${(details.tasks||[]).length} 项、Agent ${(details.agents||[]).length} 项`;
const terminalText=(machine:Machine)=>{
 const maintenance=machine.daemonMaintenance;if(!maintenance||!['confirmed','rejected'].includes(maintenance.state))return '';
 return maintenance.state==='confirmed'?'后台维护已完成，远端已切换。':maintenance.error?.message||'后台维护未执行；原版本与历史保留。';
};
export default function DaemonDialog({machine,pending,onClose,run,poll,blockers,queryBlocked}:Props){
 const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(''),[action,setAction]=useState(''),[working,setWorking]=useState(false);
 const [confirmReplacement,setConfirmReplacement]=useState(false);
 useEffect(()=>{let alive=true;void call<Preview>('machine.daemonPreview',{connectionId:machine.connectionId}).then(p=>{if(alive)setPreview(p);},e=>{if(alive)setError(e.message);});return(()=>{alive=false;});},[machine.connectionId]);
 // Bounded auto-query while the original receipt stays unconfirmed: 1s/2s/4s/8s backoff, one call in flight,
 // cleared on unmount or as soon as the original operation is settled. The original operationId is never replaced.
 const pollRef=useRef(poll);pollRef.current=poll;const pollable=!!poll;
 useEffect(()=>{
  if(!pending||!pollable)return;
  let alive=true,inFlight=false,delay=1000;let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{timer=setTimeout(()=>void tick(),delay);};
  const tick=async()=>{
   if(!alive||inFlight)return;inFlight=true;
   try{await pollRef.current?.();}catch{/* 查询失败保留原 unknown，按退避继续核对原操作。 */}
   finally{inFlight=false;if(alive){delay=Math.min(delay*2,8000);schedule();}}
  };
  schedule();
  return(()=>{alive=false;if(timer!==undefined)clearTimeout(timer);});
 },[pending,pollable]);
 // Read-only gate projection: opened with the dialog and refreshed after every
 // single original-ID query. The dialog stays usable when the backend cannot answer.
 const blockersRef=useRef(blockers);blockersRef.current=blockers;const blockersReady=!!blockers;
 const [gate,setGate]=useState<MaintenanceBlockers|null>(null),[gateError,setGateError]=useState(''),[reloadToken,setReloadToken]=useState(0),[queryingKey,setQueryingKey]=useState(''),[queryResults,setQueryResults]=useState<Record<string,string>>({}),[allowUnresolved,setAllowUnresolved]=useState(false);
 useEffect(()=>{
  if(!blockersReady)return;let alive=true;
  void Promise.resolve().then(()=>blockersRef.current?.()).then(value=>{if(alive){setGate(value??null);setGateError('');}},reason=>{if(alive){setGate(null);setGateError((reason as Error)?.message||'未知原因');}});
  return(()=>{alive=false;});
 },[machine.connectionId,blockersReady,reloadToken]);
 async function queryOne(receipt:BlockerReceipt){
  if(!queryBlocked||queryingKey)return;setQueryingKey(receipt.key);
  try{const result=await queryBlocked(receipt.key,receipt.op);setQueryResults(old=>({...old,[receipt.key]:result.state==='confirmed'?'已核对到确定收据，原 unknown 可结算。':result.state==='rejected'?'已核对到确定拒绝收据，原 unknown 可结算。':'仍未确认（原 unknown 保留），不会重发或更换 ID。'}));}
  catch(reason){const failure=reason as Error;setQueryResults(old=>({...old,[receipt.key]:'查询失败（'+(failure.message||'未知原因')+'）；原记录保留，不会重发或更换 ID。'}));}
  finally{setQueryingKey('');setReloadToken(value=>value+1);}
 }
 async function confirm(){if(!preview||!action||action==='replace'&&!confirmReplacement)return;setWorking(true);try{const ok=await run({action,previewId:preview.previewId,expectedVersion:preview.daemonVersion,...(['upgrade','rollback','replace'].includes(action)?{targetVersion:action==='rollback'?preview.rollbackVersion:preview.targetVersion}:{}),...(action==='replace'?{confirmReplacement:true}:{})});if(ok)onClose();}finally{setWorking(false);}}
 async function overrideUpgrade(){if(!preview||!allowUnresolved)return;setWorking(true);try{const ok=await run({action:'upgrade',previewId:preview.previewId,expectedVersion:preview.daemonVersion,targetVersion:preview.targetVersion,allowUnresolved:true});if(ok)onClose();}finally{setWorking(false);}}
 const progress=machine.installProgress,percent=progress?Math.min(100,Math.round(progress.completedBytes/Math.max(1,progress.totalBytes)*100)):0,terminal=terminalText(machine);
 // types.ts is outside this change's write scope: read `details` structurally and ask
 // the Lead to add `details?:MaintenanceGateDetails` to Machine['daemonMaintenance'].
 const gateDetails=(machine.daemonMaintenance?.error as unknown as {details?:MaintenanceGateDetails}|undefined)?.details;
 const blockedTasks=gate?.available?gate.tasks||[]:[],blockedAgents=gate?.available?gate.agents||[]:[],blockedReceipts=gate?.available?gate.receipts||[]:[],workBlocked=blockedTasks.length+blockedAgents.length>0;
 // `上次维护结果` is durable history; the live blockers are a separate read. Two cases
 // must read as neutral records instead of a fresh alert:
 //  - the actual version already equals this program, so there is no upgrade target, and
 //  - the receipt carries a gate refusal (DAEMON_BUSY): the admission check runs before the
 //    backend is ever stopped, so nothing was stopped, switched or rolled back.
 // Only a real switch/verification failure (stop timeout, health check, ownership) stays red.
 const historyCode=machine.daemonMaintenance?.error?.code,gateRefusal=historyCode==='DAEMON_BUSY';
 const upToDate=!!preview&&preview.daemonVersion===preview.targetVersion,historyAlert=machine.daemonMaintenance?.state==='rejected'&&!upToDate&&!gateRefusal;
 const canOverride=!!preview&&!preview.replacementRequired&&!upToDate&&!pending&&!working&&!workBlocked&&blockedReceipts.length>0;
 return <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-label="后台维护"><div className="modal-head"><h2>后台维护 · {machine.name}</h2><button className="icon-btn" aria-label="关闭后台维护" disabled={working} onClick={onClose}><X size={18}/></button></div><div className="modal-body">
 {error&&<p role="alert">{error}</p>}{!preview&&!error&&<p>正在核对实际后台版本与可信安装…</p>}
 {progress&&<div className="ssh-upload"><div className="ssh-progress" role="progressbar" aria-label="后台维护进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{width:percent+'%'}}/></div><p>{phaseNames[progress.phase]||'正在上传'} {sshTransferSize(progress.completedBytes)} / {sshTransferSize(progress.totalBytes)}</p></div>}
 {machine.progressWarning&&<p className="ssh-note" role="status">提示：{machine.progressWarning.message}上传仍在继续，不影响后续核对。</p>}
 {terminal&&<section className="ssh-note" aria-label="上次维护结果" role={historyAlert?'alert':'status'}><p>上次维护结果：{terminal}</p>{upToDate&&<p>当前实际版本 {preview?.daemonVersion} 已与本程序版本一致，无需升级；以上只是历史记录，不代表当前失败。</p>}{!upToDate&&gateRefusal&&<p>这是上一次维护留下的结果：远端门禁在停止后台之前就拒绝了这次维护，后台没有被停止、版本也没有变化，不代表现在又失败了；实时阻塞项见下一节。</p>}{gateDetails&&<p>远端门禁原话：{terminal}（{gateText(gateDetails)}）</p>}</section>}
 {(blockedTasks.length>0||blockedAgents.length>0||blockedReceipts.length>0)&&<section className="ssh-note" aria-label="维护前置门禁"><p>当前阻塞项（实时只读）：以下原操作仍在运行或尚未确认，维护不会越过它们。</p>
 {blockedTasks.map((task,index)=><p key={'task-'+index}>任务：{task.status||'状态未知'}{task.taskId?' · '+task.taskId:''}{task.requestId?' · '+task.requestId:''}{task.adapter?' · '+task.adapter:''}</p>)}
 {blockedAgents.map((agent,index)=><p key={'agent-'+index}>Agent：{agent.busy?'正在工作':agent.currentTask?.status||'状态未知'}{agent.nodeId?' · '+agent.nodeId:''}{agent.agentId?' · '+agent.agentId:''}{agent.adapter?' · '+agent.adapter:''}{agent.currentTask?.taskId?' · '+agent.currentTask.taskId:''}</p>)}
 {blockedReceipts.map(receipt=><p key={receipt.key}>收据：{receipt.key} · {receipt.op} · {receipt.state}{receipt.updatedAt?' · '+receipt.updatedAt:''} <button className="btn" disabled={!queryBlocked||!!queryingKey||working} onClick={()=>void queryOne(receipt)}>按原 ID 查询</button>{queryResults[receipt.key]&&<span role="status"> {queryResults[receipt.key]}</span>}</p>)}
 </section>}
 {gate?.available&&gate.receiptsSupported===false&&<p className="ssh-note" role="status">该后台无收据端点，无法列出未确认收据；维护仍按任务/Agent 门禁执行。</p>}
 {gate&&!gate.available&&<p className="ssh-note" role="status">未能读取维护前置门禁：{gate.reason||'远端通道不可用'}。维护仍按远端门禁执行。</p>}
 {gateError&&<p className="ssh-note" role="status">维护前置门禁明细暂不可读（{gateError}）；维护仍按远端门禁执行。</p>}
 {canOverride&&<div className="ssh-note" role="group" aria-label="越过未确认收据"><label><input type="checkbox" checked={allowUnresolved} onChange={event=>setAllowUnresolved(event.target.checked)}/> 我已确认这些操作不会再运行（其原生会话已不存在）</label><p><button className="btn primary" disabled={!allowUnresolved||working||pending} onClick={()=>void overrideUpgrade()}>确认升级（保留未确认收据）</button></p></div>}
 {workBlocked&&<p className="inventory-machine-error">任务或 Agent 仍在运行、等待或未知，维护前置门禁不可越过。请先完成或按原 ID 核对这些操作。</p>}
 {preview&&<><p>实际版本：{preview.daemonVersion} · 本程序版本：{preview.targetVersion}</p><p>所有操作保留原机器身份、任务与会话历史，以及原生 Agent 的安装和配置。运行、等待、未知或未确认操作会阻止维护。</p>{preview.replacementRequired?<section className="ssh-note" aria-label="替换不受支持的后台"><p>该后台未列入兼容清单，无法直接连接。可以将它替换为本程序配套的后台；原版本目录、机器身份和任务历史保留。</p><p>替换会短暂中断连接。运行、等待、未知任务或未确认收据会阻止替换。若启动失败，保留原操作供查询，不自动运行未校验的旧版本。</p><button className="btn" disabled={working||pending||workBlocked||blockedReceipts.length>0} onClick={()=>{setAction('replace');setConfirmReplacement(false);}}>强制替换后台</button></section>:<div className="ssh-actions"><button className="btn" disabled={working||pending||preview.daemonVersion===preview.targetVersion} onClick={()=>setAction('upgrade')}>升级后台</button><button className="btn" disabled={working||pending||!preview.rollbackVersion} onClick={()=>setAction('rollback')}>回滚到 {preview.rollbackVersion||'无可用旧版本'}</button><button className="btn" disabled={working||pending} onClick={()=>setAction('stop')}>停止后台</button><button className="btn" disabled={working||pending} onClick={()=>setAction('uninstall')}>卸载 Bridge 后台</button></div>}
 {action&&<div role="status"><p>{action==='replace'?'将替换为 '+preview.targetVersion+'，不会直接连接或自动回滚到当前未校验版本。':action==='upgrade'?'新包通过校验后才切换；启动或健康检查失败会回到原版本。':action==='rollback'?'切换回已校验的原版本；不迁移或重发任务。':action==='stop'?'停止这份机器后台并暂停自动重连；稍后可重新连接启动。':'仅移除本 profile 的已核对 Bridge 安装；保留历史，撤销相关协作授权。'}</p><>{action==='replace'&&<p><label className="daemon-replacement-confirm"><input type="checkbox" checked={confirmReplacement} onChange={event=>setConfirmReplacement(event.target.checked)}/> 我确认将远端后台替换为本程序配套版本</label></p>}</><button className="btn" disabled={working} onClick={()=>{setAction('');setConfirmReplacement(false);}}>返回</button> <button className="btn primary" disabled={working||pending||action==='replace'&&(!confirmReplacement||workBlocked||blockedReceipts.length>0)} onClick={()=>void confirm()}>确认{action==='replace'?'替换':action==='upgrade'?'升级':action==='rollback'?'回滚':action==='stop'?'停止':'卸载'}</button></div>}</>}
 {pending&&<p role="status">已发送维护指令，等待远端切换（原操作已保留，不会重做）。关闭此窗口不会重做维护；也可以稍后在机器页面查询原操作。</p>}
 {!pending&&machine.daemonMaintenance?.state==='unknown'&&<p role="status">远端正在报告后台切换中；原操作与历史保留，完成后显示核对结果。</p>}
 </div></section></div>;
}
