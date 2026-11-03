// Thin native MCP stdio client for code-mode callers. No routing or execution.
const fs=require('node:fs'),{spawn}=require('node:child_process'),{createInterface}=require('node:readline');
async function run(){
 const [peerFile,tool,argsFile]=process.argv.slice(2),peer=JSON.parse(fs.readFileSync(peerFile)),config=peer.configuration;
 const child=spawn(config.command,config.args,{windowsHide:true,env:{...process.env,...config.env},stdio:['pipe','pipe','pipe']});
 const waiting=new Map();let id=0;const lines=createInterface({input:child.stdout});
 child.stderr.resume();lines.on('line',line=>{const r=JSON.parse(line);const done=waiting.get(r.id);waiting.delete(r.id);done?.(r);});
 const request=(method,params)=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{waiting.delete(n);reject(Object.assign(Error(),{code:'ORIGINAL_MCP_RESPONSE_UNCONFIRMED'}));},70000);waiting.set(n,r=>{clearTimeout(timer);if(r.error)reject(Object.assign(Error(),{code:'NATIVE_MCP_PROTOCOL_ERROR'}));else resolve(r.result);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});
 try{
  await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'current-windows-codex-code-mode',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  if(tool==='tools/list'){console.log(JSON.stringify(await request('tools/list',{})));return;}
  const args=argsFile?JSON.parse(fs.readFileSync(argsFile)):{};
  const response=await request('tools/call',{name:tool,arguments:args});
  const result=JSON.parse(response.content[0].text);console.log(JSON.stringify(result));if(response.isError)process.exitCode=2;
 }finally{child.kill();lines.close();}
}
run().catch(error=>{console.log(JSON.stringify({error:{code:error.code||'ORIGINAL_MCP_RESPONSE_UNCONFIRMED'}}));process.exitCode=1;});
