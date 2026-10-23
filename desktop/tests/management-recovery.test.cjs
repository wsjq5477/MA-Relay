const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
process.env.TSX_TSCONFIG_PATH=path.resolve(__dirname,'../tsconfig.json');const {require:load}=require('tsx/cjs/api'),{relationRecoveryReason,executionRecoveryReason,matchingReceipt,redactedOperation,mergeRecoveryRows,querySummaryText}=load('../src/management-recovery.ts',__filename);
const nodes=[{nodeId:'a',machineId:'local',adapter:'opencode',executable:'C:/oc.exe',name:'Original'},{nodeId:'b',machineId:'local',adapter:'codex',executable:'C:/codex.exe',name:'Independent'},{nodeId:'alias',machineId:'local',adapter:'opencode',executable:'C:/oc2.exe'}],machines=[{machineId:'local',kind:'windows'},{machineId:'remote',kind:'ssh',connectionId:'remote-connection'}],original={lane:'node',operationId:'real-original-secret-id',state:'unknown',params:{operationId:'real-original-secret-id',nodeId:'a',machineId:'local',action:'attach'}};
test('frontend execution scope protects original aliases and shared folders while allowing an unrelated same-machine node',()=>{
 assert.equal(executionRecoveryReason([original],'local','b',nodes,machines), '');assert(executionRecoveryReason([original],'local','a',nodes,machines));assert(executionRecoveryReason([original],'local','alias',nodes,machines));
 const instances=[{nodeId:'a',machineId:'local',workspace:'D:/shared'}];assert(executionRecoveryReason([original],'local','b',nodes,machines,instances,'/mnt/d/shared'));
 assert(executionRecoveryReason([{...original,params:{machineId:'local'}}],'local','b',nodes,machines));assert(executionRecoveryReason([{...original,params:{nodeId:'a'}}],'local','b',nodes,machines));
});
test('invalid or missing machine provenance never matches the empty local connection',()=>{for(const machineId of ['', ' ', 'unrecognized-machine'])assert(executionRecoveryReason([{...original,params:{nodeId:'a',machineId}}],'local','b',nodes,machines));});
test('machine, relation, legacy source and layout protections remain distinct',()=>{
 assert(executionRecoveryReason([{...original,lane:'machine'}],'local','b',nodes,machines));assert(executionRecoveryReason([{...original,lane:'relation'}],'local','b',nodes,machines));assert.equal(executionRecoveryReason([{...original,lane:'layout'}],'local','b',nodes,machines),'');
 assert.equal(executionRecoveryReason([{...original,lane:'machine',params:{connectionId:'remote-connection'}}],'local','b',nodes,machines),'');
});
test('recovery projection deduplicates originals and displays only a hashed operation label',()=>{
 assert.equal(mergeRecoveryRows([original],[original]).length,1);assert(!redactedOperation(original.operationId).includes(original.operationId));assert.notEqual(redactedOperation('a'),'a');
 assert(!matchingReceipt(original,{operationId:original.operationId,state:'confirmed',data:{node:{nodeId:'a',machineId:'foreign'}}}));assert(matchingReceipt(original,{operationId:original.operationId,state:'not_found'}));
 const summary=querySummaryText({attempted:4,confirmed:1,rejected:1,unresolved:2,notFound:1,failed:1,at:'now'});assert.match(summary,/未找到原收据 1/);assert.match(summary,/查询失败 1/);assert.match(summary,/继续保留/);
});

test('relation recovery permits a trusted independent node range but keeps missing and global scopes protected',()=>{
 const row={...original,blockedNodeIds:['a']};assert.equal(relationRecoveryReason([row],nodes,machines),'');assert.equal(relationRecoveryReason([{...row,lane:'layout'}],nodes,machines),'');for(const changed of [{lane:'relation'},{lane:'machine'},{blockedNodeIds:undefined},{blockedNodeIds:[]},{blockedNodeIds:['a',null]},{params:{nodeId:'a'}},{params:{machineId:'local',nodeId:'missing'}}])assert(relationRecoveryReason([{...row,...changed}],nodes,machines));
});
