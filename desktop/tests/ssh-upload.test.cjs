const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {uploadArchive}=require('../electron/ssh-install.cjs');
const {SshManager}=require('../electron/ssh-host.cjs');
function fixture(t,bytes=32768*27+13){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-upload-')),file=path.join(directory,'package.tgz');
  const input=Buffer.alloc(bytes);for(let i=0;i<bytes;i++)input[i]=Math.floor(i/32768)%251;
  fs.writeFileSync(file,input);t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const sftp=new EventEmitter(),pending=[],output=Buffer.alloc(bytes);let closeCallback;
  sftp.open=(_p,_flags,mode,cb)=>{assert.equal(mode,0o600);cb(null,Buffer.from('fixture-handle'));};
  sftp.write=(_h,buffer,off,len,pos,cb)=>pending.push({buffer,off,len,pos,cb});
  sftp.close=(_h,cb)=>{closeCallback=cb;};
  return {directory,file,input,sftp,pending,output,close:err=>closeCallback(err),ack(index=0){const p=pending.splice(index,1)[0];p.buffer.copy(output,p.pos,p.off,p.off+p.len);p.cb();}};
}
test('upload handles reordered/split WRITE acknowledgements without recycling active buffers and waits for remote CLOSE',async t=>{
  const f=fixture(t),progress=[];let done=false;
  const promise=uploadArchive(f.sftp,f.file,'/fixture/upload',p=>progress.push(p)).then(()=>done=true);
  assert.equal(f.pending.length,24);
  // Hold the first WRITE's buffer as ssh2 does when a server splits a request.
  f.ack(1);f.ack(1);f.ack(1);f.ack(1);
  while(f.pending.length)f.ack(f.pending.length-1);
  await Promise.resolve();assert(!done,'remote file must be closed before extraction');
  assert.deepEqual(f.output,f.input);assert.equal(progress.at(-1).completedBytes,f.input.length);
  for(let i=1;i<progress.length;i++)assert(progress[i].completedBytes>progress[i-1].completedBytes);
  f.close();await promise;assert(done);assert.equal(f.sftp.listenerCount('close'),0);
});
test('failed WRITE counts only acknowledged bytes and exposes a safe permission/storage diagnostic',async t=>{
  for(const code of [3,4,'ENOSPC','EDQUOT']){
    const f=fixture(t),progress=[],promise=uploadArchive(f.sftp,f.file,'/private/target',p=>progress.push(p));
    f.ack();const p=f.pending.shift();p.cb({code,message:'sensitive server text must not appear'});
    await assert.rejects(promise,e=>e.code==='SSH_UPLOAD_FAILED'&&e.message.includes('32768 /')&&!e.message.includes('sensitive')&&!e.message.includes('/private/target'));
    const before=progress.length;for(const pending of f.pending)pending.cb();assert.equal(progress.length,before);
  }
});
test('open and close rejection, channel closure and idle timeout all terminate pre-activation upload',async t=>{
  const open=fixture(t);open.sftp.open=(_p,_f,_m,cb)=>cb({code:3});await assert.rejects(uploadArchive(open.sftp,open.file,'/target'),e=>e.code==='SSH_UPLOAD_FAILED'&&e.message.includes('打开上传文件'));
  const close=fixture(t,5),closing=uploadArchive(close.sftp,close.file,'/target');close.ack();close.close({code:4});await assert.rejects(closing,e=>e.code==='SSH_UPLOAD_FAILED'&&e.message.includes('关闭上传文件'));
  for(const event of ['close','end','error']){const f=fixture(t),p=uploadArchive(f.sftp,f.file,'/target');f.sftp.emit(event,{code:'ECONNRESET'});await assert.rejects(p,{code:'SSH_UPLOAD_FAILED'});}
  const idle=fixture(t);await assert.rejects(uploadArchive(idle.sftp,idle.file,'/target',()=>{},{idleTimeoutMs:15}),e=>e.code==='SSH_UPLOAD_FAILED'&&e.message.includes('长时间未确认'));
});
test('known upload rejection permits explicit retry on the original installation ID; later unknown failures remain unknown',async t=>{
  const f=fixture(t);let code='SSH_UPLOAD_FAILED';
  const manager=new SshManager({directory:f.directory,installer:{async install(){throw Object.assign(Error('controlled'),{code});}}});t.after(()=>manager.close());
  const c={connectionId:'original',revision:1,authKind:'agent',stage:'ready',probe:{previewId:'fixed',installNeeded:true}};
  manager.connections.push(c);
  const ready=()=>manager.clients.set(c.connectionId,{ready:true,client:{end(){}}});
  ready();await assert.rejects(manager.connect(c,{operationId:'original-install',installIfNeeded:true}),{code});assert.equal(manager.operations['original-install'].status,'rejected');assert.equal(c.autoReconnect,false);
  ready();code='SSH_COMMAND_TIMEOUT';await assert.rejects(manager.connect(c,{operationId:'original-install',installIfNeeded:true}),{code});assert.equal(manager.operations['original-install'].status,'unknown');assert.equal(Object.keys(manager.operations).length,1);
});

test('real TCP SSH/SFTP upload validates bytes with split WRITEs, reordered server ACKs and delayed CLOSE',async t=>{
  const {Server,Client}=require('../../node_modules/ssh2'),{generateKeyPairSync}=require('node:crypto');
  const f=fixture(t,32768*27+13),key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs1',format:'pem'});
  let closeConfirmed=false,serverSftp;const peers=new Set();
  const server=new Server({hostKeys:[key]},peer=>{
    peers.add(peer);peer.on('error',()=>{});peer.on('close',()=>peers.delete(peer));peer.on('authentication',ctx=>ctx.accept());
    peer.on('ready',()=>peer.on('session',accept=>accept().on('sftp',accept=>{
      serverSftp=accept();serverSftp.on('OPEN',(id)=>serverSftp.handle(id,Buffer.from('file')));
      serverSftp.on('WRITE',(id,_h,pos,data)=>{data.copy(f.output,pos);setTimeout(()=>serverSftp.status(id,0),pos===0?35:1);});
      serverSftp.on('CLOSE',id=>setTimeout(()=>{closeConfirmed=true;serverSftp.status(id,0);},20));
    })));
  });
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
  const client=new Client();t.after(async()=>{client.end();for(const peer of peers)peer.end();await new Promise(r=>server.close(r));});
  await new Promise((r,j)=>{client.once('ready',r);client.once('error',j);client.connect({host:'127.0.0.1',port:server.address().port,username:'fixture',password:'synthetic'});});
  const sftp=await new Promise((r,j)=>client.sftp((e,s)=>e?j(e):r(s)));
  // Exercise ssh2's actual delayed continuation on a smaller write limit.
  sftp._maxWriteLen=16384;
  await uploadArchive(sftp,f.file,'/controlled-upload');assert(closeConfirmed);assert.deepEqual(f.output,f.input);sftp.end();
});
