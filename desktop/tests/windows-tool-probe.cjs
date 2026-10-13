// Windows native process-start regression. Isolated state; no model calls.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { ClaudeHost } = require('../electron/claude-host.cjs');
const { MachineRouter } = require('../electron/machine-router.cjs');
if (process.platform !== 'win32') throw Error('Windows Node required');
const base = process.argv[2];
if (!base) throw Error('Isolated output directory required');
const root = path.join(base, 'I04E-tool-probe-' + Date.now().toString(16));
const directory = path.join(root, 'state'), bin = path.join(root, 'node_modules/@anthropic-ai/claude-code/bin');
fs.mkdirSync(bin, { recursive:true }); fs.mkdirSync(directory);
const launcher = path.join(root, 'claude.cmd');
fs.writeFileSync(launcher, '@echo off\r\n');
const invalid = path.join(bin, 'claude.exe');
fs.writeFileSync(invalid, 'MZ-invalid-native-image-for-process-start-regression');
fs.writeFileSync(path.join(bin, '../cli.js'), "if(process.argv.includes('--version')) console.log('2.1.296 (Claude Code)'); else console.log(JSON.stringify({loggedIn:true}));\n");
fs.writeFileSync(path.join(directory, 'claude-state.json'), JSON.stringify({version:1,revision:1,connections:[{connectionId:'tool',executable:launcher}],instances:[{agentId:'instance',connectionId:'tool',workspace:root,enabled:true}],tasks:[],conversations:[],requests:{},operations:{}}));
const report = {date:new Date().toISOString(),status:'running',scope:'isolated Windows native spawn failure + real CLI version only',root,checks:{},errors:[]};
const output = path.resolve(__dirname, '../../artifacts/I04E-windows-tool-probe.json');
const host = new ClaudeHost({directory,candidates:[launcher]});
const router = new MachineRouter({directory:path.join(root,'catalog'),platform:'win32',distributions:async()=>[],createHost:()=>host});
(async()=>{
 let snapshot;
 try { snapshot=await host.call('snapshot'); }
 catch(e) { report.reproduced={code:e.code,message:e.message};throw e; }
 assert.equal(snapshot.agents.items[0].available,false);
 assert.match(snapshot.agents.items[0].startupError.message,/Claude.*启动/);
 assert.equal(snapshot.tasks.length,0);report.checks.nativeFailureRetainedAsToolFailure=true;
 const machineView=await router.call('snapshot');
 assert.equal(machineView.machines[0].online,true);
 assert.equal(machineView.instances[0].startupError.code,snapshot.agents.items[0].startupError.code);
 assert(machineView.connections.every(c=>!c.healthy));
 report.checks.machineStaysOnlineWhenToolCannotStart=true;
 const failed=(await host.call('discover')).items[0];
 assert.equal(failed.healthy,false);assert(failed.error?.code);report.checks.failedCandidateVisible=true;
 // Removing the invalid native binary allows the standard npm JS fallback.
 fs.rmSync(invalid);host.state.instances[0].check.time='2000-01-01T00:00:00Z';
 snapshot=await host.call('snapshot');
 assert.equal(snapshot.agents.items[0].available,true);assert(!snapshot.agents.items[0].startupError);
 assert.equal(snapshot.tasks.length,0);report.checks.metadataRecoversWithoutPromptReplay=true;
 const known=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'agentbridge-desktop/windows/claude-state.json'),'utf8')).connections[0].executable;
 const version=execFileSync(known,['--version'],{cwd:root,encoding:'utf8',timeout:15000,windowsHide:true}).trim();
 assert.match(version,/Claude Code/);report.realCliVersion=version;report.checks.realInstallationVersionResponds=true;
 report.status='passed';
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1;}).finally(()=>{
 router.close();host.close();fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
