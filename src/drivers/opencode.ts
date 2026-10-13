import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { realpathSync, readFileSync } from 'node:fs';
import type { OpenCodeConfig } from '../config.js';
import { BridgeError, clip, type Descriptor, type NativeReference, type TaskEvent } from '../core.js';
import type { Execution } from '../protocol.js';
import { redactor } from '../security.js';
import type { AgentDriver, DriverCapabilities } from './driver.js';
import { NativeHttpError, OpenCodeClient, type NativeSession, type NativeMessage } from './opencode-client.js';
import { fingerprint, resourceKey } from '../settings.js';

export class OpenCodeDriver implements AgentDriver {
  readonly descriptor: Descriptor;
  readonly capabilities: DriverCapabilities = { concurrency: 1, progress: true, cancel: true, nativeSessions: true };
  readonly client: OpenCodeClient;
  private healthy = false;
  private refreshing = false;
  private lastCheck = 0;
  constructor(private readonly config: OpenCodeConfig, private readonly invoke: (id: string) => void,
    private readonly bind: (id: string, reference: NativeReference) => void) {
    this.client = new OpenCodeClient(config);
    let resource = config.resourceKey;
    if (!resource) { try { resource = resourceKey(config.workspace); } catch { /* Unavailable workspace remains unhealthy. */ } }
    this.descriptor = { agentId: config.agentId, name: config.name, adapter: 'opencode', healthy: false, workspace: config.workspace,
      enabled: config.enabled, resourceKey: resource, revision: config.revision, configFingerprint: fingerprint(config) };
  }
  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try { const check = await this.client.check(); this.healthy = check.healthy; this.descriptor.selectedModel = check.model; this.descriptor.modelCheckedAt = new Date().toISOString(); } catch { this.healthy = false; }
    finally { this.refreshing = false; this.lastCheck = Date.now(); }
  }
  health(): boolean { if (Date.now() - this.lastCheck > 2000) void this.refresh(); return this.healthy; }
  async *execute(execution: Execution, signal?: AbortSignal): AsyncIterable<Exclude<TaskEvent, { kind: 'accepted' }>> {
    if (execution.verification && (await this.client.check()).version !== '2.0.24') {
      throw new BridgeError('VERIFICATION_CONTRACT', '工具禁止契约只核验了 OpenCode 2.0.24，请先核验当前版本', 503);
    }
    const previous = execution.resumeNative;
    if (previous) {
      const evidence = await this.inspect(previous, signal);
      if (!evidence.outcome || evidence.hasLaterInput || evidence.waiting.permissions.length || evidence.waiting.forms.length) throw new BridgeError('CONVERSATION_BUSY', '原会话不是可续问的空闲状态', 409);
    }
    const checked = await this.client.check();
    const sessionId = previous?.sessionId || 'ses_' + randomUUID().replaceAll('-', '');
    const messageId = 'msg_' + randomUUID().replaceAll('-', '');
    const reference: NativeReference = { sessionId, messageId, serverUrl: this.config.serverUrl, workspace: realpathSync(this.config.workspace),
      priorMessageIds: previous ? [...(previous.priorMessageIds || []), previous.messageId] : [],
      snapshot: previous?.snapshot || { nativeAgent: this.config.nativeAgent, passwordFile: this.config.passwordFile, configFingerprint: fingerprint(this.config),
        configRevision: this.config.revision, resourceKey: this.descriptor.resourceKey, model: checked.model || this.config.model,
        permissions: execution.verification ? [{ action: '*', resource: '*', effect: 'deny' }] : this.config.permissions } };
    this.invoke(execution.executionId);
    yield { kind: 'started' };
    // Persist identity before every session/prompt mutation. Recovery observes this binding only.
    this.bind(execution.executionId, reference);
    yield { kind: 'native', reference };
    try {
      if (!previous) {
        const response = await this.client.call<{ data: NativeSession }>('/api/session', {
          id: sessionId, title: 'AgentBridge ' + execution.conversationId, agent: this.config.nativeAgent,
          location: { directory: reference.workspace }, ...(this.config.model || this.config.inheritNativeCli ? { model: reference.snapshot?.model } : {}),
          ...(reference.snapshot?.permissions ? { permissions: reference.snapshot.permissions } : {}),
          metadata: { agentbridge: { conversationId: execution.conversationId, taskId: execution.taskId, executionId: execution.executionId, messageId } },
        }, signal);
        if (response.data?.id !== sessionId || realpathSync(response.data.location.directory) !== reference.workspace) throw new BridgeError('NATIVE_BINDING', 'Native session does not match the configured execution', 503);
      }
      const admitted = await this.client.call<{ data: { id: string; sessionID: string } }>('/api/session/' + sessionId + '/prompt', { id: messageId, text: execution.message }, signal);
      if (admitted.data?.id !== messageId || admitted.data.sessionID !== sessionId) throw new BridgeError('NATIVE_BINDING', 'Native input admission does not match this task', 503);
    } catch (e) {
      if (e instanceof NativeHttpError && [400, 401, 403, 404, 422].includes(e.status)) {
        yield { kind: 'failed', error: { code: e.code, message: e.message, phase: 'execution' } }; return;
      }
      throw e;
    }
    yield* this.observe(execution, reference, signal);
  }
  async inspect(reference: NativeReference, signal?: AbortSignal): Promise<{ current: NativeSession; turn: NativeMessage[]; waiting: Awaited<ReturnType<OpenCodeClient['waiting']>>; outcome?: string; hasLaterInput: boolean }> {
    if (reference.serverUrl !== this.config.serverUrl || reference.workspace !== realpathSync(this.config.workspace)
      || reference.snapshot && (reference.snapshot.configFingerprint !== fingerprint(this.config) || reference.snapshot.passwordFile !== this.config.passwordFile)) throw new BridgeError('NATIVE_BINDING', '原执行配置或服务身份不匹配，保留占位', 409);
    const [current, messages, waiting] = await Promise.all([
      this.client.session(reference.sessionId, signal), this.client.messages(reference.sessionId, signal), this.client.waiting(reference.sessionId, signal),
    ]);
    if (realpathSync(current.location.directory) !== reference.workspace || current.agent && reference.snapshot && current.agent !== reference.snapshot.nativeAgent) throw new BridgeError('NATIVE_BINDING', '原生会话目录或 Agent 已改变', 409);
    const model = reference.snapshot?.model;
    if (model && current.model && (model.id !== current.model.id || model.providerID !== current.model.providerID || (model.variant || 'default') !== (current.model.variant || 'default'))) throw new BridgeError('NATIVE_BINDING', '原生会话模型已改变', 409);
    if (reference.snapshot?.permissions && current.permissions && JSON.stringify(reference.snapshot.permissions) !== JSON.stringify(current.permissions)) throw new BridgeError('NATIVE_BINDING', '原生会话权限快照已改变', 409);
    const index = messages.findIndex(m => m.id === reference.messageId && m.type === 'user');
    if (index < 0) throw new BridgeError('NATIVE_INPUT_MISSING', '原输入记录不存在，无法证明是否执行；请核对原生记录', 409);
    const prior = messages.slice(0, index).filter(m => m.type === 'user').map(m => m.id);
    if (JSON.stringify(prior) !== JSON.stringify(reference.priorMessageIds || [])) throw new BridgeError('NATIVE_INTERFERENCE', '原生会话出现非本会话输入，保留占位', 409);
    const later = messages.findIndex((m, i) => i > index && m.type === 'user');
    const turn = messages.slice(index, later < 0 ? undefined : later);
    const idle = turn.findLast(m => m.type === 'idle');
    if (later >= 0 && !idle) throw new BridgeError('NATIVE_INTERFERENCE', '原轮未结束前插入了其他输入，不能取消或释放占位', 409);
    return { current, turn, waiting, outcome: idle?.outcome, hasLaterInput: later >= 0 };
  }
  async *observe(execution: Execution, reference: NativeReference, signal?: AbortSignal, prior: TaskEvent[] = [], recovering = false): AsyncIterable<Exclude<TaskEvent, { kind: 'accepted' }>> {
    const safe = redactor([readFileSync(this.config.passwordFile, 'utf8').trim()]);
    if (recovering) {
      await this.inspect(reference, signal);
      yield { kind: 'reconciled', reference, reason: '已只读核对原会话与输入，恢复观察' };
    }
    if (!prior.some(e => e.kind === 'progress' && e.text === 'OpenCode accepted the prompt; waiting for actual execution')) yield { kind: 'progress', text: 'OpenCode accepted the prompt; waiting for actual execution' };
    const seenTools = new Map<string, string>();
    const seenText = new Map<string, string>();
    const emitted = new Set(prior.filter(e => e.kind === 'progress' || e.kind === 'output').map(e => e.text));
    const lastWaiting = prior.findLast(e => e.kind === 'waiting');
    let priorWaiting = lastWaiting ? JSON.stringify(lastWaiting.waiting ? { kind: lastWaiting.waiting.kind, ids: lastWaiting.waiting.requestIds } : null) : ''; let progressCount = emitted.size; let waitingCount = prior.filter(e => e.kind === 'waiting').length;
    const start = Date.now();
    for (;;) {
      if (signal?.aborted) throw new BridgeError('NATIVE_INTERRUPTED', 'Observation stopped; native execution may still be active', 503);
      if (Date.now() - start > this.config.taskTimeoutMs) throw new BridgeError('NATIVE_TIMEOUT', 'Native result could not be confirmed within the observation limit', 503);
      const { turn: messages, waiting, outcome, hasLaterInput } = await this.inspect(reference, signal);
      const waitingKey = JSON.stringify(waiting.permissions.length ? { kind: 'permission', ids: waiting.permissions.map(p => p.id) } : waiting.forms.length ? { kind: 'input', ids: waiting.forms.map(f => f.id) } : null);
      if (waitingKey !== priorWaiting) {
        const requests = waiting.permissions.length ? waiting.permissions : waiting.forms;
        if (!hasLaterInput && (requests.length || priorWaiting && priorWaiting !== 'null')) {
          if (++waitingCount > 100) throw new BridgeError('NATIVE_INTERACTION_LIMIT', 'Too many native interactions; inspect the native session', 503);
          yield { kind: 'waiting', waiting: requests.length ? {
            kind: waiting.permissions.length ? 'permission' : 'input', requestIds: requests.map(r => r.id).slice(0, 100),
            summary: safe(clip(waiting.permissions.length ? waiting.permissions.map(p => p.action + ': ' + p.resources.join(', ')).join('\n') : waiting.forms.map(f => f.title).join('\n'), 12000).text),
          } : null };
        }
        priorWaiting = waitingKey;
      }
      const assistants = messages.filter(m => m.type === 'assistant');
      if (execution.verification && assistants.some(m => m.content?.some(p => p.type === 'tool'))) {
        throw new BridgeError('VERIFICATION_TOOL', 'Restricted verification unexpectedly used a tool', 503);
      }
      for (const message of assistants) for (const [index, part] of (message.content || []).entries()) {
        const key = message.id + ':' + (part.id || index);
        if (part.type === 'tool' && part.state) {
          const state = part.state.status;
          if (seenTools.get(key) !== state && progressCount < 80) {
            seenTools.set(key, state); progressCount++;
            const input = part.state.input || {};
            const detail = typeof input.command === 'string' ? input.command : typeof input.filePath === 'string' ? input.filePath : '';
            const output = (part.state.content || []).map(c => c.text || '').join('\n');
            const text = safe(clip('Tool ' + part.name + ' [' + state + '] ' + detail + (output ? '\n' + output : ''), 12000).text);
            if (!emitted.has(text)) { emitted.add(text); yield { kind: 'progress', text }; }
          }
        } else if (part.type === 'text' && part.text && progressCount < 80 && seenText.get(key) !== part.text) {
          seenText.set(key, part.text); progressCount++;
          const text = safe(clip(part.text, 12000).text);
          if (!emitted.has(text)) { emitted.add(text); yield { kind: 'output', text }; }
        }
      }
      if (outcome) {
        if (outcome === 'failed') {
          const message = assistants.findLast(m => m.error)?.error?.message || 'OpenCode reports failed execution; inspect the native session';
          yield { kind: 'failed', error: { code: 'OPENCODE_FAILED', message: safe(clip(message, 12000).text), phase: 'execution' } }; return;
        }
        if (outcome === 'interrupted') { yield { kind: 'cancelled', reason: 'OpenCode 已确认原轮次中断；已发生的文件或工具效果不会自动撤销' }; return; }
        if (outcome !== 'succeeded') throw new BridgeError('NATIVE_CONTRACT', '原轮次终态证据无法识别', 503);
        if (!hasLaterInput && (waiting.permissions.length || waiting.forms.length)) throw new BridgeError('NATIVE_CONTRACT', 'Native session is both finished and waiting', 503);
        const answer = assistants.flatMap(m => (m.content || []).filter(p => p.type === 'text').map(p => p.text || '')).join('\n\n');
        if (!answer.trim()) throw new BridgeError('NATIVE_RESULT_MISSING', 'Native success has no readable answer', 503);
        const result = clip(safe(answer), 60000);
        yield { kind: 'completed', result: { agentId: execution.targetAgent, message: result.text, ...(result.truncated ? { truncated: true } : {}) } }; return;
      }
      await delay(this.config.pollMs, undefined, { signal });
    }
  }
}
