/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Windows acceptance. */
// Read secrets only from stdin. Never write inputs, authentication config, or remote address into reports.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{SshManager}=require('../electron/ssh-host.cjs');
const report={date:new Date().toISOString(),scope:'actual Windows password authentication and DPAPI restore against authorized independent Linux OpenSSH; no deployment or model calls',checks:[],errors:[]};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06a-password-'));let manager;
(async()=>{
 assert.equal(process.platform,'win32');const input=JSON.parse(fs.readFileSync(0,'utf8'));
 manager=new SshManager({directory:root,coordinatorId:randomUUID(),openSshFiles:[]});
 const draft=await manager.call('machine.createSshDraft',{host:input.host,port:input.port||22,username:input.username,authKind:'password'});
 await manager.call('credential.provide',{connectionId:draft.connectionId,secret:input.password,save:true});delete input.password;
 let connection=manager.find({connectionId:draft.connectionId});
 await assert.rejects(manager.authenticate(connection),{code:'SSH_HOST_TRUST_REQUIRED'});
 const challenge=manager.challenges.get(draft.connectionId);assert.equal(challenge.fingerprint,input.fingerprint);
 await manager.call('machine.trustHost',{connectionId:draft.connectionId,challengeId:challenge.challengeId,fingerprint:challenge.fingerprint});
 let client=await manager.authenticate(connection);
 const exec=client=>new Promise((resolve,reject)=>client.exec("printf 'agentbridge-auth-ok'",(e,s)=>{if(e)return reject(e);let text='';s.on('data',c=>text+=c);s.stderr.resume();s.on('error',reject);s.on('close',code=>code===0?resolve(text):reject(Error('Remote read-only check failed')));}));
 assert.equal(await exec(client),'agentbridge-auth-ok');assert.equal(manager.credentials.memory.size,0);
 report.checks.push('Actual independent Linux OpenSSH accepts password login from Windows after matching known fingerprint');
 manager.close();manager=new SshManager({directory:root,coordinatorId:randomUUID(),openSshFiles:[]});connection=manager.find({connectionId:draft.connectionId});
 client=await manager.authenticate(connection);assert.equal(await exec(client),'agentbridge-auth-ok');
 report.checks.push('New Windows manager authenticates again using actual DPAPI saved credential, with no password re-entry');report.status='passed';
})().catch(e=>{report.status='failed';report.errors.push({code:e.code||'VERIFY_FAILED',message:'Password/DPAPI remote verification did not complete; no secrets included.'});process.exitCode=1;}).finally(()=>{
 manager?.close();fs.rmSync(root,{recursive:true,force:true});fs.writeFileSync(path.resolve(__dirname,'../../artifacts/I06A-password-real.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exit(process.exitCode||0);
});
