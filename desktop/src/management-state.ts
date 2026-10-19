import {useEffect,useRef,useState} from 'react';
import {call} from './api';
export interface ManagementIntent {operationId:string;machineId?:string;connectionId?:string;nodeId?:string;action:string}
type Receipt={operationId:string;state:string;error?:{message:string}};
export const sameManagementMachine=(a:ManagementIntent,b:ManagementIntent)=>
  a.machineId&&b.machineId?a.machineId===b.machineId:a.connectionId&&b.connectionId?a.connectionId===b.connectionId:true;
const actionNames:Record<string,string>={attach:'接入',disconnect:'断开',remove:'移除',restore:'恢复',reconnect:'重连',updateSsh:'编辑连接',maintainDaemon:'后台维护'};
export function useManagementLane<T extends ManagementIntent>(directory:string,prefix:string,lane:'node'|'machine',queryMethod:string,valid:(intent:T)=>boolean,rejected:Set<string>,dispatch:(intent:T)=>Promise<Receipt>,notify:(message:string)=>void,refresh:()=>Promise<void>){
 const key=prefix+directory,currentKey=useRef(key);currentKey.current=key;
 const [items,setItems]=useState<T[]>([]),[workingItems,setWorkingItems]=useState<T[]>([]),[authorityPending,setAuthorityPending]=useState(false),[storageError,setStorageError]=useState(false),[unscopedPending,setUnscopedPending]=useState(false);
 const jobs=useRef<T[]>([]);
 const read=():T[]=>{const value=JSON.parse(localStorage.getItem(key)||'[]');const rows=Array.isArray(value)?value:value?[value]:[];if(!rows.every(row=>valid(row)&&typeof row.operationId==='string'&&!!row.operationId))throw Error('管理台账无法读取，请保留本机数据排查。');return rows;};
 const write=(rows:T[])=>{if(rows.length)localStorage.setItem(key,JSON.stringify(rows));else localStorage.removeItem(key);if(currentKey.current===key){setItems(rows);setStorageError(false);}};
 const settle=async(intent:T,receipt:Receipt)=>{
  if(receipt.operationId!==intent.operationId||!['confirmed','rejected'].includes(receipt.state))return false;
  const rows=read(),saved=rows.find(row=>row.operationId===intent.operationId);
  if(!saved||JSON.stringify(saved)!==JSON.stringify(intent))return false;
  write(rows.filter(row=>row.operationId!==intent.operationId));
  if(currentKey.current===key){notify(receipt.state==='rejected'?receipt.error?.message||'原管理操作已拒绝。':(actionNames[intent.action]||'管理操作')+'已完成，原任务与历史保留。');await refresh();}return true;
 };
 const query=async(intent?:T)=>{let rows:T[];try{rows=intent?[intent]:read();}catch{setStorageError(true);return;}await Promise.all(rows.map(async row=>{try{await settle(row,await call<Receipt>(queryMethod,{operationId:row.operationId}));}catch{/* Only matching original terminal receipts can settle. */}}));};
 useEffect(()=>{
  if(!directory)return;let done=false;try{setItems(read());setStorageError(false);}catch{setStorageError(true);}
  const observe=async()=>{try{
   const rows=await call<{lane:string;method?:string;operationId:string;params:T}[]>('graphPending');if(done||currentKey.current!==key)return;
   setAuthorityPending(rows.some(row=>row.lane==='relation'));
   setUnscopedPending(rows.some(row=>['node','machine'].includes(row.lane)&&!row.params?.machineId&&!row.params?.connectionId));
   const next=read();for(const row of rows.filter(row=>row.lane===lane)){
    const intent={...row.params,...(lane==='machine'?{action:row.method?.slice(8)}:{})} as T;
    if(intent.operationId===row.operationId&&valid(intent)&&!next.some(item=>item.operationId===intent.operationId))next.push(intent);
   }
   write(next);
  }catch{/* A failed read cannot erase originals or prove non-dispatch. */}};
  void observe();const timer=setInterval(()=>void observe(),5000);return()=>{done=true;clearInterval(timer);};
 },[directory]);
 useEffect(()=>{if(!items.length)return;void query();const timer=setInterval(()=>void query(),5000);return()=>clearInterval(timer);},[items.map(item=>item.operationId).join('|'),directory]);
 const blockReason=(machineId?:string,connectionId?:string)=>{
  if(storageError)return '本机管理台账无法读取，请保留原记录排查。';
  if(unscopedPending)return '原管理操作缺少机器来源，请查询原操作。';
  if(authorityPending)return '原协作授权操作待核对，请查询原授权操作。';
  const row=[...items,...workingItems].find(item=>sameManagementMachine(item,{operationId:'',action:'',machineId,connectionId}));
  return row?(lane==='node'?'节点':'机器')+'操作“'+(actionNames[row.action]||'管理')+'”待核对（原操作 '+row.operationId.slice(0,12)+'）。':'';
 };
 const run=async(intent:T)=>{
  let rows:T[];try{rows=read();}catch{setStorageError(true);notify('无法读取原管理台账，请保留本机数据排查。');return false;}
  if(unscopedPending||authorityPending||[...rows,...jobs.current].some(row=>sameManagementMachine(row,intent)))return false;
  try{write([...rows,intent]);}catch{notify('无法保存管理操作意图，请检查本机存储后重试。');return false;}
  jobs.current.push(intent);setWorkingItems([...jobs.current]);
  try{return await settle(intent,await dispatch(intent));}
  catch(e){const error=e as Error&{code?:string};if(rejected.has(error.code||'')){try{await settle(intent,{operationId:intent.operationId,state:'rejected',error});}catch{setStorageError(true);}}else{notify('管理操作回应尚未确认，只查询原操作。');void query(intent);}return false;}
  finally{jobs.current=jobs.current.filter(row=>row.operationId!==intent.operationId);if(currentKey.current===key)setWorkingItems([...jobs.current]);}
 };
 return {pending:items[0]||null,pendingItems:items,working:workingItems.length>0,workingItems,run,query,blockReason};
}
