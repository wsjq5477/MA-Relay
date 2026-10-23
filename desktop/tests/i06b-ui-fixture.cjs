const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
async function graphFixture(options={}){
  const RuntimeNetwork=options.runtimeRoot?require(path.join(options.runtimeRoot,'desktop/electron/agent-network.cjs')).AgentNetwork:AgentNetwork;
  const runtimeService=options.runtimeRoot?require(path.join(options.runtimeRoot,'desktop/electron/coordinator-service.cjs')).createCoordinatorService:createCoordinatorService;
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06b-ui-')),hosts=new Map();
  let scale=false;
  const router=new RuntimeNetwork({directory,platform:'win32',hostname:'Windows 测试机',distributions:async()=>['Ubuntu'],createHost:m=>{
    const adapter=m.kind==='windows'?'claude':'opencode';
    const contexts=[],tasks=[],controls=new Map();
    const h={offline:false,calls:[],tasks,controls,setCollaboration(){},close(){},async call(method,p){
      this.calls.push({method,p});
      if(this.offline)throw Object.assign(Error('隔离测试：通道离线'),{code:'MACHINE_OFFLINE'});
      if(method==='discover')return {items:(scale?[adapter,...['claude','opencode','codex'].filter(a=>a!==adapter)]:[adapter]).map(a=>({name:{claude:'Claude Code',opencode:'OpenCode',codex:'Codex'}[a],adapter:a,executable:m.kind==='windows'?'C:/tools/'+a+'.exe':'/opt/'+a,version:'2.0.24',healthy:true,executionSupported:true}))};
      if(method==='snapshot')return {agents:{items:contexts.map(c=>({...c,enabled:true,online:true,healthy:true,available:!tasks.some(t=>t.targetAgent===c.agentId&&!['succeeded','failed','cancelled'].includes(t.status))})),revision:0,connected:true},tasks,conversations:[]};
      if(method==='connectTool')return {};
      // OpenCode attachment now checks its API through a prepared context.
      // This fixture permits preparation; native IPC execution remains opt-in.
        if(method==='context'&&(options.nativeExecution||p.adapter==='opencode')){
          const c={agentId:'controlled-agent-'+contexts.length,contextId:'controlled-context-'+contexts.length,workspace:p.workspace||'C:/controlled/'+contexts.length,executable:p.executable,adapter:p.adapter};contexts.push(c);return {...c,teamCollaboration:true};
        }
      if(options.nativeExecution){
        if(method==='scope')return {configured:true,teamContinuation:true};
        if(method==='ipc'){
          if(p.op==='submit'){
            const task={taskId:'controlled-task-'+tasks.length,conversationId:'controlled-conversation-'+tasks.length,executionId:'controlled-execution-'+tasks.length,targetAgent:p.agentId,requestId:p.requestId,message:p.message,status:'running',events:[],waiting:{kind:'permission',requestIds:['private-controlled-permission'],summary:'private-tool-arguments'}};
            tasks.push(task);return task;
          }
          if(['request','task'].includes(p.op)){
            const t=tasks.find(t=>p.op==='request'?t.requestId===p.requestId:t.taskId===p.taskId);
            if(!t)throw Object.assign(Error('missing'),{code:'NOT_FOUND'});return t;
          }
          if(p.op==='cancel'){
            const receipt={operationId:p.operationId,state:'confirmed'};controls.set(p.operationId,receipt);
            if(options.loseCancelAck)throw Object.assign(Error('Controlled lost cancel response'),{code:'TRANSPORT_LOST'});
            return receipt;
          }
          if(p.op==='operation')return controls.get(p.operationId)||{operationId:p.operationId,state:'not_found'};
        }
      }
      throw Error('UI fixture must not submit native tasks: '+method);
    }};hosts.set(m.machineId,h);return h;
  }});
  router.catalog.machines.push({machineId:'ssh-fixture',name:'Linux 测试服务器',kind:'ssh',platform:'linux',host:'linux.example.test',username:'fixture',port:22,online:true,connectionState:'online'});
  router.save();let snapshot=await router.snapshot();
  for(const node of snapshot.nodes)await router.call('attachNode',{nodeId:node.nodeId});
  snapshot=await router.snapshot();
  const service=runtimeService({directory,platform:'win32',network:router,version:require('../package.json').version});
  let loseRelationAck=false,loseLayoutAck=false,hideReceipt=false,staleRelation=null;
  const calls=[];
  return {router,directory,calls,hosts,nodes:snapshot.nodes,
    async call(method,p={}){calls.push({method,p});try{
      if(hideReceipt&&method.endsWith('Operation'))return {ok:true,result:{operationId:p.operationId,state:'not_found'}};
      const reply=await service.call({method,params:p});if(!reply.ok)return reply;const result=reply.result;
      if(method==='snapshot'&&staleRelation)result.collaboration=structuredClone(staleRelation);
      if(method==='saveCollaboration'&&loseRelationAck){loseRelationAck=false;throw Object.assign(Error('授权回应丢失，核对原操作。'),{code:'DESKTOP_TRANSPORT'});}
      if(method==='saveGraphLayout'&&loseLayoutAck){loseLayoutAck=false;throw Object.assign(Error('布局回应丢失，核对原操作。'),{code:'DESKTOP_TRANSPORT'});}
      return {ok:true,result};
    }catch(e){return {ok:false,error:{code:e.code||'FIXTURE_ERROR',message:e.message}};}},
    async inject(action){
      if(action==='hold-relation')staleRelation=structuredClone(router.network.collaboration);
      if(action==='release-relation')staleRelation=null;
      if(action==='scale'){scale=true;for(let i=0;i<17;i++)router.catalog.machines.push({machineId:'scale-'+i,name:'测试服务器 '+(i+1),kind:'ssh',platform:'linux',host:'scale.example.test',username:'fixture',port:22,online:true});await Promise.all(router.catalog.machines.map(machine=>router.discover(machine)));const s=await router.snapshot();for(const n of s.nodes)if(!n.connected)await router.call('attachNode',{nodeId:n.nodeId});}
      if(action==='lose-relation')loseRelationAck=true;
      if(action==='lose-layout')loseLayoutAck=true;
      if(action==='hide-receipt')hideReceipt=true;
      if(action==='show-receipt')hideReceipt=false;
      if(action==='offline'){hosts.get('ssh-fixture').offline=true;router.retryAfter.delete('ssh-fixture');}
      if(action==='online'){hosts.get('ssh-fixture').offline=false;router.retryAfter.delete('ssh-fixture');}
      if(action==='external-relation'){const current=await router.call('collaboration');await router.call('saveCollaboration',{leaderId:snapshot.nodes[0].nodeId,memberIds:[],expectedRevision:current.revision,operationId:require('node:crypto').randomUUID()});}
      if(action==='external-layout'){const current=await router.call('graphLayout');await router.call('saveGraphLayout',{operationId:require('node:crypto').randomUUID(),expectedLayoutRevision:current.layoutRevision,layout:{...current,viewport:{x:0,y:0,zoom:1}}});}
    },
    close(){service.close();fs.rmSync(directory,{recursive:true,force:true});}
  };
}
module.exports={graphFixture};
