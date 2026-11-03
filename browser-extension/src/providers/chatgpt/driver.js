(() => {
  'use strict';
  if(globalThis.AgentBridgeDrivers?.['chatgpt-web'])return;
  const fail=code=>Object.assign(Error(code),{code});
  const mobileMessages='li[data-message-role]';
  const selectors={editor:'#prompt-textarea, textarea[data-testid="prompt-textarea"], textarea#mobile-composer-prompt',send:'button[data-testid="send-button"]',stop:'button[data-testid="stop-button"], button[aria-label="Stop streaming"]',messages:'[data-message-author-role], '+mobileMessages,complete:'button[data-testid="copy-turn-action-button"], button[data-testid="regenerate-response-button"]',error:'[data-testid="conversation-turn-error"], [data-testid="conversation-error"]'};
  const visible=element=>!!element&&element.getClientRects().length>0;
  const normal=value=>String(value).replace(/\r\n/g,'\n');
  const value=editor=>{
    if('value' in editor)return normal(editor.value);
    const text=normal(editor.innerText),only=editor.childNodes[0];
    // Chromium leaves one bare BR after deleting all editable text. Accept only
    // that exact empty placeholder; spaces, authored newlines and richer DOM
    // remain drafts and must never be trimmed away.
    return text==='\n'&&editor.childNodes.length===1&&only.nodeType===1&&only.tagName==='BR'&&only.attributes.length===0?'':text;
  };
  const mobile=element=>!!element?.matches(mobileMessages);
  const role=element=>element.getAttribute('data-message-author-role')??element.getAttribute('data-message-role');
  const content=element=>mobile(element)?role(element)==='assistant'?element.querySelector('[aria-label="DIL content"]'):element.querySelector('[data-submit-message-animation-target]')?.firstElementChild:element.querySelector('.markdown')||element;
  const userText=element=>mobile(element)?content(element)?.innerText||'':element.innerText;
  const sessionKey=()=>{const match=location.pathname.match(/^\/(c|uc)\/([a-zA-Z0-9-]+)\/?$/);return match?'chatgpt-'+(match[1]==='uc'?'uc-':'')+match[2]:null;};
  const messages=()=>{const items=Array.from(document.querySelectorAll(selectors.messages)).filter(e=>visible(e)&&(!mobile(e)||e.closest('main')));if(items.some(mobile)&&items.some(e=>!mobile(e))||items.some(e=>!['user','assistant'].includes(role(e))))throw fail('BROWSER_UNSUPPORTED_MODE');return items;};
  const anchor=element=>element?.getAttribute('data-message-id')??(mobile(element)?element.id:null);
  const answer=element=>(content(element)?.innerText||'').trim();
  const singleEditor=()=>{const editors=Array.from(document.querySelectorAll(selectors.editor)).filter(visible);if(editors.length!==1)throw fail('BROWSER_LOGIN_REQUIRED');return editors[0];};
  const mobileEditor=editor=>editor.id==='mobile-composer-prompt';
  const sendFor=editor=>mobileEditor(editor)?editor.closest('form[data-mobile-composer]')?.querySelector('button[data-composer-submit]'):document.querySelector(selectors.send);
  const ready=(editor,send)=>visible(send)&&!send.disabled&&send.getAttribute('aria-disabled')!=='true'&&(!mobileEditor(editor)||send.type==='submit'&&!!send.getAttribute('data-send-label')&&send.getAttribute('aria-label')===send.getAttribute('data-send-label'));
  const busy=()=>{if(visible(document.querySelector(selectors.stop)))return true;const send=document.querySelector('form[data-mobile-composer] button[data-composer-submit]');return visible(send)&&(send.type!=='submit'||!!send.getAttribute('data-stop-label')&&send.getAttribute('aria-label')===send.getAttribute('data-stop-label'));};
  const complete=assistant=>mobile(assistant)?assistant.hasAttribute('data-message-complete')&&['','true'].includes(assistant.getAttribute('data-message-complete')):Array.from((assistant.closest('[data-testid^="conversation-turn-"]')||assistant.parentElement)?.querySelectorAll(selectors.complete)||[]).some(visible);
  const bodies=new WeakMap();
  const nativeChange=(record,message)=>{
    if(record.type==='attributes'&&record.target===message)return true;
    const current=content(message),previous=bodies.get(message),roots=[current,previous].filter(Boolean);
    if(current!==previous)return true;
    return roots.some(root=>record.target===root||root.contains(record.target)||record.type==='attributes'&&record.target.contains?.(root)||[...record.addedNodes,...record.removedNodes].some(node=>node===root||node.contains?.(root)));
  };
  let historyRevision=0,historyPoisoned=false;const anchorRevisions=new Map();
  const touchesHistory=node=>node?.nodeType===1?!!(node.matches(selectors.messages)||node.closest(selectors.messages)||node.querySelector(selectors.messages)):!!node?.parentElement?.closest(selectors.messages);
  const changed=records=>{
    const changedAnchors=new Set();let touched=false;
    const collect=node=>{const element=node?.nodeType===1?node:node?.parentElement;if(!element)return;const remember=message=>{changedAnchors.add(anchor(message));if(mobile(message))bodies.set(message,content(message));};const message=element.closest(selectors.messages);if(message)remember(message);for(const child of element.querySelectorAll(selectors.messages))remember(child);};
    for(const r of records){
      const inside=r.target.nodeType===1?r.target.closest(selectors.messages):r.target.parentElement?.closest(selectors.messages);
      // Native layout updates do not rewrite a message body or its identity.
      // Keep structural/text/identity records (including edit-and-revert), and
      // still compare the complete visible transcript at every fence.
      if(r.type==='attributes'&&r.attributeName==='style'){
        const descendants=inside?[inside]:Array.from(r.target.querySelectorAll(selectors.messages));
        if(descendants.length&&descendants.every(mobile))continue;
      }
      if(inside&&mobile(inside)&&!nativeChange(r,inside))continue;
      if(inside||r.type==='attributes'&&touchesHistory(r.target)){touched=true;collect(r.target);}
      for(const node of [...r.addedNodes,...r.removedNodes])if(touchesHistory(node)){touched=true;collect(node);}
      if(['data-message-id','id'].includes(r.attributeName)&&r.oldValue)changedAnchors.add(r.oldValue);
    }
    if(!touched)return;if(historyRevision>=Number.MAX_SAFE_INTEGER||anchorRevisions.size+[...changedAnchors].filter(id=>id&&!anchorRevisions.has(id)).length>8192){historyPoisoned=true;return;}historyRevision++;
    for(const id of changedAnchors)if(id)anchorRevisions.set(id,historyRevision);
  };
  const observer=new MutationObserver(changed);
  observer.observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['data-message-id','data-message-author-role','id','data-message-role','data-message-complete','hidden','style']});
  const history=()=>{
    changed(observer.takeRecords());if(historyPoisoned)throw fail('BROWSER_TRANSCRIPT_LIMIT');const items=messages();
    if(items.some(e=>!anchor(e))||new Set(items.map(anchor)).size!==items.length)throw fail('BROWSER_MESSAGE_ANCHOR_MISSING');
    for(const item of items)if(mobile(item))bodies.set(item,content(item));
    const canonical=JSON.stringify(items.map(e=>[role(e),anchor(e),normal(role(e)==='assistant'?answer(e):userText(e))]));
    if(new TextEncoder().encode(canonical).length>1048576)throw fail('BROWSER_TRANSCRIPT_LIMIT');
    return {items,canonical,revision:historyRevision,anchorRevisions:Object.fromEntries(items.map(e=>[anchor(e),anchorRevisions.get(anchor(e))||0]))};
  };
  const fingerprint=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
  document.addEventListener('click',event=>{if(event.isTrusted&&event.target.closest?.('[data-testid="regenerate-response-button"], [data-testid*="edit-message"], [data-testid="previous-response-button"], [data-testid="next-response-button"]')){if(historyRevision<Number.MAX_SAFE_INTEGER)historyRevision++;else historyPoisoned=true;}},true);
  class ChatGPTDriver {
    constructor({epoch,ownership,emit,timing={}}){this.epoch=epoch;this.ownership=ownership;this.emit=emit;this.timing={poll:250,stable:1500,inputReady:5000,submission:15000,idle:90000,total:600000,...timing};}
    inspect(expected) {
      if(location.origin!=='https://chatgpt.com'||location.search||location.hash||!/^\/(?:(?:c|uc)\/[a-zA-Z0-9-]+\/?)?$/.test(location.pathname))throw fail('BROWSER_UNSUPPORTED_PAGE');
      if(expected?.pageEpoch&&expected.pageEpoch!==this.epoch)throw fail('BROWSER_BINDING_LOST');
      if(expected?.sessionKey&&sessionKey()!==expected.sessionKey)throw fail('BROWSER_SESSION_MISMATCH');
      if(expected?.userAnchor&&anchor(messages().filter(e=>role(e)==='user').at(-1))!==expected.userAnchor)throw fail('BROWSER_SESSION_MISMATCH');
      if(document.querySelector(selectors.error))throw fail('BROWSER_PROVIDER_ERROR');
      const editor=singleEditor();
      if(busy())throw fail('BROWSER_MANUAL_BUSY');
      if(document.querySelector('[data-testid="attachment-preview"], [data-testid="file-upload-progress"]'))throw fail('BROWSER_UNSUPPORTED_MODE');
      const send=sendFor(editor);if(mobileEditor(editor)&&!editor.closest('form[data-mobile-composer]'))throw fail('BROWSER_UNSUPPORTED_MODE');
      if(editor.disabled||editor.getAttribute('contenteditable')==='false')throw fail('BROWSER_EDITOR_UNAVAILABLE');
      if(value(editor).length)throw fail('BROWSER_DRAFT_PRESENT');
      return {editor,send,sessionKey:sessionKey(),pageEpoch:this.epoch,url:location.origin+location.pathname};
    }
    health(){try{this.inspect();return {healthy:true,adapterId:'chatgpt-web',driverVersion:'0.1.0'};}catch(error){return {healthy:false,adapterId:'chatgpt-web',code:error.code||'BROWSER_DRIVER_ERROR'};}}
    binding(p,expected) {
      const result={...expected};
      for(const key of ['sessionKey','userAnchor','transcriptFingerprint','assistantAnchor','historyRevision'])if(p?.binding?.[key]!==undefined){if(result[key]!==undefined&&result[key]!==p.binding[key])throw fail('BROWSER_SESSION_MISMATCH');result[key]=p.binding[key];}
      return result;
    }
    async validateContinuation(p,expected) {
      const binding=this.binding(p,expected);this.inspect(binding);
      this.continuation=undefined;if(!binding.userAnchor)return;
      if(!/^[a-f0-9]{64}$/.test(binding.transcriptFingerprint||'')||typeof binding.assistantAnchor!=='string'||!Number.isSafeInteger(binding.historyRevision)||binding.historyRevision<0)throw fail('BROWSER_CONTINUATION_UNVERIFIED');
      const before=history(),lastAssistant=before.items.filter(e=>role(e)==='assistant').at(-1);
      if(before.revision!==binding.historyRevision||anchor(lastAssistant)!==binding.assistantAnchor||await fingerprint(before.canonical)!==binding.transcriptFingerprint)throw fail('BROWSER_TRANSCRIPT_CHANGED');
      const after=history();if(after.revision!==before.revision||after.canonical!==before.canonical)throw fail('BROWSER_TRANSCRIPT_CHANGED');
      this.continuation=after;
    }
    start(p,expected) {
      const binding=this.binding(p,expected),priorAnchor=binding.userAnchor;
      const initial=this.inspect(binding),version=this.ownership.version,prior=history();
      if(priorAnchor&&(!this.continuation||prior.revision!==this.continuation.revision||prior.canonical!==this.continuation.canonical))throw fail('BROWSER_CONTINUATION_UNVERIFIED');
      const baseline=prior.items,oldIds=new Set(baseline.map(anchor).filter(Boolean));
      if(!priorAnchor&&baseline.length)throw fail('BROWSER_SESSION_MISMATCH');
      if(baseline.some(e=>!anchor(e)))throw fail('BROWSER_MESSAGE_ANCHOR_MISSING');
      if(p.binding?.userAnchor&&!baseline.some(e=>anchor(e)===p.binding.userAnchor&&role(e)==='user'))throw fail('BROWSER_SESSION_MISMATCH');
      const editor=initial.editor;
      editor.focus();
      if('value' in editor) {
        const setter=Object.getOwnPropertyDescriptor(editor.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')?.set;
        if(!setter)throw fail('BROWSER_EDITOR_UNSUPPORTED');setter.call(editor,p.message.text);editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:p.message.text}));
      } else {
        const selection=getSelection(),range=document.createRange();range.selectNodeContents(editor);selection.removeAllRanges();selection.addRange(range);
        // insertText expands consecutive line breaks into extra block spacing in
        // Chromium. Construct only escaped text + explicit breaks; no user HTML
        // is interpreted. The full visible value is checked before the one click.
        const markup=normal(p.message.text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        const insert=()=>document.execCommand('insertHTML',false,markup);
        if(!(this.ownership.mutateComposer?this.ownership.mutateComposer(editor,p.message.text,insert):insert()))throw fail('BROWSER_INPUT_FAILED');
        // Notify the page of the completed plain-text write. This notification
        // does not perform another edit or send action.
        editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:normal(p.message.text)}));
      }
      // Recheck every original fence after asynchronous native ARIA updates.
      const check=()=>{
        const users=messages().filter(e=>role(e)==='user'),currentHistory=history();
        if(currentHistory.revision!==prior.revision||currentHistory.canonical!==prior.canonical||this.ownership.version!==version||location.search||location.hash||location.origin+location.pathname!==initial.url||!editor.isConnected||singleEditor()!==editor||value(editor)!==normal(p.message.text)||busy()||users.some(e=>!oldIds.has(anchor(e)))||priorAnchor&&anchor(users.at(-1))!==priorAnchor)throw fail('BROWSER_INPUT_CHANGED');
        return sendFor(editor);
      };
      const send=()=>{const control=check();if(!ready(editor,control))throw fail('BROWSER_INPUT_CHANGED');control.click();return this.watch(p,{version,oldIds,history:prior.canonical,anchorRevisions:prior.anchorRevisions,initialKey:initial.sessionKey,initialUrl:initial.url});};
      if(!mobileEditor(editor))return send();
      return (async()=>{
        try{
          const deadline=Date.now()+this.timing.inputReady;
          while(!ready(editor,check())){if(Date.now()>=deadline)throw fail('BROWSER_INPUT_CHANGED');await new Promise(resolve=>setTimeout(resolve,25));}
          return await send(); // One click only; no Enter or send retry.
        }catch(error){await this.emit('unknown',{text:error.code||'BROWSER_OBSERVATION_LOST'});}
      })();
    }
    async watch(p,before) {
      const start=Date.now();let user,userRevision,assistant,lastText='',lastActivity=start,stableAt=start,revision=0,finished=false;
      const emit=async(kind,data)=>{await this.emit(kind,data);};
      try {
        while(Date.now()-start<this.timing.total) {
          if(this.ownership.version!==before.version)throw fail('BROWSER_USER_INTERFERENCE');
          if(location.origin!=='https://chatgpt.com'||location.search||location.hash||before.initialKey&&sessionKey()!==before.initialKey)throw fail('BROWSER_SESSION_MISMATCH');
          if(!before.initialKey&&location.origin+location.pathname!==before.initialUrl&&!sessionKey())throw fail('BROWSER_SESSION_MISMATCH');
          const observed=history(),current=observed.items,newUsers=current.filter(e=>role(e)==='user'&&!before.oldIds.has(anchor(e)));
          if(Object.entries(before.anchorRevisions).some(([id,revision])=>observed.anchorRevisions[id]!==revision))throw fail('BROWSER_USER_INTERFERENCE');
          if(JSON.stringify(current.filter(e=>before.oldIds.has(anchor(e))).map(e=>[role(e),anchor(e),normal(role(e)==='assistant'?answer(e):userText(e))]))!==before.history)throw fail('BROWSER_USER_INTERFERENCE');
          if(newUsers.length>1)throw fail('BROWSER_USER_INTERFERENCE');
          if(!user&&newUsers.length===1) {
            const candidate=newUsers[0];
            if(!anchor(candidate)||normal(userText(candidate))!==normal(p.message.text)&&(!mobile(candidate)||userText(candidate)))throw fail('BROWSER_SUBMISSION_UNKNOWN');
            if(sessionKey()&&normal(userText(candidate))===normal(p.message.text)) {
              user=candidate;userRevision=observed.anchorRevisions[anchor(user)];before.initialKey=sessionKey();
              await emit('submitted',{binding:{sessionKey:sessionKey(),userAnchor:anchor(user),documentId:p.documentId}});lastActivity=Date.now();
            }
          }
          if(user) {
            if(!user.isConnected||!current.includes(user))throw fail('BROWSER_BINDING_LOST');
            if(observed.anchorRevisions[anchor(user)]!==userRevision||normal(userText(user))!==normal(p.message.text)||current.filter(e=>role(e)==='user').at(-1)!==user)throw fail('BROWSER_USER_INTERFERENCE');
            const candidates=current.filter(e=>role(e)==='assistant'&&!before.oldIds.has(anchor(e))&&(user.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));
            if(candidates.length>1)throw fail('BROWSER_UNSUPPORTED_MODE');
            if(candidates.length===1) {
              if(!anchor(candidates[0])||assistant&&anchor(assistant)!==anchor(candidates[0]))throw fail('BROWSER_BINDING_LOST');
              assistant=candidates[0];const text=answer(assistant);
              if(text!==lastText){lastText=text;lastActivity=stableAt=Date.now();if(text)await emit('output.snapshot',{text,revision:++revision});}
              const marker=complete(assistant),stop=busy();
              if(marker&&!stop&&lastText&&Date.now()-stableAt>=this.timing.stable) {
                if(this.ownership.version!==before.version||sessionKey()!==before.initialKey)throw fail('BROWSER_USER_INTERFERENCE');
                const snapshot=history(),transcriptFingerprint=await fingerprint(snapshot.canonical),after=history();
                if(this.ownership.version!==before.version||sessionKey()!==before.initialKey||snapshot.revision!==after.revision||snapshot.canonical!==after.canonical||answer(assistant)!==lastText||busy()||!complete(assistant))throw fail('BROWSER_USER_INTERFERENCE');
                await emit('completed',{text:lastText,continuation:{transcriptFingerprint,assistantAnchor:anchor(assistant),historyRevision:after.revision}});finished=true;return;
              }
            }
          }
          if(document.querySelector(selectors.error))throw fail('BROWSER_PROVIDER_ERROR');
          if(!user&&Date.now()-start>=this.timing.submission||Date.now()-lastActivity>=this.timing.idle)throw fail('BROWSER_OUTPUT_TIMEOUT');
          await new Promise(resolve=>setTimeout(resolve,this.timing.poll));
        }
        throw fail('BROWSER_OUTPUT_TIMEOUT');
      } catch(error) {
        if(!finished)await emit('unknown',{text:error.code||'BROWSER_OBSERVATION_LOST'});
      }
    }
  }
  globalThis.AgentBridgeDrivers??={};globalThis.AgentBridgeDrivers['chatgpt-web']=ChatGPTDriver;
})();
