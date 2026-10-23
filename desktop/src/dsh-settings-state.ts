import type {AgentNode} from './types';
export interface DshConnection {adapter:string;origin:string;enabled:boolean;executable:string;connectionId?:string;error?:string}
export interface DshStatus {items:DshConnection[];selectedConnectionId?:string|null}
export type DshSelectionState='unconfigured'|'loaded'|'reload_required'|'unmatched'|'missing'|'corrupt';
export const dshConnectionIdentity=(row:DshConnection)=>row.connectionId||row.executable;
export function selectDshConnection(status:DshStatus,node:Pick<AgentNode,'adapter'|'executable'>,selected=status.selectedConnectionId){
 if(!Array.isArray(status.items))throw Error('INVALID_STATUS');
 const candidates=status.items.filter(row=>row&&row.adapter===node.adapter);
 const matches=candidates.filter(row=>selected?dshConnectionIdentity(row)===selected:row.executable===node.executable),row=matches.length===1?matches[0]:undefined;
 const originalConfig=/[\\/]dsh-connections[\\/](dsh-desktop|dsh-web)-[a-f0-9]{32}\.json$/i.test(node.executable);
 const state:DshSelectionState=matches.length>1?'corrupt':row?(row.error||!row.origin?'corrupt':row.executable===node.executable?'loaded':'reload_required'):selected||originalConfig?'missing':candidates.length?'unmatched':'unconfigured';
 return {row:row||null,state};
}
export const dshSelectionMessage:Record<DshSelectionState,string>={
 unconfigured:'尚未配置服务连接。',loaded:'当前节点已加载这条连接；保存状态不代表原生服务或模型执行成功。',
 reload_required:'新连接已保存，当前节点尚未加载；请重新扫描本机器后接入。旧连接和历史继续保留。',
 unmatched:'存在已保存的连接，但当前节点身份尚未匹配。请重新扫描本机器，再打开对应节点配置；不会自动选择其他服务。',
 missing:'原来保存的目标连接已不可读取。请保留原记录，重新扫描并核对原连接；不会回到默认地址。',
 corrupt:'原连接配置损坏，请保留原文件并核对；不会使用默认地址或其他连接。',
};
