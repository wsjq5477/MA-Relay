const $=id=>document.getElementById(id);
let status,busy=false;
const codeErrors={BROWSER_CONFIGURATION_FAILED:'连接未确认。请检查本机后台及原配对包，再重新检查；不要另建配对覆盖原记录。'};
function notice(text,error=false){$('notice').textContent=text;$('notice').dataset.error=String(error);}
async function control(method,extra={}){
  const reply=await chrome.runtime.sendMessage({protocol:'agentbridge-options-v1',method,...extra});
  if(reply?.error)throw Object.assign(Error(codeErrors[reply.error.code]||'操作未确认，请重新检查原连接。'),{code:reply.error.code});
  if(!reply?.result)throw Error('扩展后台没有返回状态，请重新打开此设置页。');
  return reply.result;
}
function render(){
  $('extension-id').textContent=status.extensionId;
  $('connection').textContent=!status.paired?'尚未配对':!status.enabled?'已暂停':status.online?'已连接本机后台':!status.credentialSaved?'原配对尚未确认':'未连接，保留原配对';
  $('binding-row').hidden=!status.paired;$('binding').textContent=status.browserInstanceId||'';
  $('pair-section').hidden=status.paired&&status.credentialSaved;
  $('pair-heading').textContent=status.paired?'修正原配对包':'配对这台机器';
  $('pair-help').textContent=status.paired?'请重新粘贴同一原配对包，不会更换原浏览器身份。':'配对包两分钟内有效。请使用原配对包查询或重连。';
  $('pause').hidden=!status.paired;$('pause').textContent=status.enabled?'暂停接入':'恢复原连接';
  $('site-state').textContent=status.chatgptEnabled?'已获得网页访问授权；登录和实际回复需在网页核对。':'尚未授权网页访问。';
  $('site-permission').textContent=status.chatgptEnabled?'移除网页授权':'授权 ChatGPT 网页';
  $('unresolved').hidden=!status.unresolved;$('unresolved').textContent=`保留 ${status.unresolved} 项尚未明确结束的请求，请查询原任务。`;
}
async function refresh(){status=await control('status');render();}
async function run(action){
  if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await action();await refresh();}
  catch(error){notice(error.code?error.message:'操作未完成，请重新检查本机连接。',true);await refresh().catch(()=>{});}
  finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
$('refresh').addEventListener('click',()=>run(async()=>{await control('reconnect');notice('已重新检查原连接。');}));
$('copy-id').addEventListener('click',()=>run(async()=>{await navigator.clipboard.writeText(chrome.runtime.id);notice('扩展 ID 已复制。');}));
$('pair-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  let config;try{config=JSON.parse($('pair-code').value);}catch{notice('配对包格式不完整，请从 AgentBridge 复制完整内容。',true);return;}
  const result=await control('configure',{config});$('pair-code').value='';notice(result.online?'已连接。请完成网页授权，然后回到 AgentBridge 扫描并接入节点。':'原配对已保存，连接尚未确认；请重新检查。',!result.online);
});});
$('pause').addEventListener('click',()=>run(async()=>{const method=status.enabled?'pause':'resume';await control(method);notice(method==='pause'?'已暂停接入。原任务和配对身份保留，请查询未确认结果。':'已尝试恢复原连接。');}));
$('site-permission').addEventListener('click',()=>{
  // Call the browser permission API in the actual user gesture, before awaits.
  if(busy||!status)return;
  const permission={origins:['https://chatgpt.com/*']};
  const result=status.chatgptEnabled?chrome.permissions.remove(permission):chrome.permissions.request(permission);
  void run(async()=>{const granted=await result;notice(granted?'网页授权已更新。':'网页授权未变更。');});
});
void run(async()=>{await refresh();notice(status.paired?'已读取原配对状态。':'请先将扩展 ID 复制到 AgentBridge。');});
