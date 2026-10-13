// Isolated one-shot crash fixture; it never creates a native execution.
const fs=require('node:fs'),path=require('node:path');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {GraphOperationJournal}=require('../electron/graph-operations.cjs');
const [directory,lane,phase]=process.argv.slice(2);
const network=new AgentNetwork({directory,platform:'linux',createHost:()=>{throw Error('Native host forbidden');}});
network.network.nodes=[{nodeId:'known-node',machineId:network.catalog.localMachineId,connected:true,executionSupported:true}];network.saveNetwork();
const target=lane==='relation'?network.networkFile:network.layoutStore.file;
const rename=fs.renameSync;
fs.renameSync=(a,b)=>{
  if(b===target&&phase==='before')process.kill(process.pid,'SIGKILL');
  const value=rename(a,b);
  if(b===target&&phase==='after')process.kill(process.pid,'SIGKILL');
  return value;
};
const params=lane==='relation'?{operationId:'crash-operation',expectedRevision:0,leaderId:'known-node',memberIds:[]}
  :{operationId:'crash-operation',expectedLayoutRevision:0,layout:{version:1,layoutRevision:0,groups:{},nodes:{'known-node':{x:20,y:130}},viewport:{x:0,y:0,zoom:1}}};
const journal=new GraphOperationJournal(directory);
journal.save(lane==='relation'?'saveCollaboration':'saveGraphLayout',params,(m,p)=>network.call(m,p)).then(()=>process.exit(2),()=>process.exit(3));
