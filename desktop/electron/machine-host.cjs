const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash,randomUUID}=require('node:crypto');
const {ClaudeHost}=require('./claude-host.cjs');
const {CodexHost}=require('./codex-host.cjs');
const {scanTools}=require('./tool-discovery.cjs');
const {CollaborationBroker}=require('./collaboration-broker.cjs');
const terminal=new Set(['succeeded','failed','cancelled']);
const fail=(code,message)=>Object.assign(new Error(message),{code});
/** A machine owns installed tools; private contexts own directories and native sessions. */
class MachineHost {
  constructor(options){
    this.options=options;this.directory=options.directory;this.legacy=options.legacy;
    this.contexts=new Map();this.connecting=new Map();this.file=path.join(this.directory,'node-contexts.json');
    this.rows=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):[];
    this.broker=new CollaborationBroker(this.directory,(...args)=>{if(!this.options.collaboration)throw fail('COLLABORATION_OFFLINE','主 Agent 协作通道未连接。');return this.options.collaboration(...args);});
    if(!Array.isArray(this.rows))throw fail('CONTEXT_STATE','执行上下文记录无法读取，请保留数据排查。');
  }
  save(){fs.mkdirSync(this.directory,{recursive:true});const tmp=this.file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.rows,null,2),{mode:0o600});fs.renameSync(tmp,this.file);}
  setCollaboration(handler){this.options.collaboration=handler;}
  backend(row){
    if(!this.contexts.has(row.contextId)){
      const directory=path.join(this.directory,'node-contexts',row.contextId);
      const host=row.adapter==='opencode'?this.options.openCode(directory):row.adapter==='claude'?new ClaudeHost({directory,home:this.options.home||os.homedir(),candidates:[row.executable],environment:this.options.environment}):this.options.codex?this.options.codex(directory,row.executable):new CodexHost({directory,executable:row.executable});
      if(!host)throw fail('ADAPTER_UNSUPPORTED','这个节点尚未完成执行适配。');
      this.contexts.set(row.contextId,host);
    }
    return this.contexts.get(row.contextId);
  }
  async discover(){
    const items=await scanTools(this.options);
    // Installation/transport checks are independent of an account's model availability.
    return {items:items.map(i=>({...i,executable:i.executable,executionSupported:true}))};
  }
  async context(params){
    if(params.model||params.providerID)throw fail('INVALID_INPUT','节点使用原生配置，不接受模型或供应商覆盖。');
    const detected=(await this.discover()).items.find(i=>i.adapter===params.adapter&&i.executable===params.executable);
    if(!detected?.healthy)throw fail('DISCOVERY_CHANGED','这个工具当前不可调用，请重新扫描。');
    if(!detected.executionSupported)throw fail('ADAPTER_UNSUPPORTED','这个工具已发现，执行适配尚未完成。');
    const defaultPath=path.join(this.directory,'sessions',params.nodeId.replace(/[^\w-]/g,'_'));
    if(!params.workspace)fs.mkdirSync(defaultPath,{recursive:true});
    let workspace;try{workspace=fs.realpathSync(params.workspace||defaultPath);if(!fs.statSync(workspace).isDirectory())throw new Error();}catch{throw fail('WORKSPACE_UNAVAILABLE','执行目录不存在，请选择目标机器上的目录。');}
    const key=createHash('sha256').update(params.nodeId+':'+workspace+':'+(params.collaborationId||'direct')+(params.adapter==='opencode'?':cli-defaults-v1':'')).digest('hex').slice(0,24);
    if(this.connecting.has(key))return this.connecting.get(key);
    const job=(async()=>{
      let row=this.rows.find(r=>r.contextId===key);
      if(!row){row={contextId:key,nodeId:params.nodeId,adapter:params.adapter,executable:params.executable,workspace};this.rows.push(row);this.save();}
      if(params.scope)await this.call('scope',{contextId:row.contextId,scope:params.scope});
      const host=this.backend(row);
      if(!row.agentId){const result=await host.call('connect',{executable:row.executable,workspace:row.workspace,name:detected.name,...(row.adapter==='opencode'?{inheritNativeCli:true}:{})});row.agentId=result.agentId;this.save();}
      let snapshot=await host.call('snapshot',{}),agent=snapshot.agents.items.find(a=>a.agentId===row.agentId);
      // OpenCode can listen before its native catalogue and next health
      // heartbeat are ready. Observe metadata before sending any user prompt.
      const readyBy=Date.now()+10000;
      while(row.adapter==='opencode'&&agent?.healthy===false&&Date.now()<readyBy){
        await new Promise(resolve=>setTimeout(resolve,250));
        snapshot=await host.call('snapshot',{});agent=snapshot.agents.items.find(a=>a.agentId===row.agentId);
      }
      if(agent?.model)throw fail('CONVERSATION_CONFIG','旧执行上下文有模型覆盖，请保留原记录并新建原生配置会话。');
      if(row.adapter==='opencode'&&agent?.healthy===false)throw fail('AGENT_UNHEALTHY','原生工具尚未就绪，未提交需求；请检查原生账号或等待服务就绪。');
      return {...row,teamCollaboration:true};
    })().finally(()=>this.connecting.delete(key));this.connecting.set(key,job);return job;
  }
  async call(method,params={}){
    if(method==='discover')return this.discover();
    if(method==='context')return this.context(params);
    if(method==='environment')return this.legacy.call(method,params);
    if(method==='scope'){
      const row=this.rows.find(r=>r.contextId===params.contextId);if(!row)throw fail('CONTEXT_STATE','执行上下文不存在。');
      const mcp=await this.broker.configure(row.contextId,params.scope);
      row.mcp=mcp;this.save();
      if(row.adapter==='opencode'){
        const context=path.join(this.directory,'node-contexts',row.contextId),instructions=path.join(context,'agentbridge-instructions.md');
        fs.writeFileSync(instructions,params.scope.teamSessionId?require('./team-tools.cjs').instructions:'你是用户指定的主 Agent。需要协作时，通过 agentbridge_list_agents 查询允许连接的子节点，agentbridge_delegate 委派任务，agentbridge_task_result 查询或等待真实结果，然后在当前会话汇总。每项委派使用稳定 requestId，回应未知时查询原请求，不重复提交。不要通过终端命令绕过协作接口。子节点不能扩大连接关系。\n',{mode:0o600});
        fs.writeFileSync(path.join(context,'bridge-mcp.json'),JSON.stringify({instructions:[instructions],mcp:{servers:{agentbridge:{type:'local',command:[mcp.command,...mcp.args],environment:mcp.env,codemode:false}}}}),{mode:0o600});
      }
      return {configured:true,teamContinuation:true};
    }
    if(method==='snapshot'){
      if(!this.restored){this.restored=true;for(const entry of this.broker.scopes)await this.call('scope',{contextId:entry.contextId,scope:entry.scope});}
      const all=await Promise.all([this.legacy.call('snapshot',{}),...this.rows.filter(r=>r.agentId).map(async row=>{
        try{return await this.backend(row).call('snapshot',{});}catch(error){return {agents:{items:[{agentId:row.agentId,workspace:row.workspace,executable:row.executable,adapter:row.adapter,enabled:true,online:false,healthy:false,available:false,startupError:{code:error.code,message:error.message}}]},tasks:[],conversations:[]};}
      })]);
      const base=all[0];return {...base,agents:{...base.agents,items:all.flatMap(s=>s.agents?.items||[]).map(a=>{const row=this.rows.find(r=>r.agentId===a.agentId);return {...a,...(row?{adapter:row.adapter,nodeId:row.nodeId,contextId:row.contextId}:{})};})},tasks:all.flatMap(s=>s.tasks||[]),conversations:all.flatMap(s=>s.conversations||[])};
    }
    if(method==='ipc'){
      // Failed context preparation may persist a row before it has an agent.
      // Two absent IDs must never route a read/control to that unfinished row.
      const byAgent=typeof params.agentId==='string'&&params.agentId.trim()
        ?this.rows.find(r=>r.agentId===params.agentId):undefined;
      if(byAgent)return this.backend(byAgent).call(method,{...params,...(byAgent.mcp&&byAgent.adapter!=='opencode'?{mcp:byAgent.mcp}:{})});
      if(['tasks','conversations','agents'].includes(params.op)){const snapshot=await this.call('snapshot',{});return params.op==='agents'?snapshot.agents:{items:snapshot[params.op]};}
      // Each original receipt/session stays with its backend; only reads search.
      if(['request','task','conversation','pending','operation','continue','cancel','reply','reconcile'].includes(params.op)){
        if(params.op==='request'){
          for(const h of [this.legacy,...this.rows.filter(r=>r.agentId).map(r=>this.backend(r))]){try{return await h.call('ipc',params);}catch(e){if(!['NOT_FOUND','REQUEST_NOT_FOUND','NOT_CONFIGURED'].includes(e.code))throw e;}}
          throw fail('NOT_FOUND','原请求尚无可核对收据。');
        }
        const snapshot=await this.call('snapshot',{});
        const owner=params.conversationId?snapshot.conversations.find(c=>c.conversationId===params.conversationId):snapshot.tasks.find(t=>t.taskId===params.taskId);
        const row=typeof owner?.targetAgent==='string'&&owner.targetAgent.trim()
          ?this.rows.find(r=>r.agentId===owner.targetAgent):undefined;
        if(row)return this.backend(row).call(method,{...params,...(row.mcp&&row.adapter!=='opencode'?{mcp:row.mcp}:{})});
      }
    }
    return this.legacy.call(method,params);
  }
  close(){this.broker.close();this.legacy.close?.();for(const host of this.contexts.values())host.close?.();}
}
module.exports={MachineHost};
