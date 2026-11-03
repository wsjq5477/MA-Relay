import {BrowserClient} from './client.mjs';
import {IndexedState} from './indexed-state.mjs';
import {BrowserJournal} from './journal.mjs';
import {BrowserExecutor} from './executor.mjs';
import {ChromePages,registerProviderScripts} from './pages.mjs';
let client,executor,journal,pages,connecting,retryTimer,retry=0;
let controlChain=Promise.resolve();
const controlQueue=work=>{const result=controlChain.then(work);controlChain=result.catch(()=>{});return result;};
const reconnect=()=>controlQueue(connect);
const inFlight=new Map();
const initialized=(async()=>{
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  journal=new BrowserJournal(await IndexedState.open());await journal.recover();
  pages=new ChromePages({journal,onEvents:flush});executor=new BrowserExecutor({journal,pages,onEvents:flush});
  await registerProviderScripts();
})();
async function flush() {
  if(!client?.online||!journal)return;
  for(const e of await journal.outbox()) {
    if(inFlight.has(e.executionId))continue;
    inFlight.set(e.executionId,e.seq);
    try{await client.sendEvent(e);}catch{inFlight.delete(e.executionId);return;}
  }
}
async function connect() {
  await initialized;
  if(connecting||client?.online)return connecting;
  connecting=(async()=>{
    const config=(await chrome.storage.local.get('browserPairing')).browserPairing;
    if(!config||(await chrome.storage.local.get('browserEnabled')).browserEnabled===false)return;
    const current=new BrowserClient(config,{
      origin:'chrome-extension://'+chrome.runtime.id,
      persist:config=>chrome.storage.local.set({browserPairing:config}),
      onCommand:(method,p)=>{if(p?.browserInstanceId!==config.browserInstanceId)throw Error('BROWSER_WRONG_PROFILE');return executor.command(method,p);},
      onEventReceipt:async receipt=>{
        inFlight.delete(receipt.executionId);
        if(receipt.kind==='event.ack')await journal.acknowledge(receipt.executionId,receipt.throughSeq);
        if(receipt.kind==='event.ack')await flush();
      },
      onDisconnect:async()=>{
        if(client!==current)return;
        inFlight.clear();await journal.recover();
        clearTimeout(retryTimer);retryTimer=setTimeout(()=>reconnect().catch(()=>{}),Math.min(30000,1000*2**Math.min(retry++,5))+Math.random()*250);
      }
    });
    client=current;inFlight.clear();await current.open();retry=0;await flush();
  })().finally(()=>{connecting=undefined;});
  return connecting;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.protocol==='agentbridge-options-v1') {
    if(sender.id!==chrome.runtime.id||!sender.url?.startsWith('chrome-extension://'+chrome.runtime.id+'/'))return;
    const control=async()=>{
      await initialized;
      if(message.method==='status'){const saved=await chrome.storage.local.get(['browserPairing','browserEnabled']),config=saved.browserPairing;return {paired:!!config,credentialSaved:typeof config?.key==='string',online:client?.online===true,enabled:saved.browserEnabled!==false,extensionId:chrome.runtime.id,chatgptEnabled:await chrome.permissions.contains({origins:['https://chatgpt.com/*']}),...(config?{nodeId:config.nodeId,browserInstanceId:config.browserInstanceId,endpoint:config.url}:{}),unresolved:(await journal.store.read()).requests.filter(r=>!['completed','failed','cancelled'].includes(r.phase)).length};}
      if(message.method==='pause'){await chrome.storage.local.set({browserEnabled:false});clearTimeout(retryTimer);client?.close();await journal.recover();return {enabled:false};}
      if(message.method==='resume'){await chrome.storage.local.set({browserEnabled:true});await connect();return {enabled:true,online:client?.online===true};}
      if(message.method==='reconnect'){await connect();return {online:client?.online===true};}
      if(message.method!=='configure')throw Error('BROWSER_OPTIONS_UNSUPPORTED');
      const config=message.config;
      new BrowserClient(config,{origin:'chrome-extension://'+chrome.runtime.id});
      const old=(await chrome.storage.local.get('browserPairing')).browserPairing;
      if(old&&['protocol','nodeId','pairingId','browserInstanceId','origin','url'].some(k=>old[k]!==config[k]))throw Error('BROWSER_PAIRING_REPLACEMENT_REQUIRES_REVIEW');
      // Retry the same initial pairing after a paste/authentication error. A
      // verified derived credential is never replaced by another pasted key.
      if(!old||!old.key)await chrome.storage.local.set({browserPairing:config});
      await chrome.storage.local.set({browserEnabled:true});await connect();return {configured:true,online:client?.online===true};
    };
    controlQueue(control).then(result=>reply({result}),()=>reply({error:{code:'BROWSER_CONFIGURATION_FAILED'}}));return true;
  }
  if(message?.protocol!=='agentbridge-content-event-v1')return;
  initialized.then(()=>pages.receive(message,sender)).then(result=>reply({result}),error=>{
    if(error.message?.startsWith('BROWSER_JOURNAL_'))client?.close();
    reply({error:{code:'BROWSER_EVENT_REJECTED'}});
  });return true;
});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='agentbridge-browser-reconnect')reconnect().then(flush).catch(()=>{});});
chrome.runtime.onStartup.addListener(()=>{reconnect().catch(()=>{});});
chrome.action.onClicked.addListener(()=>{chrome.runtime.openOptionsPage().catch(()=>{});});
chrome.runtime.onInstalled.addListener(()=>{chrome.alarms.create('agentbridge-browser-reconnect',{periodInMinutes:0.5});reconnect().catch(()=>{});});
chrome.permissions.onAdded.addListener(()=>{registerProviderScripts().catch(()=>{});});
chrome.permissions.onRemoved.addListener(()=>{
  initialized.then(async()=>{
    await registerProviderScripts();
    for(const r of (await journal.store.read()).requests)if(!(await pages.health(r.meta)).enabled)await journal.invalidatePage(r.page.tabId,'BROWSER_SITE_PERMISSION_REVOKED');
    await flush();
  }).catch(()=>client?.close());
});
chrome.tabs.onRemoved.addListener(tabId=>{initialized.then(()=>journal.invalidatePage(tabId,'BROWSER_PAGE_CLOSED')).then(flush).catch(()=>client?.close());});
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(['loading','complete'].includes(change.status))initialized.then(()=>pages.navigation(tabId)).catch(()=>client?.close());});
reconnect().catch(()=>{});
