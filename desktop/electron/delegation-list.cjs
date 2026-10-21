// Read-only projection of the existing ledger. Authorization is established by AgentNetwork.
const fail=(code,message)=>Object.assign(new Error(message),{code});
const id=x=>typeof x==='string'&&x.trim().length>0;
const states=new Set(['pending','queued','accepted','running','succeeded','failed','cancelled','unknown','rejected']);
function owned(d,node,owner){
  if(!id(node.nodeId)||!id(owner.requestId)||!id(owner.conversationId))return false;
  if(d.leaderId!==node.nodeId||d.parentRequestId!==owner.requestId||d.parentConversationId!==owner.conversationId)return false;
  if(id(owner.externalConnectionId))return owner.taskId===null&&d.parentTaskId===null&&d.externalConnectionId===owner.externalConnectionId;
  return !owner.externalConnectionId&&!d.externalConnectionId&&id(owner.taskId)&&d.parentTaskId===owner.taskId;
}
function delegationList(network,node,owner,args={}){
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!['limit','after'].includes(k)))throw fail('INVALID_INPUT','委派列表只接受limit和原分页游标，身份来自原接入。');
  const limit=args.limit===undefined?20:args.limit;
  if(!Number.isSafeInteger(limit)||limit<1||limit>50||args.after!==undefined&&(!id(args.after)||args.after.length>128))throw fail('INVALID_INPUT','分页数量须为1至50，游标须为原列表中的非空委派ID。');
  const rows=network.delegations.filter(d=>owned(d,node,owner)&&id(d.delegationId)&&id(d.requestId));
  let offset=0;
  if(args.after!==undefined){const i=rows.findIndex(d=>d.delegationId===args.after);if(i<0)throw fail('INVALID_INPUT','原列表中不存在该游标，请从首页重新读取。');offset=i+1;}
  const items=rows.slice(offset,offset+limit).map(d=>{
    const member=network.nodes.find(n=>n.nodeId===d.memberId);
    return {delegationId:d.delegationId,requestId:d.requestId,nodeId:d.memberId,...(member?{machineId:member.machineId}:{}),
      ...(id(d.taskId)?{taskId:d.taskId}:{}),...(id(d.conversationId)?{conversationId:d.conversationId}:{}),
      ledgerState:states.has(d.state)?d.state:'unknown',...(typeof d.createdAt==='string'?{createdAt:d.createdAt}:{}),
      ...(typeof d.error?.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(d.error.code)?{errorCode:d.error.code}:{}),
      taskQueryable:id(d.taskId)};
  });
  return {schema:1,readOnly:true,source:'delegation-ledger',liveTaskStatus:false,items,total:rows.length,hasMore:offset+items.length<rows.length,
    next:offset+items.length<rows.length?items.at(-1).delegationId:null};
}
module.exports={delegationList};
