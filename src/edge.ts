import { WebSocket } from 'ws';
import { setTimeout as delay } from 'node:timers/promises';
import type { EdgeConfig, OpenCodeConfig } from './config.js';
import { BridgeError, type TaskEvent } from './core.js';
import { envelope, wireSchema, type Execution, type WireMessage, type Interaction } from './protocol.js';
import { validateAnswer } from './drivers/forms.js';
import { redactor } from './security.js';
import { EdgeJournal } from './storage/edge-journal.js';
import { MockDriver } from './drivers/mock.js';
import { OpenCodeDriver } from './drivers/opencode.js';
import type { AgentDriver } from './drivers/driver.js';

export interface EdgeHandle {
  journal: EdgeJournal; closed: Promise<void>; connection(): string;
  apply(agents: EdgeConfig['agents']): Promise<void>; close(): Promise<void>;
}
export async function startEdge(config: EdgeConfig, log: (message: string) => void = console.error): Promise<EdgeHandle> {
  const safe = redactor([config.token]);
  const journal = new EdgeJournal(config.dataDir);
  const makeDriver = (c: EdgeConfig['agents'][number]): AgentDriver => c.adapter === 'mock'
    ? new MockDriver(c, id => journal.invoke(id))
    : new OpenCodeDriver(c, id => journal.invoke(id), (id, reference) => journal.bind(id, reference));
  const drivers = new Map(config.agents.map(c => [c.agentId, makeDriver(c)]));
  await Promise.all([...drivers.values()].filter(d => d instanceof OpenCodeDriver).map(d => d.refresh()));
  const url = new URL('/v1/connectors/ws', config.hubUrl); url.protocol = 'ws:';
  let ws: WebSocket | undefined; let ready = false; let stopping = false; let state = 'connecting';
  let connecting = false; let attempts = 0; let retry: NodeJS.Timeout | undefined;
  const timers: { heartbeat?: NodeJS.Timeout } = {}; let flush: Promise<void> | undefined;
  const pending = new Map<string, { resolve(): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
  const jobs = new Set<Promise<void>>(); const observing = new Set<string>();
  const recoveredAt = new Map<string, number>(); const abort = new AbortController();
  let resolveClosed!: () => void; const closed = new Promise<void>(r => { resolveClosed = r; });
  const send = (message: WireMessage) => {
    if (stopping || ws?.readyState !== WebSocket.OPEN) throw new BridgeError('DISCONNECTED', 'Hub connection ended', 503);
    ws.send(JSON.stringify(message));
  };
  const sendConfirmed = (message: WireMessage): Promise<void> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(message.messageId); reject(new BridgeError('ACK_TIMEOUT', 'Hub did not confirm persisted event', 503)); }, 5000);
    pending.set(message.messageId, { resolve, reject, timer });
    try { send(message); } catch (e) { clearTimeout(timer); pending.delete(message.messageId); reject(e); }
  });
  const loseConnection = () => {
    ready = false; state = stopping ? 'stopped' : 'reconnecting';
    for (const wait of pending.values()) { clearTimeout(wait.timer); wait.reject(new BridgeError('DISCONNECTED', 'Hub connection ended', 503)); }
    pending.clear();
  };
  const stop = async () => {
    if (stopping) return closed;
    stopping = true; state = 'stopped'; abort.abort();
    if (timers.heartbeat) clearInterval(timers.heartbeat); if (retry) clearTimeout(retry);
    loseConnection(); ws?.terminate();
    await Promise.allSettled([...jobs]); if (flush) await flush;
    journal.close(); resolveClosed();
  };
  const fatal = (error: unknown) => {
    log(safe((error instanceof BridgeError ? error.code : 'STORAGE_UNAVAILABLE') + ': Edge stopped; execution evidence retained'));
    void stop();
  };
  const track = (job: Promise<void>) => { jobs.add(job); void job.finally(() => jobs.delete(job)); };
  const flushOutbox = (): void => {
    if (flush || !ready || stopping) return;
    flush = (async () => {
      while (ready && !stopping) {
        const next = journal.outbox()[0]; if (!next) break;
        try {
          await sendConfirmed({ ...envelope(), type: 'task.event', taskId: next.taskId, executionId: next.executionId, payload: { seq: next.seq, event: next.event } });
          journal.acknowledge(next.executionId, next.seq);
        } catch (e) {
          if (e instanceof BridgeError && ['DISCONNECTED', 'ACK_TIMEOUT'].includes(e.code)) { ws?.terminate(); break; }
          fatal(e); break;
        }
      }
    })().catch(fatal).finally(() => { flush = undefined; if (ready && !stopping && journal.outbox().length) flushOutbox(); });
  };
  const emit = (execution: Execution, event: TaskEvent) => {
    if (stopping) return;
    journal.record(execution.executionId, event); flushOutbox();
  };
  const uncertain = (execution: Execution, e: unknown) => {
    if (stopping) return;
    const error = e instanceof BridgeError ? e : new BridgeError('NATIVE_OBSERVATION', '原生观察中断，需只读对账', 503);
    const reason = error.code + ': ' + error.message;
    log(safe(reason));
    const last = journal.events(execution.executionId).at(-1);
    if (last?.kind !== 'unknown' || last.reason !== reason) emit(execution, { kind: 'unknown', reason: reason.slice(0, 1000) });
  };
  const recoverExecution = async (executionId: string): Promise<unknown> => {
    const execution = journal.payload(executionId); const record = journal.execution(executionId);
    if (!record || !execution) throw new BridgeError('RECOVERY_IDENTITY', '历史执行缺少可验证的执行快照，保留占位', 409);
    if (record.phase === 'terminal') { flushOutbox(); return { state: 'terminal', reason: '终态已落盘，等待补传确认' }; }
    if (observing.has(executionId)) return { state: 'observing', reason: '正在观察原轮次' };
    const reference = journal.native(executionId); const driver = drivers.get(record.agent_id);
    if (!reference || !(driver instanceof OpenCodeDriver)) throw new BridgeError('RECOVERY_BINDING', '原生绑定缺失，不能重新执行或释放占位', 409);
    await driver.inspect(reference, abort.signal);
    observing.add(executionId); recoveredAt.set(executionId, Date.now());
    track((async () => {
      try { for await (const event of driver.observe(execution, reference, abort.signal, journal.events(executionId), true)) emit(execution, event); }
      catch (e) { try { uncertain(execution, e); } catch (error) { fatal(error); } }
      finally { observing.delete(executionId); }
    })());
    return { state: 'observing', reason: '已核验原会话，恢复只读观察' };
  };
  const recoverAll = () => {
    for (const record of journal.outstanding()) {
      if (observing.has(record.executionId) || Date.now() - (recoveredAt.get(record.executionId) || 0) < 5000) continue;
      recoveredAt.set(record.executionId, Date.now());
      const execution = journal.payload(record.executionId);
      if (!execution) continue; // Historical rows without a complete payload are never replayed as executions.
      if (record.phase === 'prepared' && record.invocations === 0) {
        try { emit(execution, { kind: 'failed', error: { code: 'NOT_INVOKED', message: 'Edge 中断前未调用驱动，请提交新任务', phase: 'before_execution' } }); } catch (e) { fatal(e); }
      } else track(recoverExecution(record.executionId).then(() => {}, e => { try { uncertain(execution, e); } catch (error) { fatal(error); } }));
    }
  };
  const execute = async (execution: Execution, submitId: string) => {
    try {
      const driver = drivers.get(execution.targetAgent);
      if (!driver) throw new BridgeError('AGENT_NOT_FOUND', 'Task targets an unknown local Agent', 404);
      const busy = journal.busy(execution.targetAgent, driver.descriptor.resourceKey);
      if (!journal.claim(execution, driver.descriptor.resourceKey)) {
        send({ ...envelope(), type: 'message.ack', payload: { ackedMessageId: submitId } }); flushOutbox(); return;
      }
      send({ ...envelope(), type: 'message.ack', payload: { ackedMessageId: submitId } });
      observing.add(execution.executionId); emit(execution, { kind: 'accepted' });
      if (execution.configFingerprint && execution.configFingerprint !== driver.descriptor.configFingerprint) {
        emit(execution, { kind: 'failed', error: { code: 'CONFIG_NOT_APPLIED', message: 'Execution configuration changed before admission', phase: 'before_execution' } }); return;
      }
      if (!driver.health() || driver.descriptor.enabled === false || busy) {
        emit(execution, { kind: 'failed', error: { code: 'LOCAL_UNAVAILABLE', message: 'Local Agent is unhealthy or busy', phase: 'before_execution' } }); return;
      }
      for await (const event of driver.execute(execution, abort.signal)) emit(execution, event);
    } catch (e) {
      try {
        const record = journal.execution(execution.executionId);
        if (record?.phase === 'prepared' && e instanceof BridgeError) emit(execution, { kind: 'failed', error: { code: 'NOT_INVOKED', message: e.message, phase: 'before_execution' } });
        else if (record) uncertain(execution, e); else fatal(e);
      }
      catch (error) { fatal(error); }
    } finally { observing.delete(execution.executionId); }
  };
  const interact = async (input: Interaction): Promise<unknown> => {
    const execution = journal.execution(input.executionId);
    if (!execution || execution.task_id !== input.taskId) throw new BridgeError('NATIVE_BINDING', 'Execution identity does not match', 409);
    if (!['pending', 'reconcile'].includes(input.action) && journal.operations.get(input.operationId)) return journal.operations.claim(input).operation;
    if (input.action === 'reconcile') return recoverExecution(input.executionId);
    const reference = journal.native(input.executionId); const driver = drivers.get(execution.agent_id);
    if (!reference || !(driver instanceof OpenCodeDriver)) throw new BridgeError('NATIVE_BINDING', 'Task has no local native binding', 409);
    const evidence = await driver.inspect(reference);
    if (input.action === 'cancel') {
      if (input.requestId || input.answer || input.decision) throw new BridgeError('INVALID_INPUT', '取消不能包含等待回复字段');
      if (evidence.hasLaterInput) throw new BridgeError('STALE_TASK', '原会话已进入下一轮，不可中断后续轮次', 409);
      const claim = journal.operations.claim(input); if (!claim.fresh) return claim.operation;
      if (evidence.outcome) return journal.operations.finish(input.operationId, 'confirmed', { interrupted: false, effect: evidence.outcome });
      try {
        const receipt = await driver.client.interrupt(reference.sessionId);
        if (typeof receipt?.interrupted !== 'boolean') throw new BridgeError('NATIVE_CONTRACT', '原生取消收据无效', 503);
        return journal.operations.finish(input.operationId, 'confirmed', { interrupted: receipt.interrupted, effect: 'awaiting_native_evidence' });
      } catch { return journal.operations.finish(input.operationId, 'unknown', { effect: 'query_original_turn_only' }); }
    }
    if (execution.phase !== 'invoked' || evidence.outcome || evidence.hasLaterInput) throw new BridgeError('STALE_TASK', '原轮次已停止等待', 409);
    const requests = evidence.waiting;
    if (input.action === 'pending') return requests;
    if (!input.requestId) throw new BridgeError('INVALID_INPUT', 'Native request ID required');
    if (input.action === 'permission') {
      if (!requests.permissions.some(p => p.id === input.requestId) || !input.decision || input.answer) throw new BridgeError('STALE_REQUEST', 'Permission is not pending or reply fields are invalid', 409);
    } else {
      const form = requests.forms.find(f => f.id === input.requestId);
      if (!form || !input.answer || input.decision) throw new BridgeError('STALE_REQUEST', 'Form is not pending or reply fields are invalid', 409);
      validateAnswer(form.fields, input.answer);
    }
    const claim = journal.operations.claim(input); if (!claim.fresh) return claim.operation;
    try {
      await driver.client.reply(reference.sessionId, input.action, input.requestId, {decision:input.decision,answer:input.answer});
      return journal.operations.finish(input.operationId, 'confirmed');
    } catch { return journal.operations.finish(input.operationId, 'unknown'); }
  };
  const connect = async () => {
    if (stopping || connecting) return;
    connecting = true;
    const socket = new WebSocket(url, { headers: { authorization: 'Bearer ' + config.token, 'x-connector-id': config.connectorId }, maxPayload: 1048576, perMessageDeflate: false, handshakeTimeout: 5000, followRedirects: false });
    ws = socket;
    socket.on('message', (data, binary) => {
      try {
        if (binary) throw new BridgeError('INVALID_PROTOCOL', 'Binary frames are not supported');
        const message = wireSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data as Buffer)));
        if (message.type === 'message.ack' || message.type === 'protocol.error') {
          const id = message.type === 'message.ack' ? message.payload.ackedMessageId : message.payload.correlationId;
          const wait = id ? pending.get(id) : undefined;
          if (wait) { pending.delete(id!); clearTimeout(wait.timer); if (message.type === 'message.ack') wait.resolve(); else wait.reject(new BridgeError(message.payload.code, message.payload.message, 409)); }
        } else if (message.type === 'task.submit') track(execute(message.payload, message.messageId));
        else if (message.type === 'interaction.request') track((async () => {
          let payload: Extract<WireMessage, { type: 'interaction.result' }>['payload'];
          try { payload = { data: await interact(message.payload) }; }
          catch (e) { const error = e instanceof BridgeError ? e : new BridgeError('NATIVE_CONTRACT', 'Invalid native response', 503); payload = { error: { code: error.code, message: error.message, status: error.httpStatus } }; }
          try { send({ ...envelope(), type: 'interaction.result', correlationId: message.messageId, payload }); } catch { /* Durable write receipt remains queryable; never retry mutation. */ }
        })());
        else throw new BridgeError('INVALID_DIRECTION', 'Unexpected message from Hub');
      } catch { log('INVALID_PROTOCOL: Hub frame rejected'); socket.terminate(); }
    });
    socket.on('error', () => {});
    socket.on('close', () => { if (ws === socket) { loseConnection(); if (!stopping) schedule(); } });
    try {
      await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); socket.once('close', () => reject(new BridgeError('CONNECTION_FAILED', 'Hub connection failed', 503))); });
      await sendConfirmed({ ...envelope(), type: 'agent.register', payload: { device: config.device, agents: [...drivers.values()].map(d => ({ ...d.descriptor, healthy: d.health() })) } });
      ready = true; state = 'online'; attempts = 0; flushOutbox(); recoverAll();
    } catch { socket.terminate(); }
    finally { connecting = false; if (!ready && !stopping) schedule(); }
  };
  const schedule = () => {
    if (retry || stopping) return;
    state = 'reconnecting'; const wait = Math.min(2000, 250 * 2 ** Math.min(attempts++, 4));
    retry = setTimeout(() => { retry = undefined; void connect(); }, wait);
  };
  await connect();
  const deadline = Date.now() + 10000;
  while (!ready && !stopping && Date.now() < deadline) await delay(50);
  if (!ready) { await stop(); throw new BridgeError('CONNECTION_FAILED', 'Hub connection or authentication failed', 503); }
  timers.heartbeat = setInterval(() => {
    if (!ready) return;
    try { send({ ...envelope(), type: 'agent.heartbeat', payload: { agents: [...drivers.values()].map(d => ({ agentId: d.descriptor.agentId, healthy: d.health(), selectedModel: d.descriptor.selectedModel, modelCheckedAt: d.descriptor.modelCheckedAt })) } }); flushOutbox(); recoverAll(); }
    catch (e) { if (e instanceof BridgeError && e.code === 'DISCONNECTED') ws?.terminate(); else fatal(e); }
  }, config.heartbeatMs);
  log(safe('Edge ready pid=' + process.pid + ' connector=' + config.connectorId + ' device=' + config.device));
  return { journal, closed, connection: () => state, close: stop, async apply(agents) {
    for (const c of agents) {
      const previous = drivers.get(c.agentId);
      if (previous instanceof OpenCodeDriver && journal.busy(c.agentId)) { Object.assign(previous.descriptor, { name: c.name, enabled: (c as OpenCodeConfig).enabled }); continue; }
      const driver = makeDriver(c); if (driver instanceof OpenCodeDriver) await driver.refresh(); drivers.set(c.agentId, driver);
    }
    config.agents = agents;
    if (ready) await sendConfirmed({ ...envelope(), type: 'agent.update', payload: { agents: [...drivers.values()].map(d => ({ ...d.descriptor, healthy: d.health() })) } });
  } };
}
