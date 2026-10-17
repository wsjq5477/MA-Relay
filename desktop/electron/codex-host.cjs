const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,execFile}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto');
const worker=process.argv[2]==='--codex-worker';
const terminal=new Set(['succeeded','failed','cancelled']);
const fail=(code,message)=>Object.assign(new Error(message),{code});
const now=()=>new Date().toISOString(),clone=x=>JSON.parse(JSON.stringify(x));
// Applied only to native turns with a scoped Bridge MCP connection. Keep the
// original message/receipt unchanged and inherit the user's native CLI policies.
const collaborationInstructions='[AgentBridge 协作上下文]\n你是用户选定的 AgentBridge 主 Agent。用户所说的连接子 Agent 是用户在 AgentBridge 中允许连接的工具节点，可以位于其他机器。询问连接关系或需要协作时，必须先调用 agentbridge MCP 服务器的 list_agents（通常显示为 mcp__agentbridge__list_agents，按客户端实际命名调用）。Codex 原生 collaboration.list_agents / list_agents 只列出本次 CLI 内部的临时协作 Agent；它返回只有 /root 不能证明 AgentBridge 没有连接子节点。若 Bridge MCP 工具缺失或调用失败，报告协作通道故障，不能把故障解释为子节点列表为空，也不能通过终端绕过协作接口。通过同一 agentbridge 服务器的 delegate 向允许的子节点发任务，task_result 查询或等待真实结果，最后在当前会话汇总。每项委派使用稳定 requestId，回应未知时查询原请求或原任务，不换 ID 重复提交。子节点不能扩大连接关系。用户要求子节点报告模型时，实际委派询问并核对返回结果；无法确认的模型标明未知，不猜测。\n[/AgentBridge 协作上下文]\n\n';
function safe(value){let s=String(value||'').replace(/\x1b\[[0-9;]*[A-Za-z]/g,'');for(const [key,v]of Object.entries(process.env))if(/TOKEN|SECRET|PASSWORD|API_KEY/.test(key)&&v?.length>6)s=s.split(v).join('[已隐藏]');return s.slice(0,200000);}
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw fail('CODEX_STATE','Codex 记录无法读取，请保留原目录。');}}
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(tmp,file);}
class CodexHost{
  constructor(options){this.directory=options.directory;this.executable=options.executable;this.file=path.join(this.directory,'codex-state.json');this.state=read(this.file,{revision:1,agents:[],tasks:[],conversations:[],requests:[],operations:[]});this.chain=Promise.resolve();this.timer=setInterval(()=>{this.chain=this.chain.then(()=>this.sync()).catch(()=>{});},250);this.timer.unref();}
  save(){write(this.file,this.state);}
  event(task,kind,data={}){task.updatedAt=now();task.lastSeq++;task.events.push({seq:task.lastSeq,timestamp:task.updatedAt,event:{kind,...data}});}
  sync(){let changed=false;for(const task of this.state.tasks.filter(t=>!terminal.has(t.status))){
    const job=path.join(this.directory,'runs',task.taskId),file=path.join(job,'events.jsonl');
    let text='';try{text=fs.readFileSync(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    const lines=text.slice(0,text.lastIndexOf('\n')+1).split('\n').filter(Boolean);
    for(const line of lines.slice(task.offset||0)){const e=JSON.parse(line);task.offset=(task.offset||0)+1;changed=true;
      if(e.kind==='started'){task.status='running';task.lastSummary='Codex 正在执行';this.event(task,'started');}
      if(e.kind==='native'){task.native={sessionId:e.sessionId,messageId:task.requestId};this.state.conversations.find(c=>c.conversationId===task.conversationId).sessionId=e.sessionId;this.event(task,'native');}
      if(e.kind==='output'){task.lastSummary=e.text;this.event(task,'output',{text:e.text});}
      if(e.kind==='progress')this.event(task,'progress',{text:e.text});
      if(e.kind==='terminal'){task.status=e.status;task.lastSummary=e.text;task.finishedAt=now();if(e.status==='succeeded')task.result={message:e.text};if(e.status==='failed')task.error={code:e.code||'CODEX_FAILED',message:e.text};this.event(task,e.status==='succeeded'?'completed':e.status==='failed'?'failed':'cancelled',{text:e.text,...(task.error?{error:task.error}:{})});
        for(const r of this.state.operations.filter(r=>r.taskId===task.taskId&&r.state==='unknown')){r.state='confirmed';r.data={status:task.status,nativeExited:true};}
      }
    }
    if(!terminal.has(task.status)){const heartbeat=read(path.join(job,'heartbeat.json'),null);if(Date.now()-Date.parse(heartbeat?.time||task.createdAt)>15000&&task.status!=='unknown'){task.status='unknown';task.lastSummary='原执行状态待核对，不会自动重新提交。';changed=true;}}
  }if(changed)this.save();}
  publicTask(task){const result=clone(task);delete result.offset;return result;}
  failLaunch(task,error){
    if(terminal.has(task.status))return this.publicTask(task);
    task.status='failed';task.finishedAt=now();
    task.error={code:error.code||'CODEX_START',message:safe('Codex 后台运行资源准备失败，原生任务未执行：'+(error.message||'后台未启动。'))};
    task.lastSummary=task.error.message;this.event(task,'failed',{error:task.error});this.save();
    return this.publicTask(task);
  }
  call(method,params={}){const job=this.chain.then(()=>this.handle(method,params));this.chain=job.catch(()=>{});return job;}
  async handle(method,params){this.sync();
    if(method==='connect'){
      if(params.model)throw fail('INVALID_INPUT','Codex 沿用原生配置。');
      const workspace=fs.realpathSync(params.workspace);if(!fs.statSync(workspace).isDirectory())throw fail('WORKSPACE_UNAVAILABLE','执行目录不可用。');
      const old=this.state.agents.find(a=>a.workspace===workspace);if(old)return {agentId:old.agentId};
      const a={agentId:'codex-'+randomUUID(),adapter:'codex',executable:this.executable,name:'Codex',workspace,enabled:true};this.state.agents.push(a);this.save();return {agentId:a.agentId};
    }
    if(method==='snapshot'){
      const items=this.state.agents.map(a=>{const active=this.state.tasks.find(t=>t.targetAgent===a.agentId&&!terminal.has(t.status));return {...a,online:true,healthy:true,busy:!!active,available:!active,default:false,nativeAgent:'codex',capabilities:{resume:true,cancellation:true,permissions:false,forms:false,verification:false},...(active?{currentTask:{taskId:active.taskId,status:active.status,summary:active.lastSummary}}:{})};});
      return {agents:{items,revision:this.state.revision,connected:true},tasks:this.state.tasks.map(t=>this.publicTask(t)),conversations:this.state.conversations.map(c=>{const r=clone(c);delete r.sessionId;return {...r,canContinue:!!c.sessionId,kind:'task'};})};
    }
    if(method!=='ipc')throw fail('DESKTOP_METHOD','不支持这个 Codex 操作。');
    const task=this.state.tasks.find(t=>t.taskId===params.taskId);
    if(params.op==='request'){const r=this.state.requests.find(r=>r.requestId===params.requestId);if(!r)throw fail('NOT_FOUND','原请求不存在。');return this.publicTask(this.state.tasks.find(t=>t.taskId===r.taskId));}
    if(params.op==='task'){if(!task)throw fail('TASK_NOT_FOUND','任务不存在。');return this.publicTask(task);}
    if(params.op==='conversation'){const c=this.state.conversations.find(c=>c.conversationId===params.conversationId);if(!c)throw fail('NOT_FOUND','会话不存在。');const r=clone(c);delete r.sessionId;return {...r,kind:'task',canContinue:!!c.sessionId,items:this.state.tasks.filter(t=>t.conversationId===c.conversationId).map(t=>this.publicTask(t))};}
    if(params.op==='operation'){const r=this.state.operations.find(r=>r.operationId===params.operationId);if(!r)throw fail('NOT_FOUND','操作不存在。');return clone(r);}
    if(params.op==='pending')return {permissions:[],forms:[]};
    if(params.op==='cancel'){
      if(!task)throw fail('TASK_NOT_FOUND','任务不存在。');if(!params.operationId)throw fail('INVALID_INPUT','取消需要操作 ID。');
      const existing=this.state.operations.find(r=>r.operationId===params.operationId);if(existing){if(existing.taskId!==task.taskId)throw fail('REQUEST_CONFLICT','操作 ID 已用于其他任务。');return clone(existing);}
      const receipt={operationId:params.operationId,taskId:task.taskId,state:terminal.has(task.status)?'confirmed':'unknown'};this.state.operations.push(receipt);this.save();if(receipt.state==='unknown')write(path.join(this.directory,'runs',task.taskId,'cancel.json'),{operationId:params.operationId});return clone(receipt);
    }
    if(params.op==='reconcile'){
      if(!task)throw fail('TASK_NOT_FOUND','任务不存在。');
      let reason='原后台缺少可确认的终态事件，保留原请求与占用；请在原生 Codex 记录中核对。';
      if(terminal.has(task.status))reason='已读取 Codex 原执行终态，未重新提交。';
      else{
        const job=path.join(this.directory,'runs',task.taskId),file=path.join(job,'job.json');
        // worker.log is created BEFORE spawn. Its absence is essential: a
        // spawned/paused worker may not yet have written a heartbeat or events.
        const untouched=['accepted','unknown'].includes(task.status)&&!task.native&&!task.offset
          &&task.lastSeq===1&&task.events?.length===1&&task.events[0].event?.kind==='accepted';
        const fenced=['worker.log','heartbeat.json','events.jsonl'].some(name=>fs.existsSync(path.join(job,name)));
        if(untouched&&!fenced&&fs.existsSync(file)&&fs.lstatSync(file).isFile()){
          const original=read(file,null);
          if(original&&typeof original.executable==='string'&&original.executable&&typeof original.workspace==='string'&&original.workspace){
            this.failLaunch(task,{code:'CODEX_START',message:'原请求没有派发到原生 Codex。'});
            reason='原请求没有派发到原生 Codex，已结束原任务并释放占用；可以新建会话。';
          }
        }
      }
      task.reconciliation={time:now(),state:task.status,reason};this.save();
      return {operationId:params.operationId||randomUUID(),state:terminal.has(task.status)?'confirmed':'unknown',data:{status:task.status,message:reason}};
    }
    if(!['submit','continue'].includes(params.op))throw fail('ADAPTER_UNSUPPORTED','Codex 当前不支持此交互操作。');
    if(!params.requestId||!params.message?.trim()||params.message.length>65536)throw fail('INVALID_INPUT','请提供请求 ID 和需求。');
    const c=params.op==='continue'?this.state.conversations.find(c=>c.conversationId===params.conversationId):null;
    if(params.op==='continue'&&!c?.sessionId)throw fail('CONVERSATION_UNBOUND','原生会话尚未建立，请新建会话。');
    const a=this.state.agents.find(a=>a.agentId===(c?.targetAgent||params.agentId));if(!a)throw fail('AGENT_NOT_FOUND','节点执行上下文不存在。');
    const fingerprint=createHash('sha256').update(JSON.stringify({agentId:a.agentId,conversationId:c?.conversationId,message:params.message})).digest('hex');
    const old=this.state.requests.find(r=>r.requestId===params.requestId);if(old){if(old.fingerprint!==fingerprint)throw fail('REQUEST_CONFLICT','请求内容冲突。');return this.publicTask(this.state.tasks.find(t=>t.taskId===old.taskId));}
    if(this.state.tasks.some(t=>!terminal.has(t.status)))throw fail('AGENT_BUSY','Codex 此上下文仍有未结束任务。');
    const fresh={taskId:'codex-task-'+randomUUID(),executionId:randomUUID(),conversationId:c?.conversationId||'codex-conversation-'+randomUUID(),targetAgent:a.agentId,requestId:params.requestId,message:safe(params.message),status:'accepted',createdAt:now(),updatedAt:now(),turn:(c?.turns||0)+1,lastSeq:0,lastSummary:'已接收，正在启动 Codex',events:[],offset:0};
    const job=path.join(this.directory,'runs',fresh.taskId);write(path.join(job,'job.json'),{executable:this.executable,workspace:a.workspace,message:params.message,sessionId:c?.sessionId,mcp:params.mcp});
    this.state.tasks.push(fresh);this.state.requests.push({requestId:params.requestId,fingerprint,taskId:fresh.taskId});
    if(c){c.turns++;c.lastTaskId=fresh.taskId;c.updatedAt=now();}else this.state.conversations.push({conversationId:fresh.conversationId,targetAgent:a.agentId,title:safe(params.message).slice(0,100),turns:1,lastTaskId:fresh.taskId,updatedAt:now()});
    this.event(fresh,'accepted');this.save();
    let child,fd;
    try{
      const runtime=require('./worker-runtime.cjs').workerRuntime(this.directory),workerFile=path.join(this.directory,'runtime','codex-worker.cjs');
      fs.mkdirSync(path.dirname(workerFile),{recursive:true});fs.copyFileSync(__filename,workerFile);fs.copyFileSync(path.join(__dirname,'tool-discovery.cjs'),path.join(path.dirname(workerFile),'tool-discovery.cjs'));
      fd=fs.openSync(path.join(job,'worker.log'),'a',0o600);
      child=spawn(runtime,[workerFile,'--codex-worker',job],{cwd:a.workspace,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},detached:true,windowsHide:true,stdio:['ignore',fd,fd]});
      child.once('error',error=>{this.chain=this.chain.then(()=>this.failLaunch(fresh,error)).catch(()=>{});});child.unref();
    }catch(error){
      // Once spawn returns a child, a later error is not proof of no dispatch.
      if(child)throw error;
      return this.failLaunch(fresh,error);
    }finally{if(fd!==undefined)try{fs.closeSync(fd);}catch{/* Closing a descriptor is not native launch evidence. */}}
    return this.publicTask(fresh);
  }
  close(){clearInterval(this.timer);}
}
async function runWorker(directory){
  const job=read(path.join(directory,'job.json'),null),emit=data=>fs.appendFileSync(path.join(directory,'events.jsonl'),JSON.stringify(data)+'\n',{mode:0o600});
  const beat=()=>write(path.join(directory,'heartbeat.json'),{time:now(),pid:process.pid});beat();const timer=setInterval(beat,1000);
  const args=['exec',...(job.sessionId?['resume',job.sessionId]:[]),'--json','--skip-git-repo-check'];
  if(job.mcp){
    args.push('-c','mcp_servers.agentbridge.command='+JSON.stringify(job.mcp.command),'-c','mcp_servers.agentbridge.args='+JSON.stringify(job.mcp.args),'-c','mcp_servers.agentbridge.default_tools_approval_mode="prompt"');
    // User-configured relations authorize these bounded bridge operations only.
    for(const tool of (job.mcp.mode==='team'?job.mcp.toolNames:['list_agents','delegate','task_result','cancel_task','task_pending']))args.push('-c','mcp_servers.agentbridge.tools.'+tool+'.approval_mode="auto"');
    if(job.mcp.env)for(const [k,v] of Object.entries(job.mcp.env))args.push('-c','mcp_servers.agentbridge.env.'+k+'='+JSON.stringify(v));
  }
  args.push('-');const launch=require('./tool-discovery.cjs').command(job.executable,args);
  let child,buffer='',answer='',completed=false,failure='',diagnostics='',cancelled=false,ended=false;
  try{child=spawn(launch.executable,launch.args,{cwd:job.workspace,env:launch.env,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});}catch(e){clearInterval(timer);emit({kind:'terminal',status:'failed',code:'CODEX_START',text:safe(e.message)});return;}
  emit({kind:'started'});
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{buffer+=chunk.toString('utf8');if(Buffer.byteLength(buffer)>1048576){failure='Codex 事件超过长度限制';return;}
    let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let e;try{e=JSON.parse(line);}catch{continue;}
      if(e.type==='thread.started')emit({kind:'native',sessionId:e.thread_id});
      if(e.type==='item.completed'&&e.item?.type==='agent_message'){answer=safe(e.item.text);emit({kind:'output',text:answer});}
      if(['item.started','item.completed'].includes(e.type)&&e.item?.type!=='agent_message')emit({kind:'progress',text:safe(e.item?.type+(e.item?.command?' · '+e.item.command:e.item?.type==='mcp_tool_call'?' · '+e.item.server+'/'+e.item.tool:''))});
      if(e.type==='turn.completed')completed=true;
      if(e.type==='turn.failed'||e.type==='error')failure=safe(e.error?.message||e.message||'Codex 原生执行失败');
    }
  });child.stderr.on('data',c=>{const text=safe(c);diagnostics=(diagnostics+text).slice(-12000);fs.appendFileSync(path.join(directory,'native-stderr.log'),text,{mode:0o600});});
  const cancel=setInterval(()=>{if(ended||cancelled||!fs.existsSync(path.join(directory,'cancel.json')))return;cancelled=true;
    if(process.platform==='win32')execFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else{try{process.kill(-child.pid,'SIGTERM');}catch{}}
  },250);
  child.stdin.on('error',()=>{});child.stdin.end((job.mcp?(job.mcp.mode==='team'?job.mcp.instructions+'\n\n':collaborationInstructions):'')+job.message);
  const code=await new Promise(resolve=>{child.once('error',e=>{failure=safe(e.message);resolve(-1);});child.once('close',resolve);});ended=true;clearInterval(cancel);clearInterval(timer);
  try{const error=JSON.parse(failure);failure=error.error?.message||error.message||failure;}catch{/* Preserve a plain native error. */}
  const nativeError=failure||diagnostics.split('\n').findLast(line=>line.startsWith('Error:'))||diagnostics.slice(-2000)||'Codex 退出但未返回可确认结果';
  const succeeded=code===0&&completed&&!failure;
  emit({kind:'terminal',status:cancelled?'cancelled':succeeded?'succeeded':'failed',text:cancelled?'已确认 Codex 原执行结束':succeeded?answer:nativeError});
}
module.exports={CodexHost};
if(require.main===module&&worker)runWorker(process.argv[3]).catch(e=>{process.stderr.write(safe(e.stack));process.exitCode=1;});
