import { mkdirSync, chmodSync, existsSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, realpathSync, statSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { BridgeError } from './core.js';
import { opencodeSchema, hubSchema, edgeSchema, clientSchema, configData, type OpenCodeConfig } from './config.js';
import { Database } from './storage/database.js';
import { canonicalJSON } from './security.js';

const record = z.record(z.string(), z.unknown());
const manifestSchema = z.object({ version: z.literal(1), revision: z.number().int().positive(), deviceId: z.string(),
  defaultAgent: z.string().optional(), hub: record, edge: record, client: record,
  agents: z.array(opencodeSchema).max(100), legacy: record.optional(),
  connectOnStart: z.boolean().default(false),
  checks: z.record(z.string(), record).default({}), verifications: z.record(z.string(), record).default({}),
});
export type Settings = z.infer<typeof manifestSchema>;
export function localDeviceId(): string {
  let machine: string;
  try { machine = readFileSync('/etc/machine-id', 'utf8').trim(); } catch { machine = hostname(); }
  return createHash('sha256').update(machine + ':' + (process.getuid?.() ?? homedir())).digest('hex');
}
export function resourceKey(workspace: string, deviceId = localDeviceId()): string {
  return createHash('sha256').update(deviceId + ':' + realpathSync(workspace)).digest('hex');
}
export function stateDirectory(value?: string): string {
  const directory = resolve(value || process.env.AGENTBRIDGE_HOME || resolve(process.env.XDG_STATE_HOME || resolve(homedir(), '.local/state'), 'agentbridge'));
  return existsSync(directory) ? realpathSync(directory) : directory;
}
export function fingerprint(agent: OpenCodeConfig): string {
  const effective: Partial<OpenCodeConfig> = { ...agent };
  delete effective.agentId; delete effective.name; delete effective.enabled; delete effective.revision;
  return createHash('sha256').update(canonicalJSON(effective)).digest('hex');
}
export class SettingsStore {
  readonly directory: string;
  readonly path: string;
  constructor(directory: string) { this.directory = existsSync(directory) ? realpathSync(directory) : resolve(directory); this.path = resolve(this.directory, 'settings.json'); }
  exists(): boolean { return existsSync(this.path); }
  read(): Settings {
    try { return manifestSchema.parse(JSON.parse(readFileSync(this.path, 'utf8'))); }
    catch { throw new BridgeError('SETTINGS_READ', '无法读取配置清单，请检查配置目录: ' + this.directory); }
  }
  initialize(importDirectory?: string): Settings {
    if (this.exists()) return this.read();
    mkdirSync(this.directory, { recursive: true, mode: 0o700 }); chmodSync(this.directory, 0o700);
    let settings: Settings;
    if (importDirectory) {
      if (realpathSync(importDirectory) !== realpathSync(this.directory)) throw new BridgeError('IMPORT_IN_PLACE', '请用 --dir 指定旧目录以原地导入，不复制历史数据库');
      const raw = (name: string) => JSON.parse(readFileSync(resolve(this.directory, name), 'utf8')) as Record<string, unknown>;
      const h = raw('hub.json'), e = raw('edge-a.json'), c = raw('client.json');
      const hub = configData(hubSchema.strip().parse(h), this.directory, 'hub');
      const edge = configData(edgeSchema.strip().parse({ ...e, agents: (e.agents as unknown[]).map(a => opencodeSchema.strip().parse(a)) }), this.directory, 'edge');
      const client = configData(clientSchema.strip().parse(c), this.directory, 'client');
      if (edge.agents.some(a => a.adapter !== 'opencode')) throw new BridgeError('IMPORT_ADAPTER', '此向导只导入 OpenCode 连接');
      const locks: Database[] = [];
      try { locks.push(new Database(hub.dataDir, 'hub.sqlite')); locks.push(new Database(edge.dataDir, 'edge.sqlite')); }
      finally { locks.forEach(lock => lock.close()); }
      const deviceId = localDeviceId();
      settings = { version: 1, revision: 1, deviceId,
        hub: { ...hubSchema.strip().parse(h), dataDir: hub.dataDir, users: hub.users.map(({ token: _token, ...u }) => ({ ...u, tokenFile: resolve(this.directory, u.tokenFile) })),
          connectors: hub.connectors.map(({ token: _token, ...u }) => ({ ...u, tokenFile: resolve(this.directory, u.tokenFile) })) },
        edge: { ...edgeSchema.strip().parse({ ...e, agents: edge.agents }), dataDir: edge.dataDir, tokenFile: resolve(this.directory, edge.tokenFile) },
        client: { ...clientSchema.strip().parse(c), tokenFile: resolve(this.directory, client.tokenFile) },
        agents: edge.agents as OpenCodeConfig[], defaultAgent: edge.agents[0]?.agentId, legacy: { hub: h, edge: e, client: c }, checks: {}, verifications: {}, connectOnStart: false };
    } else {
      for (const name of ['user', 'edge']) {
        const path = resolve(this.directory, name + '.token');
        if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString('hex') + '\n', { mode: 0o600, flag: 'wx' });
      }
      settings = { version: 1, revision: 1, deviceId: localDeviceId(), agents: [], checks: {}, verifications: {}, connectOnStart: false,
        hub: { role: 'hub', devInsecure: true, host: '127.0.0.1', port: 0, dataDir: './hub-data', maxEventBytes: 65536, maxEventsPerTask: 1000,
          users: [{ id: 'local-user', tokenFile: './user.token', allowedAgents: [], diagnostics: true }],
          connectors: [{ id: 'local-edge', tokenFile: './edge.token', allowedAgents: [] }] },
        edge: { role: 'edge', devInsecure: true, hubUrl: 'http://127.0.0.1:4317', connectorId: 'local-edge', tokenFile: './edge.token', device: 'local', dataDir: './edge-data', agents: [] },
        client: { role: 'client', devInsecure: true, hubUrl: 'http://127.0.0.1:4317', tokenFile: './user.token' } };
    }
    settings.agents = settings.agents.map(a => this.normalize(a, settings.deviceId));
    this.write(settings, 0); return settings;
  }
  normalize(raw: unknown, deviceId: string): OpenCodeConfig {
    const a = opencodeSchema.parse(raw);
    let workspace: string;
    try { workspace = realpathSync(a.workspace); if (!statSync(workspace).isDirectory()) throw new Error(); }
    catch { throw new BridgeError('WORKSPACE_UNAVAILABLE', '项目目录必须存在'); }
    return { ...a, workspace, passwordFile: resolve(this.directory, a.passwordFile), executable: a.executable.includes('/') ? resolve(a.executable) : a.executable,
      resourceKey: resourceKey(workspace, deviceId), revision: a.revision || 1 };
  }
  write(next: Settings, expectedRevision: number): void {
    const lock = new Database(this.directory, 'settings-lock.sqlite');
    try {
      const current = this.exists() ? this.read().revision : 0;
      if (current !== expectedRevision) throw new BridgeError('REVISION_CONFLICT', '配置已被另一个操作更新，请重新读取', 409);
      if (next.revision !== current + 1) throw new BridgeError('REVISION_INVALID', '新版配置版本必须递增一次', 409);
      const parsed = manifestSchema.parse(next);
      const ids = parsed.agents.map(a => a.agentId);
      if (new Set(ids).size !== ids.length) throw new BridgeError('DUPLICATE_ID', '连接 ID 必须唯一', 409);
      const resources = parsed.agents.filter(a => a.enabled).map(a => a.resourceKey);
      if (new Set(resources).size !== resources.length) throw new BridgeError('DUPLICATE_PROJECT', '同一本机项目只能有一个启用连接', 409);
      const temp = this.path + '.' + randomUUID() + '.tmp';
      writeFileSync(temp, JSON.stringify(parsed, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      const file = openSync(temp, 'r+'); try { fsyncSync(file); } finally { closeSync(file); }
      renameSync(temp, this.path);
      // Windows FlushFileBuffers needs a writable file handle and cannot flush a directory.
      if (process.platform !== 'win32') {
        const dir = openSync(this.directory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      }
    } finally { lock.close(); }
  }
  hub(settings: Settings) {
    const ids = settings.agents.map(a => a.agentId);
    const originalIds = (settings.legacy?.edge as { agents?: { agentId: string }[] } | undefined)?.agents?.map(a => a.agentId) || [];
    const addedIds = ids.filter(id => !originalIds.includes(id));
    const owner = this.owner(settings);
    return configData({ ...settings.hub,
      users: (settings.hub.users as Record<string, unknown>[]).map(u => u.id === owner ? { ...u, allowedAgents: [...new Set([...(u.allowedAgents as string[]), ...addedIds])] } : u),
      connectors: (settings.hub.connectors as Record<string, unknown>[]).map(c => c.id === settings.edge.connectorId ? { ...c, allowedAgents: ids } : c) }, this.directory, 'hub');
  }
  owner(settings: Settings): string | undefined {
    const token = this.client(settings, 'http://127.0.0.1:4317').token;
    const user = (settings.hub.users as Record<string, unknown>[]).find(u => readFileSync(resolve(this.directory, String(u.tokenFile)), 'utf8').trim() === token);
    return user ? String(user.id) : undefined;
  }
  storage(settings: Settings) {
    const raw = hubSchema.omit({ users: true, connectors: true }).strip().parse(settings.hub);
    return { dataDir: resolve(this.directory, raw.dataDir), maxEventBytes: raw.maxEventBytes, maxEventsPerTask: raw.maxEventsPerTask };
  }
  edge(settings: Settings, hubUrl: string) { return configData({ ...settings.edge, agents: settings.agents, hubUrl }, this.directory, 'edge'); }
  client(settings: Settings, hubUrl: string) { return configData({ ...settings.client, hubUrl }, this.directory, 'client'); }
}
