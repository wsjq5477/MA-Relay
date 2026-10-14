import {useEffect,useState} from 'react';
import {call} from './api';
export type MachineAction='updateSsh'|'disconnect'|'remove'|'restore'|'reconnect'|'maintainDaemon';
type Intent={operationId:string;connectionId:string;machineId?:string;expectedRevision:number;action:MachineAction;config?:Record<string,unknown>};
type Receipt={operationId:string;state:string;error?:{message:string}};
const rejected=new Set(['INVALID_INPUT','NODE_NOT_FOUND','AGENT_BUSY','MACHINE_OFFLINE','WRONG_MACHINE','AGENT_UNAVAILABLE','DISCOVERY_CHANGED','OPERATION_LIMIT','OPERATION_CONFLICT','GRAPH_UNCONFIRMED','DESKTOP_UNCONFIRMED','GRAPH_INTENT_FAILED','DAEMON_STAGE_REJECTED','MACHINE_BUSY','MACHINE_REMOVED','SSH_USER_CHANGE','SSH_ENDPOINT_CONFLICT','SSH_CONNECTION_NOT_FOUND','REVISION_CONFLICT','INSTALL_PREVIEW_CHANGED','DAEMON_BUSY']);
export function useMachineManagement(directory:string,notify:(text:string)=>void,refresh:()=>Promise<void>){
  const key='agentbridge-machine-operation:'+directory;
  const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'null') as Intent|null;}catch{return null;}};
  const [pending,setPending]=useState<Intent|null>(null),[working,setWorking]=useState(false);
  const settle=async(intent:Intent,receipt:Receipt)=>{
    if(read()?.operationId!==intent.operationId)return false;
    if(receipt.operationId!==intent.operationId||!['confirmed','rejected'].includes(receipt.state))return false;
    localStorage.removeItem(key);setPending(null);
    notify(receipt.state==='rejected'?receipt.error?.message||'机器操作已拒绝。':intent.action==='maintainDaemon'?'后台维护已完成，请查看实际版本与连接状态。':intent.action==='updateSsh'?'连接配置已保存，请测试并重新连接。':intent.action==='reconnect'?'已开始恢复原连接，请查看机器状态。':intent.action==='restore'?'原机器已恢复，请重新连接。':intent.action==='disconnect'?'机器已断开，历史保留。':'机器已移除，历史保留，可在设置中恢复。');
    await refresh();return true;
  };
  const query=async(intent=pending)=>{if(!intent)return;try{await settle(intent,await call<Receipt>('machine.operation',{operationId:intent.operationId}));}catch{/* Query only; absence never proves a mutation failed. */}};
  useEffect(()=>{if(!directory)return;setPending(read());},[directory]);
  useEffect(()=>{
    if(!directory)return;let done=false;
    const observe=async()=>{try{
      const rows=await call<{lane:string;operationId:string;params:Intent;method?:string}[]>('graphPending');
      const row=rows.find(r=>r.lane==='machine');
      if(done||!row||read())return;
      const intent={...row.params,action:row.method?.slice(8) as MachineAction};if(intent.operationId!==row.operationId||!['updateSsh','disconnect','remove','restore','reconnect','maintainDaemon'].includes(intent.action)||!intent.connectionId)return;
      localStorage.setItem(key,JSON.stringify(intent));setPending(intent);
    }catch{/* Unsupported legacy reads do not manufacture new operations. */}};
    void observe();const timer=setInterval(()=>void observe(),5000);return()=>{done=true;clearInterval(timer);};
  },[directory]);
  useEffect(()=>{if(!pending)return;void query(pending);const timer=setInterval(()=>void query(pending),5000);return()=>clearInterval(timer);},[pending]);
  const run=async(connectionId:string,machineId:string|undefined,expectedRevision:number,action:MachineAction,config?:Record<string,unknown>)=>{
    if(working||pending||read())return false;
    const intent={operationId:crypto.randomUUID(),connectionId,machineId,expectedRevision,action,...(config?{config}:{})};
    try{localStorage.setItem(key,JSON.stringify(intent));}catch{notify('无法保存机器操作意图，请检查本机存储后重试。');return false;}
    setPending(intent);setWorking(true);
    try{return await settle(intent,await call<Receipt>('machine.'+action,{operationId:intent.operationId,connectionId,machineId,expectedRevision,...(config?{config}:{})}));}
    catch(e){const error=e as Error&{code?:string};if(rejected.has(error.code||'')){localStorage.removeItem(key);setPending(null);notify(error.message);}else{notify('机器操作回应尚未确认，正在查询原操作。');void query(intent);}return false;}
    finally{setWorking(false);}
  };
  return {pending,working,run,query};
}
