const fs = require('node:fs');
const path = require('node:path');

// These are three different upstream protocols. Never infer one tool's flags
// or terminal vocabulary from another tool's --version result. Pinned source
// refs and inspected contract URLs: artifacts/native-agent-expansion/2026-10-18/upstream-contracts.json.
const profiles = Object.freeze({ hermes: 'chat-stream-json-v1', pi: 'json-print-v1', dsh: 'headless-json-v1' });
const names = Object.freeze({ hermes: 'Hermes Agent', pi: 'Pi', dsh: 'DeepSeek Harness' });
const fail = (code, message) => Object.assign(new Error(message), { code });
const validIdentity = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
const messageText = message => Array.isArray(message?.content)
  ? message.content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('') : '';

function piSessionFile(directory, sessionId) {
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') throw fail('CONVERSATION_CONFIG', 'Pi 原生会话文件不存在，未重新提交。'); throw error; }
  const matches = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const file = path.join(directory, entry.name);
    let fd;
    try {
      fd = fs.openSync(file, 'r'); const bytes = Buffer.alloc(65536), count = fs.readSync(fd, bytes, 0, bytes.length, 0);
      const first = bytes.subarray(0, count).toString('utf8').split('\n')[0], header = JSON.parse(first);
      if (header.type === 'session' && header.id === sessionId) matches.push(file);
    } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  if (matches.length !== 1) throw fail('CONVERSATION_CONFIG', 'Pi 原生会话文件缺失或不唯一，未重新提交；请保留原记录核对。');
  return matches[0];
}
function argumentsFor(job) {
  if (!profiles[job.adapter] || job.profile !== profiles[job.adapter]) throw fail('CONVERSATION_CONFIG', '原生执行协议不匹配，原请求未重新提交。');
  if (job.adapter === 'hermes') return ['chat', '--query-file', '-', '--format', 'stream-json', '--no-restore-cwd', ...(job.sessionId ? ['--resume', job.sessionId] : [])];
  if (job.adapter === 'dsh') return ['--profile', 'headless', '--json', ...(job.sessionId ? ['--session-id', job.sessionId] : []), '-'];
  return ['--mode', 'json', '--print', '--session-dir', job.sessionDirectory, ...(job.sessionId ? ['--session', piSessionFile(job.sessionDirectory, job.sessionId)] : [])];
}
function createParser(job, emit) {
  let answer = '', sessionId = '', completed = false, failure = '', piError = '', piFinal = false, piEnded = false, dshEnded = false;
  function conflict(text) { failure = text; emit({ kind: 'binding_error', text }); }
  function bind(value) {
    if (!validIdentity(value)) return;
    if ((job.sessionId && value !== job.sessionId) || (sessionId && value !== sessionId)) { conflict('原生工具返回了不同 Session；保留原绑定，禁止继续会话。'); return; }
    if (!sessionId) { sessionId = value; emit({ kind: 'native', sessionId: value }); }
  }
  function output(text, delta = false) { if (typeof text === 'string') { if (delta) answer += text; else answer = text; emit({ kind: 'output', text, delta }); } }
  return {
    accept(event) {
      if (!event || typeof event !== 'object' || Array.isArray(event)) throw fail('NATIVE_PROTOCOL', '原生事件不是 JSON 对象。');
      if (job.adapter === 'hermes') {
        if (event.type === 'system' && event.subtype === 'init') bind(event.session_id);
        if (event.type === 'text') output(event.text, true);
        if (event.type === 'result') {
          bind(event.session_id); output(event.text);
          if (event.exit_code !== 0 || event.error) failure = String(event.error || 'Hermes 原生执行失败');
          completed = event.exit_code === 0 && typeof event.text === 'string';
        }
        if (event.type === 'tool_use' || event.type === 'tool_result') emit({ kind: 'progress', text: event.type + ' · ' + (event.name || 'tool') });
      } else if (job.adapter === 'pi') {
        if (event.type === 'session') { bind(event.id); if (event.cwd && path.resolve(event.cwd) !== path.resolve(job.workspace)) conflict('Pi 返回了不同工作目录，保留原会话核对。'); }
        if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') output(event.assistantMessageEvent.delta, true);
        if (event.type === 'message_end' && event.message?.role === 'assistant') {
          output(messageText(event.message));
          piFinal = event.message.stopReason === 'stop';
          piError = ['error', 'aborted', 'length'].includes(event.message.stopReason) ? String(event.message.errorMessage || 'Pi 原生执行失败、中止或达到输出上限') : '';
        }
        if (event.type === 'agent_end') { piEnded = event.willRetry !== true; completed = piEnded; }
        if (event.type === 'agent_settled') { completed = !event.aborted; if (event.aborted) failure = 'Pi 原生执行已中止'; }
        if (event.type === 'auto_retry_end' && event.success === false) failure = String(event.finalError || 'Pi 自动重试失败');
        if (event.type === 'tool_execution_start' || event.type === 'tool_execution_end') emit({ kind: 'progress', text: event.type + ' · ' + (event.toolName || 'tool') });
      } else {
        if (event.type === 'session') { bind(event.sessionId); if (event.cwd && path.resolve(event.cwd) !== path.resolve(job.workspace)) conflict('DeepSeek Harness 返回了不同工作目录，保留原会话核对。'); }
        if (event.type === 'text') output(event.text);
        if (event.type === 'status' && event.phase === 'turn_end') {
          dshEnded = event.reason?.kind === 'completed';
          if (!dshEnded) failure = String(event.reason?.error?.message || 'DeepSeek Harness 本轮未正常完成：' + (event.reason?.kind || 'unknown'));
        }
        if (event.type === 'final') { output(event.text); completed = typeof event.text === 'string'; }
        if (event.type === 'tool_call' || event.type === 'tool_result') emit({ kind: 'progress', text: event.type + ' · ' + (event.tool || event.callId || 'tool') });
      }
      if (event.type === 'error') failure = String(event.message || event.error?.message || event.error || '原生工具返回错误');
    },
    finish(code) {
      const error = failure || (job.adapter === 'pi' ? piError || (!piFinal ? 'Pi 缺少本轮正常结束的 assistant 消息。' : '') : '') || (job.adapter === 'dsh' && !dshEnded ? 'DeepSeek Harness 缺少本轮 completed 终态。' : '');
      return { sessionId, answer, succeeded: code === 0 && completed && !!sessionId && !error, error };
    },
  };
}
module.exports = { profiles, names, validIdentity, argumentsFor, createParser, piSessionFile };
