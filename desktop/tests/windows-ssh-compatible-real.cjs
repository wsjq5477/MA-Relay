// Existing-server compatibility verification: read-only by default, optional
// --connect creates a temporary observer and updates the original local receipt.
// Saved credentials stay in memory; no deployment or native task submissions.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {SshManager}=require('../electron/ssh-host.cjs'),{remoteExec,quote}=require('../electron/ssh-install.cjs');
const profile=process.env.AGENTBRIDGE_EXISTING_PROFILE||path.join(os.homedir(),'AppData/Roaming/agentbridge-desktop');
const owner=JSON.parse(fs.readFileSync(path.join(profile,'coordinator-identity.json')));
const manager=new SshManager({directory:profile,coordinatorId:owner.coordinatorId,packageDirectory:path.resolve(__dirname,'../.linux-package')});
const report={date:new Date().toISOString(),clientVersion:require('../package.json').version,scope:'Windows saved credential authentication, pinned installed release verification and non-fencing inspect of the existing authorized Linux daemon; no remote deployment writes, no native prompts',status:'running',checks:{}};
const connect=process.argv.includes('--connect');
const output=path.resolve(__dirname,'../../artifacts/ssh-compatibility/2026-10-12/'+(connect?'remote-connect.json':'remote-readonly.json'));
if(connect) report.scope='Windows alpha.4 client reconnects the original authorized Linux daemon using saved credentials; same existing owner/profile and task history, temporary observation channel, no daemon replacement or native prompts';
(async()=>{
 assert.equal(process.platform,'win32');
 const connection=manager.connections.find(c=>c.name===(process.env.AGENTBRIDGE_EXISTING_CONNECTION_NAME||'阿里云'));assert(connection&&connection.daemonId);
 const client=await manager.authenticate(connection);
 const probe=await manager.installer.probe(client);assert.equal(probe.reuseCompatible,true);assert.equal(probe.installNeeded,false);
 report.daemonVersion=probe.daemonVersion;report.checks.probeReusesPinnedVersion=true;
 let observationClient=client;
 const capture=()=>remoteExec(observationClient,'/bin/sh -s','sha256sum '+quote(path.posix.join(probe.installPath,'current.json'))+'\n');
 const before=await capture();
 const beforePid=JSON.parse(await remoteExec(client,'cat '+quote(path.posix.join(probe.stateDirectory,'daemon.pid'))));
 const install=await manager.installer.install(client,probe,'readonly-compatibility-check');
 report.checks.verifiedInstalledFiles=true;
 const inspect=()=>remoteExec(client,quote(install.node)+' -',`const mod=require(${JSON.stringify(path.posix.join(install.versionPath,'desktop/electron/machine-daemon.cjs'))});mod.inspectDaemon(${JSON.stringify({stateDirectory:install.stateDirectory,ownerCoordinatorId:owner.coordinatorId,profileId:install.profileId,expectedDaemonId:connection.daemonId})}).then(v=>process.stdout.write(JSON.stringify(v)),()=>process.exit(1));`,{timeoutMs:30000});
 const first=JSON.parse(await inspect()),second=JSON.parse(await inspect());
 assert.equal(first.pid,beforePid.pid);assert.equal(first.daemonId,beforePid.daemonId);assert.equal(first.daemonId,connection.daemonId);assert.equal(first.daemonId,second.daemonId);assert.equal(first.pid,second.pid);assert.equal(first.version,probe.daemonVersion);
 report.checks.originalDaemonIdentityPreserved=true;report.checks.originalDaemonPidPreserved=true;
 if(connect){
  manager.dropTransport(connection);
  const state=await manager.call('machine.reconnect',{connectionId:connection.connectionId});assert.equal(state.online,true);observationClient=manager.clients.get(connection.connectionId).client;
  const host=manager.hosts.get(connection.connectionId),status=await host.request('daemon.status',{});
  assert.equal(status.daemonId,connection.daemonId);assert.equal(status.pid,beforePid.pid);
  report.checks.originalConnectionHandshake=true;report.checks.originalPidAfterHello=true;
  const discovery=await host.call('discover',{});assert(discovery.items.some(a=>a.adapter==='opencode'));
  const snapshot=await host.call('snapshot',{});report.observedExistingTasks=snapshot.tasks.length;
  report.checks.originalConnectionHandshake=true;report.checks.originalPidAfterHello=true;report.checks.openCodeVisible=true;
 }

 assert.equal(await capture(),before);report.checks.currentReleaseUnchanged=true;report.submittedNativePrompts=0;report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'VERIFY_FAILED',message:'Existing-server compatibility verification failed; inspect the error code without exposing credentials.'};process.exitCode=1;}).finally(()=>{manager.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
