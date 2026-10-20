import {call} from './api';
import type {GraphRecovery} from './management-recovery';
import {useManagementLane} from './management-state';
export type MachineAction='updateSsh'|'disconnect'|'remove'|'restore'|'reconnect'|'maintainDaemon';
type Intent={operationId:string;connectionId:string;machineId?:string;expectedRevision:number;action:MachineAction;config?:Record<string,unknown>};
const rejected=new Set(['INVALID_INPUT','NODE_NOT_FOUND','AGENT_BUSY','MACHINE_OFFLINE','WRONG_MACHINE','AGENT_UNAVAILABLE','DISCOVERY_CHANGED','OPERATION_LIMIT','OPERATION_CONFLICT','GRAPH_UNCONFIRMED','DESKTOP_UNCONFIRMED','GRAPH_INTENT_FAILED','DAEMON_STAGE_REJECTED','SSH_UPLOAD_FAILED','DAEMON_PERSIST_FAILED','SSH_PACKAGE_CHECKSUM','SSH_PACKAGE_EXTRACT','MACHINE_BUSY','MACHINE_REMOVED','SSH_USER_CHANGE','SSH_ENDPOINT_CONFLICT','SSH_CONNECTION_NOT_FOUND','REVISION_CONFLICT','INSTALL_PREVIEW_CHANGED','DAEMON_BUSY']);
export function useMachineManagement(directory:string,notify:(text:string)=>void,refresh:()=>Promise<void>,recovery:GraphRecovery){
  const state=useManagementLane<Intent>(directory,'agentbridge-machine-operation:','machine','machine.operation',intent=>!!intent.connectionId&&['updateSsh','disconnect','remove','restore','reconnect','maintainDaemon'].includes(intent.action),rejected,intent=>call('machine.'+intent.action,{operationId:intent.operationId,connectionId:intent.connectionId,machineId:intent.machineId,expectedRevision:intent.expectedRevision,...(intent.config?{config:intent.config}:{})}),notify,refresh,recovery);
  return {...state,run:(connectionId:string,machineId:string|undefined,expectedRevision:number,action:MachineAction,config?:Record<string,unknown>)=>state.run({operationId:crypto.randomUUID(),connectionId,machineId,expectedRevision,action,...(config?{config}:{})})};
}
