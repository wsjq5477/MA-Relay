import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { OpenCodeConfig } from '../config.js';
import { BridgeError, type NativeReference } from '../core.js';
import { validateAnswer, type Answer } from './forms.js';
import type { NativeSession, NativeMessage, NativePermission, NativeForm } from './opencode-client.js';

type Call = <T>(route: string, body?: unknown, signal?: AbortSignal) => Promise<T>;
type Model = { id: string; providerID: string; variant?: string };
type V1Session = { id: string; directory: string; agent?: string; model?: Model; permission?: unknown };
interface V1Message {
  info: { id: string; sessionID: string; role: string; parentID?: string; finish?: string;
    time: { created: number; completed?: number }; error?: { name?: string; data?: { message?: string } } };
  parts: { type: string; id?: string; text?: string; tool?: string;
    state?: { status: string; input?: Record<string, unknown>; output?: string } }[];
}
interface Question { id: string; sessionID: string; questions: { header: string; question: string;
  multiple?: boolean; custom?: boolean; options: { label: string; description?: string }[] }[] }
const contract = () => new BridgeError('NATIVE_CONTRACT', 'OpenCode 1.x 返回了不兼容的原生数据，保留原请求与会话。', 503);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Official 1.x HTTP contract. All mutations are single attempts; status is evidence only. */
export class OpenCodeV1 {
  constructor(private readonly config: OpenCodeConfig, private readonly call: Call) {}
  route(path: string): string {
    return path + (path.includes('?') ? '&' : '?') + 'directory=' + encodeURIComponent(this.config.workspace);
  }
  async probe(knownHealth?: { healthy: boolean; version: string }, signal?: AbortSignal) {
    const call = <T>(route: string) => this.call<T>(route, undefined, signal);
    const health = knownHealth ?? await call<{ healthy: boolean; version: string }>('/global/health');
    if (!health || health.healthy !== true || typeof health.version !== 'string' || !/^1\./.test(health.version)) throw contract();
    const [agents, config, catalogue, statuses, permissions, questions] = await Promise.all([
      call<{ name: string; model?: { providerID: string; modelID: string }; variant?: string }[]>(this.route('/agent')),
      call<Record<string, unknown>>(this.route('/config')),
      call<{ providers: { id: string; models: Record<string, { id: string }> }[]; default: Record<string, string> }>(this.route('/config/providers')),
      call<unknown>(this.route('/session/status')),
      call<unknown>(this.route('/permission')),
      call<unknown>(this.route('/question')),
    ]);
    if (!Array.isArray(agents) || !agents.every(a => a && typeof a.name === 'string') || !object(config)
      || !catalogue || !Array.isArray(catalogue.providers) || !object(catalogue.default)
      || !object(statuses) || !Array.isArray(permissions) || !Array.isArray(questions)) throw contract();
    const models: Model[] = [];
    for (const provider of catalogue.providers) {
      if (!provider || typeof provider.id !== 'string' || !object(provider.models)) throw contract();
      for (const model of Object.values(provider.models)) {
        if (!model || typeof model.id !== 'string') throw contract();
        models.push({ providerID: provider.id, id: model.id });
      }
    }
    const agent = agents.find(a => a.name === this.config.nativeAgent);
    if (!agent) throw new BridgeError('NATIVE_AGENT', 'OpenCode 未提供所选原生 Agent，请核对原生配置。', 503);
    let selected: Model | null = this.config.model || null;
    const parseModel = (value: unknown): Model | null => {
      if (typeof value !== 'string' || !value.includes('/')) return null;
      const [providerID, ...id] = value.split('/');
      return providerID && id.join('/') ? { providerID, id: id.join('/') } : null;
    };
    // Match the native priority: explicit prompt, agent, config, recent, native provider default.
    if (!selected && agent.model) {
      if (typeof agent.model.providerID !== 'string' || typeof agent.model.modelID !== 'string') throw contract();
      selected = { providerID: agent.model.providerID, id: agent.model.modelID, ...(agent.variant ? { variant: agent.variant } : {}) };
    }
    if (!selected && config.model !== undefined) { selected = parseModel(config.model); if (!selected) throw contract(); }
    if (!selected) {
      let state: { recent?: { providerID: string; modelID: string }[]; variant?: Record<string, string> } = {};
      try { state = JSON.parse(readFileSync(resolve(process.env.XDG_STATE_HOME || resolve(homedir(), '.local/state'), 'opencode/model.json'), 'utf8')); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new BridgeError('NATIVE_CLI_STATE', 'OpenCode CLI 模型偏好无法读取，请保留原文件排查', 503); }
      if (!object(state) || state.recent !== undefined && !Array.isArray(state.recent)) throw contract();
      const recent = state.recent?.find(r => r && models.some(m => m.providerID === r.providerID && m.id === r.modelID));
      if (recent) {
        const variant = state.variant?.[recent.providerID + '/' + recent.modelID];
        selected = { providerID: recent.providerID, id: recent.modelID, ...(typeof variant === 'string' ? { variant } : {}) };
      }
    }
    if (!selected) {
      const configured = object(config.provider) ? Object.keys(config.provider) : [];
      const provider = catalogue.providers.find(p => !configured.length || configured.includes(p.id));
      const id = provider && catalogue.default[provider.id];
      if (provider && typeof id === 'string') selected = { providerID: provider.id, id };
    }
    return { version: health.version, selected, models };
  }
  private sessionInfo(raw: V1Session): NativeSession {
    if (!raw || typeof raw.id !== 'string' || typeof raw.directory !== 'string') throw contract();
    let permissions: unknown;
    if (raw.permission !== undefined) {
      if (!Array.isArray(raw.permission) || raw.permission.some(p => !p || typeof p.permission !== 'string' || typeof p.pattern !== 'string' || !['allow','ask','deny'].includes(p.action))) throw contract();
      permissions = raw.permission.map(p => ({action:p.permission,resource:p.pattern,effect:p.action}));
    }
    return { id: raw.id, location: { directory: raw.directory }, agent: raw.agent, model: raw.model, permissions };
  }
  async session(id: string, signal?: AbortSignal): Promise<NativeSession> {
    const session = this.sessionInfo(await this.call<V1Session>(this.route('/session/' + encodeURIComponent(id)), undefined, signal));
    if (session.id !== id) throw contract();
    return session;
  }
  async create(title: string, model: Model | undefined, permissions: NativeReference['snapshot'], signal?: AbortSignal): Promise<NativeSession> {
    const raw = await this.call<V1Session>(this.route('/session'), {
      title, agent: this.config.nativeAgent, ...(model ? { model } : {}),
      ...(permissions?.permissions ? { permission: permissions.permissions.map(p => ({ permission: p.action, pattern: p.resource, action: p.effect })) } : {}),
    }, signal);
    const session = this.sessionInfo(raw);
    if (realpathSync(session.location.directory) !== realpathSync(this.config.workspace)) throw contract();
    return session;
  }
  async prompt(reference: NativeReference, text: string, signal?: AbortSignal): Promise<void> {
    const model = reference.snapshot?.model;
    await this.call(this.route('/session/' + encodeURIComponent(reference.sessionId) + '/prompt_async'), {
      messageID: reference.messageId, agent: this.config.nativeAgent, parts: [{ type: 'text', text }],
      ...(model ? { model: { providerID: model.providerID, modelID: model.id }, ...(model.variant ? { variant: model.variant } : {}) } : {}),
    }, signal);
    // 204 acknowledges scheduling, not persisted input. Only read the original ID.
    const deadline = Date.now() + 5000;
    do {
      if ((await this.messages(reference.sessionId, signal)).some(m => m.type === 'user' && m.id === reference.messageId)) return;
      await delay(50, undefined, { signal });
    } while (Date.now() < deadline);
    throw new BridgeError('NATIVE_INPUT_MISSING', 'OpenCode 尚未确认原输入；保留原请求，只能查询原会话。', 503);
  }
  async messages(id: string, signal?: AbortSignal): Promise<NativeMessage[]> {
    // Omitting limit asks the native API for complete chronological history. Transport
    // bounds it to 16 MiB; never accept a truncated page as the complete input ledger.
    const rows = await this.call<V1Message[]>(this.route('/session/' + encodeURIComponent(id) + '/message'), undefined, signal);
    if (!Array.isArray(rows) || rows.length > 10000) throw contract();
    const seen = new Set<string>();
    return rows.map(row => {
      const info = row?.info;
      if (!info || typeof info.id !== 'string' || seen.has(info.id) || info.sessionID !== id
        || !['user', 'assistant'].includes(info.role) || !info.time || !Number.isFinite(info.time.created)
        || info.time.completed !== undefined && (!Number.isFinite(info.time.completed) || info.time.completed < info.time.created)
        || info.role === 'assistant' && (typeof info.parentID !== 'string' || !info.parentID)
        || info.finish !== undefined && typeof info.finish !== 'string'
        || info.error !== undefined && (!object(info.error) || typeof info.error.name !== 'string')
        || !Array.isArray(row.parts) || row.parts.some(p => !p || typeof p.type !== 'string'
          || p.state && !['pending','running','completed','error'].includes(p.state.status))) throw contract();
      seen.add(info.id);
      return { id: info.id, type: info.role, parentID: info.parentID, finish: info.finish, time: info.time,
        ...(info.error ? { error: { name: info.error.name, message: info.error.data?.message || info.error.name } } : {}),
        content: row.parts.map(p => ({ type: p.type, id: p.id, text: p.text, name: p.tool,
          ...(p.state ? { state: { status: p.state.status, input: p.state.input,
            content: typeof p.state.output === 'string' ? [{ type: 'text', text: p.state.output }] : [] } } : {}) })),
      };
    });
  }
  async outcome(id: string, turn: NativeMessage[], hasLaterInput: boolean, signal?: AbortSignal): Promise<string | undefined> {
    const input = turn[0];
    const assistants = turn.filter(m => m.type === 'assistant');
    if (assistants.some(m => m.parentID !== input?.id)) throw contract();
    const last = assistants.at(-1);
    if (!last?.time?.completed || assistants.some(m => !m.time?.completed || m.content?.some(p => p.type === 'tool' && ['pending', 'running'].includes(p.state?.status || '')))) return;
    if (!hasLaterInput) {
      const statuses = await this.call<Record<string, { type: string }>>(this.route('/session/status'), undefined, signal);
      if (!object(statuses) || Object.values(statuses).some(s => !s || !['busy', 'idle', 'retry'].includes(s.type))) throw contract();
      if (statuses[id] && statuses[id]!.type !== 'idle') return;
    }
    if (last.error) return last.error.name === 'MessageAbortedError' ? 'interrupted' : 'failed';
    if (last.finish && !['tool-calls', 'unknown'].includes(last.finish) && !last.content?.some(p => p.type === 'tool')) return 'succeeded';
  }
  async waiting(id: string, signal?: AbortSignal): Promise<{ permissions: NativePermission[]; forms: NativeForm[] }> {
    const [permissions, questions] = await Promise.all([
      this.call<{ id: string; sessionID: string; permission: string; patterns: string[] }[]>(this.route('/permission'), undefined, signal),
      this.call<Question[]>(this.route('/question'), undefined, signal),
    ]);
    if (!Array.isArray(permissions) || !Array.isArray(questions)
      || permissions.some(p => !p || typeof p.id !== 'string' || typeof p.sessionID !== 'string' || typeof p.permission !== 'string'
        || !Array.isArray(p.patterns) || p.patterns.some(p => typeof p !== 'string'))
      || questions.some(q => !q || typeof q.id !== 'string' || typeof q.sessionID !== 'string' || !Array.isArray(q.questions))) throw contract();
    return {
      permissions: permissions.filter(p => p.sessionID === id).map(p => ({ id: p.id, sessionID: id, action: p.permission, resources: p.patterns })),
      forms: questions.filter(q => q.sessionID === id).map(q => {
        if (!q.questions.length || q.questions.length > 100 || q.questions.some(f => !f || typeof f.question !== 'string'
          || typeof f.header !== 'string' || !Array.isArray(f.options) || f.options.some(o => !o || typeof o.label !== 'string'))) throw contract();
        return { id: q.id, sessionID: id, title: q.questions.map(f => f.question).join('\n'), fields: q.questions.map((f, i) => ({
          key: String(i), type: f.multiple ? 'multiselect' : 'string', title: f.header, description: f.question, required: true,
          custom: f.custom !== false, options: f.options.map(o => ({ value: o.label, label: o.label })),
        })) };
      }),
    };
  }
  async interrupt(id: string): Promise<{ interrupted: boolean }> {
    const receipt = await this.call(this.route('/session/' + encodeURIComponent(id) + '/abort'), {});
    if (receipt !== true) throw contract();
    return { interrupted: true }; // Control receipt only; outcome needs the original assistant's abort evidence.
  }
  async reply(id: string, action: 'permission' | 'form', requestId: string, value: { decision?: string; answer?: Answer }): Promise<void> {
    const waiting = await this.waiting(id);
    let body: unknown;
    if (action === 'permission') {
      if (!waiting.permissions.some(p => p.id === requestId) || !['once', 'reject'].includes(value.decision || '')) throw new BridgeError('STALE_REQUEST', '原权限请求已停止等待', 409);
      body = { reply: value.decision };
    } else {
      const form = waiting.forms.find(f => f.id === requestId);
      if (!form || !value.answer) throw new BridgeError('STALE_REQUEST', '原输入请求已停止等待', 409);
      validateAnswer(form.fields, value.answer);
      body = { answers: (form.fields as { key: string }[]).map(f => { const v = value.answer![f.key]!; return Array.isArray(v) ? v : [String(v)]; }) };
    }
    const receipt = await this.call(this.route('/' + (action === 'form' ? 'question' : 'permission') + '/' + encodeURIComponent(requestId) + '/reply'), body);
    if (receipt !== true) throw contract();
  }
}
