// Standalone MCP stdio client. The descriptor is private and refreshed on reconnect.
const fs=require('node:fs'),readline=require('node:readline');
const {randomUUID}=require('node:crypto');
const object=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const str={type:'string'};
const tools=[
  {name:'list_agents',description:'List the child Agent nodes the user connected to this leader. Includes machines, availability and capabilities.',inputSchema:object()},
  {name:'delegate',description:'Delegate a task to an allowed child node. Supply a stable requestId and reuse it if a response is uncertain. A new native child conversation is created; children cannot delegate further.',inputSchema:object({nodeId:str,message:str,requestId:str,workspace:str},['nodeId','message','requestId'])},
  {name:'task_result',description:'Read a delegated task, its actual result or error. waitMs (0 to 45000) waits for a terminal result. If still running, read again; never resend the prompt.',inputSchema:object({taskId:str,waitMs:{type:'integer',minimum:0,maximum:45000}},['taskId'])},
  {name:'cancel_task',description:'Request cancellation of your own delegated task. A receipt is not proof of native exit; read the task result to confirm.',inputSchema:object({taskId:str,operationId:str},['taskId','operationId'])},
  {name:'task_pending',description:'Read the actual permission requests and input forms of your own delegated task. Missing information or human approval should be escalated to the user.',inputSchema:object({taskId:str},['taskId'])},
  {name:'reply_task',description:'Reply to a pending request of your own delegated task. Never invent human approval or missing input. Use reject to deny permission, once only if the user authorized it.',inputSchema:object({taskId:str,operationId:str,requestId:str,action:{type:'string',enum:['permission','form']},decision:{type:'string',enum:['reject','once']},answer:{type:'object'}},['taskId','operationId','requestId','action'])},
];
for(const tool of tools)tool.annotations={readOnlyHint:['list_agents','task_result','task_pending'].includes(tool.name),destructiveHint:tool.name==='reply_task',idempotentHint:true,openWorldHint:false};
if(require.main===module){
  const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  lines.on('line',line=>{void(async()=>{
    let input;try{if(Buffer.byteLength(line)>131072)throw new Error('MCP 请求超过限制');input=JSON.parse(line);if(input.id===undefined)return;
      let result;
      if(input.method==='initialize')result={protocolVersion:['2024-11-05','2025-03-26','2025-06-18','2025-11-25'].includes(input.params?.protocolVersion)?input.params.protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'agentbridge',version:'0.5.0'}};
      else if(input.method==='ping')result={};
      else if(input.method==='tools/list')result={tools};
      else if(input.method==='tools/call'){
        if(!tools.some(t=>t.name===input.params?.name))throw new Error('不支持的协作操作');
        const descriptor=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
        const response=await fetch(descriptor.url,{method:'POST',headers:{authorization:'Bearer '+descriptor.token,'content-type':'application/json'},body:JSON.stringify({name:input.params.name,args:input.params.arguments||{},callId:randomUUID()}),signal:AbortSignal.timeout(60000)});
        if(!response.ok)throw new Error('协作通道不可用（'+response.status+'），请保留原请求 ID 并查询原记录。');
        const data=await response.json();result={content:[{type:'text',text:JSON.stringify(data.error?{error:data.error}:data.result)}],...(data.error?{isError:true}:{})};
      }else throw new Error('MCP 方法不支持');
      process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:input.id,result})+'\n');
    }catch(error){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:input?.id??null,error:{code:-32603,message:error.message}})+'\n');}
  })();});
}
module.exports={tools};
