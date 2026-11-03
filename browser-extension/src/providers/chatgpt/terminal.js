(() => {
  'use strict';
  globalThis.AgentBridgeTerminalObservers??={};
  if(globalThis.AgentBridgeTerminalObservers['chatgpt-web'])return;
  // Read the original submitted occurrence only. Never fill, click or resume.
  globalThis.AgentBridgeTerminalObservers['chatgpt-web']=async expected=>{
    const visible=e=>!!e&&e.getClientRects().length>0,normal=s=>String(s).replace(/\r\n/g,'\n');
    const read=()=>{
      const path=location.pathname.match(/^\/(c|uc)\/([a-zA-Z0-9-]+)\/?$/);
      if(location.origin!=='https://chatgpt.com'||location.search||location.hash||!path)return;
      const sessionKey='chatgpt-'+(path[1]==='uc'?'uc-':'')+path[2];if(sessionKey!==expected.sessionKey)return;
      const items=Array.from(document.querySelectorAll('[data-message-author-role], main li[data-message-role]')).filter(visible),role=e=>e.getAttribute('data-message-author-role')??e.getAttribute('data-message-role'),mobile=e=>e.matches('li[data-message-role]'),anchor=e=>e.getAttribute('data-message-id')??(mobile(e)?e.id:null);
      if(items.some(e=>!anchor(e)||!['user','assistant'].includes(role(e)))||new Set(items.map(anchor)).size!==items.length)return;
      const users=items.filter(e=>role(e)==='user'&&anchor(e)===expected.userAnchor);if(users.length!==1)return;
      const user=users[0],userText=mobile(user)?user.querySelector('[data-submit-message-animation-target]')?.firstElementChild?.innerText:user.innerText;if(normal(userText)!==normal(expected.text))return;
      const tail=items.slice(items.indexOf(user)+1),nextUser=tail.findIndex(e=>role(e)==='user'),assistants=(nextUser<0?tail:tail.slice(0,nextUser)).filter(e=>role(e)==='assistant');if(assistants.length!==1)return;
      const assistant=assistants[0],body=mobile(assistant)?assistant.querySelector('[aria-label="DIL content"]'):assistant.querySelector('.markdown')||assistant,text=body?.innerText?.trim();if(!text)return;
      const complete=mobile(assistant)?assistant.hasAttribute('data-message-complete')&&['','true'].includes(assistant.getAttribute('data-message-complete')):Array.from((assistant.closest('[data-testid^="conversation-turn-"]')||assistant.parentElement).querySelectorAll('[data-testid="copy-turn-action-button"], [data-testid="regenerate-response-button"]')).some(visible);
      const nativeSend=document.querySelector('form[data-mobile-composer] button[data-composer-submit]'),busy=visible(document.querySelector('[data-testid="stop-button"], button[aria-label="Stop streaming"]'))||visible(nativeSend)&&(nativeSend.type!=='submit'||!!nativeSend.getAttribute('data-stop-label')&&nativeSend.getAttribute('aria-label')===nativeSend.getAttribute('data-stop-label'));
      if(!complete||busy)return;
      return {sessionKey,userAnchor:anchor(user),assistantAnchor:anchor(assistant),text};
    };
    const first=read();if(!first)return {observed:false};await new Promise(r=>setTimeout(r,1500));const last=read();if(!last||JSON.stringify(last)!==JSON.stringify(first))return {observed:false};
    const terminalFingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(last)))),b=>b.toString(16).padStart(2,'0')).join('');
    if(JSON.stringify(read())!==JSON.stringify(last))return {observed:false};
    return {observed:true,proof:'bound-terminal-v1',sessionKey:last.sessionKey,userAnchor:last.userAnchor,assistantAnchor:last.assistantAnchor,terminalFingerprint,stableForMs:1500};
  };
})();
