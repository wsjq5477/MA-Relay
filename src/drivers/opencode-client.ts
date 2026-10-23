import { readFileSync, realpathSync, statSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { OpenCodeConfig } from '../config.js';
import { requireOpenCodeVersion } from '../discovery.js';
import { BridgeError, type NativeReference } from '../core.js';
import type { Answer } from './forms.js';
import { OpenCodeV1 } from './opencode-v1.js';

export interface NativeSession {
  id: string; agent?: string; model?: { id: string; providerID: string; variant?: string }; permissions?: unknown; location: { directory: string }; outcome?: 'succeeded' | 'failed' | 'interrupted';
}
export interface NativeMessage {
  id: string; type: string; text?: string; outcome?: string; parentID?: string; finish?: string;
  time?: { created?: number; completed?: number }; error?: { message?: string; name?: string };
  content?: { type: string; text?: string; id?: string; name?: string;
    state?: { status: string; input?: Record<string, unknown>; content?: { type?: string; text?: string }[] } }[];
}
export interface NativePermission { id: string; sessionID: string; action: string; resources: string[] }
export interface NativeForm { id: string; sessionID: string; title: string; fields: unknown }
export class NativeHttpError extends BridgeError {
  constructor(public readonly status: number) {
    super('OPENCODE_HTTP_' + status, [401, 403].includes(status)
      ? 'OpenCode authentication failed (HTTP ' + status + '); check passwordFile'
      : 'OpenCode rejected the request (HTTP ' + status + '); check the native API and task configuration', 503);
  }
}
export class OpenCodeClient {
  protocol?: 'v1' | 'v2';
  private readonly v1: OpenCodeV1;
  constructor(readonly config: OpenCodeConfig) { this.v1 = new OpenCodeV1(config, (route, body, signal) => this.call(route, body, signal)); }
  async call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    let password: string;
    try { password = readFileSync(this.config.passwordFile, 'utf8').trim(); if (!password) throw new Error(); }
    catch { throw new BridgeError('NATIVE_AUTH_UNAVAILABLE', 'OpenCode password file is missing or empty', 503); }
    let response: Response;
    try {
      response = await fetch(new URL(path, this.config.serverUrl), {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { authorization: 'Basic ' + Buffer.from('opencode:' + password).toString('base64'), 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      });
    } catch { throw new BridgeError('NATIVE_UNAVAILABLE', 'OpenCode request failed or timed out; execution may still be active', 503); }
    if (!response.ok) { await response.body?.cancel(); throw new NativeHttpError(response.status); }
    if (response.status === 204) return undefined as T;
    if (!response.headers.get('content-type')?.includes('application/json')) {
      await response.body?.cancel(); throw new BridgeError('NATIVE_CONTRACT', 'OpenCode did not return the expected JSON response', 503);
    }
    // Bound response memory; this endpoint may include tool output from the native runtime.
    const reader = response.body?.getReader();
    if (!reader) throw new BridgeError('NATIVE_CONTRACT', 'OpenCode response body is missing', 503);
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 16777216) throw new BridgeError('NATIVE_RESPONSE_LIMIT', 'OpenCode response exceeds 16 MiB; inspect the native session', 503);
        chunks.push(chunk.value);
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as T;
    } catch (e) {
      if (e instanceof BridgeError) throw e;
      throw new BridgeError('NATIVE_CONTRACT', 'OpenCode response is incomplete or invalid', 503);
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  /** Read-only contract probe shared by startup, reconnect and execution checks. */
  async probe(signal?: AbortSignal): Promise<{version: string; selected: {id:string;providerID:string;variant?:string}|null; models:{id:string;providerID:string}[]}> {
    this.protocol = undefined;
    // Protocol discovery has its own budget, including response bodies and metadata.
    // Never touch api/info on a healthy v1: early v1 initializes and hangs there.
    const budget = AbortSignal.timeout(4000);
    const deadline = signal ? AbortSignal.any([signal, budget]) : budget;
    const candidate = async <T>(route: string): Promise<T> => {
      const short = AbortSignal.any([deadline, AbortSignal.timeout(700)]);
      try { return await this.call<T>(route, undefined, short); }
      catch (error) {
        if (short.aborted) throw new BridgeError('OPENCODE_PROBE_TIMEOUT', 'OpenCode 协议候选端点未及时响应。', 503);
        throw error;
      }
    };
    const call = <T>(route: string) => this.call<T>(route, undefined, deadline);
    let reachable = false;
    const fallback = (error: unknown) => {
      if (!(error instanceof BridgeError) || !['NATIVE_CONTRACT','NATIVE_RESPONSE_LIMIT','OPENCODE_HTTP_404','OPENCODE_HTTP_405','NATIVE_UNAVAILABLE','OPENCODE_PROBE_TIMEOUT'].includes(error.code)) throw error;
      if (error.code !== 'NATIVE_UNAVAILABLE') reachable = true;
    };
    try {
      let health: {healthy?: unknown; version?: unknown} | undefined;
      try { health = await candidate('/global/health'); reachable = true; }
      catch (error) {
        // A v2 server may reject the optional v1 path with any HTTP status.
        // Authentication is shared; other health-path errors still allow v2.
        if (error instanceof NativeHttpError && ![401, 403].includes(error.status)) reachable = true;
        else fallback(error);
      }
      if (health?.healthy === true && typeof health.version === 'string' && health.version.startsWith('1.')) {
        requireOpenCodeVersion(health.version);
        const result = await this.v1.probe({healthy: true, version: health.version}, deadline);
        this.protocol = 'v1';
        return result;
      }
      let info: {version?: unknown} | undefined;
      try { info = await candidate('/api/info'); reachable = true; }
      catch (error) { fallback(error); throw error; }
      if (!info || typeof info.version !== 'string') throw new BridgeError('NATIVE_CONTRACT', 'API version is missing', 503);
      requireOpenCodeVersion(info.version);
      if (!info.version.startsWith('2.')) throw new BridgeError('NATIVE_CONTRACT', 'OpenCode 1.x health contract is missing', 503);
      const location = '?location%5Bdirectory%5D=' + encodeURIComponent(this.config.workspace);
      const [agents, selected, models] = await Promise.all([
        call<{data?: {id?: string; name?: string}[]}>('/api/agent' + location),
        call<{data?: unknown}>('/api/model/default' + location),
        call<{data?: unknown[]}>('/api/model' + location),
      ]);
      const model = (value: unknown): value is {id: string; providerID: string} => !!value && typeof value === 'object'
        && typeof (value as {id?: unknown}).id === 'string' && typeof (value as {providerID?: unknown}).providerID === 'string';
      if (!info || typeof info.version !== 'string' || !info.version.trim()
        || !Array.isArray(agents?.data) || !agents.data.every(a => a && (typeof a.id === 'string' || typeof a.name === 'string'))
        || !selected || selected.data !== null && !model(selected.data)
        || !Array.isArray(models?.data) || !models.data.every(model)) throw new BridgeError('NATIVE_CONTRACT', 'API shape mismatch', 503);
      if (this.config.inheritNativeCli) {
        const config = await call<unknown>('/api/config' + location);
        if (!Array.isArray(config) || !config.every(s => s && typeof s === 'object')) throw new BridgeError('NATIVE_CONTRACT', 'API config shape mismatch', 503);
      }
      this.protocol = 'v2';
      return {version: info.version, selected:selected.data as {id:string;providerID:string;variant?:string}|null, models:models.data as {id:string;providerID:string}[]};
    } catch (error) {
      if (error instanceof BridgeError && (['NATIVE_CONTRACT','NATIVE_RESPONSE_LIMIT','OPENCODE_HTTP_404','OPENCODE_HTTP_405','OPENCODE_PROBE_TIMEOUT'].includes(error.code) || reachable && error.code === 'NATIVE_UNAVAILABLE'))
        throw new BridgeError('OPENCODE_API_UNSUPPORTED', 'OpenCode 服务的 1.x/2.x API 契约或响应时限不满足要求，协议协商失败；请核对原安装的健康接口与服务配置，保留原请求与会话。', 503);
      throw error;
    }
  }
  async check(warmupMs = 0): Promise<{ version: string; workspace: string; model: { id: string; providerID: string; variant?: string } | null; healthy: boolean }> {
    let workspace: string;
    try { workspace = realpathSync(this.config.workspace); if (!statSync(workspace).isDirectory()) throw new Error(); }
    catch { throw new BridgeError('WORKSPACE_UNAVAILABLE', 'Configured workspace is unavailable'); }
    let info = await this.probe();
    const location = '?location%5Bdirectory%5D=' + encodeURIComponent(workspace);
    const deadline = Date.now() + warmupMs;
    for (;;) {
      const selected={data:info.selected},available={data:info.models};
      let model = this.config.model || selected.data;
      if(this.protocol !== 'v1' && this.config.inheritNativeCli && !this.config.model){
        const sources=await this.call<{info?:{model?:unknown;agents?:Record<string,{model?:unknown}>}}[]>('/api/config'+location);
        if(!Array.isArray(sources))throw new BridgeError('NATIVE_CONTRACT','OpenCode 配置源响应格式不正确',503);
        // The CLI falls back to its recent model only when native config has no model.
        if(!sources.some(s=>s.info?.model||s.info?.agents?.[this.config.nativeAgent]?.model)){
          let state:{recent?:{providerID:string;modelID:string}[];variant?:Record<string,string>}={};
          try{state=JSON.parse(readFileSync(resolve(process.env.XDG_STATE_HOME||resolve(homedir(),'.local/state'),'opencode/model.json'),'utf8'));}
          catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new BridgeError('NATIVE_CLI_STATE','OpenCode CLI 模型偏好无法读取，请保留原文件排查',503);}
          if(!state||typeof state!=='object'||state.recent!==undefined&&!Array.isArray(state.recent))throw new BridgeError('NATIVE_CLI_STATE','OpenCode CLI 模型偏好格式不正确',503);
          const recent=state.recent?.find(r=>available.data.some(m=>m.id===r?.modelID&&m.providerID===r?.providerID));
          if(recent){const variant=state.variant?.[recent.providerID+'/'+recent.modelID];model={id:recent.modelID,providerID:recent.providerID,...(typeof variant==='string'?{variant}:{})};}
        }
      }
      const healthy = !!model && Array.isArray(available.data) && available.data.some(m => m.id === model.id && m.providerID === model.providerID);
      if (healthy || Date.now() >= deadline) return { version: info.version, workspace, model: model ? { id: model.id, providerID: model.providerID, ...(model.variant ? { variant: model.variant } : {}) } : null, healthy };
      // v2 can publish an empty model catalogue while initializing this location.
      // Retry only read-only metadata; never retry session or prompt mutations.
      await delay(150);
      info = await this.probe();
    }
  }
  async session(id: string, signal?: AbortSignal): Promise<NativeSession> {
    if (this.protocol === 'v1') return this.v1.session(id, signal);
    const { data } = await this.call<{ data: NativeSession }>('/api/session/' + encodeURIComponent(id), undefined, signal);
    if (!data || data.id !== id || !data.location?.directory) throw new BridgeError('NATIVE_CONTRACT', 'Native session identity is invalid', 503);
    return data;
  }
  async messages(id: string, signal?: AbortSignal): Promise<NativeMessage[]> {
    if (this.protocol === 'v1') return this.v1.messages(id, signal);
    const items: NativeMessage[] = []; let cursor: string | null | undefined;
    const visited = new Set<string>();
    do {
      const query = cursor ? '?limit=100&cursor=' + encodeURIComponent(cursor) : '?limit=100&order=asc';
      const page = await this.call<{ data: NativeMessage[]; cursor: { next?: string | null } }>('/api/session/' + encodeURIComponent(id) + '/message' + query, undefined, signal);
      if (!Array.isArray(page.data) || !page.cursor) throw new BridgeError('NATIVE_CONTRACT', 'Native message page is invalid', 503);
      items.push(...page.data); cursor = page.cursor.next;
      if (items.length > 10000 || cursor && visited.has(cursor)) throw new BridgeError('NATIVE_RESPONSE_LIMIT', 'Native message history is too large or pagination did not advance', 503);
      if (cursor) visited.add(cursor);
    } while (cursor);
    return items;
  }
  async waiting(id: string, signal?: AbortSignal): Promise<{ permissions: NativePermission[]; forms: NativeForm[] }> {
    if (this.protocol === 'v1') return this.v1.waiting(id, signal);
    const base = '/api/session/' + encodeURIComponent(id);
    const [{ data: permissions }, { data: forms }] = await Promise.all([
      this.call<{ data: NativePermission[] }>(base + '/permission', undefined, signal),
      this.call<{ data: NativeForm[] }>(base + '/form', undefined, signal),
    ]);
    if (!Array.isArray(permissions) || !Array.isArray(forms) || [...permissions, ...forms].some(p => p.sessionID !== id)) throw new BridgeError('NATIVE_CONTRACT', 'Native waiting request belongs to another session', 503);
    return { permissions, forms };
  }
  async ensureProtocol(expected: 'v1' | 'v2'): Promise<void> {
    if (!this.protocol) await this.probe();
    if (this.protocol !== expected) throw new BridgeError('NATIVE_BINDING', '原生协议与原任务绑定不一致；保留原会话和占位，不能切换协议重发。', 409);
  }
  async createV1Session(title: string, snapshot: NativeReference['snapshot'], signal?: AbortSignal): Promise<NativeSession> {
    await this.ensureProtocol('v1');
    return this.v1.create(title, snapshot?.model, snapshot, signal);
  }
  async prompt(reference: NativeReference, text: string, signal?: AbortSignal): Promise<void> {
    if (this.protocol === 'v1') return this.v1.prompt(reference, text, signal);
    const admitted = await this.call<{data:{id:string;sessionID:string}}>('/api/session/' + reference.sessionId + '/prompt', {id:reference.messageId,text}, signal);
    if (admitted.data?.id !== reference.messageId || admitted.data.sessionID !== reference.sessionId) throw new BridgeError('NATIVE_BINDING', 'Native input admission does not match this task', 503);
  }
  async turnOutcome(id: string, turn: NativeMessage[], hasLaterInput: boolean, signal?: AbortSignal): Promise<string | undefined> {
    return this.protocol === 'v1' ? this.v1.outcome(id, turn, hasLaterInput, signal) : turn.findLast(m => m.type === 'idle')?.outcome;
  }
  async interrupt(id: string): Promise<{interrupted:boolean}> {
    return this.protocol === 'v1' ? this.v1.interrupt(id) : this.call('/api/session/' + id + '/interrupt?resume=false', {});
  }
  async reply(id: string, action: 'permission' | 'form', requestId: string, value: {decision?:string;answer?:Answer}): Promise<void> {
    if (this.protocol === 'v1') return this.v1.reply(id, action, requestId, value);
    await this.call('/api/session/' + id + '/' + action + '/' + encodeURIComponent(requestId) + '/reply', action === 'permission' ? {decision:value.decision} : {answer:value.answer});
  }
}
