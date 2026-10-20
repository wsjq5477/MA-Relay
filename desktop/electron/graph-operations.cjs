const fs=require('node:fs'),path=require('node:path');
const {atomicWrite,digest,operationId}=require('./graph-layout.cjs');
const {isCollaborationCapabilityRejection}=require('./builtin-adapters.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const {isOpenCodeVersionRejection}=require('./tool-discovery.cjs');
const machineMethods=new Set(['machine.updateSsh','machine.remove','machine.restore','machine.disconnect','machine.reconnect','machine.operation','machine.maintainDaemon']);
const lane=method=>machineMethods.has(method)?'machine':['manageNode','nodeOperation'].includes(method)?'node':method==='saveCollaboration'||method==='collaborationOperation'?'relation':'layout';
const query=kind=>kind==='machine'?'machine.operation':kind==='node'?'nodeOperation':kind==='relation'?'collaborationOperation':'graphLayoutOperation';
const rejected=new Set(['INVALID_INPUT','NODE_NOT_FOUND','NODE_DISCONNECTED','REVISION_CONFLICT','LAYOUT_REVISION_CONFLICT','OPERATION_CONFLICT','OPERATION_LIMIT','AGENT_BUSY','MACHINE_OFFLINE','WRONG_MACHINE','AGENT_UNAVAILABLE','DISCOVERY_CHANGED','MACHINE_BUSY','MACHINE_REMOVED','MACHINE_NOT_FOUND','SSH_CONNECTION_NOT_FOUND','SSH_USER_CHANGE','SSH_ENDPOINT_CONFLICT','DESKTOP_UNCONFIRMED','INSTALL_PREVIEW_CHANGED','DAEMON_BUSY','DAEMON_STAGE_REJECTED','SSH_UPLOAD_FAILED','DAEMON_PERSIST_FAILED','SSH_PACKAGE_CHECKSUM','SSH_PACKAGE_EXTRACT']);
function conflicts(kind,params,row){
 if(kind==='layout'||row.lane==='layout')return kind===row.lane;
 if(kind==='relation'||row.lane==='relation')return true;
 if(typeof params.machineId==='string'&&params.machineId&&typeof row.params?.machineId==='string'&&row.params.machineId)return params.machineId===row.params.machineId;
 if(params.connectionId&&row.params?.connectionId)return params.connectionId===row.params.connectionId;
 return true;
}
class GraphOperationJournal{
  constructor(directory){this.file=path.join(directory,'graph-pending.json');}
  read(){if(!fs.existsSync(this.file))return [];const rows=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(rows))throw fail('GRAPH_JOURNAL_INVALID','图操作台账无法读取，请保留记录排查。');return rows;}
  pending(){return this.read().filter(r=>r.state==='pending'||r.state==='unknown');}
  update(row){const rows=this.read(),i=rows.findIndex(r=>r.lane===row.lane&&r.operationId===row.operationId);if(i<0)rows.push(row);else rows[i]=row;atomicWrite(this.file,rows);}
  async lookup(method,params,dispatch){
    operationId(params.operationId);const receipt=await dispatch(method,params);
    const row=this.read().find(r=>r.lane===lane(method)&&r.operationId===params.operationId);
    if(row&&receipt?.operationId===params.operationId&&['confirmed','rejected'].includes(receipt.state)){row.state=receipt.state;if(receipt.error)row.error=receipt.error;this.update(row);}
    const savedRejection=['nodeOperation','machine.operation'].includes(method)||method==='collaborationOperation'&&row?.error?.code==='COLLABORATION_CAPABILITY';
    return savedRejection&&row?.state==='rejected'?{operationId:row.operationId,state:'rejected',error:row.error}:receipt;
  }
  async recover(dispatch){for(const r of this.pending())try{await this.lookup(query(r.lane),{operationId:r.operationId},dispatch);}catch{/* Keep the original unknown; its scope decides whether new work conflicts. */}}
  async save(method,params,dispatch){
    operationId(params.operationId);const kind=lane(method),fingerprint=digest(params);
    const fields=kind==='machine'?['operationId','machineId','connectionId','expectedRevision','config']:kind==='node'?['operationId','nodeId','machineId','action']:kind==='relation'?['operationId','expectedRevision','leaderId','memberIds']:['operationId','expectedLayoutRevision','layout'];
    if(Object.keys(params).some(k=>!fields.includes(k)))throw fail('INVALID_INPUT','图保存请求包含不支持的字段。');
    await this.recover(dispatch);
    const rows=this.read(),prior=rows.find(r=>r.lane===kind&&r.operationId===params.operationId);
    if(prior&&prior.fingerprint!==fingerprint)throw fail('OPERATION_CONFLICT','原图操作 ID 已用于其他内容，请查询原操作。');
    if(prior&&(prior.state==='pending'||prior.state==='unknown'))return this.lookup(query(kind),{operationId:params.operationId},dispatch);
    if(rows.some(r=>conflicts(kind,params,r)&&(r.state==='pending'||r.state==='unknown')))throw fail('GRAPH_UNCONFIRMED','原图保存尚未确认，请查询原操作，不能换 ID 再保存。');
    if(prior?.state==='rejected')throw fail(prior.error.code,prior.error.message);
    if(prior?.state==='confirmed')return this.lookup(query(kind),{operationId:params.operationId},dispatch);
    const row={operationId:params.operationId,lane:kind,method,params,fingerprint,state:'pending',time:new Date().toISOString()};
    try{this.update(row);}catch{throw fail('GRAPH_INTENT_FAILED','保存未发送：图操作意图无法落盘，请检查磁盘。');}
    try{const receipt=await dispatch(method,params);row.state=receipt?.operationId===params.operationId&&['confirmed','rejected'].includes(receipt.state)?receipt.state:'unknown';if(receipt?.error)row.error=receipt.error;this.update(row);return receipt;}
    catch(error){row.state=isOpenCodeVersionRejection(error)||rejected.has(error.code)||method==='saveCollaboration'&&isCollaborationCapabilityRejection(error)?'rejected':'unknown';row.error={code:error.code,message:error.message,...(['SSH_UPLOAD_FAILED','DAEMON_PERSIST_FAILED'].includes(error.code)&&error.details?{details:error.details}:{})};try{this.update(row);}catch{/* Original pending intent stays durable. */}throw error;}
  }
}
module.exports={GraphOperationJournal};
