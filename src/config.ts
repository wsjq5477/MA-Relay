import { z } from 'zod';
import { mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync, statSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { BridgeError, idSchema } from './core.js';

const positive = z.number().int().positive();
const common = { devInsecure: z.literal(true) };
const secret = { tokenFile: z.string().min(1) };
const clientIdentity = z.object({
  id: idSchema, ...secret, allowedAgents: z.array(idSchema), diagnostics: z.boolean().default(false),
}).strict();
const connectorIdentity = z.object({ id: idSchema, ...secret, allowedAgents: z.array(idSchema).min(1) }).strict();
export const hubSchema = z.object({
  role: z.literal('hub'), ...common, host: z.enum(['127.0.0.1', 'localhost', '::1']).default('127.0.0.1'),
  port: z.number().int().min(0).max(65535).default(4317), dataDir: z.string().min(1),
  users: z.array(clientIdentity).min(1), connectors: z.array(connectorIdentity).min(1),
  heartbeatTimeoutMs: positive.min(200).default(4000),
  handshakeTimeoutMs: positive.min(200).default(5000),
  maxMessageBytes: positive.max(65536).default(65536),
  maxEventBytes: positive.max(65536).default(4096),
  maxEventsPerTask: positive.min(8).max(1000).default(128),
}).strict();
const hubUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
}, 'I01 requires a loopback http URL without credentials, path or query');
export const mockSchema = z.object({
  agentId: idSchema, name: z.string().min(1).max(100), adapter: z.literal('mock'),
  mode: z.enum(['success', 'failure']).default('success'),
  delayMs: z.number().int().min(0).max(3600000).default(200),
  healthy: z.boolean().default(true),
}).strict();
export const opencodeSchema = z.object({
  agentId: idSchema, name: z.string().min(1).max(100), adapter: z.literal('opencode'),
  serverUrl: hubUrl, passwordFile: z.string().min(1), workspace: z.string().min(1),
  executable: z.string().min(1).default('opencode'), managed: z.boolean().default(true),
  nativeAgent: z.string().min(1).default('build'),
  enabled: z.boolean().default(true), resourceKey: z.string().optional(), revision: positive.optional(),
  model: z.object({ providerID: z.string().min(1), id: z.string().min(1), variant: z.string().optional() }).strict().optional(),
  inheritNativeCli: z.literal(true).optional(),
  permissions: z.array(z.object({ action: z.string().min(1), resource: z.string().min(1), effect: z.enum(['ask', 'deny']) }).strict()).optional(),
  pollMs: positive.min(50).default(500), taskTimeoutMs: positive.min(1000).default(1800000),
}).strict();
export const edgeSchema = z.object({
  role: z.literal('edge'), ...common, hubUrl, connectorId: idSchema, ...secret,
  device: z.string().min(1).max(100), dataDir: z.string().min(1),
  heartbeatMs: positive.min(50).default(1000),
  agents: z.array(z.discriminatedUnion('adapter', [mockSchema, opencodeSchema])).min(1).max(100),
}).strict();
export const clientSchema = z.object({
  role: z.literal('client'), ...common, hubUrl, ...secret,
  requestTimeoutMs: positive.default(5000),
}).strict();
export type HubConfig = Omit<z.infer<typeof hubSchema>, 'users' | 'connectors'> & { users: (z.infer<typeof clientIdentity> & { token: string })[]; connectors: (z.infer<typeof connectorIdentity> & { token: string })[] };
export type EdgeConfig = z.infer<typeof edgeSchema> & { token: string };
export type ClientConfig = z.infer<typeof clientSchema> & { token: string };
export type MockConfig = z.infer<typeof mockSchema>;
export type OpenCodeConfig = z.infer<typeof opencodeSchema>;
export function loadConfig(path: string, role: 'hub'): HubConfig;
export function loadConfig(path: string, role: 'edge'): EdgeConfig;
export function loadConfig(path: string, role: 'client'): ClientConfig;
export function loadConfig(path: string, role: 'hub' | 'edge' | 'client'): HubConfig | EdgeConfig | ClientConfig {
  const absolute = resolve(path);
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(absolute, 'utf8')); }
  catch { throw new BridgeError('CONFIG_READ', 'Cannot read valid JSON configuration: ' + absolute); }
  return configData(raw, dirname(absolute), role);
}
export function configData(raw: unknown, dir: string, role: 'hub'): HubConfig;
export function configData(raw: unknown, dir: string, role: 'edge'): EdgeConfig;
export function configData(raw: unknown, dir: string, role: 'client'): ClientConfig;
export function configData(raw: unknown, dir: string, role: 'hub' | 'edge' | 'client'): HubConfig | EdgeConfig | ClientConfig;
export function configData(raw: unknown, dir: string, role: 'hub' | 'edge' | 'client'): HubConfig | EdgeConfig | ClientConfig {
  const schema = role === 'hub' ? hubSchema : role === 'edge' ? edgeSchema : clientSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new BridgeError('CONFIG_INVALID', 'Invalid configuration fields: ' + parsed.error.issues.map(i => i.path.join('.') || 'root').join(', '));
  const getToken = (file: string) => {
    try {
      const token = readFileSync(resolve(dir, file), 'utf8').trim();
      if (token.length < 32 || token.length > 4096) throw new Error();
      return token;
    } catch { throw new BridgeError('CREDENTIAL_UNAVAILABLE', 'Credential file is missing or invalid'); }
  };
  if (parsed.data.role === 'hub') {
    const c = parsed.data;
    const ids = [...c.users.map(u => u.id), ...c.connectors.map(u => u.id)];
    const bound = c.connectors.flatMap(u => u.allowedAgents);
    if (new Set(ids).size !== ids.length || new Set(bound).size !== bound.length) throw new BridgeError('CONFIG_DUPLICATE', 'Identity and Agent bindings must be unique');
    const users = c.users.map(u => ({ ...u, token: getToken(u.tokenFile) }));
    const connectors = c.connectors.map(u => ({ ...u, token: getToken(u.tokenFile) }));
    const tokens = [...users, ...connectors].map(u => u.token);
    if (new Set(tokens).size !== tokens.length) throw new BridgeError('CONFIG_DUPLICATE', 'Identity credentials must be unique');
    return { ...c, dataDir: resolve(dir, c.dataDir), users, connectors };
  }
  if (parsed.data.role === 'edge') {
    const c = parsed.data;
    if (new Set(c.agents.map(a => a.agentId)).size !== c.agents.length) throw new BridgeError('CONFIG_DUPLICATE', 'Agent IDs must be unique');
    const agents = c.agents.map(a => a.adapter === 'mock' ? a : {
      ...a, workspace: resolve(dir, a.workspace), passwordFile: resolve(dir, a.passwordFile),
      executable: a.executable.includes('/') ? resolve(dir, a.executable) : a.executable,
    });
    return { ...c, agents, dataDir: resolve(dir, c.dataDir), token: getToken(c.tokenFile) };
  }
  return { ...parsed.data, token: getToken(parsed.data.tokenFile) };
}
export function parseNativeModel(value: string): NonNullable<OpenCodeConfig['model']> {
  const slash = value.indexOf('/');
  if (slash <= 0 || slash === value.length - 1 || value.length > 300 || /\s/.test(value)) throw new BridgeError('INVALID_MODEL', 'Model uses provider/model or provider/model#variant');
  const parts = value.slice(slash + 1).split('#');
  const [id, variant] = parts;
  if (!id || value.endsWith('#') || parts.length > 2) throw new BridgeError('INVALID_MODEL', 'Model ID and variant must be nonempty and contain at most one #');
  return { providerID: value.slice(0, slash), id, ...(variant ? { variant } : {}) };
}
export function initOpenCode(directory: string, workspace: string, port = 4317, executable?: string, modelValue?: string): string[] {
  const model = modelValue ? parseNativeModel(modelValue) : undefined;
  let project: string;
  try { project = realpathSync(resolve(workspace)); if (!statSync(project).isDirectory()) throw new Error(); }
  catch { throw new BridgeError('WORKSPACE_UNAVAILABLE', 'Workspace must be an existing directory'); }
  if (port >= 65535) throw new BridgeError('BAD_PORT', 'Hub port must leave room for the native server port');
  const files = initDemo(directory, port);
  const dir = resolve(directory);
  try {
    const json = (name: string, value: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    const hub = JSON.parse(readFileSync(resolve(dir, 'hub.json'), 'utf8'));
    hub.users = [{ id: 'local-user', tokenFile: './user.token', allowedAgents: ['opencode'], diagnostics: true }];
    hub.connectors = [{ id: 'edge-a', tokenFile: './edge-a.token', allowedAgents: ['opencode'] }];
    hub.maxEventBytes = 65536; hub.maxEventsPerTask = 1000;
    json('hub.json', hub);
    const installed = resolve(homedir(), '.opencode/bin/opencode');
    json('edge-a.json', {
      role: 'edge', devInsecure: true, hubUrl: 'http://127.0.0.1:' + port,
      connectorId: 'edge-a', tokenFile: './edge-a.token', device: 'local-opencode', dataDir: './edge-a-data',
      agents: [{ agentId: 'opencode', name: 'OpenCode', adapter: 'opencode', workspace: project,
        serverUrl: 'http://127.0.0.1:' + (port + 1), passwordFile: './native.password',
        ...(model ? { model } : {}),
        executable: executable || (existsSync(installed) ? installed : 'opencode'), managed: true }],
    });
    writeFileSync(resolve(dir, 'RUN.md'), '# 真实 OpenCode\n\n先在原生 OpenCode 配置模型，再运行：\n\nnode dist/cli.js up --dir ' + dir + '\n\n另一个终端：\n\nnode dist/cli.js run opencode "分析这个项目" --watch --config ' + resolve(dir, 'client.json') + '\n', { mode: 0o600 });
    for (const f of ['edge-b.json', 'edge-b.token', 'limited-client.json', 'limited.token']) rmSync(resolve(dir, f));
    return files.filter(f => existsSync(f));
  } catch (e) { rmSync(dir, { recursive: true, force: true }); throw e; }
}
export function initDemo(directory: string, port = 4317): string[] {
  const dir = resolve(directory);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new BridgeError('BAD_PORT', 'Port must be between 1 and 65535');
  try { mkdirSync(dir, { mode: 0o700 }); }
  catch { throw new BridgeError('INIT_EXISTS', 'Cannot create demo directory; existing directories are never overwritten'); }
  try {
    const write = (file: string, data: string) => writeFileSync(resolve(dir, file), data, { mode: 0o600, flag: 'wx' });
    const json = (file: string, data: unknown) => write(file, JSON.stringify(data, null, 2) + '\n');
    for (const name of ['user', 'limited', 'edge-a', 'edge-b']) write(name + '.token', randomBytes(32).toString('hex') + '\n');
    json('hub.json', {
      role: 'hub', devInsecure: true, host: '127.0.0.1', port, dataDir: './hub-data',
      users: [
        { id: 'demo-user', tokenFile: './user.token', allowedAgents: ['mock-a', 'mock-b'], diagnostics: true },
        { id: 'limited-user', tokenFile: './limited.token', allowedAgents: ['mock-a'], diagnostics: false },
      ],
      connectors: [
        { id: 'edge-a', tokenFile: './edge-a.token', allowedAgents: ['mock-a'] },
        { id: 'edge-b', tokenFile: './edge-b.token', allowedAgents: ['mock-b'] },
      ],
    });
    const url = 'http://127.0.0.1:' + port;
    for (const letter of ['a', 'b']) json('edge-' + letter + '.json', {
      role: 'edge', devInsecure: true, hubUrl: url, connectorId: 'edge-' + letter,
      tokenFile: './edge-' + letter + '.token', device: 'local-' + letter, dataDir: './edge-' + letter + '-data',
      agents: [{ agentId: 'mock-' + letter, name: 'Mock ' + letter.toUpperCase(), adapter: 'mock', mode: 'success', delayMs: 200 }],
    });
    json('client.json', { role: 'client', devInsecure: true, hubUrl: url, tokenFile: './user.token' });
    json('limited-client.json', { role: 'client', devInsecure: true, hubUrl: url, tokenFile: './limited.token' });
    write('RUN.md', [
      '# I01 本地演示', '', '从项目目录构建：npm run build。每行服务命令在独立终端运行：', '',
      'node dist/cli.js hub start --config ' + resolve(dir, 'hub.json'),
      'node dist/cli.js connect --config ' + resolve(dir, 'edge-a.json'),
      'node dist/cli.js connect --config ' + resolve(dir, 'edge-b.json'), '',
      'node dist/cli.js agents --config ' + resolve(dir, 'client.json'),
      'node dist/cli.js run mock-a "测试消息" --config ' + resolve(dir, 'client.json'),
      'node dist/cli.js task TASK_ID --watch --config ' + resolve(dir, 'client.json'), '',
      '更改 mode 为 failure 模拟失败，delayMs 设置延迟；重启对应 Edge 生效。',
      '不要共享 *.token 或数据目录。unknown 无自动恢复；CLI 观察退出不取消任务。',
    ].join('\n') + '\n');
    return ['hub.json', 'edge-a.json', 'edge-b.json', 'client.json', 'limited-client.json', 'RUN.md'].map(file => resolve(dir, file));
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}
