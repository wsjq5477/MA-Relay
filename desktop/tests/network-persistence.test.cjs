const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {atomicWrite}=require('../electron/graph-layout.cjs');
test('network saves and shared atomic writes retry sharing violations, clean up and preserve definitive errors',async t=>{
 for(const save of ['network','atomic'])for(const code of ['EPERM','EACCES','EBUSY','ENOSPC'])await t.test(save+' '+code,t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-network-write-')),file=path.join(directory,'agent-network.json');
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));fs.writeFileSync(file,JSON.stringify({marker:'old'}));
  const router=Object.create(AgentNetwork.prototype);router.networkFile=file;router.network={marker:'new'};
  const rename=fs.renameSync;let attempts=0;
  fs.renameSync=(from,to)=>{if(to===file&&++attempts<=2)throw Object.assign(Error('controlled '+code),{code});return rename(from,to);};
  try{
   const write=()=>save==='network'?router.saveNetwork():atomicWrite(file,router.network);
   if(code==='ENOSPC'){assert.throws(write,e=>e.code===(save==='network'?'NETWORK_PERSIST':'ENOSPC')&&/ENOSPC/.test(e.message));assert.equal(attempts,1);assert.equal(JSON.parse(fs.readFileSync(file)).marker,'old');}
   else{write();assert.equal(attempts,3);assert.equal(JSON.parse(fs.readFileSync(file)).marker,'new');}
  }finally{fs.renameSync=rename;}
  assert.equal(fs.readdirSync(directory).filter(f=>f.endsWith('.tmp')).length,0);
 });
});
test('persistent sharing violations stop after six attempts and retain the original document',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-network-exhaust-')),file=path.join(directory,'agent-network.json');
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));fs.writeFileSync(file,'old');
 const rename=fs.renameSync;let attempts=0;
 fs.renameSync=(from,to)=>{if(to===file){attempts++;throw Object.assign(Error('controlled EPERM'),{code:'EPERM'});}return rename(from,to);};
 try{assert.throws(()=>atomicWrite(file,{}),{code:'EPERM'});assert.equal(attempts,6);}finally{fs.renameSync=rename;}
 assert.equal(fs.readFileSync(file,'utf8'),'old');assert.deepEqual(fs.readdirSync(directory),['agent-network.json']);
});
