import {useEffect,useRef,useState} from 'react';
import {call} from './api';
import type {AgentNode,AgentInstance,Machine} from './types';
export type ManagementLane='node'|'machine'|'relation'|'layout';
export type RecoveryRow={lane:ManagementLane;operationId:string;method?:string;params:Record<string,unknown>;state:string;time?:string;error?:{code?:string};blockedNodeIds?:string[]};
export type RecoveryReceipt={operationId:string;state:string;data?:Record<string,unknown>;error?:{message?:string}};
export type QueryOutcome={state:string;at:string;message:string;code?:string};
export type QuerySummary={attempted:number;confirmed:number;rejected:number;unresolved:number;notFound:number;failed:number;at:string};
export const queryMethods:Record<ManagementLane,string>={node:'nodeOperation',machine:'machine.operation',relation:'collaborationOperation',layout:'graphLayoutOperation'};
export const laneNames:Record<ManagementLane,string>={node:'节点管理',machine:'机器管理',relation:'协作授权',layout:'布局'};
export const recoveryKey=(row:Pick<RecoveryRow,'lane'|'operationId'>)=>row.lane+':'+row.operationId;
export function redactedOperation(id:string){let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return '操作 #'+(h>>>0).toString(16).padStart(8,'0');}
export function mergeRecoveryRows(...groups:RecoveryRow[][]){const rows=new Map<string,RecoveryRow>();for(const group of groups)for(const row of group)if(!rows.has(recoveryKey(row)))rows.set(recoveryKey(row),row);return [...rows.values()];}
export const querySummaryText=(s:QuerySummary|null)=>s?`查询完成：尝试 ${s.attempted} 项，已确认 ${s.confirmed} 项、已拒绝 ${s.rejected} 项，仍待核对 ${s.unresolved} 项；未找到原收据 ${s.notFound} 项，查询失败 ${s.failed} 项。未确认、未找到或失败的原项继续保留。`:'';
const outcomeText:Record<string,string>={confirmed:'已核对确定收据。',rejected:'已核对确定拒绝收据。',unknown:'仍未确认，原 unknown 保留。',not_found:'未找到原收据，原 unknown 继续保留。',failed:'查询失败，原 unknown 继续保留；请稍后重查。',mismatch:'原收据身份不匹配，原 unknown 保留。'};
export function matchingReceipt(row:RecoveryRow,receipt:RecoveryReceipt){
 if(receipt?.operationId!==row.operationId)return false;
 const data=receipt.data||{},node=data.node as Record<string,unknown>|undefined;
 for(const key of ['machineId','connectionId','nodeId']){const actual=data[key]??node?.[key];if(actual!==undefined&&row.params[key]!==undefined&&actual!==row.params[key])return false;}
 return true;
}
const sourceMachine=(row:RecoveryRow,machines:Machine[])=>typeof row.params.machineId==='string'&&row.params.machineId.trim()?row.params.machineId:typeof row.params.connectionId==='string'&&row.params.connectionId.trim()?machines.find(m=>m.connectionId===row.params.connectionId)?.machineId:undefined;
const workspaceKey=(workspace:string,machineId:string,machines:Machine[])=>{
 if(machines.find(m=>m.machineId===machineId)?.kind==='ssh')return machineId+':'+workspace.replace(/\/+$/,'');
 const p=workspace.replaceAll('\\','/'),m=p.match(/^(?:([a-z]):\/|\/mnt\/([a-z])\/)(.*)$/i);return m?'drive:'+(m[1]||m[2])!.toLowerCase()+'/'+m[3]!.replace(/\/+$/,'').toLowerCase():machineId+':'+p.replace(/\/+$/,'');
};
export function managementRowBlocks(row:RecoveryRow,target:{machineId?:string;connectionId?:string;nodeId?:string}){
 if(row.lane==='layout')return false;if(row.lane==='relation')return true;
 const source=row.params,valid=(value:unknown)=>typeof value==='string'&&!!value.trim();
 const knownMachine=valid(source.machineId)&&valid(target.machineId),knownConnection=valid(source.connectionId)&&valid(target.connectionId);
 const same=knownMachine?source.machineId===target.machineId:knownConnection?source.connectionId===target.connectionId:true;
 if(!valid(source.machineId)&&!valid(source.connectionId)||!valid(target.machineId)&&!valid(target.connectionId))return true;
 if(row.lane==='node'&&valid(target.nodeId)&&valid(source.nodeId)&&Array.isArray(row.blockedNodeIds)&&row.blockedNodeIds.every(id=>valid(id))){
  if(same&&source.nodeId===target.nodeId)return true;
  return row.blockedNodeIds.includes(target.nodeId!);
 }
 return same;
}
export function executionRecoveryReason(rows:RecoveryRow[],machineId:string|undefined,nodeId:string|undefined,nodes:AgentNode[],machines:Machine[],instances:AgentInstance[]=[],workspace?:string){
 for(const row of rows){
  if(row.lane==='layout')continue;
  if(row.lane==='relation')return '原协作授权操作待核对。';
  const originalMachine=sourceMachine(row,machines);
  if(!originalMachine||!machines.some(m=>m.machineId===originalMachine)||!machineId)return '原管理操作缺少来源，继续保留执行保护。';
  if(row.lane==='machine'){if(originalMachine===machineId)return '原机器管理/维护操作待核对。';continue;}
  const original=nodes.find(n=>n.nodeId===row.params.nodeId&&n.machineId===originalMachine),target=nodes.find(n=>n.nodeId===nodeId&&n.machineId===machineId);
  if(!original||!target){if(originalMachine===machineId)return '原节点操作来源不完整，继续保留同机保护。';continue;}
  // A caller-selected folder must still be checked even when the backend supplied
  // the snapshot's default-node projection.
  const originalWork=instances.filter(i=>i.nodeId===original.nodeId&&i.workspace).map(i=>workspaceKey(i.workspace,i.machineId,machines));
  const targetWork=[...instances.filter(i=>i.nodeId===target.nodeId&&i.workspace).map(i=>workspaceKey(i.workspace,i.machineId,machines)),...(workspace?[workspaceKey(workspace,machineId,machines)]:[])];
  const projected=row.blockedNodeIds?.includes(nodeId||'');
  if(projected||original.nodeId===target.nodeId||original.machineId===target.machineId&&(original.adapter===target.adapter||original.executable===target.executable)||originalWork.some(w=>targetWork.includes(w)))return '原节点或共享执行资源操作待核对（'+redactedOperation(row.operationId)+'）。';
 }
 return '';
}
export function useGraphRecovery(directory:string){
 const [rows,setRows]=useState<RecoveryRow[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(false),[querying,setQuerying]=useState(false),[summary,setSummary]=useState<QuerySummary|null>(null),[outcomes,setOutcomes]=useState<Record<string,QueryOutcome>>({});
 const generation=useRef(0);const current=useRef(directory);current.current=directory;const readJob=useRef<Promise<void>|null>(null),manualJob=useRef<Promise<void>|null>(null);
 const reload=async()=>{if(!directory)return;if(readJob.current)return readJob.current;const ticket=generation.current;
  const job=(async()=>{try{const value=await call<RecoveryRow[]>('graphPending');if(current.current!==directory||generation.current!==ticket)return;if(!Array.isArray(value)||value.some(row=>!row||!Object.hasOwn(queryMethods,row.lane)||typeof row.operationId!=='string'||!row.operationId||!row.params||typeof row.params!=='object'||Array.isArray(row.params)))throw Error('invalid');setRows(old=>JSON.stringify(old)===JSON.stringify(value)?old:value);setLoaded(true);setError(false);}catch{if(current.current===directory&&generation.current===ticket)setError(true);}})();readJob.current=job;try{await job;}finally{if(readJob.current===job)readJob.current=null;}
 };
 useEffect(()=>{generation.current++;manualJob.current=null;setQuerying(false);setRows([]);setLoaded(false);setError(false);setSummary(null);setOutcomes({});readJob.current=null;void reload();const timer=setInterval(()=>void reload(),5000);return()=>clearInterval(timer);},[directory]);
 const query=async(targets:RecoveryRow[],manual=true,settle?:(row:RecoveryRow,receipt:RecoveryReceipt)=>Promise<boolean>)=>{
  if(manualJob.current)return manualJob.current;const ticket=generation.current;
  const job=(async()=>{
   if(manual)setQuerying(true);
   const counts:QuerySummary={attempted:targets.length,confirmed:0,rejected:0,unresolved:0,notFound:0,failed:0,at:new Date().toISOString()},result:Record<string,QueryOutcome>={};
   await Promise.all(targets.map(async row=>{
    let state='unknown',code:string|undefined;
    try{const receipt=await call<RecoveryReceipt>(queryMethods[row.lane],{operationId:row.operationId});
     if(!matchingReceipt(row,receipt))state='mismatch';
     else if(['confirmed','rejected'].includes(receipt.state)){const accepted=settle?await settle(row,receipt):true;state=accepted?receipt.state:'mismatch';}
     else state=receipt.state==='not_found'?'not_found':'unknown';
    }catch(e){state='failed';const value=(e as {code?:string}).code;code=value&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value)?value:'QUERY_FAILED';}
    if(state==='confirmed')counts.confirmed++;else if(state==='rejected')counts.rejected++;else{counts.unresolved++;if(state==='not_found')counts.notFound++;if(['failed','mismatch'].includes(state))counts.failed++;}
    result[recoveryKey(row)]={state,at:new Date().toISOString(),message:outcomeText[state]||outcomeText.unknown!,...(code?{code}:{})};
   }));
   if(current.current!==directory||generation.current!==ticket)return;
   if(manual){setSummary({...counts,at:new Date().toISOString()});setOutcomes(old=>({...old,...result}));}
   await reload();
  })();if(manual)manualJob.current=job;
  try{await job;}finally{if(manualJob.current===job){manualJob.current=null;if(current.current===directory)setQuerying(false);}}
 };
 return {rows,loaded,error,querying,summary,outcomes,reload,query};
}
export type GraphRecovery=ReturnType<typeof useGraphRecovery>;
