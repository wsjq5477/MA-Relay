'use strict';
// Test child: real Linux daemon/MachineHost/BrowserChannel; native side empty.
const path=require('node:path');
const {startDaemon}=require('../electron/machine-daemon.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
let daemon,stopping;
const stop=()=>stopping??=(async()=>{await daemon?.close();process.exit(0);})();
process.on('disconnect',()=>{void stop();});process.on('SIGTERM',()=>{void stop();});
process.on('message',async message=>{
  if(message?.type==='close'){await stop();return;}
  if(message?.type!=='start'||daemon)return;
  try{
    daemon=await startDaemon({...message.options,hostFactory:directory=>{
      const home=path.join(directory,'fixture-home');
      const legacy={setCollaboration(){},close(){},async call(method){
        if(method==='snapshot')return {agents:{items:[]},tasks:[],conversations:[]};
        if(method==='environment')return {platform:'linux',directory};
        throw Object.assign(Error('No native fixture object'),{code:'NOT_FOUND'});
      }};
      return new MachineHost({directory,legacy,enableBrowser:true,home,platform:'linux',environment:{PATH:'',HOME:home}});
    }});
    process.send?.({type:'ready',info:daemon.info});
  }catch(error){process.send?.({type:'rejected',code:/^[A-Z_]+$/.test(error.code||'')?error.code:'FIXTURE_START_FAILED'},()=>process.exit(0));}
});
