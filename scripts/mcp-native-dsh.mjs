// Installed DSH MCP client and tool runtime; controlled native parent, no models.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {localMcpHost}=require('../desktop/electron/coordinator-service.cjs');
const YAML=require('yaml');
const {assertListArgs}=require('../desktop/electron/agent-connections.cjs');
const nativeRoot=process.env.AGENTBRIDGE_DSH_MODULES||path.join(os.homedir(),'.dsh/profiles/node_modules');
const nativeRequire=createRequire(path.join(nativeRoot,'@deepseek-ai/dsh-mcp-client/package.json'));
const load=name=>import(pathToFileURL(nativeRequire.resolve('@deepseek-ai/'+name)).href);
const [{Context},{default:SystemPrompt},{default:ToolRuntime},McpClient]=await Promise.all(['cordis','dsh-system-prompt','dsh-tools','dsh-mcp-client'].map(load));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-dsh-native-mcp-'));
const output=path.resolve(process.env.AGENTBRIDGE_MCP_EVIDENCE||'artifacts/mcp-native-acceptance/2026-10-22/dsh.json');
const version=JSON.parse(fs.readFileSync(nativeRequire.resolve('@deepseek-ai/dsh-mcp-client/package.json'))).version;
const report={date:new Date().toISOString(),bridgeVersion:'0.6.0-alpha.46',nativeClientVersion:version,environment:'installed DSH MCP client and ToolRuntime / controlled Cordis parent / isolated profiles',modelCalls:0,status:'running',checks:[]};
const contexts=[];let host;const calls=[];
const options={directory:path.join(directory,'bridge'),home:directory,environment:{...process.env,DSH_HOME:directory},platform:'linux',collaboration:async(scope,name,args)=>{if(name==='list_agents')assertListArgs(args);calls.push({scope,name,args});return {items:[]};}};
try{
  host=localMcpHost(options);
  for(const [adapter,profile] of [['dsh-web','web'],['dsh','acp']]){
    const profileDirectory=path.join(directory,'profiles',profile);fs.mkdirSync(profileDirectory,{recursive:true});
    const file=path.join(profileDirectory,'cordis.patch.yml');fs.writeFileSync(file,'# native user comment\n[]\n');
    const params={nodeId:'native-'+profile,adapter,...(adapter==='dsh'?{profile}:{})};
    const installed=await host.call('mcp.install',params);assert.equal(installed.facts.config,'present');
    const entry=YAML.parse(fs.readFileSync(file,'utf8')).flatMap(row=>row.insert||[]).find(row=>row.id==='agentbridge-mcp');
    const ctx=new Context();contexts.push(ctx);await ctx.plugin(SystemPrompt);await ctx.plugin(ToolRuntime);
    await McpClient.apply(ctx,{...entry.config,cwd:directory,toolCallTimeoutMs:15000,failOnStartupError:true});
    assert.equal(ctx.tools.schemas().filter(t=>t.name.startsWith('mcp__agentbridge__')).length,7);
    const invoke=async(args={})=>ctx.tools.execute({signal:new AbortController().signal,callId:'native-'+calls.length,name:'mcp__agentbridge__list_agents',arguments:args});
    const result=await invoke();assert.equal(result.isError,false);assert.deepEqual(JSON.parse(result.content[0].text),{items:[]});
    assert.equal(calls.at(-1).scope.nodeId,params.nodeId);
    report.checks.push(profile+': installed native client registers seven namespaced tools and invokes the real authorized Bridge endpoint');
    const prior=calls.length;const forged=await invoke({nodeId:'another-agent'});assert.equal(forged.isError,true);assert.equal(calls.length,prior);
    report.checks.push(profile+': production Bridge validation rejects native-client identity arguments; broker keeps original scope');
    fs.writeFileSync(file,'# native deletion\n[]\n');
    assert.equal((await host.call('mcp.status',params)).facts.config,'absent');assert.equal((await invoke()).isError,false);
    host.close();host=localMcpHost(options);await host.call('mcp.status',params);
    assert.equal(fs.readFileSync(file,'utf8'),'# native deletion\n[]\n');assert.equal((await invoke()).isError,false);
    await host.call('mcp.revoke',params);const revoked=await invoke();assert.equal(revoked.isError,true);
    assert.match(revoked.content[0].text,/MCP_REVOKED/);
    const runtime=ctx.tools;await ctx.fiber.dispose();assert.equal(runtime.schemas().filter(t=>t.name.startsWith('mcp__agentbridge__')).length,0);
    report.checks.push(profile+': external deletion/restart never reinstalls; cached client survives deletion but is immediately rejected after revoke; native disposal removes tools');
  }
  report.status='passed';
}catch(error){report.status='failed';report.error={code:error.code,message:error.message};process.exitCode=1;}
finally{for(const ctx of contexts)await ctx.fiber.dispose();host?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
