'use strict';

const {randomUUID} = require('node:crypto');
const {BrowserState} = require('./browser-state.cjs');
const {terminal, fail, requireIdentity, text, event, digest} = require('./browser-protocol.cjs');
const now = () => new Date().toISOString();
function addEvent(task, kind, data = {}) {
  task.updatedAt = now();
  task.events.push({seq:++task.lastSeq, timestamp:task.updatedAt, event:{kind, ...data}});
}
function publicTask(task) {
  const result = structuredClone(task);
  for (const key of ['browserHashes','binding','phase','leaseEpoch','bindingRevision','knownBrowserInstances']) delete result[key];
  return result;
}
function publicOperation(operation){const {knownBrowserInstances,...result}=operation;return structuredClone(result);}
// The machine owns this host and injects its authenticated channel. There is no
// network listener, provider SDK, credential reader or alternate router here.
class BrowserAdapterHost {
  constructor(options) {
    if (!['chatgpt-web','kimi-web'].includes(options.adapter)) throw fail('ADAPTER_UNSUPPORTED', 'Unknown browser adapter.');
    this.adapter = options.adapter;
    this.browserInstanceId = requireIdentity(options.browserInstanceId, 'instance');
    this.channel = options.channel;
    this.store = new BrowserState(options.directory, options.storage);
    this.chain = Promise.resolve();
    this.jobs = new Set();
    this.controlJobs = new Map();
    this.observations = new Map();
    const saved = this.store.read();
    if (saved.agents.some(a => a.adapter !== this.adapter || a.browserInstanceId !== this.browserInstanceId)) throw fail('BROWSER_SESSION_MISMATCH', 'Browser context belongs to another installation.');
    if (saved.tasks.some(t => !terminal.has(t.status) && t.status !== 'unknown')) this.store.transact(state => {
      for (const task of state.tasks.filter(t => !terminal.has(t.status) && t.status !== 'unknown')) {
        task.status = 'unknown'; task.lastSummary = 'Observer restarted; query the original request.';
        addEvent(task, 'unknown', {reason:task.lastSummary});
      }
    });
    try {for(const task of saved.tasks)this.observe(task);}
    catch(error){for(const release of this.observations.values())release();throw error;}
  }
  observe(task) {
    if(!this.channel?.subscribe||this.observations.has(task.executionId))return;
    const release=this.channel.subscribe(task.executionId,e=>this.acceptEvent(e),()=>this.serial(()=>{
      const current=this.task(this.store.read(),task.taskId);
      if(!this.closed&&!terminal.has(current.status)&&current.status!=='unknown')this.unknown(task.taskId);
    }));
    this.observations.set(task.executionId,release);
  }
  serial(work) { const result = this.chain.then(work); this.chain = result.catch(() => {}); return result; }
  call(method, params = {}) { if(method==='ipc'&&params.op==='session.health')return this.health(params);return this.serial(() => { if (this.closed) throw fail('ADAPTER_CLOSED', 'Browser observer is closed.'); return this.handle(method, params); }); }
  async health(p) {
    const capture=await this.serial(()=>{
      if(this.closed)throw fail('ADAPTER_CLOSED','Browser observer is closed.');
      requireIdentity(p.probeId,'probe');const state=this.store.read(),task=this.task(state,p.taskId);
      if(p.executionId&&p.executionId!==task.executionId)throw fail('EXECUTION_MISMATCH','Health probe belongs to another execution.');
      return {task,revision:state.revision};
    });
    const task=capture.task;let remote,code='BROWSER_OFFLINE';
    // Do not hold the Host lane while waiting on WS. Earlier output events on
    // this same socket must still be committed and ACKed before its reply.
    if(this.channel?.online===true)try{
      const reply=await this.channel.request('health.check',{...this.metadata(task),probeId:p.probeId,...(task.binding?{binding:task.binding}:{})});
      if(!reply||reply.adapterId!==this.adapter||reply.browserInstanceId!==this.browserInstanceId||reply.requestId!==task.requestId||reply.executionId!==task.executionId||reply.bridgeSessionId!==task.conversationId||reply.probeId!==p.probeId||['enabled','domChecked','pageReady','sessionClosed','blocked'].some(k=>typeof reply[k]!=='boolean')||reply.loginChecked!==false||reply.pageReady&&(!reply.enabled||!reply.domChecked||reply.sessionClosed)||reply.code!==undefined&&(typeof reply.code!=='string'||!/^BROWSER_[A-Z_]{1,80}$/.test(reply.code)))throw fail('RECEIPT_MISMATCH','Original health receipt cannot be verified.');
      remote=reply;code=reply.code;
    }catch{code='BROWSER_HEALTH_UNKNOWN';}
    return this.serial(()=>{
      if(this.closed)throw fail('ADAPTER_CLOSED','Browser observer is closed.');
      const state=this.store.read(),current=this.task(state,task.taskId),c=state.conversations.find(c=>c.conversationId===task.conversationId);
      const online=this.channel?.online===true,blocked=state.tasks.some(t=>!terminal.has(t.status))||state.operations.some(o=>o.state==='unknown'),stale=state.revision!==capture.revision||c.lastTaskId!==task.taskId;
      const storageReady=this.store.poisoned!==true;
      if(!online)code='BROWSER_OFFLINE';else if(c.closed)code='BROWSER_SESSION_CLOSED';else if(stale)code='BROWSER_HEALTH_STALE';else if(blocked)code='BROWSER_RESOURCE_BUSY';
      if(!storageReady)code='BROWSER_STORAGE_ERROR';
      return {probeId:p.probeId,taskId:task.taskId,executionId:task.executionId,conversationId:task.conversationId,observedAt:now(),online,storageReady,sitePermission:remote?.enabled??null,domChecked:remote?.domChecked===true,pageReady:remote?.pageReady===true,loginChecked:false,sessionClosed:c.closed===true||remote?.sessionClosed===true,blocked:blocked||remote?.blocked===true,stale,taskStatus:current.status,ready:storageReady&&online&&!stale&&!blocked&&remote?.blocked===false&&remote.pageReady===true&&remote.sessionClosed===false&&this.conversationView(state,c).canContinue,...(code?{code}:{}),...(remote?.code?{pageCode:remote.code}:{})};
    });
  }
  task(state, id) { const task = state.tasks.find(t => t.taskId === id); if (!task) throw fail('TASK_NOT_FOUND', 'Original browser task not found.'); return task; }
  conversationView(state, conversation) {
    const task = state.tasks.find(t => t.taskId === conversation.lastTaskId);
    const {binding, ...result} = conversation;
    return {...result, kind:'task', canContinue:!conversation.closed && conversation.closeState!=='unknown' && this.channel?.online===true && !!binding?.transcriptFingerprint && terminal.has(task?.status) && !state.tasks.some(t => !terminal.has(t.status)) && !state.operations.some(o => o.state === 'unknown')};
  }
  handle(method, p) {
    const state = this.store.read();
    if (method === 'connect') {
      if (p.model || p.providerID || p.mcp) throw fail('INVALID_INPUT', 'Browser uses the existing page configuration.');
      if (state.agents.length) return {agentId:state.agents[0].agentId};
      return this.store.transact(s => { const agent = {agentId:this.adapter+'-'+randomUUID(), adapter:this.adapter, browserInstanceId:this.browserInstanceId, name:this.adapter, enabled:true}; s.agents.push(agent); return {agentId:agent.agentId}; });
    }
    if (method === 'snapshot') {
      const busy = state.tasks.find(t => !terminal.has(t.status));
      const controlUnknown=state.operations.some(o=>o.state==='unknown');
      const online = this.channel?.online === true;
      return {agents:{items:state.agents.map(a => ({...a, online, healthy:online, busy:!!busy||controlUnknown, available:online&&!busy&&!controlUnknown,capabilities:{verification:false,permissions:false,forms:false,cancellation:false,resume:true}, ...(busy?{currentTask:{taskId:busy.taskId,status:busy.status}}:{})})),revision:state.revision},tasks:state.tasks.map(publicTask),conversations:state.conversations.map(c => this.conversationView(state,c))};
    }
    if (method !== 'ipc') throw fail('DESKTOP_METHOD', 'Unsupported browser host method.');
    if (p.op === 'request') { const r = state.requests.find(r => r.requestId === p.requestId); if (!r) throw fail('NOT_FOUND', 'Original browser request not found; absence is not proof of non-execution.'); return publicTask(this.task(state,r.taskId)); }
    if (p.op === 'task') return publicTask(this.task(state,p.taskId));
    if (p.op === 'conversation') {
      const c = state.conversations.find(c => c.conversationId === p.conversationId);
      if (!c) throw fail('NOT_FOUND', 'Original browser conversation not found.');
      return {...this.conversationView(state,c),items:state.tasks.filter(t => t.conversationId === c.conversationId).map(publicTask)};
    }
    if (p.op === 'operation') { const r = state.operations.find(o => o.operationId === p.operationId && (!p.taskId || o.taskId === p.taskId)); if (!r) throw fail('NOT_FOUND','Original browser operation not found.'); if(r.state==='unknown'){if(r.kind==='session.close')this.closeJob(r,true);if(r.kind==='cancel'&&r.proofMode==='content-not-authorized-v1')this.cancelJob(r,true);}return publicOperation(r); }
    if (p.op === 'pending') { this.task(state,p.taskId); return {permissions:[],forms:[]}; }
    if (p.op === 'cancel') return this.cancel(state,p);
    if (p.op === 'reconcile') return this.reconcile(state,p);
    if (p.op === 'session.close') return this.closeSession(state,p);
    if (!['submit','continue'].includes(p.op)) throw fail('ADAPTER_UNSUPPORTED','Browser operation is not implemented.');
    requireIdentity(p.requestId,'request'); text(p.message);
    if (p.workspace || p.model || p.providerID || p.mcp || p.teamScope) throw fail('ADAPTER_UNSUPPORTED','Browser tasks do not accept workspace, model or hosted MCP overrides.');
    const fingerprint = digest({op:p.op,agentId:p.agentId||null,conversationId:p.conversationId||null,message:p.message});
    const old = state.requests.find(r => r.requestId === p.requestId);
    if (old) { if (old.fingerprint !== fingerprint) throw fail('REQUEST_CONFLICT','Original browser request has different input.'); return publicTask(this.task(state,old.taskId)); }
    if (state.tasks.some(t => !terminal.has(t.status)) || state.operations.some(o => o.state === 'unknown')) throw fail('AGENT_BUSY','Original browser execution or control remains unresolved.');
    if (this.channel?.online !== true) throw fail('BROWSER_OFFLINE','Authenticated browser channel is offline.');
    const c = p.op === 'continue' ? state.conversations.find(c => c.conversationId === p.conversationId) : null;
    if (p.op === 'continue' && (!c || !this.conversationView(state,c).canContinue)) throw fail('CONVERSATION_BINDING','Original browser session cannot be resumed.');
    const agent = state.agents.find(a => a.agentId === (c?.targetAgent||p.agentId));
    if (!agent || p.agentId && p.agentId !== agent.agentId) throw fail('NODE_NOT_FOUND','Original browser agent not found.');
    const task = this.store.transact(s => {
      const task = {taskId:'browser-task-'+randomUUID(),executionId:randomUUID(),conversationId:c?.conversationId||'browser-conversation-'+randomUUID(),targetAgent:agent.agentId,requestId:p.requestId,message:p.message,status:'accepted',phase:'prepared',createdAt:now(),updatedAt:now(),lastSummary:'Browser request accepted.',lastSeq:0,browserSeq:0,browserHashes:[],outputRevision:0,events:[],knownBrowserInstances:this.channel.knownProfiles?.()||[this.browserInstanceId],bindingRevision:c?.bindingRevision||1,leaseEpoch:(s.revision+1),...(c?.binding?{binding:c.binding}:{})};
      s.requests.push({requestId:p.requestId,fingerprint,taskId:task.taskId}); s.tasks.push(task);
      const conversation = s.conversations.find(c => c.conversationId === task.conversationId);
      if (conversation) { conversation.lastTaskId = task.taskId; conversation.turns++;conversation.updatedAt=now(); }
      else s.conversations.push({conversationId:task.conversationId,targetAgent:agent.agentId,title:p.message.slice(0,100),turns:1,lastTaskId:task.taskId,createdAt:now(),updatedAt:now()});
      addEvent(task,'accepted'); return task;
    });
    try {this.observe(task);} catch {return this.unknown(task.taskId);}
    const job = this.dispatch(task).catch(error => this.serial(() => this.unknown(task.taskId,error.code))).finally(() => this.jobs.delete(job));
    // Surface storage failures through later reads; never restart a rejected job.
    this.jobs.add(job); job.catch(() => {});
    return publicTask(task);
  }
  unknown(id,code) {
    return this.store.transact(s => { const task = this.task(s,id); if (!terminal.has(task.status) && task.status !== 'unknown') { task.status='unknown';if(typeof code==='string'&&/^[A-Z_]{1,96}$/.test(code))task.uncertaintyReason=code; task.lastSummary='Original browser submission is unconfirmed; do not resend.'; addEvent(task,'unknown',{reason:task.lastSummary}); } return publicTask(task); });
  }
  async dispatch(original) {
    const base = this.metadata(original);
    const steps = original.binding ? [['session.resume','creating'],['message.prepare','preparing'],['message.send','dispatching']] : [['session.create','creating'],['message.prepare','preparing'],['message.send','dispatching']];
    for (const [method,phase] of steps) {
      const proceed = await this.serial(() => {
        if (this.closed) { this.unknown(original.taskId); return false; }
        const task = this.task(this.store.read(),original.taskId);
        if (terminal.has(task.status) || task.status === 'unknown') return false;
        this.store.transact(s => { this.task(s,original.taskId).phase=phase; }); return true;
      });
      if (!proceed) return;
      if(this.closed){await this.serial(()=>this.unknown(original.taskId));return;}
      // A timeout/throw at ANY step is ambiguous, never a reason to replay.
      const reply = await this.channel.request(method,{...base,operationId:original.taskId+':'+method,...(original.binding?{binding:original.binding}:{}),...(method==='message.send'?{message:{type:'text',text:original.message}}:{})});
      if (!reply || reply.requestId !== original.requestId || reply.executionId !== original.executionId || reply.bridgeSessionId !== original.conversationId) throw fail('RECEIPT_MISMATCH','Browser command acknowledgement does not match the original request.');
    }
  }
  cancel(state,p) {
    const task = this.task(state,p.taskId); requireIdentity(p.operationId,'operation');
    if(p.executionId&&p.executionId!==task.executionId)throw fail('EXECUTION_MISMATCH','Cancellation belongs to another execution.');
    const old = state.operations.find(o => o.operationId === p.operationId);
    if (old) { if (old.taskId !== task.taskId || old.kind !== 'cancel') throw fail('OPERATION_CONFLICT','Operation belongs to another task or action.'); return publicOperation(old); }
    if(state.operations.some(o=>o.taskId===task.taskId&&o.kind==='cancel'&&o.state==='unknown'))throw fail('AGENT_BUSY','Query the original cancellation operation.');
    const remote=!terminal.has(task.status)&&(['creating','preparing','dispatching'].includes(task.phase)||task.phase==='prepared'&&!!task.binding);
    if(remote&&this.channel?.online!==true)throw fail('BROWSER_OFFLINE','Original browser must prove that content was never authorized.');
    const receipt=this.store.transact(s => {
      const current = this.task(s,task.taskId);
      const safe = current.phase === 'prepared'&&!remote;
      const receipt = {operationId:p.operationId,taskId:task.taskId,kind:'cancel',state:remote?'unknown':safe||terminal.has(current.status)?'confirmed':'rejected',data:{status:safe?'cancelled':remote?'unknown':current.status,...(!remote&&!safe&&!terminal.has(current.status)?{code:'BROWSER_CANCEL_UNSUPPORTED'}:{})},...(remote?{proofMode:'content-not-authorized-v1',senderFence:current.phase==='dispatching'?'message-send-issued':'before-message-send',knownBrowserInstances:this.channel.knownProfiles?.()||[this.browserInstanceId]}:{})};
      if (safe) { current.status='cancelled'; current.phase='terminal'; addEvent(current,'cancelled',{reason:'Cancelled before any browser command was dispatched.'}); }
      if(remote&&current.status!=='unknown'){current.status='unknown';addEvent(current,'unknown',{reason:'Original cancellation awaits durable proof; no further send is allowed.'});}
      s.operations.push(receipt); return receipt;
    });
    if(remote)this.cancelJob(receipt,false);return publicOperation(receipt);
  }
  cancelJob(receipt,queryOnly) {
    if(this.controlJobs.has(receipt.operationId)||this.channel?.online!==true||this.closed)return;
    const task=this.task(this.store.read(),receipt.taskId),meta=this.metadata(task);
    const params={...meta,operationId:receipt.operationId,senderFence:receipt.senderFence};
    const job=Promise.resolve().then(async()=>{
      const reply=await this.channel.request(queryOnly?'operation.get':'task.cancel',params);
      if(queryOnly&&(reply?.operationId!==receipt.operationId||reply.method!=='task.cancel'||!['confirmed','rejected'].includes(reply.state)))return;
      const result=queryOnly?reply.result:reply;
      if(!result||Object.keys(meta).some(k=>result[k]!==meta[k])||result.operationId!==receipt.operationId||result.senderFence!==receipt.senderFence)throw fail('RECEIPT_MISMATCH','Original cancellation proof cannot be verified.');
      const rejected=result.state==='rejected'&&result.cancelled===false&&['BROWSER_CONTENT_ALREADY_AUTHORIZED','BROWSER_CANCELLATION_UNPROVEN'].includes(result.code);
      const proved=result.state==='confirmed'&&result.cancelled===true&&result.proof===receipt.proofMode&&result.contentAuthorized===false&&Number.isSafeInteger(result.sealedThroughSeq)&&result.sealedThroughSeq>=0;
      if(!rejected&&!proved||queryOnly&&reply.state!==result.state)throw fail('RECEIPT_MISMATCH','Cancellation acknowledgement is not execution proof.');
      await this.serial(()=>{if(this.closed)return;this.store.transact(s=>{
        const op=s.operations.find(o=>o.operationId===receipt.operationId),current=this.task(s,task.taskId);
        if(op.state!=='unknown')return;
        // A conflicting submitted/terminal event wins over an impossible proof.
        if(proved&&(current.browserSeq!==result.sealedThroughSeq||current.phase==='submitted'||terminal.has(current.status)))return;
        op.state=rejected?'rejected':'confirmed';op.data={status:proved?'cancelled':current.status,...(rejected?{code:result.code}:{proof:result.proof,sealedThroughSeq:result.sealedThroughSeq})};
        if(proved){current.status='cancelled';current.phase='terminal';current.finishedAt=now();addEvent(current,'cancelled',{reason:'Original extension durably sealed this request before content authorization.'});for(const other of s.operations)if(other.taskId===task.taskId&&other.kind==='reconcile'&&other.state==='unknown'){other.state='confirmed';other.data={status:'cancelled'};}}
      });});
    }).catch(()=>{}).finally(()=>{this.controlJobs.delete(receipt.operationId);this.jobs.delete(job);});
    this.controlJobs.set(receipt.operationId,job);this.jobs.add(job);
  }
  metadata(task){return {adapterId:this.adapter,payloadFingerprint:digest({type:'text',text:task.message}),requestId:task.requestId,taskId:task.taskId,executionId:task.executionId,bridgeSessionId:task.conversationId,browserInstanceId:this.browserInstanceId,bindingRevision:task.bindingRevision,leaseEpoch:task.leaseEpoch};}
  closeSession(state,p) {
    const task=this.task(state,p.taskId);requireIdentity(p.operationId,'operation');
    if(p.executionId&&p.executionId!==task.executionId)throw fail('EXECUTION_MISMATCH','Session close belongs to another execution.');
    if(!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<1)throw fail('INVALID_INPUT','Session close requires the original binding revision.');
    const old=state.operations.find(o=>o.operationId===p.operationId);
    if(old){if(old.kind!=='session.close'||old.taskId!==task.taskId||old.expectedRevision!==p.expectedRevision)throw fail('OPERATION_CONFLICT','Operation belongs to another session close or input.');return publicOperation(old);}
    const c=state.conversations.find(c=>c.conversationId===task.conversationId);
    if(c.lastTaskId!==task.taskId||p.expectedRevision!==(c.bindingRevision||task.bindingRevision))throw fail('CONVERSATION_BINDING','Close requires the latest original turn and binding revision.');
    if(!terminal.has(task.status)||state.tasks.some(t=>!terminal.has(t.status))||state.operations.some(o=>o.state==='unknown'))throw fail('AGENT_BUSY','Original execution or control remains unresolved; closing cannot release it.');
    const local=c.closed===true||task.status==='cancelled'&&task.browserSeq===0&&!task.binding;
    if(!local&&this.channel?.online!==true)throw fail('BROWSER_OFFLINE','Original browser must confirm its session tombstone.');
    const receipt=this.store.transact(s=>{
      const conversation=s.conversations.find(row=>row.conversationId===c.conversationId);
      const row={operationId:p.operationId,taskId:task.taskId,conversationId:c.conversationId,expectedRevision:p.expectedRevision,kind:'session.close',state:local?'confirmed':'unknown',data:{closed:local},knownBrowserInstances:this.channel.knownProfiles?.()||[this.browserInstanceId]};
      conversation.closeState=row.state;conversation.updatedAt=now();if(local)conversation.closed=true;s.operations.push(row);return row;
    });
    if(!local)this.closeJob(receipt,false);return publicOperation(receipt);
  }
  closeJob(receipt,queryOnly) {
    if(this.controlJobs.has(receipt.operationId)||this.channel?.online!==true||this.closed)return;
    const task=this.task(this.store.read(),receipt.taskId);
    const params={...this.metadata(task),operationId:receipt.operationId,expectedRevision:receipt.expectedRevision};
    const job=Promise.resolve().then(async()=>{
      const reply=await this.channel.request(queryOnly?'operation.get':'session.close',params);
      if(queryOnly&&(reply?.operationId!==receipt.operationId||reply.method!=='session.close'||!['confirmed','rejected'].includes(reply.state)))return;
      const result=queryOnly?reply.result:reply;
      const rejected=result?.state==='rejected'&&result.closed===false&&['BROWSER_SESSION_BUSY','BROWSER_SESSION_MISMATCH'].includes(result.code);
      if(result?.requestId!==task.requestId||result.executionId!==task.executionId||result.bridgeSessionId!==task.conversationId||!rejected&&result.closed!==true||queryOnly&&reply.state!==(rejected?'rejected':'confirmed'))throw fail('RECEIPT_MISMATCH','Original session close has no verified tombstone or refusal.');
      await this.serial(()=>{if(this.closed)return;this.store.transact(s=>{
        const op=s.operations.find(o=>o.operationId===receipt.operationId),c=s.conversations.find(c=>c.conversationId===task.conversationId);
        if(op.state!=='unknown')return;op.state=rejected?'rejected':'confirmed';op.data={closed:!rejected,...(rejected?{code:result.code}:{})};if(!rejected)c.closed=true;c.closeState=op.state;c.updatedAt=now();
      });});
    }).catch(()=>{}).finally(()=>{this.controlJobs.delete(receipt.operationId);this.jobs.delete(job);});
    this.controlJobs.set(receipt.operationId,job);this.jobs.add(job);
  }
  reconcile(state,p) {
    const task=this.task(state,p.taskId);requireIdentity(p.operationId,'operation');
    if(p.executionId&&p.executionId!==task.executionId)throw fail('EXECUTION_MISMATCH','Reconciliation belongs to another execution.');
    const old=state.operations.find(o=>o.operationId===p.operationId);
    if(old&&(old.kind!=='reconcile'||old.taskId!==task.taskId))throw fail('OPERATION_CONFLICT','Operation belongs to another task or action.');
    const receipt=old||this.store.transact(s=>{const row={operationId:p.operationId,taskId:task.taskId,kind:'reconcile',state:terminal.has(task.status)?'confirmed':'unknown',data:{status:task.status}};s.operations.push(row);return row;});
    if(receipt.state==='unknown'&&!this.controlJobs.has(p.operationId)) {
      // Outside the Host serial lane: an event can be ahead of the command
      // reply on the same socket and must be committed before it is ACKed.
      const job=Promise.resolve().then(async()=>{
        if(this.closed||this.channel?.online!==true)return;
        const result=await require('./browser-output-reconcile.cjs').reconcileOutput(this,{taskId:task.taskId,operationId:p.operationId});
        if(!result||result.requestId!==task.requestId||result.executionId!==task.executionId||result.bridgeSessionId!==task.conversationId)throw fail('RECEIPT_MISMATCH','Original output subscription receipt does not match.');
      }).catch(()=>{}).finally(()=>{this.controlJobs.delete(p.operationId);this.jobs.delete(job);});
      this.controlJobs.set(p.operationId,job);this.jobs.add(job);
    }
    return receipt;
  }
  acceptEvent(input) {
    return this.serial(() => {
      if (this.closed) throw fail('ADAPTER_CLOSED','Browser observer is closed.');
      const e = event(input), hash = digest(e);
      const state = this.store.read(), original = this.task(state,e.taskId);
      if (e.browserInstanceId !== this.browserInstanceId || e.requestId !== original.requestId || e.executionId !== original.executionId || e.bridgeSessionId !== original.conversationId || e.bindingRevision !== original.bindingRevision || e.leaseEpoch !== original.leaseEpoch) throw fail('BROWSER_SESSION_MISMATCH','Browser event belongs to another execution or page lease.');
      if (e.seq <= original.browserSeq) { if (original.browserHashes[e.seq-1] !== hash) throw fail('EVENT_CONFLICT','Browser sequence has different content.'); return {throughSeq:original.browserSeq}; }
      if (e.seq !== original.browserSeq+1) throw fail('EVENT_GAP','Read the original missing browser events.');
      if (terminal.has(original.status)) throw fail('ILLEGAL_STATE','Original browser task already ended.');
      return this.store.transact(s => {
        const task = this.task(s,e.taskId), c = s.conversations.find(c => c.conversationId === task.conversationId);
        if (e.kind === 'submitted') {
          if (task.phase !== 'dispatching' || task.binding && (task.binding.sessionKey !== e.binding.sessionKey || task.binding.documentId!==e.binding.documentId || task.binding.userAnchor === e.binding.userAnchor)) throw fail('BROWSER_SESSION_MISMATCH','Unexpected browser submission binding.');
          task.binding=e.binding; c.binding=e.binding; c.bindingRevision=e.bindingRevision; task.phase='submitted'; task.status='running'; addEvent(task,'started');
        } else if (e.kind === 'unknown') { task.status='unknown'; addEvent(task,'unknown',{reason:e.text||'Browser observation lost.'}); }
        else {
          if (task.phase !== 'submitted' || !task.binding) throw fail('BROWSER_SUBMISSION_UNKNOWN','Output requires the original submitted binding.');
          if (e.kind === 'output.snapshot') {
            if (e.revision <= task.outputRevision) throw fail('EVENT_CONFLICT','Output revision did not advance.');
            task.outputRevision=e.revision; task.lastSummary=e.text; addEvent(task,'output',{text:e.text,mode:'replace',revision:e.revision});
          } else {
            if (e.kind === 'cancelled') throw fail('BROWSER_CANCEL_UNSUPPORTED','No validated browser Stop driver is enabled.');
            task.status=e.kind==='completed'?'succeeded':'failed'; task.phase='terminal'; task.finishedAt=now();
            if (task.status==='succeeded') { if(e.continuation){task.binding={...task.binding,...e.continuation};c.binding=task.binding;}task.result={agentId:task.targetAgent,message:e.text}; task.lastSummary=e.text; addEvent(task,'completed',{result:task.result}); }
            else { task.error=e.error||{code:'BROWSER_PROVIDER_ERROR',message:'Original page reported failure.'}; addEvent(task,'failed',{error:task.error}); }
          }
        }
        task.browserSeq=e.seq; task.browserHashes.push(hash);
        if(terminal.has(task.status))for(const op of s.operations)if(op.taskId===task.taskId&&op.kind==='reconcile'&&op.state==='unknown'){op.state='confirmed';op.data={status:task.status};}
        return {throughSeq:task.browserSeq};
      });
    });
  }
  close() { this.closed=true;for(const release of this.observations.values())release();this.observations.clear(); }
}
module.exports = {BrowserAdapterHost};
