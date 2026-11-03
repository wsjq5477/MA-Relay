// Standalone MCP stdio client. The descriptor is private and refreshed on reconnect.
const fs=require('node:fs'),readline=require('node:readline');
const {randomUUID}=require('node:crypto');
const {teamTools}=require('./team-tools.cjs');
const object=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const str={type:'string'};
const tools=[
  {name:'list_delegations',description:'List only this original parent execution or independent MCP connection\'s delegated records. Read-only, paged ledger snapshot, not live task status. Use returned taskId with task_result/task_pending. If taskId is missing, task_result with the original delegationId queries the original request without resubmitting. Missing records remain unresolved: retain original IDs. No prompts, results, workspaces, credentials or other owners are included.',inputSchema:object({limit:{type:'integer',minimum:1,maximum:50},after:str})},
  {name:'list_agents',description:'Read this authenticated caller\'s current role and user-authorized child connections, with machine, availability and capabilities. No identity arguments. caller.delegationAuthorized is authority to request a new delegation, not proof a target is online or idle. A member or unassigned caller sees no targets; an unknown native parent cannot start new delegations. Only a successful current response establishes this view; a missing tool or failed call is not an empty relationship.',inputSchema:object()},
  {name:'list_connectable',description:'Read only this authenticated main caller\'s user-preauthorized connection candidates and current connected flags. No identity arguments or global discovery. Availability is not authorization. A missing tool or failed call is not an empty policy.',inputSchema:object()},
  {name:'connect_agent',description:'Connect a target inside this caller\'s preauthorized envelope. Outside it, only request human approval; pending_approval grants nothing. Use a stable operationId. After uncertainty set queryOnly=true with the exact original target and ID; not_found never authorizes replay or a new ID. confirmed is a historical permission receipt, never a task result; read list_agents for current connections.',inputSchema:object({nodeId:str,operationId:str,queryOnly:{type:'boolean'}},['nodeId','operationId'])},
  {name:'disconnect_agent',description:'Remove only this caller\'s outgoing connection. Original delegated tasks, results and cancellation facts remain separate. Preserve operationId and use queryOnly=true after an uncertain response; never change target or identity to release unknown. This does not revoke the user\'s preauthorization envelope.',inputSchema:object({nodeId:str,operationId:str,queryOnly:{type:'boolean'}},['nodeId','operationId'])},
  {name:'delegate',description:'Select an explicitly authorized registered agentId or nodeId from list_agents. If both are provided they must identify the same endpoint. Omit conversationId for a new conversation; supply the original delegated conversationId only to continue it after a confirmed terminal turn. Continuation requires the same original parent execution or independent MCP connection and current target authorization; it never changes workspace or releases unknown. Use one stable requestId per new message; uncertain responses query the original request, never resend or change IDs. The child receives versioned task context without new tools or permissions.',inputSchema:{...object({nodeId:str,agentId:str,message:str,requestId:str,workspace:str,conversationId:str},['message','requestId']),anyOf:[{required:['nodeId']},{required:['agentId']}]}},
  {name:'task_result',description:'Read the original delegated task, result, waiting state and execution evidence. Supply taskId, or the original delegationId from list_delegations to recover a lost submission receipt. This only queries the original request even after target grant revocation; a missing request does not permit resubmission. waitMs (0 to 45000) waits for completion or newly requested events. Optional afterSeq reads a bounded page of the original event sequence; limit (1 to 100) requires afterSeq. Keep taskId and cursor across reconnects. Missing history is a cursorGap, not permission to rerun. Native bindings and control payloads are omitted. Receipts and runtime success do not establish business acceptance. Never resend the prompt.',inputSchema:{...object({taskId:str,delegationId:str,waitMs:{type:'integer',minimum:0,maximum:45000},afterSeq:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}}),anyOf:[{required:['taskId']},{required:['delegationId']}]}},
  {name:'cancel_task',description:'Request cancellation of your own delegated task with a stable operationId. After uncertainty set queryOnly=true with the exact original task and ID to read its original cancellation receipt; this never resends cancellation. Missing or unproven receipts do not authorize replay or a new ID. A confirmed receipt is not proof of native exit; read task_result for the actual task outcome.',inputSchema:object({taskId:str,operationId:str,queryOnly:{type:'boolean'}},['taskId','operationId'])},
  {name:'task_pending',description:'Read the actual permission requests and input forms of your own delegated task. Missing information or human approval should be escalated to the user.',inputSchema:object({taskId:str},['taskId'])},
  {name:'reply_task',description:'Reply to a pending request of your own delegated task. Never invent human approval or missing input. Use reject to deny permission, once only if the user authorized it.',inputSchema:object({taskId:str,operationId:str,requestId:str,action:{type:'string',enum:['permission','form']},decision:{type:'string',enum:['reject','once']},answer:{type:'object'}},['taskId','operationId','requestId','action'])},
];
for(const tool of tools)tool.annotations={readOnlyHint:['list_delegations','list_agents','list_connectable','task_result','task_pending'].includes(tool.name),destructiveHint:['reply_task','disconnect_agent'].includes(tool.name),idempotentHint:true,openWorldHint:false};
if(require.main===module){
  const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  lines.on('line',line=>{void(async()=>{
    let input;try{if(Buffer.byteLength(line)>131072)throw new Error('MCP 请求超过限制');input=JSON.parse(line);if(input.id===undefined)return;
      let result;
      if(input.method==='initialize')result={protocolVersion:['2024-11-05','2025-03-26','2025-06-18','2025-11-25'].includes(input.params?.protocolVersion)?input.params.protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'agentbridge',version:'0.5.0'}};
      // Protocol revision 2026-07-28 asks servers to advertise their supported
      // versions through `server/discover` before the legacy initialize
      // handshake. Answering with a JSON-RPC error makes strict clients treat the
      // connection as broken; this server still speaks the legacy revisions.
      else if(input.method==='server/discover')result={supportedVersions:['2024-11-05','2025-03-26','2025-06-18','2025-11-25'],capabilities:{tools:{}}};
      else if(input.method==='ping')result={};
      else if(input.method==='tools/list'){const descriptor=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));result={tools:descriptor.mode==='team'?teamTools:tools};}
      else if(input.method==='tools/call'){
        const descriptor=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
        if(!(descriptor.mode==='team'?teamTools:tools).some(t=>t.name===input.params?.name))throw new Error('不支持的协作操作');
        // The client script can be newer than an already-running broker or
        // coordinator. Prove live backend support before sending a continuation
        // or read-only cancellation field an older handler could ignore.
        const continuation=descriptor.mode!=='team'&&input.params.name==='delegate'&&input.params.arguments?.conversationId!==undefined;
        const cancelQuery=descriptor.mode!=='team'&&input.params.name==='cancel_task'&&input.params.arguments?.queryOnly===true;
        const namedAgent=descriptor.mode!=='team'&&input.params.name==='delegate'&&input.params.arguments?.agentId!==undefined;
        const eventQuery=descriptor.mode!=='team'&&input.params.name==='task_result'&&(input.params.arguments?.afterSeq!==undefined||input.params.arguments?.limit!==undefined);
        const originalQuery=descriptor.mode!=='team'&&input.params.name==='task_result'&&input.params.arguments?.delegationId!==undefined;
        if(descriptor.mode!=='team'&&input.params.name==='cancel_task'&&input.params.arguments?.queryOnly!==undefined&&typeof input.params.arguments.queryOnly!=='boolean')result={content:[{type:'text',text:JSON.stringify({error:{code:'INVALID_INPUT',message:'queryOnly必须是布尔值；未发送取消。'}})}],isError:true};
        if(!result&&(continuation||cancelQuery||namedAgent||eventQuery||originalQuery)){
          const check=await fetch(descriptor.url,{method:'POST',headers:{authorization:'Bearer '+descriptor.token,'content-type':'application/json'},body:JSON.stringify({name:'list_agents',args:{},callId:randomUUID()}),signal:AbortSignal.timeout(60000)});
          if(!check.ok)throw new Error('协作通道不可用，请保留原请求 ID。');
          const view=await check.json();
          if(view.error){result={content:[{type:'text',text:JSON.stringify({error:view.error})}],isError:true};}
          else if(originalQuery&&!view.result?.supportedOperations?.includes('task.original-request-v1'))result={content:[{type:'text',text:JSON.stringify({error:{code:'MCP_ORIGINAL_REQUEST_BACKEND_UPGRADE_REQUIRED',message:'原后台未证明支持只读原委派查询；未发送需求或任务查询。'}})}],isError:true};
          else if(eventQuery&&!view.result?.supportedOperations?.includes('task.events-v1'))result={content:[{type:'text',text:JSON.stringify({error:{code:'MCP_TASK_EVENTS_BACKEND_UPGRADE_REQUIRED',message:'原后台未证明支持任务事件游标；未读取或推进游标。'}})}],isError:true};
          else if(namedAgent&&!view.result?.supportedOperations?.includes('delegate.agent-id-v1'))result={content:[{type:'text',text:JSON.stringify({error:{code:'AGENT_DIRECTORY_BACKEND_UPGRADE_REQUIRED',message:'原后台未证明支持登记身份调用；需求未派发。'}})}],isError:true};
          else if((continuation||cancelQuery)&&!view.result?.supportedOperations?.includes(continuation?'delegate.continue-v1':'cancel.query-v1'))result={content:[{type:'text',text:JSON.stringify({error:continuation?{code:'MCP_CONTINUATION_BACKEND_UPGRADE_REQUIRED',message:'原后台未证明支持委派续聊；未发送需求，请升级原后台后使用原会话。'}:{code:'MCP_CANCEL_QUERY_BACKEND_UPGRADE_REQUIRED',message:'原后台未证明支持只读取消查询；未发送取消，请升级原后台后查询原操作。'}})}],isError:true};
        }
        if(!result){
        const response=await fetch(descriptor.url,{method:'POST',headers:{authorization:'Bearer '+descriptor.token,'content-type':'application/json'},body:JSON.stringify({name:input.params.name,args:input.params.arguments||{},callId:randomUUID()}),signal:AbortSignal.timeout(60000)});
        if(!response.ok)throw new Error('协作通道不可用（'+response.status+'），请保留原请求 ID 并查询原记录。');
        const data=await response.json();result={content:[{type:'text',text:JSON.stringify(data.error?{error:data.error}:data.result)}],...(data.error?{isError:true}:{})};
        }
      }else throw new Error('MCP 方法不支持');
      process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:input.id,result})+'\n');
    }catch(error){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:input?.id??null,error:{code:-32603,message:error.message}})+'\n');}
  })();});
}
module.exports={tools};
