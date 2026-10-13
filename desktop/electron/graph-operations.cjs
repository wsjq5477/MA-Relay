const fs=require('node:fs'),path=require('node:path');
const {atomicWrite,digest,operationId}=require('./graph-layout.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const lane=method=>['manageNode','nodeOperation'].includes(method)?'node':method==='saveCollaboration'||method==='collaborationOperation'?'relation':'layout';
const query=kind=>kind==='node'?'nodeOperation':kind==='relation'?'collaborationOperation':'graphLayoutOperation';
const rejected=new Set(['INVALID_INPUT','NODE_NOT_FOUND','NODE_DISCONNECTED','REVISION_CONFLICT','LAYOUT_REVISION_CONFLICT','OPERATION_CONFLICT','OPERATION_LIMIT','AGENT_BUSY','MACHINE_OFFLINE','WRONG_MACHINE','AGENT_UNAVAILABLE','DISCOVERY_CHANGED']);
class GraphOperationJournal{
  constructor(directory){this.file=path.join(directory,'graph-pending.json');}
  read(){if(!fs.existsSync(this.file))return [];const rows=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(rows))throw fail('GRAPH_JOURNAL_INVALID','图操作台账无法读取，请保留记录排查。');return rows;}
  pending(){return this.read().filter(r=>r.state==='pending'||r.state==='unknown');}
  update(row){const rows=this.read(),i=rows.findIndex(r=>r.lane===row.lane&&r.operationId===row.operationId);if(i<0)rows.push(row);else rows[i]=row;atomicWrite(this.file,rows);}
  async lookup(method,params,dispatch){
    operationId(params.operationId);const receipt=await dispatch(method,params);
    const row=this.read().find(r=>r.lane===lane(method)&&r.operationId===params.operationId);
    if(row&&receipt.state==='confirmed'){row.state='confirmed';this.update(row);}
    return method==='nodeOperation'&&row?.state==='rejected'?{operationId:row.operationId,state:'rejected',error:row.error}:receipt;
  }
  async recover(dispatch){for(const r of this.pending())await this.lookup(query(r.lane),{operationId:r.operationId},dispatch);}
  async save(method,params,dispatch){
    operationId(params.operationId);const kind=lane(method),fingerprint=digest(params);
    const fields=kind==='node'?['operationId','nodeId','machineId','action']:kind==='relation'?['operationId','expectedRevision','leaderId','memberIds']:['operationId','expectedLayoutRevision','layout'];
    if(Object.keys(params).some(k=>!fields.includes(k)))throw fail('INVALID_INPUT','图保存请求包含不支持的字段。');
    await this.recover(dispatch);
    const rows=this.read(),prior=rows.find(r=>r.lane===kind&&r.operationId===params.operationId);
    if(prior&&prior.fingerprint!==fingerprint)throw fail('OPERATION_CONFLICT','原图操作 ID 已用于其他内容，请查询原操作。');
    if(prior&&(prior.state==='pending'||prior.state==='unknown'))return this.lookup(query(kind),{operationId:params.operationId},dispatch);
    if(rows.some(r=>(r.lane===kind||kind==='node'&&r.lane==='relation'||kind==='relation'&&r.lane==='node')&&(r.state==='pending'||r.state==='unknown')))throw fail('GRAPH_UNCONFIRMED','原图保存尚未确认，请查询原操作，不能换 ID 再保存。');
    if(prior?.state==='confirmed')return this.lookup(query(kind),{operationId:params.operationId},dispatch);
    const row={operationId:params.operationId,lane:kind,params,fingerprint,state:'pending',time:new Date().toISOString()};
    try{this.update(row);}catch{throw fail('GRAPH_INTENT_FAILED','保存未发送：图操作意图无法落盘，请检查磁盘。');}
    try{const receipt=await dispatch(method,params);row.state=receipt.state==='confirmed'?'confirmed':'unknown';this.update(row);return receipt;}
    catch(error){row.state=rejected.has(error.code)?'rejected':'unknown';row.error={code:error.code,message:error.message};try{this.update(row);}catch{/* Original pending intent stays durable. */}throw error;}
  }
}
module.exports={GraphOperationJournal};
