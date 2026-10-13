/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Windows CommonJS verification. */
// Real Windows TCP SSH, encrypted key, DPAPI, and agent protocol; isolated server/agent fixtures.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict');
const {generateKeyPairSync,randomBytes,randomUUID}=require('node:crypto');
const {Server,utils,AgentProtocol}=require('../../node_modules/ssh2');
const {SshManager}=require('../electron/ssh-host.cjs');
const {CredentialStore}=require('../electron/ssh-credentials.cjs');
const out=path.resolve(__dirname,'../../artifacts/I06A-auth.json');
const report={date:new Date().toISOString(),platform:process.platform,scope:'real Windows SSH transport and DPAPI; isolated SSH server and agent, no Linux deployment or model calls',checks:[],errors:[]};
const secret=randomBytes(24).toString('base64url'),phrase=randomBytes(24).toString('base64url');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06a-auth-'));
const pair=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'}});
const key=utils.parseKey(pair.privateKey),hostKey=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
const encrypted=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem',cipher:'aes-256-cbc',passphrase:phrase}}).privateKey;
const encryptedKey=utils.parseKey(encrypted,phrase);
const publicKeys=[key,encryptedKey].map(k=>k.getPublicSSH());
const sockets=new Set(),managers=[];let server,agent;
const listen=s=>new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',()=>resolve(s.address().port));});
async function authenticate(kind,port,extra={}){
 const folder=path.join(root,kind+'-'+randomUUID()),manager=new SshManager({directory:folder,coordinatorId:randomUUID(),openSshFiles:[],...extra});managers.push(manager);
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port,username:'acceptance-user',authKind:kind,...(kind==='key'?{keyPath:path.join(root,'encrypted.pem')}: {})});
 if(kind!=='agent')await manager.call('credential.provide',{connectionId:draft.connectionId,secret:kind==='key'?phrase:secret,save:kind==='password'});
 const connection=manager.find({connectionId:draft.connectionId});
 await assert.rejects(manager.authenticate(connection),{code:'SSH_HOST_TRUST_REQUIRED'});
 const challenge=manager.challenges.get(connection.connectionId);
 await manager.call('machine.trustHost',{connectionId:connection.connectionId,challengeId:challenge.challengeId,fingerprint:challenge.fingerprint});
 assert((await manager.authenticate(connection)).config);
 assert.equal(manager.credentials.memory.size,0);
 return {manager,connection};
}
(async()=>{
 assert.equal(process.platform,'win32');
 fs.writeFileSync(path.join(root,'encrypted.pem'),encrypted);
 server=new Server({hostKeys:[hostKey]},client=>{
  client.on('error',()=>{});sockets.add(client);client.on('close',()=>sockets.delete(client));
  client.on('authentication',ctx=>{
   if(ctx.username!=='acceptance-user')return ctx.reject();
   if(ctx.method==='password'&&ctx.password===secret)return ctx.accept();
   if(ctx.method==='publickey'&&publicKeys.some(k=>k.equals(ctx.key.data))){
    if(!ctx.signature)return ctx.accept();
    const pub=utils.parseKey(ctx.key.data);if(pub.verify(ctx.blob,ctx.signature,ctx.hashAlgo))return ctx.accept();
   }
   ctx.reject(['password','publickey']);
  });
 });
 const port=await listen(server);
 const {manager,connection}=await authenticate('password',port);
 report.checks.push('Windows TCP SSH password login succeeds after explicit host trust; memory secret cleared');
 const restarted=new CredentialStore(manager.options.directory);
 assert.equal(await restarted.read(connection),secret);restarted.close();
 const saved=fs.readFileSync(path.join(manager.credentials.directory,connection.credentialRef+'.json'),'utf8');assert(!saved.includes(secret));
 assert(!fs.readFileSync(manager.file,'utf8').includes(secret));
 report.checks.push('Actual DPAPI CurrentUser encryption survives new CredentialStore; credential/config files have no plaintext secret');
 await authenticate('key',port);report.checks.push('Actual encrypted RSA private key and passphrase authenticate over SSH; memory passphrase cleared');
 const pipe='\\\\.\\pipe\\agentbridge-acceptance-'+randomUUID();
 agent=net.createServer(socket=>{
  sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));
  const protocol=new AgentProtocol(false);protocol.on('error',()=>socket.destroy());
  protocol.on('identities',req=>protocol.getIdentitiesReply(req,[key]));
  protocol.on('sign',(req,pub,data,flags)=>{const signature=key.sign(data,flags?.hash||'sha1');protocol.signReply(req,signature);});
  socket.pipe(protocol).pipe(socket);
 });
 await new Promise((resolve,reject)=>{agent.once('error',reject);agent.listen(pipe,resolve);});
 await authenticate('agent',port,{agentEndpoint:pipe});
 report.checks.push('Windows named-pipe agent signs actual SSH authentication; isolated agent endpoint, Windows OpenSSH service not modified');
 report.status='passed';
})().catch(e=>{report.status='failed';report.errors.push({code:e.code||'VERIFY_FAILED',message:e.message});process.exitCode=1;}).finally(async()=>{
 for(const manager of managers)manager.close();for(const socket of sockets){if(socket.destroy)socket.destroy();else socket.end();}
 if(server?.listening)await new Promise(r=>server.close(r));if(agent?.listening)await new Promise(r=>agent.close(r));
 fs.rmSync(root,{recursive:true,force:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exit(process.exitCode||0);
});
