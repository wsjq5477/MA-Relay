const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { launch } = require('./dsh-next-runtime.cjs');
const { argumentsFor, validIdentity } = require('./native-cli-protocols.cjs');

const frameLimit = 4 * 1024 * 1024;
const answerLimit = 200000;
const setupTimeout = 45000;

function protocolError(code, message) {
  return Object.assign(new Error(message), { code });
}

function acpConnection(child, onUpdate) {
  let nextId = 0, buffer = '', failure;
  const pending = new Map();
  function disconnect(error) {
    if (failure) return;
    failure = error;
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  }
  const closed = new Promise(resolve => child.once('close', () => {
    disconnect(protocolError('DSH_ACP_DISCONNECTED', 'DSH ACP 通道已关闭。'));
    resolve();
  }));
  child.once('error', () => disconnect(protocolError('NATIVE_START', 'DSH ACP 进程未能启动。')));
  child.stdin.on('error', () => disconnect(protocolError('DSH_ACP_DISCONNECTED', 'DSH ACP 输入通道已关闭。')));
  child.stderr.resume();
  function send(value) {
    if (failure) throw failure;
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...value }) + '\n');
  }
  function receive(line) {
    const message = JSON.parse(line);
    if (message?.jsonrpc !== '2.0') throw Error('Invalid ACP frame');
    if (typeof message.method === 'string') {
      if (Object.hasOwn(message, 'id')) {
        // ACP may request a decision. Decline unless a future adapter
        // explicitly supports forwarding this permission to the user.
        if (message.method === 'session/request_permission') {
          send({ id: message.id, result: { outcome: { outcome: 'cancelled' } } });
        } else {
          send({ id: message.id, error: { code: -32601, message: 'Method not supported' } });
        }
      } else if (message.method === 'session/update') {
        onUpdate(message.params);
      }
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    if (Object.hasOwn(message, 'result') === Object.hasOwn(message, 'error')) throw Error('Invalid ACP response');
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) {
      const error = protocolError('DSH_ACP_REJECTED', 'DSH 原生 ACP 拒绝了 ' + entry.method + '。');
      error.nativeMessage = typeof message.error.message === 'string' ? message.error.message : '';
      entry.reject(error);
    } else {
      entry.resolve(message.result);
    }
  }
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    if (failure) return;
    buffer += chunk;
    try {
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (Buffer.byteLength(line) > frameLimit) throw Error('Oversized ACP frame');
        if (line.trim()) receive(line);
      }
      if (Buffer.byteLength(buffer) > frameLimit) throw Error('Oversized ACP frame');
    } catch {
      disconnect(protocolError('DSH_ACP_PROTOCOL', 'DSH ACP 返回了无效或超限的消息。'));
    }
  });
  return {
    call(method, params, timeout = setupTimeout) {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = timeout ? setTimeout(() => {
          pending.delete(id);
          reject(protocolError('DSH_ACP_TIMEOUT', 'DSH ACP 未在时限内回复 ' + method + '。'));
        }, timeout) : undefined;
        pending.set(id, { method, resolve, reject, timer });
        try { send({ id, method, params }); } catch (error) {
          pending.delete(id);
          clearTimeout(timer);
          reject(error);
        }
      });
    },
    cancel(sessionId) {
      send({ method: 'session/cancel', params: { sessionId } });
    },
    disconnect,
    async close() {
      child.stdin.end();
      const force = setTimeout(() => child.kill(), 5000);
      try { await closed; } finally { clearTimeout(force); }
    },
  };
}

async function run(job, directory, { write, safe, launchNative = launch }) {
  const emit = event => fs.appendFileSync(path.join(directory, 'events.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 });
  const beat = () => write(path.join(directory, 'heartbeat.json'), { time: new Date().toISOString(), pid: process.pid });
  let sessionId, connection, dispatched = false, answer = '', answerBytes = 0, oversized = false;
  let cancelPoll, cancelDeadline, outcome, promptSettled = false;
  const cancellationRequested = () => fs.existsSync(path.join(directory, 'cancel.json'));
  beat();
  const heartbeat = setInterval(() => { try { beat(); } catch { /* The observer owns uncertainty. */ } }, 1000);
  try {
    if (fs.realpathSync(job.workspace) !== job.workspace || !fs.statSync(job.workspace).isDirectory()) {
      throw protocolError('WORKSPACE_UNAVAILABLE', '原 DSH ACP 工作目录已变更。');
    }
    const args = launchNative(job.executable, argumentsFor(job), job.dshHome);
    const child = spawn(args.executable, args.args, { cwd: job.workspace, env: args.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    connection = acpConnection(child, params => {
      const update = params?.update;
      if (!dispatched || promptSettled || params?.sessionId !== sessionId || update?.sessionUpdate !== 'agent_message_chunk'
        || update.content?.type !== 'text' || typeof update.content.text !== 'string' || oversized) return;
      answerBytes += Buffer.byteLength(update.content.text);
      if (answerBytes > answerLimit) {
        oversized = true;
        return;
      }
      const text = safe(update.content.text);
      answer += text;
      emit({ kind: 'output', text, delta: true });
    });
    const info = await connection.call('initialize', {
      protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: 'agentbridge', version: '0.1.0' },
    });
    if (info?.protocolVersion !== 1) throw protocolError('DSH_ACP_PROTOCOL', '原生 ACP 协议版本不受支持。');
    const request = { cwd: job.workspace, mcpServers: [] };
    if (job.sessionId) {
      if (!info.agentCapabilities?.sessionCapabilities?.resume) throw protocolError('CONVERSATION_CONFIG', '原生 ACP 未声明恢复能力。');
      const resumed = await connection.call('session/resume', { ...request, sessionId: job.sessionId });
      if (!resumed || typeof resumed !== 'object' || (Object.hasOwn(resumed, 'sessionId') && resumed.sessionId !== job.sessionId))
        throw protocolError('CONVERSATION_CONFIG', '原生 ACP 回复的会话绑定有变化。');
      sessionId = job.sessionId;
    } else {
      const session = await connection.call('session/new', request);
      if (!validIdentity(session?.sessionId))
        throw protocolError('DSH_ACP_PROTOCOL', '原生 ACP 未返回有效会话 ID。');
      sessionId = session.sessionId;
    }
    emit({ kind: 'native', sessionId });
    if (cancellationRequested()) {
      outcome = { kind: 'terminal', status: 'cancelled', text: '取消发生于需求派发前。', nativeExited: false };
    } else {
      write(path.join(directory, 'attempted.json'), { requestId: job.requestId, sessionId });
      emit({ kind: 'started' });
      dispatched = true;
      const prompt = connection.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: job.message }] }, 0);
      cancelPoll = setInterval(() => {
        if (!cancellationRequested()) return;
        clearInterval(cancelPoll);
        try { connection.cancel(sessionId); } catch (error) { connection.disconnect(error); return; }
        cancelDeadline = setTimeout(() => connection.disconnect(protocolError('DSH_ACP_TIMEOUT', '取消后未收到原 ACP 终态。')), 30000);
      }, 100);
      const result = await prompt;
      promptSettled = true;
      clearInterval(cancelPoll);
      clearTimeout(cancelDeadline);
      const reason = result?.stopReason;
      if (reason === 'cancelled') {
        outcome = { kind: 'terminal', status: 'cancelled', text: '已收到 DSH ACP 原请求的取消终态。' };
      } else if (reason === 'end_turn' && !oversized && answer.trim()) {
        outcome = { kind: 'terminal', status: 'succeeded', text: safe(answer) };
      } else if (['end_turn', 'max_tokens', 'max_turn_requests', 'refusal'].includes(reason)) {
        outcome = { kind: 'terminal', status: 'failed', code: 'DSH_ACP_RESULT', text: 'DSH ACP 已结束，但未返回可确认的完整正文。' };
      } else {
        outcome = { kind: 'unknown', text: 'DSH ACP 未返回可识别的本轮终态；保留原请求，不重新派发。' };
      }
    }
    if (info.agentCapabilities?.sessionCapabilities?.close) {
      // Completion is decided by the prompt reply. The close command only
      // flushes and disposes this connection's native session scope.
      try { await connection.call('session/close', { sessionId }, 5000); } catch { /* EOF closes the owned connection. */ }
    }
  } catch (error) {
    const missingKey = /^llm-deepseek: no API key for provider route\b/.test(error.nativeMessage || '');
    if (dispatched && !missingKey) {
      outcome = { kind: 'unknown', text: 'DSH ACP 原请求尚无可确认的终态；保留原请求，不重新派发。' };
    } else {
      outcome = { kind: 'terminal', status: 'failed', code: missingKey ? 'DSH_MODEL_AUTH_REQUIRED' : error.code || 'NATIVE_START',
        text: missingKey ? '请在 DSH 的 ACP Profile 中配置原生模型认证。' : 'DSH ACP 未能准备执行，请核对原生入口和 Profile。',
        nativeExited: dispatched };
    }
  } finally {
    clearInterval(cancelPoll);
    clearTimeout(cancelDeadline);
    try { await connection?.close(); } finally { clearInterval(heartbeat); }
  }
  emit(outcome);
}

module.exports = { run };
