const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {GraphLayoutStore}=require('../electron/graph-layout.cjs');
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-graph-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,store:new GraphLayoutStore(directory)};}
const layout=()=>({version:1,layoutRevision:0,groups:{machine:{x:-20,y:40}},nodes:{node:{x:20,y:130}},viewport:{x:-100,y:50,zoom:.75}});
test('layout and its stable receipt commit together; duplicates and restart do not bump the revision',t=>{
  const {store,directory}=fixture(t),p={operationId:'layout-once',expectedLayoutRevision:0,layout:layout()};
  const first=store.save(p,['machine'],['node']);
  for(let i=0;i<10;i++)assert.deepEqual(store.save(p,['machine'],['node']),first);
  const reordered={operationId:p.operationId,layout:{viewport:p.layout.viewport,nodes:p.layout.nodes,groups:p.layout.groups,layoutRevision:0,version:1},expectedLayoutRevision:0};
  assert.deepEqual(store.save(reordered,['machine'],['node']),first);
  const restored=new GraphLayoutStore(directory);assert.equal(restored.get().layoutRevision,1);assert.deepEqual(restored.operation('layout-once'),first);
  assert.throws(()=>restored.save({...p,layout:{...layout(),viewport:{x:1,y:1,zoom:1}}},['machine'],['node']),{code:'OPERATION_CONFLICT'});
  assert.throws(()=>restored.save({...p,operationId:'another'},['machine'],['node']),{code:'LAYOUT_REVISION_CONFLICT'});
  assert.equal(restored.operation('unconfirmed').state,'not_found');
});
test('layout validates known identities, bounded finite positions, zoom and rejects authority or secret fields',t=>{
  const {store}=fixture(t);
  const invalid=[
    {...layout(),nodes:{other:{x:0,y:0}}},
    {...layout(),groups:{machine:{x:Infinity,y:0}}},
    {...layout(),nodes:{node:{x:-1,y:130}}},
    {...layout(),viewport:{x:0,y:0,zoom:3}},
    {...layout(),leaderId:'node'},
    {...layout(),nodes:{node:{x:1,y:130,password:'secret'}}},
    {...layout(),groups:JSON.parse('{"__proto__":{"x":1,"y":1}}')}
  ];
  for(const row of invalid)assert.throws(()=>store.save({operationId:'invalid',expectedLayoutRevision:0,layout:row},['machine'],['node']),{code:'INVALID_INPUT'});
  assert.equal(store.get().layoutRevision,0);
});
test('layout rename failure leaves prior disk and memory together; corrupt layout is preserved without touching authority',t=>{
  const {store,directory}=fixture(t);const first=store.save({operationId:'first',expectedLayoutRevision:0,layout:layout()},['machine'],['node']);
  const rename=fs.renameSync;fs.renameSync=(a,b)=>{if(b===store.file)throw Object.assign(Error('disk'),{code:'ENOSPC'});return rename(a,b);};
  try{assert.throws(()=>store.save({operationId:'lost',expectedLayoutRevision:1,layout:{...layout(),layoutRevision:1}},['machine'],['node']),{code:'ENOSPC'});}finally{fs.renameSync=rename;}
  assert.deepEqual(store.operation('first'),first);assert.equal(store.operation('lost').state,'not_found');
  const relation=path.join(directory,'agent-network.json');fs.writeFileSync(relation,'original authority');
  fs.writeFileSync(store.file,'broken');const restored=new GraphLayoutStore(directory);
  assert(restored.get().warning);assert.equal(restored.get().layoutRevision,0);assert(fs.readdirSync(directory).some(f=>f.includes('.corrupt-')));
  assert.equal(fs.readFileSync(relation,'utf8'),'original authority');
});
