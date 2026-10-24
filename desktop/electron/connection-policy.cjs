const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),{isDeepStrictEqual}=require('node:util');
const {digest,operationId}=require('./graph-layout.cjs');
const {envelope,putRelation,relationForCaller,projection,syncSelectedRelation}=require('./relation-state.cjs');
const {connectionCapabilities}=require('./builtin-adapters.cjs');
const {GraphOperationJournal}=require('./graph-operations.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const string=value=>typeof value==='string'&&!!value&&value.length<=128;
const fields=(value,allowed)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw fail('INVALID_INPUT','连接操作包含不支持的字段。');};
function ownerIdentity(node,owner){
  const identity=value=>typeof value==='string'&&!!value.trim();
  if(!identity(owner.requestId)||!identity(owner.conversationId)||(owner.externalConnectionId?!identity(owner.externalConnectionId):!identity(owner.taskId)))throw fail('COLLABORATION_FORBIDDEN','连接操作缺少原父或原接入身份。');
  return {nodeId:node.nodeId,requestId:owner.requestId,taskId:owner.taskId??null,conversationId:owner.conversationId,...(owner.externalConnectionId?{externalConnectionId:owner.externalConnectionId}:{})};
}
const receipt=op=>({operationId:op.operationId,state:op.state,action:op.action,nodeId:op.nodeId,...(op.relationRevision!==undefined?{relationRevision:op.relationRevision}:{}),...(op.error?{error:op.error}:{})});
class ConnectionPolicy{
  constructor(router){this.router=router;}
  get state(){return this.router.network;}
  operations(){return this.state.connectionOperations||[];}
  target(id){const node=this.state.nodes.find(n=>n.nodeId===id);if(!node||node.removed||node.supersededBy||!node.connected||!node.executionSupported||(this.state.removedMachines||[]).includes(node.machineId)||connectionCapabilities(node).connectionCapabilities.delegation!==true)throw fail('CONNECTION_TARGET_UNAVAILABLE','目标尚不可授权，请由用户核对原节点。');return node;}
  leader(node){const row=relationForCaller(this.state,node.nodeId);if(!row.enabled||row.leaderId!==node.nodeId||node.removed||node.supersededBy||!node.connected||connectionCapabilities(node).connectionCapabilities.bridgeMcp!==true)throw fail('COLLABORATION_FORBIDDEN','当前身份没有启用的出站关系，不能自行创建或扩大主角色。');return row;}
  admit(row,targets=[]){
    const ids=new Set([row.leaderId,...targets]),machines=new Set([...ids].map(id=>this.state.nodes.find(n=>n.nodeId===id)?.machineId));
    if([...ids].some(id=>this.router.nodeLocks.has(id))||[...machines].some(id=>this.router.machineLocks.has(id)))throw fail('AGENT_BUSY','相关节点或机器正在变更，未修改连接。');
    const pending=new GraphOperationJournal(this.router.options.directory).pending();
    if(pending.some(op=>op.lane==='relation'||op.lane==='machine'&&(!op.params?.machineId||machines.has(op.params.machineId))||op.lane==='node'&&this.router.relationManagementBlocks(op,{relationId:row.relationId,leaderId:row.leaderId,memberIds:targets})))throw fail('GRAPH_UNCONFIRMED','原管理操作待核对，请由用户查询原操作，未修改连接。');
  }
  commit(next){
    const normalized=syncSelectedRelation(next);
    try{this.router.commitNetwork(next);}catch(error){
      // A lost post-rename acknowledgement must be recovered from the exact
      // durable bytes, never by executing the policy/connection mutation again.
      try{if(isDeepStrictEqual(JSON.parse(fs.readFileSync(this.router.networkFile,'utf8')),JSON.parse(JSON.stringify(normalized))))this.router.network=normalized;}catch{/* Keep original uncertainty. */}
      throw error;
    }
  }
  storeOperation(op,next=this.state){
    const rows=next.connectionOperations||[],index=rows.findIndex(row=>row.operationKey===op.operationKey);
    this.commit({...next,connectionOperations:index<0?[...rows,op]:rows.map((row,i)=>i===index?op:row)});
    return receipt(this.operations().find(row=>row.operationKey===op.operationKey));
  }
  async list(node,owner,args){
    fields(args,[]);const row=relationForCaller(this.state,node.nodeId);
    if(!row.enabled||row.leaderId!==node.nodeId)return {schema:1,readOnly:true,items:[],canManage:false,block:'not_leader'};
    const snapshot=await this.router.snapshot(),current=relationForCaller(this.state,node.nodeId);
    if(!current.enabled||current.leaderId!==node.nodeId)return {schema:1,readOnly:true,items:[],canManage:false,block:'not_leader'};
    this.leader(this.router.node(node.nodeId));const policy=envelope(current);
    return {schema:1,readOnly:true,canManage:owner.status!=='unknown',block:owner.status==='unknown'?'parent_unknown':null,relationRevision:current.revision,policyRevision:policy.revision,
      items:snapshot.nodes.filter(n=>n.nodeId!==node.nodeId&&policy.allowedNodeIds.includes(n.nodeId)&&!n.removed&&!n.supersededBy).map(n=>({nodeId:n.nodeId,machineId:n.machineId,name:n.name,adapter:n.adapter,status:n.status,busy:n.busy,connected:current.memberIds.includes(n.nodeId)}))};
  }
  operate(node,owner,action,args){
    fields(args,['nodeId','operationId','queryOnly']);operationId(args.operationId);
    if(!string(args.nodeId)||args.queryOnly!==undefined&&typeof args.queryOnly!=='boolean')throw fail('INVALID_INPUT','请提供有效目标和原操作 ID。');
    const identity=ownerIdentity(node,owner),operationKey=digest({owner:identity,operationId:args.operationId}),fingerprint=digest({action,nodeId:args.nodeId});
    const prior=this.operations().find(op=>op.operationKey===operationKey);
    if(prior){if(prior.fingerprint!==fingerprint)throw fail('OPERATION_CONFLICT','原连接操作 ID 已用于其他动作或目标，请查询原操作。');return receipt(prior);}
    if(args.queryOnly)return {operationId:args.operationId,state:'not_found'};
    const relation=this.leader(node);if(owner.status==='unknown')throw fail('COLLABORATION_FORBIDDEN','原父执行尚未确认，不能开始连接变更。');
    if(this.operations().length>=4096)throw fail('OPERATION_LIMIT','连接收据达到上限，原记录保留。');
    const op={operationKey,operationId:args.operationId,fingerprint,owner:identity,action,nodeId:args.nodeId,relationId:relation.relationId,createdAt:new Date().toISOString()};
    try{
      this.admit(relation,[args.nodeId]);if(args.nodeId===node.nodeId)throw fail('INVALID_INPUT','不能连接自己。');
      if(this.operations().some(row=>row.state==='pending_approval'&&row.relationId===relation.relationId&&row.nodeId===args.nodeId))throw fail('CONNECTION_PENDING_APPROVAL','原连接请求待人工确认，请查询原操作。');
      if(action==='connect'){
        this.target(args.nodeId);
        if(!envelope(relation).allowedNodeIds.includes(args.nodeId))return this.storeOperation({...op,state:'pending_approval',approvalId:randomUUID()});
      }
      const memberIds=action==='connect'?[...new Set([...relation.memberIds,args.nodeId])]:relation.memberIds.filter(id=>id!==args.nodeId);
      const changed=JSON.stringify(memberIds)!==JSON.stringify(relation.memberIds),nextRow={...relation,memberIds,revision:relation.revision+(changed?1:0)};
      return this.storeOperation({...op,state:'confirmed',relationRevision:nextRow.revision},putRelation(this.state,nextRow));
    }catch(error){
      if(!['GRAPH_UNCONFIRMED','AGENT_BUSY','CONNECTION_TARGET_UNAVAILABLE','INVALID_INPUT','CONNECTION_PENDING_APPROVAL'].includes(error.code))throw error;
      return this.storeOperation({...op,state:'rejected',error:{code:error.code,message:error.message}});
    }
  }
  view(){
    const safe=op=>({...receipt(op),...(op.approvalId?{approvalId:op.approvalId}:{}),leaderId:op.owner.nodeId,callerKind:op.owner.externalConnectionId?'external-connection':'native-parent',createdAt:op.createdAt});
    return {schema:1,activeRelationId:this.state.activeRelationId,relations:this.state.relations.map(row=>({relationId:row.relationId,enabled:row.enabled,...projection(row),envelope:envelope(row)})),pending:this.operations().filter(op=>op.state==='pending_approval').map(safe),audit:this.operations().slice(-50).reverse().map(safe)};
  }
  human(method,params){
    const allowed=method==='saveConnectionPolicy'?['operationId','relationId','leaderId','expectedRevision','expectedPolicyRevision','allowedNodeIds']:['operationId','approvalId','decision','expectedPolicyRevision'];
    fields(params,allowed);operationId(params.operationId);
    const fingerprint=digest({method,params}),records=this.state.connectionPolicyOperations||[],prior=records.find(row=>row.operationId===params.operationId);
    if(prior){if(prior.fingerprint!==fingerprint)throw fail('OPERATION_CONFLICT','原策略操作 ID 已用于其他内容。');return structuredClone(prior);}
    if(records.length>=4096)throw fail('OPERATION_LIMIT','策略收据达到上限，原记录保留。');
    let next=this.state,data;
    try{
      if(method==='saveConnectionPolicy'){
        if(!string(params.relationId)||!string(params.leaderId)||!Number.isSafeInteger(params.expectedRevision)||!Number.isSafeInteger(params.expectedPolicyRevision)||!Array.isArray(params.allowedNodeIds)||params.allowedNodeIds.length>4096||new Set(params.allowedNodeIds).size!==params.allowedNodeIds.length||params.allowedNodeIds.some(id=>!string(id)||id===params.leaderId))throw fail('INVALID_INPUT','策略范围或原修订不合法。');
        const old=this.state.relations.find(row=>row.relationId===params.relationId),policy=old?envelope(old):{revision:0,allowedNodeIds:[]};
        if(params.expectedRevision!==(old?.revision||0)||params.expectedPolicyRevision!==policy.revision)throw fail('REVISION_CONFLICT','原关系或策略已变化，请刷新后核对。');
        const leader=this.router.node(params.leaderId);if(!leader.connected||leader.removed||leader.supersededBy||connectionCapabilities(leader).connectionCapabilities.bridgeMcp!==true)throw fail('CONNECTION_TARGET_UNAVAILABLE','主节点尚不能配置出站关系。');
        for(const id of params.allowedNodeIds)this.target(id);
        const row={...old,relationId:params.relationId,enabled:true,leaderId:params.leaderId,memberIds:old?.leaderId===params.leaderId?old.memberIds.filter(id=>params.allowedNodeIds.includes(id)):[],revision:(old?.revision||0)+1,envelope:{version:1,revision:policy.revision+1,allowedNodeIds:[...params.allowedNodeIds]}};
        this.admit(row,[...new Set([...(old?.memberIds||[]),...params.allowedNodeIds])]);next=putRelation(this.state,row);data={relationId:row.relationId,revision:row.revision,policyRevision:row.envelope.revision};
      }else{
        if(!string(params.approvalId)||!['allow','reject'].includes(params.decision)||!Number.isSafeInteger(params.expectedPolicyRevision))throw fail('INVALID_INPUT','请选择原请求和明确决定。');
        const op=this.operations().find(row=>row.approvalId===params.approvalId);if(!op||op.state!=='pending_approval')throw fail('INVALID_INPUT','原请求不再待确认，请刷新核对。');
        let changed={...op,state:'rejected',error:{code:'CONNECTION_USER_REJECTED',message:'用户拒绝了原连接请求，未授予连接。'}};
        if(params.decision==='allow'){
          const row=this.state.relations.find(row=>row.relationId===op.relationId);
          if(!row?.enabled||row.leaderId!==op.owner.nodeId||envelope(row).revision!==params.expectedPolicyRevision)throw fail('REVISION_CONFLICT','原主关系或策略已变化，请刷新核对。');
          this.leader(this.router.node(row.leaderId));this.target(op.nodeId);this.admit(row,[op.nodeId]);
          const policy=envelope(row),allowed=[...new Set([...policy.allowedNodeIds,op.nodeId])];
          const updated={...row,memberIds:[...new Set([...row.memberIds,op.nodeId])],revision:row.revision+1,envelope:{version:1,revision:policy.revision+1,allowedNodeIds:allowed}};
          next=putRelation(this.state,updated);changed={...op,state:'confirmed',relationRevision:updated.revision};
        }
        next={...next,connectionOperations:this.operations().map(row=>row===op?changed:row)};data={approvalId:params.approvalId,decision:params.decision};
      }
      const result={operationId:params.operationId,state:'confirmed',fingerprint,data};
      this.commit({...next,connectionPolicyOperations:[...records,result]});return structuredClone(result);
    }catch(error){
      if(!['INVALID_INPUT','REVISION_CONFLICT','CONNECTION_TARGET_UNAVAILABLE','GRAPH_UNCONFIRMED','AGENT_BUSY','NODE_NOT_FOUND'].includes(error.code))throw error;
      const result={operationId:params.operationId,state:'rejected',fingerprint,error:{code:error.code,message:error.message}};
      this.commit({...this.state,connectionPolicyOperations:[...records,result]});return structuredClone(result);
    }
  }
  call(method,params){
    if(method==='connectionPolicies'){fields(params,[]);return this.view();}
    if(method==='connectionPolicyOperation'){fields(params,['operationId']);operationId(params.operationId);return structuredClone((this.state.connectionPolicyOperations||[]).find(row=>row.operationId===params.operationId)||{operationId:params.operationId,state:'not_found'});}
    return this.human(method,params);
  }
}
module.exports={ConnectionPolicy};
