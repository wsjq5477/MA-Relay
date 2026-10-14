import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import {call} from './api';
import type {Machine} from './types';
type Preview={daemonVersion:string;targetVersion:string;rollbackVersion?:string;previewId:string;installPath:string;stateDirectory:string};
export default function DaemonDialog({machine,pending,onClose,run}:{machine:Machine;pending:boolean;onClose:()=>void;run:(config:Record<string,unknown>)=>Promise<boolean>}){
 const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(''),[action,setAction]=useState(''),[working,setWorking]=useState(false);
 useEffect(()=>{let alive=true;void call<Preview>('machine.daemonPreview',{connectionId:machine.connectionId}).then(p=>{if(alive)setPreview(p);},e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[machine.connectionId]);
 async function confirm(){if(!preview||!action)return;setWorking(true);try{const ok=await run({action,previewId:preview.previewId,expectedVersion:preview.daemonVersion,...(['upgrade','rollback'].includes(action)?{targetVersion:action==='upgrade'?preview.targetVersion:preview.rollbackVersion}:{})});if(ok)onClose();}finally{setWorking(false);}}
 return <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-label="后台维护"><div className="modal-head"><h2>后台维护 · {machine.name}</h2><button className="icon-btn" aria-label="关闭后台维护" disabled={working} onClick={onClose}><X size={18}/></button></div><div className="modal-body">
 {error&&<p role="alert">{error}</p>}{!preview&&!error&&<p>正在核对实际后台版本与可信安装…</p>}
 {preview&&<><p>实际版本：{preview.daemonVersion} · 本程序版本：{preview.targetVersion}</p><p>所有操作保留原机器身份、任务与会话历史，以及原生 Agent 的安装和配置。运行、等待、未知或未确认操作会阻止维护。</p><div className="ssh-actions"><button className="btn" disabled={working||pending||preview.daemonVersion===preview.targetVersion} onClick={()=>setAction('upgrade')}>升级后台</button><button className="btn" disabled={working||pending||!preview.rollbackVersion} onClick={()=>setAction('rollback')}>回滚到 {preview.rollbackVersion||'无可用旧版本'}</button><button className="btn" disabled={working||pending} onClick={()=>setAction('stop')}>停止后台</button><button className="btn" disabled={working||pending} onClick={()=>setAction('uninstall')}>卸载 Bridge 后台</button></div>
 {action&&<div role="status"><p>{action==='upgrade'?'新包通过校验后才切换；启动或健康检查失败会回到原版本。':action==='rollback'?'切换回已校验的原版本；不迁移或重发任务。':action==='stop'?'停止这份机器后台并暂停自动重连；稍后可重新连接启动。':'仅移除本 profile 的已核对 Bridge 安装；保留历史，撤销相关协作授权。'}</p><button className="btn" disabled={working} onClick={()=>setAction('')}>返回</button> <button className="btn primary" disabled={working||pending} onClick={()=>void confirm()}>确认{action==='upgrade'?'升级':action==='rollback'?'回滚':action==='stop'?'停止':'卸载'}</button></div>}</>}
 {pending&&<p>原维护回应尚未确认，请在机器页面查询原操作。关闭此窗口不会重做维护。</p>}
 </div></section></div>;
}
