const empty=()=>({version:1,revision:0,requests:[],operations:[],sessions:[],locks:[],events:[]});
const proof=p=>!!p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===3&&Object.keys(p).every(k=>['transcriptFingerprint','assistantAnchor','historyRevision'].includes(k))&&typeof p.transcriptFingerprint==='string'&&/^[a-f0-9]{64}$/.test(p.transcriptFingerprint)&&typeof p.assistantAnchor==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(p.assistantAnchor)&&Number.isSafeInteger(p.historyRevision)&&p.historyRevision>=0;
export function validate(state) {
  if(!state||state.version!==1||!Number.isSafeInteger(state.revision)||state.revision<0)throw Error('BROWSER_JOURNAL_INVALID');
  for(const [key,id] of [['requests','requestId'],['operations','operationId'],['sessions','bridgeSessionId'],['locks','key']]) {
    if(!Array.isArray(state[key])||state[key].some(r=>!r||typeof r[id]!=='string')||new Set(state[key].map(r=>r[id])).size!==state[key].length)throw Error('BROWSER_JOURNAL_INVALID');
  }
  if(!Array.isArray(state.events))throw Error('BROWSER_JOURNAL_INVALID');
  if(state.events.some(e=>!e||!state.requests.some(r=>r.executionId===e.executionId)))throw Error('BROWSER_JOURNAL_INVALID');
  for(const op of state.operations)if(!['unknown','confirmed','rejected'].includes(op.state)||!op.meta||typeof op.fingerprint!=='string'||op.state!=='unknown'&&(!op.result||op.result.requestId!==op.meta.requestId||op.result.executionId!==op.meta.executionId||op.result.bridgeSessionId!==op.meta.bridgeSessionId))throw Error('BROWSER_JOURNAL_INVALID');
  for(const op of state.operations){
    if(op.method==='task.cancel'&&(!['confirmed','rejected'].includes(op.state)||op.result?.operationId!==op.operationId||op.result?.state!==op.state||!['before-message-send','message-send-issued'].includes(op.result?.senderFence)||Object.keys(op.meta).some(k=>op.result[k]!==op.meta[k])||(op.state==='confirmed'?(op.result.cancelled!==true||op.result.proof!=='content-not-authorized-v1'||op.result.contentAuthorized!==false):(op.result.cancelled!==false||!['BROWSER_CONTENT_ALREADY_AUTHORIZED','BROWSER_CANCELLATION_UNPROVEN'].includes(op.result.code)))))throw Error('BROWSER_JOURNAL_INVALID');
    if(op.state==='rejected'&&!['session.close','task.cancel'].includes(op.method)&&(!['session.create','session.resume'].includes(op.method)||op.result?.code!=='BROWSER_REQUEST_CANCELLED'||!state.operations.some(c=>c.method==='task.cancel'&&c.state==='confirmed'&&c.meta.requestId===op.meta.requestId)))throw Error('BROWSER_JOURNAL_INVALID');
    if(op.method==='task.cancel'&&op.state==='confirmed'&&(state.requests.some(r=>r.requestId===op.meta.requestId&&(r.phase!=='cancelled'||Object.keys(op.meta).some(k=>r.meta?.[k]!==op.meta[k])))||state.operations.some(o=>o.meta.requestId===op.meta.requestId&&o.state==='unknown')))throw Error('BROWSER_JOURNAL_INVALID');
    if(op.method==='task.cancel'&&op.state==='confirmed'&&(!Number.isSafeInteger(op.result.sealedThroughSeq)||op.result.sealedThroughSeq<0||op.result.sealedThroughSeq!==(state.requests.find(r=>r.requestId===op.meta.requestId)?.lastSeq??0)))throw Error('BROWSER_JOURNAL_INVALID');
  }
  for(const op of state.operations)if(op.method==='session.close'&&(op.state==='confirmed'?(op.result?.closed!==true||!state.sessions.some(s=>s.bridgeSessionId===op.meta.bridgeSessionId&&s.closed===true)):(op.state!=='rejected'||op.result?.closed!==false||op.result?.state!=='rejected'||!['BROWSER_SESSION_BUSY','BROWSER_SESSION_MISMATCH'].includes(op.result?.code))))throw Error('BROWSER_JOURNAL_INVALID');
  for(const op of state.operations)if(op.recoverySealOperationId!==undefined&&(op.method!=='session.close'||op.state!=='confirmed'||!state.operations.some(seal=>seal.operationId===op.recoverySealOperationId&&seal.method==='task.cancel'&&seal.state==='confirmed'&&seal.result?.proof==='content-not-authorized-v1'&&seal.result.contentAuthorized===false&&Object.keys(op.meta).every(k=>seal.meta[k]===op.meta[k]))))throw Error('BROWSER_JOURNAL_INVALID');
  for(const session of state.sessions)if(typeof session.closed!=='boolean'||session.closed&&state.requests.some(r=>r.bridgeSessionId===session.bridgeSessionId&&!['completed','failed','cancelled'].includes(r.phase)))throw Error('BROWSER_JOURNAL_INVALID');
  for(const session of state.sessions)if(session.continuation!==undefined&&(!proof(session.continuation)||!state.requests.some(r=>r.bridgeSessionId===session.bridgeSessionId&&r.phase==='completed'&&r.submitted?.userAnchor===session.lastUserAnchor&&r.terminal?.continuation&&Object.keys(session.continuation).every(k=>r.terminal.continuation[k]===session.continuation[k]))))throw Error('BROWSER_JOURNAL_INVALID');
  for(const key of ['executionId','taskId'])if(new Set(state.requests.map(r=>r.meta?.[key])).size!==state.requests.length)throw Error('BROWSER_JOURNAL_INVALID');
  for(const r of state.requests) {
    if(!['prepared','dispatching','submitted','unknown','completed','failed','cancelled'].includes(r.phase)||!Number.isSafeInteger(r.lastSeq)||r.lastSeq<0||!Number.isSafeInteger(r.ackSeq)||r.ackSeq<0||r.ackSeq>r.lastSeq||!state.sessions.some(s=>s.bridgeSessionId===r.bridgeSessionId))throw Error('BROWSER_JOURNAL_INVALID');
    const retained=state.events.filter(e=>e.executionId===r.executionId);
    if(retained.length!==r.lastSeq-r.ackSeq||retained.some((e,i)=>e.seq!==r.ackSeq+i+1))throw Error('BROWSER_JOURNAL_INVALID');
    if(!r.meta||r.meta.requestId!==r.requestId||r.meta.executionId!==r.executionId||r.meta.bridgeSessionId!==r.bridgeSessionId||!(/^[a-f0-9]{64}$/).test(r.meta.payloadFingerprint||''))throw Error('BROWSER_JOURNAL_INVALID');
    if(r.contentAuthorized!==undefined&&typeof r.contentAuthorized!=='boolean'||r.submitted&&r.contentAuthorized===false||r.phase==='cancelled'&&(r.contentAuthorized!==false||r.submitted||!state.operations.some(o=>o.operationId===r.cancelProofOperationId&&o.method==='task.cancel'&&o.state==='confirmed'&&Object.keys(r.meta).every(k=>o.meta[k]===r.meta[k]))))throw Error('BROWSER_JOURNAL_INVALID');
    if(['dispatching','submitted','completed','failed'].includes(r.phase)&&r.inputFingerprint!==r.meta.payloadFingerprint)throw Error('BROWSER_JOURNAL_INVALID');
    if(['completed','failed'].includes(r.phase)&&(!r.terminal||r.terminal.kind!==r.phase||r.terminal.executionId!==r.executionId||r.terminal.seq>r.lastSeq||!r.submitted))throw Error('BROWSER_JOURNAL_INVALID');
    if(r.terminal?.continuation!==undefined&&(r.terminal.kind!=='completed'||!proof(r.terminal.continuation))||retained.some(e=>e.continuation!==undefined&&(e.kind!=='completed'||!proof(e.continuation))))throw Error('BROWSER_JOURNAL_INVALID');
    if(r.integrityResolution!==undefined){const v=r.integrityResolution;if(!v||Object.keys(v).length!==9||Object.keys(v).some(k=>!['observed','proof','documentId','pageEpoch','sessionKey','userAnchor','assistantAnchor','terminalFingerprint','stableForMs'].includes(k))||r.phase!=='failed'||r.terminal?.error?.code!=='BROWSER_CONTEXT_INTEGRITY_LOST'||r.contentAuthorized!==true||!r.submitted||v.observed!==true||v.proof!=='bound-terminal-v1'||v.documentId!==r.page.documentId||v.pageEpoch!==r.page.pageEpoch||v.sessionKey!==r.submitted.sessionKey||v.userAnchor!==r.submitted.userAnchor||typeof v.assistantAnchor!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(v.assistantAnchor)||!/^[a-f0-9]{64}$/.test(v.terminalFingerprint||'')||v.stableForMs!==1500)throw Error('BROWSER_JOURNAL_INVALID');}
    if(retained.some(e=>['requestId','taskId','executionId','bridgeSessionId','browserInstanceId','bindingRevision','leaseEpoch'].some(k=>e[k]!==r.meta[k])))throw Error('BROWSER_JOURNAL_INVALID');
    if(!['completed','failed','cancelled'].includes(r.phase)&&!state.locks.some(l=>l.requestId===r.requestId&&l.key===r.meta.browserInstanceId+':'+r.meta.adapterId))throw Error('BROWSER_JOURNAL_INVALID');
  }
  return state;
}
export class IndexedState {
  static async open(name='agentbridge-browser-v1') {
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open(name,1);let abandoned=false;
      request.onupgradeneeded=()=>request.result.createObjectStore('state');
      request.onblocked=()=>{abandoned=true;reject(Error('BROWSER_JOURNAL_BLOCKED'));};
      request.onerror=()=>reject(Error('BROWSER_JOURNAL_OPEN_FAILED'));
      request.onsuccess=()=>{if(abandoned){request.result.close();return;}resolve(request.result);};
    });
    const store=new IndexedState(db);try{await store.read();return store;}catch(error){db.close();throw error;}
  }
  constructor(db,{maxBytes=8*1024*1024}={}) {this.db=db;this.maxBytes=maxBytes;db.onversionchange=()=>db.close();}
  run(change) {
    return new Promise((resolve,reject)=>{
      let result,error;
      const transaction=this.db.transaction('state',change?'readwrite':'readonly',change?{durability:'strict'}:undefined);
      const store=transaction.objectStore('state'),request=store.get('authority');
      request.onsuccess=()=>{
        try {
          const current=validate(request.result??empty());
          if(!change){result=structuredClone(current);return;}
          const next=structuredClone(current);result=change(next);
          if(result?.then)throw Error('BROWSER_ASYNC_TRANSACTION');
          next.revision++;validate(next);
          if(new TextEncoder().encode(JSON.stringify(next)).length>this.maxBytes)throw Error('BROWSER_JOURNAL_FULL');
          store.put(next,'authority');
        } catch(cause){error=cause;transaction.abort();}
      };
      transaction.oncomplete=()=>resolve(structuredClone(result));
      transaction.onerror=()=>{error??=Error('BROWSER_JOURNAL_WRITE_FAILED');};
      transaction.onabort=()=>reject(error??Error('BROWSER_JOURNAL_ABORTED'));
    });
  }
  read(){return this.run();}
  mutate(change){return this.run(change);}
  close(){this.db.close();}
}
