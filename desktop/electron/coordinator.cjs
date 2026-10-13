const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { StringDecoder } = require('node:string_decoder');
const { createHash, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { ensurePrivateDirectory } = require('./private-directory.cjs');
const { createCoordinatorService } = require('./coordinator-service.cjs');
const PROTOCOL = 2;
function identity(directory) {
  ensurePrivateDirectory(directory);
  const file = path.join(directory,'coordinator-identity.json');
  if (!fs.existsSync(file)) {
    try { fs.writeFileSync(file,JSON.stringify({coordinatorId:randomUUID(),token:randomBytes(32).toString('hex')}),{flag:'wx',mode:0o600}); }
    catch(error) { if(error.code !== 'EEXIST') throw error; }
  }
  const record = JSON.parse(fs.readFileSync(file,'utf8'));
  if (!/^[a-f0-9]{64}$/.test(record.token) || typeof record.coordinatorId !== 'string')
    throw Object.assign(new Error('中央后台身份文件无效，原数据未清理。'),{code:'COORDINATOR_IDENTITY'});
  return record;
}
function endpoint(directory) {
  const key = createHash('sha256').update(path.resolve(directory)).digest('hex').slice(0,32);
  if (process.platform === 'win32') return '\\\\.\\pipe\\agentbridge-coordinator-'+key;
  const folder = path.join(os.tmpdir(),'agentbridge-ipc-'+process.getuid());
  ensurePrivateDirectory(folder);
  return path.join(folder,key+'.sock');
}
function sameSecret(a,b) {
  if(typeof a !== 'string') return false;
  const aa=Buffer.from(a),bb=Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa,bb);
}
function readLines(socket, receive) {
  const decoder = new StringDecoder('utf8'); let buffer='';
  socket.on('data',chunk=>{
    buffer += decoder.write(chunk);
    if(Buffer.byteLength(buffer)>12*1024*1024) {socket.destroy();return;}
    let index;
    while((index=buffer.indexOf('\n'))>=0) {
      const line=buffer.slice(0,index);buffer=buffer.slice(index+1);
      try {receive(JSON.parse(line));} catch {socket.destroy();return;}
    }
  });
}
async function startCoordinator(options) {
  const directory=path.resolve(options.directory), owner=identity(directory), address=endpoint(directory);
  const service=options.service || createCoordinatorService({...options,coordinatorId:owner.coordinatorId});
  const clients = new Set();
  const server = net.createServer(socket=>{
    clients.add(socket);let authorized=false,inFlight=0;
    const authDeadline=setTimeout(()=>socket.destroy(),5000);
    socket.on('error',()=>{});
    socket.on('close',()=>{clients.delete(socket);clearTimeout(authDeadline);});
    const send=value=>{if(socket.writable){if(socket.writableLength>8*1024*1024) socket.destroy();else socket.write(JSON.stringify(value)+'\n');}};
    readLines(socket,input=>{
      if(!authorized) {
        if(input.protocol!==PROTOCOL || input.coordinatorId!==owner.coordinatorId || !sameSecret(input.auth,owner.token)) {socket.destroy();return;}
        authorized=true;clearTimeout(authDeadline);
        send({hello:true,protocol:PROTOCOL,coordinatorId:owner.coordinatorId,pid:process.pid,version:options.version});return;
      }
      if(typeof input.id!=='string'||input.id.length>128||typeof input.method!=='string'||inFlight>=64||Buffer.byteLength(JSON.stringify(input))>1048576) {socket.destroy();return;}
      inFlight++;
      if(input.method==='shutdown') {
        send({id:input.id,result:{stopping:true}});
        setTimeout(()=>{for(const client of clients) client.destroy();server.close(()=>service.close());},100);
        return;
      }
      Promise.resolve().then(()=>service.dispatch(input.method,input.params)).then(
        result=>send({id:input.id,result}),error=>send({id:input.id,error:{code:error.code||'COORDINATOR_ERROR',message:error.message||'中央后台请求未完成。'}})
      ).finally(()=>inFlight--);
    });
  });
  // A live endpoint is the ownership lock. A stale PID never authorizes a kill.
  try { await new Promise((done,reject)=>{server.once('error',reject);server.listen(address,done);}); }
  catch(error) {
    if(error.code!=='EADDRINUSE'||process.platform==='win32') {service.close();throw error;}
    const live=await new Promise(resolve=>{
      const probe=net.connect(address);probe.once('connect',()=>{probe.destroy();resolve(true);});probe.once('error',e=>resolve(!['ECONNREFUSED','ENOENT'].includes(e.code)));
    });
    const stat=fs.lstatSync(address);
    if(live||!stat.isSocket()||stat.uid!==process.getuid()) {service.close();throw error;}
    fs.unlinkSync(address);
    await new Promise((done,reject)=>{server.once('error',reject);server.listen(address,done);});
  }
  if(process.platform!=='win32') fs.chmodSync(address,0o600);
  fs.writeFileSync(path.join(directory,'coordinator-status.json'),JSON.stringify({coordinatorId:owner.coordinatorId,pid:process.pid,protocol:PROTOCOL,version:options.version,startedAt:new Date().toISOString()}),{mode:0o600});
  return {server,service,owner,address,close:()=>new Promise(resolve=>{for(const socket of clients) socket.destroy();server.close(()=>{service.close();resolve();});})};
}
if(require.main===module) {
  const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
  startCoordinator({directory:value('--directory'),version:value('--version'),packaged:false,
    resourcesPath:path.resolve(__dirname,'../..'),packageDirectory:path.resolve(__dirname,'../../linux-package')})
    .then(coordinator=>{for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{void coordinator.close().then(()=>process.exit(0));});})
    .catch(error=>{process.stderr.write((error.code||'COORDINATOR_ERROR')+': '+error.message+'\n');process.exitCode=1;});
}
module.exports={startCoordinator,identity,endpoint,readLines,PROTOCOL};
