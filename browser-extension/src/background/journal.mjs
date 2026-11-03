import {canonical,digest} from '../shared/wire.mjs';
const encode=value=>JSON.stringify(canonical(value));
const identity=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
const ended=r=>['completed','failed','cancelled'].includes(r.phase);
const continuation=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3&&Object.keys(value).every(k=>['transcriptFingerprint','assistantAnchor','historyRevision'].includes(k))&&/^[a-f0-9]{64}$/.test(value.transcriptFingerprint||'')&&identity(value.assistantAnchor)&&Number.isSafeInteger(value.historyRevision)&&value.historyRevision>=0;
const baseKeys=['requestId','taskId','executionId','bridgeSessionId','browserInstanceId','bindingRevision','leaseEpoch'];
function metadata(p) {
  if(!p||!['chatgpt-web','kimi-web'].includes(p.adapterId))throw Error('BROWSER_ADAPTER_UNSUPPORTED');
  for(const key of baseKeys.slice(0,5))if(!identity(p[key]))throw Error('BROWSER_INVALID_IDENTITY');
  for(const key of ['bindingRevision','leaseEpoch'])if(!Number.isSafeInteger(p[key])||p[key]<1)throw Error('BROWSER_INVALID_FENCE');
  if(typeof p.payloadFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(p.payloadFingerprint))throw Error('BROWSER_INVALID_FINGERPRINT');
  return Object.fromEntries(['adapterId',...baseKeys,'payloadFingerprint'].map(k=>[k,p[k]]));
}
function pageBinding(binding,adapterId) {
  if(!binding||!Number.isSafeInteger(binding.tabId)||binding.tabId<0||!identity(binding.documentId)||!identity(binding.pageEpoch)||typeof binding.url!=='string')throw Error('BROWSER_BINDING_INVALID');
  const url=new URL(binding.url),hosts=adapterId==='chatgpt-web'?['chatgpt.com']:['www.kimi.com','kimi.com'];
  if(url.protocol!=='https:'||!hosts.includes(url.hostname)||url.port||url.username||url.password||url.search||url.hash)throw Error('BROWSER_BINDING_INVALID');
  return structuredClone(binding);
}
function lock(state,p) {
  const key=p.browserInstanceId+':'+p.adapterId;
  const prior=state.locks.find(l=>l.key===key);
  if(prior&&prior.requestId!==p.requestId)throw Error('BROWSER_RESOURCE_BUSY');
  if(!prior)state.locks.push({key,requestId:p.requestId});
}
function original(state,p) {
  const fields=metadata(p),r=state.requests.find(r=>r.requestId===p.requestId);
  if(!r)throw Error('BROWSER_REQUEST_NOT_FOUND');
  if(encode(r.meta)!==encode(fields))throw Error('BROWSER_REQUEST_CONFLICT');
  return r;
}
function controlTarget(state,p) {
  const meta=metadata(p),request=state.requests.find(r=>r.requestId===p.requestId),operations=state.operations.filter(o=>o.meta.requestId===p.requestId);
  if(request&&encode(request.meta)!==encode(meta)||operations.some(o=>encode(o.meta)!==encode(meta)))throw Error('BROWSER_REQUEST_CONFLICT');
  const seal=operations.find(o=>o.method==='task.cancel'&&o.state==='confirmed'&&o.result?.proof==='content-not-authorized-v1'&&o.result.contentAuthorized===false);
  // Absence never proves cancellation. Only the original durable seal allows
  // health/close to address an existing session without a prepared request row.
  if(!request&&!seal)throw Error('BROWSER_REQUEST_NOT_FOUND');
  const session=state.sessions.find(s=>s.bridgeSessionId===p.bridgeSessionId),owned=!!session&&session.adapterId===p.adapterId&&session.browserInstanceId===p.browserInstanceId;
  const later=[...state.requests,...state.operations].some(r=>r.meta.bridgeSessionId===p.bridgeSessionId&&r.meta.requestId!==p.requestId&&r.meta.leaseEpoch>=p.leaseEpoch);
  const latest=owned&&!later&&(session.lastRequestId===p.requestId||!request&&!!seal);
  return {request,session,owned,latest,...(!request?{recoverySealOperationId:seal.operationId}:{})};
}
function unsealed(state,p) {
  if(state.operations.some(o=>o.method==='task.cancel'&&o.meta.requestId===p.requestId&&o.state==='confirmed'))throw Error('BROWSER_REQUEST_CANCELLED');
}
function append(state,r,kind,data={}) {
  const allowed={submitted:['binding'], 'output.snapshot':['text','revision'], completed:['text','continuation'],failed:['error'],unknown:['text']};
  if(!allowed[kind]||Object.keys(data).some(k=>!allowed[kind].includes(k))||ended(r))throw Error('BROWSER_EVENT_INVALID');
  if(['submitted','output.snapshot','completed','failed'].includes(kind)&&!['dispatching','submitted','unknown'].includes(r.phase))throw Error('BROWSER_NOT_DISPATCHED');
  if(['submitted','output.snapshot','completed','failed'].includes(kind)&&r.contentAuthorized===false)throw Error('BROWSER_NOT_DISPATCHED');
  if(['output.snapshot','completed','failed'].includes(kind)&&!r.submitted)throw Error('BROWSER_SUBMISSION_UNKNOWN');
  if(data.continuation!==undefined&&!continuation(data.continuation))throw Error('BROWSER_EVENT_INVALID');
  if(['output.snapshot','completed'].includes(kind)&&(typeof data.text!=='string'||!data.text.trim()||new TextEncoder().encode(data.text).length>262144))throw Error('BROWSER_OUTPUT_LIMIT');
  const session=state.sessions.find(s=>s.bridgeSessionId===r.bridgeSessionId);
  if(kind==='submitted') {
    const b=data.binding;
    if(r.submitted||!b||Object.keys(b).some(k=>!['sessionKey','userAnchor','documentId'].includes(k))||!identity(b.sessionKey)||!identity(b.userAnchor)||b.documentId!==r.page.documentId||session.sessionKey&&session.sessionKey!==b.sessionKey||session.lastUserAnchor===b.userAnchor)throw Error('BROWSER_SESSION_MISMATCH');
    r.submitted=structuredClone(b);session.sessionKey=b.sessionKey;session.lastUserAnchor=b.userAnchor;delete session.continuation;
    r.phase='submitted';
  }
  if(kind==='output.snapshot') {
    if(!Number.isSafeInteger(data.revision)||data.revision<=(r.outputRevision||0))throw Error('BROWSER_OUTPUT_REVISION');
    r.outputRevision=data.revision;r.lastOutput=data.text;
  }
  if(kind==='failed'&&(!data.error||!identity(data.error.code)||typeof data.error.message!=='string'||new TextEncoder().encode(data.error.message).length>4096))throw Error('BROWSER_EVENT_INVALID');
  const e={...Object.fromEntries(baseKeys.map(k=>[k,r.meta[k]])),kind,...structuredClone(data),seq:++r.lastSeq};
  state.events.push(e);
  if(['completed','failed'].includes(kind)){r.phase=kind;r.terminal=e;if(kind==='completed'&&data.continuation)session.continuation=structuredClone(data.continuation);state.locks=state.locks.filter(l=>l.requestId!==r.requestId);}
  if(kind==='unknown')r.phase='unknown';
  return e;
}
export class BrowserJournal {
  constructor(store){this.store=store;}
  cancel(p) {
    const meta=metadata(p);
    if(!identity(p.operationId)||!['before-message-send','message-send-issued'].includes(p.senderFence))throw Error('BROWSER_OPERATION_INVALID');
    const fingerprint=encode({method:'task.cancel',meta,senderFence:p.senderFence});
    return this.store.mutate(state=>{
      const old=state.operations.find(o=>o.operationId===p.operationId);
      if(old){if(old.method!=='task.cancel'||old.fingerprint!==fingerprint)throw Error('BROWSER_OPERATION_CONFLICT');return old.result;}
      const r=state.requests.find(r=>r.requestId===p.requestId),ops=state.operations.filter(o=>o.meta.requestId===p.requestId);
      if(r&&encode(r.meta)!==encode(meta)||ops.some(o=>encode(o.meta)!==encode(meta)))throw Error('BROWSER_REQUEST_CONFLICT');
      let code;
      if(r&&(r.submitted||ended(r)||r.contentAuthorized===true))code='BROWSER_CONTENT_ALREADY_AUTHORIZED';
      else if(r?r.contentAuthorized!==false:p.senderFence!=='before-message-send')code='BROWSER_CANCELLATION_UNPROVEN';
      const result={...meta,operationId:p.operationId,senderFence:p.senderFence,state:code?'rejected':'confirmed',cancelled:!code,...(code?{code}:{proof:'content-not-authorized-v1',contentAuthorized:false,sealedThroughSeq:r?.lastSeq??0})};
      state.operations.push({operationId:p.operationId,method:'task.cancel',meta,fingerprint,state:result.state,result});
      if(!code){
        if(r){r.phase='cancelled';r.cancelProofOperationId=p.operationId;}
        for(const op of ops)if(op.state==='unknown'&&['session.create','session.resume'].includes(op.method)){op.state='rejected';op.result={requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId,state:'rejected',code:'BROWSER_REQUEST_CANCELLED'};}
        state.locks=state.locks.filter(l=>l.requestId!==p.requestId);
      }
      return result;
    });
  }
  closeSession(p) {
    const meta=metadata(p);
    if(!identity(p.operationId)||p.expectedRevision!==meta.bindingRevision)throw Error('BROWSER_OPERATION_INVALID');
    const fingerprint=encode({method:'session.close',meta,expectedRevision:p.expectedRevision});
    return this.store.mutate(state=>{
      const old=state.operations.find(o=>o.operationId===p.operationId);
      if(old){if(old.method!=='session.close'||old.fingerprint!==fingerprint)throw Error('BROWSER_OPERATION_CONFLICT');return old.result;}
      const target=controlTarget(state,p),r=target.request,session=target.session;
      let code;
      if(!target.latest||session.closed)code='BROWSER_SESSION_MISMATCH';
      else if(r&&!ended(r)||state.requests.some(r=>r.meta.browserInstanceId===p.browserInstanceId&&r.meta.adapterId===p.adapterId&&!ended(r))||state.operations.some(o=>o.meta.browserInstanceId===p.browserInstanceId&&o.meta.adapterId===p.adapterId&&o.state==='unknown'))code='BROWSER_SESSION_BUSY';
      // Closing is one durable local tombstone. It does not close a tab, stop
      // generation, delete Provider history or perform any page action.
      const result={requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId,closed:!code,...(code?{state:'rejected',code}:{})};
      if(!code)session.closed=true;
      state.operations.push({operationId:p.operationId,method:'session.close',meta,fingerprint,state:code?'rejected':'confirmed',result,...(!code&&target.recoverySealOperationId?{recoverySealOperationId:target.recoverySealOperationId}:{})});
      return result;
    });
  }
  beginOperation(method,p) {
    if(!['session.create','session.resume'].includes(method)||!identity(p.operationId))throw Error('BROWSER_OPERATION_INVALID');
    const meta=metadata(p),fingerprint=encode({method,meta,binding:p.binding??null});
    return this.store.mutate(state=>{
      unsealed(state,p);
      const old=state.operations.find(o=>o.operationId===p.operationId);
      if(old){if(old.fingerprint!==fingerprint)throw Error('BROWSER_OPERATION_CONFLICT');return {execute:false,operation:old};}
      lock(state,p);
      const session=state.sessions.find(s=>s.bridgeSessionId===p.bridgeSessionId);
      if(session&&(session.browserInstanceId!==p.browserInstanceId||session.adapterId!==p.adapterId))throw Error('BROWSER_SESSION_MISMATCH');
      if(method==='session.create'&&session||method!=='session.create'&&!session)throw Error('BROWSER_SESSION_MISMATCH');
      if(session?.closed)throw Error('BROWSER_SESSION_MISSING');
      if(method==='session.resume'&&(!p.binding||session.sessionKey!==p.binding.sessionKey||session.lastUserAnchor!==p.binding.userAnchor))throw Error('BROWSER_SESSION_MISMATCH');
      if(method==='session.resume'&&(!session.continuation||Object.keys(session.continuation).some(k=>session.continuation[k]!==p.binding[k])))throw Error('BROWSER_CONTINUATION_UNVERIFIED');
      const operation={operationId:p.operationId,fingerprint,method,meta,state:'unknown'};
      state.operations.push(operation);return {execute:true,operation};
    });
  }
  finishOperation(p,binding) {
    const meta=metadata(p);
    return this.store.mutate(state=>{
      unsealed(state,p);
      const op=state.operations.find(o=>o.operationId===p.operationId);
      if(!op||encode(op.meta)!==encode(meta))throw Error('BROWSER_OPERATION_CONFLICT');
      if(op.state==='confirmed')return op.result;
      const session=state.sessions.find(s=>s.bridgeSessionId===p.bridgeSessionId);
      if(!['session.create','session.resume'].includes(op.method))throw Error('BROWSER_OPERATION_INVALID');
      const page=pageBinding(binding,p.adapterId);
      if(op.method==='session.resume'&&session&&['tabId','documentId','pageEpoch'].some(k=>page[k]!==session.page[k]))throw Error('BROWSER_SESSION_MISMATCH');
      if(session){session.page=page;session.lastRequestId=p.requestId;}
      else state.sessions.push({bridgeSessionId:p.bridgeSessionId,adapterId:p.adapterId,browserInstanceId:p.browserInstanceId,page,closed:false,lastRequestId:p.requestId});
      op.state='confirmed';op.result={requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId};return op.result;
    });
  }
  async session(id){const s=(await this.store.read()).sessions.find(s=>s.bridgeSessionId===id);if(!s||s.closed)throw Error('BROWSER_SESSION_MISSING');return structuredClone(s);}
  prepare(p) {
    const meta=metadata(p);
    return this.store.mutate(state=>{
      unsealed(state,p);
      const prior=state.requests.find(r=>r.requestId===p.requestId);
      if(prior){if(encode(prior.meta)!==encode(meta))throw Error('BROWSER_REQUEST_CONFLICT');return prior;}
      const s=state.sessions.find(s=>s.bridgeSessionId===p.bridgeSessionId&&!s.closed);
      if(!s||s.lastRequestId!==p.requestId||s.adapterId!==p.adapterId||s.browserInstanceId!==p.browserInstanceId)throw Error('BROWSER_SESSION_MISMATCH');
      lock(state,p);
      const r={requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId,meta,page:s.page,phase:'prepared',contentAuthorized:false,lastSeq:0,ackSeq:0,outputRevision:0};
      state.requests.push(r);return r;
    });
  }
  async claimSend(p) {
    if(p.message?.type!=='text'||typeof p.message.text!=='string'||!p.message.text.trim()||new TextEncoder().encode(p.message.text).length>65536)throw Error('BROWSER_INPUT_LIMIT');
    const fingerprint=await digest(p.message);
    if(fingerprint!==p.payloadFingerprint)throw Error('BROWSER_REQUEST_CONFLICT');
    return this.store.mutate(state=>{
      unsealed(state,p);
      const r=original(state,p);
      if(r.inputFingerprint&&r.inputFingerprint!==fingerprint)throw Error('BROWSER_REQUEST_CONFLICT');
      if(r.phase!=='prepared')return {execute:false,request:r};
      lock(state,p);r.phase='dispatching';r.inputFingerprint=fingerprint;
      return {execute:true,request:r};
    });
  }
  authorizeContent(p) {
    return this.store.mutate(state=>{
      unsealed(state,p);const r=original(state,p);
      if(r.phase!=='dispatching'||r.contentAuthorized===true)throw Error('BROWSER_CONTENT_AUTHORIZATION_REFUSED');
      r.contentAuthorized=true;return {authorized:true};
    });
  }
  append(p,kind,data){return this.store.mutate(s=>append(s,original(s,p),kind,data));}
  settleIntegrityFailure(p,proof){return this.store.mutate(state=>{
    const r=original(state,p),target=controlTarget(state,p);
    if(ended(r))return r.terminal;
    if(p.observeTerminal!=='integrity-failure-v1'||r.phase!=='unknown'||!r.submitted||r.contentAuthorized!==true||!target.owned||!target.latest||target.session.closed)throw Error('BROWSER_OBSERVATION_UNPROVEN');
    if(!proof||Object.keys(proof).length!==9||Object.keys(proof).some(k=>!['observed','proof','documentId','pageEpoch','sessionKey','userAnchor','assistantAnchor','terminalFingerprint','stableForMs'].includes(k))||proof.observed!==true||proof.proof!=='bound-terminal-v1'||proof.documentId!==r.page.documentId||proof.pageEpoch!==r.page.pageEpoch||proof.sessionKey!==r.submitted.sessionKey||proof.userAnchor!==r.submitted.userAnchor||!identity(proof.assistantAnchor)||!/^[a-f0-9]{64}$/.test(proof.terminalFingerprint||'')||proof.stableForMs!==1500)throw Error('BROWSER_OBSERVATION_UNPROVEN');
    r.integrityResolution=structuredClone(proof);
    return append(state,r,'failed',{error:{code:'BROWSER_CONTEXT_INTEGRITY_LOST',message:'The original submitted generation ended, but conversation integrity could not be verified. Do not replay the original request.'}});
  });}
  recover() {
    return this.store.mutate(state=>{
      const recovered=[];
      for(const r of state.requests)if(['dispatching','submitted'].includes(r.phase))recovered.push(append(state,r,'unknown',{text:'Extension worker restarted; original submission remains unconfirmed.'}));
      return recovered;
    });
  }
  invalidatePage(tabId,reason,documentId) {
    return this.store.mutate(state=>{
      const events=[];
      for(const r of state.requests)if(r.page.tabId===tabId&&(!documentId||r.page.documentId===documentId)&&!ended(r)&&r.phase!=='unknown')events.push(append(state,r,'unknown',{text:reason}));
      return events;
    });
  }
  async outbox(executionId) {return (await this.store.read()).events.filter(e=>!executionId||e.executionId===executionId);}
  acknowledge(executionId,throughSeq) {
    return this.store.mutate(state=>{
      const r=state.requests.find(r=>r.executionId===executionId);
      if(!r||!Number.isSafeInteger(throughSeq)||throughSeq<0||throughSeq>r.lastSeq)throw Error('BROWSER_ACK_INVALID');
      r.ackSeq=Math.max(r.ackSeq,throughSeq);state.events=state.events.filter(e=>e.executionId!==executionId||e.seq>r.ackSeq);
    });
  }
  async request(requestId){const r=(await this.store.read()).requests.find(r=>r.requestId===requestId);if(!r)throw Error('BROWSER_REQUEST_NOT_FOUND');return structuredClone(r);}
  async operation(p){
    if(!identity(p.operationId))throw Error('BROWSER_OPERATION_INVALID');
    const meta=metadata(p),op=(await this.store.read()).operations.find(o=>o.operationId===p.operationId);
    if(!op)throw Error('BROWSER_OPERATION_NOT_FOUND');
    if(encode(op.meta)!==encode(meta))throw Error('BROWSER_OPERATION_CONFLICT');
    return structuredClone({operationId:op.operationId,method:op.method,state:op.state,...(op.result?{result:op.result}:{})});
  }
  async originalRequest(p){const r=await this.request(p.requestId);if(encode(r.meta)!==encode(metadata(p)))throw Error('BROWSER_REQUEST_CONFLICT');return r;}
  async readControlTarget(p){
    const state=await this.store.read(),target=controlTarget(state,p);
    const blocked=state.requests.some(r=>r.meta.browserInstanceId===p.browserInstanceId&&r.meta.adapterId===p.adapterId&&!ended(r))||state.operations.some(o=>o.meta.browserInstanceId===p.browserInstanceId&&o.meta.adapterId===p.adapterId&&o.state==='unknown');
    return structuredClone({...target,blocked});
  }
}
