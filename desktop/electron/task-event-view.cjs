const fail=(code,message)=>Object.assign(new Error(message),{code});
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
function clipped(value,limit=32768){
  if(typeof value!=='string')return undefined;
  const bytes=Buffer.from(value);
  if(bytes.length<=limit)return {text:value,truncated:false};
  let end=limit;while(end>0&&(bytes[end]&0xc0)===0x80)end--;
  return {text:bytes.subarray(0,end).toString('utf8'),truncated:true};
}
function errorView(error){
  if(!plain(error))return undefined;
  return {...(typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.code)?{code:error.code}:{}),
    ...(clipped(error.message)?{message:clipped(error.message).text,messageTruncated:clipped(error.message).truncated}:{}),
    ...(['before_execution','execution'].includes(error.phase)?{phase:error.phase}:{})};
}
function eventView(row){
  const event=plain(row.event)?row.event:{},kind=typeof event.kind==='string'?event.kind:'unmapped';
  const safeKind=['accepted','started','progress','output','native','waiting','completed','failed','cancelled','unknown','reconciled','tool'].includes(kind)?kind:'unmapped';
  const projected={kind:safeKind==='native'?'binding-observed':safeKind};
  // Native identity/configuration events are existence evidence only. Never
  // return the raw binding, command, URL, credentials, tools or control payload.
  // Progress may contain native command/tool arguments flattened into text.
  // Expose its original sequence and kind, but keep those diagnostics private.
  if(kind==='progress')projected.detailsOmitted=true;
  if(['output','cancelled','unknown'].includes(kind)){
    const value=clipped(event.text===undefined?event.reason:event.text);
    if(value)Object.assign(projected,{text:value.text,truncated:value.truncated});
  }
  if(kind==='waiting'&&plain(event.waiting)){
    projected.waiting={...(['permission','input'].includes(event.waiting.kind)?{kind:event.waiting.kind}:{}),
      ...(clipped(event.waiting.summary)?{summary:clipped(event.waiting.summary).text,summaryTruncated:clipped(event.waiting.summary).truncated}:{})};
  }
  if(kind==='failed')projected.error=errorView(event.error);
  if(kind==='completed'&&plain(event.result)){
    const value=clipped(event.result.message);
    if(value)projected.result={message:value.text,truncated:value.truncated||event.result.truncated===true};
  }
  return {seq:row.seq,...(typeof row.timestamp==='string'&&row.timestamp.length<=64&&Number.isFinite(Date.parse(row.timestamp))?{timestamp:row.timestamp}:{}),event:projected,truncated:row.truncated===true};
}
function validateCursor(args){
  if(args.afterSeq===undefined){if(args.limit!==undefined)throw fail('TASK_EVENT_CURSOR','limit需要明确的原事件afterSeq。');return false;}
  if(!Number.isSafeInteger(args.afterSeq)||args.afterSeq<0||args.limit!==undefined&&(!Number.isSafeInteger(args.limit)||args.limit<1||args.limit>100))
    throw fail('TASK_EVENT_CURSOR','afterSeq须为非负整数，limit须为1至100。');
  return true;
}
function taskEventView(task,args){
  if(!validateCursor(args))throw fail('TASK_EVENT_CURSOR','读取原事件需要明确afterSeq。');
  const after=args.afterSeq,limit=args.limit||50;
  if(!Array.isArray(task.events))return {schema:1,supported:false,source:'original-task-events',reason:'backend-events-unavailable',taskId:task.taskId,afterSeq:after,cursor:after,items:[],hasMore:false};
  if(task.lastSeq!==undefined&&(!Number.isSafeInteger(task.lastSeq)||task.lastSeq<0))throw fail('TASK_EVENT_STATE','原事件上限无效。');
  let previous=0;
  for(const row of task.events){
    if(!plain(row)||!Number.isSafeInteger(row.seq)||row.seq<=previous||!plain(row.event))throw fail('TASK_EVENT_STATE','原事件序列无效；不补造游标或重跑任务。');
    previous=row.seq;
  }
  const last=Number.isSafeInteger(task.lastSeq)&&task.lastSeq>=previous?task.lastSeq:previous;
  if(Number.isSafeInteger(task.lastSeq)&&task.lastSeq<previous)throw fail('TASK_EVENT_STATE','原事件上限与序列不匹配。');
  if(after>last)throw fail('TASK_EVENT_CURSOR','游标超过原任务事件上限，请保留原Task查询，不能换任务续接。');
  const available=task.events.filter(row=>row.seq>after),items=[];let bytes=0,cursor=after,gap=false;
  for(const row of available){
    const item=eventView(row),size=Buffer.byteLength(JSON.stringify(item));
    if(items.length>=limit||items.length&&bytes+size>131072)break;
    if(row.seq!==cursor+1)gap=true;
    items.push(item);bytes+=size;cursor=row.seq;
  }
  const hasMore=available.some(row=>row.seq>cursor);
  if(!hasMore&&cursor<last)gap=true;
  return {schema:1,supported:true,source:'original-task-events',taskId:task.taskId,afterSeq:after,cursor,highestObservedSeq:last,
    items,hasMore,cursorGap:gap,detailsTruncated:task.detailsTruncated===true||items.some(row=>row.truncated||row.event.truncated||row.event.result?.truncated||row.event.error?.messageTruncated||row.event.waiting?.summaryTruncated)};
}
module.exports={taskEventView,validateCursor};
