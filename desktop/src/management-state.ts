import {useEffect,useRef,useState} from 'react';
import type {GraphRecovery,RecoveryRow,RecoveryReceipt} from './management-recovery';
import {matchingReceipt,mergeRecoveryRows,managementRowBlocks,redactedOperation} from './management-recovery';
export interface ManagementIntent {operationId:string;machineId?:string;connectionId?:string;nodeId?:string;action:string}
export const sameManagementMachine=(a:ManagementIntent,b:ManagementIntent)=>
 a.machineId&&b.machineId?a.machineId===b.machineId:a.connectionId&&b.connectionId?a.connectionId===b.connectionId:true;
const actionNames:Record<string,string>={attach:'接入',disconnect:'断开',remove:'移除',restore:'恢复',reconnect:'重连',updateSsh:'编辑连接',maintainDaemon:'后台维护'};
export function useManagementLane<T extends ManagementIntent>(directory:string,prefix:string,lane:'node'|'machine',_queryMethod:string,valid:(intent:T)=>boolean,rejected:Set<string>,dispatch:(intent:T)=>Promise<RecoveryReceipt>,notify:(message:string)=>void,refresh:()=>Promise<void>,recovery:GraphRecovery){
 const key=prefix+directory,currentKey=useRef(key);currentKey.current=key;
 const [items,setItems]=useState<T[]>([]),[workingItems,setWorkingItems]=useState<T[]>([]),[storageError,setStorageError]=useState(false);const jobs=useRef<T[]>([]);
 const read=():T[]=>{const value=JSON.parse(localStorage.getItem(key)||'[]');const rows=Array.isArray(value)?value:value?[value]:[];if(!rows.every(row=>valid(row)&&typeof row.operationId==='string'&&!!row.operationId))throw Error('invalid');return rows;};
 const write=(rows:T[])=>{if(rows.length)localStorage.setItem(key,JSON.stringify(rows));else localStorage.removeItem(key);if(currentKey.current===key){setItems(old=>JSON.stringify(old)===JSON.stringify(rows)?old:rows);setStorageError(false);}};
 const asRow=(intent:T):RecoveryRow=>({lane,operationId:intent.operationId,method:lane==='node'?'manageNode':'machine.'+intent.action,params:{...intent} as Record<string,unknown>,state:'unknown'});
 const settle=async(intent:T,receipt:RecoveryReceipt,fromDispatch=false)=>{
  if(!matchingReceipt(asRow(intent),receipt)||!['confirmed','rejected'].includes(receipt.state))return false;
  const rows=read(),saved=rows.find(row=>row.operationId===intent.operationId);if(!saved||JSON.stringify(saved)!==JSON.stringify(intent))return false;
  write(rows.filter(row=>row.operationId!==intent.operationId));if(currentKey.current===key){notify(receipt.state==='rejected'?(receipt.error?.message||'原'+(actionNames[intent.action]||'管理')+'操作已收到确定拒绝'+(fromDispatch?'。':'，未提供远端原因。')):(actionNames[intent.action]||'管理操作')+'已完成，原任务与历史保留。');await refresh();}return true;
 };
 const query=async(intent?:T,manual=true)=>{let rows:T[];try{rows=intent?[intent]:read();}catch{setStorageError(true);notify('本机管理台账无法读取，请保留原记录排查。');return;}const targets=manual?mergeRecoveryRows(recovery.rows.filter(row=>row.lane===lane),rows.map(asRow)):rows.map(asRow);return recovery.query(targets,manual,(row,receipt)=>{const saved=rows.find(i=>i.operationId===row.operationId);return saved?settle(saved,receipt):Promise.resolve(matchingReceipt(row,receipt));});};
 useEffect(()=>{
  if(!directory)return;try{const next=read();for(const row of recovery.rows.filter(row=>row.lane===lane)){
   const intent={...row.params,...(lane==='machine'?{action:row.method?.slice(8)}:{})} as T;
   if(intent.operationId===row.operationId&&valid(intent)&&!next.some(item=>item.operationId===intent.operationId))next.push(intent);
  }write(next);}catch{setStorageError(true);}
 },[directory,recovery.rows]);
 const observed=useRef({key,ids:new Set<string>()});if(observed.current.key!==key)observed.current={key,ids:new Set<string>()};
 useEffect(()=>{if(!items.length)return;
  for(const item of items){const known=observed.current.ids.has(item.operationId);observed.current.ids.add(item.operationId);if(!known&&!jobs.current.some(job=>job.operationId===item.operationId))void query(item,false);}
  const timer=setInterval(()=>void query(undefined,false),5000);return()=>clearInterval(timer);
 },[items.map(item=>item.operationId).join('|'),directory]);
 const currentRows=(saved:T[]=items)=>mergeRecoveryRows(recovery.rows,saved.map(asRow),jobs.current.map(asRow));
 const blockReason=(machineId?:string,connectionId?:string,nodeId?:string)=>{
  if(storageError||recovery.error)return '本机管理台账无法读取，请保留原记录排查。';if(!recovery.loaded)return '正在读取原管理台账。';
  const row=currentRows().find(row=>managementRowBlocks(row,{machineId,connectionId,nodeId}));
  return row?'原'+(row.lane==='relation'?'协作授权':row.lane==='machine'?'机器管理':'节点')+'操作待核对（'+redactedOperation(row.operationId)+'），请在设置中查询原操作。':'';
 };
 const run=async(intent:T)=>{
  let rows:T[];try{rows=read();}catch{setStorageError(true);notify('无法读取原管理台账，请保留本机数据排查。');return false;}
  if(blockReason(intent.machineId,intent.connectionId,intent.nodeId)||currentRows(rows).some(row=>managementRowBlocks(row,intent)))return false;
  try{write([...rows,intent]);}catch{notify('无法保存管理操作意图，请检查本机存储后重试。');return false;}
  jobs.current.push(intent);setWorkingItems([...jobs.current]);
  try{return await settle(intent,await dispatch(intent),true);}
  catch(e){const error=e as Error&{code?:string};if(rejected.has(error.code||'')){try{await settle(intent,{operationId:intent.operationId,state:'rejected',error},true);}catch{setStorageError(true);}}else{notify('管理操作回应尚未确认，只查询原操作。');void query(intent,false);}return false;}
  finally{jobs.current=jobs.current.filter(row=>row.operationId!==intent.operationId);if(currentKey.current===key)setWorkingItems([...jobs.current]);void recovery.reload();}
 };
 return {pending:items[0]||null,pendingItems:items,working:workingItems.length>0,workingItems,run,query,blockReason,storageError,asRow};
}
