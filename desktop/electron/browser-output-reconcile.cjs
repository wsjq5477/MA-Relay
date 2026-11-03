'use strict';
// A job for the existing Host/control receipt and original authenticated channel.
// Its only remote command reads original output; it never submits a message.
async function reconcileOutput(host,{taskId,operationId}){
 const state=host.store.read(),task=state.tasks.find(t=>t.taskId===taskId),operation=state.operations.find(o=>o.operationId===operationId);
 if(!task||!operation||operation.kind!=='reconcile'||operation.taskId!==task.taskId)throw Object.assign(Error('Original reconciliation receipt is required.'),{code:'OPERATION_CONFLICT'});
 const integrityLost=task.status==='unknown'&&task.phase==='submitted'&&!!task.binding&&task.events.some(e=>e.event.kind==='unknown'&&e.event.reason==='BROWSER_USER_INTERFERENCE');
 const result=await host.channel.request('output.subscribe',{...host.metadata(task),...(integrityLost?{observeTerminal:'integrity-failure-v1',message:{type:'text',text:task.message}}:{})});
 if(!result||result.requestId!==task.requestId||result.executionId!==task.executionId||result.bridgeSessionId!==task.conversationId)throw Object.assign(Error('Original output receipt does not match.'),{code:'RECEIPT_MISMATCH'});
 if(integrityLost&&result.integrityObservationSupported!==true)throw Object.assign(Error('Original extension does not support this read-only observation.'),{code:'BROWSER_ORIGINAL_OBSERVATION_UNSUPPORTED'});
 return result;
}
module.exports={reconcileOutput};
