// Caller identity is established by AgentNetwork, never by tool arguments.
const {connectionCapabilities}=require('./builtin-adapters.cjs');
const identity=value=>typeof value==='string'&&value.trim().length>0;
function assertListArgs(args={}){
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw Object.assign(new Error('连接视图不接受身份或筛选参数，请使用原接入身份。'),{code:'INVALID_INPUT'});
}
function listAgentConnections(network,node,owner,snapshot){
  // Read the current relation after the asynchronous snapshot, so a role or
  // grant revoked while it was pending cannot be disclosed from a stale copy.
  const relation=network.collaboration;
  const role=identity(node.nodeId)&&node.nodeId===relation.leaderId?'leader':identity(node.nodeId)&&relation.memberIds.includes(node.nodeId)?'member':'unassigned';
  const delegationBlock=role!=='leader'?'not_leader':owner.status==='unknown'?'parent_unknown':connectionCapabilities(node).connectionCapabilities.bridgeMcp!==true?'caller_unsupported':null;
  const caller={nodeId:node.nodeId,machineId:node.machineId,kind:identity(owner.externalConnectionId)?'external-connection':'native-parent',role,delegationAuthorized:delegationBlock===null,delegationBlock};
  const items=role==='leader'?(snapshot?.nodes||[]).filter(n=>n.nodeId!==node.nodeId&&relation.memberIds.includes(n.nodeId)).map(({nodeId,machineId,name,adapter,status,busy,executionSupported,connectionCapabilities,capabilitySource})=>({nodeId,machineId,name,adapter,status,busy,executionSupported,connectionCapabilities,capabilitySource,machine:snapshot.machines.find(m=>m.machineId===machineId)?.name})):[];
  return {schema:1,readOnly:true,view:'authorized-connections',relationRevision:relation.revision,caller,items};
}
module.exports={assertListArgs,listAgentConnections};
