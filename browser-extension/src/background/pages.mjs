import {digest} from '../shared/wire.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const providers={'chatgpt-web':{url:'https://chatgpt.com/',origin:'https://chatgpt.com/*',files:['src/providers/chatgpt/driver.js','src/content/runtime.js']}};
export async function registerProviderScripts() {
  for(const [adapterId,provider] of Object.entries(providers)) {
    const id='agentbridge-'+adapterId;
    if(!await chrome.permissions.contains({origins:[provider.origin]})) {
      if((await chrome.scripting.getRegisteredContentScripts({ids:[id]})).length)await chrome.scripting.unregisterContentScripts({ids:[id]});
      continue;
    }
    if(!(await chrome.scripting.getRegisteredContentScripts({ids:[id]})).length)await chrome.scripting.registerContentScripts([{id,matches:[provider.origin],js:provider.files,runAt:'document_idle',allFrames:false,persistAcrossSessions:true}]);
  }
}
export class ChromePages {
  constructor({journal,onEvents}){this.journal=journal;this.onEvents=onEvents;}
  async probe(adapterId,tabId) {
    const reply=await chrome.tabs.sendMessage(tabId,{protocol:'agentbridge-content-v1',method:'probe',adapterId},{frameId:0});
    if(!reply?.result||reply.error)throw Error(reply?.error?.code||'BROWSER_CONTENT_UNAVAILABLE');return reply.result;
  }
  async create(p) {
    const provider=providers[p.adapterId];if(!provider||!await chrome.permissions.contains({origins:[provider.origin]}))throw Error('BROWSER_SITE_PERMISSION_REQUIRED');
    await registerProviderScripts();
    const tab=await chrome.tabs.create({url:provider.url,active:false});
    const deadline=Date.now()+20000;
    while(Date.now()<deadline) {
      try {
        const result=await this.probe(p.adapterId,tab.id);
        if(!result.healthy)throw Error(result.code||'BROWSER_PAGE_NOT_READY');
        const sender=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},func:()=>null});
        if(!sender[0]?.documentId)throw Error('BROWSER_DOCUMENT_UNKNOWN');
        return {tabId:tab.id,documentId:sender[0].documentId,pageEpoch:result.pageEpoch,url:result.url};
      } catch {await pause(250);}
    }
    throw Error('BROWSER_PAGE_NOT_READY');
  }
  async resume(p,session){await this.inspect(p,session);return session.page;}
  binding(p,session){return {pageEpoch:session.page.pageEpoch,sessionKey:p.binding?.sessionKey||session.sessionKey,userAnchor:p.binding?.userAnchor||session.lastUserAnchor,...session.continuation,...Object.fromEntries(['transcriptFingerprint','assistantAnchor','historyRevision'].filter(k=>p.binding?.[k]!==undefined).map(k=>[k,p.binding[k]]))};}
  inspection(p,session) {
    return chrome.tabs.sendMessage(session.page.tabId,{protocol:'agentbridge-content-v1',method:'inspect',adapterId:p.adapterId,pageEpoch:session.page.pageEpoch,binding:this.binding(p,session)},{documentId:session.page.documentId});
  }
  async inspect(p,session) {
    const provider=providers[p.adapterId];if(!provider||!await chrome.permissions.contains({origins:[provider.origin]}))throw Error('BROWSER_SITE_PERMISSION_REQUIRED');
    const reply=await this.inspection(p,session);
    if(reply?.result?.healthy!==true||reply.result.pageEpoch!==session.page.pageEpoch||reply.error)throw Error(reply?.error?.code||'BROWSER_BINDING_LOST');
  }
  async submit(p,session) {
    const reply=await chrome.tabs.sendMessage(session.page.tabId,{protocol:'agentbridge-content-v1',method:'submit',adapterId:p.adapterId,pageEpoch:session.page.pageEpoch,binding:this.binding(p,session),params:{...p,documentId:session.page.documentId}},{documentId:session.page.documentId});
    if(!reply?.result?.accepted||reply.error)throw Error(reply?.error?.code||'BROWSER_SUBMISSION_UNKNOWN');
  }
  async receive(message,sender) {
    if(sender.id!==chrome.runtime.id||sender.frameId!==0||!sender.tab||!sender.documentId)throw Error('BROWSER_CONTENT_SOURCE');
    const r=await this.journal.request(message.requestId);
    const provider=providers[r.meta.adapterId];if(!provider||!await chrome.permissions.contains({origins:[provider.origin]}))throw Error('BROWSER_SITE_PERMISSION_REQUIRED');
    if(message.executionId!==r.executionId||sender.tab.id!==r.page.tabId||sender.documentId!==r.page.documentId||message.pageEpoch!==r.page.pageEpoch||!sender.url?.startsWith(new URL(r.page.url).origin+'/'))throw Error('BROWSER_BINDING_LOST');
    await this.journal.append(r.meta,message.kind,message.data);await this.onEvents();return {stored:true};
  }
  async detach(){return undefined;}
  async observeIntegrityFailure(p,request) {
    const provider=providers[p.adapterId];if(p.adapterId!=='chatgpt-web'||!provider||!request.submitted||!await chrome.permissions.contains({origins:[provider.origin]}))return {observed:false};
    if(p.message?.type!=='text'||typeof p.message.text!=='string'||await digest(p.message)!==request.meta.payloadFingerprint)throw Error('BROWSER_OBSERVATION_UNPROVEN');
    const page=request.page,probe=await this.probe(p.adapterId,page.tabId);if(probe.pageEpoch!==page.pageEpoch)throw Error('BROWSER_BINDING_LOST');
    await chrome.scripting.executeScript({target:{tabId:page.tabId,documentIds:[page.documentId]},world:'ISOLATED',files:['src/providers/chatgpt/terminal.js']});
    const frames=await chrome.scripting.executeScript({target:{tabId:page.tabId,documentIds:[page.documentId]},world:'ISOLATED',args:[p.adapterId,{sessionKey:request.submitted.sessionKey,userAnchor:request.submitted.userAnchor,text:p.message.text}],func:async(adapterId,expected)=>{
      const observe=globalThis.AgentBridgeTerminalObservers?.[adapterId];if(!observe)throw Error('BROWSER_OBSERVATION_UNSUPPORTED');return observe(expected);
    }});
    const after=await this.probe(p.adapterId,page.tabId);if(frames.length!==1||frames[0].documentId!==page.documentId||after.pageEpoch!==page.pageEpoch)throw Error('BROWSER_BINDING_LOST');
    return {...frames[0].result,documentId:page.documentId,pageEpoch:page.pageEpoch};
  }
  async navigation(tabId) {
    const requests=(await this.journal.store.read()).requests.filter(r=>r.page.tabId===tabId&&!['completed','failed','cancelled','unknown'].includes(r.phase));
    if(!requests.length)return;
    let documentId;
    try {const frames=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>null});documentId=frames[0]?.documentId;}catch{}
    // Chrome can report loading for a same-document history transition. The
    // original document identity, rather than a loading flag or URL alone,
    // decides whether its observer was replaced. Failure stays conservative.
    for(const r of requests)if(!documentId||documentId!==r.page.documentId)await this.journal.invalidatePage(tabId,'BROWSER_PAGE_NAVIGATED',r.page.documentId);
    await this.onEvents();
  }
  async health(p) {
    const provider=providers[p.adapterId],enabled=!!provider&&await chrome.permissions.contains({origins:[provider.origin]});
    if(!p.bridgeSessionId)return {adapterId:p.adapterId,enabled,domChecked:false,loginChecked:false};
    if(typeof p.probeId!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(p.probeId))throw Error('BROWSER_INVALID_IDENTITY');
    const target=await this.journal.readControlTarget(p),session=target.session,blocked=target.blocked;
    const result={adapterId:p.adapterId,browserInstanceId:p.browserInstanceId,requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId,probeId:p.probeId,enabled,domChecked:false,pageReady:false,loginChecked:false,sessionClosed:target.owned&&session.closed===true,blocked};
    if(!target.latest||target.request&&session.page.documentId!==target.request.page.documentId)return {...result,code:'BROWSER_SESSION_MISMATCH'};
    if(session.closed)return {...result,code:'BROWSER_SESSION_CLOSED'};
    if(!enabled)return {...result,code:'BROWSER_SITE_PERMISSION_REQUIRED'};
    try {
      const reply=await this.inspection(p,session);
      if(reply?.result?.pageEpoch===session.page.pageEpoch&&reply.result.healthy===true&&!reply.error)return {...result,domChecked:true,pageReady:true,...(blocked?{code:'BROWSER_RESOURCE_BUSY'}:{})};
      const code=reply?.error?.code;
      const hints=['BROWSER_LOGIN_REQUIRED','BROWSER_DRAFT_PRESENT','BROWSER_MANUAL_BUSY','BROWSER_PROVIDER_ERROR','BROWSER_UNSUPPORTED_PAGE','BROWSER_UNSUPPORTED_MODE','BROWSER_EDITOR_UNAVAILABLE','BROWSER_SESSION_MISMATCH','BROWSER_CONTINUATION_UNVERIFIED','BROWSER_TRANSCRIPT_CHANGED','BROWSER_TRANSCRIPT_LIMIT'];
      return {...result,domChecked:hints.includes(code),code:hints.includes(code)?code:'BROWSER_BINDING_LOST'};
    } catch {return {...result,code:'BROWSER_PAGE_UNAVAILABLE'};}
  }
}
