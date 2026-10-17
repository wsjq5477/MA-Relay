// Only the authenticated SSH reader can mint live evidence. Remote/native JSON
// and errors with the same public code cannot impersonate this capability.
const evidence=new WeakMap();
const marker='original daemon rejection verified';
function rejectedError(connection,record,params){
 const identity=connection.identity;
 if(connection.stage!=='online'||!connection.daemonId||connection.machineId!=='ssh-'+connection.daemonId
  ||identity?.machineId!==connection.machineId||identity.daemonId!==connection.daemonId
  ||!identity.profileId||identity.protocolVersion!==2
  ||record?.key!==params.requestId||record.method!=='ipc'||record.state!=='rejected'
  ||!['submit','continue'].includes(record.op)||record.error?.code!=='NOT_CONFIGURED'
  ||!/^([a-f0-9]{64})$/.test(record.fingerprint||'')||!record.target||record.result!==undefined
  ||record.target.taskId||record.target.executionId)return null;
 const proof={version:1,source:'daemon.receiptRead',machineId:connection.machineId,daemonId:connection.daemonId,
  profileId:identity.profileId,requestId:record.key,op:record.op,fingerprint:record.fingerprint,target:structuredClone(record.target),code:'NOT_CONFIGURED'};
 const error=Object.assign(Error('原请求已由原机器后台持久拒绝，未执行需求；请修复配置后新建请求。'),{code:'DAEMON_REQUEST_REJECTED'});
 evidence.set(error,proof);return error;
}
const rejectionProof=error=>evidence.has(error)?structuredClone(evidence.get(error)):null;
module.exports={rejectedError,rejectionProof,marker};
