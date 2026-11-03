import {IndexedState} from '../src/background/indexed-state.mjs';
import {BrowserJournal} from '../src/background/journal.mjs';
import {BrowserExecutor} from '../src/background/executor.mjs';
import {ChromePages} from '../src/background/pages.mjs';
import {digest} from '../src/shared/wire.mjs';
const check=(value,message='Assertion failed')=>{if(!value)throw Error(message);};
const rejects=async(fn,code)=>{try{await fn();}catch(error){if(code)check(error.message===code,error.message+' != '+code);return;}throw Error('Expected rejection.');};
const payloadFingerprint=await digest({type:'text',text:'Example'});
const p=()=>({adapterId:'chatgpt-web',payloadFingerprint,requestId:'request-1',taskId:'task-1',executionId:'execution-1',bridgeSessionId:'session-1',browserInstanceId:'browser-1',bindingRevision:1,leaseEpoch:1,operationId:'operation-1',message:{type:'text',text:'Example'}});
const binding=()=>({tabId:1,documentId:'document-1',pageEpoch:'epoch-1',url:'https://chatgpt.com/'});
async function fixture() {
  const name='agentbridge-test-'+crypto.randomUUID();const store=await IndexedState.open(name),journal=new BrowserJournal(store);
  const counts={create:0,resume:0,submit:0,inspect:0};
  const pages={async create(){counts.create++;return binding();},async resume(){counts.resume++;return binding();},async inspect(){counts.inspect++;},async submit(){counts.submit++;},async health(){return {healthy:true};},async detach(){}};
  const executor=new BrowserExecutor({journal,pages});
  return {name,store,journal,executor,pages,counts,async close(){store.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=reject;request.onblocked=()=>reject(Error('DB cleanup blocked'));});}};
}
async function prepare(f,params=p()) {await f.executor.command('session.create',params);await f.executor.command('message.prepare',params);return params;}
const submitted=()=>({binding:{sessionKey:'provider-session',userAnchor:'user-1',documentId:'document-1'}});
const continuation=()=>({transcriptFingerprint:'a'.repeat(64),assistantAnchor:'assistant-1',historyRevision:2});
const bound=()=>({...submitted().binding,...continuation()});
async function unpreparedResume(f,finished=false) {
  const first=await prepare(f);await f.executor.command('message.send',first);await f.journal.append(first,'submitted',submitted());await f.journal.append(first,'completed',{text:'Original result',continuation:continuation()});
  const next={...first,requestId:'request-2',executionId:'execution-2',taskId:'task-2',operationId:'resume-unprepared',leaseEpoch:2,binding:bound()};
  await f.journal.beginOperation('session.resume',next);if(finished)await f.journal.finishOperation(next,binding());return next;
}
async function cancelledBeforePrepare(f,finished=false){const next=await unpreparedResume(f,finished);await f.executor.command('task.cancel',{...next,operationId:'cancel-unprepared',senderFence:'before-message-send'});return next;}
async function withChrome(work){
  const saved=globalThis.chrome,calls=[];let permission=true,reply={result:{pageEpoch:'epoch-1',healthy:true}},error;
  globalThis.chrome={permissions:{contains:async()=>permission},tabs:{sendMessage:async(...args)=>{calls.push(args);if(error)throw error;return reply;},create:()=>{throw Error('Health must not create a tab');}}};
  try{return await work({calls,setPermission:value=>permission=value,setReply:value=>reply=value,setError:value=>error=value});}finally{if(saved===undefined)delete globalThis.chrome;else globalThis.chrome=saved;}
}
export async function runJournalTests() {
  const tests=[];
  const test=async(name,work)=>{
    let f;
    try {f=await fixture();await work(f);tests.push({name,ok:true});}
    catch(error){tests.push({name,ok:false,error:error.message});}
    finally{if(f)try{await f.close();}catch(error){tests.push({name:name+' cleanup',ok:false,error:error.message});}}
  };
  const terminalProof=()=>({observed:true,proof:'bound-terminal-v1',documentId:'document-1',pageEpoch:'epoch-1',sessionKey:'provider-session',userAnchor:'user-1',assistantAnchor:'assistant-1',terminalFingerprint:'b'.repeat(64),stableForMs:1500});
  const lostIntegrity=async f=>{const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'unknown',{text:'BROWSER_USER_INTERFERENCE'});return {...params,observeTerminal:'integrity-failure-v1'};};
  await test('original submitted terminal proof settles integrity failure, never success or another send',async f=>{
    const params=await lostIntegrity(f),before=JSON.stringify(f.counts);let reads=0;f.pages.observeIntegrityFailure=async()=>{reads++;return terminalProof();};
    const reply=await f.executor.command('output.subscribe',params);check(reply.integrityObservationSupported===true);const state=await f.store.read();check(state.requests[0].phase==='failed'&&state.requests[0].terminal.error.code==='BROWSER_CONTEXT_INTEGRITY_LOST');check(state.locks.length===0&&state.events.at(-1).kind==='failed');check(state.requests[0].integrityResolution.documentId==='document-1');check(JSON.stringify(f.counts)===before);
    const stored=JSON.stringify(state);await f.executor.command('output.subscribe',params);check(reads===1&&JSON.stringify(await f.store.read())===stored);
    f.store.close();const reopened=await IndexedState.open(f.name);try{check((await reopened.read()).requests[0].phase==='failed');}finally{reopened.close();}
  });
  await test('incomplete original observation preserves unknown and the original lock',async f=>{
    const params=await lostIntegrity(f),before=JSON.stringify(await f.store.read());f.pages.observeIntegrityFailure=async()=>({observed:false});await f.executor.command('output.subscribe',params);check(JSON.stringify(await f.store.read())===before);check((await f.store.read()).locks.length===1);
  });
  for(const field of ['documentId','pageEpoch','sessionKey','userAnchor','assistantAnchor','terminalFingerprint','stableForMs'])await test('terminal failure proof refuses altered '+field,async f=>{
    const params=await lostIntegrity(f),before=JSON.stringify(await f.store.read()),proof=terminalProof();proof[field]=field==='stableForMs'?0:field==='assistantAnchor'?'':field==='terminalFingerprint'?'invalid':'foreign';await rejects(()=>f.journal.settleIntegrityFailure(params,proof),'BROWSER_OBSERVATION_UNPROVEN');check(JSON.stringify(await f.store.read())===before);
  });
  await test('no submitted receipt cannot be replaced by terminal-looking page contents',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'unknown',{text:'BROWSER_SUBMISSION_UNKNOWN'});const before=JSON.stringify(await f.store.read());await rejects(()=>f.journal.settleIntegrityFailure({...params,observeTerminal:'integrity-failure-v1'},terminalProof()),'BROWSER_OBSERVATION_UNPROVEN');check(JSON.stringify(await f.store.read())===before);
  });
  await test('ordinary output subscription remains a pure replay without integrity policy',async f=>{
    const params=await lostIntegrity(f),before=JSON.stringify(await f.store.read());delete params.observeTerminal;f.pages.observeIntegrityFailure=async()=>{throw Error('Unexpected DOM observation');};await f.executor.command('output.subscribe',params);check(JSON.stringify(await f.store.read())===before);
  });
  await test('corrupt retained terminal proof is rejected without resetting IndexedDB',async f=>{
    const params=await lostIntegrity(f);await f.journal.settleIntegrityFailure(params,terminalProof());const transaction=f.store.db.transaction('state','readwrite'),store=transaction.objectStore('state'),get=store.get('authority');get.onsuccess=()=>{const state=get.result;state.requests[0].integrityResolution.userAnchor='foreign';store.put(state,'authority');};await new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onabort=reject;});await rejects(()=>f.store.read(),'BROWSER_JOURNAL_INVALID');
  });
  for(const altered of [false,true])await test('original terminal DOM probe '+(altered?'rejects changed input before Chrome access':'binds its fingerprint, document and epoch'),async f=>{
    const params=await lostIntegrity(f),request=await f.journal.originalRequest(params);
    await withChrome(async mock=>{
      let scripts=0;globalThis.chrome.scripting={executeScript:async options=>{scripts++;check(options.target.documentIds[0]==='document-1'&&options.world==='ISOLATED');if(options.files)return [{documentId:'document-1'}];check(options.args[1].text==='Example');return [{documentId:'document-1',result:{observed:true}}];}};
      const pages=new ChromePages({journal:f.journal});
      if(altered){await rejects(()=>pages.observeIntegrityFailure({...params,message:{type:'text',text:'Changed'}},request),'BROWSER_OBSERVATION_UNPROVEN');check(scripts===0&&mock.calls.length===0);}
      else{const proof=await pages.observeIntegrityFailure(params,request);check(proof.observed&&proof.documentId==='document-1'&&proof.pageEpoch==='epoch-1');check(scripts===2&&mock.calls.length===2);}
    });
  });
  for(const changed of ['document','epoch'])await test('original terminal DOM proof rejects a changed '+changed,async f=>{
    const params=await lostIntegrity(f),request=await f.journal.originalRequest(params);
    await withChrome(async mock=>{
      let scripts=0;globalThis.chrome.scripting={executeScript:async()=>{scripts++;if(scripts===1)return [];if(changed==='epoch')mock.setReply({result:{pageEpoch:'foreign-epoch'}});return [{documentId:changed==='document'?'foreign-document':'document-1',result:{observed:true}}];}};
      await rejects(()=>new ChromePages({journal:f.journal}).observeIntegrityFailure(params,request),'BROWSER_BINDING_LOST');
    });
  });
  await test('IndexedDB transaction survives close and reopen',async f=>{
    await prepare(f);f.store.close();const reopened=await IndexedState.open(f.name);
    try{check((await reopened.read()).requests[0].phase==='prepared');}finally{reopened.close();}
  });
  for(const finished of [false,true])await test('sealed unprepared turn health is read-only after '+(finished?'finished':'unknown')+' resume',async f=>{
    const next=await cancelledBeforePrepare(f,finished),before=JSON.stringify(await f.store.read());
    await withChrome(async chrome=>{const pages=new ChromePages({journal:f.journal}),result=await pages.health({...next,probeId:'probe-unprepared'});check(result.pageReady&&result.domChecked&&!result.blocked);check(chrome.calls.length===1&&chrome.calls[0][2].documentId==='document-1');});
    check(JSON.stringify(await f.store.read())===before);await rejects(()=>f.journal.request(next.requestId),'BROWSER_REQUEST_NOT_FOUND');
  });
  for(const finished of [false,true])await test('sealed unprepared turn closes only its existing session after '+(finished?'finished':'unknown')+' resume',async f=>{
    const next=await cancelledBeforePrepare(f,finished),counts=JSON.stringify(f.counts),close={...next,operationId:'close-unprepared',expectedRevision:1};
    check((await f.executor.command('session.close',close)).closed);check((await f.executor.command('operation.get',close)).state==='confirmed');
    check(JSON.stringify(f.counts)===counts);const state=await f.store.read();check(state.requests.length===1&&state.sessions.length===1&&state.sessions[0].closed&&state.requests[0].terminal.text==='Original result');
    check(state.operations.find(o=>o.operationId===close.operationId).recoverySealOperationId==='cancel-unprepared');
    await withChrome(async chrome=>{const result=await new ChromePages({journal:f.journal}).health({...next,probeId:'probe-sealed-closed'});check(result.sessionClosed&&!result.domChecked&&result.code==='BROWSER_SESSION_CLOSED'&&chrome.calls.length===0);});
  });
  await test('unprepared absence without a confirmed original seal never permits health or close',async f=>{
    const next=await unpreparedResume(f),before=JSON.stringify(await f.store.read());
    await withChrome(async chrome=>{await rejects(()=>new ChromePages({journal:f.journal}).health({...next,probeId:'probe-no-seal'}),'BROWSER_REQUEST_NOT_FOUND');check(chrome.calls.length===0);});
    await rejects(()=>f.executor.command('session.close',{...next,operationId:'close-no-seal',expectedRevision:1}),'BROWSER_REQUEST_NOT_FOUND');check(JSON.stringify(await f.store.read())===before);
  });
  await test('a before-command continuation seal can close only the existing inherited session',async f=>{
    const first=await prepare(f);await f.executor.command('message.send',first);await f.journal.append(first,'submitted',submitted());await f.journal.append(first,'completed',{text:'Original',continuation:continuation()});
    const next={...first,requestId:'request-2',executionId:'execution-2',taskId:'task-2',leaseEpoch:2,operationId:'cancel-before-any-command',senderFence:'before-message-send',binding:bound()};
    await f.journal.cancel(next);check(!(await f.store.read()).operations.some(o=>o.method==='session.resume'));
    await withChrome(async chrome=>{check((await new ChromePages({journal:f.journal}).health({...next,probeId:'probe-before-command'})).pageReady);check(chrome.calls.length===1);});
    check((await f.journal.closeSession({...next,operationId:'close-before-command',expectedRevision:1})).closed);check((await f.store.read()).requests.length===1);
  });
  await test('sealed unprepared recovery rejects changed original metadata without inspecting a page',async f=>{
    const next=await cancelledBeforePrepare(f),before=JSON.stringify(await f.store.read());
    for(const wrong of [{executionId:'different-execution'},{taskId:'different-task'},{browserInstanceId:'different-profile'},{payloadFingerprint:'b'.repeat(64)},{leaseEpoch:3},{bindingRevision:2}])await withChrome(async chrome=>{
      await rejects(()=>new ChromePages({journal:f.journal}).health({...next,...wrong,probeId:'probe-wrong-meta'}),'BROWSER_REQUEST_CONFLICT');check(chrome.calls.length===0);
      await rejects(()=>f.executor.command('session.close',{...next,...wrong,operationId:'close-wrong-meta',expectedRevision:wrong.bindingRevision||1}),'BROWSER_REQUEST_CONFLICT');
    });check(JSON.stringify(await f.store.read())===before);
  });
  await test('a cancellation seal cannot claim another profile existing session',async f=>{
    const next=await unpreparedResume(f),foreign={...next,requestId:'foreign-request',executionId:'foreign-execution',taskId:'foreign-task',browserInstanceId:'foreign-profile',operationId:'cancel-foreign-session',senderFence:'before-message-send'};
    await f.journal.cancel(foreign);
    await withChrome(async chrome=>{const result=await new ChromePages({journal:f.journal}).health({...foreign,probeId:'probe-foreign-session'});check(result.code==='BROWSER_SESSION_MISMATCH'&&!result.sessionClosed&&chrome.calls.length===0);});
    check((await f.journal.closeSession({...foreign,operationId:'close-foreign-session',expectedRevision:1})).code==='BROWSER_SESSION_MISMATCH');
    check((await f.store.read()).locks.some(l=>l.requestId===next.requestId));check(!(await f.journal.session(next.bridgeSessionId)).closed);
  });
  for(const leaseEpoch of [2,3])await test('a later request with lease '+leaseEpoch+' fences an older unprepared cancellation seal',async f=>{
    const next=await cancelledBeforePrepare(f),later={...next,requestId:'request-3',executionId:'execution-3',taskId:'task-3',operationId:'resume-later',leaseEpoch};await f.journal.beginOperation('session.resume',later);
    await withChrome(async chrome=>{const result=await new ChromePages({journal:f.journal}).health({...next,probeId:'probe-old-seal'});check(result.code==='BROWSER_SESSION_MISMATCH'&&chrome.calls.length===0);});
    check((await f.journal.closeSession({...next,operationId:'close-old-seal',expectedRevision:1})).code==='BROWSER_SESSION_MISMATCH');
    check((await f.store.read()).locks.some(l=>l.requestId===later.requestId));check(!(await f.journal.session(next.bridgeSessionId)).closed);
  });
  await test('failed sealed-session close transaction leaves the original seal and session intact',async f=>{
    const next=await cancelledBeforePrepare(f),before=JSON.stringify(await f.store.read());f.store.maxBytes=1;
    await rejects(()=>f.journal.closeSession({...next,operationId:'close-seal-full',expectedRevision:1}),'BROWSER_JOURNAL_FULL');check(JSON.stringify(await f.store.read())===before);
  });
  await test('sealed close proof survives reopen and cannot reference a foreign cancellation',async f=>{
    const next=await cancelledBeforePrepare(f),close={...next,operationId:'close-seal-reopen',expectedRevision:1};await f.journal.closeSession(close);
    const before=JSON.stringify(await f.store.read());await rejects(()=>f.store.mutate(s=>{s.operations.find(o=>o.operationId===close.operationId).recoverySealOperationId='missing-cancellation';}),'BROWSER_JOURNAL_INVALID');check(JSON.stringify(await f.store.read())===before);
    f.store.close();const reopened=await IndexedState.open(f.name);try{const journal=new BrowserJournal(reopened);check((await journal.operation(close)).result.closed);check((await journal.closeSession(close)).closed);}finally{reopened.close();}
  });
  await test('completed continuation proof survives reopen and mismatched resume proofs have no page action',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Original',continuation:continuation()});
    const next={...params,requestId:'request-2',executionId:'execution-2',taskId:'task-2',operationId:'resume-proof',leaseEpoch:2,binding:bound()},before=f.counts.resume;
    await rejects(()=>f.executor.command('session.resume',{...next,binding:{...bound(),historyRevision:3}}),'BROWSER_CONTINUATION_UNVERIFIED');check(f.counts.resume===before);
    await f.executor.command('session.resume',next);check(f.counts.resume===before+1);check((await f.journal.session(params.bridgeSessionId)).continuation.transcriptFingerprint===continuation().transcriptFingerprint);
  });
  await test('legacy completion cannot invent a transcript proof on resume',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Legacy'});
    await rejects(()=>f.executor.command('session.resume',{...params,requestId:'request-2',executionId:'execution-2',taskId:'task-2',operationId:'legacy-resume',leaseEpoch:2,binding:bound()}),'BROWSER_CONTINUATION_UNVERIFIED');check(f.counts.resume===0);
  });
  await test('malformed completion proof rolls back and a resumed page cannot change document',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());
    await rejects(()=>f.journal.append(params,'completed',{text:'Original',continuation:{...continuation(),historyRevision:-1}}),'BROWSER_EVENT_INVALID');check((await f.journal.request(params.requestId)).phase==='submitted');
    await f.journal.append(params,'completed',{text:'Original',continuation:continuation()});const next={...params,requestId:'request-2',executionId:'execution-2',taskId:'task-2',operationId:'resume-other-document',leaseEpoch:2,binding:bound()};
    await f.journal.beginOperation('session.resume',next);await rejects(()=>f.journal.finishOperation(next,{...binding(),documentId:'different-document'}),'BROWSER_SESSION_MISMATCH');check((await f.journal.session(params.bridgeSessionId)).page.documentId==='document-1');
  });
  await test('session health targets the original document and leaves native IndexedDB unchanged',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Original',continuation:continuation()});
    await withChrome(async chrome=>{
      const pages=new ChromePages({journal:f.journal}),before=JSON.stringify(await f.store.read());
      const discovery=await pages.health({adapterId:params.adapterId,browserInstanceId:params.browserInstanceId});check(discovery.enabled&&discovery.domChecked===false&&chrome.calls.length===0);
      const result=await pages.health({...params,probeId:'probe-original'});check(result.pageReady&&result.domChecked&&result.loginChecked===false&&!result.blocked);check(chrome.calls.length===1);
      check(chrome.calls[0][2].documentId==='document-1'&&chrome.calls[0][1].method==='inspect'&&chrome.calls[0][1].binding.userAnchor==='user-1');
      check(JSON.stringify(await f.store.read())===before);
    });
  });
  await test('health preserves drafts and reduces opaque page exceptions to a fixed code',async f=>{
    const params=await prepare(f),before=JSON.stringify(await f.store.read());
    await withChrome(async chrome=>{
      const pages=new ChromePages({journal:f.journal});chrome.setReply({error:{code:'BROWSER_DRAFT_PRESENT'}});
      const draft=await pages.health({...params,probeId:'probe-draft'});check(draft.domChecked&&!draft.pageReady&&draft.code==='BROWSER_DRAFT_PRESENT'&&draft.blocked);
      chrome.setError(Error('private Provider account detail'));const lost=await pages.health({...params,probeId:'probe-lost'});check(lost.code==='BROWSER_PAGE_UNAVAILABLE'&&!lost.domChecked&&!JSON.stringify(lost).includes('private Provider'));
      check(JSON.stringify(await f.store.read())===before);
    });
  });
  await test('revoked permission and a closed session never inspect or reopen a page',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Original',continuation:continuation()});
    await withChrome(async chrome=>{
      const pages=new ChromePages({journal:f.journal});chrome.setPermission(false);check((await pages.health({...params,probeId:'probe-revoked'})).code==='BROWSER_SITE_PERMISSION_REQUIRED');check(chrome.calls.length===0);
      await f.executor.command('session.close',{...params,operationId:'close-health',expectedRevision:1});chrome.setPermission(true);const before=JSON.stringify(await f.store.read());
      const result=await pages.health({...params,probeId:'probe-closed'});check(result.sessionClosed&&!result.pageReady&&!result.domChecked&&chrome.calls.length===0);check(JSON.stringify(await f.store.read())===before);
    });
  });
  await test('health rejects foreign execution and an older resumed turn without inspecting another document',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Original',continuation:continuation()});
    await withChrome(async chrome=>{
      const pages=new ChromePages({journal:f.journal});await rejects(()=>pages.health({...params,executionId:'foreign-execution',probeId:'probe-foreign'}),'BROWSER_REQUEST_CONFLICT');check(chrome.calls.length===0);
      await f.executor.command('session.resume',{...params,requestId:'request-2',executionId:'execution-2',taskId:'task-2',operationId:'resume-next',leaseEpoch:2,binding:bound()});
      check((await pages.health({...params,probeId:'probe-older'})).code==='BROWSER_SESSION_MISMATCH');check(chrome.calls.length===0);
    });
  });
  await test('idle session close is an atomic tombstone without any page action',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Original',continuation:continuation()});
    f.pages.detach=()=>{throw Error('Closing must not touch the page');};
    const close={...params,operationId:'close-original',expectedRevision:1},before={...f.counts};
    check((await f.executor.command('session.close',close)).closed===true);check((await f.executor.command('session.close',close)).closed===true);
    check((await f.executor.command('operation.get',close)).result.closed===true);check(JSON.stringify(f.counts)===JSON.stringify(before));
    await rejects(()=>f.journal.session(params.bridgeSessionId),'BROWSER_SESSION_MISSING');
    await rejects(()=>f.executor.command('session.resume',{...params,operationId:'resume-closed',binding:bound()}),'BROWSER_SESSION_MISSING');
    check((await f.journal.request(params.requestId)).terminal.text==='Original');
  });
  await test('session close cannot clear a prepared, dispatched or unknown execution',async f=>{
    const params=await prepare(f),close={...params,operationId:'close-busy',expectedRevision:1};
    const refused=await f.executor.command('session.close',close);check(refused.state==='rejected'&&refused.code==='BROWSER_SESSION_BUSY');await f.executor.command('message.send',params);
    check((await f.executor.command('session.close',close)).state==='rejected');await f.journal.recover();
    check((await f.executor.command('session.close',{...close,operationId:'close-after-recovery'})).state==='rejected');check((await f.store.read()).locks.length===1);
    check((await f.journal.session(params.bridgeSessionId)).closed===false);check((await f.executor.command('operation.get',close)).state==='rejected');
  });
  await test('session close conflicts with changed identity, revision and reused operation',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Original',continuation:continuation()});
    const close={...params,operationId:'close-original',expectedRevision:1};
    await rejects(()=>f.executor.command('session.close',{...close,executionId:'other-execution'}),'BROWSER_REQUEST_CONFLICT');
    await rejects(()=>f.executor.command('session.close',{...close,expectedRevision:2}),'BROWSER_OPERATION_INVALID');
    await rejects(()=>f.executor.command('session.close',{...close,operationId:params.operationId}),'BROWSER_OPERATION_CONFLICT');
    check((await f.journal.session(params.bridgeSessionId)).closed===false);
  });
  await test('failed close transaction leaves the session usable and retains the original answer',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Original',continuation:continuation()});
    f.store.maxBytes=1;await rejects(()=>f.executor.command('session.close',{...params,operationId:'close-full',expectedRevision:1}),'BROWSER_JOURNAL_FULL');
    check((await f.journal.session(params.bridgeSessionId)).closed===false);check(!(await f.store.read()).operations.some(o=>o.method==='session.close'));
  });
  await test('20 concurrent claims admit exactly one page action',async f=>{
    const params=await prepare(f);const results=await Promise.all(Array.from({length:20},()=>f.journal.claimSend(params)));
    check(results.filter(r=>r.execute).length===1);
  });
  await test('pre-content cancellation seals the original request and blocks all later sends',async f=>{
    const params=await prepare(f),cancel={...params,operationId:'cancel-before-content',senderFence:'message-send-issued'};
    await f.journal.claimSend(params);const result=await f.executor.command('task.cancel',cancel);
    check(result.cancelled&&result.proof==='content-not-authorized-v1');check((await f.store.read()).locks.length===0);
    await rejects(()=>f.executor.command('message.send',params),'BROWSER_REQUEST_CANCELLED');
    await rejects(()=>f.journal.authorizeContent(params),'BROWSER_REQUEST_CANCELLED');
    await rejects(()=>f.journal.prepare(params),'BROWSER_REQUEST_CANCELLED');
    check(f.counts.submit===0);check((await f.executor.command('operation.get',cancel)).state==='confirmed');
    f.store.close();const reopened=await IndexedState.open(f.name);try{check((await new BrowserJournal(reopened).operation(cancel)).result.cancelled);}finally{reopened.close();}
  });
  await test('authorization and cancellation race has exactly one durable winner',async f=>{
    const params=await prepare(f);await f.journal.claimSend(params);
    const cancel={...params,operationId:'cancel-race',senderFence:'message-send-issued'};
    const results=await Promise.allSettled([f.journal.authorizeContent(params),f.journal.cancel(cancel)]);
    const r=await f.journal.request(params.requestId),op=await f.journal.operation(cancel);
    check(r.contentAuthorized===true&&op.state==='rejected'&&results[0].status==='fulfilled'||r.phase==='cancelled'&&op.state==='confirmed'&&results[0].status==='rejected');
    check(!(r.contentAuthorized===true&&r.phase==='cancelled'));
  });
  await test('already authorized and legacy unmarked records never prove cancellation',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);
    const cancel={...params,operationId:'cancel-authorized',senderFence:'message-send-issued'};
    check((await f.journal.cancel(cancel)).code==='BROWSER_CONTENT_ALREADY_AUTHORIZED');check((await f.store.read()).locks.length===1);
    await f.store.mutate(s=>{delete s.requests[0].contentAuthorized;});
    check((await f.journal.cancel({...cancel,operationId:'cancel-legacy'})).code==='BROWSER_CANCELLATION_UNPROVEN');
  });
  await test('before-send seal rejects a late create completion without inventing a session',async f=>{
    const params=p();await f.journal.beginOperation('session.create',params);
    const cancel={...params,operationId:'cancel-creating',senderFence:'before-message-send'};
    check((await f.journal.cancel(cancel)).cancelled);await rejects(()=>f.journal.finishOperation(params,binding()),'BROWSER_REQUEST_CANCELLED');
    await rejects(()=>f.journal.beginOperation('session.create',params),'BROWSER_REQUEST_CANCELLED');
    const state=await f.store.read();check(state.sessions.length===0&&state.requests.length===0&&state.locks.length===0);
    check((await f.journal.operation(params)).state==='rejected');
  });
  await test('absence after an issued send is not cancellation proof and preserves foreign profile locks',async f=>{
    const params=p();await f.journal.beginOperation('session.create',params);
    const cancel={...params,operationId:'cancel-absent',senderFence:'message-send-issued'};
    check((await f.journal.cancel(cancel)).code==='BROWSER_CANCELLATION_UNPROVEN');check((await f.store.read()).locks.length===1);
    const foreign={...params,requestId:'request-foreign',taskId:'task-foreign',executionId:'execution-foreign',bridgeSessionId:'session-foreign',operationId:'cancel-foreign',senderFence:'before-message-send'};
    check((await f.journal.cancel(foreign)).cancelled);check((await f.store.read()).locks[0].requestId===params.requestId);
  });
  await test('failed cancellation transaction neither releases a lock nor authorizes content',async f=>{
    const params=await prepare(f),before=JSON.stringify(await f.store.read());f.store.maxBytes=1;
    await rejects(()=>f.journal.cancel({...params,operationId:'cancel-full',senderFence:'before-message-send'}),'BROWSER_JOURNAL_FULL');
    check(JSON.stringify(await f.store.read())===before);
  });
  await test('cancellation during held preflight prevents the executor from reaching the page',async f=>{
    const params=await prepare(f);let release,entered;const held=new Promise(r=>release=r),started=new Promise(r=>entered=r);
    f.pages.inspect=async()=>{entered();await held;};const sending=f.executor.command('message.send',params);await started;
    check((await f.journal.cancel({...params,operationId:'cancel-held',senderFence:'message-send-issued'})).cancelled);
    release();await sending;check(f.counts.submit===0);check((await f.journal.request(params.requestId)).phase==='cancelled');
  });
  await test('content authorization must commit before any page submission',async f=>{
    const params=await prepare(f);f.pages.inspect=async()=>{f.store.maxBytes=1;};
    await rejects(()=>f.executor.command('message.send',params),'BROWSER_JOURNAL_FULL');
    const state=await f.store.read();check(f.counts.submit===0&&state.requests[0].contentAuthorized===false&&state.locks.length===1);
  });
  await test('duplicate send after page action never invokes submit again',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.executor.command('message.send',params);
    check(f.counts.submit===1);check((await f.journal.request(params.requestId)).phase==='dispatching');
  });
  await test('journal recovery retains unknown fence and blocks alias requests',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);
    f.store.close();const reopened=await IndexedState.open(f.name);const journal=new BrowserJournal(reopened);
    try {
      await journal.recover();check((await journal.request(params.requestId)).phase==='unknown');
      check(!(await journal.claimSend(params)).execute);
      await rejects(()=>journal.beginOperation('session.create',{...p(),requestId:'new-request',executionId:'new-execution',bridgeSessionId:'new-session',operationId:'new-op'}),'BROWSER_RESOURCE_BUSY');
      check((await journal.outbox()).length===1);
    }finally{reopened.close();}
  });
  await test('same ID with changed prompt conflicts after submission',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);
    await rejects(()=>f.journal.claimSend({...params,message:{type:'text',text:'different'}}),'BROWSER_REQUEST_CONFLICT');
    check(f.counts.submit===1);
  });
  await test('page creation response unknown never reopens another tab',async f=>{
    f.pages.create=async()=>{f.counts.create++;throw Error('tab acknowledgement lost');};
    await rejects(()=>f.executor.command('session.create',p()));
    await rejects(()=>f.executor.command('session.create',p()),'BROWSER_OPERATION_UNKNOWN');check(f.counts.create===1);
  });
  await test('transaction abort rolls back the whole authority',async f=>{
    await prepare(f);const before=JSON.stringify(await f.store.read());
    await rejects(()=>f.store.mutate(s=>{s.requests=[];throw Error('injected abort');}),'injected abort');
    check(JSON.stringify(await f.store.read())===before);
  });
  await test('capacity refusal before claim permits no page action',async f=>{
    const params=await prepare(f);f.store.maxBytes=1;
    await rejects(()=>f.executor.command('message.send',params),'BROWSER_JOURNAL_FULL');
    check(f.counts.submit===0);check((await f.journal.request(params.requestId)).phase==='prepared');
  });
  await test('submitted binding and rewritten output persist with event sequence',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());
    await f.journal.append(params,'output.snapshot',{revision:1,text:'Old prefix'});await f.journal.append(params,'output.snapshot',{revision:2,text:'New prefix'});
    check((await f.journal.outbox()).map(e=>e.seq).join(',')==='1,2,3');
    check((await f.journal.request(params.requestId)).lastOutput==='New prefix');
    await rejects(()=>f.journal.append(params,'output.snapshot',{revision:2,text:'stale'}),'BROWSER_OUTPUT_REVISION');
  });
  await test('ACK removes only confirmed events and retains original execution fence',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'Result',continuation:continuation()});
    await rejects(()=>f.journal.acknowledge(params.executionId,3),'BROWSER_ACK_INVALID');
    await f.journal.acknowledge(params.executionId,1);check((await f.journal.outbox()).length===1);
    await f.journal.acknowledge(params.executionId,2);check((await f.journal.outbox()).length===0);
    check(!(await f.journal.claimSend(params)).execute);check((await f.journal.request(params.requestId)).terminal.text==='Result');
  });
  await test('old assistant output cannot complete an unsubmitted request',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);
    await rejects(()=>f.journal.append(params,'completed',{text:'Old answer'}),'BROWSER_SUBMISSION_UNKNOWN');
    check((await f.journal.outbox()).length===0);
  });
  await test('navigation failure after durable claim yields unknown, no retry',async f=>{
    const params=await prepare(f);f.pages.inspect=async()=>{throw Error('document changed');};
    await f.executor.command('message.send',params);check((await f.journal.request(params.requestId)).phase==='unknown');
    await f.executor.command('message.send',params);check(f.counts.submit===0);
  });
  await test('resume reuses original provider session and rejects another profile',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());await f.journal.append(params,'completed',{text:'First',continuation:continuation()});
    const next={...p(),requestId:'request-2',taskId:'task-2',executionId:'execution-2',operationId:'resume-2',leaseEpoch:2,binding:bound()};
    await rejects(()=>f.journal.beginOperation('session.resume',{...next,browserInstanceId:'another-profile'}),'BROWSER_SESSION_MISMATCH');
    await f.executor.command('session.resume',next);await f.executor.command('message.prepare',next);await f.executor.command('message.send',next);
    check(f.counts.create===1);check(f.counts.resume===1);check(f.counts.submit===2);
  });
  await test('unknown operation and request remain stored when a new tab ID is proposed',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.recover();
    await rejects(()=>f.executor.command('session.create',{...p(),requestId:'alias',executionId:'alias-execution',bridgeSessionId:'alias-session',operationId:'alias-op'}),'BROWSER_RESOURCE_BUSY');
    check(f.counts.create===1);check((await f.journal.request(params.requestId)).phase==='unknown');
  });
  await test('asynchronous transaction callback is rejected rather than committed early',async f=>{
    await rejects(()=>f.store.mutate(async state=>{state.revision=99;}),'BROWSER_ASYNC_TRANSACTION');check((await f.store.read()).revision===0);
  });
  await test('changed message cannot replace the fingerprint frozen during prepare',async f=>{
    const params=await prepare(f),message={type:'text',text:'Different requirement'},changedFingerprint=await digest(message);
    await rejects(()=>f.journal.claimSend({...params,message,payloadFingerprint:changedFingerprint}),'BROWSER_REQUEST_CONFLICT');
    check((await f.journal.request(params.requestId)).phase==='prepared');check(f.counts.submit===0);
  });
  await test('valid JSON with broken event identity fails closed on database reopen',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);await f.journal.append(params,'submitted',submitted());
    const state=await f.store.read();state.events[0].executionId='other-execution';
    await new Promise((resolve,reject)=>{const tx=f.store.db.transaction('state','readwrite');tx.objectStore('state').put(state,'authority');tx.oncomplete=resolve;tx.onabort=reject;});
    await rejects(()=>IndexedState.open(f.name),'BROWSER_JOURNAL_INVALID');
  });
  await test('a fabricated terminal phase cannot remove the active resource lock',async f=>{
    const params=await prepare(f);await f.executor.command('message.send',params);
    await rejects(()=>f.store.mutate(state=>{state.requests[0].phase='completed';state.locks=[];}),'BROWSER_JOURNAL_INVALID');
    check((await f.journal.request(params.requestId)).phase==='dispatching');
  });
  await test('operation and request queries preserve identity and never create or submit pages',async f=>{
    const params=await prepare(f),before=JSON.stringify(await f.store.read());let flushes=0;f.executor.onEvents=async()=>{flushes++;};
    const op=await f.executor.command('operation.get',params);check(op.operationId===params.operationId&&op.state==='confirmed'&&op.method==='session.create');
    check((await f.executor.command('request.get',params)).phase==='prepared');await f.executor.command('output.subscribe',params);check(flushes===1);
    await rejects(()=>f.executor.command('operation.get',{...params,executionId:'foreign-execution'}),'BROWSER_OPERATION_CONFLICT');
    await rejects(()=>f.executor.command('operation.get',{...params,operationId:'unknown-op'}),'BROWSER_OPERATION_NOT_FOUND');
    await rejects(()=>f.executor.command('output.subscribe',{...params,executionId:'foreign-execution'}),'BROWSER_REQUEST_CONFLICT');
    check(flushes===1&&f.counts.create===1&&f.counts.submit===0);check(JSON.stringify(await f.store.read())===before);
  });
  await test('an uncertain page operation can be queried without repeating the original page action',async f=>{
    const params=p();f.pages.create=async()=>{f.counts.create++;throw Error('Lost page acknowledgement');};
    await rejects(()=>f.executor.command('session.create',params),'Lost page acknowledgement');
    const before=JSON.stringify(await f.store.read());
    check((await f.executor.command('operation.get',params)).state==='unknown');check((await f.executor.command('operation.get',params)).state==='unknown');
    check(f.counts.create===1&&f.counts.submit===0);check(JSON.stringify(await f.store.read())===before);
  });
  await test('known browser action error codes remain queryable without retrying the page action',async f=>{
    const params=await prepare(f);f.pages.submit=async()=>{f.counts.submit++;throw Object.assign(Error('test-only internal details'),{code:'BROWSER_INPUT_CHANGED'});};
    await f.executor.command('message.send',params);await f.executor.command('message.send',params);
    const state=await f.store.read();check(state.requests[0].phase==='unknown');check(state.events.at(-1).text==='BROWSER_INPUT_CHANGED');check(f.counts.submit===1);check(!JSON.stringify(state).includes('test-only internal details'));
  });
  await test('opaque page exceptions reduce to a fixed code without persisting private error text',async f=>{
    const params=await prepare(f);f.pages.submit=async()=>{throw Error('test-only private exception text');};
    await f.executor.command('message.send',params);const state=await f.store.read();check(state.events.at(-1).text==='BROWSER_PAGE_ACTION_UNKNOWN');check(!JSON.stringify(state).includes('test-only private exception text'));
  });
  return {browser:navigator.userAgent,tests,passed:tests.filter(t=>t.ok).length,failed:tests.filter(t=>!t.ok).length};
}
