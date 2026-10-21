const fs = require('node:fs');
const path = require('node:path');
const {atomicWrite: write} = require('./graph-layout.cjs');
const {client} = require('./dsh-connection.cjs');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
// Correlate the original durable user message and its owning turn. An idle
// Agent or an old successful turn cannot settle a newly submitted request.
function outcome(records, requestId, afterSeq) {
  let turn, matched = false, answer = '', reason;
  for (const event of records) {
    if (!Number.isSafeInteger(event.seq) || event.seq <= afterSeq) continue;
    if (event.type === 'turn/start' && !matched) turn = event.data?.turn;
    if (event.type === 'user/message' && event.data?.source?.rpcId === requestId) matched = true;
    if (matched && event.type === 'assistant/message' && event.data?.turn === turn) answer = (event.data.message?.content || []).filter(p => p.type === 'text').map(p => p.text).join('');
    if (matched && turn !== undefined && event.type === 'turn/end' && event.data?.turn === turn) { reason = event.data.reason?.kind; break; }
  }
  return {matched, answer, reason};
}
async function history(c, sessionId, afterSeq) {
  const snapshot = await c.rpc('session/projections', {sessionId});
  if (snapshot?.kind !== 'sequenced' || !Number.isSafeInteger(snapshot.asOfSeq)) throw Error('DSH 会话投影不兼容，原请求保留。');
  let beforeSeq, records = [], bytes = 0;
  for (let page = 0; page < 64; page++) {
    const value = await c.rpc('session/page', {address: {kind: 'session', sessionId}, throughSeq: snapshot.asOfSeq, maxMessages: 100, ...(beforeSeq === undefined ? {} : {beforeSeq})});
    if (!Array.isArray(value?.records)) throw Error('DSH 历史接口不兼容，原请求保留。');
    const rows = value.records.map(row => {
      if (row?.type !== 'event' || !row.event || typeof row.event.type !== 'string') throw Error('DSH 历史事件封装不兼容。');
      return row.event;
    });
    if (rows.some(r => !Number.isSafeInteger(r.seq))) throw Error('DSH 历史序号无效。');
    bytes += Buffer.byteLength(JSON.stringify(rows));
    if (bytes > 8 * 1024 * 1024) throw Error('DSH 原轮次核对超过 8 MiB，保留待核对。');
    records = [...rows, ...records];
    if (!value.hasMore || rows[0]?.seq <= afterSeq) return records;
    const next = rows[0]?.seq;
    if (!next || (beforeSeq !== undefined && next >= beforeSeq)) throw Error('DSH 历史游标未前进。');
    beforeSeq = next;
  }
  throw Error('DSH 原轮次核对超过分页上限，保留待核对。');
}
async function run(directory, {observe = false} = {}) {
  const job = read(path.join(directory, 'job.json'));
  const emit = event => fs.appendFileSync(path.join(directory, 'events.jsonl'), JSON.stringify(event) + '\n', {mode: 0o600});
  const beat = () => write(path.join(directory, 'heartbeat.json'), {time: new Date().toISOString(), pid: process.pid});
  beat(); const heartbeat = setInterval(beat, 1000);
  let attempted = observe, binding;
  try {
    const c = await client(job.executable, job.origin);
    if (observe) binding = read(path.join(directory, 'binding.json'));
    else {
      let sessionId = job.sessionId;
      if (!sessionId) {
        const value = await c.rpc('session/create', {cwd: job.workspace});
        sessionId = value?.sessionId;
      }
      if (typeof sessionId !== 'string' || !sessionId.trim()) throw Error('DSH 未返回有效 Session。');
      emit({kind: 'native', sessionId});
      const baseline = await c.rpc('session/projections', {sessionId});
      if (baseline?.kind !== 'sequenced' || !Number.isSafeInteger(baseline.asOfSeq)) throw Error('DSH 缺少原会话事件边界，需求未发送。');
      binding = {sessionId, afterSeq: baseline.asOfSeq, requestId: job.requestId};
      write(path.join(directory, 'binding.json'), binding);
      // Persist the dispatch boundary before the one and only prompt call.
      write(path.join(directory, 'attempted.json'), {requestId: job.requestId}); attempted = true;
      const accepted = await c.rpc('session/prompt', {sessionId, requestId: job.requestId, mode: 'queue', content: [{type: 'text', text: job.message}]});
      if (accepted?.accepted !== true) throw Error('DSH 未确认原请求的接收。');
      emit({kind: 'started'});
    }
    if (binding.requestId !== job.requestId || (job.sessionId && binding.sessionId !== job.sessionId)) throw Error('DSH 原请求或会话绑定不匹配。');
    let previous = '';
    for (;;) {
      const result = outcome(await history(c, binding.sessionId, binding.afterSeq), job.requestId, binding.afterSeq);
      if (result.answer !== previous) { previous = result.answer; if (previous.length > 200000) throw Error('DSH 回答超过保留长度上限，保留原请求待核对。'); emit({kind: 'output', text: previous}); }
      if (result.reason) {
        const status = result.reason === 'completed' ? 'succeeded' : result.reason === 'aborted' ? 'cancelled' : 'failed';
        emit({kind: 'terminal', status, text: status === 'succeeded' ? result.answer : 'DSH 原轮次终态：' + result.reason}); return;
      }
      // Never cancel another queued/UI turn. Cancel only after this exact
      // request has entered its owning turn, and issue at most one native call.
      if (!observe && result.matched && fs.existsSync(path.join(directory, 'cancel.json')) && !fs.existsSync(path.join(directory, 'cancel-attempted.json'))) {
        write(path.join(directory, 'cancel-attempted.json'), {requestId: job.requestId});
        await c.rpc('session/cancel', {sessionId: binding.sessionId});
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  } catch (error) {
    // No generic network error establishes that a prompt or cancel was not
    // admitted. Read-only reconcile observes this binding without replay.
    emit({kind: attempted ? 'unknown' : 'terminal', ...(attempted ? {} : {status: 'failed'}), text: attempted ? 'DSH 原执行待核对；请查询原任务。连接恢复后可核对原轮次，需求不会重发。' : 'DSH 准备失败，需求未发送：' + error.message});
  } finally { clearInterval(heartbeat); }
}
module.exports = {run, outcome, history};
