const fs=require('node:fs'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {MachineRouter,qualified,project,folderPath,workspaceKey}=require('./machine-router.cjs');
const {GraphLayoutStore,atomicWrite,digest,operationId}=require('./graph-layout.cjs');
const {rejectionProof,marker:daemonRejectionMarker}=require('./daemon-rejection.cjs');
const {openCodeCompatibility,openCodeVersionError}=require('./tool-discovery.cjs');
const {connectionCapabilities,collaborationCapabilityError}=require('./builtin-adapters.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const hash=value=>createHash('sha256').update(value).digest('hex');
const requestFingerprint=(nodeId,params)=>hash(JSON.stringify({nodeId,op:params.op,message:params.message,workspace:params.workspace||'',conversationId:params.conversationId||'',collaboration:!!params.collaboration}));
const terminal=new Set(['succeeded','failed','cancelled']);
class AgentNetwork extends MachineRouter {
  constructor(options){
    super(options);this.networkFile=path.join(options.directory,'agent-network.json');this.nodeJobs=new Map();this.nodeLocks=new Set();this.machineLocks=new Set();
    this.network=fs.existsSync(this.networkFile)?JSON.parse(fs.readFileSync(this.networkFile,'utf8')):{version:1,revision:0,nodes:[],collaboration:{leaderId:null,memberIds:[],revision:0},requests:[],delegations:[]};
    if(this.network.version!==1||!Array.isArray(this.network.nodes)||!Array.isArray(this.network.requests))throw fail('NETWORK_STATE','Agent 网络记录无法读取，请保留数据排查。');
    if(!fs.existsSync(this.networkFile)){fs.copyFileSync(this.file,this.file+'.before-nodes.json',fs.constants.COPYFILE_EXCL);this.saveNetwork();}
    this.layoutStore=new GraphLayoutStore(options.directory);
  }
  saveNetwork(){
    try{atomicWrite(this.networkFile,this.network);}
    catch(error){throw Object.assign(fail('NETWORK_PERSIST','本地任务台账持久化失败（'+(error.code||'IO_ERROR')+'）：'+error.message),{cause:error});}
  }
  localRenameFailure(error){
    if(error?.code!=='EPERM'||typeof error.message!=='string')return false;
    const match=/^EPERM: operation not permitted, rename '(.*)' -> '(.*)'$/.exec(error.message);
    if(!match)return false;
    const paths=path;
    const normalize=value=>process.platform==='win32'?paths.resolve(value).toLowerCase():paths.resolve(value);
    const [,source,target]=match;
    return paths.isAbsolute(source)&&paths.isAbsolute(target)&&normalize(target)===normalize(this.networkFile)
      &&normalize(paths.dirname(source))===normalize(paths.dirname(this.networkFile))
      &&/^agent-network\.json\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/i.test(paths.basename(source));
  }
  node(id){const node=this.network.nodes.find(n=>n.nodeId===id);if(!node)throw fail('NODE_NOT_FOUND','这个 Agent 节点不存在，请刷新。');return node;}
  host(machine){const host=super.host(machine);host.setCollaboration?.((scope,name,args,callId)=>this.collaborationTool(scope,name,args,callId,machine.machineId));return host;}
  reconcileDelegation(delegation){
    if(delegation.taskId||delegation.conversationId)return null;
    const node=this.network.nodes.find(n=>n.nodeId===delegation.memberId);
    if(!node)return null;
    const receipt=this.network.requests.find(r=>r.requestId===delegation.requestId&&r.nodeId===node.nodeId&&r.machineId===node.machineId);
    if(!receipt||receipt.dispatched!==false||!receipt.preparationRejection||receipt.taskId||receipt.conversationId
      ||receipt.fingerprint!==requestFingerprint(node.nodeId,{op:'submit',message:delegation.message,workspace:delegation.workspace,collaboration:false}))return null;
    delegation.state='rejected';delegation.error={code:receipt.preparationRejection,message:receipt.preparationError?.message||delegation.error?.message||'原委派在准备阶段被拒绝，未派发；请修复配置后新建请求。'};
    return delegation.error;
  }
  async snapshot(){
    for(const delegation of this.network.delegations)this.reconcileDelegation(delegation);
    const snapshot=await super.snapshot();
    snapshot.machines=snapshot.machines.map(m=>({...m,removed:(this.network.removedMachines||[]).includes(m.machineId)}));
    const groups=new Map();
    for(const connection of snapshot.connections){
      const key=connection.machineId+':'+connection.adapter;
      if(!groups.has(key)||connection.current&&!groups.get(key).current)groups.set(key,connection);
    }
    for(let connection of groups.values()){
      const executable=this.machine(connection.machineId).kind==='windows'?connection.executable.toLowerCase():connection.executable;
      const owned=this.catalog.instances.find(i=>i.connectionId===connection.connectionId&&i.nodeId&&this.network.nodes.some(n=>n.nodeId===i.nodeId));
      const nodeId=owned?.nodeId||'node-'+hash(connection.machineId+':'+connection.adapter+':'+executable).slice(0,24);
      const siblings=this.network.nodes.filter(n=>n.machineId===connection.machineId&&n.adapter===connection.adapter);
      // Keep the established role/identity across native upgrades. Historical
      // aliases retain their original IDs, receipts and context ownership.
      let node=siblings.find(n=>n.nodeId===this.network.collaboration.leaderId)
        ||siblings.find(n=>!n.removed&&this.network.collaboration.memberIds.includes(n.nodeId))
        ||siblings.find(n=>!n.supersededBy&&!n.removed&&n.connected)
        ||siblings.find(n=>!n.supersededBy&&!n.removed)
        ||siblings.find(n=>n.nodeId===nodeId)||siblings[0];
      if(!node){node={nodeId,machineId:connection.machineId,adapter:connection.adapter,name:connection.name,executable:connection.executable,connected:connection.connected};this.network.nodes.push(node);}
      if(!connection.current)connection=snapshot.connections.find(c=>c.connectionId===node.connectionId)||connection;
      delete node.supersededBy;
      for(const sibling of siblings)if(sibling!==node)sibling.supersededBy=node.nodeId;
      Object.assign(node,{executable:connection.current?connection.executable:node.executable,connectionId:connection.connectionId,version:connection.current?connection.version:node.version,connected:node.managed?!!node.connected:node.connected||connection.connected,installed:!connection.error||connection.healthy,error:connection.error,executionSupported:connection.executionSupported??connection.adapter!=='codex'});
      for(const instance of snapshot.instances.filter(i=>i.machineId===node.machineId&&i.adapter===node.adapter)){const saved=this.catalog.instances.find(i=>i.instanceId===instance.instanceId);if(saved&&!saved.nodeId)saved.nodeId=node.nodeId;}
    }
    const nodes=this.network.nodes.map(node=>{
      const machine=snapshot.machines.find(m=>m.machineId===node.machineId),connection=snapshot.connections.find(c=>c.connectionId===node.connectionId);
      const owners=new Set([node.nodeId,...this.network.nodes.filter(n=>n.supersededBy===node.nodeId).map(n=>n.nodeId)]);
      const instances=this.catalog.instances.filter(i=>owners.has(i.nodeId));
      const active=snapshot.tasks.filter(t=>instances.some(i=>i.instanceId===t.targetAgent)&&!terminal.has(t.status));
      const last=snapshot.tasks.filter(t=>instances.some(i=>i.instanceId===t.targetAgent)&&!t.verification).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];
      const unconfirmed=this.network.requests.filter(r=>{
        if(!owners.has(r.nodeId)||!r.dispatched)return false;
        const task=snapshot.tasks.find(t=>t.requestId===r.requestId&&t.machineId===node.machineId);
        if(task){r.lastStatus=task.status;return false;}
        return !terminal.has(r.lastStatus);
      }).length;
      const occupied=snapshot.instances.filter(i=>instances.some(saved=>saved.instanceId===i.instanceId)).some(i=>i.busy||i.currentTask&&!terminal.has(i.currentTask.status));
      const needsUpgrade=machine?.objectRoutingSupported===false,apiReady=node.adapter!=='opencode'||node.apiCompatibility?.compatible===true&&node.apiCompatibility.executable===node.executable&&node.apiCompatibility.version===node.version;
      const versionCompatibility=node.adapter==='opencode'?openCodeCompatibility(node.version):{supported:true},incompatible=!versionCompatibility.supported;
      const gatedNode={...node,...(node.adapter==='opencode'?{compatibility:versionCompatibility}:{}),connected:incompatible?false:node.connected,executionSupported:node.executionSupported&&!needsUpgrade&&apiReady&&!incompatible};
      const status=!machine?.online?'offline':needsUpgrade?'upgrade_required':incompatible?'version_incompatible':!apiReady?'needs_check':!connection?.healthy?'tool_error':!node.executionSupported?'unsupported':node.connected?'connected':'discovered';
      return {...gatedNode,...connectionCapabilities(gatedNode),...(needsUpgrade?{error:'来源后台需要升级，请使用后台维护。'}:incompatible?{error:versionCompatibility.message}:!apiReady?{error:node.apiCompatibility?.error?.message||'请重新接入节点，检查原生 API 兼容性。'}:{}),online:!!machine?.online,healthy:!!connection?.healthy,status,busy:occupied||active.length+unconfirmed>0,activeTasks:active.length,unconfirmed,uncertain:active.some(t=>t.status==='unknown'),waiting:active.some(t=>t.waiting),lastError:last?.status==='failed'?last.error:undefined,available:!node.supersededBy&&!machine?.removed&&!node.removed&&status==='connected'&&!occupied&&!active.length&&!unconfirmed};
    });
    const annotate=item=>{const instance=this.catalog.instances.find(i=>i.instanceId===item.targetAgent);return {...item,nodeId:instance?.nodeId,workspace:instance?.workspace};};
    this.save();this.saveNetwork();
    return {...snapshot,nodeManagement:true,configured:nodes.some(n=>n.connected),nodes,collaboration:this.network.collaboration,tasks:snapshot.tasks.map(annotate),conversations:snapshot.conversations.map(annotate),delegations:this.network.delegations};
  }
  async prepare(method,params={}){
    if(['saveCollaboration','collaboration','collaborationOperation','graphLayout','saveGraphLayout','graphLayoutOperation','nodeOperation'].includes(method))return {machineId:null,params};
    if(['attachNode','manageNode','nodeRequest','mcp.status','mcp.install','mcp.remove','mcp.export'].includes(method)){
      const node=params.nodeId?this.node(params.nodeId):this.node(this.network.collaboration.leaderId);
      if(params.machineId&&params.machineId!==node.machineId)throw fail('WRONG_MACHINE','节点属于另一台机器。');
      return {machineId:node.machineId,params:{...params,nodeId:node.nodeId,machineId:node.machineId}};
    }
    return super.prepare(method,params);
  }
  // Resolve occupancy from retained ownership, never from a caller's new alias.
  pendingResource(params,machineId){
    const intent=this.network.requests.find(r=>r.machineId===machineId&&
      (r.requestId===params.requestId||params.conversationId&&r.conversationId===params.conversationId||
        (params.taskId||params.reply?.taskId)&&r.taskId===(params.taskId||params.reply?.taskId)));
    const instance=this.catalog.instances.find(i=>i.machineId===machineId&&
      [params.agentId,params.targetAgent,intent?.agentId].filter(Boolean).includes(i.instanceId));
    const nodeId=instance?.nodeId||intent?.nodeId||params.nodeId;
    const node=this.network.nodes.find(n=>n.nodeId===nodeId&&n.machineId===machineId);
    const owned=instance?[instance]:this.catalog.instances.filter(i=>node&&i.nodeId===node.nodeId);
    return {nodeId:node?.nodeId,workspaces:owned.filter(i=>i.workspace).map(i=>workspaceKey(this.machine(i.machineId),i.workspace))};
  }
  pendingBlocks(row,params){
    if(!row.machineId)return true;
    const original=this.pendingResource(row.params||{},row.machineId),target=this.pendingResource(params,params.machineId);
    if(original.nodeId&&original.nodeId===target.nodeId)return true;
    const oldNode=this.network.nodes.find(n=>n.nodeId===original.nodeId),newNode=this.network.nodes.find(n=>n.nodeId===target.nodeId);
    if(oldNode&&newNode&&oldNode.machineId===newNode.machineId&&oldNode.adapter===newNode.adapter)return true;
    if(original.workspaces.some(key=>target.workspaces.includes(key)))return true;
    // Legacy provenance gaps keep the old machine-wide protection.
    return row.machineId===params.machineId&&(!original.nodeId||!target.nodeId||!original.workspaces.length);
  }
  // A saved preparation rejection or authenticated durable daemon proof can
  // establish that the original native mutation was rejected before execution.
  // Missing receipts or current configuration failures alone never prove this.
  undispatchedRejection(row,error){
    const code=row.result?.error?.code,p=row.params;
    if(!['submit','continue'].includes(row.op)||p?.op!==row.op||p.requestId!==row.id||p.machineId!==row.machineId)return null;
    const node=this.network.nodes.find(n=>n.nodeId===p.nodeId&&n.machineId===row.machineId);
    if(!node||this.nodeJobs.has(node.nodeId))return null;
    const original=this.network.requests.find(r=>r.requestId===row.id&&r.machineId===row.machineId&&r.nodeId===node.nodeId);
    if(!original||original.taskId||original.conversationId)return null;
    if(original.inputFingerprint&&original.inputFingerprint!==requestFingerprint(node.nodeId,p))return null;
    if(original.fingerprint!==requestFingerprint(node.nodeId,original.inputFingerprint?{...p,collaboration:original.collaboration}:p))return null;
    const live=rejectionProof(error),proof=live||original.daemonRejection;
    if(proof){
      const machine=this.machine(row.machineId);
      const raw=p.op==='continue'?{op:'continue',conversationId:p.conversationId,requestId:row.id,message:p.message}
        :{op:'submit',agentId:original.agentId,requestId:row.id,message:p.message};
      if(p.teamScope)raw.teamScope=p.teamScope;
      const routed=this.route({...raw,machineId:row.machineId}).params;
      const target=Object.fromEntries(['taskId','agentId','conversationId','executionId'].filter(k=>typeof routed[k]==='string').map(k=>[k,routed[k]]));
      if(proof.version!==1||proof.source!=='daemon.receiptRead'||machine.kind!=='ssh'
        ||proof.machineId!==row.machineId||proof.daemonId!==row.machineId.slice(4)||!proof.profileId
        ||machine.daemonId&&machine.daemonId!==proof.daemonId||machine.profileId&&machine.profileId!==proof.profileId
        ||proof.requestId!==row.id||proof.op!==row.op||proof.code!=='NOT_CONFIGURED'
        ||!original.inputFingerprint||proof.fingerprint!==digest({method:'ipc',params:routed})
        ||digest(proof.target)!==digest(target)||!live&&original.dispatched!==false)return null;
      if(live){
        const before={...original};
        Object.assign(original,{dispatched:false,preparationRejection:proof.code,daemonRejection:proof});
        try{this.saveNetwork();}catch{for(const k of Object.keys(original))delete original[k];Object.assign(original,before);return null;}
      }
      return {requestId:row.id,machineId:row.machineId,state:'rejected',error:{code:proof.code,
        message:'原请求已被原机器后台持久拒绝，未执行需求；原记录已保留，请修复配置后新建请求。'},reconciliation:daemonRejectionMarker};
    }
    if(original.dispatched!==false)return null;
    const persistence=code==='NETWORK_PERSIST'||this.localRenameFailure(row.result?.error);
    if(persistence&&original.inputFingerprint===requestFingerprint(node.nodeId,p))return {
      requestId:row.id,machineId:row.machineId,state:'rejected',
      error:{code,message:'本地任务台账持久化失败，原请求尚未派发到原生工具；原记录已保留，修复磁盘或权限后可新建请求。'},
      reconciliation:'original undispatched local network persistence failure verified'};
    const preparation=original.preparationRejection;
    if(preparation&&preparation!==code)return null;
    const legacy=code==='NOT_CONFIGURED'||row.op==='submit'&&['CLAUDE_RUNTIME_INVALID','CLAUDE_RUNTIME_MISSING'].includes(code)&&node.adapter==='opencode'&&this.machine(row.machineId).kind==='windows';
    if(!preparation&&!legacy)return null;
    return {requestId:row.id,machineId:row.machineId,state:'rejected',
      error:{code:preparation||code,message:original.preparationError?.message||'原请求在准备执行环境时被拒绝，尚未派发；请求与历史已保留，可修复配置后新建会话。'},
      reconciliation:'original undispatched node intent and rejection verified'};
  }
  async nodeRequest(params){
    const node=this.node(params.nodeId),machine=this.machine(node.machineId);
    const inputFingerprint=requestFingerprint(node.nodeId,params);
    this.assertMachineAdmission(machine);
    const prior=params.op==='continue'?this.network.requests.findLast(r=>r.conversationId===params.conversationId&&r.nodeId===node.nodeId):null;
    if(prior?.teamSessionId&&!params.teamScope)throw fail('TEAM_FORBIDDEN','小队原生会话须由新的成员执行身份续接。');
    if(prior?.collaboration)params={...params,collaboration:true};
    if(node.removed||!node.connected)throw fail('NODE_DISCONNECTED','请先接入这个 Agent 节点。');

    if(params.model||params.providerID)throw fail('INVALID_INPUT','任务沿用原生工具配置，不接受模型或供应商覆盖。');
    if(!['submit','continue',undefined].includes(params.op)||typeof params.requestId!=='string'||!params.requestId||params.requestId.length>128||typeof params.message!=='string'||!params.message.trim()||params.message.length>65536)throw fail('INVALID_INPUT','请填写有效需求和请求 ID。');
    const fingerprint=requestFingerprint(node.nodeId,params);
    const previous=this.network.requests.find(r=>r.requestId===params.requestId&&r.machineId===node.machineId);
    if(previous){
      if(previous.fingerprint!==fingerprint)throw fail('REQUEST_CONFLICT','原请求 ID 已用于其他内容，请查询原请求。');
      if(previous.preparationRejection)throw fail(previous.preparationRejection,previous.preparationError?.message||'原请求在派发前已拒绝，请修复配置后新建会话。');
      try{return await super.call('ipc',{op:'request',machineId:node.machineId,requestId:params.requestId});}catch(e){if(!['NOT_FOUND','REQUEST_NOT_FOUND','NOT_CONFIGURED'].includes(e.code))throw e;}
      if(previous.dispatched)throw fail('DESKTOP_UNCONFIRMED','原请求提交状态尚未确认，请查询原请求，不能重复执行。');
    }
    if(node.adapter==='opencode'&&!openCodeCompatibility(node.version).supported)throw openCodeVersionError(node.version);
    if(!node.executionSupported)throw fail('ADAPTER_UNSUPPORTED','这个节点已发现，尚未完成执行适配。');
    // Original dispatched receipts above remain readable if current capabilities
    // change. New native execution intent is admitted from the static contract.
    const capabilities=connectionCapabilities(node).connectionCapabilities;
    if(capabilities.execution!==true)throw fail('ADAPTER_UNSUPPORTED','这个节点没有已声明的原生执行接入，需求未派发。');
    if(params.collaboration&&capabilities.bridgeMcp!==true)throw collaborationCapabilityError('这个节点尚不支持调用 Bridge MCP，不能作为协作主 Agent；需求未派发。');
    if(node.supersededBy&&params.op!=='continue')throw fail('NODE_SUPERSEDED','这个历史安装已由当前版本替代，请使用当前 Agent 节点新建会话。');
    const state=await this.snapshot();
    if(node.supersededBy&&params.op!=='continue')throw fail('NODE_SUPERSEDED','这个历史安装已由当前版本替代，请使用当前 Agent 节点新建会话。');
    if(state.nodes.find(n=>n.nodeId===(node.supersededBy||node.nodeId))?.busy)throw fail('AGENT_BUSY','这个 Agent 节点仍有未结束任务，请先查看或核对原执行。');
    const receipt=previous||{requestId:params.requestId,machineId:node.machineId,nodeId:node.nodeId,fingerprint,inputFingerprint,createdAt:new Date().toISOString(),dispatched:false,collaboration:!!params.collaboration};
    if(!previous){this.network.requests.push(receipt);this.saveNetwork();}
    let rawParams;
    try{
    if(params.op==='continue'){
      const existing=await super.call('ipc',{op:'conversation',machineId:node.machineId,conversationId:params.conversationId});
      const owner=this.catalog.instances.find(i=>i.instanceId===existing.targetAgent);
      if(owner?.nodeId!==node.nodeId)throw fail('WRONG_MACHINE','这个会话属于其他 Agent 节点。');
      if(owner.model)throw fail('CONVERSATION_CONFIG','此历史会话绑定过模型覆盖。记录已保留，请新建使用原生配置的会话。');
      if(params.teamScope){
        if(!prior?.contextId)throw fail('TEAM_CAPABILITY','原会话缺少可续接的小队上下文。');
        const configured=await this.host(machine).call('scope',{contextId:prior.contextId,scope:params.teamScope});
        if(!configured.teamContinuation)throw Object.assign(fail('TEAM_UPGRADE_REQUIRED','来源后台尚不支持小队身份续接，请升级后查询原请求。'),{executionNotDispatched:true});
        receipt.contextId=prior.contextId;receipt.teamSessionId=params.teamScope.teamSessionId;
      }
      if(!params.teamScope&&prior?.collaboration&&prior.contextId){receipt.contextId=prior.contextId;const scoped=await this.host(machine).call('scope',{contextId:prior.contextId,scope:{nodeId:node.nodeId,parentRequestId:params.requestId}});if(scoped.teamCollaboration===false)throw collaborationCapabilityError('来源后台未提供 Bridge MCP 通道，续聊需求未派发。');}
      rawParams={op:'continue',conversationId:params.conversationId,requestId:params.requestId,message:params.message};
    }else{
      if(params.collaboration&&this.network.collaboration.leaderId!==node.nodeId)throw fail('COLLABORATION_FORBIDDEN','这个节点不是当前主 Agent。');
      const context=await this.host(machine).call('context',{nodeId:node.nodeId,adapter:node.adapter,executable:node.executable,workspace:params.workspace?folderPath(params.workspace,machine):undefined,...(params.teamScope?{collaborationId:'team:'+params.teamScope.teamSessionId,scope:params.teamScope}:params.collaboration?{collaborationId:'default',scope:{nodeId:node.nodeId,parentRequestId:params.requestId}}:{})});
      if(node.adapter==='opencode')node.apiCompatibility={executable:node.executable,version:node.version,compatible:true};
      if(params.collaboration&&context.teamCollaboration===false)throw collaborationCapabilityError('来源后台未提供 Bridge MCP 通道，需求未派发。');
      if(params.teamScope&&!context.teamCollaboration)throw Object.assign(fail('TEAM_UPGRADE_REQUIRED','来源后台尚不支持小队通信，请升级该机器后台后再执行。'),{executionNotDispatched:true});
      const snapshot=await this.host(machine).call('snapshot',{});this.importSnapshot(machine,snapshot);this.cache.set(node.machineId,snapshot);
      const instance=this.catalog.instances.find(i=>i.machineId===node.machineId&&i.backendId===context.agentId);if(instance)instance.nodeId=node.nodeId;
      receipt.agentId=qualified(node.machineId,context.agentId);this.save();this.saveNetwork();
      receipt.contextId=context.contextId;if(params.teamScope)receipt.teamSessionId=params.teamScope.teamSessionId;receipt.collaboration=!!params.collaboration;
      rawParams={op:params.op||'submit',agentId:receipt.agentId,requestId:params.requestId,message:params.message};
    }
    }catch(error){
      receipt.preparationRejection=typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)?error.code:'DESKTOP_ERROR';
      receipt.preparationError={code:receipt.preparationRejection,message:error.message};
      if(node.adapter==='opencode'&&error.code==='OPENCODE_API_UNSUPPORTED')node.apiCompatibility={executable:node.executable,version:node.version,compatible:false,error:receipt.preparationError};
      this.saveNetwork();throw error;
    }
    // Durable intent precedes a native mutation. An uncertain retry only reads receipts.
    if(params.teamScope)rawParams.teamScope=params.teamScope;
    receipt.dispatched=true;
    try{this.saveNetwork();}catch(error){receipt.dispatched=false;throw error;}
    try{const result=await super.call('ipc',{...rawParams,machineId:node.machineId});receipt.taskId=result.taskId;receipt.conversationId=result.conversationId;this.saveNetwork();return {...result,nodeId:node.nodeId};}
    catch(error){if(error.executionNotDispatched||['NOT_CONFIGURED','AGENT_BUSY','PROJECT_BUSY','AGENT_UNHEALTHY','AGENT_UNAVAILABLE','CONVERSATION_CONFIG','CONVERSATION_BUSY','CONVERSATION_BINDING','INVALID_INPUT','CONFIG_NOT_APPLIED'].includes(error.code)){receipt.dispatched=false;receipt.rejection=error.code;if(error.executionNotDispatched||error.code==='NOT_CONFIGURED')receipt.preparationRejection=error.code;this.saveNetwork();}throw error;}
  }
  async collaborationTool(scope,name,args,callId,sourceMachine){
    const node=this.node(scope.nodeId),relation=this.network.collaboration;
    if(node.machineId!==sourceMachine)throw fail('COLLABORATION_FORBIDDEN','此调用者不属于原机器。');
    if(scope.teamSessionId){if(!this.options.teamTool)throw fail('TEAM_UNAVAILABLE','小队协作通道未接入。');return this.options.teamTool(scope,name,args,sourceMachine);}
    if(scope.externalConnectionId)return this.externalCollaborationTool(scope,name,args,callId,sourceMachine);
    const parent=this.network.requests.find(r=>r.nodeId===node.nodeId&&r.requestId===scope.parentRequestId&&r.machineId===sourceMachine&&r.collaboration);
    if(!parent||!parent.dispatched)throw fail('COLLABORATION_FORBIDDEN','协作工具未绑定已提交的主任务。');
    const parentTask=await super.call('ipc',{op:'request',machineId:sourceMachine,requestId:parent.requestId});
    if(terminal.has(parentTask.status))throw fail('COLLABORATION_FORBIDDEN','主任务已结束，此执行身份不可继续委派。');
    return this.scopedCollaborationTool(node,relation,{...parentTask,requestId:parent.requestId},name,args);
  }
  async externalCollaborationTool(scope,name,args,callId,sourceMachine){
    const node=this.node(scope.nodeId);
    if(node.machineId!==sourceMachine||!node.connected||node.removed||(this.network.removedMachines||[]).includes(sourceMachine))throw fail('COLLABORATION_FORBIDDEN','MCP 所属节点或机器已断开或移除。');
    // A durable MCP connection owns its delegations; it is not a native Task.
    return this.scopedCollaborationTool(node,this.network.collaboration,{requestId:scope.externalConnectionId,conversationId:'mcp:'+scope.externalConnectionId,taskId:null,externalConnectionId:scope.externalConnectionId},name,args);
  }
  async scopedCollaborationTool(node,relation,owner,name,args){
    if(name==='list_agents'){
      if(node.nodeId!==relation.leaderId)return {items:[]};
      const snapshot=await this.snapshot();return {items:snapshot.nodes.filter(n=>relation.memberIds.includes(n.nodeId)).map(({nodeId,machineId,name,adapter,status,busy,executionSupported,connectionCapabilities,capabilitySource})=>({nodeId,machineId,name,adapter,status,busy,executionSupported,connectionCapabilities,capabilitySource,machine:snapshot.machines.find(m=>m.machineId===machineId)?.name}))};
    }
    if(name==='delegate'){
      if(node.nodeId!==relation.leaderId)throw fail('COLLABORATION_FORBIDDEN','此调用者已不是当前主 Agent，不能新委派。');
      if(owner.status==='unknown')throw fail('COLLABORATION_FORBIDDEN','原父执行尚未确认，不能新委派。');
      if(!relation.memberIds.includes(args.nodeId)||args.nodeId===node.nodeId)throw fail('COLLABORATION_FORBIDDEN','目标节点不在已允许的子 Agent 中。');
      if(typeof args.requestId!=='string'||!args.requestId||args.requestId.length>128||typeof args.message!=='string'||!args.message.trim()||args.message.length>65536)throw fail('INVALID_INPUT','委派需要稳定请求 ID 和需求文本。');
      const requestId='delegation-'+hash(node.nodeId+':'+owner.conversationId+':'+args.requestId).slice(0,40);
      let delegation=this.network.delegations.find(d=>d.requestId===requestId);
      if(delegation&&(delegation.memberId!==args.nodeId||delegation.message!==args.message||(delegation.workspace||'')!==(args.workspace||'')))throw fail('REQUEST_CONFLICT','此委派请求 ID 已用于另一条需求。');
      const child=this.node(args.nodeId);
      if(delegation){const refusal=this.reconcileDelegation(delegation);if(refusal){this.saveNetwork();throw fail(refusal.code,refusal.message);}}
      if(!delegation){
        if(connectionCapabilities(node).connectionCapabilities.bridgeMcp!==true)throw collaborationCapabilityError('当前主节点没有已声明的 Bridge MCP 调用能力，未派发新委派。');
        if(connectionCapabilities(child).connectionCapabilities.delegation!==true)throw collaborationCapabilityError('目标节点没有已声明的受委派执行能力，未派发新委派。');
      }
      if(!delegation){delegation={delegationId:randomUUID(),requestId,leaderId:node.nodeId,memberId:args.nodeId,parentRequestId:owner.requestId,parentTaskId:owner.taskId,...(owner.externalConnectionId?{externalConnectionId:owner.externalConnectionId}:{}),parentConversationId:owner.conversationId,message:args.message,workspace:args.workspace,createdAt:new Date().toISOString(),state:'pending'};this.network.delegations.push(delegation);this.saveNetwork();}
      try{const task=await this.call('nodeRequest',{op:'submit',nodeId:child.nodeId,machineId:child.machineId,requestId,message:args.message,workspace:args.workspace,collaboration:false});Object.assign(delegation,{taskId:task.taskId,conversationId:task.conversationId,state:task.status});this.saveNetwork();return {...task,parentTaskId:owner.taskId,delegationId:delegation.delegationId};}
      catch(e){const refusal=this.reconcileDelegation(delegation);if(!refusal){delegation.state=['AGENT_BUSY','PROJECT_BUSY','AGENT_UNHEALTHY','AGENT_UNAVAILABLE','NODE_DISCONNECTED','ADAPTER_UNSUPPORTED','INVALID_INPUT','WORKSPACE_UNAVAILABLE'].includes(e.code)?'rejected':'unknown';delegation.error={code:e.code,message:e.message};}this.saveNetwork();throw e;}
    }
    const delegation=this.network.delegations.find(d=>d.taskId===args.taskId&&d.leaderId===node.nodeId&&d.parentRequestId===owner.requestId&&d.parentTaskId===owner.taskId&&d.parentConversationId===owner.conversationId);
    if(!delegation)throw fail('COLLABORATION_FORBIDDEN','只能读取或控制当前主会话委派的任务。');
    const member=this.node(delegation.memberId);
    if(name==='task_pending')return super.call('ipc',{op:'pending',machineId:member.machineId,taskId:args.taskId});
    if(name==='reply_task'){
      if(!['permission','form'].includes(args.action)||!args.requestId||!args.operationId)throw fail('INVALID_INPUT','回复需要原交互请求 ID 与操作 ID。');
      const original=await super.call('ipc',{op:'task',machineId:member.machineId,taskId:args.taskId});
      if(args.action==='permission'&&!['reject','once'].includes(args.decision))throw fail('INVALID_INPUT','请选择拒绝或仅允许本次。');
      return super.call('ipc',{op:'reply',machineId:member.machineId,taskId:args.taskId,reply:{taskId:args.taskId,executionId:original.executionId,operationId:args.operationId,requestId:args.requestId,action:args.action,...(args.action==='permission'?{decision:args.decision}:{answer:args.answer})}});
    }
    if(name==='cancel_task'){
      if(typeof args.operationId!=='string'||!args.operationId)throw fail('INVALID_INPUT','取消需要操作 ID。');
      return super.call('ipc',{op:'cancel',machineId:member.machineId,taskId:args.taskId,operationId:args.operationId});
    }
    if(name==='task_result'){
      const waitMs=Math.min(45000,Math.max(0,Number(args.waitMs)||0)),deadline=Date.now()+waitMs;let task;
      do{task=await super.call('ipc',{op:'task',machineId:member.machineId,taskId:args.taskId});if(terminal.has(task.status)||task.status==='unknown'||task.waiting||Date.now()>=deadline)break;await new Promise(r=>setTimeout(r,500));}while(true);
      delegation.state=task.status;this.saveNetwork();return {taskId:task.taskId,status:task.status,result:task.result,error:task.error,waiting:task.waiting,summary:task.lastSummary,delegationId:delegation.delegationId};
    }
    throw fail('INVALID_INPUT','不支持这个协作操作。');
  }
  assertMachineAdmission(machine){
    this.options.admissionCheck?.(machine);
    if((this.network.removedMachines||[]).includes(machine.machineId))throw fail('MACHINE_REMOVED','机器已移除，请先恢复原机器。');
    if(this.machineLocks.has(machine.machineId))throw fail('MACHINE_BUSY','机器连接正在变更，请稍后提交。');
  }
  finalizeMachine(receipt){
    if(receipt.state!=='confirmed'||!receipt.data?.machineId)return receipt;
    const operations=this.network.machineOperations||[];
    const prior=operations.find(o=>o.operationId===receipt.operationId);if(prior)return structuredClone(prior);
    const {machineId}=receipt.data,action=receipt.data.remoteAction==='uninstall'?'remove':receipt.data.action,removed=new Set(this.network.removedMachines||[]);
    if(action==='remove')removed.add(machineId);if(action==='restore')removed.delete(machineId);
    const owned=new Set(this.network.nodes.filter(n=>n.machineId===machineId).map(n=>n.nodeId)),old=this.network.collaboration;
    const revoke=action==='remove'&&(owned.has(old.leaderId)||old.memberIds.some(id=>owned.has(id)));
    const collaboration=revoke?{leaderId:owned.has(old.leaderId)?null:old.leaderId,memberIds:owned.has(old.leaderId)?[]:old.memberIds.filter(id=>!owned.has(id)),revision:old.revision+1}:old;
    const next={...this.network,removedMachines:[...removed],collaboration,machineOperations:[...operations,receipt]};
    atomicWrite(this.networkFile,next);this.network=next;return structuredClone(receipt);
  }
  assertAdmission(machine,instance,params){
    this.assertMachineAdmission(machine);
    this.options.executionAdmissionCheck?.(machine,instance,params);
    const node=instance.nodeId&&this.node(instance.nodeId);
    if(node&&(node.removed||!node.connected))throw fail('NODE_DISCONNECTED','这个 Agent 已断开或移除，请先重新接入。');
    if(node&&this.nodeLocks.has(node.nodeId))throw fail('AGENT_BUSY','节点正在变更，请稍后再提交需求。');
  }
  async execute(machine,params){
    if(['submit','continue','verify'].includes(params.op)){
      this.assertMachineAdmission(machine);
      const backendId=params.op==='continue'?(await this.host(machine).call('ipc',{op:'conversation',conversationId:params.conversationId})).targetAgent:params.agentId||params.targetAgent;
      const instance=this.catalog.instances.find(i=>i.machineId===machine.machineId&&i.backendId===backendId);
      const node=instance?.nodeId&&this.node(instance.nodeId);
      if(node&&(node.removed||!node.connected))throw fail('NODE_DISCONNECTED','这个 Agent 已断开或移除，请先重新接入。');
      if(node&&this.nodeLocks.has(node.nodeId))throw fail('AGENT_BUSY','节点正在变更，请稍后再提交需求。');
    }
    return super.execute(machine,params);
  }
  async manageNode(params){
    operationId(params.operationId);
    if(!['attach','disconnect','remove'].includes(params.action))throw fail('INVALID_INPUT','不支持这个节点操作。');
    const fingerprint=digest({nodeId:params.nodeId,machineId:params.machineId,action:params.action});
    const prior=(this.network.nodeOperations||[]).find(o=>o.operationId===params.operationId);
    if(prior){if(prior.fingerprint!==fingerprint)throw fail('OPERATION_CONFLICT','原节点操作 ID 已用于其他内容，请查询原操作。');return structuredClone(prior);}
    const node=this.node(params.nodeId),machine=this.machine(node.machineId);
    this.assertMachineAdmission(machine);
    if(params.machineId&&params.machineId!==node.machineId)throw fail('WRONG_MACHINE','节点属于另一台机器。');
    if(this.network.nodes.some(n=>n.machineId===node.machineId&&n.adapter===node.adapter&&(this.nodeLocks.has(n.nodeId)||this.nodeJobs.has(n.nodeId))))throw fail('AGENT_BUSY','节点正在处理请求，请先核对原执行。');
    this.nodeLocks.add(node.nodeId);
    try{
      const state=await this.snapshot(),current=state.nodes.find(n=>n.nodeId===node.nodeId);
      if(!current.online)throw fail('MACHINE_OFFLINE','请先恢复来源机器，核对原执行后再变更节点。');
      const instances=this.catalog.instances.filter(i=>i.nodeId===node.nodeId);
      if(current.busy||instances.some(i=>this.locks.has(workspaceKey(machine,i.workspace))))throw fail('AGENT_BUSY','节点仍有运行、等待或未确认的任务，不能断开、移除或重新接入。');
      if(params.action==='attach'){
        if(node.supersededBy)throw fail('NODE_SUPERSEDED','请接入当前 Agent 节点，历史安装仅保留原执行记录。');
        const discovered=await super.call('discover',{machineId:node.machineId});
        const item=discovered.items.find(i=>i.executable===node.executable&&i.adapter===node.adapter);
        if(!item)throw fail('DISCOVERY_CHANGED','这个工具已不可用，请重新扫描。');
        if(item.adapter==='opencode'&&!openCodeCompatibility(item.version??node.version).supported)throw openCodeVersionError(item.version??node.version);
        if(item.healthy===false||!node.executionSupported)throw fail('AGENT_UNAVAILABLE','工具尚不可用，请检查原生安装、登录或执行支持。');
        if(machine.objectRoutingSupported===false)throw fail('DAEMON_UPGRADE_REQUIRED','请先通过原机器后台维护升级后台，再接入执行节点。');
        if(node.adapter==='opencode'){
          try{await this.host(machine).call('context',{nodeId:node.nodeId,adapter:node.adapter,executable:node.executable});node.apiCompatibility={executable:node.executable,version:node.version,compatible:true};}
          catch(error){node.apiCompatibility={executable:node.executable,version:node.version,compatible:false,error:{code:error.code,message:error.message}};this.saveNetwork();throw error;}
        }
      }
      const operations=this.network.nodeOperations||[];
      if(operations.length>=4096)throw fail('OPERATION_LIMIT','节点操作收据达到上限，请保留记录并联系维护者。');
      const nextNode={...node,managed:true,connected:params.action==='attach',removed:params.action==='remove'};
      const currentRelation=this.network.collaboration;
      const affected=params.action!=='attach'&&(currentRelation.leaderId===node.nodeId||currentRelation.memberIds.includes(node.nodeId));
      const collaboration=affected?{leaderId:currentRelation.leaderId===node.nodeId?null:currentRelation.leaderId,memberIds:currentRelation.leaderId===node.nodeId?[]:currentRelation.memberIds.filter(id=>id!==node.nodeId),revision:currentRelation.revision+1}:currentRelation;
      const receipt=JSON.parse(JSON.stringify({operationId:params.operationId,state:'confirmed',fingerprint,data:{node:nextNode,collaboration}}));
      const next={...this.network,nodes:this.network.nodes.map(n=>n.nodeId===node.nodeId?nextNode:n),collaboration,nodeOperations:[...operations,receipt]};
      // Local admission, authorization revocation and receipt commit together.
      // Native contexts, requests, history and installation remain untouched.
      atomicWrite(this.networkFile,next);this.network=next;return structuredClone(receipt);
    }finally{this.nodeLocks.delete(node.nodeId);}
  }
  async call(method,params={}){
    if(method==='snapshot')return this.snapshot();
    if(['mcp.status','mcp.install','mcp.remove','mcp.export'].includes(method)){
      const node=this.node(params.nodeId),machine=this.machine(node.machineId);
      if(['mcp.install','mcp.export'].includes(method)&&(!node.connected||node.removed))throw fail('NODE_DISCONNECTED','请先接入此 Agent。');
      this.assertMachineAdmission(machine);
      return this.host(machine).call(method,{nodeId:node.nodeId,adapter:node.adapter});
    }
    if(method==='collaboration')return {...this.network.collaboration};
    if(method==='collaborationOperation'){
      operationId(params.operationId);
      return structuredClone((this.network.relationOperations||[]).find(o=>o.operationId===params.operationId)||{operationId:params.operationId,state:'not_found'});
    }
    if(method==='graphLayout')return this.layoutStore.get();
    if(method==='graphLayoutOperation')return this.layoutStore.operation(params.operationId);
    if(method==='saveGraphLayout')return this.layoutStore.save(params,this.catalog.machines.map(m=>m.machineId),this.network.nodes.map(n=>n.nodeId));
    if(method==='saveCollaboration'){
      // Legacy in-process clients remain usable; the desktop graph always supplies
      // an operation ID and reads that receipt after an uncertain response.
      const id=params.operationId||randomUUID();operationId(id);
      const fingerprint=digest({leaderId:params.leaderId,memberIds:params.memberIds,expectedRevision:params.expectedRevision});
      const operations=this.network.relationOperations||[],prior=operations.find(o=>o.operationId===id);
      if(prior){if(prior.fingerprint!==fingerprint)throw fail('OPERATION_CONFLICT','原授权操作 ID 已用于其他内容，请查询原操作。');return structuredClone(prior);}
      const current=this.network.collaboration;if(params.expectedRevision!==current.revision)throw fail('REVISION_CONFLICT','协作关系已更新，请刷新后保存。');
      if(params.leaderId!==null&&typeof params.leaderId!=='string')throw fail('INVALID_INPUT','主节点不合法。');
      if(!Array.isArray(params.memberIds)||new Set(params.memberIds).size!==params.memberIds.length)throw fail('INVALID_INPUT','子节点清单不合法或重复。');
      if(params.leaderId===null&&params.memberIds.length)throw fail('INVALID_INPUT','请先选择主 Agent。');
      for(const id of [params.leaderId,...params.memberIds].filter(Boolean)){const node=this.node(id);if(!node.connected||!node.executionSupported)throw fail('NODE_DISCONNECTED','授权节点必须已接入并支持执行。');if(connectionCapabilities(node).connectionCapabilities.execution!==true)throw collaborationCapabilityError('授权节点必须具有已声明的原生执行能力。');}
      if(params.leaderId&&connectionCapabilities(this.node(params.leaderId)).connectionCapabilities.bridgeMcp!==true)throw collaborationCapabilityError('主 Agent 必须支持调用 Bridge MCP；普通执行接入可以保留为子 Agent。');
      for(const id of params.memberIds)if(connectionCapabilities(this.node(id)).connectionCapabilities.delegation!==true)throw collaborationCapabilityError('子 Agent 必须具有已声明的受委派执行能力。');
      if(params.memberIds.includes(params.leaderId))throw fail('INVALID_INPUT','主 Agent 不能作为自己的子 Agent。');
      if(operations.length>=4096)throw fail('OPERATION_LIMIT','授权收据达到上限，请保留记录并联系维护者。');
      const collaboration={leaderId:params.leaderId,memberIds:[...params.memberIds],revision:current.revision+1};
      const receipt={operationId:id,state:'confirmed',fingerprint,data:collaboration};
      const next={...this.network,collaboration,relationOperations:[...operations,receipt]};
      atomicWrite(this.networkFile,next);this.network=next;
      return params.operationId?structuredClone(receipt):{...collaboration};
    }
    if(method==='nodeOperation'){
      operationId(params.operationId);
      return structuredClone((this.network.nodeOperations||[]).find(o=>o.operationId===params.operationId)||{operationId:params.operationId,state:'not_found'});
    }
    if(method==='attachNode')return (await this.manageNode({...params,action:'attach',operationId:randomUUID()})).data.node;
    if(method==='manageNode')return this.manageNode(params);
    if(method==='nodeRequest'){
      const key=params.nodeId;if(this.nodeLocks.has(key))throw fail('AGENT_BUSY','节点正在变更，请稍后再提交需求。');
      const target=this.node(key),siblings=this.network.nodes.filter(n=>n.machineId===target.machineId&&n.adapter===target.adapter&&n.nodeId!==key);
      if(siblings.some(n=>this.nodeJobs.has(n.nodeId)||this.nodeLocks.has(n.nodeId)))throw fail('AGENT_BUSY','同一个 Agent 的原安装仍在处理请求，请先核对原执行。');
      if(this.nodeJobs.has(key)){try{await this.nodeJobs.get(key);}catch{/* The original attempt's durable receipt decides the retry. */}return this.call(method,params);}
      const job=this.nodeRequest(params).finally(()=>this.nodeJobs.delete(key));this.nodeJobs.set(key,job);return job;
    }
    return super.call(method,params);
  }
}
module.exports={AgentNetwork};
