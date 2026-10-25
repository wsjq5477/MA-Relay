// Explicit real Pi MCP client on the ordinary EXE's disposable work scope.
// This module never starts a model or changes a daily native configuration.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{pathToFileURL}=require('node:url');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function open({call,runId,agentId,profile,nativeRoot}){
 const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../../artifacts/native-policy/2026-10-25/native-provenance.json'))).pi;
 for(const [file,expected]of Object.entries(original.criticalFilesEqualArchive))assert.equal(hash(path.join(nativeRoot,file)),expected,'Retained original Pi source mismatch');
 const home=path.join(profile,'native-lifecycle-pi'),cwd=path.join(home,'project');fs.mkdirSync(cwd,{recursive:true});
 const connection=await call('team.connect',{operationId:'portable-native-mcp-original',runId,agentId}),configuration=connection.configuration;
 assert(configuration.command.startsWith(profile+path.sep));assert(configuration.args.every(file=>file.startsWith(profile+path.sep)));
 const configFile=path.join(home,'mcp.json');fs.writeFileSync(configFile,JSON.stringify({mcpServers:{agentbridge:{...configuration,enabled:true}}}));const configHash=hash(configFile),originalEndpoint=JSON.parse(fs.readFileSync(configuration.args.at(-1),'utf8'));let originalReceipt;
 const load=file=>import(pathToFileURL(path.join(nativeRoot,file)).href),[{loadMcpConfig},runtime,{FileAuthStorageBackend}]=await Promise.all([load('dist/extensions/mcp/config.js'),load('dist/extensions/mcp/runtime.js'),load('dist/core/auth-storage.js')]);
 let current,originalClient,generation=0;const windows=[],samples=[];
 const create=async()=>{const loaded=loadMcpConfig({agentDir:home,cwd,projectTrusted:false});assert.deepEqual(loaded.errors,[]);assert.equal(loaded.servers.length,1);current=new runtime.McpServerConnection({entry:loaded.servers[0],cwd,createTransport:runtime.createDefaultTransport,credentials:new runtime.McpOAuthCredentialStore(new FileAuthStorageBackend(path.join(home,'mcp-auth.json')),home),onTools(){}});originalClient=await current.getClient();generation++;};
 try{await create();}catch(e){await current?.close();throw e;}
 const native=async(name,args={})=>{assert.strictEqual(await current.getClient(),originalClient,'The original native MCP transport must stay alive unless explicitly reopened');const reply=await current.callTool(name,args,{});assert.notEqual(reply.isError,true,'Native read failed');return JSON.parse(reply.content[0].text);};
 async function verify(phase){
  assert.equal(hash(configFile),configHash,'Original native MCP config stays byte-identical');
  const endpoint=JSON.parse(fs.readFileSync(configuration.args.at(-1),'utf8'));assert(endpoint.token===originalEndpoint.token&&endpoint.mode==='team','Original private endpoint identity must stay unchanged');
  assert(fs.existsSync(configuration.command));assert(configuration.args.every(file=>fs.existsSync(file)));
  assert.equal(current.tools.length,22);
  const context=await native('team_context');assert.equal(context.run.runId,runId);assert.equal(context.identity.agentId,agentId);assert.equal(context.attempts.length,0);
  const packets=await native('team_context_transfers');assert.equal(packets.items.length,1);assert.equal(packets.items[0].stage,'acknowledged');
  const receipt=await native('team_operation',{operationId:'portable-original-context-ack'});assert.equal(receipt.state,'confirmed');assert.equal(receipt.operationId,'portable-original-context-ack');assert.equal(receipt.data.stage,'acknowledged');assert.match(receipt.fingerprint,/^[a-f0-9]{64}$/);if(originalReceipt)assert.deepEqual(receipt,originalReceipt);else originalReceipt=receipt;
  samples.push({phase,transportGeneration:generation,toolCount:current.tools.length,originalIdentityMatched:true,originalEndpointIdentityMatched:true,originalAcknowledgementReceiptMatched:true,originalConfigUnchanged:true,packetAcknowledgementPreserved:true,modelAttempts:context.attempts.length});
 }
 return {verify,samples,nativeSourceFilesVerified:5,nativeVersion:JSON.parse(fs.readFileSync(path.join(nativeRoot,'package.json'))).version,
  windowOpened(command){const match=/^"([^"]+)"/.exec(command)||/^(\S+)/.exec(command);assert(match);const file=match[1];assert(fs.existsSync(file));assert(!configuration.command.startsWith(path.dirname(file)+path.sep));windows.push(file);},
  async windowClosed(){assert(windows.length);const prior=windows.at(-1);assert.equal(fs.existsSync(prior),false,'The original portable extraction executable must have been removed before native calls');await verify('window_closed_extraction_removed');},
  async reopen(){await current.close();await create();await verify('native_client_reopened_from_original_config');},
  result(){assert.equal(windows.length,3);assert.equal(new Set(windows).size,3,'Portable reopens must actually use different extraction paths');return {nativeVersion:this.nativeVersion,nativeSourceFilesVerified:5,windowExtractions:windows.length,distinctExtractions:new Set(windows).size,originalConfigUnchanged:hash(configFile)===configHash,samples};},
  async close(){await current.close();}
 };
}
module.exports={open};
