// CT-08: identity-scoped runtime relations, with a selected legacy UI projection.
const {isDeepStrictEqual}=require('node:util');
const LEGACY_RELATION_ID='legacy-default';
const fail=(code,message)=>Object.assign(new Error(message),{code});
function projection(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.leaderId!==null&&typeof value.leaderId!=='string'
    ||!Array.isArray(value.memberIds)||value.memberIds.some(id=>typeof id!=='string')
    ||new Set(value.memberIds).size!==value.memberIds.length||!Number.isSafeInteger(value.revision)||value.revision<0)
    throw fail('RELATION_STATE','协作关系记录无法安全读取，请保留原文件排查。');
  return {leaderId:value.leaderId,memberIds:[...value.memberIds],revision:value.revision};
}
function envelope(row){
  return row.envelope||{version:1,revision:0,allowedNodeIds:[...row.memberIds]};
}
function validateEnvelope(row){
  const p=row.envelope;
  if(!p||p.version!==1||!Number.isSafeInteger(p.revision)||p.revision<0||!Array.isArray(p.allowedNodeIds)||p.allowedNodeIds.length>4096||new Set(p.allowedNodeIds).size!==p.allowedNodeIds.length||p.allowedNodeIds.some(id=>typeof id!=='string'||!id||id===row.leaderId)||row.memberIds.some(id=>!p.allowedNodeIds.includes(id)))
    throw fail('RELATION_STATE','连接预授权范围无效或与原成员不一致，请保留原文件排查。');
}
function humanRelation(old,row){
  const previous=old&&envelope(old),changed=!old||old.leaderId!==row.leaderId;
  const allowed=changed?[...row.memberIds]:[...new Set([...previous.allowedNodeIds.filter(id=>!old.memberIds.includes(id)||row.memberIds.includes(id)),...row.memberIds])];
  const same=previous&&isDeepStrictEqual(previous.allowedNodeIds,allowed)&&!changed;
  return {...row,envelope:same?previous:{version:1,revision:(previous?.revision||0)+1,allowedNodeIds:allowed}};
}
function invalidateConnectionRequests(record){
  if(!record.connectionOperations)return record;
  const rows=record.connectionOperations.map(op=>{
    if(op.state!=='pending_approval')return op;
    const relation=record.relations.find(row=>row.relationId===op.relationId);
    const affected=!relation?.enabled||relation.leaderId!==op.owner.nodeId||[op.owner.nodeId,op.nodeId].some(id=>{const node=record.nodes.find(n=>n.nodeId===id);return !node||node.removed||node.supersededBy||!node.connected||(record.removedMachines||[]).includes(node.machineId);});
    return affected?{...op,state:'rejected',error:{code:'CONNECTION_REVOKED',message:'原节点或关系已撤销，未授予连接。'}}:op;
  });
  return {...record,connectionOperations:rows};
}
function index(record,version=3){
  if(record.relationsVersion!==version||typeof record.activeRelationId!=='string'||!record.activeRelationId
    ||!Array.isArray(record.relations)||!record.relations.length)
    throw fail('RELATION_STATE','协作关系索引版本或结构无效，请保留原文件排查。');
  const ids=new Set();
  for(const row of record.relations){
    if(!row||typeof row.relationId!=='string'||!row.relationId||ids.has(row.relationId))
      throw fail('RELATION_STATE','协作关系标识缺失或重复，请保留原文件排查。');
    ids.add(row.relationId);projection(row);
    if(version>=2&&typeof row.enabled!=='boolean')throw fail('RELATION_STATE','协作关系启用状态缺失，请保留原文件排查。');
    if(version===3)validateEnvelope(row);
  }
  const selected=record.relations.find(row=>row.relationId===record.activeRelationId);
  if(!selected)throw fail('RELATION_STATE','当前协作关系不在原索引中，请保留原文件排查。');
  if(version>=2&&!selected.enabled)throw fail('RELATION_STATE','旧协作视图不能指向未启用的关系，请保留原文件排查。');
  return selected;
}
function uniqueLeaders(rows,code='RELATION_STATE'){
  const leaders=new Set();
  for(const row of rows)if(row.enabled&&row.leaderId){
    if(leaders.has(row.leaderId))throw fail(code,'同一主 Agent 已有另一条启用的关系，请编辑原关系，不能以另一关系标识重复授权。');
    leaders.add(row.leaderId);
  }
}
function loadRelationState(record){
  for(const key of ['connectionOperations','connectionPolicyOperations'])if(record[key]!==undefined){
    const rows=record[key];
    if(!Array.isArray(rows)||rows.length>4096)throw fail('RELATION_STATE','连接收据记录结构无效，原文件保留。');
    const ids=new Set();
    for(const row of rows){
      const id=key==='connectionOperations'?row?.operationKey:row?.operationId;
      if(!row||typeof id!=='string'||!id||ids.has(id)||typeof row.operationId!=='string'||!row.operationId||!/^[0-9a-f]{64}$/.test(row.fingerprint)||!['confirmed','rejected',...(key==='connectionOperations'?['pending_approval']:[])].includes(row.state))throw fail('RELATION_STATE','原连接收据身份或内容无效，原文件保留。');
      if(key==='connectionOperations'&&(!row.owner?.nodeId||!row.owner.requestId||!row.owner.conversationId||!['connect','disconnect'].includes(row.action)||typeof row.nodeId!=='string'||typeof row.relationId!=='string'||row.state==='pending_approval'&&(!row.approvalId||row.action!=='connect')))throw fail('RELATION_STATE','原连接请求缺少原身份，原文件保留。');
      ids.add(id);
    }
  }
  const current=projection(record.collaboration);
  const fields=['relationsVersion','activeRelationId','relations'];
  if(fields.every(key=>!Object.hasOwn(record,key)))return {...record,relationsVersion:3,activeRelationId:LEGACY_RELATION_ID,
    relations:[{relationId:LEGACY_RELATION_ID,enabled:true,...current,envelope:{version:1,revision:0,allowedNodeIds:[...current.memberIds]}}]};
  const selected=index(record,[1,2].includes(record.relationsVersion)?record.relationsVersion:3);
  // An older writer can retain unknown fields but edit collaboration alone.
  // Never pick either authority silently or overwrite the other relationship rows.
  if(!isDeepStrictEqual(current,projection(selected)))
    throw Object.assign(fail('RELATION_STATE_CONFLICT','旧协作视图与关系索引不一致；可能被旧版程序修改，请保留原文件核对，未覆盖任何关系。'),{diagnostic:relationConflictDiagnostic(record,selected)});
  // Version 1 explicitly made every nonselected row inert. Never turn those
  // stored rows into new grants merely because a newer runtime can route them.
  const migrated=record.relationsVersion===3?record:{...record,relationsVersion:3,relations:record.relations.map(row=>({...row,enabled:record.relationsVersion===1?row.relationId===record.activeRelationId:row.enabled,envelope:{version:1,revision:0,allowedNodeIds:[...row.memberIds]}}))};
  uniqueLeaders(migrated.relations);return migrated;
}
// Deliberately omit identities, operation payloads and native session data.
function relationConflictDiagnostic(record,selected){
  const summary=row=>({revision:row.revision,memberCount:row.memberIds.length});
  const receipts={};
  for(const key of ['relationOperations','nodeOperations','machineOperations']){
    const rows=Array.isArray(record[key])?record[key]:[];
    receipts[key]={confirmed:rows.filter(row=>row?.state==='confirmed').length,
      recentConfirmed:rows.filter(row=>row?.state==='confirmed').slice(-8).map(row=>{
        const value=key==='relationOperations'?row.data:row.data?.collaboration;
        return Number.isSafeInteger(value?.revision)&&Array.isArray(value?.memberIds)?{revision:value.revision,memberCount:value.memberIds.length}:{revision:null,memberCount:null};
      }),
      unresolved:rows.filter(row=>!['confirmed','rejected'].includes(row?.state)).length};
  }
  return {version:1,index:{...summary(selected),selected:true,enabled:selected.enabled===true},
    collaboration:summary(record.collaboration),receipts,recoveryAvailable:false};
}
function syncSelectedRelation(record){
  const selected=index(record),current=projection(record.collaboration);
  const next={...record,relations:record.relations.map(row=>row===selected?humanRelation(row,{...row,...current}):row)};
  uniqueLeaders(next.relations,'INVALID_INPUT');return invalidateConnectionRequests(next);
}
function runtimeRelations(record){
  if(!record.relations)return [{...record.collaboration,enabled:true}]; // Pure legacy view callers.
  return record.relations.map(row=>row.relationId===record.activeRelationId?{...row,...projection(record.collaboration)}:row).filter(row=>row.enabled);
}
function relationForCaller(record,nodeId){
  const rows=runtimeRelations(record);
  return rows.find(row=>row.leaderId===nodeId)||rows.find(row=>row.memberIds.includes(nodeId))||record.collaboration;
}
function putRelation(record,row){
  const rows=record.relations.some(old=>old.relationId===row.relationId)?record.relations.map(old=>old.relationId===row.relationId?row:old):[...record.relations,row];
  uniqueLeaders(rows,'INVALID_INPUT');
  return {...record,relations:rows,...(row.relationId===record.activeRelationId?{collaboration:projection(row)}:{})};
}
function revokeNodes(record,ids){
  const rows=record.relations.map(row=>{
    const leaderRemoved=ids.has(row.leaderId),memberIds=leaderRemoved?[]:row.memberIds.filter(id=>!ids.has(id));
    const old=envelope(row),allowedNodeIds=leaderRemoved?[]:old.allowedNodeIds.filter(id=>!ids.has(id));
    const policyChanged=allowedNodeIds.length!==old.allowedNodeIds.length;
    return !leaderRemoved&&memberIds.length===row.memberIds.length&&!policyChanged?row:{...row,leaderId:leaderRemoved?null:row.leaderId,memberIds,revision:row.revision+1,envelope:{version:1,revision:old.revision+1,allowedNodeIds}};
  });
  return {...record,relations:rows,collaboration:projection(rows.find(row=>row.relationId===record.activeRelationId))};
}
module.exports={loadRelationState,syncSelectedRelation,runtimeRelations,relationForCaller,putRelation,revokeNodes,projection,envelope,humanRelation};
