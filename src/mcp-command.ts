import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BridgeError, idSchema } from './core.js';
import { safeTerminal } from './terminal.js';

const subcommands = ['status', 'export', 'install', 'remove', 'revoke', 'probe', 'attach', 'operation', 'nodes'] as const;
type Subcommand = (typeof subcommands)[number];

export interface McpCommandOptions {
  node?: string | undefined;
  adapter?: string | undefined;
  profileDir?: string | undefined;
  /** DSH native profile name; required to manage the DSH CLI patch layer. */
  profile?: string | undefined;
  operationId?: string | undefined;
  json: boolean;
}

interface CoordinatorClientLike {
  open?(): Promise<void>;
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;
  close(): void;
  info?: { capabilities?: unknown; version?: string; pid?: number };
}
type CoordinatorClientConstructor = new (options: {
  directory: string;
  version: string;
  bridgeDirectory: string;
  packageDirectory?: string;
}) => CoordinatorClientLike;
interface DesktopBackend {
  Client: CoordinatorClientConstructor;
  supportsMcpOpenAccess: (capabilities: unknown) => boolean;
}

const adapterNames: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
  opendesk: 'OpenDesk CLI',
  'opendesk-desktop': 'OpenDesk Desktop',
  dsh: 'DSH CLI',
  'dsh-web': 'DSH Web',
  'dsh-desktop': 'DSH Desktop',
  hermes: 'Hermes',
  pi: 'Pi',
};
const fileFormats: [string, string][] = [
  ['json', '通用 MCP JSON'],
  ['codex', 'Codex TOML'],
  ['opencode', 'OpenCode JSONC'],
  ['opendesk', 'OpenDesk 原生 MCP JSON'],
  ['dsh', 'DSH 补丁 YAML'],
];
const stateLabels: Record<string, string> = {
  installed: '已安装（原生配置已写入）',
  exported: '已导出（原生配置未写入）',
  absent: '未配置',
  conflict: '配置冲突（保留其他同名条目）',
  revoked: '已撤销授权',
  revoked_config_pending: '已撤销授权，原生配置待清理',
  unsupported: '不支持（无可管理的原生配置路径）',
};
const configFacts: Record<string, string> = {
  present: '原生配置存在', absent: '原生配置不存在', conflict: '同名条目冲突',
  unsupported: '无可管理的原生路径', unknown: '无法读取',
};
const loadFacts: Record<string, string> = {
  loaded: '已加载', not_loaded: '未加载', reload_required: '需要原生重新加载或重开',
  unsupported: '不支持', unknown: '未知',
};
const connectionFacts: Record<string, string> = {
  connected: '已连接', disconnected: '未连接', revoked: '已撤销', unknown: '未知',
};
const toolsFacts: Record<string, string> = {
  available: '可用', unauthorized: '未授权', unavailable: '不可用', unknown: '未知',
};
const authorizationFacts: Record<string, string> = {
  valid: '有效', revoked: '已撤销', unknown: '未知',
};
const ownershipFacts: Record<string, string> = {
  bridge: 'Bridge 写入', external: '其他同名条目', unconfirmed: '无法确认',
};
// Backend refusals stay refusals: retrying them as bad input would hide a real
// configuration or authorization conflict.
const refusalCodes = new Set([
  'MCP_CONFIG_CONFLICT', 'MCP_REVOKED', 'MCP_UNSUPPORTED', 'MCP_NATIVE_CONFIG_UNSUPPORTED',
  'MCP_BACKEND_UPGRADE_REQUIRED', 'ADAPTER_UNSUPPORTED', 'COLLABORATION_FORBIDDEN',
  'COORDINATOR_UPGRADE_REQUIRED', 'REVISION_CONFLICT', 'OPERATION_CONFLICT', 'DAEMON_MAINTENANCE',
  'MCP_NATIVE_TARGET_CHANGED',
]);
const inputCodes = new Set([
  'INVALID_INPUT', 'INVALID_ARGUMENT', 'INVALID_MCP_PARAMS', 'MCP_CONFIG_INVALID',
  'MCP_PROFILE_MISSING', 'MCP_STATE', 'MCP_DSH_PROFILE_REQUIRED',
  'MCP_DSH_DESKTOP_TARGET',
  'AUTH_REQUIRED', 'COORDINATOR_IDENTITY', 'NODE_NOT_FOUND', 'MCP_NOT_CONFIGURED',
]);
const secretKey = /token|secret|bearer|authorization|password|privatekey|apikey|credential|configuration/i;

function isSubcommand(value: string | undefined): value is Subcommand {
  return value !== undefined && (subcommands as readonly string[]).includes(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '命令失败，请核对参数与后台状态。';
}
function factsOf(result: Record<string, unknown>): Record<string, unknown> {
  return isRecord(result.facts) ? result.facts : {};
}
function evidenceOf(result: Record<string, unknown>): Record<string, unknown> {
  return isRecord(result.evidence) ? result.evidence : {};
}

// src/ (tsx) and dist/ (compiled) are both siblings of desktop/, so one level up
// is the same bridge root in development, in a checkout and in the packaged
// resources/bridge layout. An explicit override keeps tests and relocated
// installs from guessing.
function bridgeDirectory(): string {
  const override = process.env.AGENTBRIDGE_BRIDGE_DIR?.trim();
  if (override) return resolve(override);
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function installedDesktopVersion(root: string): string {
  for (const file of [join(root,'desktop','package.json'),join(root,'..','linux-package','manifest.json')]) {
    try {
      const manifest = JSON.parse(readFileSync(file, 'utf8')) as {version?:unknown};
      if(typeof manifest.version==='string'&&manifest.version.length<=64)return manifest.version;
    }catch { /* Try the packaged manifest, never invent a runtime version. */ }
  }
  throw new BridgeError('DESKTOP_BACKEND_INVALID','无法确认桌面后台版本，请使用完整安装目录。',503);
}

function coordinatorProfileDirectory(): string {
  if(process.env.AGENTBRIDGE_DESKTOP_PROFILE?.trim())return process.env.AGENTBRIDGE_DESKTOP_PROFILE.trim();
  const home = homedir();
  if (process.platform === 'win32') return join(process.env.APPDATA?.trim() || join(home, 'AppData', 'Roaming'), 'agentbridge-desktop');
  if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'agentbridge-desktop');
  return join(process.env.XDG_CONFIG_HOME?.trim() || join(home, '.config'), 'agentbridge-desktop');
}

function loadDesktopBackend(root: string): DesktopBackend {
  const electron = join(root, 'desktop', 'electron');
  const coordinator = join(electron, 'coordinator-client.cjs');
  const capabilities = join(electron, 'runtime-capabilities.cjs');
  if (!existsSync(coordinator) || !existsSync(capabilities))
    throw new BridgeError('DESKTOP_BACKEND_MISSING', '未找到 AgentBridge 桌面后台组件（' + electron + '）。请安装完整的 AgentBridge 桌面程序；从源码运行时先执行 npm run build，或设置 AGENTBRIDGE_BRIDGE_DIR 指向包含 desktop/electron 的安装目录。', 503);
  try {
    const require = createRequire(import.meta.url);
    const loaded = require(coordinator) as { CoordinatorClient?: unknown };
    const runtime = require(capabilities) as { supportsMcpOpenAccess?: unknown };
    if (typeof loaded.CoordinatorClient !== 'function' || typeof runtime.supportsMcpOpenAccess !== 'function')
      throw new Error('后台组件未导出所需接口');
    return {
      Client: loaded.CoordinatorClient as CoordinatorClientConstructor,
      supportsMcpOpenAccess: runtime.supportsMcpOpenAccess as (capabilities: unknown) => boolean,
    };
  } catch (error) {
    throw new BridgeError('DESKTOP_BACKEND_INVALID', '桌面后台组件无法加载：' + messageOf(error) + '。请重新安装 AgentBridge 桌面程序。', 503);
  }
}

function asBridgeError(error: unknown): BridgeError {
  if (error instanceof BridgeError) return error;
  const code = isRecord(error) && typeof error.code === 'string' && error.code ? error.code : 'MCP_COMMAND_FAILED';
  const message = messageOf(error);
  if (code === 'COORDINATOR_TIMEOUT') return new BridgeError(code, message, 408);
  if (refusalCodes.has(code)) return new BridgeError(code, message, 409);
  if (inputCodes.has(code)) return new BridgeError(code, message, 400);
  if (code === 'COORDINATOR_TRANSPORT')
    return new BridgeError(code, '无法连接 AgentBridge 中央后台：' + message + ' 请打开桌面程序或检查后台日志；原配置未改动。', 503);
  if (code === 'COORDINATOR_START')
    return new BridgeError(code, '无法启动 AgentBridge 中央后台：' + message + ' 请先打开桌面程序或检查后台诊断日志；未启动任何模型、任务或窗口。', 503);
  return new BridgeError(code, message, 503);
}

function adapterText(adapter: string): string {
  const name = adapterNames[adapter];
  return name ? adapter + '（' + name + '）' : adapter;
}

function factLine(label: string, labels: Record<string, string>, value: unknown): string {
  const key = text(value);
  return label + '：' + (key ? labels[key] ?? key : '未知');
}

function header(result: Record<string, unknown>, nodeId: string, adapter: string): string[] {
  return [
    '节点：' + (text(result.nodeId) ?? nodeId),
    '适配器：' + adapterText(text(result.adapter) ?? adapter),
  ];
}

function stateText(result: Record<string, unknown>): string {
  const state = text(result.state);
  if (state) return stateLabels[state] ?? state;
  if (result.conflict === true) return stateLabels.conflict!;
  if (result.installed === true) return stateLabels.installed!;
  return result.enabled === true ? stateLabels.exported! : stateLabels.absent!;
}

function configPath(result: Record<string, unknown>): string | undefined {
  return text(result.configPath) ?? text(evidenceOf(result).configPath);
}

function nativeText(result: Record<string, unknown>): string {
  const facts = factsOf(result);
  const config = text(facts.config);
  const path = configPath(result);
  const at = path ? '（' + path + '）' : '';
  if (config === 'present') return '存在' + at;
  if (config === 'conflict') return '冲突（保留其他同名条目）' + at;
  if (config === 'unsupported') return '该产品无可管理的原生配置路径';
  if (config === 'absent') return '不存在' + at;
  if (config === 'unknown') return '无法读取' + at + '（原配置保留）';
  if (result.conflict === true) return '已保留其他同名条目' + at;
  if (result.installed === true) return '已写入' + at;
  return result.enabled === true ? '未写入' + at + '，等待原生加载或重新打开 Agent' : '未写入' + at;
}

function fileLines(files: unknown): string[] {
  if (!isRecord(files)) return [];
  const entries = Object.entries(files).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1]);
  const known = new Set(fileFormats.map(([key]) => key));
  const ordered: [string, string][] = [];
  for (const [key, label] of fileFormats) {
    const found = entries.find(([name]) => name === key);
    if (found) ordered.push([label, found[1]]);
  }
  for (const [key, value] of entries.sort((a, b) => a[0].localeCompare(b[0]))) if (!known.has(key)) ordered.push([key, value]);
  return ordered.map(([label, file]) => label + '：' + file);
}

function filesSection(files: unknown): string[] {
  const lines = fileLines(files);
  return lines.length ? ['独立配置文件：', ...lines.map(line => '  ' + line)] : [];
}

function probeEvidenceText(result: Record<string, unknown>): string | undefined {
  const evidence = evidenceOf(result);
  const nativeProbe = isRecord(evidence.nativeProbe) ? evidence.nativeProbe : undefined;
  const toolsProbe = isRecord(evidence.toolsProbe) ? evidence.toolsProbe : undefined;
  const parts: string[] = [];
  if (nativeProbe) {
    const kind = text(nativeProbe.kind);
    if (kind && kind !== 'none') {
      parts.push([kind, text(nativeProbe.outcome), text(nativeProbe.command)].filter(Boolean).join(' · '));
    }
  }
  if (toolsProbe) {
    const count = typeof toolsProbe.toolCount === 'number' ? toolsProbe.toolCount : undefined;
    parts.push('tools ' + (text(toolsProbe.outcome) ?? 'unknown') + (count === undefined ? '' : ' · ' + count + ' 个'));
  }
  const error = isRecord(evidence.configError) ? evidence.configError : undefined;
  if (error) parts.push('配置错误 ' + [text(error.code), text(error.message)].filter(Boolean).join(': '));
  const observation=isRecord(evidence.observation)?evidence.observation:undefined;
  if(observation)parts.push('观测：'+(text(observation.observedAt)??'未探测')+' · '+(text(observation.freshness)??'unknown')+(observation.reason?' · '+String(observation.reason):''));
  return parts.length ? parts.join('；') : undefined;
}

function statusFacts(result: Record<string, unknown>): string[] {
  const facts = factsOf(result);
  const lines = [
    factLine('配置', configFacts, facts.config),
    factLine('原生加载', loadFacts, facts.nativeLoad),
    factLine('连接', connectionFacts, facts.connection),
    factLine('工具', toolsFacts, facts.tools),
    factLine('接入授权', authorizationFacts, facts.authorization),
    factLine('配置归属', ownershipFacts, facts.ownership),
  ];
  const path = configPath(result);
  if (path) lines.push('原生配置：' + path);
  if (result.adapter === 'dsh-desktop' && text(result.profile)) lines.push('DSH Desktop Profile：' + text(result.profile));
  const configError = evidenceOf(result).configError;
  if (isRecord(configError) && text(configError.message)) lines.push('配置核对：' + text(configError.message));
  if (result.nativeTargetChanged === true && text(result.currentConfigPath)) lines.push('当前原生配置：' + text(result.currentConfigPath) + '；移除只清理原接入目标');
  if (result.nativeSupport === false) {
    const reason = text(result.nativeSupportReason);
    lines.push('原生配置路径：该产品暂无可管理的原生配置路径' + (reason ? '（' + reason + '）' : ''));
  }
  const evidence = probeEvidenceText(result);
  if (evidence) lines.push('探查证据：' + evidence);
  return lines;
}

function statusText(result: Record<string, unknown>, nodeId: string, adapter: string): string {
  const lines = header(result, nodeId, adapter);
  lines.push('状态：' + stateText(result));
  lines.push(...statusFacts(result));
  lines.push(...filesSection(result.files));
  return lines.join('\n');
}

function exportText(result: Record<string, unknown>, nodeId: string, adapter: string): string {
  const lines = header(result, nodeId, adapter);
  lines.push('结果：已生成标准配置片段，未写入原生配置');
  if (result.nativeSupport === false) {
    const reason = text(result.nativeSupportReason);
    lines.push('原生配置：该产品暂无可管理的原生配置路径，请按其原生文档添加' + (reason ? '（' + reason + '）' : ''));
  } else {
    const path = configPath(result);
    if (path) lines.push('原生配置入口：' + path + '（未修改）');
  }
  lines.push(...filesSection(result.files));
  lines.push('说明：只准备配置与身份引用；在 Agent 中添加后用 mcp status 核对，不伪造原生已安装。');
  return lines.join('\n');
}

function installText(result: Record<string, unknown>, nodeId: string, adapter: string): string {
  const lines = header(result, nodeId, adapter);
  const facts = factsOf(result);
  const load = text(facts.nativeLoad);
  const installed = result.installed === true || text(result.state) === 'installed';
  lines.push('结果：' + (installed
    ? load === 'reload_required'
      ? '已写入原生配置，需要原生 Agent 重新加载或重开'
      : '已写入原生配置，请在原生 Agent 重新加载或重开'
    : '配置已准备，原生配置状态待核对'));
  lines.push('原生配置：' + nativeText(result));
  lines.push(...filesSection(result.files));
  return lines.join('\n');
}

function removeText(result: Record<string, unknown>, nodeId: string, adapter: string): string {
  const lines = header(result, nodeId, adapter);
  const state = text(result.state);
  const facts = factsOf(result);
  const config = text(facts.config);
  const path = configPath(result);
  const at = path ? '（' + path + '）' : '';
  const revoked = text(facts.authorization) === 'revoked' || result.enabled === false;
  const cleanupError = isRecord(result.cleanupError) ? result.cleanupError : undefined;
  if (state === 'revoked_config_pending') {
    lines.push('接入授权：已撤销');
    lines.push('原生配置：' + (config === 'conflict' ? '冲突条目保留' : '待清理') + at);
    lines.push('结果：已撤销授权，原生配置待清理');
    if (cleanupError) lines.push('清理错误：' + [text(cleanupError.code), text(cleanupError.message)].filter(Boolean).join(': '));
  } else if (state === 'unsupported') {
    lines.push('接入授权：' + (revoked ? '已撤销' : '状态待核对'));
    lines.push('原生配置：该产品无可管理的原生配置条目（未删除）');
    lines.push('结果：已撤销授权；未改动原生配置');
  } else if (state === 'absent' && revoked && config === 'conflict') {
    lines.push('接入授权：已撤销');
    lines.push('原生配置：保留' + at + '（检测到其他同名条目，未删除）');
    lines.push('结果：已撤销授权，原生配置未删除');
  } else if (state === 'absent' && revoked) {
    lines.push('接入授权：已撤销');
    lines.push('原生配置：已移除' + at);
    lines.push('结果：已撤销授权并移除原生配置');
  } else if (state === 'conflict' || config === 'conflict' || result.conflict === true) {
    lines.push('接入授权：' + (revoked ? '已撤销' : '状态待核对'));
    lines.push('原生配置：保留' + at + '（检测到其他同名条目，未删除）');
    lines.push('结果：已撤销授权，原生配置未删除');
  } else if (state === 'absent' && !revoked) {
    lines.push('接入授权：未发现 Bridge 登记');
    lines.push('原生配置：未改动' + at);
    lines.push('结果：未发现可撤销的接入，原生配置未改动');
  } else {
    lines.push(factLine('接入授权', authorizationFacts, facts.authorization));
    lines.push('原生配置：' + nativeText(result));
    lines.push('结果：未能确认移除完成，请使用 mcp status 重新核对原状态');
  }
  return lines.join('\n');
}

function revokeText(result: Record<string, unknown>, nodeId: string, adapter: string): string {
  const lines = header(result, nodeId, adapter);
  const state = text(result.state);
  const facts = factsOf(result);
  const config = text(facts.config);
  const path = configPath(result);
  const at = path ? '（' + path + '）' : '';
  const revoked = text(facts.authorization) === 'revoked' || result.revoked === true || result.enabled === false
    || state === 'revoked' || state === 'revoked_config_pending';
  if (!revoked) {
    lines.push('接入授权：状态待核对');
    lines.push('结果：未能确认授权已撤销，请使用 mcp status 重新核对；原配置未删除');
    return lines.join('\n');
  }
  lines.push('接入授权：已撤销');
  if (state === 'unsupported') {
    lines.push('原生配置：该产品无可管理的原生配置条目（未删除）');
    lines.push('结果：已撤销授权；未改动原生配置');
  } else if (state === 'revoked_config_pending') {
    lines.push('原生配置：保留（未删除）' + at);
    lines.push('结果：已撤销授权，原生配置待清理');
  } else if (config === 'absent') {
    lines.push('原生配置：已不存在' + at);
    lines.push('结果：已撤销授权，原生配置已不存在');
  } else {
    lines.push('原生配置：保留（未删除）' + at);
    lines.push('结果：已撤销授权，原生配置保留');
  }
  return lines.join('\n');
}

function probeText(result: Record<string, unknown>, nodeId: string, adapter: string): string {
  const lines = header(result, nodeId, adapter);
  lines.push('状态：' + stateText(result));
  lines.push(...statusFacts(result));
  if (result.nativeSupport === false) {
    lines.push('说明：该产品未提供可核验的原生 MCP 配置；本身仍可在原生侧使用 MCP。');
  }
  return lines.join('\n');
}

function render(sub: Subcommand, result: Record<string, unknown>, nodeId: string, adapter: string): string {
  if (sub === 'status') return statusText(result, nodeId, adapter);
  if (sub === 'export') return exportText(result, nodeId, adapter);
  if (sub === 'install') return installText(result, nodeId, adapter);
  if (sub === 'remove') return removeText(result, nodeId, adapter);
  if (sub === 'revoke') return revokeText(result, nodeId, adapter);
  return probeText(result, nodeId, adapter);
}

// --json is a raw status object, but tokens, endpoint descriptors and native
// configuration content must never reach stdout.
function sanitizeString(value: string): string {
  if (/^Bearer\s/i.test(value) || /^[a-f0-9]{64}$/i.test(value) || /^[A-Za-z0-9_-]{43}$/.test(value)) return '[redacted]';
  return value.replace(/\b(token|secret|bearer|password|authorization)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]');
}
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]';
  if (Array.isArray(value)) return value.map(item => sanitize(item, depth + 1));
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const authorizationFact = key === 'authorization' && ['valid', 'revoked', 'unknown'].includes(String(item));
      result[key] = secretKey.test(key) && !authorizationFact ? '[redacted]' : sanitize(item, depth + 1);
    }
    return result;
  }
  if (typeof value === 'string') return sanitizeString(value);
  return value;
}

async function resolveAdapter(call: (method: string, params: Record<string, unknown>) => Promise<unknown>, nodeId: string): Promise<string> {
  const snapshot = await call('snapshot', {});
  const nodes = isRecord(snapshot) && Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  const matches = nodes.filter((node): node is Record<string, unknown> => isRecord(node) && node.nodeId === nodeId);
  if (matches.length === 0)
    throw new BridgeError('NODE_NOT_FOUND', '未找到 Agent 节点：' + nodeId + '。请先在桌面端接入该节点，或显式指定 --adapter。', 400);
  if (matches.length > 1)
    throw new BridgeError('NODE_AMBIGUOUS', '找到多个使用同一 ID 的 Agent 节点，无法安全选择；请显式指定 --adapter。', 400);
  const adapter = matches[0]?.adapter;
  if (typeof adapter !== 'string' || !adapter)
    throw new BridgeError('NODE_ADAPTER_UNKNOWN', '节点 ' + nodeId + ' 未提供可用的适配器信息；请显式指定 --adapter。', 400);
  return adapter;
}

export async function runMcpCommand(options: McpCommandOptions, positionals: string[]): Promise<number> {
  const sub = positionals[1];
  if (positionals.length !== 2 || !isSubcommand(sub))
    throw new BridgeError('INVALID_ARGUMENT', '用法：agentbridge mcp status|export|install|remove|revoke|probe|attach|operation|nodes --node NODE_ID [--operation-id ID] [--adapter ADAPTER] [--profile NAME] [--json] [--profile-dir DIR]');
  const nodeId = options.node?.trim();
  if (!nodeId && sub!=='nodes') throw new BridgeError('INVALID_ARGUMENT', 'mcp ' + sub + ' 需要 --node NODE_ID');
  if (sub!=='nodes' && !idSchema.safeParse(nodeId).success) throw new BridgeError('INVALID_ARGUMENT', '节点 ID 需为 1–128 位字母、数字或 . _ : -');
  const management=sub==='attach'||sub==='operation',operationId=options.operationId?.trim();
  if(management&&!idSchema.safeParse(operationId).success)throw new BridgeError('INVALID_ARGUMENT','mcp '+sub+' 需要稳定的 --operation-id ID；回应未知时用同一 ID 查询 operation，不能重新生成 ID 接入。');
  if(!management&&options.operationId!==undefined)throw new BridgeError('INVALID_ARGUMENT','--operation-id 仅用于 mcp attach/operation');
  if (options.adapter !== undefined && !options.adapter.trim()) throw new BridgeError('INVALID_ARGUMENT', '--adapter 需要非空适配器名称');
  if (options.profileDir !== undefined && !options.profileDir.trim()) throw new BridgeError('INVALID_ARGUMENT', '--profile-dir 需要非空目录');
  const profile = options.profile?.trim();
  if (options.profile !== undefined && !profile) throw new BridgeError('INVALID_ARGUMENT', '--profile 需要非空 DSH profile 名称');
  if (profile !== undefined && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(profile))
    throw new BridgeError('INVALID_ARGUMENT', 'DSH profile 名称只能包含小写字母、数字和连字符（1–64 位）');

  const root = bridgeDirectory();
  const backend = loadDesktopBackend(root);
  const directory = resolve(options.profileDir?.trim() || coordinatorProfileDirectory());
  const packageDirectory = [join(root, "..", "linux-package"), join(root, "desktop", ".linux-package")].find(path => existsSync(join(path, "manifest.json")));
  const client = new backend.Client({ directory, version: installedDesktopVersion(root), bridgeDirectory: root, ...(packageDirectory ? { packageDirectory } : {}) });
  // The coordinator dispatch returns {ok, result} / {ok:false, error}; unwrap it
  // so the command never renders the envelope as if it were status facts.
  const call = async (method: string, params: Record<string, unknown>): Promise<unknown> => {
    const reply = await client.request('call', { method, params });
    if (!isRecord(reply) || typeof reply.ok !== 'boolean')
      throw new BridgeError('MCP_RESPONSE_INVALID', '后台回应格式无法识别，请重新查询。', 503);
    if (!reply.ok) {
      const failure = isRecord(reply.error) ? reply.error : {};
      const code = text(failure.code) ?? 'MCP_COMMAND_FAILED';
      throw Object.assign(new Error(text(failure.message) ?? '后台请求未完成。'), { code });
    }
    return reply.result;
  };
  try {
    // The coordinator may be cold; open (and spawn) it before capability checks.
    await client.open?.();
    if(sub==='nodes'){
      const snapshot=await call('snapshot',{}),nodes=isRecord(snapshot)&&Array.isArray(snapshot.nodes)?snapshot.nodes:[];
      const items=nodes.filter(isRecord).map(n=>({nodeId:n.nodeId,machineId:n.machineId,adapter:n.adapter,name:n.name,connected:n.connected,healthy:n.healthy,removed:n.removed}));
      console.log(safeTerminal(options.json?JSON.stringify({nodes:items}):items.map(n=>[n.nodeId,n.adapter,n.name,n.connected?'已接入':'待接入'].join(' · ')).join('\n')||'未发现节点，请核对目标环境安装。'));
      return 0;
    }
    if(!nodeId)throw new BridgeError('INVALID_ARGUMENT','需要 --node NODE_ID');
    if (sub !== 'status' && !backend.supportsMcpOpenAccess(client.info?.capabilities))
      throw new BridgeError('MCP_BACKEND_UPGRADE_REQUIRED', '当前中央后台缺少MCP开放接入能力，请在设置 → 后台运行中停止后台并退出，再打开新版 AgentBridge；原配置与授权未改动。', 409);
    if(management){
      const result=await call(sub==='attach'?'manageNode':'nodeOperation',sub==='attach'?{nodeId,operationId,action:'attach'}:{nodeId,operationId});
      if(!isRecord(result))throw new BridgeError('MCP_RESPONSE_INVALID','接入回应格式无法识别，请按原operation-id查询。',408);
      const matched=result.operationId===operationId,state=matched?result.state:'unknown';
      console.log(safeTerminal(options.json?JSON.stringify(sanitize(result)):'节点：'+nodeId+'\n原操作：'+operationId+'\n接入状态：'+String(state)+(state==='confirmed'?'\n接入已确认；现在可 export/install，不会自动提交模型需求。':'\n请使用 mcp operation --node '+nodeId+' --operation-id '+operationId+' 查询原操作，不重发接入。')));
      return state==='confirmed'?0:state==='rejected'?4:3;
    }
    const adapter = options.adapter?.trim() || await resolveAdapter(call, nodeId);
    const params: Record<string, unknown> = { nodeId, adapter };
    if (profile !== undefined) params.profile = profile;
    const result = await call('mcp.' + sub, params);
    if (!isRecord(result)) throw new BridgeError('MCP_RESPONSE_INVALID', '后台返回的 MCP 状态无法识别，请重新查询。', 503);
    console.log(safeTerminal(options.json ? JSON.stringify(sanitize(result)) : render(sub, result, nodeId, adapter)));
    return 0;
  } catch (error) {
    const mapped = asBridgeError(error);
    // main() has no mapping to 3; a coordinator timeout is an unknown outcome,
    // not a business refusal or a missing service.
    if (mapped.httpStatus === 408) { console.error(safeTerminal(mapped.code + ': ' + mapped.message)); return 3; }
    throw mapped;
  } finally { client.close(); }
}
