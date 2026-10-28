// Recovery is available before constructing the mutable AgentNetwork.
const fs=require('node:fs'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util');
const {loadRelationState,projection,humanRelation,revokeNodes}=require('./relation-state.cjs');
const {digest,atomicWrite,operationId}=require('./graph-layout.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>Object.assign(Error(message),{code:'RELATION_RECOVERY_BLOCKED'});
function assertJournal(directory){
  const file=path.join(directory,'graph-pending.json');
  if(!fs.existsSync(file))return;
  const rows=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(rows)||rows.some(r=>r.lane!=='layout'&&!['confirmed','rejected'].includes(r.state)))throw fail('原管理台账存在未知占位，须先核对原操作。');
}
function derive(record){
  // Validate all original format constraints, including nonselected rows.
  if(record.version!==1||!Array.isArray(record.nodes)||!Array.isArray(record.requests))throw fail('网络结构不完整。');
  const selected=record.relations?.find(r=>r.relationId===record.activeRelationId);
  if(record.relationsVersion!==3||!selected)throw fail('只支持结构完整的 v3 冲突。');
  loadRelationState({...record,collaboration:projection(selected)});
  const target=projection(record.collaboration);
  if(target.revision<=selected.revision||target.revision-selected.revision>4096)throw fail('修订顺序不能由原收据唯一证明。');
  const seen=new Set(),events=[];
  for(const key of ['relationOperations','nodeOperations','machineOperations','connectionOperations','connectionPolicyOperations']){
    if(record[key]!==undefined&&!Array.isArray(record[key]))throw fail('原收据结构不完整。');
    for(const op of record[key]||[]){
      if(!op||typeof op.operationId!=='string'||!op.operationId||!['confirmed','rejected'].includes(op.state))throw fail('存在未知占位或缺少原操作身份。');
      const identity=op.operationId;
      if(seen.has(identity))throw fail('存在重复原操作 ID，需人工核对。');seen.add(identity);
      if(op.state!=='confirmed')continue;
      if(!/^[a-f0-9]{64}$/.test(op.fingerprint||''))throw fail('原收据指纹缺失。');
      if(['connectionOperations','connectionPolicyOperations'].includes(key))throw fail('连接或策略收据缺少完整授权结果顺序，须人工核对。');
      if(key==='relationOperations'){
        if(op.data?.relationId&&op.data.relationId!==record.activeRelationId)continue;
        const result=projection(op.data);
        if(result.revision>selected.revision)events.push({op,key,result});
      }else if(key==='nodeOperations'){
        if(!op.data?.node||!op.data?.collaboration)throw fail('节点收据缺少关系结果。');
        const result=projection(op.data.collaboration);
        if(result.revision>selected.revision)events.push({op,key,result});
      }else if(key==='machineOperations'&&['remove','uninstall'].includes(op.data?.remoteAction||op.data?.action)){
        // Old machine receipts have no relationship revision: do not invent order.
        throw fail('机器移除收据缺少关系修订顺序，须人工核对。');
      }
    }
  }
  let row=structuredClone(selected);const chain=[];
  for(let revision=selected.revision+1;revision<=target.revision;revision++){
    const matches=events.filter(e=>e.result.revision===revision);
    if(matches.length!==1)throw fail('收据修订跳号或存在多个候选结果。');
    const {op,key,result}=matches[0];
    if(key==='relationOperations'){
      const input={leaderId:result.leaderId,memberIds:result.memberIds,expectedRevision:revision-1,...(op.data.relationId?{relationId:op.data.relationId}:{})};
      if(digest(input)!==op.fingerprint)throw fail('关系收据与原操作指纹不匹配。');
      row=humanRelation(row,{...row,...result});
    }else{
      const node=op.data.node,current=record.nodes?.find(n=>n.nodeId===node.nodeId);
      const action=node.removed===true?'remove':node.connected===false?'disconnect':null;
      if(!action||!current||current.machineId!==node.machineId)throw fail('后续撤权缺少原节点来源。');
      const fingerprints=[undefined,node.machineId].map(machineId=>digest({nodeId:node.nodeId,machineId,action}));
      if(!fingerprints.includes(op.fingerprint))throw fail('节点撤权收据指纹不匹配。');
      const revoked=revokeNodes({...record,relations:[row],activeRelationId:row.relationId},new Set([node.nodeId]));
      row=revoked.relations[0];
      if(!equal(projection(row),result))throw fail('节点撤权不能解释下一关系修订。');
    }
    chain.push({kind:key,revision,memberCount:row.memberIds.length});
  }
  if(events.some(e=>e.result.revision>target.revision)||!equal(projection(row),target))throw fail('最终关系与完整收据链不一致。');
  const next={...record,relations:record.relations.map(r=>r===selected?row:r)};
  loadRelationState(next);
  return {next,selected,row,chain};
}
function inspect(directory){
  const file=path.join(directory,'agent-network.json'),bytes=fs.readFileSync(file),record=JSON.parse(bytes);
  try{loadRelationState(record);return {conflict:false};}
  catch(error){if(error.code!=='RELATION_STATE_CONFLICT')throw error;
    const diagnostic=error.diagnostic;
    try{
      assertJournal(directory);
      const {selected,row,chain}=derive(record);
      const ids=[...new Set([...selected.memberIds,...row.memberIds])].sort();
      return {conflict:true,diagnostic:{...diagnostic,recoveryAvailable:true},proposal:{sourceDigest:hash(bytes),revisionFrom:selected.revision,revisionTo:row.revision,
        envelopeFrom:selected.envelope.revision,envelopeTo:row.envelope.revision,chain,
        members:ids.map((id,i)=>({label:'成员 '+(i+1),change:!selected.memberIds.includes(id)?'add':!row.memberIds.includes(id)?'remove':'retain'})),
        leaderChanged:selected.leaderId!==row.leaderId}};
    }catch(reason){return {conflict:true,diagnostic,blockedReason:reason.message};}
  }
}
function recover(directory,params){
  operationId(params.operationId);
  if(params.confirm!==true||!/^[a-f0-9]{64}$/.test(params.sourceDigest||''))throw fail('必须明确确认原恢复提案。');
  const file=path.join(directory,'agent-network.json'),bytes=fs.readFileSync(file),record=JSON.parse(bytes);
  const previous=(record.relationRecoveryOperations||[]).find(op=>op.operationId===params.operationId);
  if(previous){if(previous.sourceDigest!==params.sourceDigest)throw fail('原恢复 ID 已用于其他提案。');return previous;}
  if(hash(bytes)!==params.sourceDigest)throw fail('原文件已变化，请重新检查。');
  assertJournal(directory);
  const {next}=derive(record);
  const backup=path.basename(file)+'.before-recovery-'+randomUUID()+'.bak',backupFile=path.join(directory,backup);
  const fd=fs.openSync(backupFile,'wx',0o600);
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  if(!fs.readFileSync(backupFile).equals(bytes))throw fail('备份校验失败，未恢复。');
  const receipt={operationId:params.operationId,state:'confirmed',sourceDigest:params.sourceDigest,backup,backupDigest:hash(bytes)};
  next.relationRecoveryOperations=[...(record.relationRecoveryOperations||[]),receipt];
  if(!fs.readFileSync(file).equals(bytes))throw fail('提交前原文件已变化，未恢复。');
  atomicWrite(file,next);return receipt;
}
function publicCall(fn){return (...args)=>{
  try{return fn(...args);}catch(error){
    if(['RELATION_RECOVERY_BLOCKED','RELATION_STATE','RELATION_STATE_CONFLICT','INVALID_INPUT'].includes(error.code))throw error;
    throw fail('本地关系文件或备份读写未完成；原文件未主动清理，请保留原操作并重新检查。');
  }
};}
module.exports={inspect:publicCall(inspect),recover:publicCall(recover),derive};
