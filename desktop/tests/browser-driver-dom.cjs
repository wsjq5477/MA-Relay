'use strict';
// Actual Chromium DOM/events; chrome.runtime is a controlled receipt fixture.
// Provider HTML and all page network responses are intercepted, with no account.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),assert=require('node:assert/strict');
const {chromium}=createRequire(path.join(__dirname,'../package.json'))('playwright');
const driver=fs.readFileSync(path.join(__dirname,'../../browser-extension/src/providers/chatgpt/driver.js'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'../../browser-extension/src/content/runtime.js'),'utf8');
const terminalReader=fs.readFileSync(path.join(__dirname,'../../browser-extension/src/providers/chatgpt/terminal.js'),'utf8');
const evidenceDay=process.env.AGENTBRIDGE_BROWSER_EVIDENCE_DATE||'2026-10-30';
const reportName=process.env.AGENTBRIDGE_BROWSER_REPORT||'driver-dom.json';
if(!/^\d{4}-\d{2}-\d{2}$/.test(evidenceDay)||!/^[a-z0-9-]+\.json$/.test(reportName))throw Error('Invalid evidence path.');
function html({textarea=false,hold=false,tamper=false,replace=false}={}){
  return `<!doctype html><meta charset="utf-8"><style>#prompt-textarea{display:block;width:600px;min-height:90px;white-space:pre-wrap}[data-message-author-role]{white-space:pre-wrap}</style><main></main>${textarea?'<textarea id="prompt-textarea"></textarea>':'<div id="prompt-textarea" contenteditable="true" role="textbox"></div>'}<button data-testid="send-button" disabled>Send</button><button data-testid="stop-button" hidden>Stop</button><script>
  window.clicks=0;window.observed=[];
  window.chrome={runtime:{id:'test-extension',onMessage:{addListener:fn=>window.listener=fn},sendMessage:async e=>{window.observed.push(e);return {result:{stored:true}};}}};
  const editor=document.getElementById('prompt-textarea'),send=document.querySelector('[data-testid="send-button"]'),stop=document.querySelector('[data-testid="stop-button"]');
  const value=()=>('value'in editor?editor.value:editor.innerText);
  editor.addEventListener('input',()=>{send.disabled=!value();${tamper?"editor.textContent='Site changed input';":''}${replace?'editor.replaceWith(editor.cloneNode(true));':''}});
  send.onclick=()=>{const input=value();const n=++window.clicks;history.replaceState(null,'','/c/dom-fixture');const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.dataset.messageId='user-'+n;user.textContent=input;const turn=document.createElement('section');turn.dataset.testid='conversation-turn-1';const assistant=document.createElement('div');assistant.dataset.messageAuthorRole='assistant';assistant.dataset.messageId='assistant-'+n;assistant.textContent='Partial';turn.append(assistant);document.querySelector('main').append(user,turn);if('value'in editor)editor.value='';else editor.textContent='';send.disabled=true;stop.hidden=false;window.finish=()=>{assistant.textContent='Finished';const copy=document.createElement('button');copy.dataset.testid='copy-turn-action-button';copy.textContent='Copy';turn.append(copy);stop.hidden=true;};${hold?'':'setTimeout(window.finish,100);'}};
  </script>`;
}
const completedBinding=page=>page.evaluate(()=>({...window.observed.findLast(e=>e.kind==='submitted').data.binding,...window.observed.findLast(e=>e.kind==='completed').data.continuation}));
function mobileHTML({readyDelay=40,stopDelay=180,hold=false,replace=false}={}){
  return `<!doctype html><meta charset="utf-8"><style>textarea{width:600px;height:90px}li{white-space:pre-wrap}h4{position:absolute;width:1px;height:1px;overflow:hidden}</style><main><ul></ul></main><form data-mobile-composer><textarea id="mobile-composer-prompt"></textarea><button type="submit" data-composer-submit data-send-label="Send" data-stop-label="Stop" aria-label="Send" aria-disabled="true">Send</button></form><script>
  window.clicks=0;window.observed=[];window.chrome={runtime:{id:'test-extension',onMessage:{addListener:fn=>window.listener=fn},sendMessage:async e=>{window.observed.push(e);return {result:{stored:true}};}}};
  const editor=document.querySelector('textarea'),form=document.querySelector('form'),send=form.querySelector('button');form.onsubmit=e=>e.preventDefault();
  editor.addEventListener('input',()=>{const input=editor.value;setTimeout(()=>{${replace?"editor.replaceWith(editor.cloneNode(true));":''}if(editor.value===input&&input)send.removeAttribute('aria-disabled');},${readyDelay});});
  send.onclick=e=>{e.preventDefault();if(send.getAttribute('aria-disabled')==='true'||!editor.value)return;const text=editor.value,n=++window.clicks;history.replaceState(null,'','/uc/mobile-fixture');
    const user=document.createElement('li');user.id='mobile-user-'+n;user.dataset.messageRole='user';user.innerHTML='<h4 data-message-attribution>You said:</h4><div data-submit-message-animation-target><div></div><div><div data-message-actions data-user-message-actions role="group"><button>Copy</button></div></div></div>';user.querySelector('[data-submit-message-animation-target]').firstElementChild.textContent=text;
    const assistant=document.createElement('li');assistant.id='mobile-assistant-'+n;assistant.dataset.messageRole='assistant';assistant.innerHTML='<h4 data-message-attribution>ChatGPT said:</h4><div><div role="region" aria-label="DIL content">Partial</div></div><div data-assistant-message-actions data-message-actions role="group"><button data-copy-message>Copy reply</button></div>';
    document.querySelector('ul').append(user,assistant);editor.value='';send.type='button';send.setAttribute('aria-label','Stop');send.textContent='Stop';send.removeAttribute('aria-disabled');
    window.releaseStop=()=>{send.type='submit';send.setAttribute('aria-label','Send');send.textContent='Send';send.setAttribute('aria-disabled','true');};
    window.finish=()=>{assistant.querySelector('[aria-label="DIL content"]').textContent='Finished';assistant.setAttribute('data-message-complete','');setTimeout(window.releaseStop,${stopDelay});};${hold?'':'setTimeout(window.finish,100);'}
  };</script>`;
}
async function run(){
  const browser=await chromium.launch({executablePath:process.env.AGENTBRIDGE_TEST_CHROMIUM||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1223/chrome-win64/chrome.exe'),headless:true});
  const report={executedAtUtc:new Date().toISOString(),scope:'real Chromium DOM/Driver/content ownership with controlled chrome.runtime and intercepted Provider HTML; no real MV3/Provider/native model',browser:browser.version(),tests:[]};
  async function test(name,options,work){
    const context=await browser.newContext(),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.route('**/*',r=>r.request().url()==='https://chatgpt.com/'?r.fulfill({contentType:'text/html',body:options.mobile?mobileHTML(options):html(options)}):r.abort());
      await page.goto('https://chatgpt.com/');await page.addScriptTag({content:driver});await page.addScriptTag({content:runtime});
      const submit=(text,extra={})=>page.evaluate(async({text,extra})=>{const call=message=>new Promise(resolve=>window.listener({protocol:'agentbridge-content-v1',adapterId:'chatgpt-web',...message},{id:'test-extension'},resolve));const probe=await call({method:'probe'});return call({method:'submit',pageEpoch:probe.result.pageEpoch,...(extra.binding?{binding:extra.binding}:{}),params:{requestId:'request-1',executionId:'execution-1',documentId:'document-1',adapterId:'chatgpt-web',message:{type:'text',text},...extra}});},{text,extra});
      await work(page,submit);assert.deepEqual(errors,[]);report.tests.push({name,ok:true});
    }catch(error){report.tests.push({name,ok:false,error:error.stack});}
    finally{await context.close();}
  }
  try{
    await test('mobile public DOM waits for ARIA readiness and uses native anchors and body text',{mobile:true},async(page,submit)=>{
      assert.equal((await submit('Native line 1\n  <literal line 2>')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));assert.equal(await page.evaluate(()=>window.clicks),1);
      const events=await page.evaluate(()=>window.observed);assert.equal(events.find(e=>e.kind==='submitted').data.binding.sessionKey,'chatgpt-uc-mobile-fixture');assert.equal(events.find(e=>e.kind==='completed').data.text,'Finished');assert.equal(await page.locator('[data-submit-message-animation-target]').first().locator(':scope > div').first().innerText(),'Native line 1\n  <literal line 2>');
    });
    await test('mobile complete attribute alone never ends while native Stop is still present',{mobile:true,stopDelay:3000},async(page,submit)=>{
      assert.equal((await submit('Joint completion')).result?.accepted,true);await page.waitForFunction(()=>document.querySelector('[data-message-complete]'));await page.waitForTimeout(1700);assert.equal(await page.evaluate(()=>window.observed.some(e=>e.kind==='completed')),false);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('mobile manual typing during asynchronous readiness refuses the click',{mobile:true,readyDelay:1200},async(page,submit)=>{
      assert.equal((await submit('Original pending input')).result?.accepted,true);await page.locator('#mobile-composer-prompt').fill('User intervened');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='unknown'));assert.equal(await page.evaluate(()=>window.clicks),0);assert.equal(await page.locator('#mobile-composer-prompt').inputValue(),'User intervened');
    });
    await test('mobile composer replacement during asynchronous readiness refuses the click',{mobile:true,replace:true},async(page,submit)=>{
      assert.equal((await submit('Original pending input')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='unknown'));assert.equal(await page.evaluate(()=>window.clicks),0);
    });
    await test('mobile original human draft remains untouched',{mobile:true},async(page,submit)=>{
      await page.locator('#mobile-composer-prompt').fill('Manual draft');assert.equal((await submit('Do not replace')).error?.code,'BROWSER_DRAFT_PRESENT');assert.equal(await page.locator('#mobile-composer-prompt').inputValue(),'Manual draft');assert.equal(await page.evaluate(()=>window.clicks),0);
    });
    await test('mobile continuation retains the same native session and original history proof',{mobile:true},async(page,submit)=>{
      assert.equal((await submit('First mobile turn')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));const binding=await completedBinding(page);
      assert.equal((await submit('Second mobile turn',{requestId:'request-2',executionId:'execution-2',binding})).result?.accepted,true);await page.waitForFunction(()=>window.observed.filter(e=>e.kind==='completed').length===2);assert.equal(await page.evaluate(()=>window.clicks),2);assert.equal((await completedBinding(page)).sessionKey,binding.sessionKey);
    });
    await test('mobile continuation tolerates native layout changes around the same message bodies',{mobile:true,hold:true},async(page,submit)=>{
      await submit('First layout turn');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='submitted'));await page.evaluate(()=>window.finish());await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));const binding=await completedBinding(page);
      assert.equal((await submit('Second layout turn',{requestId:'request-2',executionId:'execution-2',binding})).result?.accepted,true);await page.waitForFunction(()=>window.observed.filter(e=>e.kind==='submitted').length===2);
      await page.evaluate(()=>{document.querySelector('main').style.paddingBottom='23px';document.querySelector('main li').style.marginTop='2px';window.finish();});
      await page.waitForFunction(()=>window.observed.some(e=>e.kind==='unknown')||window.observed.filter(e=>e.kind==='completed').length===2);assert.equal(await page.evaluate(()=>window.observed.some(e=>e.kind==='unknown')),false);assert.equal(await page.evaluate(()=>window.clicks),2);
    });
    for(const target of ['user','assistant'])await test('mobile body edit and revert still invalidates the completed '+target+' proof',{mobile:true},async(page,submit)=>{
      await submit('Original native body');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));const binding=await completedBinding(page);
      await page.evaluate(target=>{const message=document.querySelector('li[data-message-role='+target+']'),body=target==='user'?message.querySelector('[data-submit-message-animation-target]').firstElementChild:message.querySelector('[aria-label="DIL content"]'),text=body.textContent;body.textContent='Changed by a person';body.textContent=text;},target);
      const result=await submit('Must refuse',{requestId:'request-2',executionId:'execution-2',binding});assert.equal(result.error?.code,'BROWSER_TRANSCRIPT_CHANGED');assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('bound terminal reader observes the original ended generation without touching a manual draft',{mobile:true,hold:true},async(page,submit)=>{
      assert.equal((await submit('Original read-only probe')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='submitted'));const binding=await page.evaluate(()=>window.observed.find(e=>e.kind==='submitted').data.binding);
      await page.locator('#mobile-composer-prompt').fill('Manual draft stays');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='unknown'));await page.evaluate(()=>window.finish());await page.waitForFunction(()=>document.querySelector('[data-composer-submit]').type==='submit');await page.addScriptTag({content:terminalReader});
      const proof=await page.evaluate(binding=>globalThis.AgentBridgeTerminalObservers['chatgpt-web']({sessionKey:binding.sessionKey,userAnchor:binding.userAnchor,text:'Original read-only probe'}),binding);assert.equal(proof.observed,true);assert.equal(proof.proof,'bound-terminal-v1');assert.equal(proof.assistantAnchor,'mobile-assistant-1');assert.equal(proof.stableForMs,1500);assert.equal(await page.locator('#mobile-composer-prompt').inputValue(),'Manual draft stays');assert.equal(await page.evaluate(()=>window.clicks),1);
      const missing=await page.evaluate(binding=>globalThis.AgentBridgeTerminalObservers['chatgpt-web']({sessionKey:binding.sessionKey,userAnchor:'another-user',text:'Original read-only probe'}),binding);assert.equal(missing.observed,false);assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('bound terminal reader does not infer end from complete while Stop remains',{mobile:true,hold:true,stopDelay:3000},async(page,submit)=>{
      assert.equal((await submit('Original terminal probe')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='submitted'));const binding=await page.evaluate(()=>window.observed.find(e=>e.kind==='submitted').data.binding);await page.evaluate(()=>window.finish());await page.addScriptTag({content:terminalReader});const proof=await page.evaluate(binding=>globalThis.AgentBridgeTerminalObservers['chatgpt-web']({sessionKey:binding.sessionKey,userAnchor:binding.userAnchor,text:'Original terminal probe'}),binding);assert.equal(proof.observed,false);assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('contenteditable preserves multiline indentation and literal markup with one send',{},async(page,submit)=>{
      const text='Header <img src=x onerror="window.executedPayload=true"> & symbol\n\n  two spaces  here\nEnd';const reply=await submit(text);assert.equal(reply.result?.accepted,true);
      await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));
      assert.deepEqual(await page.evaluate(()=>({clicks,images:document.images.length,ran:!!window.executedPayload,user:document.querySelector('[data-message-author-role="user"]').innerText})),{clicks:1,images:0,ran:false,user:text});
    });
    for(const textarea of [false,true])await test((textarea?'textarea':'contenteditable')+' retains manual-input invalidation after its own write',{textarea,hold:true},async(page,submit)=>{
      assert.equal((await submit('Observe this original turn')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='output.snapshot'));
      await page.locator('#prompt-textarea').fill('User draft must survive');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='unknown'&&e.data.text==='BROWSER_USER_INTERFERENCE'));
      await page.evaluate(()=>window.finish());await page.waitForTimeout(350);
      assert.equal(await page.evaluate(()=>window.clicks),1);assert.equal(await page.evaluate(()=>window.observed.some(e=>e.kind==='completed')),false);assert.equal(await page.locator('#prompt-textarea')[textarea?'inputValue':'innerText'](),'User draft must survive');
    });
    await test('synchronous site changes to the composer refuse the click',{tamper:true},async(page,submit)=>{assert.equal((await submit('Original requirement')).error?.code,'BROWSER_INPUT_CHANGED');assert.equal(await page.evaluate(()=>window.clicks),0);});
    await test('replaced composer control refuses the click',{replace:true},async(page,submit)=>{assert.equal((await submit('Original requirement')).error?.code,'BROWSER_INPUT_CHANGED');assert.equal(await page.evaluate(()=>window.clicks),0);});
    await test('a real preexisting human draft is preserved',{},async(page,submit)=>{await page.locator('#prompt-textarea').fill('User owns this draft');assert.equal((await submit('Do not overwrite')).error?.code,'BROWSER_DRAFT_PRESENT');assert.equal(await page.locator('#prompt-textarea').innerText(),'User owns this draft');assert.equal(await page.evaluate(()=>window.clicks),0);});
    for(const suffix of ['?temporary-chat=true','#unsupported-mode'])await test('URL suffix is refused before input: '+suffix,{},async(page,submit)=>{
      await page.evaluate(suffix=>history.replaceState(null,'','/'+suffix),suffix);
      assert.equal((await submit('Do not send in an unsupported page mode')).error?.code,'BROWSER_UNSUPPORTED_PAGE');
      assert.equal(await page.evaluate(()=>window.clicks),0);assert.equal(await page.locator('#prompt-textarea').innerText(),'');
    });
    await test('a mode change during input refuses the one click',{},async(page,submit)=>{
      await page.evaluate(()=>document.getElementById('prompt-textarea').addEventListener('input',()=>history.replaceState(null,'','/?temporary-chat=true')));
      assert.equal((await submit('Original requirement')).error?.code,'BROWSER_INPUT_CHANGED');assert.equal(await page.evaluate(()=>window.clicks),0);
    });
    await test('a mode change during output remains unknown even after completion',{hold:true},async(page,submit)=>{
      assert.equal((await submit('Observe the original page mode')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='output.snapshot'));
      await page.evaluate(()=>history.replaceState(null,'','/c/dom-fixture?temporary-chat=true'));await page.waitForFunction(()=>window.observed.some(e=>e.kind==='unknown'&&e.data.text==='BROWSER_SESSION_MISMATCH'));
      await page.evaluate(()=>window.finish());await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.observed.some(e=>e.kind==='completed')),false);assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('read-only inspection requires the original user anchor and never clicks again',{},async(page,submit)=>{
      assert.equal((await submit('Original requirement')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));
      const inspect=()=>page.evaluate(async()=>{const call=message=>new Promise(resolve=>window.listener({protocol:'agentbridge-content-v1',adapterId:'chatgpt-web',...message},{id:'test-extension'},resolve));const probe=await call({method:'probe'});return call({method:'inspect',pageEpoch:probe.result.pageEpoch,binding:{sessionKey:'chatgpt-dom-fixture',userAnchor:'user-1',...window.observed.find(e=>e.kind==='completed').data.continuation}});});
      assert.equal((await inspect()).result?.healthy,true);await page.evaluate(()=>document.querySelector('[data-message-author-role="user"]').remove());
      assert.equal((await inspect()).error?.code,'BROWSER_SESSION_MISMATCH');assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('an untracked newer manual turn invalidates the original resume binding',{},async(page,submit)=>{
      assert.equal((await submit('Original requirement')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));
      await page.evaluate(()=>{const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.dataset.messageId='manual-user';user.textContent='A separate manual turn';document.querySelector('main').append(user);});
      const result=await page.evaluate(async()=>{const call=message=>new Promise(resolve=>window.listener({protocol:'agentbridge-content-v1',adapterId:'chatgpt-web',...message},{id:'test-extension'},resolve));const probe=await call({method:'probe'});return call({method:'submit',pageEpoch:probe.result.pageEpoch,binding:{sessionKey:'chatgpt-dom-fixture'},params:{requestId:'request-2',executionId:'execution-2',documentId:'document-1',adapterId:'chatgpt-web',binding:{sessionKey:'chatgpt-dom-fixture',userAnchor:'user-1'},message:{type:'text',text:'Do not continue across a manual turn'}}});});
      assert.equal(result.error?.code,'BROWSER_SESSION_MISMATCH');assert.equal(await page.evaluate(()=>window.clicks),1);assert.equal(await page.locator('#prompt-textarea').innerText(),'');
    });
    await test('missing editor gives a login hint without account or submit side effects',{},async(page)=>{
      await page.locator('#prompt-textarea').evaluate(e=>e.remove());
      const result=await page.evaluate(()=>new Promise(resolve=>window.listener({protocol:'agentbridge-content-v1',adapterId:'chatgpt-web',method:'probe'},{id:'test-extension'},resolve)));
      assert.equal(result.result?.healthy,false);assert.equal(result.result?.code,'BROWSER_LOGIN_REQUIRED');assert.equal(await page.evaluate(()=>window.clicks),0);
    });
    await test('a new session refuses existing conversation history before writing',{},async(page,submit)=>{
      await page.evaluate(()=>{const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.dataset.messageId='old-user';user.textContent='Preexisting history';document.querySelector('main').append(user);});
      assert.equal((await submit('Do not adopt old history')).error?.code,'BROWSER_SESSION_MISMATCH');assert.equal(await page.evaluate(()=>window.clicks),0);assert.equal(await page.locator('#prompt-textarea').innerText(),'');
    });
    await test('deleted contenteditable text leaves only a bare BR and permits an explicit new message',{},async(page,submit)=>{
      const editor=page.locator('#prompt-textarea');await editor.fill('Human draft');await editor.fill('');
      assert.deepEqual(await editor.evaluate(e=>({html:e.innerHTML,text:e.innerText})),{html:'<br>',text:'\n'});
      assert.equal((await submit('An explicit new requirement')).result?.accepted,true);assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('authored whitespace remains a protected draft',{},async(page,submit)=>{
      const editor=page.locator('#prompt-textarea');await editor.fill('  ');
      assert.equal((await submit('Preserve spaces')).error?.code,'BROWSER_DRAFT_PRESENT');assert.equal(await editor.innerText(),'  ');
      assert.equal(await page.evaluate(()=>window.clicks),0);
    });
    await test('a real human newline remains a protected draft',{},async(page,submit)=>{
      const editor=page.locator('#prompt-textarea');await editor.fill('');await editor.press('Shift+Enter');const newline=await editor.evaluate(e=>({html:e.innerHTML,text:e.innerText}));
      assert.notEqual(newline.html,'<br>');assert.equal((await submit('Preserve newline')).error?.code,'BROWSER_DRAFT_PRESENT');
      assert.deepEqual(await editor.evaluate(e=>({html:e.innerHTML,text:e.innerText})),newline);assert.equal(await page.evaluate(()=>window.clicks),0);
    });
    await test('completed transcript proof matches independent SHA-256 and permits the original second turn',{},async(page,submit)=>{
      assert.equal((await submit('First')).result?.accepted,true);await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));
      const binding=await completedBinding(page),canonical=await page.evaluate(()=>JSON.stringify([...document.querySelectorAll('[data-message-author-role]')].map(e=>[e.dataset.messageAuthorRole,e.dataset.messageId,e.dataset.messageAuthorRole==='assistant'?(e.querySelector('.markdown')||e).innerText.trim():e.innerText])));
      assert.equal(binding.transcriptFingerprint,require('node:crypto').createHash('sha256').update(canonical).digest('hex'));
      assert.equal((await submit('Second',{requestId:'request-2',executionId:'execution-2',binding})).result?.accepted,true);
      await page.waitForFunction(()=>window.observed.filter(e=>e.kind==='completed').length===2);assert.equal(await page.evaluate(()=>window.clicks),2);
    });
    for(const kind of ['user-edit','assistant-regenerate','edit-revert','trusted-regenerate'])await test('completed original binding refuses '+kind,{},async(page,submit)=>{
      await submit('Original');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));const binding=await completedBinding(page);
      if(kind==='trusted-regenerate')await page.evaluate(()=>{const button=document.createElement('button');button.dataset.testid='regenerate-response-button';button.textContent='Regenerate';document.body.append(button);});
      if(kind==='trusted-regenerate')await page.locator('[data-testid="regenerate-response-button"]').click();
      else await page.evaluate(kind=>{const element=document.querySelector(kind==='assistant-regenerate'?'[data-message-author-role="assistant"]':'[data-message-author-role="user"]'),old=element.textContent;element.textContent='Manual replacement';if(kind==='edit-revert')element.textContent=old;},kind);
      const result=await submit('Never cross manual history',{requestId:'request-2',executionId:'execution-2',binding});
      assert.equal(result.error?.code,'BROWSER_TRANSCRIPT_CHANGED');assert.equal(await page.evaluate(()=>window.clicks),1);assert.equal(await page.locator('#prompt-textarea').innerText(),'');
    });
    await test('history changing while SHA-256 is pending refuses before writing',{},async(page,submit)=>{
      await submit('Original');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));const binding=await completedBinding(page);
      await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(...args)=>{window.hashEntered=true;await new Promise(resolve=>window.releaseHash=resolve);return original(...args);};});
      const sending=submit('Never write after a stale digest',{requestId:'request-2',executionId:'execution-2',binding});await page.waitForFunction(()=>window.hashEntered);
      await page.evaluate(()=>{document.querySelector('[data-message-author-role="user"]').textContent='Changed during hash';window.releaseHash();});
      assert.equal((await sending).error?.code,'BROWSER_TRANSCRIPT_CHANGED');assert.equal(await page.evaluate(()=>window.clicks),1);assert.equal(await page.locator('#prompt-textarea').innerText(),'');
    });
    await test('synchronous old-history edit and revert during composer write refuses the click',{},async(page,submit)=>{
      await submit('Original');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='completed'));const binding=await completedBinding(page);
      await page.evaluate(()=>document.getElementById('prompt-textarea').addEventListener('input',()=>{const user=document.querySelector('[data-message-author-role="user"]'),old=user.textContent;user.textContent='Transient manual edit';user.textContent=old;}));
      assert.equal((await submit('Second',{requestId:'request-2',executionId:'execution-2',binding})).error?.code,'BROWSER_INPUT_CHANGED');assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('same-anchor current user edit and revert during generation stays unknown',{hold:true},async(page,submit)=>{
      await submit('Original running requirement');await page.waitForFunction(()=>window.observed.some(e=>e.kind==='output.snapshot'));
      await page.evaluate(()=>{const user=document.querySelector('[data-message-author-role="user"]'),old=user.textContent;user.textContent='Transient edit';user.textContent=old;});
      await page.waitForFunction(()=>window.observed.some(e=>e.kind==='unknown'&&e.data.text==='BROWSER_USER_INTERFERENCE'));await page.evaluate(()=>window.finish());
      await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.observed.some(e=>e.kind==='completed')),false);assert.equal(await page.evaluate(()=>window.clicks),1);
    });
    await test('a new user turn inserted synchronously during input refuses the click',{},async(page,submit)=>{
      await page.evaluate(()=>document.getElementById('prompt-textarea').addEventListener('input',()=>{if(document.querySelector('[data-message-id="concurrent-user"]'))return;const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.dataset.messageId='concurrent-user';user.textContent='A concurrent turn';document.querySelector('main').append(user);}));
      assert.equal((await submit('Keep this request separate')).error?.code,'BROWSER_INPUT_CHANGED');assert.equal(await page.evaluate(()=>window.clicks),0);
    });
    for(const limit of ['bytes','anchors'])await test('bounded visible history rejects '+limit+' overflow before writing',{},async(page,submit)=>{
      await page.evaluate(limit=>{const root=document.querySelector('main'),fragment=document.createDocumentFragment();for(let i=0;i<(limit==='anchors'?8193:1);i++){const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.dataset.messageId='history-'+i;user.textContent=limit==='bytes'?'x'.repeat(1048577):'x';fragment.append(user);}root.append(fragment);},limit);
      assert.equal((await submit('No write after a history limit')).error?.code,'BROWSER_TRANSCRIPT_LIMIT');assert.equal(await page.evaluate(()=>window.clicks),0);assert.equal(await page.locator('#prompt-textarea').innerText(),'');
    });
  }finally{
    await browser.close();report.passed=report.tests.filter(t=>t.ok).length;report.failed=report.tests.length-report.passed;
    const out=path.resolve(__dirname,'../../artifacts/browser-agent',evidenceDay,reportName);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  }
  console.log(JSON.stringify({passed:report.passed,failed:report.failed,browser:report.browser}));if(report.failed)process.exitCode=1;
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
