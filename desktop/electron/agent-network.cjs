const fs=require('node:fs'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {MachineRouter,qualified,project,folderPath,workspaceKey}=require('./machine-router.cjs');
const {GraphLayoutStore,atomicWrite,digest,operationId}=require('./graph-layout.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const hash=value=>createHash('sha256').update(value).digest('hex');
const terminal=new Set(['succeeded','failed','cancelled']);
class AgentNetwork extends MachineRouter {
  constructor(options){
    super(options);this.networkFile=path.join(options.directory,'agent-network.json');this.nodeJobs=new Map();this.nodeLocks=new Set();
    this.network=fs.existsSync(this.networkFile)?JSON.parse(fs.readFileSync(this.networkFile,'utf8')):{version:1,revision:0,nodes:[],collaboration:{leaderId:null,memberIds:[],revision:0},requests:[],delegations:[]};
    if(this.network.version!==1||!Array.isArray(this.network.nodes)||!Array.isArray(this.network.requests))throw fail('NETWORK_STATE','Agent 网络记录无法读取，请保留数据排查。');
    if(!fs.existsSync(this.networkFile)){fs.copyFileSync(this.file,this.file+'.before-nodes.json',fs.constants.COPYFILE_EXCL);this.saveNetwork();}
    this.layoutStore=new GraphLayoutStore(options.directory);
  }
  saveNetwork(){const tmp=this.networkFile+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.network,null,2),{mode:0o600});fs.renameSync(tmp,this.networkFile);}
  node(id){const node=this.network.nodes.find(n=>n.nodeId===id);if(!node)throw fail('NODE_NOT_FOUND','这个 Agent 节点不存在，请刷新。');return node;}
  host(machine){const host=super.host(machine);host.setCollaboration?.((scope,name,args,callId)=>this.collaborationTool(scope,name,args,callId,machine.machineId));return host;}
  async snapshot(){
    const snapshot=await super.snapshot();
    for(const connection of snapshot.connections){
      const executable=this.machine(connection.machineId).kind==='windows'?connection.executable.toLowerCase():connection.executable;
      const owned=this.catalog.instances.find(i=>i.connectionId===connection.connectionId&&i.nodeId&&this.network.nodes.some(n=>n.nodeId===i.nodeId));
      const nodeId=owned?.nodeId||'node-'+hash(connection.machineId+':'+connection.adapter+':'+executable).slice(0,24);
      let node=this.network.nodes.find(n=>n.nodeId===nodeId);
      if(!node){node={nodeId,machineId:connection.machineId,adapter:connection.adapter,name:connection.name,executable:connection.executable,connected:connection.connected};this.network.nodes.push(node);}
      Object.assign(node,{connectionId:connection.connectionId,version:connection.version,connected:node.managed?!!node.connected:node.connected||connection.connected,installed:!connection.error||connection.healthy,error:connection.error,executionSupported:connection.executionSupported??connection.adapter!=='codex'});
      for(const instance of snapshot.instances.filter(i=>i.connectionId===connection.connectionId)){const saved=this.catalog.instances.find(i=>i.instanceId===instance.instanceId);if(saved&&!saved.nodeId)saved.nodeId=nodeId;}
    }
    const nodes=this.network.nodes.map(node=>{
      const machine=snapshot.machines.find(m=>m.machineId===node.machineId),connection=snapshot.connections.find(c=>c.connectionId===node.connectionId);
      const instances=this.catalog.instances.filter(i=>i.nodeId===node.nodeId);
      const active=snapshot.tasks.filter(t=>instances.some(i=>i.instanceId===t.targetAgent)&&!terminal.has(t.status));
      const last=snapshot.tasks.filter(t=>instances.some(i=>i.instanceId===t.targetAgent)&&!t.verification).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];
      const unconfirmed=this.network.requests.filter(r=>{
        if(r.nodeId!==node.nodeId||!r.dispatched)return false;
        const task=snapshot.tasks.find(t=>t.requestId===r.requestId&&t.machineId===node.machineId);
        if(task){r.lastStatus=task.status;return false;}
        return !terminal.has(r.lastStatus);
      }).length;
      const occupied=snapshot.instances.filter(i=>instances.some(saved=>saved.instanceId===i.instanceId)).some(i=>i.busy||i.currentTask&&!terminal.has(i.currentTask.status));
      const status=!machine?.online?'offline':!connection?.healthy?'tool_error':!node.executionSupported?'unsupported':node.connected?'connected':'discovered';
      return {...node,online:!!machine?.online,healthy:!!connection?.healthy,status,busy:occupied||active.length+unconfirmed>0,activeTasks:active.length,unconfirmed,uncertain:active.some(t=>t.status==='unknown'),waiting:active.some(t=>t.waiting),lastError:last?.status==='failed'?last.error:undefined,available:!node.removed&&status==='connected'&&!occupied&&!active.length&&!unconfirmed};
    });
    const annotate=item=>{const instance=this.catalog.instances.find(i=>i.instanceId===item.targetAgent);return {...item,nodeId:instance?.nodeId,workspace:instance?.workspace};};
    this.save();this.saveNetwork();
    return {...snapshot,nodeManagement:true,configured:nodes.some(n=>n.connected),nodes,collaboration:this.network.collaboration,tasks:snapshot.tasks.map(annotate),conversations:snapshot.conversations.map(annotate),delegations:this.network.delegations};
  }
  async prepare(method,params={}){
    if(['saveCollaboration','collaboration','collaborationOperation','graphLayout','saveGraphLayout','graphLayoutOperation','nodeOperation'].includes(method))return {machineId:null,params};
    if(['attachNode','manageNode','nodeRequest'].includes(method)){
      const node=params.nodeId?this.node(params.nodeId):this.node(this.network.collaboration.leaderId);
      if(params.machineId&&params.machineId!==node.machineId)throw fail('WRONG_MACHINE','节点属于另一台机器。');
      return {machineId:node.machineId,params:{...params,nodeId:node.nodeId,machineId:node.machineId}};
    }
    return super.prepare(method,params);
  }
  async nodeRequest(params){
    const node=this.node(params.nodeId),machine=this.machine(node.machineId);
    const prior=params.op==='continue'?this.network.requests.findLast(r=>r.conversationId===params.conversationId&&r.nodeId===node.nodeId):null;
    if(prior?.collaboration)params={...params,collaboration:true};
    if(node.removed||!node.connected)throw fail('NODE_DISCONNECTED','请先接入这个 Agent 节点。');
    if(!node.executionSupported)throw fail('ADAPTER_UNSUPPORTED','这个节点已发现，尚未完成执行适配。');
    if(params.model||params.providerID)throw fail('INVALID_INPUT','任务沿用原生工具配置，不接受模型或供应商覆盖。');
    if(!['submit','continue',undefined].includes(params.op)||typeof params.requestId!=='string'||!params.requestId||params.requestId.length>128||typeof params.message!=='string'||!params.message.trim()||params.message.length>65536)throw fail('INVALID_INPUT','请填写有效需求和请求 ID。');
    const fingerprint=hash(JSON.stringify({nodeId:node.nodeId,op:params.op,message:params.message,workspace:params.workspace||'',conversationId:params.conversationId||'',collaboration:!!params.collaboration}));
    const previous=this.network.requests.find(r=>r.requestId===params.requestId&&r.machineId===node.machineId);
    if(previous){
      if(previous.fingerprint!==fingerprint)throw fail('REQUEST_CONFLICT','原请求 ID 已用于其他内容，请查询原请求。');
      try{return await super.call('ipc',{op:'request',machineId:node.machineId,requestId:params.requestId});}catch(e){if(!['NOT_FOUND','REQUEST_NOT_FOUND','NOT_CONFIGURED'].includes(e.code))throw e;}
      if(previous.dispatched)throw fail('DESKTOP_UNCONFIRMED','原请求提交状态尚未确认，请查询原请求，不能重复执行。');
    }
    const state=await this.snapshot();
    if(state.nodes.find(n=>n.nodeId===node.nodeId)?.busy)throw fail('AGENT_BUSY','这个 Agent 节点仍有未结束任务，请先查看或核对原执行。');
    const receipt=previous||{requestId:params.requestId,machineId:node.machineId,nodeId:node.nodeId,fingerprint,createdAt:new Date().toISOString(),dispatched:false,collaboration:!!params.collaboration};
    if(!previous){this.network.requests.push(receipt);this.saveNetwork();}
    let rawParams;
    if(params.op==='continue'){
      const existing=await super.call('ipc',{op:'conversation',machineId:node.machineId,conversationId:params.conversationId});
      const owner=this.catalog.instances.find(i=>i.instanceId===existing.targetAgent);
      if(owner?.nodeId!==node.nodeId)throw fail('WRONG_MACHINE','这个会话属于其他 Agent 节点。');
      if(owner.model)throw fail('CONVERSATION_CONFIG','此历史会话绑定过模型覆盖。记录已保留，请新建使用原生配置的会话。');
      if(prior?.collaboration&&prior.contextId){receipt.contextId=prior.contextId;await this.host(machine).call('scope',{contextId:prior.contextId,scope:{nodeId:node.nodeId,parentRequestId:params.requestId}});}
      rawParams={op:'continue',conversationId:params.conversationId,requestId:params.requestId,message:params.message};
    }else{
      if(params.collaboration&&this.network.collaboration.leaderId!==node.nodeId)throw fail('COLLABORATION_FORBIDDEN','这个节点不是当前主 Agent。');
      const context=await this.host(machine).call('context',{nodeId:node.nodeId,adapter:node.adapter,executable:node.executable,workspace:params.workspace?folderPath(params.workspace,machine):undefined,...(params.collaboration?{collaborationId:'default',scope:{nodeId:node.nodeId,parentRequestId:params.requestId}}:{})});
      const snapshot=await this.host(machine).call('snapshot',{});this.importSnapshot(machine,snapshot);this.cache.set(node.machineId,snapshot);
      const instance=this.catalog.instances.find(i=>i.machineId===node.machineId&&i.backendId===context.agentId);if(instance)instance.nodeId=node.nodeId;
      receipt.agentId=qualified(node.machineId,context.agentId);this.save();this.saveNetwork();
      receipt.contextId=context.contextId;receipt.collaboration=!!params.collaboration;
      rawParams={op:params.op||'submit',agentId:receipt.agentId,requestId:params.requestId,message:params.message};
    }
    // Durable intent precedes a native mutation. An uncertain retry only reads receipts.
    receipt.dispatched=true;this.saveNetwork();
    try{const result=await super.call('ipc',{...rawParams,machineId:node.machineId});receipt.taskId=result.taskId;receipt.conversationId=result.conversationId;this.saveNetwork();return {...result,nodeId:node.nodeId};}
    catch(error){if(['AGENT_BUSY','PROJECT_BUSY','AGENT_UNHEALTHY','AGENT_UNAVAILABLE','CONVERSATION_CONFIG','CONVERSATION_BUSY','CONVERSATION_BINDING','INVALID_INPUT','CONFIG_NOT_APPLIED'].includes(error.code)){receipt.dispatched=false;receipt.rejection=error.code;this.saveNetwork();}throw error;}
  }
  async collaborationTool(scope,name,args,callId,sourceMachine){
    const node=this.node(scope.nodeId),relation=this.network.collaboration;
    if(node.machineId!==sourceMachine)throw fail('COLLABORATION_FORBIDDEN','此调用者不属于原机器。');
    const parent=this.network.requests.find(r=>r.nodeId===node.nodeId&&r.requestId===scope.parentRequestId&&r.machineId===sourceMachine&&r.collaboration);
    if(!parent||!parent.dispatched)throw fail('COLLABORATION_FORBIDDEN','协作工具未绑定已提交的主任务。');
    const parentTask=await super.call('ipc',{op:'request',machineId:sourceMachine,requestId:parent.requestId});
    if(terminal.has(parentTask.status))throw fail('COLLABORATION_FORBIDDEN','主任务已结束，此执行身份不可继续委派。');
    if(name==='list_agents'){
      if(node.nodeId!==relation.leaderId)return {items:[]};
      const snapshot=await this.snapshot();return {items:snapshot.nodes.filter(n=>relation.memberIds.includes(n.nodeId)).map(({nodeId,machineId,name,adapter,status,busy,executionSupported})=>({nodeId,machineId,name,adapter,status,busy,executionSupported,machine:snapshot.machines.find(m=>m.machineId===machineId)?.name}))};
    }
    if(name==='delegate'){
      if(node.nodeId!==relation.leaderId)throw fail('COLLABORATION_FORBIDDEN','此调用者已不是当前主 Agent，不能新委派。');
      if(parentTask.status==='unknown')throw fail('COLLABORATION_FORBIDDEN','原父执行尚未确认，不能新委派。');
      if(!relation.memberIds.includes(args.nodeId)||args.nodeId===node.nodeId)throw fail('COLLABORATION_FORBIDDEN','目标节点不在已允许的子 Agent 中。');
      if(typeof args.requestId!=='string'||!args.requestId||args.requestId.length>128||typeof args.message!=='string'||!args.message.trim()||args.message.length>65536)throw fail('INVALID_INPUT','委派需要稳定请求 ID 和需求文本。');
      const requestId='delegation-'+hash(node.nodeId+':'+parentTask.conversationId+':'+args.requestId).slice(0,40);
      let delegation=this.network.delegations.find(d=>d.requestId===requestId);
      if(delegation&&(delegation.memberId!==args.nodeId||delegation.message!==args.message||(delegation.workspace||'')!==(args.workspace||'')))throw fail('REQUEST_CONFLICT','此委派请求 ID 已用于另一条需求。');
      if(!delegation){delegation={delegationId:randomUUID(),requestId,leaderId:node.nodeId,memberId:args.nodeId,parentRequestId:parent.requestId,parentTaskId:parentTask.taskId,parentConversationId:parentTask.conversationId,message:args.message,workspace:args.workspace,createdAt:new Date().toISOString(),state:'pending'};this.network.delegations.push(delegation);this.saveNetwork();}
      const child=this.node(args.nodeId);
      try{const task=await this.call('nodeRequest',{op:'submit',nodeId:child.nodeId,machineId:child.machineId,requestId,message:args.message,workspace:args.workspace,collaboration:false});Object.assign(delegation,{taskId:task.taskId,conversationId:task.conversationId,state:task.status});this.saveNetwork();return {...task,parentTaskId:parentTask.taskId,delegationId:delegation.delegationId};}
      catch(e){delegation.state=['AGENT_BUSY','PROJECT_BUSY','AGENT_UNHEALTHY','AGENT_UNAVAILABLE','NODE_DISCONNECTED','ADAPTER_UNSUPPORTED','INVALID_INPUT','WORKSPACE_UNAVAILABLE'].includes(e.code)?'rejected':'unknown';delegation.error={code:e.code,message:e.message};this.saveNetwork();throw e;}
    }
    const delegation=this.network.delegations.find(d=>d.taskId===args.taskId&&d.leaderId===node.nodeId&&d.parentRequestId===parent.requestId&&d.parentTaskId===parentTask.taskId&&d.parentConversationId===parentTask.conversationId);
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
  assertAdmission(machine,instance){
    const node=instance.nodeId&&this.node(instance.nodeId);
    if(node&&(node.removed||!node.connected))throw fail('NODE_DISCONNECTED','这个 Agent 已断开或移除，请先重新接入。');
    if(node&&this.nodeLocks.has(node.nodeId))throw fail('AGENT_BUSY','节点正在变更，请稍后再提交需求。');
  }
  async execute(machine,params){
    if(['submit','continue','verify'].includes(params.op)){
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
    if(params.machineId&&params.machineId!==node.machineId)throw fail('WRONG_MACHINE','节点属于另一台机器。');
    if(this.nodeLocks.has(node.nodeId)||this.nodeJobs.has(node.nodeId))throw fail('AGENT_BUSY','节点正在处理请求，请先核对原执行。');
    this.nodeLocks.add(node.nodeId);
    try{
      const state=await this.snapshot(),current=state.nodes.find(n=>n.nodeId===node.nodeId);
      if(!current.online)throw fail('MACHINE_OFFLINE','请先恢复来源机器，核对原执行后再变更节点。');
      const instances=this.catalog.instances.filter(i=>i.nodeId===node.nodeId);
      if(current.busy||instances.some(i=>this.locks.has(workspaceKey(machine,i.workspace))))throw fail('AGENT_BUSY','节点仍有运行、等待或未确认的任务，不能断开、移除或重新接入。');
      if(params.action==='attach'){
        const discovered=await super.call('discover',{machineId:node.machineId});
        const item=discovered.items.find(i=>i.executable===node.executable&&i.adapter===node.adapter);
        if(!item)throw fail('DISCOVERY_CHANGED','这个工具已不可用，请重新扫描。');
        if(item.healthy===false||!node.executionSupported)throw fail('AGENT_UNAVAILABLE','工具尚不可用，请检查原生安装、登录或执行支持。');
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
      for(const id of [params.leaderId,...params.memberIds].filter(Boolean)){const node=this.node(id);if(!node.connected||!node.executionSupported)throw fail('NODE_DISCONNECTED','授权节点必须已接入并支持执行。');}
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
      if(this.nodeJobs.has(key)){try{await this.nodeJobs.get(key);}catch{/* The original attempt's durable receipt decides the retry. */}return this.call(method,params);}
      const job=this.nodeRequest(params).finally(()=>this.nodeJobs.delete(key));this.nodeJobs.set(key,job);return job;
    }
    return super.call(method,params);
  }
}
module.exports={AgentNetwork};
