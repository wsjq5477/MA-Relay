import {useEffect,useState} from 'react';
import {call} from './api';
export type NodeAction='attach'|'disconnect'|'remove';
type Intent={operationId:string;nodeId:string;machineId:string;action:NodeAction};
type Receipt={operationId:string;state:string;error?:{message:string}};
const rejected=new Set(['INVALID_INPUT','NODE_NOT_FOUND','AGENT_BUSY','MACHINE_OFFLINE','WRONG_MACHINE','AGENT_UNAVAILABLE','DISCOVERY_CHANGED','OPERATION_LIMIT','OPERATION_CONFLICT','GRAPH_UNCONFIRMED','DESKTOP_UNCONFIRMED','GRAPH_INTENT_FAILED','DAEMON_STAGE_REJECTED']);
export function useNodeManagement(directory:string,notify:(text:string)=>void,refresh:()=>Promise<void>){
  const key='agentbridge-node-operation:'+directory;
  const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'null') as Intent|null;}catch{return null;}};
  const [pending,setPending]=useState<Intent|null>(null),[working,setWorking]=useState(false);
  const settle=async(intent:Intent,receipt:Receipt)=>{
    if(read()?.operationId!==intent.operationId)return false;
    if(receipt.operationId!==intent.operationId||!['confirmed','rejected'].includes(receipt.state))return false;
    localStorage.removeItem(key);setPending(null);
    notify(receipt.state==='rejected'?receipt.error?.message||'节点操作已拒绝。':intent.action==='attach'?'Agent 已接入。':intent.action==='disconnect'?'Agent 已断开，任务与会话记录保留。':'Agent 已从图中移除，历史保留，可在原机器重新添加。');
    await refresh();return true;
  };
  const query=async(intent=pending)=>{if(!intent)return;try{await settle(intent,await call<Receipt>('nodeOperation',{operationId:intent.operationId}));}catch{/* Query only; absence never proves a mutation failed. */}};
  useEffect(()=>{if(!directory)return;setPending(read());},[directory]);
  useEffect(()=>{
    if(!directory)return;let done=false;
    const observe=async()=>{try{
      const rows=await call<{lane:string;operationId:string;params:Intent}[]>('graphPending');
      const row=rows.find(r=>r.lane==='node');
      if(done||!row||read())return;
      const intent=row.params;if(intent.operationId!==row.operationId||!['attach','disconnect','remove'].includes(intent.action)||!intent.nodeId||!intent.machineId)return;
      localStorage.setItem(key,JSON.stringify(intent));setPending(intent);
    }catch{/* Unsupported legacy reads do not manufacture new operations. */}};
    void observe();const timer=setInterval(()=>void observe(),5000);return()=>{done=true;clearInterval(timer);};
  },[directory]);
  useEffect(()=>{if(!pending)return;void query(pending);const timer=setInterval(()=>void query(pending),5000);return()=>clearInterval(timer);},[pending]);
  const run=async(nodeId:string,machineId:string,action:NodeAction)=>{
    if(working||pending||read())return false;
    const intent={operationId:crypto.randomUUID(),nodeId,machineId,action};
    try{localStorage.setItem(key,JSON.stringify(intent));}catch{notify('无法保存节点操作意图，请检查本机存储后重试。');return false;}
    setPending(intent);setWorking(true);
    try{return await settle(intent,await call<Receipt>('manageNode',intent));}
    catch(e){const error=e as Error&{code?:string};if(rejected.has(error.code||'')){localStorage.removeItem(key);setPending(null);notify(error.message);}else{notify('节点操作回应尚未确认，正在查询原操作。');void query(intent);}return false;}
    finally{setWorking(false);}
  };
  return {pending,working,run,query};
}
