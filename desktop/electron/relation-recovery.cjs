// Recovery is available before constructing the mutable AgentNetwork.
const fs=require('node:fs'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util');
const {loadRelationState,projection,humanRelation,revokeNodes}=require('./relation-state.cjs');
const {digest,atomicWrite,operationId}=require('./graph-layout.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>Object.assign(Error(message),{code:'RELATION_RECOVERY_BLOCKED'});
function originalReceiptConfirms(record,row){
  const p=row.params;
  if(!p||row.operationId!==p.operationId||row.fingerprint!==digest(p))return false;
  const allowed=row.lane==='relation'?['operationId','expectedRevision','leaderId','memberIds','relationId']:['operationId','nodeId','machineId','action'];
  if(Object.keys(p).some(key=>!allowed.includes(key)))return false;
  if(row.lane==='relation'&&row.method==='saveCollaboration'){
    const input={leaderId:p.leaderId,memberIds:p.memberIds,expectedRevision:p.expectedRevision,...(Object.hasOwn(p,'relationId')?{relationId:p.relationId}:{})};
    const op=(record.relationOperations||[]).find(op=>op.operationId===row.operationId);
    return op?.state==='confirmed'&&op.fingerprint===digest(input)&&equal(op.data,{leaderId:p.leaderId,memberIds:p.memberIds,revision:p.expectedRevision+1,...(Object.hasOwn(p,'relationId')?{relationId:p.relationId,enabled:true}:{})});
  }
  if(row.lane==='node'&&row.method==='manageNode'){
    const op=(record.nodeOperations||[]).find(op=>op.operationId===row.operationId),node=op?.data?.node;
    return op?.state==='confirmed'&&op.fingerprint===digest({nodeId:p.nodeId,machineId:p.machineId,action:p.action})&&node?.nodeId===p.nodeId&&(!p.machineId||node.machineId===p.machineId)
      &&['attach','remove','disconnect'].includes(p.action)&&node.connected===(p.action==='attach')&&node.removed===(p.action==='remove');
  }
  return false;
}
function assertJournal(directory,record){
  const file=path.join(directory,'graph-pending.json');
  if(!fs.existsSync(file))return;
  const rows=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(rows)||rows.some(r=>!r||r.lane!=='layout'&&!['confirmed','rejected'].includes(r.state)&&!originalReceiptConfirms(record,r)))throw fail('原管理台账存在缺少原确认收据的未知占位，须先核对原操作。');
}
function derive(record){
  // Validate all original format constraints, including nonselected rows.
  if(record.version!==1||!Array.isArray(record.nodes)||!Array.isArray(record.requests))throw fail('网络结构不完整。');
  const selected=record.relations?.find(r=>r.relationId===record.activeRelationId);
  if(record.relationsVersion!==3||!selected)throw fail('只支持结构完整的 v3 冲突。');
  loadRelationState({...record,collaboration:projection(selected)});
  const target=projection(record.collaboration);
  if(target.revision<=selected.revision||target.revision-selected.revision>4096)throw fail('修订顺序不能由原收据唯一证明。');
  const seen=new Set(),events=[],observations=[];
  for(const key of ['relationOperations','nodeOperations','machineOperations','connectionOperations','connectionPolicyOperations']){
    if(record[key]!==undefined&&!Array.isArray(record[key]))throw fail('原收据结构不完整。');
    for(const op of record[key]||[]){
      if(!op||typeof op.operationId!=='string'||!op.operationId||!['confirmed','rejected'].includes(op.state))throw fail('存在未知占位或缺少原操作身份。');
      const identity=key==='connectionOperations'?'connection:'+op.operationKey:op.operationId;
      if(seen.has(identity))throw fail('存在重复原操作 ID，需人工核对。');seen.add(identity);
      if(op.state!=='confirmed')continue;
      if(!/^[a-f0-9]{64}$/.test(op.fingerprint||''))throw fail('原收据指纹缺失。');
      if(key==='connectionOperations'){
        const baseline=record.relations.find(row=>row.relationId===op.relationId);
        if(op.operationKey!==digest({owner:op.owner,operationId:op.operationId})||op.fingerprint!==digest({action:op.action,nodeId:op.nodeId})||!baseline||!Number.isSafeInteger(op.relationRevision)||op.relationRevision<0||op.relationRevision>baseline.revision)throw fail('连接收据未落在已确认索引基线内，须人工核对。');
        continue;
      }
      if(key==='connectionPolicyOperations'){
        const data=op.data,baseline=record.relations.find(row=>row.relationId===data?.relationId);
        if(baseline&&Number.isSafeInteger(data.revision)&&data.revision>=0&&data.revision<=baseline.revision&&Number.isSafeInteger(data.policyRevision)&&data.policyRevision>=0&&data.policyRevision<=baseline.envelope.revision)continue;
        const approvals=(record.connectionOperations||[]).filter(row=>row.approvalId===data?.approvalId);
        if(typeof data?.approvalId==='string'&&approvals.length===1){
          if(data.decision==='reject'&&approvals[0].state==='rejected')continue;
          const approved=approvals[0],base=record.relations.find(row=>row.relationId===approved.relationId);
          if(data.decision==='allow'&&approved.state==='confirmed'&&base&&Number.isSafeInteger(approved.relationRevision)&&approved.relationRevision<=base.revision)continue;
        }
        throw fail('策略收据缺少索引基线内的完整授权顺序，须人工核对。');
      }
      if(key==='relationOperations'){
        if(op.data?.relationId&&op.data.relationId!==record.activeRelationId)continue;
        const result=projection(op.data);
        if(result.revision>selected.revision)events.push({op,key,result});
      }else if(key==='nodeOperations'){
        if(!op.data?.node||!op.data?.collaboration)throw fail('节点收据缺少关系结果。');
        const result=projection(op.data.collaboration);
        const node=op.data.node,current=record.nodes.find(n=>n.nodeId===node.nodeId);
        const action=node.removed===true?'remove':node.connected===false?'disconnect':node.connected===true?'attach':null;
        const fingerprints=[undefined,node.machineId].map(machineId=>digest({nodeId:node.nodeId,machineId,action}));
        if(typeof node.nodeId!=='string'||!node.nodeId||typeof node.machineId!=='string'||!node.machineId||!action||action==='remove'&&node.connected!==false||!current||current.machineId!==node.machineId||!fingerprints.includes(op.fingerprint))throw fail('节点收据缺少可信原操作来源。');
        if(result.revision>selected.revision){
          // An attach is an observation of the current relation, not another
          // relationship mutation at that revision. Do not count it as a fork.
          (action==='attach'?observations:events).push({op,key,result,action});
        }
      }else if(key==='machineOperations'&&['remove','uninstall'].includes(op.data?.remoteAction||op.data?.action)){
        // Old machine receipts have no relationship revision: do not invent order.
        throw fail('机器移除收据缺少关系修订顺序，须人工核对。');
      }
    }
  }
  let row=structuredClone(selected);const chain=[],states=new Map([[selected.revision,projection(selected)]]);
  for(let revision=selected.revision+1;revision<=target.revision;revision++){
    const matches=events.filter(e=>{
      if(e.result.revision!==revision)return false;
      if(e.key==='nodeOperations'){
        const revoked=revokeNodes({...record,relations:[row],activeRelationId:row.relationId},new Set([e.op.data.node.nodeId])).relations[0];
        if(!equal(projection(revoked),e.result)){observations.push(e);return false;}
      }
      return true;
    });
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
    states.set(revision,projection(row));
  }
  for(const observation of observations){
    const state=states.get(observation.result.revision);
    if(!equal(state,observation.result))throw fail('节点观察与原关系修订链不一致。');
    if(observation.action!=='attach'&&(state.leaderId===observation.op.data.node.nodeId||state.memberIds.includes(observation.op.data.node.nodeId)))throw fail('节点撤权观察未能证明原成员已移除。');
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
      assertJournal(directory,record);
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
  assertJournal(directory,record);
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
