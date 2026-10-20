import {call} from './api';
import type {GraphRecovery} from './management-recovery';
import {useManagementLane} from './management-state';
export type NodeAction='attach'|'disconnect'|'remove';
type Intent={operationId:string;nodeId:string;machineId:string;action:NodeAction};
const rejected=new Set(['INVALID_INPUT','NODE_NOT_FOUND','AGENT_BUSY','MACHINE_OFFLINE','WRONG_MACHINE','AGENT_UNAVAILABLE','DISCOVERY_CHANGED','OPERATION_LIMIT','OPERATION_CONFLICT','GRAPH_UNCONFIRMED','DESKTOP_UNCONFIRMED','GRAPH_INTENT_FAILED','DAEMON_STAGE_REJECTED']);
export function useNodeManagement(directory:string,notify:(text:string)=>void,refresh:()=>Promise<void>,recovery:GraphRecovery){
  const state=useManagementLane<Intent>(directory,'agentbridge-node-operation:','node','nodeOperation',intent=>!!intent.nodeId&&!!intent.machineId&&['attach','disconnect','remove'].includes(intent.action),rejected,intent=>call('manageNode',intent),notify,refresh,recovery);
  return {...state,run:(nodeId:string,machineId:string,action:NodeAction)=>state.run({operationId:crypto.randomUUID(),nodeId,machineId,action})};
}
