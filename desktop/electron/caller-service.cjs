const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {CollaborationBroker} = require('./collaboration-broker.cjs');
const methods = new Set(['callers.list', 'callers.create', 'callers.configure', 'callers.openContext', 'callers.closeContext', 'callers.rotateCredential', 'callers.revoke', 'callers.operation']);
const operations = ['delegate', 'result', 'pending', 'reply', 'cancel'];
const toolOperation = {delegate:'delegate',task_result:'result',list_delegations:'result',task_pending:'pending',reply_task:'reply',cancel_task:'cancel'};
const fail = (code, message) => Object.assign(new Error(message), {code});
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 150;
const copy = value => structuredClone(value);

// Principals reuse the existing agent identity. Context and credential records
// are separate control-plane facts, not native tasks, sessions or fake nodes.
class CallerService {
  constructor(options) {
    this.directory = options.directory;
    this.agents = options.agents;
    this.network = options.network;
    this.store = this.agents.store;
    this.closed = false;
    this.store.db.exec('CREATE TABLE IF NOT EXISTS interconnect_callers (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');
    this.store.db.prepare('INSERT OR IGNORE INTO interconnect_callers VALUES (1,?)').run(JSON.stringify({version:1,callers:[],contexts:[],credentials:[]}));
    this.state();
    this.broker = new CollaborationBroker(path.join(options.directory, 'caller-connections'), (scope,name,args) => this.tool(scope,name,args));
    this.ready = this.restore();
    this.ready.catch(() => {});
  }
  state() {
    let state;
    try {state=JSON.parse(this.store.db.prepare('SELECT body FROM interconnect_callers WHERE id=1').get().body);}
    catch {throw fail('CALLER_STATE','调用方记录无法读取，保留原数据和授权。');}
    if(state?.version!==1||!['callers','contexts','credentials'].every(key=>Array.isArray(state[key])&&state[key].length<=4096))
      throw fail('CALLER_STATE','调用方版本或容量无效，未重建原身份。');
    for(const [key,field] of [['callers','principalId'],['contexts','contextId'],['credentials','credentialId']]){
      const seen=new Set();
      for(const row of state[key]){
        if(!id(row[field])||seen.has(row[field])||typeof row.enabled!=='boolean')throw fail('CALLER_STATE','调用方身份重复或结构无效。');
        seen.add(row[field]);
      }
    }
    for(const row of state.callers)if(!id(row.agentId)||row.principalId!==row.agentId||!Number.isSafeInteger(row.revision)||row.revision<1
      ||!Array.isArray(row.grants)||!Array.isArray(row.operations)||new Set(row.operations).size!==row.operations.length||row.operations.some(op=>!operations.includes(op))
      ||row.workspacePolicy!==undefined&&row.workspacePolicy!=='native-default-only'
      ||new Set(row.grants.map(g=>g.agentId)).size!==row.grants.length||row.grants.some(g=>!id(g.agentId)||!id(g.endpointId)||!id(g.nodeId)||!id(g.machineId)))throw fail('CALLER_STATE','调用方授权记录无效。');
    for(const row of state.contexts)if(!state.callers.some(c=>c.principalId===row.principalId)||!Number.isSafeInteger(row.revision)||row.revision<1||!id(row.currentCredentialId)
      ||!state.credentials.some(c=>c.credentialId===row.currentCredentialId&&c.contextId===row.contextId))throw fail('CALLER_STATE','调用上下文归属无效。');
    for(const row of state.credentials)if(!state.contexts.some(c=>c.contextId===row.contextId&&c.principalId===row.principalId))throw fail('CALLER_STATE','调用凭据归属无效。');
    return state;
  }
  save(state) {
    if(['callers','contexts','credentials'].some(key=>state[key].length>4096)||Buffer.byteLength(JSON.stringify(state))>2*1024*1024)throw fail('CALLER_CAPACITY','调用方台账容量已满；原授权与未完成任务保留。');
    this.store.db.prepare('UPDATE interconnect_callers SET body=? WHERE id=1').run(JSON.stringify(state));
  }
  principal(state, principalId, enabled=false) {
    const caller=state.callers.find(row=>row.principalId===principalId);
    if(!caller||enabled&&!caller.enabled)throw fail('CALLER_REVOKED','调用方未登记或已撤权。');
    const agent=this.agents.record(caller.agentId);
    if(enabled&&agent.disabled)throw fail('CALLER_REVOKED','原智能体身份已停用。');
    return caller;
  }
  context(state, contextId) {
    const context=state.contexts.find(row=>row.contextId===contextId);
    if(!context)throw fail('CALLER_CONTEXT','原调用上下文不存在。');
    return context;
  }
  authorize(scope) {
    if(this.closed)throw fail('CALLER_CLOSED','原调用入口已关闭，不执行新请求。');
    const state=this.state(),caller=this.principal(state,scope.principalId,true),context=this.context(state,scope.callerContextId);
    const credential=state.credentials.find(row=>row.credentialId===scope.credentialId);
    if(!context.enabled||context.principalId!==caller.principalId||!credential?.enabled||credential.contextId!==context.contextId
      ||credential.principalId!==caller.principalId||context.currentCredentialId!==credential.credentialId)throw fail('CALLER_REVOKED','原上下文或凭据已撤销；不能用另一身份接管旧任务。');
    return {caller,context,credential};
  }
  view(caller) {
    return {principalId:caller.principalId,agentId:caller.agentId,enabled:caller.enabled,revision:caller.revision,operations:[...caller.operations],
      grants:copy(caller.grants),resourcePolicy:{workspace:'native-default-only',filesystemBoundary:'native-permissions',conversationIsolation:'context-owned'},createdAt:caller.createdAt};
  }
  grants(ids, old=[]) {
    if(!Array.isArray(ids)||ids.length>4096||ids.some(value=>!id(value))||new Set(ids).size!==ids.length)throw fail('CALLER_INPUT','授权目标必须是互不重复的登记Agent ID。');
    return ids.map(agentId=>{
      const prior=old.find(grant=>grant.agentId===agentId);
      if(prior)return copy(prior); // Pure revocation never re-admits offline old targets.
      const endpoint=this.agents.resolve(agentId);
      return {agentId,endpointId:endpoint.endpointId,nodeId:endpoint.nodeId,machineId:endpoint.machineId};
    });
  }
  async configuration(result) {
    if(!result?.contextId||!result?.credentialId)return result;
    const state=this.state(),context=this.context(state,result.contextId),caller=this.principal(state,context.principalId);
    if(!caller.enabled||this.agents.record(caller.agentId).disabled||!context.enabled||context.currentCredentialId!==result.credentialId)return {...result,configuration:null,configurationState:'superseded'};
    const scope={principalId:caller.principalId,callerContextId:context.contextId,credentialId:result.credentialId};
    this.authorize(scope);
    const config=await this.broker.configure('caller-'+context.contextId,scope,{assertCurrent:()=>this.authorize(scope)});
    this.authorize(scope); // Revocation while preparing files cannot grant access.
    return {...result,configuration:config,configurationState:'prepared'};
  }
  async restore() {
    for(const context of this.state().contexts.filter(row=>row.enabled)){
      const caller=this.principal(this.state(),context.principalId);
      if(caller.enabled&&!this.agents.record(caller.agentId).disabled)await this.configuration({principalId:caller.principalId,contextId:context.contextId,credentialId:context.currentCredentialId});
    }
  }
  async call(method,p={}) {
    if(!methods.has(method)||!p||typeof p!=='object'||Array.isArray(p))throw fail('CALLER_INPUT','调用方管理请求不合法。');
    const common=['operationId'];
    const allowed=method==='callers.list'?[]:method==='callers.operation'?common:method==='callers.create'?[...common,'agentId','allowedAgentIds','operations']
      :method==='callers.configure'?[...common,'principalId','expectedRevision','allowedAgentIds','operations']
      :method==='callers.openContext'?[...common,'principalId']
      :method==='callers.revoke'?[...common,'principalId','expectedRevision']:[...common,'contextId','expectedRevision'];
    if(Object.keys(p).some(key=>!allowed.includes(key)))throw fail('CALLER_INPUT','调用方管理不接受Agent自报权限、凭据或任务归属。');
    if(method==='callers.list'){
      const state=this.state();return {schema:1,items:state.callers.map(row=>this.view(row)),contexts:state.contexts.map(copy)};
    }
    if(method==='callers.operation'){
      const receipt=await this.store.call('team.operation',p);
      if(receipt.state==='confirmed'&&receipt.data?.callerOperation===true)return {...receipt,data:await this.configuration(receipt.data)};
      if(receipt.state==='confirmed')throw fail('CALLER_OPERATION_CONFLICT','原操作不是调用方管理收据。');
      return receipt;
    }
    const result=this.store.mutate({user:true,key:'user'},method,p,()=>{
      const state=this.state(),now=new Date().toISOString();let result;
      const checkedOperations=value=>{
        if(!Array.isArray(value)||new Set(value).size!==value.length||value.some(op=>!operations.includes(op)))throw fail('CALLER_INPUT','调用操作授权不合法。');
        return [...value];
      };
      if(method==='callers.create'){
        const agent=this.agents.record(p.agentId);
        if(agent.disabled)throw fail('CALLER_REVOKED','不能为已停用身份创建调用方。');
        if(state.callers.some(row=>row.principalId===agent.agentId))throw fail('CALLER_DUPLICATE','原主体已存在，撤权不释放身份。');
        const caller={principalId:agent.agentId,agentId:agent.agentId,enabled:true,revision:1,workspacePolicy:'native-default-only',grants:this.grants(p.allowedAgentIds===undefined?[]:p.allowedAgentIds),operations:checkedOperations(p.operations===undefined?['delegate','result']:p.operations),createdAt:now};
        state.callers.push(caller);result=this.view(caller);
      }else if(['callers.configure','callers.revoke'].includes(method)){
        const caller=this.principal(state,p.principalId,method!=='callers.revoke');
        if(p.expectedRevision!==caller.revision)throw fail('CALLER_REVISION','调用方授权已变化，请读取原修订。');
        if(method==='callers.revoke')caller.enabled=false;
        else {caller.grants=this.grants(p.allowedAgentIds===undefined?caller.grants.map(g=>g.agentId):p.allowedAgentIds,caller.grants);caller.operations=checkedOperations(p.operations===undefined?caller.operations:p.operations);}
        caller.revision++;result=this.view(caller);
      }else if(method==='callers.openContext'){
        const caller=this.principal(state,p.principalId,true),contextId=randomUUID(),credentialId=randomUUID();
        const context={contextId,principalId:caller.principalId,currentCredentialId:credentialId,revision:1,enabled:true,createdAt:now};
        state.contexts.push(context);state.credentials.push({credentialId,contextId,principalId:caller.principalId,enabled:true,createdAt:now});
        result={principalId:caller.principalId,contextId,credentialId,revision:1};
      }else{
        const context=this.context(state,p.contextId);this.principal(state,context.principalId,method!=='callers.closeContext');
        if(!context.enabled)throw fail('CALLER_REVOKED','原调用上下文已撤销。');
        if(p.expectedRevision!==context.revision)throw fail('CALLER_REVISION','调用上下文已变化，请读取原修订。');
        const previous=state.credentials.find(row=>row.credentialId===context.currentCredentialId);previous.enabled=false;
        if(method==='callers.closeContext'){context.enabled=false;context.revision++;result={principalId:context.principalId,contextId:context.contextId,revision:context.revision,closed:true};}
        else {
          const credentialId=randomUUID();state.credentials.push({credentialId,contextId:context.contextId,principalId:context.principalId,enabled:true,createdAt:now});
          context.currentCredentialId=credentialId;context.revision++;result={principalId:context.principalId,contextId:context.contextId,credentialId,revision:context.revision};
        }
      }
      this.save(state);return {...result,callerOperation:true};
    },{sync:false});
    return this.configuration(result);
  }
  async tool(scope,name,args={}) {
    const initial=this.authorize(scope),principalId=initial.caller.principalId,contextId=initial.context.contextId;
    const assert=()=>this.authorize(scope);
    const current=()=>{
      const {caller}=assert();
      return {leaderId:'caller:'+principalId,memberIds:caller.grants.map(grant=>grant.nodeId),revision:caller.revision};
    };
    const checkTarget=agentId=>{
      const {caller}=assert(),grant=caller.grants.find(row=>row.agentId===agentId);
      if(!caller.operations.includes('delegate')||!grant)throw fail('COLLABORATION_FORBIDDEN','目标或委派操作未获用户授权。');
      const endpoint=this.agents.resolve(agentId);
      if(endpoint.endpointId!==grant.endpointId||endpoint.nodeId!==grant.nodeId||endpoint.machineId!==grant.machineId)throw fail('AGENT_ENDPOINT_CHANGED','原授权固定端点不匹配，不能重绑目标。');
    };
    const operation=toolOperation[name];
    const assertPermission=()=>{const current=assert();if(operation&&!current.caller.operations.includes(operation))throw fail('CALLER_OPERATION_FORBIDDEN','用户未授权此调用操作。');return current;};
    assertPermission();
    if(['connect_agent','disconnect_agent'].includes(name))throw fail('CALLER_POLICY_USER_ONLY','独立调用方不能修改自己的授权；请由用户配置。');
    if(name==='list_connectable')return {schema:1,readOnly:true,view:'caller-grants',items:copy(initial.caller.grants),requiresUserConfiguration:true};
    if(name==='delegate'){
      if(Object.hasOwn(args,'workspace'))throw fail('CALLER_RESOURCE_FORBIDDEN','独立调用方当前只使用目标原生默认目录；不能覆盖目录或将其当作沙箱。');
      checkTarget(args.agentId);
    }
    const authority={assert:assertPermission,relation:current,checkTarget,canDelegate:()=>assert().caller.operations.includes('delegate'),
      view:()=>({principalId,contextId,credentialId:scope.credentialId,kind:'independent-caller',role:'caller'})};
    const node={nodeId:'caller:'+principalId,connected:true,removed:false};
    const owner={requestId:'caller-context:'+contextId,conversationId:'caller-context:'+contextId,taskId:null,externalConnectionId:'caller-context:'+contextId,authority};
    const result=await this.network.scopedCollaborationTool(node,current(),owner,name,args);
    assertPermission();
    return result;
  }
  close() {this.closed=true;this.broker.close();}
}
module.exports={CallerService,methods,operations};
