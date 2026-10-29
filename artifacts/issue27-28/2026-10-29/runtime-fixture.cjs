const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../../..');
const {digest}=require(path.join(repo,'desktop/electron/graph-layout.cjs'));
function fixture(){
  const members=['a','b','c','d','e'],added=[...members,'f','g'],final=added.filter(id=>id!=='a');
  const collaboration={leaderId:'leader',memberIds:final,revision:15};
  return {version:1,nodes:['leader',...added].map(nodeId=>({nodeId,machineId:'machine',connected:nodeId!=='a',removed:nodeId==='a'})),requests:[{requestId:'preserved',state:'unknown'}],delegations:[{state:'unknown'}],
    relationsVersion:3,activeRelationId:'selected',collaboration,
    relations:[{relationId:'selected',enabled:true,leaderId:'leader',memberIds:members,revision:13,envelope:{version:1,revision:3,allowedNodeIds:[...members,'preauthorized']}},{relationId:'other',enabled:false,leaderId:null,memberIds:[],revision:2,envelope:{version:1,revision:0,allowedNodeIds:[]}}],
    relationOperations:[{operationId:'save14',state:'confirmed',fingerprint:digest({leaderId:'leader',memberIds:added,expectedRevision:13}),data:{leaderId:'leader',memberIds:added,revision:14}}],
    nodeOperations:[{operationId:'remove15',state:'confirmed',fingerprint:digest({nodeId:'a',machineId:'machine',action:'remove'}),data:{node:{nodeId:'a',machineId:'machine',connected:false,removed:true},collaboration}}],machineOperations:[],future:{preserved:true}};
}
function makeProfile(directory){
 const record=fixture(),state=record.relationOperations[0].data;
 record.nodeOperations.unshift({operationId:'synthetic-attach-observation',state:'confirmed',fingerprint:digest({nodeId:'f',machineId:'machine',action:'attach'}),data:{node:{nodeId:'f',machineId:'machine',connected:true,removed:false},collaboration:state}});
 const params={operationId:record.relationOperations[0].operationId,leaderId:state.leaderId,memberIds:state.memberIds,expectedRevision:13};
 const journal=[{lane:'relation',method:'saveCollaboration',operationId:params.operationId,state:'unknown',params,fingerprint:digest(params)}];
 const bytes=Buffer.from(JSON.stringify(record,null,2)+'\n');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'agent-network.json'),bytes);fs.writeFileSync(path.join(directory,'graph-pending.json'),JSON.stringify(journal));
 return {record,bytes,journal};
}
module.exports={makeProfile};
