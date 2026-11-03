(() => {
  'use strict';
  if(globalThis.agentBridgeContentReady)return;
  globalThis.agentBridgeContentReady=true;
  let composerWrite;
  const normalize=value=>String(value).replace(/\r\n/g,'\n');
  const epoch=crypto.randomUUID(),ownership={version:0,mutateComposer(editor,text,action){
    if(composerWrite)throw Error('BROWSER_INPUT_REENTRANT');
    composerWrite={editor,text:normalize(text),seen:false};
    try{return action();}finally{composerWrite=undefined;}
  }},requests=new Map();
  const touch=event=>{
    if(!event.isTrusted)return;
    // Chromium insertHTML emits one trusted input with empty inputType/data.
    // Only that synchronous write to this exact empty composer is ours. Human
    // edits, composition and any second/nested event still invalidate ownership.
    if(composerWrite&&!composerWrite.seen&&event.type==='input'&&event.target===composerWrite.editor&&event.inputType===''&&event.data===null&&!event.isComposing&&normalize(composerWrite.editor.innerText)===composerWrite.text){composerWrite.seen=true;return;}
    ownership.version++;
  };
  for(const name of ['beforeinput','input','paste','compositionstart'])document.addEventListener(name,touch,true);
  document.addEventListener('click',event=>{if(event.isTrusted&&event.target.closest?.('#prompt-textarea, #mobile-composer-prompt, form[data-mobile-composer] [data-composer-submit], [data-testid="send-button"], [data-testid="stop-button"], [data-testid*="edit-message"], [data-testid="regenerate-response-button"], [data-testid="previous-response-button"], [data-testid="next-response-button"]'))ownership.version++;},true);
  addEventListener('pagehide',()=>ownership.version++);
  const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(sender.id!==chrome.runtime.id||message?.protocol!=='agentbridge-content-v1')return;
    const run=async()=>{
      const Driver=globalThis.AgentBridgeDrivers?.[message.adapterId];if(!Driver)throw Error('BROWSER_ADAPTER_UNSUPPORTED');
      const driver=new Driver({epoch,ownership,emit:async()=>{}});
      if(message.method==='probe')return {pageEpoch:epoch,url:location.origin+location.pathname,...driver.health()};
      if(message.pageEpoch!==epoch)throw Error('BROWSER_BINDING_LOST');
      if(message.method==='inspect'){await driver.validateContinuation?.(undefined,message.binding);driver.inspect(message.binding);return {pageEpoch:epoch,healthy:true};}
      if(message.method!=='submit')throw Error('BROWSER_COMMAND_UNSUPPORTED');
      const p=message.params;
      if(!p||!id(p.requestId)||!id(p.executionId)||!id(p.documentId)||p.adapterId!==message.adapterId||p.message?.type!=='text'||typeof p.message.text!=='string'||!p.message.text.trim()||new TextEncoder().encode(p.message.text).length>65536)throw Error('BROWSER_INVALID_INPUT');
      if(requests.has(p.requestId))return {accepted:false,state:'unknown'};
      requests.set(p.requestId,{executionId:p.executionId});
      let sending=Promise.resolve();
      const executing=new Driver({epoch,ownership,emit:(kind,data)=>{
        const result=sending.then(async()=>{
          const receipt=await chrome.runtime.sendMessage({protocol:'agentbridge-content-event-v1',pageEpoch:epoch,requestId:p.requestId,executionId:p.executionId,kind,data});
          if(!receipt?.result?.stored)throw Error('BROWSER_EVENT_NOT_STORED');return receipt;
        });
        sending=result.catch(()=>{});return result;
      }});
      await executing.validateContinuation?.(p,message.binding);
      // start() writes once. Native ARIA readiness may delay its one click;
      // later failures become original unknown events, never a resend.
      const observation=executing.start(p,message.binding);observation.catch(()=>{});
      return {accepted:true,requestId:p.requestId};
    };
    run().then(result=>reply({result}),error=>reply({error:{code:error.code||error.message||'BROWSER_CONTENT_ERROR'}}));
    return true;
  });
})();
