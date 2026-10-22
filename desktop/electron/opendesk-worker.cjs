'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn,execFile} = require('node:child_process');
const {randomUUID,randomBytes} = require('node:crypto');
const {atomicWrite:write} = require('./graph-layout.cjs');
const connection = require('./opendesk-connection.cjs');
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
const read = (file,fallback) => {try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}};
const emit = (directory,event) => fs.appendFileSync(path.join(directory,'events.jsonl'),JSON.stringify(event)+'\n',{mode:0o600});
const unknown = directory => emit(directory,{kind:'unknown',text:'OpenDesk 原执行缺少可确认的终态，保留原请求与占用；不会自动重发。'});
const text = value => (value?.parts || value?.message?.content || []).filter(p=>p.type==='text').map(p=>p.text||'').join('\n');
const valid = value => typeof value==='string' && /^[\w-]{1,256}$/.test(value);
function beat(directory){write(path.join(directory,'heartbeat.json'),{time:new Date().toISOString(),pid:process.pid});}
function matches(job,binding){return binding?.requestId===job.requestId&&binding.workspace===job.workspace&&(!job.sessionId||job.sessionId===binding.sessionId)&&(!job.instanceId||job.instanceId===binding.instanceId);}
function responseOutcome(binding,response,messages) {
  if(!Array.isArray(messages))return null;
  const fresh=messages.filter(m=>!binding.baseline.includes(m.info?.id));
  const users=fresh.filter(m=>m.info?.role==='user');
  if(users.length!==1||text(users[0]).trim()!==binding.message.trim())return null;
  const info=response?.info;
  if(info?.role!=='assistant'||info.sessionID!==binding.sessionId||info.parentID!==users[0].info.id||binding.baseline.includes(info.id)||!valid(info.id)||!Number.isFinite(info.time?.completed))return null;
  const answer=text(response);
  // The compatibility API flattens native errors into text and manufactures
  // completion timestamps on reads. Neither is terminal proof after a disconnect.
  if(!answer.trim()||response.info.error||response.parts?.some(p=>p.type==='text'&&/^Error:/.test(p.text||'')))return null;
  return {answer,messageId:info.id};
}
async function startCli(job,root) {
  const file=path.join(root,'service.json'),saved=read(file,null);
  if(saved&&saved.executable===fs.realpathSync(job.executable)){
    try{process.kill(saved.pid,0);const c=await connection.httpClient(saved,job.workspace);return {...saved,c};}catch{}
  }
  if(job.sessionId)throw Error('原 CLI 服务不可达，不能新建服务替代原会话。');
  const command=require('./tool-discovery.cjs').command;
  const probe=command(job.executable,['serve','--help']);
  const help=await new Promise((resolve,reject)=>execFile(probe.executable,probe.args,{env:probe.env,windowsHide:true,timeout:15000,maxBuffer:65536},(e,out)=>e?reject(e):resolve(out)));
  if(!help.includes('--mode')||!help.includes('--hostname'))throw Error('当前 OpenDesk CLI 未提供所需 serve 接口。');
  const password=randomBytes(32).toString('base64url'),log=path.join(root,'native-service.log');
  const launch=command(job.executable,['serve','--mode','opencode','--hostname','127.0.0.1','--port','0'],{...process.env,OPENCODE_SERVER_PASSWORD:password,OPENCODE_SERVER_USERNAME:'opencode'});
  const fd=fs.openSync(log,'w',0o600);let child,error;
  try{child=spawn(launch.executable,launch.args,{cwd:job.workspace,env:launch.env,windowsHide:true,detached:true,stdio:['ignore',fd,fd]});child.once('error',e=>{error=e;});child.unref();}finally{fs.closeSync(fd);}
  const deadline=Date.now()+90000;
  try{
    while(Date.now()<deadline&&!error&&child.exitCode===null&&!child.signalCode){
      const output=fs.readFileSync(log,'utf8').slice(-65536),match=output.match(/(?:http:\/\/127\.0\.0\.1:)(\d+)/);
      if(match){
        const service={origin:'http://127.0.0.1:'+match[1],password,pid:child.pid,ownerPid:process.pid,instanceId:randomUUID(),executable:fs.realpathSync(job.executable)};
        const c=await connection.httpClient(service,job.workspace);write(file,service);return {...service,c};
      }
      await delay(200);
    }
    throw Error('OpenDesk CLI 服务未就绪，需求未发送。');
  }catch(e){try{child.kill('SIGTERM');}catch{}throw e;}
}
async function cliTurn(directory,job,service) {
  const c=await connection.httpClient(service,job.workspace);
  if(job.instanceId&&job.instanceId!==service.instanceId)throw Error('原 CLI 服务身份已变化。');
  let sessionId=job.sessionId;
  if(!sessionId){const session=await c.request('/session',{title:'AgentBridge'});sessionId=session?.id;}
  if(!valid(sessionId))throw Error('OpenDesk 未返回有效原生会话。');
  const route='/session/'+encodeURIComponent(sessionId),info=await c.request(route);
  if(info?.id!==sessionId||fs.realpathSync(info.directory)!==job.workspace)throw Error('原会话目录绑定不匹配。');
  const baseline=await c.request(route+'/message');
  if(!Array.isArray(baseline)||baseline.some(m=>!valid(m.info?.id)))throw Error('OpenDesk 原会话消息边界不可用。');
  const binding={protocol:job.profile,sessionId,instanceId:service.instanceId,workspace:job.workspace,requestId:job.requestId,message:job.message,baseline:baseline.map(m=>m.info.id)};
  write(path.join(directory,'binding.json'),binding);emit(directory,{kind:'native',sessionId,instanceId:service.instanceId});
  if(fs.existsSync(path.join(directory,'cancel.json'))){emit(directory,{kind:'terminal',status:'cancelled',nativeExited:false,text:'需求发送前已取消。'});return;}
  write(path.join(directory,'attempted.json'),{requestId:job.requestId});
  let response,error,done=false;
  const pending=c.request(route+'/message',{parts:[{type:'text',text:job.message}]},{timeout:6*60*60*1000}).then(value=>{response=value;write(path.join(directory,'native-response.json'),{response:value,instanceId:service.instanceId,requestId:job.requestId});}).catch(e=>{error=e;}).finally(()=>{done=true;});
  emit(directory,{kind:'started'});
  let output='',cancelled=false;
  while(!done){
    const messages=await c.request(route+'/message');
    const fresh=messages.filter(m=>!binding.baseline.includes(m.info?.id)),user=fresh.filter(m=>m.info?.role==='user');
    if(user.length===1&&text(user[0]).trim()===job.message.trim()){
      const answer=fresh.filter(m=>m.info?.parentID===user[0].info.id&&m.info?.role==='assistant').map(text).join('\n');
      if(answer!==output){output=answer;emit(directory,{kind:'output',text:answer});}
      if(fs.existsSync(path.join(directory,'cancel.json'))&&!fs.existsSync(path.join(directory,'cancel-attempted.json'))){
        const operation=read(path.join(directory,'cancel.json'));
        write(path.join(directory,'cancel-attempted.json'),{requestId:job.requestId,operationId:operation.operationId});cancelled=true;
        await c.request(route+'/abort',{});
      }
    }
    await delay(200);
  }
  await pending;
  if(error)throw error;
  const result=responseOutcome(binding,response,await c.request(route+'/message'));
  if(!result||cancelled){unknown(directory);return;}
  emit(directory,{kind:'native',sessionId,instanceId:service.instanceId,messageId:result.messageId});
  emit(directory,{kind:'terminal',status:'succeeded',text:result.answer});
}
async function desktopTurn(directory,job,c,config) {
  const current=connection.desktopConfig(job.executable);
  if(current.origin!==config.origin||current.deviceId!==config.deviceId||fs.realpathSync(current.workspace)!==job.workspace)throw Error('桌面网关沿用原生工作目录，请在原生设置核对目录。');
  if(job.instanceId&&job.instanceId!==c.connectionId)throw Error('原桌面连接已断开，不能创建新会话替代续聊。');
  const sessionId=job.sessionId||job.conversationId;
  if(!valid(sessionId))throw Error('桌面会话身份无效。');
  const binding={protocol:job.profile,sessionId,instanceId:c.connectionId,workspace:job.workspace,requestId:job.requestId};
  write(path.join(directory,'binding.json'),binding);emit(directory,{kind:'native',sessionId,instanceId:c.connectionId});
  if(fs.existsSync(path.join(directory,'cancel.json'))){emit(directory,{kind:'terminal',status:'cancelled',nativeExited:false,text:'需求发送前已取消。'});return;}
  let done=false,final,failed=false,cancelled=false,disconnected=false,lastSeq=0;
  const off=c.onEvent(frame=>{
    const p=frame.payload;
    if(frame.event!=='chat'||p?.sessionKey!==sessionId||p.runId!==job.requestId)return;
    // Handler error frames may restart seq at 1. Preserve failure evidence.
    if(p.state==='error')failed=true;
    if(!Number.isSafeInteger(p.seq)||p.seq<=lastSeq&&p.state!=='error')return;
    lastSeq=Math.max(lastSeq,p.seq);
    if(p.message?.role==='assistant')emit(directory,{kind:'output',text:text(p)});
    if(p.state==='final'&&(Number.isFinite(p.message?.timestamp)||p.message===undefined)){final=p;done=true;}
    if(p.state==='error'){final=p;done=true;}
  });
  const offClose=c.onClose(()=>{disconnected=true;done=true;});
  try{
    write(path.join(directory,'attempted.json'),{requestId:job.requestId});
    const ack=await c.request('chat.send',{sessionKey:sessionId,idempotencyKey:job.requestId,message:job.message});
    if(ack?.runId!==job.requestId||ack.status!=='started')throw Error('桌面网关返回了其他请求。');
    emit(directory,{kind:'started'});
    while(!done){
      if(fs.existsSync(path.join(directory,'cancel.json'))&&!fs.existsSync(path.join(directory,'cancel-attempted.json'))){
        const operation=read(path.join(directory,'cancel.json'));
        write(path.join(directory,'cancel-attempted.json'),{requestId:job.requestId,operationId:operation.operationId});cancelled=true;
        await c.request('chat.abort',{sessionKey:sessionId});
      }
      await delay(100);
    }
    if(disconnected||cancelled||final?.state==='error'||!failed&&!text(final).trim()){unknown(directory);return;}
    write(path.join(directory,'native-response.json'),{requestId:job.requestId,instanceId:c.connectionId,frame:final});
    emit(directory,{kind:'terminal',status:failed?'failed':'succeeded',text:failed?'OpenDesk 桌面原轮次返回错误，请在原生端核对。':text(final),code:'OPENDESK_NATIVE'});
  }finally{off();offClose();}
}
async function observe(directory,job) {
  const binding=read(path.join(directory,'binding.json')),saved=read(path.join(directory,'native-response.json'));
  if(!matches(job,binding)||saved?.requestId!==job.requestId||saved.instanceId!==binding.instanceId||fs.existsSync(path.join(directory,'cancel-attempted.json'))){unknown(directory);return;}
  if(job.adapter==='opendesk'){
    const service=read(path.join(job.controlRoot,'service.json'));
    if(service?.instanceId!==binding.instanceId){unknown(directory);return;}
    const c=await connection.httpClient(service,job.workspace),result=responseOutcome(binding,saved.response,await c.request('/session/'+encodeURIComponent(binding.sessionId)+'/message'));
    if(result){emit(directory,{kind:'terminal',status:'succeeded',text:result.answer});return;}
  }else if(saved.frame?.runId===job.requestId&&saved.frame.sessionKey===binding.sessionId&&saved.frame.state==='final'&&Number.isFinite(saved.frame.message?.timestamp)){
    emit(directory,{kind:'terminal',status:'succeeded',text:text(saved.frame)});return;
  }
  unknown(directory);
}
async function run(directory,{observe:readOnly=false}={}) {
  const job=read(path.join(directory,'job.json'));
  if(readOnly){try{await observe(directory,job);}catch{unknown(directory);}return;}
  if(!job.controlRoot||job.profile!== (job.adapter==='opendesk'?'opendesk-http-v2':'opendesk-gateway-v2')){unknown(directory);return;}
  const root=job.controlRoot;fs.mkdirSync(root,{recursive:true,mode:0o700});
  const queue=()=>write(path.join(root,'queue-'+path.basename(directory)+'.json'),{directory});
  let existing=connection.controller(root);
  if(existing){if(existing.executable!==job.executable){unknown(directory);return;}queue();return;}
  const lock=path.join(root,'owner.lock');
  try{fs.writeFileSync(lock,JSON.stringify({pid:process.pid}),{flag:'wx',mode:0o600});}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    const owner=read(lock,null);let live=false;try{process.kill(owner.pid,0);live=true;}catch{}
    if(!live){fs.unlinkSync(lock);return run(directory);}
    for(let i=0;i<60&&!existing;i++){await delay(100);existing=connection.controller(root);}
    if(existing?.executable===job.executable){queue();return;}
    unknown(directory);return;
  }
  let service,c,current,stopping=false,lastWork=Date.now();
  const state={protocol:'opendesk-existing-v1',pid:process.pid,executable:job.executable};
  const heartbeat=()=>{state.time=new Date().toISOString();write(path.join(root,'controller.json'),state);if(current)beat(current);};
  heartbeat();const timer=setInterval(heartbeat,1000);
  const stop=()=>{stopping=true;c?.close();if(service?.ownerPid===process.pid)try{process.kill(service.pid,'SIGTERM');}catch{}};process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try{
    queue();
    while(!stopping){
      const items=fs.readdirSync(root).filter(n=>/^queue-[\w-]+\.json$/.test(n));
      for(const name of items){
        const command=read(path.join(root,name));fs.unlinkSync(path.join(root,name));
        const target=path.resolve(command.directory),runs=path.resolve(root,'../runs');
        if(path.dirname(target)!==runs)continue;
        const next=read(path.join(target,'job.json'));
        if(next.controlRoot!==root||next.adapter!==job.adapter||next.executable!==job.executable)continue;
        try{fs.writeFileSync(path.join(target,'claimed.json'),JSON.stringify({pid:process.pid}),{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')continue;throw e;}
        current=target;beat(target);lastWork=Date.now();
        try{
          if(job.adapter==='opendesk'){
            service=await startCli(next,root);state.instanceId=service.instanceId;state.connected=true;heartbeat();await cliTurn(target,next,service);
          }else{
            const config=connection.desktopConfig(next.executable);
            if(c?.dead&&!next.sessionId){c.close();c=null;}
            if(!c){if(next.sessionId)throw Error('原桌面连接已丢失。');c=await connection.desktopClient(config);state.instanceId=c.connectionId;}
            state.connected=!c.dead;heartbeat();if(c.dead)throw Error('原桌面连接已断开。');await desktopTurn(target,next,c,config);
          }
        }catch(error){
          if(fs.existsSync(path.join(target,'attempted.json')))unknown(target);
          else emit(target,{kind:'terminal',status:'failed',nativeExited:false,code:'OPENDESK_PREPARATION',text:'OpenDesk 准备失败，需求未发送。请核对原服务、会话和工作目录。'});
        }finally{current=null;lastWork=Date.now();}
      }
      state.connected=job.adapter==='opendesk'||!!c&&!c.dead;
      if(!current&&Date.now()-lastWork>30*60*1000)break;
      await delay(150);
    }
  }finally{
    clearInterval(timer);c?.close();state.connected=false;state.time=new Date(0).toISOString();write(path.join(root,'controller.json'),state);
    // Only the Bridge-owned CLI service is stopped; never stop the Desktop.
    if(service?.pid&&service.ownerPid===process.pid)try{process.kill(service.pid,'SIGTERM');}catch{}
    try{if(read(lock,null)?.pid===process.pid)fs.unlinkSync(lock);}catch{}
  }
}
module.exports={run,responseOutcome,startCli};
