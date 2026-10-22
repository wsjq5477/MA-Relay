const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { identity,endpoint,readLines,PROTOCOL } = require('./coordinator.cjs');
const { coordinatorRuntime } = require('./coordinator-runtime.cjs');
const {supportsCurrentCoordinator,supportsMcpOpenAccess}=require('./runtime-capabilities.cjs');
class CoordinatorClient {
  constructor(options) {this.options=options;this.pending=new Map();this.socket=null;this.connecting=null;}
  async open() {
    if(this.socket&&!this.socket.destroyed) return;
    if(this.connecting) return this.connecting;
    this.connecting=this.ensure().finally(()=>{this.connecting=null;});return this.connecting;
  }
  async attach() {
    const owner=identity(this.options.directory);
    const socket=net.connect(endpoint(this.options.directory));
    await new Promise((done,reject)=>{
      const timer=setTimeout(()=>{socket.destroy();reject(Object.assign(new Error('中央后台身份确认超时。'),{code:'COORDINATOR_TIMEOUT'}));},5000);
      let ready=false;
      socket.on('error',error=>{clearTimeout(timer);if(!ready) reject(error);});
      socket.once('connect',()=>socket.write(JSON.stringify({protocol:PROTOCOL,coordinatorId:owner.coordinatorId,auth:owner.token})+'\n'));
      readLines(socket,message=>{
        if(!ready) {
          if(!message.hello||message.protocol!==PROTOCOL||message.coordinatorId!==owner.coordinatorId) {socket.destroy();reject(Object.assign(new Error('中央后台身份不匹配。'),{code:'COORDINATOR_IDENTITY'}));return;}
          ready=true;clearTimeout(timer);this.info=message;this.socket=socket;done();return;
        }
        const job=this.pending.get(message.id);if(!job) return;
        clearTimeout(job.timer);this.pending.delete(message.id);
        if(message.error) job.reject(Object.assign(new Error(message.error.message),{code:message.error.code}));else job.resolve(message.result);
      });
      socket.once('close',()=>{
        clearTimeout(timer);
        if(!ready) reject(Object.assign(new Error('中央后台拒绝连接。'),{code:'COORDINATOR_TRANSPORT'}));
        if(this.socket===socket) this.socket=null;
        for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(Object.assign(new Error('后台回应尚未确认，请查询原请求。'),{code:'COORDINATOR_TRANSPORT'}));}
        this.pending.clear();
      });
    });
  }
  async ensure() {
    try {await this.attach();return;} catch(error) {
      if(!['ENOENT','ECONNREFUSED'].includes(error.code)) throw error;
    }
    const runtime=coordinatorRuntime(this.options);
    const log=fs.openSync(path.join(this.options.directory,'coordinator.log'),'a',0o600);
    const child=spawn(runtime.executable,[runtime.entry,'--directory',this.options.directory,'--version',this.options.version],{
      detached:true,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
    child.on('error',()=>{});child.unref();fs.closeSync(log);
    const deadline=Date.now()+20000;
    while(Date.now()<deadline) {
      try {await this.attach();return;} catch(error) {if(!['ENOENT','ECONNREFUSED'].includes(error.code)) throw error;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Object.assign(new Error('中央后台未能启动，请查看后台诊断日志。'),{code:'COORDINATOR_START'});
  }
  async request(method,params) {
    await this.open();
    if(!supportsCurrentCoordinator(this.info?.capabilities)&&!['preferences','runtimes','shutdown'].includes(method))
      throw Object.assign(new Error('当前中央后台缺少本版本的安全读取、版本检查或分机器管理能力。请在设置 → 后台运行中停止后台并退出，再打开新版 EXE；原任务和历史保留。'),{code:'COORDINATOR_UPGRADE_REQUIRED'});
    // The richer MCP facts and the persisted revocation are separate new backend
    // capabilities. Old current-version coordinators already pass the generic
    // check above, so name this upgrade instead of dispatching into an old Set.
    if(method==='call'&&['mcp.status','mcp.revoke','mcp.probe'].includes(params?.method)&&!supportsMcpOpenAccess(this.info?.capabilities))
      throw Object.assign(new Error('当前中央后台缺少MCP开放接入能力。请在设置 → 后台运行中停止后台并退出，再打开新版 EXE；原任务、MCP配置与授权记录保留。'),{code:'MCP_BACKEND_UPGRADE_REQUIRED'});
    const id=randomUUID(),socket=this.socket;
    return new Promise((resolve,reject)=>{
      if(this.pending.size>=64) return reject(Object.assign(new Error('后台正在处理较多请求，请稍后重试。'),{code:'COORDINATOR_BUSY'}));
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Object.assign(new Error('后台回应尚未确认，请查询原请求。'),{code:'COORDINATOR_TIMEOUT'}));},method==='call'&&params?.method==='machine.connectSsh'?1200000:75000);
      this.pending.set(id,{resolve,reject,timer});socket.write(JSON.stringify({id,method,params})+'\n');
    });
  }
  close() {this.socket?.destroy();this.socket=null;}
}
module.exports={CoordinatorClient};
