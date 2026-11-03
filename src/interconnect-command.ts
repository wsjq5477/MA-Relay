import {readFileSync, statSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {BridgeError} from './core.js';
import {createDesktopCoordinatorClient} from './mcp-command.js';
import {safeTerminal} from './terminal.js';

const methods = new Set([
  'agents.list', 'agents.get', 'agents.register', 'agents.update', 'agents.confirmEndpoint', 'agents.disable', 'agents.operation',
  'callers.list', 'callers.create', 'callers.configure', 'callers.openContext', 'callers.closeContext', 'callers.rotateCredential', 'callers.revoke', 'callers.operation',
]);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export async function runInterconnectCommand(options: {profileDir?: string | undefined; file?: string | undefined; json: boolean}, positionals: string[]): Promise<number> {
  const method = positionals[1];
  if (positionals.length !== 2 || !method || !methods.has(method)) throw new BridgeError('INVALID_ARGUMENT', '用法：agentbridge interconnect agents.*|callers.* --profile-dir ABSOLUTE_DIR [--file PARAMS.json] [--json]');
  if (!options.profileDir || !isAbsolute(options.profileDir)) throw new BridgeError('INVALID_ARGUMENT', '请明确指定原Coordinator profile的绝对目录，避免切换身份。');
  let params: unknown = {};
  if (options.file !== undefined) {
    const file = resolve(options.file);
    const info = statSync(file);
    if (!info.isFile() || info.size > 1048576) throw new BridgeError('INVALID_ARGUMENT', '参数文件须为不超过1MiB的JSON对象。');
    try { params = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new BridgeError('INVALID_ARGUMENT', '参数文件不是有效JSON。'); }
  }
  if (!record(params)) throw new BridgeError('INVALID_ARGUMENT', '参数文件必须包含JSON对象。');
  const read = ['agents.list', 'agents.get', 'agents.operation', 'callers.list', 'callers.operation'].includes(method);
  if (!read && (typeof params.operationId !== 'string' || !params.operationId.trim() || params.operationId.length > 150)) throw new BridgeError('INVALID_ARGUMENT', '写入前须在参数文件保存稳定operationId；回应未知时查询原operation，不换ID重做。');
  const client = createDesktopCoordinatorClient(resolve(options.profileDir));
  try {
    const reply = await client.request('call', {method, params});
    if (!record(reply) || typeof reply.ok !== 'boolean') throw new BridgeError('INTERCONNECT_RESPONSE_INVALID', '原后台回应格式无效，请保留原操作并查询。', 503);
    if (!reply.ok) {
      const error = record(reply.error) ? reply.error : {};
      throw Object.assign(new Error(typeof error.message === 'string' ? error.message : '原管理操作未确认。'), {code: typeof error.code === 'string' ? error.code : 'INTERCONNECT_FAILED'});
    }
    console.log(safeTerminal(JSON.stringify(reply.result, null, options.json ? undefined : 2)));
    return record(reply.result) && reply.result.state === 'not_found' ? 3 : 0;
  } finally { client.close(); }
}
