// Real packaged CLI and Coordinator, disposable Windows/native profile, model 0.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const [bridge,version,output]=process.argv.slice(2);
if(process.platform!=='win32'||!bridge||!version||!output)throw Error('Windows Node, packaged bridge directory, exact version and report required');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ab-mcp-headless-'));
const environment={...process.env,AGENTBRIDGE_BRIDGE_DIR:bridge,AGENTBRIDGE_DESKTOP_PROFILE:profile,
  CLAUDE_CONFIG_DIR:path.join(profile,'native-claude'),ELECTRON_RUN_AS_NODE:'1'};
const {CoordinatorClient}=require(path.join(bridge,'desktop/electron/coordinator-client.cjs'));
const report={date:new Date().toISOString(),version,environment:'packaged non-GUI CLI / real Windows discovery and Coordinator / isolated native config',modelCalls:0,status:'running',checks:[]};
let client,stdio;
function cli(args){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(bridge,'dist/cli.js'),'mcp',...args,'--json'],{env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';const timer=setTimeout(()=>reject(Error('CLI timeout; retain original operation record')),150000);
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error('CLI exit '+code+': '+stderr));try{resolve(JSON.parse(stdout));}catch(e){reject(e);}});
});}
function stdioClient(entry){
  stdio=spawn(entry.command,entry.args,{env:{...environment,...entry.env},windowsHide:true,stdio:['pipe','pipe','pipe']});
  let buffer='',id=0;const pending=new Map();
  stdio.stdout.on('data',chunk=>{buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const row=JSON.parse(buffer.slice(0,index));buffer=buffer.slice(index+1);pending.get(row.id)?.(row);pending.delete(row.id);}});
  return (method,params={})=>new Promise((resolve,reject)=>{const next=++id,timer=setTimeout(()=>reject(Error('MCP stdio timeout')),15000);pending.set(next,row=>{clearTimeout(timer);resolve(row);});stdio.stdin.write(JSON.stringify({jsonrpc:'2.0',id:next,method,params})+'\n');});
}
(async()=>{
  // No desktop window has initialized this profile: this proves cold CLI start.
  const catalog=await cli(['nodes']);
  const node=catalog.nodes.find(n=>n.adapter==='claude'&&n.healthy&&!n.removed);
  assert(node,'installed healthy Windows Claude required for native configuration check');
  client=new CoordinatorClient({directory:profile});await client.attach();assert.equal(client.info.version,version);
  report.checks.push('Packaged CLI cold-starts the exact backend without a GUI and discovers real installed nodes');
  const operationId='mcp-headless-original-attach';
  const receipt=await cli(['attach','--node',node.nodeId,'--operation-id',operationId]);assert.equal(receipt.state,'confirmed');
  const original=await cli(['operation','--node',node.nodeId,'--operation-id',operationId]);assert.equal(original.operationId,operationId);assert.equal(original.state,'confirmed');
  report.checks.push('Explicit attach and original operation query use one persisted operation ID');
  const installed=await cli(['install','--node',node.nodeId]);
  assert.equal(installed.facts.config,'present');assert(installed.configPath.startsWith(profile));
  const exported=await cli(['export','--node',node.nodeId]);
  const entry=JSON.parse(fs.readFileSync(exported.files.json)).mcpServers.agentbridge;
  const rpc=stdioClient(entry);
  assert.equal((await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'isolated-native',version:'1'}})).result.serverInfo.name,'agentbridge');
  assert.equal((await rpc('tools/list')).result.tools.length,7);
  const called=await rpc('tools/call',{name:'list_agents',arguments:{}});
  assert.equal(called.result.isError,undefined);
  assert.equal(JSON.parse(called.result.content[0].text).error,undefined);
  report.checks.push('Generated stdio configuration lists seven tools and calls list_agents through the real authorized broker');
  const probed=await cli(['probe','--node',node.nodeId]);
  assert.equal(probed.facts.tools,'available');assert.equal(probed.evidence.observation.freshness,'current');
  // External native deletion must invalidate the observation without revocation/reinstall.
  const native=JSON.parse(fs.readFileSync(installed.configPath));delete native.mcpServers.agentbridge;
  fs.writeFileSync(installed.configPath,JSON.stringify(native));
  const deleted=await cli(['status','--node',node.nodeId]);
  assert.equal(deleted.facts.config,'absent');assert.equal(deleted.facts.tools,'unknown');assert.equal(deleted.facts.authorization,'valid');
  report.checks.push('Native-side deletion invalidates cached evidence and is not automatically repaired');
  await cli(['revoke','--node',node.nodeId]);
  const revoked=await rpc('tools/call',{name:'list_agents',arguments:{}});
  assert.equal(revoked.result.isError,true);assert.equal(JSON.parse(revoked.result.content[0].text).error.code,'MCP_REVOKED');
  assert.equal((await cli(['remove','--node',node.nodeId])).facts.authorization,'revoked');
  report.checks.push('Revocation immediately rejects the already-open client and removal keeps unrelated native settings');
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json'))).requests.length,0);
  report.status='passed';
})().catch(error=>{report.status='failed';report.error={code:error.code,message:error.message};process.exitCode=1;}).finally(async()=>{
  stdio?.kill();
  try{if(!client){client=new CoordinatorClient({directory:profile});await client.attach();}await client.request('shutdown');}catch{}
  client?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
